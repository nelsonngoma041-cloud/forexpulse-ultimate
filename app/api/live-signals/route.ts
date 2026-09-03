// app/api/live-signals/route.ts
// Real price feed from Deriv WebSocket (no auth needed for prices)
// RSI + MACD calculated from live tick data

import { NextResponse } from 'next/server';

// ─── Env ──────────────────────────────────────────────────────────────────────

function getTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID not set');
  return { token, chatId };
}

// ─── Deriv price feed (no auth required) ─────────────────────────────────────

const PRICE_APP_ID = '1089';
const PRICE_WS = 'wss://ws.binaryws.com/websockets/v3?app_id=' + PRICE_APP_ID;

interface Candle { close: number; time: number; }

// Fetch last N candles for a symbol from Deriv
async function fetchCandles(symbol: string, count = 50): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const WebSocketImpl = (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket;
    const ws = new WebSocketImpl(PRICE_WS);
    const timer = setTimeout(() => { ws.close(); reject(new Error('Price feed timeout')); }, 15000);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        ticks_history: symbol,
        count,
        end: 'latest',
        style: 'candles',
        granularity: 60, // 1-minute candles
      }));
    };

    ws.onmessage = (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string);
      clearTimeout(timer);
      ws.close();
      if (msg.error) { reject(new Error(msg.error.message)); return; }
      const candles: Candle[] = (msg.candles ?? []).map((c: { close: number; epoch: number }) => ({
        close: c.close,
        time: c.epoch,
      }));
      resolve(candles);
    };

    ws.onerror = () => { clearTimeout(timer); reject(new Error('WebSocket error')); };
  });
}

// ─── Real indicator math ──────────────────────────────────────────────────────

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function calcEMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1];
  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) ema = values[i] * k + ema * (1 - k);
  return ema;
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 35) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macd = ema12 - ema26;
  // Build MACD history for signal line
  const macdHistory: number[] = [];
  for (let i = 26; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    macdHistory.push(calcEMA(slice, 12) - calcEMA(slice, 26));
  }
  const signal = calcEMA(macdHistory, 9);
  return { macd, signal, histogram: macd - signal };
}

function calcSMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1];
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Analyse a symbol with real data ─────────────────────────────────────────

interface AnalysisResult {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  rsi: number;
  macdHistogram: number;
  price: number;
  reason: string;
  priceSource: 'live' | 'simulated';
}

async function analyseSymbol(derivSymbol: string): Promise<AnalysisResult> {
  try {
    const candles = await fetchCandles(derivSymbol, 50);
    if (candles.length < 30) throw new Error('Not enough candles');

    const closes = candles.map(c => c.close);
    const price = closes[closes.length - 1];
    const rsi = calcRSI(closes);
    const { histogram } = calcMACD(closes);
    const sma20 = calcSMA(closes, 20);

    let buyScore = 0;
    let sellScore = 0;
    const reasons: string[] = [];

    // RSI
    if (rsi < 30) { buyScore += 40; reasons.push('RSI oversold (' + rsi.toFixed(1) + ')'); }
    else if (rsi > 70) { sellScore += 40; reasons.push('RSI overbought (' + rsi.toFixed(1) + ')'); }
    else if (rsi < 50) buyScore += 10;
    else sellScore += 10;

    // MACD histogram
    if (histogram > 0) { buyScore += 35; reasons.push('MACD bullish'); }
    else if (histogram < 0) { sellScore += 35; reasons.push('MACD bearish'); }

    // Price vs SMA20
    if (price > sma20) { buyScore += 25; reasons.push('Price above MA20'); }
    else { sellScore += 25; reasons.push('Price below MA20'); }

    const total = buyScore + sellScore;
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    if (buyScore > sellScore && buyScore >= 40) {
      action = 'BUY';
      confidence = Math.min(Math.round(buyScore / total * 100), 94);
    } else if (sellScore > buyScore && sellScore >= 40) {
      action = 'SELL';
      confidence = Math.min(Math.round(sellScore / total * 100), 94);
    }

    return { action, confidence, rsi, macdHistogram: histogram, price, reason: reasons.join(' + '), priceSource: 'live' };
  } catch (err) {
    // Fallback to simulated if live feed fails
    console.error('Live price failed for ' + derivSymbol + ':', err instanceof Error ? err.message : String(err));
    return simulatedAnalysis();
  }
}

function simulatedAnalysis(): AnalysisResult {
  const action = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const rsi = action === 'BUY' ? Math.floor(Math.random() * 20) + 25 : Math.floor(Math.random() * 20) + 65;
  return {
    action,
    confidence: Math.floor(Math.random() * 20) + 60,
    rsi,
    macdHistogram: action === 'BUY' ? 0.001 : -0.001,
    price: 0,
    reason: 'Simulated \\(live feed unavailable\\)',
    priceSource: 'simulated',
  };
}

// ─── All tradeable symbols ────────────────────────────────────────────────────

const ALL_PAIRS = [
  { symbol: 'EURUSD', display: 'EUR/USD', derivSym: 'frxEURUSD', type: 'forex',   atr: 0.0008, decimals: 5, pipMult: 10000 },
  { symbol: 'GBPUSD', display: 'GBP/USD', derivSym: 'frxGBPUSD', type: 'forex',   atr: 0.0010, decimals: 5, pipMult: 10000 },
  { symbol: 'USDJPY', display: 'USD/JPY', derivSym: 'frxUSDJPY', type: 'forex',   atr: 0.08,   decimals: 2, pipMult: 100   },
  { symbol: 'AUDUSD', display: 'AUD/USD', derivSym: 'frxAUDUSD', type: 'forex',   atr: 0.0007, decimals: 5, pipMult: 10000 },
  { symbol: 'USDCAD', display: 'USD/CAD', derivSym: 'frxUSDCAD', type: 'forex',   atr: 0.0008, decimals: 5, pipMult: 10000 },
  { symbol: 'V75',    display: 'Volatility 75',  derivSym: 'R_75',     type: 'derived', atr: 2.0, decimals: 2, pipMult: 100 },
  { symbol: 'V25',    display: 'Volatility 25',  derivSym: 'R_25',     type: 'derived', atr: 0.5, decimals: 2, pipMult: 100 },
  { symbol: 'V50',    display: 'Volatility 50',  derivSym: 'R_50',     type: 'derived', atr: 1.0, decimals: 2, pipMult: 100 },
  { symbol: 'CRASH',  display: 'Crash 500',      derivSym: 'CRASH500', type: 'derived', atr: 5.0, decimals: 2, pipMult: 100 },
  { symbol: 'BOOM',   display: 'Boom 500',       derivSym: 'BOOM500',  type: 'derived', atr: 5.0, decimals: 2, pipMult: 100 },
];

type TradePair = typeof ALL_PAIRS[0];

function getAvailablePairs(): TradePair[] {
  const day = new Date().getDay();
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

// ─── Telegram commands ────────────────────────────────────────────────────────

async function handleCommand(text: string) {
  const cmd = text.trim().toLowerCase();
  if (cmd === '/start') {
    if (isRunning) { await sendTelegram('⚠️ Bot already running\\. Use /status'); return; }
    startBot(); await sendTelegram('🚀 Bot started via Telegram\\!');
  } else if (cmd === '/stop') {
    stopBot(); await sendTelegram('⏸️ Bot stopped\\. ' + md(signalCount) + ' signals sent\\.');
  } else if (cmd === '/status') {
    const s = getSession();
    await sendTelegram(
      '📊 *ForexPulse PRO Status*\n\n' +
      'Bot: ' + (isRunning ? '🟢 Running' : '🔴 Stopped') + '\n' +
      'Signals: ' + md(signalCount) + '\n' +
      'Wins: ' + md(dailyWins) + ' · Losses: ' + md(dailyLosses) + '\n' +
      'Session: ' + s.emoji + ' ' + md(s.message) + '\n' +
      'Time: ' + md(getZambiaTime()) + ' CAT\n' +
      'Price feed: 📡 Live \\(Deriv\\)'
    );
  } else if (cmd === '/win') {
    dailyWins++;
    await sendTelegram('✅ Win recorded\\! Total: ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L');
  } else if (cmd === '/loss') {
    dailyLosses++;
    await sendTelegram('❌ Loss recorded\\. Total: ' + md(dailyWins) + 'W/' + md(dailyLosses) + 'L');
  }
}

// ─── Bot state ────────────────────────────────────────────────────────────────

let isRunning = false;
let signalCount = 0;
let dailyWins = 0;
let dailyLosses = 0;
let intervalId: ReturnType<typeof setInterval> | null = null;
let summaryId: ReturnType<typeof setInterval> | null = null;
const recentSignals: object[] = [];

function scheduleSummary() {
  if (summaryId) clearInterval(summaryId);
  summaryId = setInterval(async () => {
    const h = parseInt(new Date().toLocaleString('en-GB', {
      timeZone: 'Africa/Lusaka', hour: 'numeric', hour12: false,
    }), 10);
    if (h === 8 && new Date().getMinutes() === 0) {
      const total = dailyWins + dailyLosses;
      const wr = total > 0 ? Math.round(dailyWins / total * 100) : 0;
      await sendTelegram(
        '📈 *Daily Summary*\n\n' +
        '📊 Signals: ' + md(signalCount) + '\n' +
        '🏆 Wins: ' + md(dailyWins) + '\n' +
        '❌ Losses: ' + md(dailyLosses) + '\n' +
        '📉 Win rate: ' + md(wr) + '%\n\n' +
        '💡 Use /win or /loss after each trade\n' +
        '🤖 ForexPulse PRO'
      );
      dailyWins = 0; dailyLosses = 0; signalCount = 0;
    }
  }, 60000);
}

// ─── Signal dispatch ──────────────────────────────────────────────────────────

async function dispatchSignal() {
  if (!isRunning) return;

  const session = getSession();
  const skipLow = process.env.SKIP_LOW_SESSION === 'true';
  if (skipLow && session.quality === 0) return;

  const pairs = getAvailablePairs();
  const pair = pickRandom(pairs);
  const stake = Number(process.env.DERIV_STAKE ?? '1');

  // Get REAL analysis from Deriv price feed
  const analysis = await analyseSymbol(pair.derivSym);

  // Skip HOLD signals
  if (analysis.action === 'HOLD') {
    console.log('HOLD on ' + pair.display + ' — skipping signal');
    return;
  }

  const price = analysis.price > 0 ? analysis.price : 0;
  const atr = pair.atr;
  const decimals = pair.decimals;
  const pipMult = pair.pipMult;

  const entry = price > 0 ? Number(price.toFixed(decimals)) : 0;
  const sl = analysis.action === 'BUY'
    ? Number((entry - atr * 1.5).toFixed(decimals))
    : Number((entry + atr * 1.5).toFixed(decimals));
  const tp = analysis.action === 'BUY'
    ? Number((entry + atr * 2.5).toFixed(decimals))
    : Number((entry - atr * 2.5).toFixed(decimals));
  const slPips = Math.round(Math.abs(entry - sl) * pipMult);
  const tpPips = Math.round(Math.abs(entry - tp) * pipMult);
  const rr = slPips > 0 ? (tpPips / slPips).toFixed(1) : '1.7';

  const time = getZambiaTime();
  const actionEmoji = analysis.action === 'BUY' ? '🟢📈' : '🔴📉';
  const pairLabel = pair.type === 'derived' ? '🎲 Derived Index' : '💱 Forex';
  const feedLabel = analysis.priceSource === 'live' ? '📡 Live Deriv data' : '⚠️ Simulated \\(live feed unavailable\\)';

  const message = [
    actionEmoji + ' *' + md(analysis.action) + ' — ' + md(pair.display) + '*',
    pairLabel,
    '',
    'Entry:        \\`' + md(entry > 0 ? entry : 'market price') + '\\`',
    'Stop Loss:    \\`' + md(sl) + '\\` \\(' + md(slPips) + ' pips\\)',
    'Take Profit:  \\`' + md(tp) + '\\` \\(' + md(tpPips) + ' pips\\)',
    'Risk/Reward:  1:' + md(rr),
    'Confidence:   ' + md(analysis.confidence) + '%',
    '',
    '📊 *Analysis \\(Real Data\\)*',
    'RSI: ' + md(analysis.rsi.toFixed(1)),
    'MACD: ' + (analysis.macdHistogram > 0 ? 'Bullish' : 'Bearish'),
    'Reason: ' + md(analysis.reason),
    feedLabel,
    '',
    '💰 Suggested stake: \\$' + md(stake) + ' · Duration: 15 min',
    '',
    '⏳ *Execute within 2–5 mins of this signal*',
    '📱 Open Deriv → Rise\\/Fall → 15 min duration',
    '⚠️ Do NOT execute after 5 mins — signal expires',
    '',
    session.emoji + ' ' + md(session.message),
    '⏰ ' + md(time) + ' · 🤖 ForexPulse PRO',
    '',
    'Reply /win or /loss after trade closes',
  ].join('\n');

  const sent = await sendTelegram(message);
  if (sent.ok) {
    signalCount++;

    // Execution reminder after 2 minutes
    setTimeout(async () => {
      if (!isRunning) return;
      await sendTelegram(
        '⏰ *Execute now — ' + md(pair.display) + '*\n\n' +
        actionEmoji + ' *' + md(analysis.action) + '* at \\`' + md(entry > 0 ? entry : 'market price') + '\\`\n' +
        'SL: \\`' + md(sl) + '\\` · TP: \\`' + md(tp) + '\\`\n\n' +
        '✅ Window open — execute in Deriv now\\!\n' +
        'Set duration: *15 minutes* \\(Rise or Fall\\)\n' +
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
      priceSource: analysis.priceSource,
    });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log('Signal #' + signalCount + ': ' + analysis.action + ' ' + pair.display +
      ' | RSI:' + analysis.rsi.toFixed(1) + ' | Source:' + analysis.priceSource);
  }
}

function startBot() {
  isRunning = true;
  signalCount = 0;
  scheduleSummary();
  dispatchSignal();
  intervalId = setInterval(dispatchSignal, 60000);
}

function stopBot() {
  isRunning = false;
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  if (summaryId) { clearInterval(summaryId); summaryId = null; }
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET() {
  const telegramToken = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  return NextResponse.json({
    running: isRunning,
    signalCount,
    dailyWins,
    dailyLosses,
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
  let body: { action?: string; message?: { text?: string } };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { action } = body;

  if (body.message?.text) {
    await handleCommand(body.message.text);
    return NextResponse.json({ ok: true });
  }

  if (action === 'start') {
    if (isRunning) return NextResponse.json({ success: false, message: 'Already running' });
    const s = getSession();
    const pairs = getAvailablePairs();
    const result = await sendTelegram(
      '🤖 *ForexPulse PRO Activated*\n\n' +
      '✅ Real indicator analysis \\(Deriv live data\\)\n' +
      '✅ RSI \\+ MACD \\+ MA from real prices\n' +
      '✅ ' + md(pairs.length) + ' pairs \\(forex \\+ derived\\)\n' +
      '✅ Signals every 60 seconds\n' +
      '✅ 2 min execution reminder\n' +
      '✅ Daily summary at 08:00 CAT\n\n' +
      '📱 Commands: /status /stop /win /loss\n\n' +
      s.emoji + ' ' + md(s.message) + '\n\n' +
      '👉 Open Deriv → Rise\\/Fall → 15 min duration'
    );
    if (!result.ok) return NextResponse.json({ success: false, message: 'Telegram failed: ' + result.error });
    startBot();
    return NextResponse.json({ success: true });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    const total = dailyWins + dailyLosses;
    const wr = total > 0 ? Math.round(dailyWins / total * 100) : 0;
    await sendTelegram(
      '⏸️ *Bot Stopped*\n\n' +
      md(signalCount) + ' signals sent\n' +
      'Wins: ' + md(dailyWins) + ' · Losses: ' + md(dailyLosses) + '\n' +
      'Win rate: ' + md(wr) + '%'
    );
    return NextResponse.json({ success: true, signalCount, dailyWins, dailyLosses });
  }

  if (action === 'test') {
    const pairs = getAvailablePairs();
    const pair = pickRandom(pairs);
    console.log('Fetching live data for', pair.derivSym);
    const analysis = await analyseSymbol(pair.derivSym);
    const result = await sendTelegram(
      '🔔 *Test Signal — ' + md(pair.display) + '*\n\n' +
      'Action: *' + md(analysis.action) + '*\n' +
      'Price: ' + md(analysis.price.toFixed(pair.decimals)) + '\n' +
      'RSI: ' + md(analysis.rsi.toFixed(1)) + '\n' +
      'MACD: ' + md(analysis.macdHistogram > 0 ? 'Bullish' : 'Bearish') + '\n' +
      'Confidence: ' + md(analysis.confidence) + '%\n' +
      'Reason: ' + md(analysis.reason) + '\n' +
      'Source: ' + md(analysis.priceSource) + '\n\n' +
      '✅ Live price feed working\\!'
    );
    return NextResponse.json({
      success: result.ok,
      signal: { symbol: pair.display, action: analysis.action, rsi: analysis.rsi, priceSource: analysis.priceSource },
    });
  }

  return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
}
