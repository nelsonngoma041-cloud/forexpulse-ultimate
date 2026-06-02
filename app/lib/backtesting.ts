export class BacktestingEngine {
  // ... all the backtesting methods
}

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  symbol: string;
  strategy: 'moving_average_crossover' | 'rsi_mean_reversion' | 'bollinger_bands' | 'news_sentiment';
  parameters: Record<string, any>;
  riskPerTrade: number;
  maxConcurrentTrades: number;
}

export interface BacktestResult {
  totalReturn: number;
  totalReturnPercent: number;
  sharpeRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  winRate: number;
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  expectancy: number;
  equityCurve: Array<{ date: Date; equity: number }>;
  trades: Array<any>;
}
