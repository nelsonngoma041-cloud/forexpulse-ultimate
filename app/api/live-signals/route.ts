// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';
import { AlphaVantageAPI } from '@/app/lib/broker-api';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const alphaVantage = new AlphaVantageAPI();

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function analyzeAndSendSignals() {
  console.log('📊 Fetching real market data from Alpha Vantage...');
  
  for (const symbol of symbols) {
    try {
      // Get REAL live price from Alpha Vantage
      const realPrice = await alphaVantage.getLivePrice(symbol);
      
      if (!realPrice) {
        console.log(`⚠️ Could not fetch price for ${symbol}, skipping...`);
        continue;
      }
      
      // Add real price to trading engine
      tradingEngine.addPrice(symbol, realPrice);
      
      // Get professional analysis based on REAL data
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 65) {
        const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
        const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
        
        await telegramBot.sendMessage(
          `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
          `*Symbol:* ${signal.symbol}\n` +
          `*Action:* ${signal.action === 'BUY' ? 'BUY' : 'SELL'}\n` +
          `*Current Price:* ${signal.entryPrice.toFixed(5)}\n` +
          `*Suggested Entry:* ${signal.entryPrice.toFixed(5)}\n` +
          `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
          `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
          `*Confidence:* ${signal.confidence}%\n\n` +
          `📊 *Technical Analysis*\n` +
          `• ${signal.indicators.rsi}\n` +
          `• ${signal.indicators.macd}\n` +
          `• Trend: ${signal.indicators.trend}\n\n` +
          `💡 *Reason:* ${signal.reason}`
        );
        
        console.log(`✅ ${signal.action} signal for ${symbol} (${signal.confidence}%)`);
      } else {
        console.log(`⏸️ No signal for ${symbol} - ${signal.reason} (Confidence: ${signal.confidence}%)`);
      }
      
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional trading bot started with REAL Alpha Vantage data');
    await analyzeAndSendSignals();
    intervalId = setInterval(analyzeAndSendSignals, 120000); // Every 2 minutes
    return NextResponse.json({ success: true, message: 'Professional trading bot started with REAL market data' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    console.log('⏸️ Trading bot stopped');
    return NextResponse.json({ success: true, message: 'Trading bot stopped' });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot analyzing REAL market data with RSI, MACD, and Moving Averages' : 'Bot stopped'
  });
}
