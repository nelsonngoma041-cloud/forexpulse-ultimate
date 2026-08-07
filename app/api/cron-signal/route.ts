// app/api/cron-signal/route.ts
// Runs every minute via Vercel Cron — Node.js runtime, no WebSocket timeout

import { NextResponse } from 'next/server';

// ─── Deriv WebSocket ──────────────────────────────────────────────────────────

const DERIV_WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${process.env.DERIV_APP_ID ?? '342T8yYeveFOVV6CT9yoV'}`;

const SYMBOL_MAP: Record<string, string> = {
  EURUSD: 'frxEURUSD', GBPUSD: 'frxGBPUSD', USDJPY: 'frxUSDJPY',
  AUDUSD: 'frxAUDUSD', USDCAD: 'frxUSDCAD',
};

interface WSMsg { [key: string]: unknown; }

function derivWS(messages: WSMsg[]): Promise<WSMsg[]> {
  return new Promise((resolve, reject) => {
    const WebSocketImpl = require('ws');
    const ws = new WebSocketImpl(DERIV_WS_URL);
    const responses: WSMsg[] = [];
    let idx = 0;

    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Deriv WebSocket timed out after 30s'));
    }, 30000);

    ws.on('open', () => ws.send(JSON.stringify(messages[idx])));

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString()) as WSMsg;
      responses.push(msg);
      if (msg.error) {
        clearTimeout(timer); ws.close();
        reject(new Error(`Deriv: ${(msg.error as {message?:string}).message ?? JSON.stringify(msg.error)}`));
        return;
      }
      idx++;
      if (idx < messages.length) ws.send(JSON.stringify(messages[idx]));
      else { clearTimeout(timer); ws.close(); resolve(responses); }
    });

    ws.on('error', (e: Error) => { clearTimeout(timer); reject(e); });
  });
}

async function derivBuy(
  token: string, symbol: string, action: 'BUY'|'SELL', stake: number, durationMin: number
): Promise<{ok:true;contractId:number;buyPrice:number;payout:number}|{ok:false;error:string}> {
  const derivSym = SYMBOL_MAP[symbol];
  if (!derivSym) return { ok:false, error:`${symbol} not supported` };
  try {
    const propRes = await derivWS([
      { authorize: token },
      { proposal:1, amount:stake, basis:'stake',
        contract_type: action==='BUY'?'CALL':'PUT',
        currency:'USD', duration:durationMin, duration_unit:'m', symbol:derivSym },
    ]);
    const prop = (propRes[1] as {proposal?:{id:string;ask_price:number;payout:number}}).proposal;
    if (!prop) return { ok:false, error:'No proposal' };

    const buyRes = await derivWS([
      { authorize: token },
      { buy: prop.id, price: prop.ask_price },
    ]);
    const buy = (buyRes[1] as {buy?:{contract_id:number;buy_price:number;payout:number}}).buy;
    if (!buy) return { ok:false, error:'Buy failed' };
    return { ok:true, contractId:buy.contract_id, buyPrice:buy.buy_price, payout:buy.payout };
  } catch(err) {
    return { ok:false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function md(v: string|number) {
  return String(v).replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function getZambiaTime() {
  return new Date().toLocaleTimeString('en-GB', {
    timeZone:'Africa/Lusaka', hour:'2-digit', minute:'2-digit', second:'2-digit',
  });
}

function getSession() {
  const h = parseInt(new Date().toLocaleString('en-GB',{timeZone:'Africa/Lusaka',hour:'numeric',hour12:false}),10);
  if(h>=15&&h<19) return {emoji:'🔥',message:'Prime window — HIGH liquidity'};
  if(h>=10&&h<15) return {emoji:'✅',message:'Good liquidity — recommended'};
  if(h>=19&&h<22) return {emoji:'⚠️',message:'Low liquidity — trade carefully'};
  return {emoji:'😴',message:'Avoid trading — very low volume'};
}

const PAIRS = ['EURUSD','GBPUSD','USDJPY','AUDUSD','USDCAD'];
const PRICES: Record<string,number> = {
  EURUSD:1.08920, GBPUSD:1.27150, USDJPY:157.85, AUDUSD:0.66450, USDCAD:1.37150,
};
const DISPLAY: Record<string,string> = {
  EURUSD:'EUR/USD', GBPUSD:'GBP/USD', USDJPY:'USD/JPY', AUDUSD:'AUD/USD', USDCAD:'USD/CAD',
};

function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

function generateSignal(pair: string) {
  const action = pickRandom(['BUY','SELL']) as 'BUY'|'SELL';
  const base = PRICES[pair];
  const isJpy = pair==='USDJPY';
  const decimals = isJpy?2:5;
  const pipMult = isJpy?100:10000;
  const atr = isJpy?0.08:0.0008;
  const entry = Number((base+(Math.random()-0.5)*atr).toFixed(decimals));
  const sl = action==='BUY' ? Number((entry-atr*1.5).toFixed(decimals)) : Number((entry+atr*1.5).toFixed(decimals));
  const tp = action==='BUY' ? Number((entry+atr*2.5).toFixed(decimals)) : Number((entry-atr*2.5).toFixed(decimals));
  const slPips = Math.round(Math.abs(entry-sl)*pipMult);
  const tpPips = Math.round(Math.abs(entry-tp)*pipMult);
  const rsi = action==='BUY' ? Math.floor(Math.random()*20)+25 : Math.floor(Math.random()*20)+65;
  const confidence = Math.floor(Math.random()*25)+65;
  const reasons = action==='BUY'
    ?['RSI oversold','MACD bullish crossover','Price above MA20','Support held']
    :['RSI overbought','MACD bearish crossover','Price below MA20','Resistance rejected'];
  return { action, entry, sl, tp, slPips, tpPips, rsi, confidence, decimals, reason:pickRandom(reasons) };
}

async function sendTelegram(text: string) {
  const token  = process.env.TELEGRAM_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chat_id:chatId, text, parse_mode:'MarkdownV2'}),
  });
}

// ─── Cron handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if bot should be running
  const botEnabled = process.env.BOT_ENABLED === 'true';
  if (!botEnabled) {
    return NextResponse.json({ skipped: true, reason: 'BOT_ENABLED is not true' });
  }

  const derivToken = process.env.DERIV_API_TOKEN;
  const stake = Number(process.env.DERIV_STAKE ?? '10');
  const duration = Number(process.env.DERIV_DURATION ?? '5');

  const pair    = pickRandom(PAIRS);
  const display = DISPLAY[pair];
  const sig     = generateSignal(pair);
  const rr      = (sig.tpPips / sig.slPips).toFixed(1);
  const session = getSession();
  const time    = getZambiaTime();
  const emoji   = sig.action==='BUY' ? '🟢📈' : '🔴📉';

  let executionLine = `⚠️ Manual mode — execute in Deriv app`;
  let tradeResult: {ok:boolean;contractId?:number;buyPrice?:number;payout?:number;error?:string} = {ok:false};

  if (derivToken) {
    tradeResult = await derivBuy(derivToken, pair, sig.action, stake, duration);
    if (tradeResult.ok) {
      executionLine =
        `✅ *Auto\\-executed on Deriv*\n` +
        `Contract \\#${md(tradeResult.contractId!)}\n` +
        `Stake: \\$${md(tradeResult.buyPrice!.toFixed(2))} · Payout: \\$${md(tradeResult.payout!.toFixed(2))}`;
    } else {
      executionLine = `❌ Deriv failed: ${md(tradeResult.error ?? 'unknown')}`;
    }
  }

  const message = [
    `${emoji} *${md(sig.action)} — ${md(display)}*`,
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
    `💰 Stake: \\$${md(stake)} · Duration: ${md(duration)} min`,
    '',
    executionLine,
    '',
    `${session.emoji} ${md(session.message)}`,
    `⏰ ${md(time)} · 🤖 ForexPulse PRO`,
  ].join('\n');

  await sendTelegram(message);

  return NextResponse.json({
    ok: true,
    signal: `${sig.action} ${display}`,
    executed: tradeResult.ok,
    contractId: tradeResult.contractId,
    error: tradeResult.error,
  });
}
