// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';
import { tradingEngine, getPipMultiplier, getDecimals } from '@/app/lib/trading-engine';

// ─── Config ────────────────────────────────────────────────────────────────────
// Env vars are read inside request handlers — NOT at module load time.
// Reading them at the top level causes Vercel build failures because Next.js
// evaluates route modules during `next build` before env vars are injected.

function getEnvVars(): { token: string; chatId: string } {
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error(
      'TELEGRAM_TOKEN and TELEGRAM_CHAT_ID must be set in Vercel → Settings → Environment Variables'
    );
  }
  return { token, chatId };
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type CurrencyPair = 'EURUSD' | 'GBPUSD' | 'USDJPY' | 'AUDUSD' | 'USDCAD';
type BotAction = 'start' | 'stop' | 'test';

// ─── Currency Data ─────────────────────────────────────────────────────────────

const CURRENCY_PRICES: Record<CurrencyPair, number> = {
  EURUSD: 1.08920,
  GBPUSD: 1.27150,
  USDJPY: 157.85,
  AUDUSD: 0.66450,
  USDCAD: 1.37150,
};

const PAIRS = Object.keys(CURRENCY_PRICES) as CurrencyPair[];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Escape all MarkdownV2 special characters */
function md(value: string | number): string {
  return String(value).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function getZambiaTime(): string {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lusaka',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getSessionInfo(): { emoji: string; message: string } {
  const hour = parseInt(
    new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false }),
    10
  );
  if (hour >= 15 && hour < 19) return { emoji: '🔥', message: 'Prime window — HIGH liquidity' };
  if (hour >= 10 && hour < 15) return { emoji: '✅', message: 'Good liquidity — recommended' };
  if (hour >= 19 && hour < 22) return { emoji: '⚠️', message: 'Low liquidity — trade carefully' };
  return { emoji: '😴', message: 'Avoid trading — very low volume' };
}

/** Fixed-fractional position sizing. 1 std lot = $10/pip on most pairs. */
function positionSize(balance: number, riskPct: number, slPips: number): number {
  if (slPips <= 0) return 0.01;
  const riskAmount = balance * (riskPct / 100);
  return Math.min(Math.round((riskAmount / (slPips * 10)) * 100) / 100, 0.10);
}

// ─── Price simulation (seed engine with realistic price walk) ─────────────────

function seedPrice(pair: CurrencyPair): number {
  const base = CURRENCY_PRICES[pair];
  const noise = (Math.random() - 0.5) * 0.002;
  return Number((base + noise).toFixed(getDecimals(pair)));
}

function buildPriceHistory(pair: CurrencyPair, bars = 60): void {
  const base = CURRENCY_PRICES[pair];
  const pipSize = pair === 'USDJPY' ? 0.01 : 0.0001;
  let price = base;
  for (let i = 0; i < bars; i++) {
    price += (Math.random() - 0.5) * pipSize * 8; // ±4 pip walk per bar
    tradingEngine.addPrice(pair, Number(price.toFixed(getDecimals(pair))));
  }
}

// Pre-seed all pairs so the engine has data immediately
PAIRS.forEach(p => buildPriceHistory(p));

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegram(text: string): Promise<boolean> {
  const { token, chatId } = getEnvVars();
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
  });
  if (!res.ok) {
    console.error('Telegram error:', res.status, await res.text());
    return false;
  }
  return (await res.json()).ok === true;
}

// ─── Signal formatting ────────────────────────────────────────────────────────

function buildSignalMessage(pair: CurrencyPair): string {
  // Add a fresh price tick before analyzing
  const currentPrice = seedPrice(pair);
  tradingEngine.addPrice(pair, currentPrice);

  const signal = tradingEngine.analyze(pair, currentPrice);
  const decimals = getDecimals(pair);
  const pipMult  = getPipMultiplier(pair);
  const session  = getSessionInfo();

  const slPips = Math.round(Math.abs(signal.entryPrice - signal.stopLoss) * pipMult);
  const tpPips = Math.round(Math.abs(signal.entryPrice - signal.takeProfit) * pipMult);
  const rr     = slPips > 0 ? (tpPips / slPips).toFixed(1) : '—';
  const lots   = positionSize(1000, 1, slPips);

  const actionEmoji = signal.action === 'BUY' ? '🟢📈' : signal.action === 'SELL' ? '🔴📉' : '⏸️';
  const confidencePct = signal.action === 'HOLD' ? '—' : `${signal.confidence}%`;

  const lines = [
    `${actionEmoji} *${md(signal.action)} — ${md(pair)}*`,
    '',
    `Entry:        \`${md(signal.entryPrice.toFixed(decimals))}\``,
    `Stop Loss:    \`${md(signal.stopLoss.toFixed(decimals))}\` \\(${md(slPips)} pips\\)`,
    `Take Profit:  \`${md(signal.takeProfit.toFixed(decimals))}\` \\(${md(tpPips)} pips\\)`,
    `Risk/Reward:  1:${md(rr)}`,
    `Confidence:   ${md(confidencePct)}`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `📊 *Analysis*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `• RSI: ${md(signal.indicators.rsi.toFixed(1))}`,
    `• MACD histogram: ${md(signal.indicators.macdHistogram.toFixed(5))}`,
    `• Price vs MA20: ${md(signal.indicators.price_vs_ma20)}`,
    `• MA trend: ${md(signal.indicators.ma_trend)}`,
    `• ${md(signal.reason)}`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `💰 *Position Size*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `Balance \\$1,000 · Risk 1% \\= \\$10`,
    `👉 *${md(lots.toFixed(2))} lots recommended*`,
    '',
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `✅ *Pre\\-Trade Checklist*`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    `${session.emoji} ${md(session.message)}`,
    `☐ Size: ${md(lots.toFixed(2))} lots`,
    `☐ SL at ${md(signal.stopLoss.toFixed(decimals))}`,
    `☐ TP at ${md(signal.takeProfit.toFixed(decimals))}`,
    `☐ R/R: 1:${md(rr)}`,
    '',
    `⏰ ${md(getZambiaTime())} Zambia time`,
    `🤖 ForexPulse PRO`,
  ];

  return lines.join('\n');
}

// ─── Bot State ────────────────────────────────────────────────────────────────
// ⚠️  Module-level state works on long-running Node.js servers but will reset
//     on every cold start in serverless environments (Vercel functions).
//     For persistent scheduling, use a cron job + Upstash Redis.

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;
let signalCount = 0;

async function dispatchSignal(): Promise<void> {
  if (!isRunning) return;
  const pair = pickRandom(PAIRS);
  const ok = await sendTelegram(buildSignalMessage(pair));
  if (ok) {
    signalCount++;
    console.log(`✅ Signal #${signalCount} sent for ${pair}`);
  } else {
    console.error('❌ Signal failed');
  }
}

function startBot(): void {
  isRunning = true;
  signalCount = 0;
  dispatchSignal(); // immediate first signal
  intervalId = setInterval(dispatchSignal, 60_000);
}

function stopBot(): void {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    running: isRunning,
    signalCount,
    message: isRunning ? `Bot running — ${signalCount} signals sent` : 'Bot stopped',
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
      if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
      const session = getSessionInfo();
      await sendTelegram(
        `🤖 *ForexPulse PRO Activated*\n\n` +
        `✅ Real indicator analysis \\(RSI \\+ MACD \\+ MA\\)\n` +
        `✅ Per\\-pair ATR stop loss and take profit\n` +
        `✅ Signals every 60 seconds\n\n` +
        `${session.emoji} ${md(session.message)}\n\n` +
        `📱 Keep this chat open\\!`
      );
      startBot();
      return NextResponse.json({ success: true, message: 'Bot started' });
    }

    case 'stop': {
      if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
      stopBot();
      await sendTelegram(`⏸️ *Bot Stopped*\n\n${md(signalCount)} signals were sent this session\\.`);
      return NextResponse.json({ success: true, message: 'Bot stopped' });
    }

    case 'test': {
      const pair = pickRandom(PAIRS);
      const ok = await sendTelegram(buildSignalMessage(pair));
      return NextResponse.json({ success: ok, message: ok ? `Test signal sent for ${pair}` : 'Telegram send failed — check env vars' });
    }

    default:
      return NextResponse.json({ error: `Unknown action: "${action}"` }, { status: 400 });
  }
}
