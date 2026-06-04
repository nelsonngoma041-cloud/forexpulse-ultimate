// app/api/signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot, TradeAlert } from '@/app/lib/telegram-alerts';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const currencyPairs = [
  { symbol: 'EUR/USD', basePrice: 1.0892 },
  { symbol: 'GBP/USD', basePrice: 1.2715 },
  { symbol: 'USD/JPY', basePrice: 157.85 },
  { symbol: 'AUD/USD', basePrice: 0.6645 },
  { symbol: 'USD/CAD', basePrice: 1.3715 },
];

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

function generateSignal(pair: { symbol: string; basePrice: number }): TradeAlert {
  const isBuy = Math.random() > 0.5;
  const action = isBuy ? 'BUY' : 'SELL';
  const variation = (Math.random() - 0.5) * 0.005;
  const price = pair.basePrice + variation;
  
  let stopLoss, takeProfit;
  if (action === 'BUY') {
    if (pair.symbol === 'USD/JPY') {
      stopLoss = price - 3.0;
      takeProfit = price + 6.0;
    } else {
      stopLoss = price - 0.0030;
      takeProfit = price + 0.0060;
    }
  } else {
    if (pair.symbol === 'USD/JPY') {
      stopLoss = price + 3.0;
      takeProfit = price - 6.0;
    } else {
      stopLoss = price + 0.0030;
      takeProfit = price - 0.0060;
    }
  }
  
  const reasons = ['Technical analysis', 'RSI signal', 'Trend breakout', 'Support bounce'];
  const reason = reasons[Math.floor(Math.random() * reasons.length)];
  
  return {
    symbol: pair.symbol,
    action,
    price,
    confidence: 0.7 + Math.random() * 0.25,
    signalType: 'Server-Side Automated Signal',
    volume: 0.1,
    stopLoss,
    takeProfit
  };
}

async function sendSignals() {
  console.log('📊 Sending signals for all pairs...');
  for (const pair of currencyPairs) {
    const signal = generateSignal(pair);
    await telegramBot.sendTradeAlert(signal);
    console.log(`Sent: ${signal.action} ${signal.symbol} @ ${signal.price.toFixed(5)}`);
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    // Send immediately
    await sendSignals();
    // Then every 60 seconds
    intervalId = setInterval(sendSignals, 60000);
    return NextResponse.json({ success: true, message: 'Signal bot started' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    return NextResponse.json({ success: true, message: 'Signal bot stopped' });
  }
  
  if (action === 'status') {
    return NextResponse.json({ running: isRunning });
  }
  
  return NextResponse.json({ success: false, message: 'Invalid action' });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot is running' : 'Bot is stopped',
    pairs: currencyPairs.map(p => p.symbol)
  });
  }
