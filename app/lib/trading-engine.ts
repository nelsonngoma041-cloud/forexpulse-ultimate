// app/lib/trading-engine.ts

export interface MarketData {
  symbol: string;
  price: number;
  volume: number;
  high: number;
  low: number;
  change: number;
  changePercent: number;
}

export interface TechnicalIndicators {
  rsi: number;
  macd: {
    value: number;
    signal: number;
    histogram: number;
  };
  ma50: number;
  ma200: number;
  support: number;
  resistance: number;
}

export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-100
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

class ProfessionalTradingEngine {
  private priceHistory: Map<string, number[]> = new Map();
  private lastSignals: Map<string, Date> = new Map();

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
    return {
      value: macd,
      signal: signal,
      histogram: macd - signal
    };
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
    return recent.reduce((a, b) => a + b, 0) / period;
  }

  private findSupportResistance(prices: number[]): { support: number; resistance: number } {
    const recentLow = Math.min(...prices.slice(-20));
    const recentHigh = Math.max(...prices.slice(-20));
    return {
      support: recentLow,
      resistance: recentHigh
    };
  }

  analyze(symbol: string, currentPrice: number): TradeSignal {
    const prices = this.priceHistory.get(symbol) || [];
    if (prices.length < 50) {
      return {
        symbol,
        action: 'HOLD',
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99,
        takeProfit: currentPrice * 1.02,
        reason: 'Collecting data...',
        indicators: { rsi: 'N/A', macd: 'N/A', trend: 'N/A' }
      };
    }

    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const ma50 = this.calculateMA(prices, 50);
    const ma200 = this.calculateMA(prices, 200);
    const { support, resistance } = this.findSupportResistance(prices);
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    let rsiSignal = '';
    let macdSignal = '';
    let trendSignal = '';

    // RSI Analysis
    if (rsi < 30) {
      rsiSignal = `Oversold (RSI: ${rsi.toFixed(1)})`;
      confidence += 30;
    } else if (rsi > 70) {
      rsiSignal = `Overbought (RSI: ${rsi.toFixed(1)})`;
      confidence += 30;
    } else {
      rsiSignal = `Neutral (RSI: ${rsi.toFixed(1)})`;
    }

    // MACD Analysis
    if (macd.histogram > 0 && macd.value > macd.signal) {
      macdSignal = `Bullish crossover`;
      confidence += 35;
    } else if (macd.histogram < 0 && macd.value < macd.signal) {
      macdSignal = `Bearish crossover`;
      confidence += 35;
    } else {
      macdSignal = `No clear signal`;
    }

    // Trend Analysis
    if (currentPrice > ma50 && ma50 > ma200) {
      trendSignal = `Strong uptrend`;
      confidence += 20;
      action = 'BUY';
    } else if (currentPrice < ma50 && ma50 < ma200) {
      trendSignal = `Strong downtrend`;
      confidence += 20;
      action = 'SELL';
    } else {
      trendSignal = `Sideways market`;
    }

    // Support/Resistance
    if (currentPrice <= support * 1.002) {
      reason = `Price near support level. ${rsiSignal}. ${macdSignal}. ${trendSignal}`;
      action = action === 'HOLD' ? 'BUY' : action;
      confidence += 15;
    } else if (currentPrice >= resistance * 0.998) {
      reason = `Price near resistance level. ${rsiSignal}. ${macdSignal}. ${trendSignal}`;
      action = action === 'HOLD' ? 'SELL' : action;
      confidence += 15;
    } else {
      reason = `${rsiSignal}. ${macdSignal}. ${trendSignal}`;
    }

    // Final decision
    if (action === 'BUY' && confidence > 50) {
      const volatility = (resistance - support) / currentPrice;
      const stopLoss = currentPrice * (1 - Math.min(0.02, volatility * 1.5));
      const takeProfit = currentPrice * (1 + Math.min(0.04, volatility * 2));
      
      return {
        symbol,
        action: 'BUY',
        confidence: Math.min(confidence, 95),
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        reason,
        indicators: { rsi: rsiSignal, macd: macdSignal, trend: trendSignal }
      };
    } else if (action === 'SELL' && confidence > 50) {
      const volatility = (resistance - support) / currentPrice;
      const stopLoss = currentPrice * (1 + Math.min(0.02, volatility * 1.5));
      const takeProfit = currentPrice * (1 - Math.min(0.04, volatility * 2));
      
      return {
        symbol,
        action: 'SELL',
        confidence: Math.min(confidence, 95),
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        reason,
        indicators: { rsi: rsiSignal, macd: macdSignal, trend: trendSignal }
      };
    }

    return {
      symbol,
      action: 'HOLD',
      confidence,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.99,
      takeProfit: currentPrice * 1.02,
      reason: `No clear signal. ${rsiSignal}. ${macdSignal}. ${trendSignal}`,
      indicators: { rsi: rsiSignal, macd: macdSignal, trend: trendSignal }
    };
  }

  getMarketSummary(): string {
    const summary = [];
    for (const [symbol, prices] of this.priceHistory) {
      if (prices.length > 0) {
        const currentPrice = prices[prices.length - 1];
        const ma50 = this.calculateMA(prices, 50);
        const trend = currentPrice > ma50 ? 'Bullish' : 'Bearish';
        summary.push(`${symbol}: ${trend} at ${currentPrice.toFixed(5)}`);
      }
    }
    return summary.join('\n');
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
