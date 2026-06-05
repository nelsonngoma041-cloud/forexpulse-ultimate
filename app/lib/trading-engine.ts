// app/lib/trading-engine.ts - Professional Multi-Strategy Engine (Simplified)
export interface TradeSignal {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reason: string;
  agreeingStrategies: string[];
}

export class ProfessionalTradingEngine {
  private priceHistory: Map<string, number[]> = new Map();

  addPrice(symbol: string, price: number): void {
    if (!this.priceHistory.has(symbol)) {
      this.priceHistory.set(symbol, []);
    }
    const history = this.priceHistory.get(symbol)!;
    history.push(price);
    if (history.length > 100) history.shift();
  }

  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
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

  private calculateMACD(prices: number[]): { histogram: number } {
    const calculateEMA = (data: number[], period: number): number => {
      if (data.length === 0) return 0;
      const multiplier = 2 / (period + 1);
      let ema = data[0];
      for (let i = 1; i < data.length; i++) {
        ema = (data[i] - ema) * multiplier + ema;
      }
      return ema;
    };

    const ema12 = calculateEMA(prices, 12);
    const ema26 = calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = calculateEMA([macd], 9);
    return { histogram: macd - signal };
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
    if (prices.length < 30) {
      return {
        symbol,
        action: 'HOLD',
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99,
        takeProfit: currentPrice * 1.02,
        reason: 'Collecting market data...',
        agreeingStrategies: []
      };
    }

    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const ma20 = this.calculateMA(prices, 20);
    const ma50 = this.calculateMA(prices, 50);
    
    let buyScore = 0;
    let sellScore = 0;
    const agreeing: string[] = [];

    // Strategy 1: RSI Analysis
    if (rsi < 30) {
      buyScore += 35;
      agreeing.push('RSI Oversold');
    } else if (rsi > 70) {
      sellScore += 35;
      agreeing.push('RSI Overbought');
    }

    // Strategy 2: MACD Analysis
    if (macd.histogram > 0) {
      buyScore += 30;
      agreeing.push('MACD Bullish');
    } else if (macd.histogram < 0) {
      sellScore += 30;
      agreeing.push('MACD Bearish');
    }

    // Strategy 3: Moving Average Analysis
    if (currentPrice > ma20 && ma20 > ma50) {
      buyScore += 25;
      agreeing.push('MA Uptrend');
    } else if (currentPrice < ma20 && ma20 < ma50) {
      sellScore += 25;
      agreeing.push('MA Downtrend');
    }

    // Strategy 4: Price Momentum (24-hour change)
    if (prices.length >= 24) {
      const price24hAgo = prices[prices.length - 24];
      const changePercent = ((currentPrice - price24hAgo) / price24hAgo) * 100;
      if (changePercent > 0.1) {
        buyScore += 10;
        agreeing.push('Positive Momentum');
      } else if (changePercent < -0.1) {
        sellScore += 10;
        agreeing.push('Negative Momentum');
      }
    }

    // Determine action based on scores
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    
    const totalScore = buyScore + sellScore;
    
    if (buyScore > sellScore && agreeing.length >= 2) {
      action = 'BUY';
      confidence = totalScore > 0 ? Math.min(Math.floor((buyScore / totalScore) * 100), 95) : 50;
    } else if (sellScore > buyScore && agreeing.length >= 2) {
      action = 'SELL';
      confidence = totalScore > 0 ? Math.min(Math.floor((sellScore / totalScore) * 100), 95) : 50;
    }

    // Calculate dynamic stop loss and take profit
    const atr = 0.0015; // Approximate ATR for forex
    let stopLoss = currentPrice;
    let takeProfit = currentPrice;
    
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - atr * 1.5);
      takeProfit = currentPrice * (1 + atr * 3);
    } else if (action === 'SELL') {
      stopLoss = currentPrice * (1 + atr * 1.5);
      takeProfit = currentPrice * (1 - atr * 3);
    }

    const reasonText = action !== 'HOLD' 
      ? `${agreeing.length} strategies confirm: ${agreeing.join(', ')}`
      : `No clear signal. ${agreeing.length} strategies indicate potential.`;

    return {
      symbol,
      action,
      confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reason: reasonText,
      agreeingStrategies: agreeing
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
