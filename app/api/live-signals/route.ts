// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { TelegramAlertBot } from '@/app/lib/telegram-alerts';
import { tradingEngine } from '@/app/lib/trading-engine';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function analyzeAndSendSignals() {
  console.log('📊 Analyzing markets with RSI, MACD, and MA...');
  
  for (const symbol of symbols) {
    // Simulate live prices (replace with real API later)
    const mockPrice = symbol === 'EUR/USD' ? 1.0892 + (Math.random() - 0.5) * 0.003 :
                      symbol === 'GBP/USD' ? 1.2715 + (Math.random() - 0.5) * 0.003 :
                      symbol === 'USD/JPY' ? 157.85 + (Math.random() - 0.5) * 0.2 :
                      symbol === 'AUD/USD' ? 0.6645 + (Math.random() - 0.5) * 0.002 : 1.3715 + (Math.random() - 0.5) * 0.002;
    
    tradingEngine.addPrice(symbol, mockPrice);
    const signal = tradingEngine.analyze(symbol, mockPrice);
    
    if (signal.action !== 'HOLD') {
      const emoji = signal.action === 'BUY' ? '🟢' : '🔴';
      const trendEmoji = signal.action === 'BUY' ? '📈' : '📉';
      
      await telegramBot.sendMessage(
        `${emoji} ${trendEmoji} *${signal.action} SIGNAL* ${trendEmoji} ${emoji}\n\n` +
        `*Symbol:* ${signal.symbol}\n` +
        `*Action:* ${signal.action === 'BUY' ? 'BUY' : 'SELL'}\n` +
        `*Entry:* ${signal.entryPrice.toFixed(5)}\n` +
        `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
        `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
        `*Confidence:* ${signal.confidence}%\n\n` +
        `📊 *Technical Analysis*\n` +
        `• ${signal.indicators.rsi}\n` +
        `• ${signal.indicators.macd}\n` +
        `• Trend: ${signal.indicators.trend}\n\n` +
        `💡 *Reason:* ${signal.reason}`
      );
      console.log(`✅ Signal sent: ${signal.action} ${signal.symbol} (${signal.confidence}%)`);
    } else {
      console.log(`⏸️ Hold: ${symbol} - ${signal.reason}`);
    }
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
  
  return NextResponse.json({ running: isRunning, message: isRunning ? 'Running' : 'Stopped' });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot analyzing markets with RSI, MACD, and Moving Averages' : 'Bot stopped'
  });
}
