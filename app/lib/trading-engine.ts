// app/lib/trading-engine.ts

export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  indicators: {
    rsi: number;
    macdHistogram: number;
    price_vs_ma20: 'above' | 'below';
    ma_trend: 'up' | 'down' | 'flat';
  };
  agreeingStrategies: string[];
}

// Per-pair ATR approximations (realistic average daily pip ranges / 10 for hourly)
const PAIR_ATR: Record<string, number> = {
  'EURUSD': 0.0008,
  'GBPUSD': 0.0010,
  'USDJPY': 0.08,
  'AUDUSD': 0.0007,
  'USDCAD': 0.0008,
};

// Pip multiplier for position sizing and SL/TP display
const PIP_MULTIPLIER: Record<string, number> = {
  'EURUSD': 10000,
  'GBPUSD': 10000,
  'USDJPY': 100,
  'AUDUSD': 10000,
  'USDCAD': 10000,
};

export function getPipMultiplier(symbol: string): number {
  return PIP_MULTIPLIER[symbol] ?? 10000;
}

export function getDecimals(symbol: string): number {
  return symbol === 'USDJPY' ? 2 : 5;
}

// ─── Indicator Math ────────────────────────────────────────────────────────────

function calculateEMA(prices: number[], period: number): number {
  if (prices.length === 0) return 0;
  if (prices.length < period) return prices[prices.length - 1];

  const k = 2 / (period + 1);
  // Seed with SMA of first `period` values
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50;

  // Wilder's smoothed RSI
  let gains = 0;
  let losses = 0;

  // Initial averages
  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// MACD with proper signal line history
// Returns current histogram and previous histogram so we can detect crossovers
function calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number; prevHistogram: number } {
  if (prices.length < 35) return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };

  // Build a mini history of MACD values to compute the 9-period signal EMA
  const macdHistory: number[] = [];
  // We need at least 9 MACD values → need prices from index 25 onward
  const startIdx = Math.max(26, prices.length - 40);

  for (let i = startIdx; i <= prices.length; i++) {
    const slice = prices.slice(0, i);
    if (slice.length < 26) continue;
    const m = calculateEMA(slice, 12) - calculateEMA(slice, 26);
    macdHistory.push(m);
  }

  if (macdHistory.length < 2) return { macd: 0, signal: 0, histogram: 0, prevHistogram: 0 };

  const currentMacd = macdHistory[macdHistory.length - 1];
  const prevMacd = macdHistory[macdHistory.length - 2];

  const signalLine = calculateEMA(macdHistory, 9);
  // Approximate prev signal using history minus last point
  const prevSignalLine = macdHistory.length > 9
    ? calculateEMA(macdHistory.slice(0, -1), 9)
    : signalLine;

  return {
    macd: currentMacd,
    signal: signalLine,
    histogram: currentMacd - signalLine,
    prevHistogram: prevMacd - prevSignalLine,
  };
}

function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] ?? 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ─── Engine ────────────────────────────────────────────────────────────────────

export class ProfessionalTradingEngine {
  private priceHistory: Map<string, number[]> = new Map();

  addPrice(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    if (history.length > 200) history.shift(); // keep rolling 200-bar window
  }

  getHistory(symbol: string): number[] {
    return this.priceHistory.get(symbol) ?? [];
  }

  analyze(symbol: string, currentPrice: number): TradeSignal {
    const prices = this.priceHistory.get(symbol) ?? [];

    const atr = PAIR_ATR[symbol] ?? 0.0008;

    // Need at least 35 bars for MACD (26 EMA + 9 signal seed)
    if (prices.length < 35) {
      return {
        symbol,
        action: 'HOLD',
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: currentPrice - atr * 1.5,
        takeProfit: currentPrice + atr * 2.5,
        reason: `Collecting data — ${prices.length}/35 bars`,
        indicators: { rsi: 50, macdHistogram: 0, price_vs_ma20: 'above', ma_trend: 'flat' },
        agreeingStrategies: [],
      };
    }

    const rsi = calculateRSI(prices);
    const { histogram, prevHistogram } = calculateMACD(prices);
    const ma20 = calculateSMA(prices, 20);
    const ma50 = calculateSMA(prices, Math.min(50, prices.length));

    let buyScore = 0;
    let sellScore = 0;
    const agreeing: string[] = [];

    // ── RSI (weight 35) ────────────────────────────────────────────────────────
    if (rsi < 35) {
      buyScore += 35;
      agreeing.push(`RSI ${rsi.toFixed(1)} — oversold`);
    } else if (rsi > 65) {
      sellScore += 35;
      agreeing.push(`RSI ${rsi.toFixed(1)} — overbought`);
    } else if (rsi < 50) {
      buyScore += 10;
    } else {
      sellScore += 10;
    }

    // ── MACD histogram crossover (weight 35) ───────────────────────────────────
    const macdCrossedBullish = prevHistogram <= 0 && histogram > 0;
    const macdCrossedBearish = prevHistogram >= 0 && histogram < 0;

    if (macdCrossedBullish) {
      buyScore += 35;
      agreeing.push(`MACD bullish crossover`);
    } else if (macdCrossedBearish) {
      sellScore += 35;
      agreeing.push(`MACD bearish crossover`);
    } else if (histogram > 0) {
      buyScore += 15;
      agreeing.push(`MACD bullish momentum`);
    } else if (histogram < 0) {
      sellScore += 15;
      agreeing.push(`MACD bearish momentum`);
    }

    // ── Price vs MA20 (weight 20) ──────────────────────────────────────────────
    const priceVsMa20: 'above' | 'below' = currentPrice > ma20 ? 'above' : 'below';
    if (currentPrice > ma20) {
      buyScore += 20;
      agreeing.push(`Price above MA20`);
    } else {
      sellScore += 20;
      agreeing.push(`Price below MA20`);
    }

    // ── MA trend (weight 10) ───────────────────────────────────────────────────
    const maTrend: 'up' | 'down' | 'flat' =
      ma20 > ma50 * 1.0001 ? 'up' :
      ma20 < ma50 * 0.9999 ? 'down' : 'flat';

    if (maTrend === 'up') {
      buyScore += 10;
    } else if (maTrend === 'down') {
      sellScore += 10;
    }

    // ── Decision ───────────────────────────────────────────────────────────────
    const total = buyScore + sellScore;
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    if (buyScore > sellScore && buyScore >= 35) {
      action = 'BUY';
      confidence = Math.min(Math.round((buyScore / total) * 100), 94);
    } else if (sellScore > buyScore && sellScore >= 35) {
      action = 'SELL';
      confidence = Math.min(Math.round((sellScore / total) * 100), 94);
    }

    // ── SL / TP using real per-pair ATR ────────────────────────────────────────
    const slDistance = atr * 1.5;
    const tpDistance = atr * 2.5;

    const stopLoss =
      action === 'BUY'  ? currentPrice - slDistance :
      action === 'SELL' ? currentPrice + slDistance :
      currentPrice - slDistance; // HOLD: show levels anyway

    const takeProfit =
      action === 'BUY'  ? currentPrice + tpDistance :
      action === 'SELL' ? currentPrice - tpDistance :
      currentPrice + tpDistance;

    const decimals = getDecimals(symbol);

    return {
      symbol,
      action,
      confidence,
      entryPrice: Number(currentPrice.toFixed(decimals)),
      stopLoss:   Number(stopLoss.toFixed(decimals)),
      takeProfit: Number(takeProfit.toFixed(decimals)),
      reason: agreeing.slice(0, 3).join(' · ') || 'No consensus — holding',
      indicators: {
        rsi,
        macdHistogram: histogram,
        price_vs_ma20: priceVsMa20,
        ma_trend: maTrend,
      },
      agreeingStrategies: agreeing,
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
