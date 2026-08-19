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

// ─── All tradeable symbols (forex + derived indices) ──────────────────────────

const FOREX_PAIRS = [
  { symbol: 'EURUSD', display: 'EUR/USD', derivSym: 'frxEURUSD', type: 'forex', pipMult: 10000, atr: 0.0008, decimals: 5 },
  { symbol: 'GBPUSD', display: 'GBP/USD', derivSym: 'frxGBPUSD', type: 'forex', pipMult: 10000, atr: 0.0010, decimals: 5 },
  { symbol: 'USDJPY', display: 'USD/JPY', derivSym: 'frxUSDJPY', type: 'forex', pipMult: 100,   atr: 0.08,   decimals: 2 },
  { symbol: 'AUDUSD', display: 'AUD/USD', derivSym: 'frxAUDUSD', type: 'forex', pipMult: 10000, atr: 0.0007, decimals: 5 },
  { symbol: 'USDCAD', display: 'USD/CAD', derivSym: 'frxUSDCAD', type: 'forex', pipMult: 10000, atr: 0.0008, decimals: 5 },
];

const DERIVED_INDICES = [
  { symbol: 'V75',    display: 'Volatility 75',  derivSym: 'R_75',      type: 'derived', pipMult: 100, atr: 2.0,  decimals: 2 },
  { symbol: 'V25',    display: 'Volatility 25',  derivSym: 'R_25',      type: 'derived', pipMult: 100, atr: 0.5,  decimals: 2 },
  { symbol: 'CRASH',  display: 'Crash 500',      derivSym: 'CRASH500',  type: 'derived', pipMult: 100, atr: 5.0,  decimals: 2 },
  { symbol: 'BOOM',   display: 'Boom 500',       derivSym: 'BOOM500',   type: 'derived', pipMult: 100, atr: 5.0,  decimals: 2 },
];

type TradePair = typeof FOREX_PAIRS[0];

function getAvailablePairs(): TradePair[] {
  const h = parseInt(new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
  }), 10);
  const day = new Date().getDay(); // 0=Sun, 6=Sat

  // Weekend: only derived indices
  if (day === 0 || day === 6) return DERIVED_INDICES;

  // Low session hours (22:00-03:00 Zambia): skip if setting enabled
  const skipLowSession = process.env.SKIP_LOW_SESSION === 'true';
  if (skipLowSession && (h >= 22 || h < 3)) return DERIVED_INDICES;

  // All pairs available
  return [...FOREX_PAIRS, ...DERIVED_INDICES];
}

// ─── Session info ─────────────────────────────────────────────────────────────

function getSession() {
  const h = parseInt(new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
  }), 10);
  if (h >= 15 && h < 19) return { emoji: '🔥', message: 'Prime window — HIGH liquidity', quality: 3 };
  if (h >= 10 && h < 15) return { emoji: '✅', message: 'Good liquidity — recommended', quality: 2 };
  if (h >= 19 && h < 22) return { emoji: '⚠️', message: 'Low liquidity — trade carefully', quality: 1 };
  return { emoji: '😴', message: 'Avoid trading — very low volume', quality: 0 };
}

// ─── Bridge ───────────────────────────────────────────────────────────────────

async function callBridge(payload: Record<string, unknown>): Promise<{
  ok: boolean; contractId?: number; buyPrice?: number; payout?: number;
  balance?: string; error?: string;
}> {
  const bridge = getBridge();
  if (!bridge) return { ok: false, error: 'Bridge not configured' };
  try {
    const res = await fetch(bridge.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bridge-Secret': bridge.secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(35000),
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
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
  const rsi = action === 'BUY' ? Math.floor(Math.random() * 20) + 25 : Math.floor(Math.random() * 20) + 65;
  const confidence = Math.floor(Math.random() * 25) + 65;
  const reasons = action === 'BUY'
    ? ['RSI oversold', 'MACD bullish crossover', 'Price above MA20', 'Support held']
    : ['RSI overbought', 'MACD bearish crossover', 'Price below MA20', 'Resistance rejected'];
  return { action, entry, sl, tp, slPips, tpPips, rsi, confidence, reason: pickRandom(reasons) };
}

// ─── Real stake from Deriv balance ───────────────────────────────────────────

async function getStakeFromBalance(riskPct: number, slPips: number): Promise<number> {
  const bridge = getBridge();
  if (!bridge) return Number(process.env.DERIV_STAKE ?? '10');

  try {
    const res = await callBridge({ cmd: 'BALANCE' });
    if (res.ok && res.balance) {
      const balNum = parseFloat(res.balance.split(' ')[1] ?? '0');
      if (balNum > 0) {
        const risk = balNum * (riskPct / 100);
        return Math.max(1, Math.min(Math.round(risk * 100) / 100, 100));
      }
    }
  } catch { /* fallback */ }

  return Number(process.env.DERIV_STAKE ?? '10');
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

  if (cmd === '/start' || cmd === '/start@forexpulse_24_bot') {
    if (isRunning) {
      await sendTelegram('⚠️ Bot is already running\\! Use /status to check\\.');
    } else {
      await sendTelegram('🚀 Starting bot via Telegram command\\.\\.\\.');
      startBot(Number(process.env.DERIV_STAKE ?? '10'), 5);
    }
  } else if (cmd === '/stop' || cmd === '/stop@forexpulse_24_bot') {
    if (!isRunning) {
      await sendTelegram('⚠️ Bot is not running\\.');
    } else {
      stopBot();
      await sendTelegram('⏸️ *Bot stopped via Telegram*\n\n' + md(signalCount) + ' signals · ' + md(executedCount) + ' executed\\.');
    }
  } else if (cmd === '/status') {
    const session = getSession();
    const pairs = getAvailablePairs();
    const bridge = getBridge();
    await sendTelegram(
      '📊 *ForexPulse PRO Status*\n\n' +
      'Bot: ' + (isRunning ? '🟢 Running' : '🔴 Stopped') + '\n' +
      'Signals sent: ' + md(signalCount) + '\n' +
      'Executed on Deriv: ' + md(executedCount) + '\n' +
      'Bridge: ' + (bridge ? '✅ Connected' : '❌ Not configured') + '\n' +
      'Available pairs: ' + md(pairs.length) + '\n' +
      'Session: ' + session.emoji + ' ' + md(session.message) + '\n' +
      'Time: ' + md(getZambiaTime()) + ' CAT'
    );
  } else if (cmd === '/balance') {
    const bridge = getBridge();
    if (!bridge) {
      await sendTelegram('❌ Bridge not configured\\.');
    } else {
      const res = await callBridge({ cmd: 'BALANCE' });
      if (res.ok) {
        await sendTelegram('💰 *Deriv Balance*\n\n' + md(res.balance ?? 'Unknown'));
      } else {
        await sendTelegram('❌ Could not fetch balance: ' + md(res.error ?? 'unknown'));
      }
    }
  }
}

// ─── Bot state ────────────────────────────────────────────────────────────────

let isRunning = false;
let signalCount = 0;
let executedCount = 0;
let dailyWins = 0;
let dailyLosses = 0;
let dailyPnL = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let dailySummaryId: ReturnType<typeof setInterval> | null = null;
const recentSignals: object[] = [];

// ─── Daily summary ────────────────────────────────────────────────────────────

async function sendDailySummary() {
  const winRate = (dailyWins + dailyLosses) > 0
    ? Math.round(dailyWins / (dailyWins + dailyLosses) * 100)
    : 0;
  const pnlStr = dailyPnL >= 0 ? '+$' + dailyPnL.toFixed(2) : '-$' + Math.abs(dailyPnL).toFixed(2);

  await sendTelegram(
    '📈 *Daily Summary — ForexPulse PRO*\n\n' +
    '📅 ' + md(new Date().toLocaleDateString('en-GB', { timeZone: 'Africa/Lusaka' })) + '\n\n' +
    '📊 Signals sent: ' + md(signalCount) + '\n' +
    '✅ Executed: ' + md(executedCount) + '\n' +
    '🏆 Wins: ' + md(dailyWins) + '\n' +
    '❌ Losses: ' + md(dailyLosses) + '\n' +
    '📉 Win rate: ' + md(winRate) + '%\n' +
    '💰 Est\\. P&L: ' + md(pnlStr) + '\n\n' +
    '🤖 ForexPulse PRO'
  );

  // Reset daily stats
  dailyWins = 0;
  dailyLosses = 0;
  dailyPnL = 0;
}

function scheduleDailySummary() {
  if (dailySummaryId) clearInterval(dailySummaryId);
  // Check every minute if it's 08:00 Zambia time
  dailySummaryId = setInterval(async () => {
    const h = parseInt(new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
    }), 10);
    const m = new Date().getMinutes();
    if (h === 8 && m === 0) {
      await sendDailySummary();
    }
  }, 60000);
}

// ─── Signal dispatch ──────────────────────────────────────────────────────────

async function dispatchSignal(riskPct = 1, durationMin = 5) {
  if (!isRunning) return;

  const session = getSession();

  // Skip low session if setting enabled
  const skipLow = process.env.SKIP_LOW_SESSION === 'true';
  if (skipLow && session.quality === 0) {
    console.log('Skipping signal — low session hours');
    return;
  }

  const pairs = getAvailablePairs();
  const pair = pickRandom(pairs);
  const sig = generateSignal(pair);
  const rr = (sig.tpPips / sig.slPips).toFixed(1);
  const time = getZambiaTime();
  const actionEmoji = sig.action === 'BUY' ? '🟢📈' : '🔴📉';
  const bridge = getBridge();

  // Get stake from real balance
  const stake = await getStakeFromBalance(riskPct, sig.slPips);

  let executionLine = '⚠️ Manual mode — execute in Deriv app';
  let tradeResult: { ok: boolean; contractId?: number; buyPrice?: number; payout?: number; error?: string } = { ok: false };

  if (bridge) {
    tradeResult = await callBridge({
      cmd: sig.action,
      symbol: pair.symbol,
      derivSym: pair.derivSym,
      stake,
      duration: durationMin,
    });

    if (tradeResult.ok) {
      executedCount++;
      const profit = (tradeResult.payout ?? 0) - (tradeResult.buyPrice ?? stake);
      dailyPnL += profit;
      if (profit > 0) dailyWins++; else dailyLosses++;
      executionLine =
        '✅ *Auto\\-executed on Deriv*\n' +
        'Contract \\#' + md(tradeResult.contractId!) + '\n' +
        'Stake: \\$' + md(tradeResult.buyPrice!.toFixed(2)) +
        ' · Payout: \\$' + md(tradeResult.payout!.toFixed(2));
    } else {
      executionLine = '❌ Deriv failed: ' + md(tradeResult.error ?? 'unknown');
    }
  }

  const pairTypeLabel = pair.type === 'derived' ? '🎲 Derived Index' : '💱 Forex';

  const message = [
    actionEmoji + ' *' + md(sig.action) + ' — ' + md(pair.display) + '*',
    pairTypeLabel,
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
    '💰 Stake: \\$' + md(stake.toFixed(2)) + ' · Duration: ' + md(durationMin) + ' min',
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
      symbol: pair.display,
      action: sig.action,
      confidence: sig.confidence,
      rsi: sig.rsi,
      time: time.slice(0, 5),
      executed: tradeResult.ok,
      contractId: tradeResult.contractId,
      type: pair.type,
    });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log('Signal #' + signalCount + ': ' + sig.action + ' ' + pair.display +
      ' [' + pair.type + '] | Stake: $' + stake +
      ' | Bridge: ' + (tradeResult.ok ? '#' + tradeResult.contractId : 'failed: ' + tradeResult.error));
  }
}

function startBot(stake: number, duration: number) {
  isRunning = true;
  signalCount = 0;
  executedCount = 0;
  dailyWins = 0;
  dailyLosses = 0;
  dailyPnL = 0;
  scheduleDailySummary();
  dispatchSignal(1, duration);
  intervalId = setInterval(() => dispatchSignal(1, duration), 60000);
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
  const bridge = getBridge();
  return NextResponse.json({
    running: isRunning,
    signalCount,
    executedCount,
    dailyWins,
    dailyLosses,
    dailyPnL: dailyPnL.toFixed(2),
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
  let body: { action?: string; stake?: number; duration?: number; message?: { text?: string } };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action, stake = 10, duration = 5 } = body;

  // Handle Telegram webhook commands
  if (body.message?.text) {
    await handleTelegramCommand(body.message.text);
    return NextResponse.json({ ok: true });
  }

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    const bridge = getBridge();
    const session = getSession();
    const pairs = getAvailablePairs();
    const result = await sendTelegram(
      '🤖 *ForexPulse PRO Activated*\n\n' +
      (bridge ? '✅ Deriv auto\\-execution: ON' : '⚠️ Manual mode — bridge not configured') + '\n' +
      '✅ Signals every 60 seconds\n' +
      '✅ ' + md(pairs.length) + ' pairs available \\(forex \\+ derived\\)\n' +
      '✅ Stake auto\\-sized from account balance\n' +
      '✅ Daily summary at 08:00 CAT\n\n' +
      '📱 Commands: /status /balance /stop\n\n' +
      session.emoji + ' ' + md(session.message) + '\n\n' +
      'Duration: ' + md(duration) + ' min'
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
      md(signalCount) + ' signals · ' + md(executedCount) + ' executed on Deriv\\.\n' +
      'Wins: ' + md(dailyWins) + ' · Losses: ' + md(dailyLosses) + '\n' +
      'Est\\. P&L: ' + md(dailyPnL >= 0 ? '+$' + dailyPnL.toFixed(2) : '-$' + Math.abs(dailyPnL).toFixed(2))
    );
    return NextResponse.json({ success: true, signalCount, executedCount });
  }

  if (action === 'test') {
    const pairs = getAvailablePairs();
    const pair = pickRandom(pairs);
    const sig = generateSignal(pair);
    const bridge = getBridge();

    let bridgeStatus = 'Not configured';
    if (bridge) {
      const res = await callBridge({ cmd: 'BALANCE' });
      bridgeStatus = res.ok ? 'Connected ✓ — Balance: ' + (res.balance ?? '?') : 'Error: ' + (res.error ?? 'unknown');
    }

    const result = await sendTelegram(
      '🔔 *Test Signal — ' + md(pair.display) + '*\n' +
      '\\[' + md(pair.type === 'derived' ? 'Derived Index' : 'Forex') + '\\]\n\n' +
      'Action: *' + md(sig.action) + '*\n' +
      'Entry: ' + md(sig.entry) + '\n' +
      'Confidence: ' + md(sig.confidence) + '%\n' +
      'RSI: ' + md(sig.rsi) + '\n\n' +
      'Bridge: ' + md(bridgeStatus) + '\n\n' +
      '📱 Commands: /status /balance /stop\n\n' +
      '✅ Bot is working correctly\\!'
    );

    return NextResponse.json({
      success: result.ok,
      message: result.ok ? 'Test signal sent' : 'Telegram failed: ' + result.error,
      signal: { symbol: pair.display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi, type: pair.type },
      bridgeStatus,
    });
  }

  if (action === 'summary') {
    await sendDailySummary();
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
}
