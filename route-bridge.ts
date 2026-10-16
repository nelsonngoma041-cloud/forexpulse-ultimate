// app/api/live-signals/route.ts
// Signals come from the Render bridge (real Deriv candles: RSI + MACD + MA20).
// Only BUY/SELL signals are sent. WAIT is skipped.

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
  if (!url || !secret) return null;
  return { url, secret };
}

// ─── Bridge call ──────────────────────────────────────────────────────────────

interface Analysis {
  action: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  rsi: number;
  macd: number;
  price: number;
  reason: string;
}

async function bridgeCall(payload: Record<string, unknown>) {
  const cfg = getBridge();
  if (!cfg) throw new Error('Bridge not configured');
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bridge-secret': cfg.secret },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(45000), // Render free tier can take ~30s to wake
  });
  return (await res.json()) as {
    ok: boolean; error?: string; analysis?: Analysis; balance?: string; accounts?: unknown;
    trade?: { contract_id?: number; buy_price?: number; balance_after?: number; tradesToday?: number };
    result?: { is_sold: boolean; status?: string; profit?: number };
  };
}

async function analyse(symbol: string): Promise<Analysis | null> {
  try {
    const r = await bridgeCall({ cmd: 'ANALYZE', symbol });
    if (!r.ok || !r.analysis) {
      console.error('Analyze failed for ' + symbol + ': ' + r.error);
      return null;
    }
    return r.analysis;
  } catch (err) {
    console.error('Bridge error for ' + symbol + ':', err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Symbols ──────────────────────────────────────────────────────────────────

const ALL_PAIRS = [
  { symbol: 'EURUSD', display: 'EUR/USD', type: 'forex',   decimals: 5 },
  { symbol: 'GBPUSD', display: 'GBP/USD', type: 'forex',   decimals: 5 },
  { symbol: 'USDJPY', display: 'USD/JPY', type: 'forex',   decimals: 3 },
  { symbol: 'AUDUSD', display: 'AUD/USD', type: 'forex',   decimals: 5 },
  { symbol: 'USDCAD', display: 'USD/CAD', type: 'forex',   decimals: 5 },
  { symbol: 'V75',    display: 'Volatility 75', type: 'derived', decimals: 2 },
  { symbol: 'V25',    display: 'Volatility 25', type: 'derived', decimals: 3 },
  { symbol: 'V50',    display: 'Volatility 50', type: 'derived', decimals: 4 },
  { symbol: 'CRASH',  display: 'Crash 500',     type: 'derived', decimals: 3 },
  { symbol: 'BOOM',   display: 'Boom 500',      type: 'derived', decimals: 3 },
];

type Pair = typeof ALL_PAIRS[0];

function getAvailablePairs(): Pair[] {
  const day = new Date().getUTCDay();
  if (day === 0 || day === 6) return ALL_PAIRS.filter(p => p.type === 'derived');
  return ALL_PAIRS;
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

function getSession() {
  const h = parseInt(new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
  }), 10);
  if (h >= 15 && h < 19) return { emoji: '🔥', message: 'Prime window, HIGH liquidity', quality: 3 };
  if (h >= 10 && h < 15) return { emoji: '✅', message: 'Good liquidity', quality: 2 };
  if (h >= 19 && h < 22) return { emoji: '⚠️', message: 'Low liquidity, be careful', quality: 1 };
  return { emoji: '😴', message: 'Very low volume', quality: 0 };
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
    const data = (await res.json()) as { ok: boolean; description?: string };
    if (!data.ok) return { ok: false, error: data.description };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── State ───────────────────────────────────────────────────────────────────

let isRunning = false;
let signalCount = 0;
let dailyWins = 0;
let dailyLosses = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
const lastSignalAt: Record<string, number> = {};
const recentSignals: object[] = [];

// Trades the bot placed itself, waiting for their result
interface PendingTrade { contractId: number; display: string; action: string; placedAt: number; }
const pendingTrades: PendingTrade[] = [];
let autoTrade = process.env.AUTO_TRADE === 'true';

async function checkPendingTrades() {
  const now = Date.now();
  for (const t of [...pendingTrades]) {
    if (now - t.placedAt < 15.5 * 60 * 1000) continue; // 15 min contract + buffer
    try {
      const r = await bridgeCall({ cmd: 'CHECK', contract_id: t.contractId });
      if (!r.ok || !r.result) continue;
      if (!r.result.is_sold && now - t.placedAt < 25 * 60 * 1000) continue; // not settled yet
      const profit = Number(r.result.profit ?? 0);
      const won = r.result.status === 'won' || profit > 0;
      if (won) dailyWins++; else dailyLosses++;
      pendingTrades.splice(pendingTrades.indexOf(t), 1);
      await sendTelegram(
        (won ? '✅ *WIN*' : '❌ *LOSS*') + ' — ' + md(t.display) + ' ' + md(t.action) + '\n' +
        'Profit: ' + md(profit.toFixed(2)) + '\n' +
        'Total: ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L'
      );
    } catch (e) {
      console.error('Check failed:', e instanceof Error ? e.message : String(e));
    }
  }
}

// ─── Commands ────────────────────────────────────────────────────────────────

async function handleCommand(text: string) {
  const cmd = text.trim().toLowerCase();
  if (cmd === '/start') {
    if (isRunning) { await sendTelegram('⚠️ Already running'); return; }
    startBot();
    await sendTelegram('🚀 Bot started');
  } else if (cmd === '/stop') {
    stopBot();
    await sendTelegram('⏸️ Stopped\\. ' + md(signalCount) + ' signals sent\\.');
  } else if (cmd === '/status') {
    const s = getSession();
    await sendTelegram(
      '📊 *Status*\n\n' +
      'Bot: ' + (isRunning ? '🟢 Running' : '🔴 Stopped') + '\n' +
      'Signals: ' + md(signalCount) + '\n' +
      'Wins: ' + md(dailyWins) + ' · Losses: ' + md(dailyLosses) + '\n' +
      s.emoji + ' ' + md(s.message) + '\n' +
      'Time: ' + md(getZambiaTime()) + ' CAT'
    );
  } else if (cmd === '/win') {
    dailyWins++;
    await sendTelegram('✅ Win recorded: ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L');
  } else if (cmd === '/loss') {
    dailyLosses++;
    await sendTelegram('❌ Loss recorded: ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L');
  } else if (cmd === '/auto on') {
    autoTrade = true;
    await sendTelegram('🤖 Auto\\-trading *ON* \\(demo\\)\\. Bot will place trades itself\\.');
  } else if (cmd === '/auto off') {
    autoTrade = false;
    await sendTelegram('✋ Auto\\-trading *OFF*\\. Back to manual signals\\.');
  } else if (cmd === '/balance') {
    try {
      const r = await bridgeCall({ cmd: 'BALANCE' });
      await sendTelegram(r.ok ? '💰 Balance: ' + md(r.balance ?? '?') : '❌ ' + md(r.error ?? 'failed'));
    } catch (e) {
      await sendTelegram('❌ ' + md(e instanceof Error ? e.message : 'failed'));
    }
  } else if (cmd === '/accounts') {
    try {
      const r = await bridgeCall({ cmd: 'ACCOUNTS' });
      const raw = JSON.stringify(r.ok ? r.accounts : r.error).slice(0, 900);
      await sendTelegram('🧾 Accounts:\n' + md(raw));
    } catch (e) {
      await sendTelegram('❌ ' + md(e instanceof Error ? e.message : 'failed'));
    }
  }
}

// ─── Signal dispatch ─────────────────────────────────────────────────────────

const MIN_CONFIDENCE = 65;
const COOLDOWN_MS = 15 * 60 * 1000; // same symbol: no repeat within 15 min

async function dispatchSignal() {
  if (!isRunning) return;

  await checkPendingTrades();

  const session = getSession();
  if (process.env.SKIP_LOW_SESSION === 'true' && session.quality === 0) return;

  // Scan pairs and take the strongest valid setup
  const pairs = getAvailablePairs().filter(
    p => Date.now() - (lastSignalAt[p.symbol] ?? 0) > COOLDOWN_MS
  );
  const results = await Promise.all(pairs.map(async p => ({ pair: p, a: await analyse(p.symbol) })));
  const valid = results
    .filter(r => r.a && r.a.action !== 'WAIT' && r.a.confidence >= MIN_CONFIDENCE)
    .sort((x, y) => (y.a!.confidence - x.a!.confidence));

  if (valid.length === 0) {
    console.log('No clear setup this round');
    return;
  }

  const { pair, a } = valid[0];
  const analysis = a as Analysis;
  const stake = Number(process.env.DERIV_STAKE ?? '1');
  const time = getZambiaTime();
  const emoji = analysis.action === 'BUY' ? '🟢📈' : '🔴📉';
  const direction = analysis.action === 'BUY' ? 'Rise' : 'Fall';
  const price = analysis.price.toFixed(pair.decimals);

  // ── Auto trade (demo) ─────────────────────────────────────────────────────
  if (autoTrade) {
    // Don't open a second trade on the same symbol while one is running
    if (pendingTrades.some(t => t.display === pair.display)) return;
    // Cap how many trades can run at once
    if (pendingTrades.length >= 3) return;

    const r = await bridgeCall({ cmd: 'BUY', symbol: pair.symbol, action: analysis.action, stake });
    if (!r.ok || !r.trade?.contract_id) {
      await sendTelegram('⚠️ Auto\\-trade blocked: ' + md(r.error ?? 'unknown error'));
      return;
    }
    signalCount++;
    lastSignalAt[pair.symbol] = Date.now();
    pendingTrades.push({
      contractId: r.trade.contract_id,
      display: pair.display,
      action: analysis.action,
      placedAt: Date.now(),
    });
    await sendTelegram(
      emoji + ' *TRADE PLACED — ' + md(pair.display) + '*\n\n' +
      direction + ' · 15 min · stake \\$' + md(stake) + '\n' +
      'Price: ' + md(price) + ' · Confidence: ' + md(analysis.confidence) + '%\n' +
      'Why: ' + md(analysis.reason) + '\n' +
      'Contract: ' + md(r.trade.contract_id) + '\n' +
      (r.trade.balance_after !== undefined ? 'Balance: ' + md(r.trade.balance_after) + '\n' : '') +
      '\n🤖 Auto\\-trading \\(demo\\) · ⏰ ' + md(time)
    );
    recentSignals.unshift({
      id: String(Date.now()), symbol: pair.display, action: analysis.action,
      confidence: analysis.confidence, rsi: analysis.rsi, time: time.slice(0, 5),
      type: pair.type, priceSource: 'live',
    });
    if (recentSignals.length > 20) recentSignals.pop();
    return;
  }

  const message = [
    emoji + ' *' + md(analysis.action) + ' — ' + md(pair.display) + '*',
    pair.type === 'derived' ? '🎲 Derived Index' : '💱 Forex',
    '',
    'Price:       \\`' + md(price) + '\\`',
    'Trade:       *' + direction + '* · 15 min',
    'Confidence:  ' + md(analysis.confidence) + '%',
    '',
    '📊 *Real data analysis*',
    'RSI: ' + md(analysis.rsi.toFixed(1)),
    'MACD: ' + (analysis.macd > 0 ? 'Bullish' : 'Bearish'),
    'Why: ' + md(analysis.reason),
    '',
    '💰 Stake: \\$' + md(stake),
    '⏳ *Execute within 2–5 mins*',
    '📱 Deriv → ' + direction + ' → 15 min',
    '⚠️ Do NOT execute after 5 mins',
    '',
    session.emoji + ' ' + md(session.message),
    '⏰ ' + md(time) + ' · 🤖 ForexPulse PRO',
    '',
    'Reply /win or /loss after the trade',
  ].join('\n');

  const sent = await sendTelegram(message);
  if (!sent.ok) { console.error('Telegram failed:', sent.error); return; }

  signalCount++;
  lastSignalAt[pair.symbol] = Date.now();

  setTimeout(async () => {
    if (!isRunning) return;
    await sendTelegram(
      '⏰ *Execute now — ' + md(pair.display) + '*\n\n' +
      emoji + ' *' + direction + '* · 15 min\n' +
      '⚠️ Signal expires in 3 minutes'
    );
  }, 2 * 60 * 1000);

  recentSignals.unshift({
    id: String(Date.now()),
    symbol: pair.display,
    action: analysis.action,
    confidence: analysis.confidence,
    rsi: analysis.rsi,
    time: time.slice(0, 5),
    type: pair.type,
    priceSource: 'live',
  });
  if (recentSignals.length > 20) recentSignals.pop();
}

function startBot() {
  isRunning = true;
  signalCount = 0;
  dispatchSignal();
  intervalId = setInterval(dispatchSignal, 60000);
}

function stopBot() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
}

// ─── Route handlers ──────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    running: isRunning,
    signalCount,
    dailyWins,
    dailyLosses,
    mt5Connected: false,
    derivConnected: getBridge() !== null,
    recentSignals,
    message: isRunning ? 'Running — ' + signalCount + ' signals sent' : 'Bot stopped',
  });
}

export async function POST(request: Request) {
  let body: { action?: string; message?: { text?: string } };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (body.message?.text) {
    await handleCommand(body.message.text);
    return NextResponse.json({ ok: true });
  }

  const { action } = body;

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    if (!getBridge()) return NextResponse.json({ success: false, message: 'Bridge not configured' });
    const s = getSession();
    const result = await sendTelegram(
      '🤖 *ForexPulse PRO Activated*\n\n' +
      '✅ Real Deriv candles\n' +
      '✅ RSI \\+ MACD \\+ MA20\n' +
      '✅ Signals only when a setup is clear\n' +
      '✅ 2 min execute reminder\n\n' +
      '📱 /status /stop /win /loss /balance\n\n' +
      s.emoji + ' ' + md(s.message)
    );
    if (!result.ok) return NextResponse.json({ success: false, message: 'Telegram failed: ' + result.error });
    startBot();
    return NextResponse.json({ success: true });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    await sendTelegram(
      '⏸️ *Stopped*\n\n' + md(signalCount) + ' signals · ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L'
    );
    return NextResponse.json({ success: true, signalCount, dailyWins, dailyLosses });
  }

  if (action === 'test') {
    const pair = getAvailablePairs()[0];
    const a = await analyse(pair.symbol);
    if (!a) {
      await sendTelegram('❌ Test failed: bridge or Deriv feed not reachable');
      return NextResponse.json({ success: false, message: 'Bridge/feed unreachable' });
    }
    const result = await sendTelegram(
      '🔔 *Test — ' + md(pair.display) + '*\n\n' +
      'Action: *' + md(a.action) + '*\n' +
      'Price: ' + md(a.price.toFixed(pair.decimals)) + '\n' +
      'RSI: ' + md(a.rsi.toFixed(1)) + '\n' +
      'Reason: ' + md(a.reason) + '\n\n' +
      '✅ Live Deriv feed working\\!'
    );
    return NextResponse.json({ success: result.ok, signal: { symbol: pair.display, action: a.action, rsi: a.rsi } });
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
}
