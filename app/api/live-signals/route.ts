// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// Get current price (simulated - replace with real API)
const getPrice = (symbol: string): number => {
  const basePrices: Record<string, number> = {
    'EUR/USD': 1.0892,
    'GBP/USD': 1.2715,
    'USD/JPY': 157.85,
    'AUD/USD': 0.6645,
    'USD/CAD': 1.3715
  };
  // Add small random movement
  const change = (Math.random() - 0.5) * 0.0005;
  return basePrices[symbol] + change;
};

async function analyzeAndSendSignals() {
  console.log('📊 Professional analysis running...');
  
  for (const symbol of symbols) {
    const price = getPrice(symbol);
    tradingEngine.addPrice(symbol, price);
    const signal = tradingEngine.analyze(symbol, price);
    
    if (signal.action !== 'HOLD' && signal.confidence >= 60) {
      const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
      const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
      
      const message = `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
        `*Symbol:* ${signal.symbol}\n` +
        `*Action:* ${signal.action}\n` +
        `*Entry:* ${signal.entryPrice.toFixed(5)}\n` +
        `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
        `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
        `*Confidence:* ${signal.confidence}%\n\n` +
        `📊 *Analysis:*\n` +
        `• ${signal.reason}\n\n` +
        `💡 *Agreeing Strategies:* ${signal.agreeingStrategies.length > 0 ? signal.agreeingStrategies.join(', ') : 'None'}`;
      
      await telegramBot.sendMessage(message);
      console.log(`✅ ${signal.action} ${signal.symbol} (${signal.confidence}%)`);
    } else {
      console.log(`⏸️ ${symbol}: ${signal.reason} (Conf: ${signal.confidence}%)`);
    }
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional trading bot started');
    await analyzeAndSendSignals();
    intervalId = setInterval(analyzeAndSendSignals, 120000);
    return NextResponse.json({ success: true });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) clearInterval(intervalId);
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ running: isRunning });
}
