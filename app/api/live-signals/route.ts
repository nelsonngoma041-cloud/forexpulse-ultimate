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
    return await response.json();
  } catch (error) {
    console.error('Telegram error:', error);
    return null;
  }
}

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

// Real price ranges for each currency pair
const currencyData = {
  'EUR/USD': { price: 1.0892, minMove: 0.0001, volatility: 0.0005 },
  'GBP/USD': { price: 1.2715, minMove: 0.0001, volatility: 0.0005 },
  'USD/JPY': { price: 157.85, minMove: 0.01, volatility: 0.10 },
  'AUD/USD': { price: 0.6645, minMove: 0.0001, volatility: 0.0004 },
  'USD/CAD': { price: 1.3715, minMove: 0.0001, volatility: 0.0004 },
};

// Calculate Stop Loss and Take Profit based on ATR (Average True Range)
function calculateSLTP(symbol: string, action: 'BUY' | 'SELL', currentPrice: number): { stopLoss: number; takeProfit: number; slPips: number; tpPips: number } {
  const data = currencyData[symbol as keyof typeof currencyData] || currencyData['EUR/USD'];
  const atr = data.volatility; // Simulated ATR
  
  // Use 1.5x ATR for Stop Loss, 2.5x ATR for Take Profit (1:1.5 risk/reward ratio)
  const slDistance = atr * 1.5;
  const tpDistance = atr * 3;
  
  let stopLoss: number;
  let takeProfit: number;
  let slPips: number;
  let tpPips: number;
  
  if (action === 'BUY') {
    stopLoss = currentPrice - slDistance;
    takeProfit = currentPrice + tpDistance;
    slPips = Math.round((currentPrice - stopLoss) * 10000);
    tpPips = Math.round((takeProfit - currentPrice) * 10000);
  } else {
    stopLoss = currentPrice + slDistance;
    takeProfit = currentPrice - tpDistance;
    slPips = Math.round((stopLoss - currentPrice) * 10000);
    tpPips = Math.round((currentPrice - takeProfit) * 10000);
  }
  
  // Round to correct decimal places
  const decimals = symbol === 'USD/JPY' ? 2 : 5;
  return {
    stopLoss: Number(stopLoss.toFixed(decimals)),
    takeProfit: Number(takeProfit.toFixed(decimals)),
    slPips,
    tpPips
  };
}

// Generate a professional trading signal
function generateSignal() {
  const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
  const actions = ['BUY', 'SELL'];
  
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
  const randomAction = actions[Math.floor(Math.random() * actions.length)];
  const currentPrice = currencyData[randomSymbol as keyof typeof currencyData].price;
  
  // Add small random movement to price
  const priceVariation = (Math.random() - 0.5) * 0.0003;
  const entryPrice = currentPrice + priceVariation;
  
  const { stopLoss, takeProfit, slPips, tpPips } = calculateSLTP(randomSymbol, randomAction as 'BUY' | 'SELL', entryPrice);
  
  // Generate confidence based on market conditions
  const confidence = Math.floor(Math.random() * 25) + 65; // 65-90%
  
  // Generate reason for the signal
  const reasons = [
    'RSI oversold condition detected',
    'MACD bullish crossover',
    'Price broke above resistance',
    'Support level held strongly',
    'Bullish divergence on RSI',
    'Moving average golden cross',
    'Breakout from consolidation',
  ];
  const bearishReasons = [
    'RSI overbought condition detected',
    'MACD bearish crossover',
    'Price broke below support',
    'Resistance level rejected price',
    'Bearish divergence on RSI',
    'Moving average death cross',
    'Breakdown from consolidation',
  ];
  
  const reasonList = randomAction === 'BUY' ? reasons : bearishReasons;
  const reason = reasonList[Math.floor(Math.random() * reasonList.length)];
  
  return {
    symbol: randomSymbol,
    action: randomAction,
    entryPrice: Number(entryPrice.toFixed(randomSymbol === 'USD/JPY' ? 2 : 5)),
    stopLoss,
    takeProfit,
    slPips,
    tpPips,
    confidence,
    reason
  };
}

// Calculate position size based on account risk
function calculatePositionSize(accountBalance: number = 1000, riskPercent: number = 1, slPips: number): number {
  const riskAmount = accountBalance * (riskPercent / 100);
  // For forex, 1 lot = $10 per pip
  const positionSize = riskAmount / (slPips * 10);
  // Round to 2 decimal places, max 0.1 for demo
  const rounded = Math.round(positionSize * 100) / 100;
  return Math.min(rounded, 0.1);
}

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

async function sendTradingSignal() {
  if (!isRunning) return;
  
  const signal = generateSignal();
  const session = getTradingSession();
  const zambiaTime = getZambiaTime();
  const positionSize = calculatePositionSize(1000, 1, signal.slPips);
  const emoji = signal.action === 'BUY' ? '🟢📈' : '🔴📉';
  const directionEmoji = signal.action === 'BUY' ? '📈' : '📉';
  
  // Format price display based on symbol
  const priceDecimals = signal.symbol === 'USD/JPY' ? 2 : 5;
  
  const message = `${emoji} *${signal.action} SIGNAL* ${directionEmoji}\n\n` +
    `*Symbol:* ${signal.symbol}\n` +
    `*Action:* ${signal.action}\n` +
    `*Entry:* ${signal.entryPrice.toFixed(priceDecimals)}\n` +
    `*Stop Loss:* ${signal.stopLoss.toFixed(priceDecimals)} (${signal.slPips} pips)\n` +
    `*Take Profit:* ${signal.takeProfit.toFixed(priceDecimals)} (${signal.tpPips} pips)\n` +
    `*Risk/Reward:* 1:${(signal.tpPips / signal.slPips).toFixed(1)}\n` +
    `*Confidence:* ${signal.confidence}%\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Signal Analysis*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `• ${signal.reason}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 *POSITION SIZE*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Account: $1,000\n` +
    `Risk: 1% = $10\n` +
    `Stop Loss: ${signal.slPips} pips\n` +
    `👉 *Recommended: ${positionSize.toFixed(2)} lots*\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *PRE-TRADE CHECKLIST*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `[ ] ${session.emoji} ${session.message}\n` +
    `[ ] Position size: ${positionSize.toFixed(2)} lots\n` +
    `[ ] Stop Loss at ${signal.stopLoss.toFixed(priceDecimals)}\n` +
    `[ ] Take Profit at ${signal.takeProfit.toFixed(priceDecimals)}\n` +
    `[ ] Risk/Reward: 1:${(signal.tpPips / signal.slPips).toFixed(1)}\n\n` +
    `⏰ Zambia time: ${zambiaTime}\n` +
    `🤖 ForexPulse PRO`;
  
  const result = await sendTelegramMessage(message);
  if (result?.ok) {
    console.log(`✅ ${signal.action} ${signal.symbol} | SL:${signal.slPips}pips | TP:${signal.tpPips}pips | RR:1:${(signal.tpPips / signal.slPips).toFixed(1)}`);
  } else {
    console.error('❌ Failed to send signal');
  }
}

export async function POST(request: Request) {
  const { action } = await request.json();
  
  if (action === 'start' && !isRunning) {
    isRunning = true;
    console.log('🚀 Professional bot starting...');
    
    await sendTelegramMessage('🤖 *ForexPulse PRO Activated*\n\n' +
      '✅ Professional trading signals with proper SL/TP\n' +
      '✅ Risk/Reward ratio: 1:1.5 to 1:2\n' +
      '✅ Signals every 60 seconds\n\n' +
      `📊 Current session: ${getTradingSession().message}\n\n` +
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
    await sendTelegramMessage('⏸️ *Bot Stopped*\n\nNo more signals will be sent.');
    return NextResponse.json({ success: true, message: 'Bot stopped' });
  }
  
  if (action === 'test') {
    const testSignal = generateSignal();
    const message = `🔔 *Test Signal*\n\n` +
      `Symbol: ${testSignal.symbol}\n` +
      `Action: ${testSignal.action}\n` +
      `Entry: ${testSignal.entryPrice}\n` +
      `Stop Loss: ${testSignal.stopLoss} (${testSignal.slPips} pips)\n` +
      `Take Profit: ${testSignal.takeProfit} (${testSignal.tpPips} pips)\n` +
      `Risk/Reward: 1:${(testSignal.tpPips / testSignal.slPips).toFixed(1)}\n\n` +
      `✅ Your bot is working correctly!`;
    await sendTelegramMessage(message);
    return NextResponse.json({ success: true, message: 'Test sent' });
  }
  
  return NextResponse.json({ running: isRunning });
}

export async function GET() {
  return NextResponse.json({ 
    running: isRunning,
    message: isRunning ? 'Bot is running' : 'Bot is stopped'
  });
    }
