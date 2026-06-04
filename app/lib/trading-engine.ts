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
    rsi: string;
    macd: string;
    trend: string;
  };
}

export class ProfessionalTradingEngine {
  private priceHistory: Map<string, number[]> = new Map();

  addPrice(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    if (history.length > 200) history.shift();
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    let gains = 0, losses = 0;
    const recentPrices = prices.slice(-period - 1);
    for (let i = 1; i < recentPrices.length; i++) {
      const change = recentPrices[i] - recentPrices[i-1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    return { value: macd, signal: signal, histogram: macd - signal };
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  private calculateMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const recent = prices.slice(-period);
    let sum = 0;
    for (let i = 0; i < recent.length; i++) {
      sum += recent[i];
    }
    return sum / period;
  }

  analyze(symbol: string, currentPrice: number): TradeSignal {
    const prices = this.priceHistory.get(symbol) || [];
    if (prices.length < 50) {
      return {
        symbol, action: 'HOLD', confidence: 0, entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99, takeProfit: currentPrice * 1.02,
        reason: 'Collecting data...',
        indicators: { rsi: 'N/A', macd: 'N/A', trend: 'N/A' }
      };
    }

    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const ma50 = this.calculateMA(prices, 50);
    const ma200 = this.calculateMA(prices, 200);
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    let rsiSignal = '';
    let macdSignal = '';

    if (rsi < 30) {
      rsiSignal = `Oversold (RSI: ${rsi.toFixed(1)})`;
      confidence += 35;
      action = 'BUY';
    } else if (rsi > 70) {
      rsiSignal = `Overbought (RSI: ${rsi.toFixed(1)})`;
      confidence += 35;
      action = 'SELL';
    } else {
      rsiSignal = `Neutral (RSI: ${rsi.toFixed(1)})`;
    }

    if (macd.histogram > 0 && macd.value > macd.signal) {
      macdSignal = `Bullish crossover`;
      confidence += 35;
      if (action === 'HOLD') action = 'BUY';
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      macdSignal = `Bearish crossover`;
      confidence += 35;
      if (action === 'HOLD') action = 'SELL';
    } else {
      macdSignal = `No clear signal`;
    }

    // Trend confirmation
    if (currentPrice > ma50 && ma50 > ma200) {
      if (action === 'BUY') confidence += 15;
      reason = `${rsiSignal}. ${macdSignal}. Strong uptrend.`;
    } else if (currentPrice < ma50 && ma50 < ma200) {
      if (action === 'SELL') confidence += 15;
      reason = `${rsiSignal}. ${macdSignal}. Strong downtrend.`;
    } else {
      reason = `${rsiSignal}. ${macdSignal}. Sideways market.`;
    }

    if (action === 'BUY' && confidence >= 50) {
      return {
        symbol, action: 'BUY', confidence: Math.min(confidence, 95),
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99,
        takeProfit: currentPrice * 1.02,
        reason,
        indicators: { rsi: rsiSignal, macd: macdSignal, trend: 'Bullish' }
      };
    } else if (action === 'SELL' && confidence >= 50) {
      return {
        symbol, action: 'SELL', confidence: Math.min(confidence, 95),
        entryPrice: currentPrice,
        stopLoss: currentPrice * 1.01,
        takeProfit: currentPrice * 0.98,
        reason,
        indicators: { rsi: rsiSignal, macd: macdSignal, trend: 'Bearish' }
      };
    }

    return {
      symbol, action: 'HOLD', confidence,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.99,
      takeProfit: currentPrice * 1.02,
      reason,
      indicators: { rsi: rsiSignal, macd: macdSignal, trend: 'Neutral' }
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
