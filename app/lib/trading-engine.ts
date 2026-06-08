// app/lib/trading-engine.ts
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
    
    if (prices.length < 20) {
      return {
        symbol,
        action: 'HOLD',
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99,
        takeProfit: currentPrice * 1.02,
        reason: `Collecting data (${prices.length}/20 candles)...`,
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

    // RSI Analysis
    if (rsi < 45) {
      buyScore += 40;
      agreeing.push(`RSI ${rsi.toFixed(1)} (Oversold)`);
    } else if (rsi > 55) {
      sellScore += 40;
      agreeing.push(`RSI ${rsi.toFixed(1)} (Overbought)`);
    } else if (rsi < 50) {
      buyScore += 15;
    } else {
      sellScore += 15;
    }

    // MACD Analysis
    if (macd.histogram > 0) {
      buyScore += 35;
      agreeing.push('MACD Bullish');
    } else if (macd.histogram < 0) {
      sellScore += 35;
      agreeing.push('MACD Bearish');
    } else {
      buyScore += 10;
      sellScore += 10;
    }

    // Moving Average Analysis
    if (currentPrice > ma20) {
      buyScore += 20;
      agreeing.push('Price above MA20');
    } else {
      sellScore += 20;
      agreeing.push('Price below MA20');
    }

    if (ma20 > ma50) {
      buyScore += 15;
      if (!agreeing.includes('Price above MA20')) agreeing.push('MA Uptrend');
    } else {
      sellScore += 15;
      if (!agreeing.includes('Price below MA20')) agreeing.push('MA Downtrend');
    }

    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    
    if (buyScore > sellScore && buyScore >= 25) {
      action = 'BUY';
      confidence = Math.min(Math.floor((buyScore / (buyScore + sellScore)) * 100), 95);
    } else if (sellScore > buyScore && sellScore >= 25) {
      action = 'SELL';
      confidence = Math.min(Math.floor((sellScore / (buyScore + sellScore)) * 100), 95);
    }

    // Test mode - generate signal even if weak
    if (action === 'HOLD' && (buyScore > 0 || sellScore > 0)) {
      if (buyScore > sellScore) {
        action = 'BUY';
        confidence = 55;
        agreeing.push('TEST: Simulated BUY signal');
      } else if (sellScore > buyScore) {
        action = 'SELL';
        confidence = 55;
        agreeing.push('TEST: Simulated SELL signal');
      }
    }

    const atr = 0.001;
    let stopLoss = currentPrice;
    let takeProfit = currentPrice;
    
    if (action === 'BUY') {
      stopLoss = currentPrice * (1 - atr * 1.5);
      takeProfit = currentPrice * (1 + atr * 2.5);
    } else if (action === 'SELL') {
      stopLoss = currentPrice * (1 + atr * 1.5);
      takeProfit = currentPrice * (1 - atr * 2.5);
    }

    return {
      symbol,
      action,
      confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reason: agreeing.slice(0, 3).join(', '),
      agreeingStrategies: agreeing
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
