// app/lib/trading-engine.ts - Professional Version with Multi-Strategy Confirmation

export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  agreeingStrategies: string[];
  indicators: {
    rsi: { value: number; signal: string };
    macd: { value: number; signal: string; histogram: number };
    ma: { trend: string; pricePosition: string };
    supportResistance: { support: number; resistance: number; signal: string };
  };
}

interface StrategyResult {
  name: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reason: string;
  weight: number;
}

export class ProfessionalTradingEngine {
  private priceHistory: Map<string, number[]> = new Map();
  private highTimeframeHistory: Map<string, number[]> = new Map();
  
  // Strategy weights
  private readonly STRATEGIES = [
    { name: 'RSI', weight: 30, minConfidence: 30 },
    { name: 'MACD', weight: 25, minConfidence: 25 },
    { name: 'Moving Average', weight: 20, minConfidence: 20 },
    { name: 'Support/Resistance', weight: 15, minConfidence: 15 },
    { name: 'Momentum', weight: 10, minConfidence: 10 }
  ];

  addPrice(symbol: string, price: number, timeframe: '1min' | '5min' = '1min'): void {
    const history = timeframe === '1min' ? this.priceHistory : this.highTimeframeHistory;
    
    if (!history.has(symbol)) {
      history.set(symbol, []);
    }
    const prices = history.get(symbol)!;
    prices.push(price);
    
    // Keep last 200 candles
    if (prices.length > 200) prices.shift();
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

  private calculateATR(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 0.001;
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      sum += Math.abs(prices[i] - prices[i-1]);
    }
    return sum / period;
  }

  // Strategy 1: RSI Analysis
  private analyzeRSI(prices: number[]): StrategyResult {
    const rsi = this.calculateRSI(prices);
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    
    if (rsi < 25) {
      action = 'BUY';
      confidence = 40;
      reason = `Strongly oversold (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi < 30) {
      action = 'BUY';
      confidence = 30;
      reason = `Oversold (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi > 75) {
      action = 'SELL';
      confidence = 40;
      reason = `Strongly overbought (RSI: ${rsi.toFixed(1)})`;
    } else if (rsi > 70) {
      action = 'SELL';
      confidence = 30;
      reason = `Overbought (RSI: ${rsi.toFixed(1)})`;
    } else {
      reason = `Neutral (RSI: ${rsi.toFixed(1)})`;
    }
    
    return { name: 'RSI', action, confidence, reason, weight: 30 };
  }

  // Strategy 2: MACD Analysis
  private analyzeMACD(prices: number[]): StrategyResult {
    const macd = this.calculateMACD(prices);
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    
    if (macd.histogram > 0.0002 && macd.value > macd.signal) {
      action = 'BUY';
      confidence = 35;
      reason = `Strong bullish crossover (Histogram: ${macd.histogram.toFixed(5)})`;
    } else if (macd.histogram < -0.0002 && macd.value < macd.signal) {
      action = 'SELL';
      confidence = 35;
      reason = `Strong bearish crossover (Histogram: ${macd.histogram.toFixed(5)})`;
    } else if (macd.histogram > 0) {
      confidence = 15;
      reason = `Bullish momentum building (Histogram: ${macd.histogram.toFixed(5)})`;
    } else if (macd.histogram < 0) {
      confidence = 15;
      reason = `Bearish momentum building (Histogram: ${macd.histogram.toFixed(5)})`;
    } else {
      reason = `No clear MACD signal`;
    }
    
    return { name: 'MACD', action, confidence, reason, weight: 25 };
  }

  // Strategy 3: Moving Average Analysis
  private analyzeMovingAverages(prices: number[], currentPrice: number): StrategyResult {
    const ma20 = this.calculateMA(prices, 20);
    const ma50 = this.calculateMA(prices, 50);
    const ma200 = this.calculateMA(prices, 200);
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    
    const isUptrend = currentPrice > ma20 && ma20 > ma50 && ma50 > ma200;
    const isDowntrend = currentPrice < ma20 && ma20 < ma50 && ma50 < ma200;
    
    if (isUptrend) {
      action = 'BUY';
      confidence = 30;
      reason = `Strong uptrend (Price above MA20, MA20 above MA50)`;
    } else if (isDowntrend) {
      action = 'SELL';
      confidence = 30;
      reason = `Strong downtrend (Price below MA20, MA20 below MA50)`;
    } else if (currentPrice > ma20) {
      confidence = 15;
      reason = `Price above MA20 (bullish bias)`;
    } else if (currentPrice < ma20) {
      confidence = 15;
      reason = `Price below MA20 (bearish bias)`;
    } else {
      reason = `Sideways market`;
    }
    
    return { name: 'Moving Average', action, confidence, reason, weight: 20 };
  }

  // Strategy 4: Support & Resistance
  private analyzeSupportResistance(prices: number[], currentPrice: number): StrategyResult {
    const recentLow = Math.min(...prices.slice(-20));
    const recentHigh = Math.max(...prices.slice(-20));
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    
    const distanceToSupport = ((currentPrice - recentLow) / currentPrice) * 100;
    const distanceToResistance = ((recentHigh - currentPrice) / currentPrice) * 100;
    
    if (distanceToSupport < 0.2) {
      action = 'BUY';
      confidence = 25;
      reason = `Price near support level (${recentLow.toFixed(5)})`;
    } else if (distanceToResistance < 0.2) {
      action = 'SELL';
      confidence = 25;
      reason = `Price near resistance level (${recentHigh.toFixed(5)})`;
    } else {
      reason = `Price in middle of range (Support: ${recentLow.toFixed(5)}, Resistance: ${recentHigh.toFixed(5)})`;
    }
    
    return { name: 'Support/Resistance', action, confidence, reason, weight: 15 };
  }

  // Strategy 5: Momentum (Rate of Change)
  private analyzeMomentum(prices: number[], currentPrice: number): StrategyResult {
    if (prices.length < 20) return { name: 'Momentum', action: 'HOLD', confidence: 0, reason: 'Insufficient data', weight: 10 };
    
    const price20minAgo = prices[prices.length - 20];
    const momentum = ((currentPrice - price20minAgo) / price20minAgo) * 100;
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reason = '';
    
    if (momentum > 0.3) {
      action = 'BUY';
      confidence = 20;
      reason = `Strong positive momentum (${momentum.toFixed(2)}%)`;
    } else if (momentum < -0.3) {
      action = 'SELL';
      confidence = 20;
      reason = `Strong negative momentum (${momentum.toFixed(2)}%)`;
    } else if (momentum > 0) {
      confidence = 10;
      reason = `Positive momentum (${momentum.toFixed(2)}%)`;
    } else if (momentum < 0) {
      confidence = 10;
      reason = `Negative momentum (${momentum.toFixed(2)}%)`;
    } else {
      reason = `No momentum`;
    }
    
    return { name: 'Momentum', action, confidence, reason, weight: 10 };
  }

  analyze(symbol: string, currentPrice: number): TradeSignal {
    const prices = this.priceHistory.get(symbol) || [];
    if (prices.length < 50) {
      return {
        symbol, action: 'HOLD', confidence: 0, entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99, takeProfit: currentPrice * 1.02,
        reason: 'Collecting market data (need 50 candles)...',
        agreeingStrategies: [],
        indicators: {
          rsi: { value: 50, signal: 'N/A' },
          macd: { value: 0, signal: 'N/A', histogram: 0 },
          ma: { trend: 'N/A', pricePosition: 'N/A' },
          supportResistance: { support: 0, resistance: 0, signal: 'N/A' }
        }
      };
    }

    // Run all 5 strategies
    const rsiResult = this.analyzeRSI(prices);
    const macdResult = this.analyzeMACD(prices);
    const maResult = this.analyzeMovingAverages(prices, currentPrice);
    const srResult = this.analyzeSupportResistance(prices, currentPrice);
    const momentumResult = this.analyzeMomentum(prices, currentPrice);
    
    const allResults = [rsiResult, macdResult, maResult, srResult, momentumResult];
    
    // Calculate consensus
    let buyConfidence = 0;
    let sellConfidence = 0;
    const agreeingStrategies: string[] = [];
    
    for (const result of allResults) {
      if (result.action === 'BUY') {
        buyConfidence += result.confidence;
        if (result.confidence >= result.weight) {
          agreeingStrategies.push(result.name);
        }
      } else if (result.action === 'SELL') {
        sellConfidence += result.confidence;
        if (result.confidence >= result.weight) {
          agreeingStrategies.push(result.name);
        }
      }
    }
    
    const totalConfidence = buyConfidence + sellConfidence;
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let finalConfidence = 0;
    let reason = '';
    
    // Require at least 3 strategies to agree
    if (buyConfidence > sellConfidence && buyConfidence > 50 && agreeingStrategies.length >= 3) {
      action = 'BUY';
      finalConfidence = Math.min(buyConfidence, 95);
      reason = `${agreeingStrategies.length} strategies agree: ${agreeingStrategies.join(', ')}`;
    } else if (sellConfidence > buyConfidence && sellConfidence > 50 && agreeingStrategies.length >= 3) {
      action = 'SELL';
      finalConfidence = Math.min(sellConfidence, 95);
      reason = `${agreeingStrategies.length} strategies agree: ${agreeingStrategies.join(', ')}`;
    } else {
      reason = `No consensus (${agreeingStrategies.length}/5 strategies agree)`;
    }
    
    // Calculate dynamic SL/TP using ATR
    const atr = this.calculateATR(prices);
    const stopLossPercent = Math.max(0.005, atr / currentPrice * 1.5);
    const takeProfitPercent = Math.max(0.01, atr / currentPrice * 2.5);
    
    let stopLoss = currentPrice;
    let takeProfit = currentPrice;
    
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - stopLossPercent);
      takeProfit = currentPrice * (1 + takeProfitPercent);
    } else if (action === 'SELL') {
      stopLoss = currentPrice * (1 + stopLossPercent);
      takeProfit = currentPrice * (1 - takeProfitPercent);
    }
    
    return {
      symbol,
      action,
      confidence: finalConfidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reason,
      agreeingStrategies,
      indicators: {
        rsi: { value: this.calculateRSI(prices), signal: rsiResult.reason },
        macd: { value: this.calculateMACD(prices).value, signal: this.calculateMACD(prices).signal, histogram: this.calculateMACD(prices).histogram },
        ma: { trend: maResult.reason, pricePosition: currentPrice > this.calculateMA(prices, 20) ? 'above' : 'below' },
        supportResistance: {
          support: Math.min(...prices.slice(-20)),
          resistance: Math.max(...prices.slice(-20)),
          signal: srResult.reason
        }
      }
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
