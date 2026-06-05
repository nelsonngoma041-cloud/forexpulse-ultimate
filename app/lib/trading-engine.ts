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
      reason: `Collecting data (${prices.length}/30)...`,
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

  // RSI Analysis - LOWERED THRESHOLDS for more signals
  if (rsi < 45) {  // Changed from 30 to 45
    buyScore += 35;
    agreeing.push(`RSI ${rsi.toFixed(1)} (Oversold area)`);
  } else if (rsi > 55) {  // Changed from 70 to 55
    sellScore += 35;
    agreeing.push(`RSI ${rsi.toFixed(1)} (Overbought area)`);
  } else {
    // Even neutral RSI gives some score
    if (rsi < 50) buyScore += 15;
    else sellScore += 15;
  }

  // MACD Analysis
  if (macd.histogram > 0) {
    buyScore += 30;
    agreeing.push('MACD Bullish');
  } else if (macd.histogram < 0) {
    sellScore += 30;
    agreeing.push('MACD Bearish');
  } else {
    buyScore += 10;
    sellScore += 10;
  }

  // Moving Average Analysis - LOWERED THRESHOLDS
  if (currentPrice > ma20) {
    buyScore += 20;
    agreeing.push('Price above MA20');
  } else {
    sellScore += 20;
    agreeing.push('Price below MA20');
  }

  if (ma20 > ma50) {
    buyScore += 15;
    agreeing.push('MA20 above MA50');
  } else {
    sellScore += 15;
    agreeing.push('MA20 below MA50');
  }

  // Determine action - LOWERED CONFIDENCE THRESHOLD
  let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
  let confidence = 0;
  
  if (buyScore > sellScore && buyScore >= 30) {  // Changed from 50 to 30
    action = 'BUY';
    confidence = Math.min(Math.floor((buyScore / (buyScore + sellScore)) * 100), 95);
  } else if (sellScore > buyScore && sellScore >= 30) {  // Changed from 50 to 30
    action = 'SELL';
    confidence = Math.min(Math.floor((sellScore / (buyScore + sellScore)) * 100), 95);
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
