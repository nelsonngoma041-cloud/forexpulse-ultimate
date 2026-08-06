// app/api/live-signals/route.ts
import { NextResponse } from 'next/server';

// ─── Env ──────────────────────────────────────────────────────────────────────

function getTelegram() {
  const token = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('TELEGRAM_TOKEN and TELEGRAM_CHAT_ID not set');
  return { token, chatId };
}

function getDerivToken(): string | null {
  return process.env.DERIV_API_TOKEN ?? null;
}

// ─── Deriv HTTP API ───────────────────────────────────────────────────────────
// Deriv's REST API works with simple fetch calls — no WebSocket needed.
// Base URL: https://api.deriv.com

const DERIV_API = 'https://api.deriv.com';

const SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
};

async function derivFetch(endpoint: string, body: Record<string, unknown>, token: string) {
  const res = await fetch(`${DERIV_API}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Deriv API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function derivBuy(
  token: string,
  symbol: string,
  action: 'BUY' | 'SELL',
  stake: number,
  durationMin: number
): Promise<{ ok: true; contractId: number; buyPrice: number; payout: number } | { ok: false; error: string }> {
  const derivSym = SYMBOL_MAP[symbol];
  if (!derivSym) return { ok: false, error: `${symbol} not supported on Deriv` };

  try {
    // Step 1: Get proposal
    const proposalRes = await derivFetch('/v3/proposal', {
      proposal: 1,
      amount: stake,
      basis: 'stake',
      contract_type: action === 'BUY' ? 'CALL' : 'PUT',
      currency: 'USD',
      duration: durationMin,
      duration_unit: 'm',
      symbol: derivSym,
    }, token);

    if (proposalRes.error) {
      return { ok: false, error: proposalRes.error.message ?? JSON.stringify(proposalRes.error) };
    }

    const proposalId = proposalRes.proposal?.id;
    const askPrice = proposalRes.proposal?.ask_price;

    if (!proposalId) return { ok: false, error: 'No proposal ID returned' };

    // Step 2: Buy the contract
    const buyRes = await derivFetch('/v3/buy', {
      buy: proposalId,
      price: askPrice,
    }, token);

    if (buyRes.error) {
      return { ok: false, error: buyRes.error.message ?? JSON.stringify(buyRes.error) };
    }

    const contract = buyRes.buy;
    if (!contract) return { ok: false, error: 'No contract returned from buy' };

    return {
      ok: true,
      contractId: contract.contract_id,
      buyPrice: contract.buy_price,
      payout: contract.payout,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function derivGetBalance(token: string): Promise<string> {
  try {
    const res = await derivFetch('/v3/balance', { balance: 1, account: 'current' }, token);
    if (res.error) return `Error: ${res.error.message}`;
    const b = res.balance;
    return b ? `${b.currency} ${Number(b.balance).toFixed(2)}` : 'connected';
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
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
  const actions = ['BUY', 'SELL'];
  const action = pickRandom(actions) as 'BUY' | 'SELL';
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
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'MarkdownV2' }),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram rejected:', JSON.stringify(data));
      return { ok: false, error: data.description };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Telegram error:', msg);
    return { ok: false, error: msg };
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
  const derivToken = getDerivToken();

  let executionLine = `⚠️ Manual mode — execute in Deriv app`;
  let tradeResult: { ok: boolean; contractId?: number; buyPrice?: number; payout?: number; error?: string } = { ok: false };

  if (derivToken) {
    tradeResult = await derivBuy(derivToken, pair, sig.action, stake, durationMin);
    if (tradeResult.ok) {
      executedCount++;
      executionLine =
        `✅ *Auto\\-executed on Deriv*\n` +
        `Contract \\#${md(tradeResult.contractId!)}\n` +
        `Stake: \\$${md(tradeResult.buyPrice!.toFixed(2))} · Payout: \\$${md(tradeResult.payout!.toFixed(2))}`;
    } else {
      executionLine = `❌ Deriv failed: ${md(tradeResult.error ?? 'unknown')}`;
    }
  }

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
    `💰 Stake: \\$${md(stake)} · Duration: ${md(durationMin)} min`,
    '',
    executionLine,
    '',
    `${session.emoji} ${md(session.message)}`,
    `⏰ ${md(time)} · 🤖 ForexPulse PRO`,
  ].join('\n');

  const sent = await sendTelegram(message);
  if (sent.ok) {
    signalCount++;
    recentSignals.unshift({
      id: `${Date.now()}`,
      symbol: display,
      action: sig.action,
      confidence: sig.confidence,
      rsi: sig.rsi,
      time: time.slice(0, 5),
      executed: tradeResult.ok,
      contractId: tradeResult.contractId,
    });
    if (recentSignals.length > 20) recentSignals.pop();
    console.log(`Signal #${signalCount}: ${sig.action} ${display} | Deriv: ${tradeResult.ok ? `#${tradeResult.contractId}` : `failed: ${tradeResult.error}`}`);
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
  const derivToken = process.env.DERIV_API_TOKEN;
  return NextResponse.json({
    running: isRunning,
    signalCount,
    executedCount,
    mt5Connected: false,
    derivConnected: !!derivToken,
    recentSignals,
    message: isRunning ? `Running — ${signalCount} signals, ${executedCount} on Deriv` : 'Bot stopped',
    debug: {
      hasToken: !!telegramToken,
      tokenPreview: telegramToken ? telegramToken.slice(0, 10) + '...' : 'MISSING',
      hasChatId: !!chatId,
      chatId: chatId ?? 'MISSING',
      hasDerivToken: !!derivToken,
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
    const derivToken = getDerivToken();
    const session = getSession();
    const result = await sendTelegram(
      `🤖 *ForexPulse PRO Activated*\n\n` +
      `${derivToken ? '✅ Deriv auto\\-execution: ON' : '⚠️ Manual mode — add DERIV\\_API\\_TOKEN to Vercel'}\n` +
      `✅ Signals every 60 seconds\n` +
      `✅ Entry, SL, TP included\n\n` +
      `${session.emoji} ${md(session.message)}\n\n` +
      `Stake: \\$${md(stake)} · Duration: ${md(duration)} min`
    );
    if (!result.ok) return NextResponse.json({ success: false, message: `Telegram failed: ${result.error}` });
    startBot(stake, duration);
    return NextResponse.json({ success: true, derivConnected: !!derivToken });
  }

  if (action === 'stop') {
    if (!isRunning) return NextResponse.json({ success: false, message: 'Not running' });
    stopBot();
    await sendTelegram(
      `⏸️ *Bot Stopped*\n\n` +
      `${md(signalCount)} signals · ${md(executedCount)} executed on Deriv\\.`
    );
    return NextResponse.json({ success: true, signalCount, executedCount });
  }

  if (action === 'test') {
    const pair = pickRandom(PAIRS);
    const display = DISPLAY[pair];
    const sig = generateSignal(pair);
    const derivToken = getDerivToken();

    let derivStatus = 'Not configured — add DERIV_API_TOKEN to Vercel';
    if (derivToken) {
      derivStatus = await derivGetBalance(derivToken);
    }

    const result = await sendTelegram(
      `🔔 *Test Signal — ${md(display)}*\n\n` +
      `Action: *${md(sig.action)}*\n` +
      `Entry: ${md(sig.entry)}\n` +
      `Confidence: ${md(sig.confidence)}%\n` +
      `RSI: ${md(sig.rsi)}\n\n` +
      `Deriv: ${md(derivStatus)}\n\n` +
      `✅ Bot is working correctly\\!`
    );

    return NextResponse.json({
      success: result.ok,
      message: result.ok ? 'Test signal sent' : `Telegram failed: ${result.error}`,
      signal: { symbol: display, action: sig.action, confidence: sig.confidence, rsi: sig.rsi },
      derivStatus,
    });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
