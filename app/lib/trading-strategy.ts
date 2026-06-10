// app/lib/trading-strategy.ts

export interface StrategyConfig {
  name: string;
  type: 'RSI' | 'MACD' | 'MA_CROSSOVER' | 'BOLLINGER' | 'NEWS_SENTIMENT';
  parameters: Record<string, any>;
}

export interface Signal {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  confidence: number;
  reason: string;
  stopLoss?: number;
  takeProfit?: number;
  timestamp: Date;
}

export class TradingStrategy {
  private config: StrategyConfig;
  private priceHistory: Map<string, number[]> = new Map();
  
  constructor(config: StrategyConfig) {
    this.config = config;
  }

  addPrice(symbol: string, price: number) {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    // Keep last 100 candles for calculations
    if (history.length > 100) history.shift();
  }

  // Calculate RSI (Relative Strength Index)
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  // Calculate MACD
  private calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    return { macd, signal, histogram: macd - signal };
  }

  // Calculate EMA (Exponential Moving Average)
  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  // Calculate Bollinger Bands
  private calculateBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    if (prices.length < period) {
      return { upper: prices[prices.length - 1], middle: prices[prices.length - 1], lower: prices[prices.length - 1] };
    }
    
    const recent = prices.slice(-period);
    const middle = recent.reduce((a, b) => a + b, 0) / period;
    const variance = recent.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      upper: middle + (standardDeviation * stdDev),
      middle: middle,
      lower: middle - (standardDeviation * stdDev)
    };
  }

  // Generate trading signal based on strategy
  generateSignal(symbol: string, currentPrice: number, newsSentiment?: 'hawkish' | 'dovish'): Signal {
    const prices = this.priceHistory.get(symbol) || [];
    
    if (prices.length < 20) {
      return { action: 'HOLD', symbol, confidence: 0, reason: 'Insufficient data', timestamp: new Date() };
    }

    switch (this.config.type) {
      case 'RSI': {
        const rsi = this.calculateRSI(prices, this.config.parameters.period || 14);
        
        if (rsi < 30) {
          return {
            action: 'BUY',
            symbol,
            confidence: (70 - rsi) / 40,
            reason: `RSI oversold at ${rsi.toFixed(2)}`,
            stopLoss: currentPrice * 0.99,
            takeProfit: currentPrice * 1.02,
            timestamp: new Date()
          };
        } else if (rsi > 70) {
          return {
            action: 'SELL',
            symbol,
            confidence: (rsi - 70) / 30,
            reason: `RSI overbought at ${rsi.toFixed(2)}`,
            stopLoss: currentPrice * 1.01,
            takeProfit: currentPrice * 0.98,
            timestamp: new Date()
          };
        }
        break;
      }

      case 'MA_CROSSOVER': {
        const fastPeriod = this.config.parameters.fastPeriod || 10;
        const slowPeriod = this.config.parameters.slowPeriod || 30;
        
        const fastMA = this.calculateEMA(prices, fastPeriod);
        const slowMA = this.calculateEMA(prices, slowPeriod);
        const prevFastMA = this.calculateEMA(prices.slice(0, -1), fastPeriod);
        const prevSlowMA = this.calculateEMA(prices.slice(0, -1), slowPeriod);
        
        // Bullish crossover
        if (prevFastMA <= prevSlowMA && fastMA > slowMA) {
          return {
            action: 'BUY',
            symbol,
            confidence: 0.75,
            reason: `MA Crossover: ${fastPeriod} MA crossed above ${slowPeriod} MA`,
            stopLoss: currentPrice * 0.99,
            takeProfit: currentPrice * 1.025,
            timestamp: new Date()
          };
        }
        // Bearish crossover
        else if (prevFastMA >= prevSlowMA && fastMA < slowMA) {
          return {
            action: 'SELL',
            symbol,
            confidence: 0.75,
            reason: `MA Crossover: ${fastPeriod} MA crossed below ${slowPeriod} MA`,
            stopLoss: currentPrice * 1.01,
            takeProfit: currentPrice * 0.975,
            timestamp: new Date()
          };
        }
        break;
      }

      case 'BOLLINGER': {
        const bands = this.calculateBollingerBands(prices);
        const prevPrice = prices[prices.length - 2];
        
        // Price touches lower band - Buy signal
        if (prevPrice > bands.lower && currentPrice <= bands.lower) {
          return {
            action: 'BUY',
            symbol,
            confidence: 0.7,
            reason: 'Price touched lower Bollinger Band',
            stopLoss: currentPrice * 0.99,
            takeProfit: bands.middle,
            timestamp: new Date()
          };
        }
        // Price touches upper band - Sell signal
        else if (prevPrice < bands.upper && currentPrice >= bands.upper) {
          return {
            action: 'SELL',
            symbol,
            confidence: 0.7,
            reason: 'Price touched upper Bollinger Band',
            stopLoss: currentPrice * 1.01,
            takeProfit: bands.middle,
            timestamp: new Date()
          };
        }
        break;
      }

      case 'NEWS_SENTIMENT': {
        if (newsSentiment) {
          if (newsSentiment === 'hawkish') {
            return {
              action: 'BUY',
              symbol,
              confidence: 0.8,
              reason: 'Hawkish news sentiment detected',
              stopLoss: currentPrice * 0.995,
              takeProfit: currentPrice * 1.015,
              timestamp: new Date()
            };
          } else if (newsSentiment === 'dovish') {
            return {
              action: 'SELL',
              symbol,
              confidence: 0.8,
              reason: 'Dovish news sentiment detected',
              stopLoss: currentPrice * 1.005,
              takeProfit: currentPrice * 0.985,
              timestamp: new Date()
            };
          }
        }
        break;
      }

      case 'MACD': {
        const { macd, signal, histogram } = this.calculateMACD(prices);
        const prevMacd = this.calculateMACD(prices.slice(0, -1));
        
        // Bullish crossover
        if (prevMacd.macd <= prevMacd.signal && macd > signal) {
          return {
            action: 'BUY',
            symbol,
            confidence: 0.7,
            reason: `MACD bullish crossover (Histogram: ${histogram.toFixed(4)})`,
            stopLoss: currentPrice * 0.99,
            takeProfit: currentPrice * 1.02,
            timestamp: new Date()
          };
        }
        // Bearish crossover
        else if (prevMacd.macd >= prevMacd.signal && macd < signal) {
          return {
            action: 'SELL',
            symbol,
            confidence: 0.7,
            reason: `MACD bearish crossover (Histogram: ${histogram.toFixed(4)})`,
            stopLoss: currentPrice * 1.01,
            takeProfit: currentPrice * 0.98,
            timestamp: new Date()
          };
        }
        break;
      }
    }

    return { action: 'HOLD', symbol, confidence: 0, reason: 'No signal generated', timestamp: new Date() };
  }

  // Combine multiple strategies for higher confidence
  combineSignals(signals: Signal[]): Signal {
    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');
    
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    
    if (buySignals.length > sellSignals.length && avgConfidence > 0.6) {
      return {
        action: 'BUY',
        symbol: signals[0].symbol,
        confidence: avgConfidence,
        reason: `Combined signal: ${buySignals.length} buy, ${sellSignals.length} sell`,
        stopLoss: signals[0].stopLoss,
        takeProfit: signals[0].takeProfit,
        timestamp: new Date()
      };
    } else if (sellSignals.length > buySignals.length && avgConfidence > 0.6) {
      return {
        action: 'SELL',
        symbol: signals[0].symbol,
        confidence: avgConfidence,
        reason: `Combined signal: ${sellSignals.length} sell, ${buySignals.length} buy`,
        stopLoss: signals[0].stopLoss,
        takeProfit: signals[0].takeProfit,
        timestamp: new Date()
      };
    }
    
    return { action: 'HOLD', symbol: signals[0].symbol, confidence: 0, reason: 'No consensus', timestamp: new Date() };
  }
              }
