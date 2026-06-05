// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastSignalTime: { [key: string]: number } = {};

// Get REAL price from Twelve Data API
async function getRealPrice(symbol: string): Promise<number | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  
  if (!apiKey) {
    console.error('⚠️ TWELVE_DATA_API_KEY not found');
    return null;
  }
  
  try {
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`,
      { next: { revalidate: 30 } }
    );
    
    if (!response.ok) return null;
    const data = await response.json();
    
    if (data.price) {
      return parseFloat(data.price);
    }
    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

// Format time for display (Zambia Time = UTC+2)
function formatZambiaTime(date: Date): string {
  const zambiaTime = new Date(date.getTime() + (2 * 60 * 60 * 1000));
  return zambiaTime.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

// Get current Zambia time
function getCurrentZambiaTime(): { time: string; seconds: number } {
  const now = new Date();
  const zambiaTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  return {
    time: formatZambiaTime(now),
    seconds: zambiaTime.getSeconds()
  };
}

// Calculate exact entry time with countdown
function getExactEntryTime(): { 
  entryTime: Date; 
  entryTimeString: string; 
  countdownSeconds: number;
  entryWindow: string;
  instruction: string;
} {
  const now = new Date();
  const zambiaTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  const currentSecond = zambiaTime.getSeconds();
  
  // Round up to next 15-second mark for better execution
  let targetSecond = Math.ceil(currentSecond / 15) * 15;
  if (targetSecond === 60) targetSecond = 0;
  
  const entryTime = new Date(now);
  const secondsToAdd = targetSecond - currentSecond + (targetSecond === 0 ? 60 : 0);
  entryTime.setSeconds(now.getSeconds() + secondsToAdd);
  
  const entryTimeZambia = new Date(entryTime.getTime() + (2 * 60 * 60 * 1000));
  const entryTimeString = entryTimeZambia.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
  
  let countdownSeconds = secondsToAdd;
  let entryWindow = '';
  let instruction = '';
  
  if (countdownSeconds <= 5) {
    entryWindow = '🚨 IMMEDIATE ENTRY 🚨';
    instruction = 'PRESS BUY/SELL NOW - This is your entry window!';
  } else if (countdownSeconds <= 15) {
    entryWindow = '⏰ ENTERING SOON';
    instruction = `Get ready to press entry in ${countdownSeconds} seconds`;
  } else {
    instruction = `Set a timer for ${countdownSeconds} seconds from now`;
  }
  
  return { entryTime, entryTimeString, countdownSeconds, entryWindow, instruction };
}

function getOptimalExecutionTime(): { session: string; description: string; priority: string } {
  const zambiaHour = new Date().getUTCHours() + 2;
  
  if (zambiaHour >= 15 && zambiaHour < 19) {
    return {
      session: '🔥 LONDON & NEW YORK OVERLAP',
      description: 'Highest liquidity - BEST time to trade',
      priority: 'EXECUTE NOW - Prime trading window'
    };
  } else if (zambiaHour >= 10 && zambiaHour < 15) {
    return {
      session: '✅ LONDON SESSION',
      description: 'Good liquidity - recommended',
      priority: 'Execute within 5 minutes'
    };
  } else if (zambiaHour >= 19 && zambiaHour < 22) {
    return {
      session: '⚠️ NEW YORK ONLY',
      description: 'Lower liquidity - careful with spreads',
      priority: 'Consider waiting or use limit orders'
    };
  } else {
    return {
      session: '🌙 ASIA SESSION',
      description: 'Low liquidity - avoid trading',
      priority: 'AVOID - Wait for 10:00 Zambia time'
    };
  }
}

function getRecommendedHoldTime(): number {
  const zambiaHour = new Date().getUTCHours() + 2;
  if (zambiaHour >= 15 && zambiaHour < 19) return 60;
  if (zambiaHour >= 10 && zambiaHour < 15) return 45;
  return 30;
}

async function initializeHistoricalData() {
  console.log('📊 Initializing historical data...');
  for (const symbol of symbols) {
    const price = await getRealPrice(symbol);
    if (price) {
      for (let i = 0; i < 50; i++) {
        const variation = (Math.random() - 0.5) * 0.005;
        tradingEngine.addPrice(symbol, price * (1 + variation));
      }
    }
  }
}

async function analyzeAndSendSignals() {
  if (!isRunning) return;
  
  const currentZambia = getCurrentZambiaTime();
  console.log(`[Zambia: ${currentZambia.time}] 📊 Analyzing...`);
  
  for (const symbol of symbols) {
    try {
      const realPrice = await getRealPrice(symbol);
      if (!realPrice) continue;
      
      tradingEngine.addPrice(symbol, realPrice);
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 30) {
        const now = Date.now();
        const lastSent = lastSignalTime[`${symbol}_${signal.action}`] || 0;
        
        if (now - lastSent > 1800000) {
          lastSignalTime[`${symbol}_${signal.action}`] = now;
          
          const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
          const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
          
          const execInfo = getOptimalExecutionTime();
          const exactEntry = getExactEntryTime();
          const holdMinutes = getRecommendedHoldTime();
          
          // Build the message with EXACT entry instructions
          const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
            `*Symbol:* ${signal.symbol}\n` +
            `*Action:* ${signal.action}\n` +
            `*Entry:* ${signal.entryPrice.toFixed(5)}\n` +
            `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
            `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
            `*Confidence:* ${signal.confidence}%\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⏰ *EXACT ENTRY TIME (Zambia UTC+2)*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `📍 *Current Time:* ${currentZambia.time}\n` +
            `🎯 *PRESS ENTRY AT:* ${exactEntry.entryTimeString} SHARP\n` +
            `⏱️ *Countdown:* ${exactEntry.countdownSeconds} seconds\n` +
            `${exactEntry.entryWindow ? `🚨 *${exactEntry.entryWindow}* 🚨\n` : ''}` +
            `📝 *Instruction:* ${exactEntry.instruction}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 *Market Session:*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `• ${execInfo.session}\n` +
            `• ${execInfo.description}\n` +
            `• ${execInfo.priority}\n\n` +
            `⏱️ *Hold Time:* ${holdMinutes} minutes\n\n` +
            `📊 *Technical Analysis:*\n` +
            `• ${signal.reason}\n\n` +
            `💡 *Zambia Trading Hours:*\n` +
            `• 🔥 BEST: 15:00 - 19:00 (Execute immediately)\n` +
            `• ✅ GOOD: 10:00 - 15:00 (Execute within 5 min)\n` +
            `• ❌ AVOID: 22:00 - 10:00 (Sleep/rest)`;
          
          await telegramBot.sendMessage(message);
          console.log(`✅ ${signal.action} ${symbol} | Entry at ${exactEntry.entryTimeString} Zambia time`);
        }
      }
      
    } catch (error) {
      console.error(`Error:`, error);
    }
  }
}

async function runAnalysisLoop() {
  if (!isRunning) return;
  await analyzeAndSendSignals();
  if (isRunning) {
    intervalId = setTimeout(runAnalysisLoop, 120000);
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Bot starting for Zambia...');
    
    if (intervalId) clearTimeout(intervalId);
    
    await initializeHistoricalData();
    
    const currentZambia = getCurrentZambiaTime();
    const execInfo = getOptimalExecutionTime();
    const exactEntry = getExactEntryTime();
    
    await telegramBot.sendMessage('🤖 *ForexPulse PRO - Zambia Edition* 🇿🇲\n\n' +
      `✅ Current Zambia time: ${currentZambia.time}\n` +
      `✅ Timezone: UTC+2 (Central Africa Time)\n\n` +
      `📊 *Market Status:*\n` +
      `• ${execInfo.session}\n` +
      `• ${execInfo.description}\n\n` +
      `⏰ *Next entry window:* ${exactEntry.entryTimeString}\n` +
      `• ${exactEntry.countdownSeconds} seconds from now\n\n` +
      `💡 *Best Trading Hours:*\n` +
      `• 🔥 15:00 - 19:00 (Prime window)\n` +
      `• ✅ 10:00 - 15:00 (Good window)\n` +
      `• ❌ 22:00 - 10:00 (Avoid)\n\n` +
      '✅ Bot is ready - signals will include exact entry times');
    
    await runAnalysisLoop();
    
    return NextResponse.json({ success: true, message: 'Bot started' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) clearTimeout(intervalId);
    await telegramBot.sendMessage('⏸️ *Bot Stopped*\n\nTrading bot deactivated.');
    return NextResponse.json({ success: true, message: 'Bot stopped' });
  }
  
  if (action === 'test') {
    const currentZambia = getCurrentZambiaTime();
    const exactEntry = getExactEntryTime();
    const execInfo = getOptimalExecutionTime();
    
    await telegramBot.sendMessage('🔔 *TEST SIGNAL - Entry Timing Demo*\n\n' +
      `🇿🇲 Current Zambia time: ${currentZambia.time}\n` +
      `🎯 TEST ENTRY AT: ${exactEntry.entryTimeString}\n` +
      `⏱️ Countdown: ${exactEntry.countdownSeconds} seconds\n\n` +
      `📊 Session: ${execInfo.session}\n` +
      `📈 ${execInfo.description}\n\n` +
      `✅ Your bot is ready!\n` +
      `📱 Keep this chat open\n` +
      `🟢 When you see a signal, press entry at the exact time shown`);
    return NextResponse.json({ success: true, message: 'Test sent' });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  const exactEntry = getExactEntryTime();
  return NextResponse.json({ 
    running: isRunning,
    nextEntryTime: exactEntry.entryTimeString,
    countdownSeconds: exactEntry.countdownSeconds
  });
}
