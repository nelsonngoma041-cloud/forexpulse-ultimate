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
  // Zambia is UTC+2 (no daylight savings)
  const zambiaTime = new Date(date.getTime() + (2 * 60 * 60 * 1000));
  return zambiaTime.toLocaleTimeString('en-GB', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit',
    hour12: false 
  });
}

// Get current hour in Zambia time (UTC+2)
function getZambiaHour(): number {
  const now = new Date();
  return now.getUTCHours() + 2;
}

// Calculate optimal execution time based on Zambia timezone
function getOptimalExecutionTime(): { time: Date; session: string; description: string; priority: string } {
  const now = new Date();
  const zambiaHour = getZambiaHour();
  const zambiaMinute = new Date().getUTCMinutes();
  
  let session = '';
  let description = '';
  let priority = '';
  let executionTime = new Date(now);
  
  // Best trading hours in Zambia time (UTC+2)
  if (zambiaHour >= 15 && zambiaHour < 19) {
    session = '🔥 LONDON & NEW YORK OVERLAP';
    description = 'Highest liquidity - 50% of daily volume';
    priority = 'EXECUTE NOW - Best time of day';
    executionTime.setSeconds(now.getSeconds() + 5);
  } 
  else if (zambiaHour >= 14 && zambiaHour < 15) {
    session = '📈 PRE-OVERLAP BUILDUP';
    description = 'Liquidity increasing - prepare for entry';
    priority = 'Get ready - overlap starts in 1 hour';
    executionTime.setMinutes(zambiaMinute + 5);
  }
  else if (zambiaHour >= 10 && zambiaHour < 15) {
    session = '✅ LONDON SESSION';
    description = 'Good liquidity - 30% of daily volume';
    priority = 'Execute within 5 minutes';
    executionTime.setSeconds(now.getSeconds() + 10);
  }
  else if (zambiaHour >= 19 && zambiaHour < 22) {
    session = '⚠️ NEW YORK ONLY';
    description = 'Lower liquidity - wider spreads possible';
    priority = 'Consider waiting or use limit orders';
    executionTime.setSeconds(now.getSeconds() + 30);
  }
  else if (zambiaHour >= 22 || zambiaHour < 3) {
    session = '🌙 ASIA SESSION (NIGHT)';
    description = 'Very low liquidity - avoid trading';
    priority = 'AVOID - Set alert for 10:00 Zambia time';
    // Set to next good session (10:00 Zambia time)
    const nextGood = new Date(now);
    nextGood.setUTCHours(8, 0, 0, 0); // 10:00 Zambia time
    if (nextGood < now) nextGood.setDate(nextGood.getDate() + 1);
    executionTime = nextGood;
  }
  else {
    session = '🌅 ASIA SESSION (MORNING)';
    description = 'Low liquidity - quiet market';
    priority = 'Wait for London open (10:00)';
    const nextGood = new Date(now);
    nextGood.setUTCHours(8, 0, 0, 0);
    if (nextGood < now) nextGood.setDate(nextGood.getDate() + 1);
    executionTime = nextGood;
  }
  
  return { time: executionTime, session, description, priority };
}

// Calculate recommended hold time based on session
function getRecommendedHoldTime(session: string): number {
  if (session.includes('OVERLAP')) return 60;
  if (session.includes('LONDON')) return 45;
  if (session.includes('NEW YORK')) return 30;
  return 20;
}

// Generate historical data for better analysis
async function initializeHistoricalData() {
  console.log('📊 Initializing historical data for analysis...');
  
  for (const symbol of symbols) {
    const price = await getRealPrice(symbol);
    if (price) {
      for (let i = 0; i < 50; i++) {
        const variation = (Math.random() - 0.5) * 0.005;
        const historicalPrice = price * (1 + variation);
        tradingEngine.addPrice(symbol, historicalPrice);
      }
      console.log(`✅ Initialized ${symbol}`);
    }
  }
}

async function analyzeAndSendSignals() {
  if (!isRunning) return;
  
  const zambiaHour = getZambiaHour();
  console.log(`[Zambia Time: ${formatZambiaTime(new Date())}] 📊 Analyzing markets...`);
  
  for (const symbol of symbols) {
    try {
      const realPrice = await getRealPrice(symbol);
      if (!realPrice) continue;
      
      tradingEngine.addPrice(symbol, realPrice);
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      console.log(`📈 ${symbol}: ${signal.action} | Confidence: ${signal.confidence}%`);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 30) {
        const now = Date.now();
        const lastSent = lastSignalTime[`${symbol}_${signal.action}`] || 0;
        
        // Only send same signal every 30 minutes
        if (now - lastSent > 1800000) {
          lastSignalTime[`${symbol}_${signal.action}`] = now;
          
          const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
          const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
          
          // Get execution timing
          const execTime = getOptimalExecutionTime();
          const zambiaExecTime = formatZambiaTime(execTime.time);
          const holdMinutes = getRecommendedHoldTime(execTime.session);
          
          // Determine if signal is urgent
          const isUrgent = execTime.session.includes('OVERLAP');
          const urgencyEmoji = isUrgent ? '🚨🔥' : '📊';
          
          // Build the message
          const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
            `*Symbol:* ${signal.symbol}\n` +
            `*Action:* ${signal.action}\n` +
            `*Entry:* ${signal.entryPrice.toFixed(5)}\n` +
            `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
            `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
            `*Confidence:* ${signal.confidence}%\n\n` +
            `⏰ *ZAMBIA TIME (UTC+2)*\n` +
            `• Current time: ${formatZambiaTime(new Date())}\n` +
            `• Best execution: ${zambiaExecTime}\n` +
            `• Session: ${execTime.session}\n` +
            `• ${execTime.description}\n\n` +
            `${urgencyEmoji} *Action:* ${execTime.priority}\n\n` +
            `⏱️ *Recommended Hold Time:* ${holdMinutes} minutes\n\n` +
            `📊 *Technical Analysis:*\n` +
            `• ${signal.reason}\n\n` +
            `💡 *Trading Tips for Zambia:*\n` +
            `• Best hours: 15:00 - 19:00 (Lunch break to evening)\n` +
            `• Good hours: 10:00 - 15:00 (Morning to lunch)\n` +
            `• Avoid trading: 22:00 - 10:00 (Overnight)`;
          
          await telegramBot.sendMessage(message);
          console.log(`✅ ${signal.action} ${symbol} signal sent | Execute at ${zambiaExecTime} Zambia time`);
        }
      }
      
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
}

// Main analysis loop
async function runAnalysisLoop() {
  if (!isRunning) return;
  await analyzeAndSendSignals();
  if (isRunning) {
    intervalId = setTimeout(runAnalysisLoop, 120000); // 2 minutes
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional bot starting for Zambia timezone...');
    
    if (intervalId) clearTimeout(intervalId);
    
    await initializeHistoricalData();
    
    const execInfo = getOptimalExecutionTime();
    const currentZambiaTime = formatZambiaTime(new Date());
    const nextGoodTime = formatZambiaTime(execInfo.time);
    
    await telegramBot.sendMessage('🤖 *ForexPulse PRO Activated for Zambia* 🇿🇲\n\n' +
      `✅ Current Zambia time: ${currentZambiaTime}\n` +
      `✅ Timezone: UTC+2 (Central Africa Time)\n` +
      `📊 Best trading hours: 15:00 - 19:00\n` +
      `📈 Good trading hours: 10:00 - 15:00\n\n` +
      `⏰ Next good session: ${nextGoodTime}\n` +
      `📊 Session: ${execInfo.session}\n\n` +
      '✅ Bot analyzing REAL market data\n' +
      '✅ Signals will include Zambia time execution windows');
    
    await runAnalysisLoop();
    
    return NextResponse.json({ success: true, message: 'Bot started for Zambia timezone' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) clearTimeout(intervalId);
    await telegramBot.sendMessage('⏸️ *ForexPulse PRO Deactivated*\n\nTrading bot stopped.');
    return NextResponse.json({ success: true, message: 'Bot stopped' });
  }
  
  if (action === 'test') {
    const execInfo = getOptimalExecutionTime();
    const currentTime = formatZambiaTime(new Date());
    const execTime = formatZambiaTime(execInfo.time);
    
    await telegramBot.sendMessage('🔔 *TEST SIGNAL - Zambia Timezone*\n\n' +
      `🇿🇲 Current Zambia time: ${currentTime}\n` +
      `⏰ Best execution: ${execTime}\n` +
      `📊 Session: ${execInfo.session}\n` +
      `📈 ${execInfo.description}\n\n` +
      `✅ Your bot is configured correctly for Zambia!\n` +
      `📊 Best trading: 15:00 - 19:00\n` +
      `📈 Good trading: 10:00 - 15:00`);
    return NextResponse.json({ success: true, message: 'Test sent' });
  }
  
  if (action === 'status') {
    const execInfo = getOptimalExecutionTime();
    return NextResponse.json({ 
      running: isRunning,
      zambiaTime: formatZambiaTime(new Date()),
      currentSession: execInfo.session,
      nextExecutionTime: formatZambiaTime(execInfo.time)
    });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  const execInfo = getOptimalExecutionTime();
  return NextResponse.json({ 
    running: isRunning,
    zambiaTime: formatZambiaTime(new Date()),
    currentSession: execInfo.session,
    nextExecutionTime: formatZambiaTime(execInfo.time),
    message: isRunning ? 'Bot running for Zambia timezone' : 'Bot stopped'
  });
}
