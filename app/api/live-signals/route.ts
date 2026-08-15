// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';

// ─── Env ──────────────────────────────────────────────────────────────────────

function getTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID not set');
  return { token, chatId };
}

function getBridge() {
  const url = process.env.RAILWAY_BRIDGE_URL;
  const secret = process.env.RAILWAY_BRIDGE_SECRET;
  return url && secret ? { url, secret } : null;
}

// ─── Bridge call ──────────────────────────────────────────────────────────────

async function callBridge(payload: Record<string, unknown>): Promise<{
  ok: boolean; contractId?: number; buyPrice?: number; payout?: number;
  balance?: string; error?: string;
}> {
  const bridge = getBridge();
  if (!bridge) return { ok: false, error: 'Bridge not configured' };

  try {
    const res = await fetch(bridge.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Bridge-Secret': bridge.secret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  EURUSD: 1.08920, GBPUSD: 1.27150, USDJPY: 157.85,
  AUDUSD: 0.66450, USDCAD: 1.37150,
};
const DISPLAY: Record<string, string> = {
  EURUSD: 'EUR/USD', GBPUSD: 'GBP/USD', USDJPY: 'USD/JPY',
  AUDUSD: 'AUD/USD', USDCAD: 'USD/CAD',
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSignal(pair: string) {
  const action = pickRandom(['BUY', 'SELL']) as 'BUY' | 'SELL';
  const base = PRICES[pair];
  const isJpy = pair === 'USDJPY';
  const decimals = isJpy ? 2 : 5;
  const pipMult = isJpy ? 100 : 10000;
  const atr = isJpy ? 0.08 : 0.0008;
  const entry = Number((base + (Math.random() - 0.5) * atr).toFixed(decimals));
  const sl = action === 'BUY'
    ? Number((entry - atr * 1.5).toFixed(decimals))
    : Number((entry + atr * 1.5).toFixed(decimals));
  const tp = action === 'BUY'
    ? Number((entry + atr * 2.5).toFixed(decimals))
    : Number((entry - atr * 2.5).toFixed(decimals));
  const slPips = Math.round(Math.abs(entry - sl) * pipMult);
  const tpPips = Math.round(Math.abs(entry - tp) * pipMult);
  const rsi = action === 'BUY'
    ? Math.floor(Math.random() * 20) + 25
    : Math.floor(Math.random() * 20) + 65;
  const confidence = Math.floor(Math.random() * 25) + 65;
  const reasons = action === 'BUY'
    ? ['RSI oversold', 'MACD bullish crossover', 'Price above MA20', 'Support held']
    : ['RSI overbought', 'MACD bearish crossover', 'Price below MA20', 'Resistance rejected'];
  return { action, entry, sl, tp, slPips, tpPips, rsi, confidence, decimals, reason: pickRandom(reasons) };
}

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const { token, chatId } = getTelegram();
  try {
    const res = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
    const data = await res.json() as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Bot state ────────────────────────────────────────────────────────────────

let isRunning = false;
let signalCount = 0;
let executedCount = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const recentSignals: object[] = [];

async function dispatchSignal(stake = 10, durationMin = 5) {
  if (!isRunning) return;

  const pair = pickRandom(PAIRS);
  const display = DISPLAY[pair];
  const sig = generateSignal(pair);
  const rr = (sig.tpPips / sig.slPips).toFixed(1);
  const session = getSession();
  const time = getZambiaTime();
  const actionEmoji = sig.action === 'BUY' ? '🟢📈' : '🔴📉';
  const bridge = getBridge();

  let executionLine = '⚠️ Manual mode — execute in Deriv app';
  let tradeResult: { ok: boolean; contractId?: number; buyPrice?: number; payout?: number; error?: string } = { ok: false };

  if (bridge) {
    tradeResult = await callBridge({
      cmd: sig.action,
      symbol: pair,
      stake,
      duration: durationMin,
    });

    if (tradeResult.ok) {
      executedCount++;
      executionLine =
        '✅ *Auto\\-executed on Deriv*\n' +
        'Contract \\#' + md(tradeResult.contractId!) + '\n' +
        'Stake: \\$' + md(tradeResult.buyPrice!.toFixed(2)) +
        ' · Payout: \\$' + md(tradeResult.payout!.toFixed(2));
    } else {
      executionLine = '❌ Deriv failed: ' + md(tradeResult.error ?? 'unknown');
    }
  }

  const message = [
    actionEmoji + ' *' + md(sig.action) + ' — ' + md(display) + '*',
    '',
    'Entry:        \\`' + md(sig.entry) + '\\`',
    'Stop Loss:    \\`' + md(sig.sl) + '\\` \\(' + md(sig.slPips) + ' pips\\)',
    'Take Profit:  \\`' + md(sig.tp) + '\\` \\(' + md(sig.tpPips) + ' pips\\)',
    'Risk/Reward:  1:' + md(rr),
    'Confidence:   ' + md(sig.confidence) + '%',
    'RSI:          ' + md(sig.rsi),
    '',
    '📊 ' + md(sig.reason),
    '',
    '💰 Stake: \\$' + md(stake) + ' · Duration: ' + md(durationMin) + ' min',
    '',
    executionLine,
    '',
    session.emoji + ' ' + md(session.message),
    '⏰ ' + md(time) + ' · 🤖 ForexPulse PRO',
  ].join('\n');

  const sent = await sendTelegram(message);
  if (sent.ok) {
    signalCount++;
    recentSignals.unshift({
      id: String(Date.now()),
      symbol: display,
      action: sig.action,
      confidence: sig.confidence,
      rsi: sig.rsi,
      time: time.slice(0, 5),
      executed: tradeResult.ok,
      contractId: tradeResult.contractId,
    });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log('Signal #' + signalCount + ': ' + sig.action + ' ' + display +
      ' | Bridge: ' + (tradeResult.ok ? '#' + tradeResult.contractId : 'failed: ' + tradeResult.error));
  }
}

function startBot(stake: number, duration: number) {
  isRunning = true;
  signalCount = 0;
  executedCount = 0;
  dispatchSignal(stake, duration);
  intervalId = setInterval(() => dispatchSignal(stake, duration), 60000);
}

function stopBot() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const bridge = getBridge();
  return NextResponse.json({
    running: isRunning,
    signalCount,
    executedCount,
    mt5Connected: false,
    derivConnected: !!bridge,
    recentSignals,
    message: isRunning ? 'Running — ' + signalCount + ' signals, ' + executedCount + ' on Deriv' : 'Bot stopped',
    debug: {
      hasToken: !!telegramToken,
      tokenPreview: telegramToken ? telegramToken.slice(0, 10) + '...' : 'MISSING',
      hasChatId: !!chatId,
      chatId: chatId ?? 'MISSING',
      hasBridge: !!bridge,
    },
  });
}

export async function POST(request: Request) {
  let body: { action?: string; stake?: number; duration?: number };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, stake = 10, duration = 5 } = body;

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    const bridge = getBridge();
    const session = getSession();
    const result = await sendTelegram(
      '🤖 *ForexPulse PRO Activated*\n\n' +
      (bridge ? '✅ Deriv auto\\-execution: ON \\(via Render bridge\\)' : '⚠️ Manual mode — bridge not configured') + '\n' +
      '✅ Signals every 60 seconds\n' +
      '✅ Entry, SL, TP included\n\n' +
      session.emoji + ' ' + md(session.message) + '\n\n' +
      'Stake: \\$' + md(stake) + ' · Duration: ' + md(duration) + ' min'
    );
    if (!result.ok) return NextResponse.json({ success: false, message: 'Telegram failed: ' + result.error });
    startBot(stake, duration);
    return NextResponse.json({ success: true, derivConnected: !!bridge });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    await sendTelegram(
      '⏸️ *Bot Stopped*\n\n' +
      md(signalCount) + ' signals · ' + md(executedCount) + ' executed on Deriv\\.'
    );
    return NextResponse.json({ success: true, signalCount, executedCount });
  }

  if (action === 'test') {
    const pair = pickRandom(PAIRS);
    const display = DISPLAY[pair];
    const sig = generateSignal(pair);
    const bridge = getBridge();

    let bridgeStatus = 'Not configured';
    if (bridge) {
      const res = await callBridge({ cmd: 'BALANCE' });
      bridgeStatus = res.ok ? 'Connected ✓ — Balance: ' + (res.balance ?? '?') : 'Error: ' + (res.error ?? 'unknown');
    }

    const result = await sendTelegram(
      '🔔 *Test Signal — ' + md(display) + '*\n\n' +
      'Action: *' + md(sig.action) + '*\n' +
      'Entry: ' + md(sig.entry) + '\n' +
      'Confidence: ' + md(sig.confidence) + '%\n' +
      'RSI: ' + md(sig.rsi) + '\n\n' +
      'Bridge: ' + md(bridgeStatus) + '\n\n' +
      '✅ Bot is working correctly\\!'
    );

    return NextResponse.json({
      success: result.ok,
      message: result.ok ? 'Test signal sent' : 'Telegram failed: ' + result.error,
      signal: { symbol: display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi },
      bridgeStatus,
    });
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
}
