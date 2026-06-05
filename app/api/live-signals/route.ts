// app/api/live-signals/route.ts - With REAL Twelve Data API
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// Get REAL price from Twelve Data API
async function getRealPrice(symbol: string): Promise<number | null> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  
  try {
    // Convert symbol format (EUR/USD -> EUR/USD for Twelve Data)
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`
    );
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

async function analyzeAndSendSignals() {
  console.log('📊 Fetching REAL market data from Twelve Data...');
  
  for (const symbol of symbols) {
    try {
      // Get REAL price from API
      const realPrice = await getRealPrice(symbol);
      
      if (!realPrice) {
        console.log(`⚠️ Could not fetch ${symbol}, using simulated price`);
        // Fallback to simulated price if API fails
        const fallbackPrice = symbol === 'EUR/USD' ? 1.0892 :
                              symbol === 'GBP/USD' ? 1.2715 :
                              symbol === 'USD/JPY' ? 157.85 :
                              symbol === 'AUD/USD' ? 0.6645 : 1.3715;
        tradingEngine.addPrice(symbol, fallbackPrice);
        continue;
      }
      
      // Add real price to trading engine
      tradingEngine.addPrice(symbol, realPrice);
      
      // Get professional analysis
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 60) {
        const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
        const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
        
        const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
          `*Symbol:* ${signal.symbol}\n` +
          `*Action:* ${signal.action === 'BUY' ? 'BUY' : 'SELL'}\n` +
          `*Current Price:* ${signal.entryPrice.toFixed(5)}\n` +
          `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
          `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
          `*Confidence:* ${signal.confidence}%\n\n` +
          `*Strategies Agreeing:* ${signal.agreeingStrategies.length}/5\n` +
          `*Agreeing:* ${signal.agreeingStrategies.join(', ') || 'None'}\n\n` +
          `📊 *Technical Analysis*\n` +
          `• ${signal.indicators.rsi.signal}\n` +
          `• ${signal.indicators.macd.histogram > 0 ? 'Bullish' : 'Bearish'} MACD momentum\n` +
          `• ${signal.indicators.ma.trend}\n` +
          `• ${signal.indicators.supportResistance.signal}\n\n` +
          `💡 *Reason:* ${signal.reason}`;
        
        await telegramBot.sendMessage(message);
        console.log(`✅ ${signal.action} ${signal.symbol} (${signal.confidence}%) - ${signal.agreeingStrategies.length} strategies agree`);
      } else {
        console.log(`⏸️ ${symbol}: ${signal.reason} (${signal.confidence}%)`);
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
    console.log('🚀 Professional bot started with REAL Twelve Data prices');
    await analyzeAndSendSignals();
    intervalId = setInterval(analyzeAndSendSignals, 120000); // Every 2 minutes
    return NextResponse.json({ success: true, message: 'Professional bot started with REAL market data' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return NextResponse.json({ success: true, message: 'Trading bot stopped' });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot analyzing REAL market data with 5 strategies' : 'Bot stopped'
  });
}
