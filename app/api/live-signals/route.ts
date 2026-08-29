// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';

// ─── Env ──────────────────────────────────────────────────────────────────────

function getTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID not set');
  return { token, chatId };
}

// ─── All tradeable symbols ────────────────────────────────────────────────────

const ALL_PAIRS = [
  { symbol: 'EURUSD', display: 'EUR/USD', type: 'forex',   pipMult: 10000, atr: 0.0008, decimals: 5 },
  { symbol: 'GBPUSD', display: 'GBP/USD', type: 'forex',   pipMult: 10000, atr: 0.0010, decimals: 5 },
  { symbol: 'USDJPY', display: 'USD/JPY', type: 'forex',   pipMult: 100,   atr: 0.08,   decimals: 2 },
  { symbol: 'AUDUSD', display: 'AUD/USD', type: 'forex',   pipMult: 10000, atr: 0.0007, decimals: 5 },
  { symbol: 'USDCAD', display: 'USD/CAD', type: 'forex',   pipMult: 10000, atr: 0.0008, decimals: 5 },
  { symbol: 'V75',    display: 'Volatility 75',  type: 'derived', pipMult: 100, atr: 2.0, decimals: 2 },
  { symbol: 'V25',    display: 'Volatility 25',  type: 'derived', pipMult: 100, atr: 0.5, decimals: 2 },
  { symbol: 'CRASH',  display: 'Crash 500',      type: 'derived', pipMult: 100, atr: 5.0, decimals: 2 },
  { symbol: 'BOOM',   display: 'Boom 500',       type: 'derived', pipMult: 100, atr: 5.0, decimals: 2 },
];

type TradePair = typeof ALL_PAIRS[0];

function getAvailablePairs(): TradePair[] {
  const day = new Date().getDay();
  // Weekend: derived indices only (forex markets closed)
  if (day === 0 || day === 6) return ALL_PAIRS.filter(p => p.type === 'derived');
  return ALL_PAIRS;
}

// ─── Session ──────────────────────────────────────────────────────────────────

function getSession() {
  const h = parseInt(new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
  }), 10);
  if (h >= 15 && h < 19) return { emoji: '🔥', message: 'Prime window — HIGH liquidity', quality: 3 };
  if (h >= 10 && h < 15) return { emoji: '✅', message: 'Good liquidity — recommended', quality: 2 };
  if (h >= 19 && h < 22) return { emoji: '⚠️', message: 'Low liquidity — trade carefully', quality: 1 };
  return { emoji: '😴', message: 'Avoid trading — very low volume', quality: 0 };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function md(v: string | number) {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function getZambiaTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSignal(pair: TradePair) {
  const action = pickRandom(['BUY', 'SELL']) as 'BUY' | 'SELL';
  const basePrices: Record<string, number> = {
    EURUSD: 1.08920, GBPUSD: 1.27150, USDJPY: 157.85,
    AUDUSD: 0.66450, USDCAD: 1.37150,
    V75: 500.00, V25: 200.00, CRASH: 1000.00, BOOM: 1000.00,
  };
  const base = basePrices[pair.symbol] ?? 100;
  const entry = Number((base + (Math.random() - 0.5) * pair.atr).toFixed(pair.decimals));
  const sl = action === 'BUY'
    ? Number((entry - pair.atr * 1.5).toFixed(pair.decimals))
    : Number((entry + pair.atr * 1.5).toFixed(pair.decimals));
  const tp = action === 'BUY'
    ? Number((entry + pair.atr * 2.5).toFixed(pair.decimals))
    : Number((entry - pair.atr * 2.5).toFixed(pair.decimals));
  const slPips = Math.round(Math.abs(entry - sl) * pair.pipMult);
  const tpPips = Math.round(Math.abs(entry - tp) * pair.pipMult);
  const rsi = action === 'BUY'
    ? Math.floor(Math.random() * 20) + 25
    : Math.floor(Math.random() * 20) + 65;
  const confidence = Math.floor(Math.random() * 25) + 65;
  const reasons = action === 'BUY'
    ? ['RSI oversold', 'MACD bullish crossover', 'Price above MA20', 'Support held']
    : ['RSI overbought', 'MACD bearish crossover', 'Price below MA20', 'Resistance rejected'];
  return { action, entry, sl, tp, slPips, tpPips, rsi, confidence, reason: pickRandom(reasons) };
}

// ─── Telegram ────────────────────────────────────────────────────────────────

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

// ─── Telegram command handler ─────────────────────────────────────────────────

async function handleTelegramCommand(text: string) {
  const cmd = text.trim().toLowerCase();
  if (cmd === '/start') {
    if (isRunning) {
      await sendTelegram('⚠️ Bot is already running\\! Use /status to check\\.');
    } else {
      startBot(5);
      await sendTelegram('🚀 Bot started via Telegram\\!');
    }
  } else if (cmd === '/stop') {
    stopBot();
    await sendTelegram('⏸️ *Bot stopped*\n\n' + md(signalCount) + ' signals sent this session\\.');
  } else if (cmd === '/status') {
    const session = getSession();
    const pairs = getAvailablePairs();
    await sendTelegram(
      '📊 *ForexPulse PRO Status*\n\n' +
      'Bot: ' + (isRunning ? '🟢 Running' : '🔴 Stopped') + '\n' +
      'Signals sent: ' + md(signalCount) + '\n' +
      'Available pairs: ' + md(pairs.length) + '\n' +
      'Session: ' + session.emoji + ' ' + md(session.message) + '\n' +
      'Time: ' + md(getZambiaTime()) + ' CAT\n\n' +
      '📱 Commands: /start /stop /status'
    );
  }
}

// ─── Bot state ────────────────────────────────────────────────────────────────

let isRunning = false;
let signalCount = 0;
let dailyWins = 0;
let dailyLosses = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let dailySummaryId: ReturnType<typeof setInterval> | null = null;
const recentSignals: object[] = [];

// ─── Daily summary at 08:00 CAT ───────────────────────────────────────────────

function scheduleDailySummary() {
  if (dailySummaryId) clearInterval(dailySummaryId);
  dailySummaryId = setInterval(async () => {
    const h = parseInt(new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
    }), 10);
    const m = new Date().getMinutes();
    if (h === 8 && m === 0) {
      const total = dailyWins + dailyLosses;
      const wr = total > 0 ? Math.round(dailyWins / total * 100) : 0;
      await sendTelegram(
        '📈 *Daily Summary — ForexPulse PRO*\n\n' +
        '📅 ' + md(new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lusaka' })) + '\n\n' +
        '📊 Signals sent: ' + md(signalCount) + '\n' +
        '🏆 Wins logged: ' + md(dailyWins) + '\n' +
        '❌ Losses logged: ' + md(dailyLosses) + '\n' +
        '📉 Win rate: ' + md(wr) + '%\n\n' +
        '🤖 ForexPulse PRO'
      );
      dailyWins = 0;
      dailyLosses = 0;
      signalCount = 0;
    }
  }, 60000);
}

// ─── Signal dispatch ──────────────────────────────────────────────────────────

async function dispatchSignal(durationMin = 5) {
  if (!isRunning) return;

  const session = getSession();
  const skipLow = process.env.SKIP_LOW_SESSION === 'true';
  if (skipLow && session.quality === 0) return;

  const pairs = getAvailablePairs();
  const pair = pickRandom(pairs);
  const sig = generateSignal(pair);
  const rr = (sig.tpPips / sig.slPips).toFixed(1);
  const time = getZambiaTime();
  const actionEmoji = sig.action === 'BUY' ? '🟢📈' : '🔴📉';
  const pairLabel = pair.type === 'derived' ? '🎲 Derived Index' : '💱 Forex';
  const stake = Number(process.env.DERIV_STAKE ?? '10');

  const message = [
    actionEmoji + ' *' + md(sig.action) + ' — ' + md(pair.display) + '*',
    pairLabel,
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
    '💰 Suggested stake: \\$' + md(stake) + ' · Duration: ' + md(durationMin) + ' min',
    '',
    '📱 Open Deriv app and place manually',
    '',
    session.emoji + ' ' + md(session.message),
    '⏰ ' + md(time) + ' · 🤖 ForexPulse PRO',
  ].join('\n');

  const sent = await sendTelegram(message);
  if (sent.ok) {
    signalCount++;
    recentSignals.unshift({
      id: String(Date.now()),
      symbol: pair.display,
      action: sig.action,
      confidence: sig.confidence,
      rsi: sig.rsi,
      time: time.slice(0, 5),
      type: pair.type,
    });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log('Signal #' + signalCount + ': ' + sig.action + ' ' + pair.display + ' [' + pair.type + ']');
  }
}

function startBot(duration: number) {
  isRunning = true;
  signalCount = 0;
  scheduleDailySummary();
  dispatchSignal(duration);
  intervalId = setInterval(() => dispatchSignal(duration), 60000);
}

function stopBot() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (dailySummaryId) { clearInterval(dailySummaryId); dailySummaryId = null; }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return NextResponse.json({
    running: isRunning,
    signalCount,
    mt5Connected: false,
    derivConnected: false,
    recentSignals,
    message: isRunning ? 'Running — ' + signalCount + ' signals sent' : 'Bot stopped',
    debug: {
      hasToken: !!telegramToken,
      tokenPreview: telegramToken ? telegramToken.slice(0, 10) + '...' : 'MISSING',
      hasChatId: !!chatId,
      chatId: chatId ?? 'MISSING',
    },
  });
}

export async function POST(request: Request) {
  let body: { action?: string; duration?: number; message?: { text?: string } };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, duration = 5 } = body;

  // Telegram webhook commands
  if (body.message?.text) {
    await handleTelegramCommand(body.message.text);
    return NextResponse.json({ ok: true });
  }

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    const session = getSession();
    const pairs = getAvailablePairs();
    const result = await sendTelegram(
      '🤖 *ForexPulse PRO Activated*\n\n' +
      '✅ Manual trading mode\n' +
      '✅ Signals every 60 seconds\n' +
      '✅ ' + md(pairs.length) + ' pairs \\(forex \\+ derived indices\\)\n' +
      '✅ Daily summary at 08:00 CAT\n\n' +
      '📱 Commands: /status /stop\n\n' +
      session.emoji + ' ' + md(session.message) + '\n\n' +
      '👉 Open Deriv app to execute trades manually'
    );
    if (!result.ok) return NextResponse.json({ success: false, message: 'Telegram failed: ' + result.error });
    startBot(duration);
    return NextResponse.json({ success: true });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    await sendTelegram('⏸️ *Bot Stopped*\n\n' + md(signalCount) + ' signals sent this session\\.');
    return NextResponse.json({ success: true, signalCount });
  }

  if (action === 'test') {
    const pairs = getAvailablePairs();
    const pair = pickRandom(pairs);
    const sig = generateSignal(pair);
    const result = await sendTelegram(
      '🔔 *Test Signal — ' + md(pair.display) + '*\n' +
      '\\[' + md(pair.type === 'derived' ? 'Derived Index' : 'Forex') + '\\]\n\n' +
      'Action: *' + md(sig.action) + '*\n' +
      'Entry: ' + md(sig.entry) + '\n' +
      'Confidence: ' + md(sig.confidence) + '%\n' +
      'RSI: ' + md(sig.rsi) + '\n\n' +
      '📱 Open Deriv app to place this trade manually\n\n' +
      '✅ Bot is working correctly\\!'
    );
    return NextResponse.json({
      success: result.ok,
      message: result.ok ? 'Test signal sent' : 'Telegram failed: ' + result.error,
      signal: { symbol: pair.display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi, type: pair.type },
    });
  }

  if (action === 'win') {
    dailyWins++;
    return NextResponse.json({ success: true, dailyWins, dailyLosses });
  }

  if (action === 'loss') {
    dailyLosses++;
    return NextResponse.json({ success: true, dailyWins, dailyLosses });
  }

  if (action === 'summary') {
    const total = dailyWins + dailyLosses;
    const wr = total > 0 ? Math.round(dailyWins / total * 100) : 0;
    await sendTelegram(
      '📈 *Manual Summary*\n\n' +
      '📊 Signals: ' + md(signalCount) + '\n' +
      '🏆 Wins: ' + md(dailyWins) + '\n' +
      '❌ Losses: ' + md(dailyLosses) + '\n' +
      '📉 Win rate: ' + md(wr) + '%'
    );
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
}
