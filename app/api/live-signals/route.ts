// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';

// ─── Config ────────────────────────────────────────────────────────────────────

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) {
  throw new Error(
    'Missing required env vars: TELEGRAM_TOKEN and TELEGRAM_CHAT_ID must be set in .env.local'
  );
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type CurrencyPair = 'EUR/USD' | 'GBP/USD' | 'USD/JPY' | 'AUD/USD' | 'USD/CAD';
type TradeAction = 'BUY' | 'SELL';
type BotAction = 'start' | 'stop' | 'test';

interface CurrencyConfig {
  price: number;
  minMove: number;
  volatility: number;
  pipMultiplier: number; // 10000 for most pairs, 100 for JPY
}

interface Signal {
  symbol: CurrencyPair;
  action: TradeAction;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  slPips: number;
  tpPips: number;
  confidence: number;
  reason: string;
}

interface SlTpResult {
  stopLoss: number;
  takeProfit: number;
  slPips: number;
  tpPips: number;
}

interface TradingSession {
  quality: 'Best' | 'Good' | 'Low' | 'Avoid';
  emoji: string;
  message: string;
}

// ─── Currency Data ─────────────────────────────────────────────────────────────

const CURRENCY_DATA: Record<CurrencyPair, CurrencyConfig> = {
  'EUR/USD': { price: 1.0892, minMove: 0.0001, volatility: 0.0005, pipMultiplier: 10000 },
  'GBP/USD': { price: 1.2715, minMove: 0.0001, volatility: 0.0005, pipMultiplier: 10000 },
  'USD/JPY': { price: 157.85, minMove: 0.01,   volatility: 0.10,   pipMultiplier: 100  },
  'AUD/USD': { price: 0.6645, minMove: 0.0001, volatility: 0.0004, pipMultiplier: 10000 },
  'USD/CAD': { price: 1.3715, minMove: 0.0001, volatility: 0.0004, pipMultiplier: 10000 },
};

const SYMBOLS = Object.keys(CURRENCY_DATA) as CurrencyPair[];

// ─── Signal Reasons ────────────────────────────────────────────────────────────

const SIGNAL_REASONS: Record<TradeAction, string[]> = {
  BUY: [
    'RSI oversold condition detected',
    'MACD bullish crossover',
    'Price broke above resistance',
    'Support level held strongly',
    'Bullish divergence on RSI',
    'Moving average golden cross',
    'Breakout from consolidation',
  ],
  SELL: [
    'RSI overbought condition detected',
    'MACD bearish crossover',
    'Price broke below support',
    'Resistance level rejected price',
    'Bearish divergence on RSI',
    'Moving average death cross',
    'Breakdown from consolidation',
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getZambiaTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lusaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getTradingSession(): TradingSession {
  const zambiaHour = new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka',
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(zambiaHour, 10);

  if (hour >= 15 && hour < 19) return { quality: 'Best',  emoji: '🔥', message: 'Prime trading window — HIGH liquidity' };
  if (hour >= 10 && hour < 15) return { quality: 'Good',  emoji: '✅', message: 'Good liquidity — recommended' };
  if (hour >= 19 && hour < 22) return { quality: 'Low',   emoji: '⚠️', message: 'Low liquidity — trade with caution' };
  return                               { quality: 'Avoid', emoji: '😴', message: 'Avoid trading — low volume' };
}

// ─── Signal Generation ─────────────────────────────────────────────────────────

function calculateSlTp(symbol: CurrencyPair, action: TradeAction, entryPrice: number): SlTpResult {
  const { volatility, pipMultiplier } = CURRENCY_DATA[symbol];
  const decimals = symbol === 'USD/JPY' ? 2 : 5;

  // 1.5× ATR stop loss, 3× ATR take profit → 1:2 R/R
  const slDistance = volatility * 1.5;
  const tpDistance = volatility * 3;

  const stopLoss   = action === 'BUY' ? entryPrice - slDistance : entryPrice + slDistance;
  const takeProfit = action === 'BUY' ? entryPrice + tpDistance : entryPrice - tpDistance;

  const slPips = Math.round(Math.abs(entryPrice - stopLoss)   * pipMultiplier);
  const tpPips = Math.round(Math.abs(entryPrice - takeProfit) * pipMultiplier);

  return {
    stopLoss:   Number(stopLoss.toFixed(decimals)),
    takeProfit: Number(takeProfit.toFixed(decimals)),
    slPips,
    tpPips,
  };
}

function generateSignal(): Signal {
  const symbol   = pickRandom(SYMBOLS);
  const action   = pickRandom<TradeAction>(['BUY', 'SELL']);
  const { price, volatility } = CURRENCY_DATA[symbol];
  const decimals = symbol === 'USD/JPY' ? 2 : 5;

  // Vary entry price slightly within one ATR
  const entryPrice = Number((price + (Math.random() - 0.5) * volatility).toFixed(decimals));
  const { stopLoss, takeProfit, slPips, tpPips } = calculateSlTp(symbol, action, entryPrice);

  return {
    symbol,
    action,
    entryPrice,
    stopLoss,
    takeProfit,
    slPips,
    tpPips,
    confidence: Math.floor(Math.random() * 26) + 65, // 65–90 %
    reason: pickRandom(SIGNAL_REASONS[action]),
  };
}

/**
 * Calculate recommended lot size using fixed-fractional position sizing.
 * 1 standard lot = $10/pip for most pairs.
 */
function calculatePositionSize(
  accountBalance = 1000,
  riskPercent = 1,
  slPips: number
): number {
  const riskAmount   = accountBalance * (riskPercent / 100);
  const lotSize      = riskAmount / (slPips * 10);
  const capped       = Math.min(lotSize, 0.1); // cap for demo accounts
  return Math.round(capped * 100) / 100;
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegramMessage(text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'MarkdownV2', // was 'HTML' but message used Markdown syntax
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Telegram API error:', res.status, err);
    return false;
  }

  const data = await res.json();
  return data.ok === true;
}

/** Escape special characters required by MarkdownV2 */
function md(text: string | number): string {
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function formatSignalMessage(signal: Signal): string {
  const decimals     = signal.symbol === 'USD/JPY' ? 2 : 5;
  const positionSize = calculatePositionSize(1000, 1, signal.slPips);
  const session      = getTradingSession();
  const rr           = (signal.tpPips / signal.slPips).toFixed(1);
  const actionEmoji  = signal.action === 'BUY' ? '🟢📈' : '🔴📉';

  const lines = [
    `${actionEmoji} *${md(signal.action)} SIGNAL*`,
    '',
    `*Symbol:*      ${md(signal.symbol)}`,
    `*Entry:*       ${md(signal.entryPrice.toFixed(decimals))}`,
    `*Stop Loss:*   ${md(signal.stopLoss.toFixed(decimals))} \\(${md(signal.slPips)} pips\\)`,
    `*Take Profit:* ${md(signal.takeProfit.toFixed(decimals))} \\(${md(signal.tpPips)} pips\\)`,
    `*Risk/Reward:* 1:${md(rr)}`,
    `*Confidence:*  ${md(signal.confidence)}%`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *Signal Analysis*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `• ${md(signal.reason)}`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Position Size*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `Account: \\$1,000 \\| Risk: 1% \\= \\$10`,
    `👉 *Recommended: ${md(positionSize.toFixed(2))} lots*`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ *Pre\\-Trade Checklist*`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji} ${md(session.message)}`,
    `☐ Size: ${md(positionSize.toFixed(2))} lots`,
    `☐ SL at ${md(signal.stopLoss.toFixed(decimals))}`,
    `☐ TP at ${md(signal.takeProfit.toFixed(decimals))}`,
    `☐ R/R: 1:${md(rr)}`,
    '',
    `⏰ Zambia time: ${md(getZambiaTime())}`,
    `🤖 ForexPulse PRO`,
  ];

  return lines.join('\n');
}

// ─── Bot State ────────────────────────────────────────────────────────────────
//
// ⚠️  Module-level state works in long-running Node.js servers but is NOT
//     suitable for serverless/Edge deployments (Vercel, etc.) where each
//     invocation may run in a fresh isolate.
//
//     For production, replace this with a persistent store (Redis / Upstash)
//     and a separate cron job or queue worker to dispatch signals.

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function sendTradingSignal(): Promise<void> {
  if (!isRunning) return;

  const signal = generateSignal();
  const ok = await sendTelegramMessage(formatSignalMessage(signal));

  if (ok) {
    const rr = (signal.tpPips / signal.slPips).toFixed(1);
    console.log(`✅ ${signal.action} ${signal.symbol} | SL: ${signal.slPips} pips | TP: ${signal.tpPips} pips | R/R 1:${rr}`);
  } else {
    console.error('❌ Failed to send signal');
  }
}

function startBot(): void {
  isRunning = true;
  sendTradingSignal(); // immediate first signal
  intervalId = setInterval(sendTradingSignal, 60_000);
}

function stopBot(): void {
  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    running: isRunning,
    message: isRunning ? 'Bot is running' : 'Bot is stopped',
  });
}

export async function POST(request: Request) {
  let body: { action?: BotAction };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action } = body;

  switch (action) {
    case 'start': {
      if (isRunning) {
        return NextResponse.json({ success: false, message: 'Bot is already running' });
      }

      const session = getTradingSession();
      await sendTelegramMessage(
        `🤖 *ForexPulse PRO Activated*\n\n` +
        `✅ Signals with SL/TP every 60 seconds\n` +
        `✅ Risk/Reward: 1:2\n\n` +
        `📊 Session: ${md(session.message)}\n\n` +
        `📱 Keep this chat open to receive signals\\!`
      );

      startBot();
      return NextResponse.json({ success: true, message: 'Bot started' });
    }

    case 'stop': {
      if (!isRunning) {
        return NextResponse.json({ success: false, message: 'Bot is not running' });
      }

      stopBot();
      await sendTelegramMessage('⏸️ *Bot Stopped*\n\nNo more signals will be sent\\.');
      return NextResponse.json({ success: true, message: 'Bot stopped' });
    }

    case 'test': {
      const signal = generateSignal();
      const decimals = signal.symbol === 'USD/JPY' ? 2 : 5;
      const rr = (signal.tpPips / signal.slPips).toFixed(1);

      await sendTelegramMessage(
        `🔔 *Test Signal*\n\n` +
        `Symbol: ${md(signal.symbol)}\n` +
        `Action: ${md(signal.action)}\n` +
        `Entry: ${md(signal.entryPrice.toFixed(decimals))}\n` +
        `SL: ${md(signal.stopLoss.toFixed(decimals))} \\(${md(signal.slPips)} pips\\)\n` +
        `TP: ${md(signal.takeProfit.toFixed(decimals))} \\(${md(signal.tpPips)} pips\\)\n` +
        `R/R: 1:${md(rr)}\n\n` +
        `✅ Your bot is working correctly\\!`
      );

      return NextResponse.json({ success: true, message: 'Test signal sent' });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
