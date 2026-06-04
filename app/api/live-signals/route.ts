// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot, TradeAlert } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';
import { AlphaVantageAPI } from '@/app/lib/broker-api';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const alphaVantage = new AlphaVantageAPI();

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function analyzeAndSendSignals() {
  console.log('🔍 Analyzing markets...');
  
  for (const symbol of symbols) {
    try {
      // Get live price
      const price = await alphaVantage.getLivePrice(symbol);
      if (!price) continue;
      
      // Add to trading engine
      tradingEngine.addPrice(symbol, price);
      
      // Get professional analysis
      const signal = tradingEngine.analyze(symbol, price);
      
      if (signal.action !== 'HOLD') {
        const tradeAlert: TradeAlert = {
          symbol: signal.symbol,
          action: signal.action,
          price: signal.entryPrice,
          confidence: signal.confidence / 100,
          signalType: 'Professional Technical Analysis',
          volume: 0.1,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit
        };
        
        await telegramBot.sendTradeAlert(tradeAlert);
        console.log(`✅ SIGNAL: ${signal.action} ${signal.symbol} | Confidence: ${signal.confidence}% | ${signal.reason}`);
      } else {
        console.log(`⏸️ HOLD: ${symbol} | ${signal.reason}`);
      }
      
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
    }
  }
  
  // Send market summary every 5 minutes
  if (Math.floor(Date.now() / 60000) % 5 === 0) {
    const summary = tradingEngine.getMarketSummary();
    await telegramBot.sendMessage(`📊 *Market Summary*\n\n${summary}`);
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    await analyzeAndSendSignals();
    intervalId = setInterval(analyzeAndSendSignals, 60000);
    return NextResponse.json({ success: true, message: 'Professional trading bot started' });
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
    message: isRunning ? 'Bot analyzing markets with RSI, MACD, and Moving Averages' : 'Bot stopped'
  });
}
