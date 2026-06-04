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
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i-1];
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
    if (prices.length < period + 1) return 0;
    let sum = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      sum += Math.abs(prices[i] - prices[i-1]);
    }
    return sum / period;
  }

  analyze(symbol: string, currentPrice: number): TradeSignal {
    const prices = this.priceHistory.get(symbol) || [];
    if (prices.length < 50) {
      return {
        symbol, action: 'HOLD', confidence: 0, entryPrice: currentPrice,
        stopLoss: currentPrice * 0.99, takeProfit: currentPrice * 1.02,
        reason: 'Collecting enough data (need 50 candles)...',
        indicators: { rsi: 'N/A', macd: 'N/A', trend: 'N/A' }
      };
    }

    const rsi = this.calculateRSI(prices);
    const macd = this.calculateMACD(prices);
    const ma20 = this.calculateMA(prices, 20);
    const ma50 = this.calculateMA(prices, 50);
    const atr = this.calculateATR(prices);
    
    let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let reasons: string[] = [];
    let rsiSignal = '';
    let macdSignal = '';

    // RSI Analysis
    if (rsi < 25) {
      rsiSignal = `Strongly Oversold (RSI: ${rsi.toFixed(1)}) - BUY Signal`;
      confidence += 40;
      action = 'BUY';
      reasons.push('RSI strongly oversold');
    } else if (rsi < 30) {
      rsiSignal = `Oversold (RSI: ${rsi.toFixed(1)}) - Potential BUY`;
      confidence += 30;
      action = 'BUY';
      reasons.push('RSI oversold');
    } else if (rsi > 75) {
      rsiSignal = `Strongly Overbought (RSI: ${rsi.toFixed(1)}) - SELL Signal`;
      confidence += 40;
      action = 'SELL';
      reasons.push('RSI strongly overbought');
    } else if (rsi > 70) {
      rsiSignal = `Overbought (RSI: ${rsi.toFixed(1)}) - Potential SELL`;
      confidence += 30;
      action = 'SELL';
      reasons.push('RSI overbought');
    } else {
      rsiSignal = `Neutral (RSI: ${rsi.toFixed(1)})`;
    }

    // MACD Analysis
    if (macd.histogram > 0.0002 && macd.value > macd.signal) {
      macdSignal = `Strong Bullish Crossover - BUY`;
      confidence += 35;
      if (action === 'HOLD') action = 'BUY';
      reasons.push('MACD bullish crossover');
    } else if (macd.histogram < -0.0002 && macd.value < macd.signal) {
      macdSignal = `Strong Bearish Crossover - SELL`;
      confidence += 35;
      if (action === 'HOLD') action = 'SELL';
      reasons.push('MACD bearish crossover');
    } else if (macd.histogram > 0) {
      macdSignal = `Bullish momentum building`;
      confidence += 15;
    } else if (macd.histogram < 0) {
      macdSignal = `Bearish momentum building`;
      confidence += 15;
    } else {
      macdSignal = `No clear MACD signal`;
    }

    // Moving Average Trend
    const priceVsMA20 = currentPrice > ma20 ? 'above' : 'below';
    const maTrend = ma20 > ma50 ? 'uptrend' : 'downtrend';
    
    if (maTrend === 'uptrend' && priceVsMA20 === 'above') {
      confidence += 20;
      if (action === 'HOLD') action = 'BUY';
      reasons.push(`Price in ${maTrend}`);
    } else if (maTrend === 'downtrend' && priceVsMA20 === 'below') {
      confidence += 20;
      if (action === 'HOLD') action = 'SELL';
      reasons.push(`Price in ${maTrend}`);
    }

    // Dynamic Stop Loss and Take Profit based on ATR
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

    const finalAction = confidence >= 50 ? action : 'HOLD';
    const finalConfidence = Math.min(confidence, 95);
    
    const reasonText = reasons.length > 0 
      ? `${reasons.join(', ')}. ${rsiSignal}. ${macdSignal}.`
      : `${rsiSignal}. ${macdSignal}. No strong signals.`;

    return {
      symbol, 
      action: finalAction, 
      confidence: finalConfidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      reason: reasonText,
      indicators: { 
        rsi: rsiSignal, 
        macd: macdSignal, 
        trend: `${maTrend} (MA20: ${ma20.toFixed(5)}, MA50: ${ma50.toFixed(5)})` 
      }
    };
  }
}

export const tradingEngine = new ProfessionalTradingEngine();
