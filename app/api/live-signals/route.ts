// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';

const TELEGRAM_TOKEN = '8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q';
const TELEGRAM_CHAT_ID = '7724961440';

async function sendTelegramMessage(message: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json();
    console.log('Telegram send result:', result);
    return result;
  } catch (error) {
    console.error('Telegram error:', error);
    return null;
  }
}

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// Get Zambia time (UTC+2)
function getZambiaTime(): string {
  const now = new Date();
  const zambiaTime = new Date(now.getTime() + (2 * 60 * 60 * 1000));
  return zambiaTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Get trading session recommendation
function getTradingSession(): { quality: string; emoji: string; message: string } {
  const now = new Date();
  const zambiaHour = now.getUTCHours() + 2;
  
  if (zambiaHour >= 15 && zambiaHour < 19) {
    return { quality: 'Best', emoji: '🔥', message: 'Prime trading window - HIGH liquidity' };
  } else if (zambiaHour >= 10 && zambiaHour < 15) {
    return { quality: 'Good', emoji: '✅', message: 'Good liquidity - recommended' };
  } else if (zambiaHour >= 19 && zambiaHour < 22) {
    return { quality: 'Low', emoji: '⚠️', message: 'Low liquidity - trade with caution' };
  } else {
    return { quality: 'Avoid', emoji: '😴', message: 'Avoid trading - low volume' };
  }
}

// Generate a random trading signal
function generateSignal() {
  const symbols = [
    { symbol: 'EUR/USD', price: 1.0892, sl: 1.0860, tp: 1.0950 },
    { symbol: 'GBP/USD', price: 1.2715, sl: 1.2680, tp: 1.2780 },
    { symbol: 'USD/JPY', price: 157.85, sl: 158.50, tp: 156.50 },
    { symbol: 'AUD/USD', price: 0.6645, sl: 0.6610, tp: 0.6700 },
    { symbol: 'USD/CAD', price: 1.3715, sl: 1.3745, tp: 1.3660 },
  ];
  const actions = ['BUY', 'SELL'];
  
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  
  return {
    symbol: randomSymbol.symbol,
    action: randomAction,
    price: randomSymbol.price,
    stopLoss: randomSymbol.sl,
    takeProfit: randomSymbol.tp,
    confidence: Math.floor(Math.random() * 30) + 65, // 65-95%
  };
}

// Calculate position size
function calculatePositionSize(accountBalance: number = 1000, riskPercent: number = 1, stopLossPips: number = 30): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  const positionSize = riskAmount / (stopLossPips * 10);
  return Math.min(positionSize, 0.1);
}

async function sendTradingSignal() {
  if (!isRunning) return;
  
  const signal = generateSignal();
  const session = getTradingSession();
  const zambiaTime = getZambiaTime();
  const positionSize = calculatePositionSize(1000, 1, 30);
  const emoji = signal.action === 'BUY' ? '🟢📈' : '🔴📉';
  const directionEmoji = signal.action === 'BUY' ? '📈' : '📉';
  
  const message = `${emoji} *${signal.action} SIGNAL* ${directionEmoji}\n\n` +
    `*Symbol:* ${signal.symbol}\n` +
    `*Action:* ${signal.action}\n` +
    `*Entry:* ${signal.price.toFixed(5)}\n` +
    `*Stop Loss:* ${signal.stopLoss.toFixed(5)}\n` +
    `*Take Profit:* ${signal.takeProfit.toFixed(5)}\n` +
    `*Confidence:* ${signal.confidence}%\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *POSITION SIZE*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Risk: 1% = $10\n` +
    `👉 *Recommended: ${positionSize.toFixed(3)} lots*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *PRE-TRADE CHECKLIST*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `[ ] ${session.emoji} ${session.message}\n` +
    `[ ] Position size: ${positionSize.toFixed(3)} lots\n` +
    `[ ] Stop Loss at ${signal.stopLoss.toFixed(5)}\n` +
    `[ ] Take Profit at ${signal.takeProfit.toFixed(5)}\n\n` +
    `⏰ Zambia time: ${zambiaTime}\n` +
    `🤖 ForexPulse PRO`;
  
  const result = await sendTelegramMessage(message);
  if (result?.ok) {
    console.log(`✅ Signal sent: ${signal.action} ${signal.symbol} at ${zambiaTime}`);
  } else {
    console.error('❌ Failed to send signal');
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Bot starting...');
    
    await sendTelegramMessage('🤖 *ForexPulse PRO Activated*\n\n' +
      '✅ Bot is now ONLINE\n' +
      '✅ Trading signals will be sent every 60 seconds\n' +
      `✅ Current session: ${getTradingSession().message}\n\n` +
      '📱 Keep this chat open to receive signals!');
    
    // Send first signal immediately
    await sendTradingSignal();
    
    // Then every 60 seconds
    intervalId = setInterval(sendTradingSignal, 60000);
    
    return NextResponse.json({ success: true, message: 'Bot started' });
  }
  
  if (action === 'stop' && isRunning) {
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    await sendTelegramMessage('⏸️ *Bot Stopped*\n\nNo more signals will be sent. Click Start to resume.');
    return NextResponse.json({ success: true, message: 'Bot stopped' });
  }
  
  if (action === 'test') {
    const result = await sendTelegramMessage('🔔 *Test Signal*\n\n✅ If you see this, your Telegram bot is working correctly!\n✅ Your bot is ready to send trading signals.');
    if (result?.ok) {
      return NextResponse.json({ success: true, message: 'Test sent successfully' });
    } else {
      return NextResponse.json({ success: false, message: 'Test failed - check token' });
    }
  }
  
  if (action === 'status') {
    return NextResponse.json({ 
      running: isRunning,
      message: isRunning ? 'Bot is active' : 'Bot is stopped'
    });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot is running' : 'Bot is stopped',
    telegramConfigured: true
  });
}
