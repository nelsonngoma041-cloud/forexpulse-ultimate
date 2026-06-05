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

async function getRealPrice(symbol: string): Promise<number | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch(`https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.price ? parseFloat(data.price) : null;
  } catch (error) {
    return null;
  }
}

function formatZambiaTime(date: Date): string {
  const zambiaTime = new Date(date.getTime() + (2 * 60 * 60 * 1000));
  return zambiaTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function getZambiaHour(): number {
  return new Date().getUTCHours() + 2;
}

function getExecutionWindow(): { 
  startTime: string; 
  endTime: string; 
  windowMinutes: number; 
  instruction: string;
  urgency: string;
} {
  const now = new Date();
  const zambiaHour = getZambiaHour();
  
  let windowMinutes = 0;
  let urgency = '';
  let instruction = '';
  
  if (zambiaHour >= 15 && zambiaHour < 19) {
    windowMinutes = 15;
    urgency = '🟢 PRIME SESSION';
    instruction = 'Execute ANYTIME within the next 15 minutes';
  } 
  else if (zambiaHour >= 10 && zambiaHour < 15) {
    windowMinutes = 30;
    urgency = '🟡 GOOD SESSION';
    instruction = 'Execute within 30 minutes';
  }
  else if (zambiaHour >= 19 && zambiaHour < 22) {
    windowMinutes = 45;
    urgency = '🟠 LOW LIQUIDITY';
    instruction = 'Execute within 45 minutes - be careful with spreads';
  }
  else {
    windowMinutes = 60;
    urgency = '🔴 POOR SESSION';
    instruction = 'Consider waiting for 10:00 tomorrow';
  }
  
  const startTime = formatZambiaTime(now);
  const endDate = new Date(now);
  endDate.setMinutes(now.getMinutes() + windowMinutes);
  const endTime = formatZambiaTime(endDate);
  
  return { startTime, endTime, windowMinutes, instruction, urgency };
}

async function initializeHistoricalData() {
  for (const symbol of symbols) {
    const price = await getRealPrice(symbol);
    if (price) {
      for (let i = 0; i < 50; i++) {
        tradingEngine.addPrice(symbol, price * (1 + (Math.random() - 0.5) * 0.005));
      }
    }
  }
}

async function analyzeAndSendSignals() {
  if (!isRunning) return;
  
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
          
          const execWindow = getExecutionWindow();
          const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
          const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
          
          const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
            `*Symbol:* ${signal.symbol}\n` +
            `*Action:* ${signal.action}\n` +
            `*Entry:* ${signal.entryPrice.toFixed(5)}\n` +
            `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
            `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
            `*Confidence:* ${signal.confidence}%\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⏰ *EXECUTION WINDOW (Zambia Time)*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `${execWindow.urgency}\n\n` +
            `📍 Window Opens: ${execWindow.startTime}\n` +
            `📍 Window Closes: ${execWindow.endTime}\n` +
            `⏱️ You have ${execWindow.windowMinutes} MINUTES to execute\n\n` +
            `✅ *Instruction:* ${execWindow.instruction}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📋 *HOW TO EXECUTE (30 seconds):*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `1. Open MT5 app\n` +
            `2. Go to ${signal.symbol}\n` +
            `3. Click New Order\n` +
            `4. Select ${signal.action}\n` +
            `5. Volume: 0.01 (start small)\n` +
            `6. Stop Loss: ${signal.stopLoss.toFixed(5)}\n` +
            `7. Take Profit: ${signal.takeProfit.toFixed(5)}\n` +
            `8. Press ${signal.action}\n\n` +
            `⏱️ *Hold for:* 60 minutes\n` +
            `💡 *Don't rush - you have plenty of time!*`;
          
          await telegramBot.sendMessage(message);
          console.log(`✅ ${signal.action} ${symbol} | Window: ${execWindow.windowMinutes} min`);
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
  if (isRunning) intervalId = setTimeout(runAnalysisLoop, 120000);
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    await initializeHistoricalData();
    await telegramBot.sendMessage('🤖 *ForexPulse PRO Ready*\n\n' +
      '✅ Bot active\n' +
      '✅ Signals include 15-30 minute execution windows\n' +
      '✅ You have plenty of time to enter trades\n\n' +
      '📋 Just open MT5 and follow the steps - no rush!');
    await runAnalysisLoop();
    return NextResponse.json({ success: true });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) clearTimeout(intervalId);
    await telegramBot.sendMessage('⏸️ Bot stopped');
    return NextResponse.json({ success: true });
  }
  
  if (action === 'test') {
    const execWindow = getExecutionWindow();
    await telegramBot.sendMessage('🔔 *TEST SIGNAL*\n\n' +
      `✅ Execution Window: ${execWindow.windowMinutes} minutes\n` +
      `📍 From: ${execWindow.startTime} to ${execWindow.endTime}\n` +
      `✅ You have PLENTY of time to execute trades!\n` +
      `📋 Take your time - no 5-second rush!`);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ running: isRunning });
}
