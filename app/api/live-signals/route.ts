// app/api/live-signals/route.ts - WITH REAL TWELVE DATA API
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
  
  if (!apiKey) {
    console.error('⚠️ TWELVE_DATA_API_KEY not found in environment variables');
    return null;
  }
  
  try {
    console.log(`📡 Fetching real price for ${symbol}...`);
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${symbol}&apikey=${apiKey}`,
      { next: { revalidate: 30 } } // Cache for 30 seconds
    );
    
    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.price) {
      const price = parseFloat(data.price);
      console.log(`✅ ${symbol}: ${price}`);
      return price;
    }
    
    console.error(`No price data for ${symbol}:`, data);
    return null;
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

async function analyzeAndSendSignals() {
  console.log('📊 Professional analysis with REAL Twelve Data prices...');
  
  let successCount = 0;
  const signalsSent = [];
  
  for (const symbol of symbols) {
    try {
      // Get REAL price from Twelve Data API
      const realPrice = await getRealPrice(symbol);
      
      if (!realPrice) {
        console.log(`⚠️ Skipping ${symbol} - no price data`);
        continue;
      }
      
      successCount++;
      
      // Add real price to trading engine
      tradingEngine.addPrice(symbol, realPrice);
      
      // Get professional analysis
      const signal = tradingEngine.analyze(symbol, realPrice);
      
      if (signal.action !== 'HOLD' && signal.confidence >= 60) {
        const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
        const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
        
        const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
          `*Symbol:* ${signal.symbol}\n` +
          `*Action:* ${signal.action}\n` +
          `*Current Price:* ${signal.entryPrice.toFixed(5)}\n` +
          `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
          `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
          `*Confidence:* ${signal.confidence}%\n\n` +
          `*Agreeing Strategies:* ${signal.agreeingStrategies.length > 0 ? signal.agreeingStrategies.join(', ') : 'None'}\n\n` +
          `💡 *Analysis:* ${signal.reason}`;
        
        await telegramBot.sendMessage(message);
        signalsSent.push(`${signal.action} ${signal.symbol}`);
        console.log(`✅ ${signal.action} ${signal.symbol} (${signal.confidence}%) - ${signal.agreeingStrategies.length} strategies agree`);
      } else {
        console.log(`⏸️ ${symbol}: ${signal.reason} (Confidence: ${signal.confidence}%)`);
      }
      
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
  
  // Send summary
  if (signalsSent.length > 0) {
    await telegramBot.sendMessage(`📊 *Market Update*\n\nSignals generated: ${signalsSent.join(', ')}\nData source: Twelve Data (Real Market Prices)`);
  }
  
  console.log(`📊 Analysis complete. ${successCount}/${symbols.length} pairs updated.`);
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional bot started with REAL Twelve Data prices');
    await telegramBot.sendMessage('🤖 *ForexPulse PRO Activated*\n\nBot is now analyzing REAL market data from Twelve Data API.\nSignals will be sent when 2+ strategies agree.\n\nTrading active 24/7.');
    
    // Run immediately
    await analyzeAndSendSignals();
    
    // Then every 2 minutes
    intervalId = setInterval(analyzeAndSendSignals, 120000);
    
    return NextResponse.json({ success: true, message: 'Professional bot started with REAL market data' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    await telegramBot.sendMessage('⏸️ *ForexPulse PRO Deactivated*\n\nTrading bot has been stopped.');
    return NextResponse.json({ success: true, message: 'Trading bot stopped' });
  }
  
  if (action === 'status') {
    return NextResponse.json({ running: isRunning });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  // Test the API key
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const testPrice = await getRealPrice('EUR/USD');
  
  return NextResponse.json({ 
    running: isRunning,
    apiKeyConfigured: !!apiKey,
    testPrice: testPrice,
    message: isRunning ? 'Bot analyzing REAL market data' : 'Bot stopped'
  });
}
