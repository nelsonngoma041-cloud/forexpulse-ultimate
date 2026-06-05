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
      console.log(`✅ Initialized ${symbol} with 50 candles`);
    }
  }
}

async function analyzeAndSendSignals() {
  if (!isRunning) {
    console.log('Bot is not running, skipping analysis');
    return;
  }
  
  console.log(`[${new Date().toLocaleTimeString()}] 📊 Analyzing markets...`);
  
  let signalsSent = 0;
  
  for (const symbol of symbols) {
    try {
      const realPrice = await getRealPrice(symbol);
      
      if (!realPrice) {
        console.log(`⚠️ No price for ${symbol}`);
        continue;
      }
      
      tradingEngine.addPrice(symbol, realPrice);
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      console.log(`📈 ${symbol}: ${signal.action} | Confidence: ${signal.confidence}%`);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 40) {
        const now = Date.now();
        const lastSent = lastSignalTime[`${symbol}_${signal.action}`] || 0;
        
        // Only send same signal every 5 minutes
        if (now - lastSent > 300000) {
          lastSignalTime[`${symbol}_${signal.action}`] = now;
          signalsSent++;
          
          const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
          const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
          
          const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
            `*Symbol:* ${signal.symbol}\n` +
            `*Action:* ${signal.action}\n` +
            `*Price:* ${signal.entryPrice.toFixed(5)}\n` +
            `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
            `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
            `*Confidence:* ${signal.confidence}%\n\n` +
            `💡 ${signal.reason}`;
          
          await telegramBot.sendMessage(message);
          console.log(`✅ SENT: ${signal.action} ${symbol}`);
        }
      }
      
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
  
  if (signalsSent === 0) {
    console.log('⏸️ No new signals this cycle');
  }
}

// Main analysis loop
async function runAnalysisLoop() {
  if (!isRunning) return;
  
  await analyzeAndSendSignals();
  
  // Schedule next run
  if (isRunning) {
    intervalId = setTimeout(runAnalysisLoop, 60000); // 60 seconds
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional bot starting...');
    
    // Clear any existing timeout
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    
    await initializeHistoricalData();
    
    await telegramBot.sendMessage('🤖 *ForexPulse PRO Activated*\n\n✅ Bot is now analyzing REAL market data\n✅ 5 currency pairs active\n✅ Signals will appear here when detected');
    
    // Start the loop
    await runAnalysisLoop();
    
    return NextResponse.json({ success: true, message: 'Bot started' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearTimeout(intervalId);
      intervalId = null;
    }
    await telegramBot.sendMessage('⏸️ *ForexPulse PRO Deactivated*\n\nTrading bot has been stopped.');
    return NextResponse.json({ success: true, message: 'Bot stopped' });
  }
  
  if (action === 'test') {
    await telegramBot.sendMessage('🔔 *TEST SIGNAL*\n\nIf you received this, your Telegram bot is working!\n\n✅ Ready to trade\n\nClick "Start Professional Trading" to begin.');
    return NextResponse.json({ success: true, message: 'Test sent' });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  return NextResponse.json({ 
    running: isRunning,
    apiKeyConfigured: !!apiKey
  });
      }
