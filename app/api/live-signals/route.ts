// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

// MT5 Bridge Configuration
const MT5_BRIDGE_URL = process.env.MT5_BRIDGE_URL || 'http://bore.pub:39513';

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let lastSignalTime: { [key: string]: number } = {};

// Auto-trade settings
const AUTO_TRADE_CONFIG = {
  enabled: true,
  maxDailyTrades: 10,
  positionSize: 0.01,
  minConfidence: 35,
};

let dailyTradeCount = 0;
let lastTradeDate = new Date().toDateString();

// Get REAL price from Twelve Data API
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

// Execute trade on MT5 via bridge
async function executeTradeOnMT5(symbol: string, action: 'BUY' | 'SELL', price: number, stopLoss: number, takeProfit: number): Promise<boolean> {
  try {
    const response = await fetch(`${MT5_BRIDGE_URL}/trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        symbol: symbol,
        action: action,
        price: price,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        volume: AUTO_TRADE_CONFIG.positionSize
      })
    });
    
    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('MT5 Bridge error:', error);
    return false;
  }
}

// Send Telegram alert
async function sendTelegramAlert(symbol: string, action: 'BUY' | 'SELL', price: number, stopLoss: number, takeProfit: number, confidence: number, executed: boolean) {
  const emoji = action === 'BUY' ? '🟢' : '🔴';
  const trendEmoji = action === 'BUY' ? '📈' : '📉';
  
  const statusEmoji = executed ? '✅' : '⚠️';
  const statusText = executed ? 'EXECUTED on MT5' : 'Signal Only (Bridge offline)';
  
  const message = `${emoji} ${trendEmoji} *${action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
    `*Symbol:* ${symbol}\n` +
    `*Action:* ${action}\n` +
    `*Entry:* ${price.toFixed(5)}\n` +
    `*Stop Loss:* ${stopLoss.toFixed(5)}\n` +
    `*Take Profit:* ${takeProfit.toFixed(5)}\n` +
    `*Confidence:* ${confidence}%\n\n` +
    `${statusEmoji} *Trade Status:* ${statusText}\n\n` +
    `🤖 Bot: ForexPulse PRO`;
  
  await telegramBot.sendMessage(message);
}

// Reset daily counter
function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastTradeDate) {
    dailyTradeCount = 0;
    lastTradeDate = today;
  }
}

async function analyzeAndExecute() {
  if (!isRunning) return;
  
  checkDailyReset();
  
  console.log(`[${new Date().toLocaleTimeString()}] 📊 Analyzing markets...`);
  
  for (const symbol of symbols) {
    try {
      const realPrice = await getRealPrice(symbol);
      if (!realPrice) continue;
      
      tradingEngine.addPrice(symbol, realPrice);
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      if (signal.action !== 'HOLD' && signal.confidence >= AUTO_TRADE_CONFIG.minConfidence) {
        const now = Date.now();
        const lastSent = lastSignalTime[`${symbol}_${signal.action}`] || 0;
        
        // Only send same signal every 30 minutes
        if (now - lastSent > 1800000) {
          lastSignalTime[`${symbol}_${signal.action}`] = now;
          
          // Try to execute on MT5
          let tradeExecuted = false;
          if (AUTO_TRADE_CONFIG.enabled && dailyTradeCount < AUTO_TRADE_CONFIG.maxDailyTrades) {
            tradeExecuted = await executeTradeOnMT5(
              signal.symbol,
              signal.action,
              realPrice,
              signal.stopLoss,
              signal.takeProfit
            );
            
            if (tradeExecuted) {
              dailyTradeCount++;
              console.log(`✅ AUTO-TRADE: ${signal.action} ${signal.symbol} (Day #${dailyTradeCount})`);
            }
          }
          
          // Send Telegram alert (always)
          await sendTelegramAlert(
            signal.symbol,
            signal.action,
            realPrice,
            signal.stopLoss,
            signal.takeProfit,
            signal.confidence,
            tradeExecuted
          );
        }
      }
    } catch (error) {
      console.error(`Error:`, error);
    }
  }
}

async function runAnalysisLoop() {
  if (!isRunning) return;
  await analyzeAndExecute();
  if (isRunning) {
    intervalId = setTimeout(runAnalysisLoop, 60000);
  }
}

// API Routes
export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Auto-trade bot starting...');
    
    await telegramBot.sendMessage('🤖 *ForexPulse PRO Auto-Trade Activated*\n\n' +
      `✅ Bot analyzing REAL market data\n` +
      `✅ MT5 Bridge: ${MT5_BRIDGE_URL}\n` +
      `✅ Auto-trade enabled\n` +
      `✅ Max ${AUTO_TRADE_CONFIG.maxDailyTrades} trades/day\n` +
      `✅ Signals will be executed on MT5 automatically`);
    
    await runAnalysisLoop();
    return NextResponse.json({ success: true, message: 'Auto-trade started' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) clearTimeout(intervalId);
    await telegramBot.sendMessage('⏸️ *Auto-Trade Stopped*');
    return NextResponse.json({ success: true });
  }
  
  if (action === 'test') {
    // Test MT5 bridge connection
    try {
      const response = await fetch(`${MT5_BRIDGE_URL}/health`);
      const bridgeStatus = await response.json();
      await telegramBot.sendMessage(`🔔 *MT5 Bridge Test*\n\n✅ Bridge is ONLINE\n📍 URL: ${MT5_BRIDGE_URL}\n📊 Status: ${JSON.stringify(bridgeStatus)}`);
    } catch (error) {
      await telegramBot.sendMessage(`❌ *MT5 Bridge Test Failed*\n\nBridge not reachable at ${MT5_BRIDGE_URL}\nCheck your phone bridge is running.`);
    }
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    bridgeUrl: MT5_BRIDGE_URL,
    autoTradeEnabled: AUTO_TRADE_CONFIG.enabled,
    dailyTradesRemaining: AUTO_TRADE_CONFIG.maxDailyTrades - dailyTradeCount
  });
}
