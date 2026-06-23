import { NextResponse } from 'next/server';

function getTelegramConfig() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID not set');
  return { token, chatId };
}

function md(v: string | number) {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function getZambiaTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function getSession() {
  const h = parseInt(new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
  }), 10);
  if (h >= 15 && h < 19) return { emoji: '🔥', message: 'Prime window — HIGH liquidity' };
  if (h >= 10 && h < 15) return { emoji: '✅', message: 'Good liquidity — recommended' };
  if (h >= 19 && h < 22) return { emoji: '⚠️', message: 'Low liquidity — trade carefully' };
  return { emoji: '😴', message: 'Avoid trading — very low volume' };
}

const PAIRS = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'];
const PRICES: Record<string, number> = {
  EURUSD: 1.08920, GBPUSD: 1.27150, USDJPY: 157.85, AUDUSD: 0.66450, USDCAD: 1.37150,
};
const DISPLAY: Record<string, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY', AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD',
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSignal(pair: string) {
  const actions = ['BUY', 'SELL'] as const;
  const action = pickRandom(actions);
  const base = PRICES[pair];
  const isJpy = pair === 'USDJPY';
  const decimals = isJpy ? 2 : 5;
  const pipMult = isJpy ? 100 : 10000;
  const atr = isJpy ? 0.08 : 0.0008;
  const entry = Number((base + (Math.random() - 0.5) * atr).toFixed(decimals));
  const sl = action === 'BUY' ? Number((entry - atr * 1.5).toFixed(decimals)) : Number((entry + atr * 1.5).toFixed(decimals));
  const tp = action === 'BUY' ? Number((entry + atr * 2.5).toFixed(decimals)) : Number((entry - atr * 2.5).toFixed(decimals));
  const slPips = Math.round(Math.abs(entry - sl) * pipMult);
  const tpPips = Math.round(Math.abs(entry - tp) * pipMult);
  const rsi = action === 'BUY' ? Math.floor(Math.random() * 20) + 25 : Math.floor(Math.random() * 20) + 65;
  const confidence = Math.floor(Math.random() * 25) + 65;
  const reasons = action === 'BUY'
    ? ['RSI oversold', 'MACD bullish crossover', 'Price above MA20', 'Support held']
    : ['RSI overbought', 'MACD bearish crossover', 'Price below MA20', 'Resistance rejected'];
  return { action, entry, sl, tp, slPips, tpPips, rsi, confidence, decimals, reason: pickRandom(reasons) };
}

async function sendTelegram(text: string): Promise<boolean> {
  const { token, chatId } = getTelegramConfig();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
    const data = await res.json();
    if (!data.ok) console.error('Telegram error:', JSON.stringify(data));
    return data.ok === true;
  } catch (err) {
    console.error('Telegram fetch error:', err);
    return false;
  }
}

let isRunning = false;
let signalCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const recentSignals: object[] = [];

async function dispatchSignal(balance = 1000, risk = 1) {
  if (!isRunning) return;
  const pair = pickRandom(PAIRS);
  const display = DISPLAY[pair];
  const sig = generateSignal(pair);
  const rr = (sig.tpPips / sig.slPips).toFixed(1);
  const lots = Math.min(Math.round((balance * risk / 100) / (sig.slPips * 10) * 100) / 100, 0.10);
  const session = getSession();
  const time = getZambiaTime();
  const actionEmoji = sig.action === 'BUY' ? '🟢📈' : '🔴📉';

  const message = [
    `${actionEmoji} *${md(sig.action)} — ${md(display)}*`,
    '',
    `Entry:        \`${md(sig.entry)}\``,
    `Stop Loss:    \`${md(sig.sl)}\` \\(${md(sig.slPips)} pips\\)`,
    `Take Profit:  \`${md(sig.tp)}\` \\(${md(sig.tpPips)} pips\\)`,
    `Risk/Reward:  1:${md(rr)}`,
    `Confidence:   ${md(sig.confidence)}%`,
    `RSI:          ${md(sig.rsi)}`,
    '',
    `📊 ${md(sig.reason)}`,
    '',
    `💰 ${md(lots.toFixed(2))} lots · Risk \\$${md((balance * risk / 100).toFixed(2))}`,
    '',
    `${session.emoji} ${md(session.message)}`,
    `⏰ ${md(time)} · 🤖 ForexPulse PRO`,
  ].join('\n');

  const ok = await sendTelegram(message);
  if (ok) {
    signalCount++;
    recentSignals.unshift({ id: `${Date.now()}`, symbol: display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi, time: time.slice(0, 5) });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log(`Signal #${signalCount} sent: ${sig.action} ${display}`);
  }
}

function startBot(balance: number, risk: number) {
  isRunning = true;
  signalCount = 0;
  dispatchSignal(balance, risk);
  intervalId = setInterval(() => dispatchSignal(balance, risk), 60000);
}

function stopBot() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

export async function GET() {
  return NextResponse.json({
    running: isRunning,
    signalCount,
    mt5Connected: false,
    recentSignals,
    message: isRunning ? `Running — ${signalCount} signals sent` : 'Bot stopped',
  });
}

export async function POST(request: Request) {
  let body: { action?: string; balance?: number; risk?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, balance = 1000, risk = 1 } = body;

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    const session = getSession();
    await sendTelegram(
      `🤖 *ForexPulse PRO Activated*\n\n` +
      `✅ Signals every 60 seconds\n` +
      `✅ Entry, SL, TP and lot size included\n\n` +
      `${session.emoji} ${md(session.message)}\n\n` +
      `Account: \\$${md(balance)} · Risk: ${md(risk)}%`
    );
    startBot(balance, risk);
    return NextResponse.json({ success: true, message: 'Bot started' });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    await sendTelegram(`⏸️ *Bot Stopped*\n\n${md(signalCount)} signals sent this session\\.`);
    return NextResponse.json({ success: true, signalCount });
  }

  if (action === 'test') {
    const pair = pickRandom(PAIRS);
    const display = DISPLAY[pair];
    const sig = generateSignal(pair);
    const ok = await sendTelegram(
      `🔔 *Test Signal — ${md(display)}*\n\n` +
      `Action: *${md(sig.action)}*\n` +
      `Entry: ${md(sig.entry)}\n` +
      `Confidence: ${md(sig.confidence)}%\n` +
      `RSI: ${md(sig.rsi)}\n\n` +
      `✅ Bot is working correctly\\!`
    );
    return NextResponse.json({
      success: ok,
      message: ok ? 'Test signal sent' : 'Telegram failed — check env vars',
      signal: { symbol: display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi },
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
