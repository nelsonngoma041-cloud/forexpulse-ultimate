// app/lib/automated-trading.ts
import { TradingStrategy, StrategyConfig, Signal } from './trading-strategy';
import { TelegramAlertBot } from './telegram-alerts';

export interface TradingConfig {
  enabled: boolean;
  symbols: string[];
  strategies: StrategyConfig[];
  maxPositionSize: number;  // in lots
  maxDailyLoss: number;      // in dollars
  maxDailyTrades: number;
  riskPerTrade: number;      // % of account
  minConfidence: number;     // 0-1
  tradingHours: {
    start: number;  // 0-23
    end: number;    // 0-23
  };
}

export interface ActiveTrade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  volume: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: Date;
  pnl: number;
}

export class AutomatedTradingBot {
  private config: TradingConfig;
  private strategies: Map<string, TradingStrategy> = new Map();
  private activeTrades: ActiveTrade[] = [];
  private telegramBot: TelegramAlertBot;
  private dailyPnL: number = 0;
  private dailyTrades: number = 0;
  private isRunning: boolean = false;

  constructor(config: TradingConfig, telegramBot: TelegramAlertBot) {
    this.config = config;
    this.telegramBot = telegramBot;
    
    // Initialize strategies for each symbol
    for (const symbol of config.symbols) {
      for (const strategyConfig of config.strategies) {
        const key = `${symbol}_${strategyConfig.type}`;
        this.strategies.set(key, new TradingStrategy(strategyConfig));
      }
    }
  }

  // ========== CALCULATE STOP LOSS & TAKE PROFIT ==========
  private calculateStopLossTakeProfit(action: 'BUY' | 'SELL', price: number, volatility: number = 0.01) {
    if (action === 'BUY') {
      return {
        stopLoss: Number((price * (1 - volatility)).toFixed(5)),
        takeProfit: Number((price * (1 + volatility * 2)).toFixed(5))
      };
    } else {
      return {
        stopLoss: Number((price * (1 + volatility)).toFixed(5)),
        takeProfit: Number((price * (1 - volatility * 2)).toFixed(5))
      };
    }
  }

  private calculateVolatility(symbol: string): number {
    return 0.01; // 1% default volatility
  }

  // Update price and check for signals
  updatePrice(symbol: string, price: number, newsSentiment?: 'hawkish' | 'dovish') {
    // Update all strategies with new price - FIXED iteration
    const strategyKeys = Array.from(this.strategies.keys());
    for (const key of strategyKeys) {
      const strategy = this.strategies.get(key);
      if (strategy && key.startsWith(symbol)) {
        strategy.addPrice(symbol, price);
      }
    }
    
    // Check for trading signals
    if (this.isRunning && this.canTrade()) {
      this.checkForSignals(symbol, price, newsSentiment);
    }
    
    // Update active trades P&L and check SL/TP
    this.updateActiveTrades(symbol, price);
  }

  private canTrade(): boolean {
    const currentHour = new Date().getHours();
    if (currentHour < this.config.tradingHours.start || currentHour >= this.config.tradingHours.end) {
      return false;
    }
    
    if (Math.abs(this.dailyPnL) >= this.config.maxDailyLoss) {
      this.stop('Daily loss limit reached');
      return false;
    }
    
    if (this.dailyTrades >= this.config.maxDailyTrades) {
      this.stop('Daily trade limit reached');
      return false;
    }
    
    return true;
  }

  private async checkForSignals(symbol: string, currentPrice: number, newsSentiment?: 'hawkish' | 'dovish') {
    const signals: Signal[] = [];
    
    // Get signals from all strategies - FIXED iteration
    const strategyKeys = Array.from(this.strategies.keys());
    for (const key of strategyKeys) {
      if (key.startsWith(symbol)) {
        const strategy = this.strategies.get(key);
        if (strategy) {
          const signal = strategy.generateSignal(symbol, currentPrice, newsSentiment);
          if (signal.action !== 'HOLD') {
            signals.push(signal);
          }
        }
      }
    }
    
    if (signals.length === 0) return;
    
    const combinedSignal = this.combineSignals(signals, currentPrice);
    
    if (combinedSignal.action !== 'HOLD' && combinedSignal.confidence >= this.config.minConfidence) {
      await this.executeTrade(combinedSignal, currentPrice);
    }
  }

  private combineSignals(signals: Signal[], currentPrice: number): Signal {
    const buySignals = signals.filter(s => s.action === 'BUY');
    const sellSignals = signals.filter(s => s.action === 'SELL');
    
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    
    if (buySignals.length > sellSignals.length && avgConfidence > 0.6) {
      const volatility = this.calculateVolatility(signals[0].symbol);
      const { stopLoss, takeProfit } = this.calculateStopLossTakeProfit('BUY', currentPrice, volatility);
      
      return {
        action: 'BUY',
        symbol: signals[0].symbol,
        confidence: avgConfidence,
        reason: `${buySignals.length}/${signals.length} strategies agree on BUY`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        timestamp: new Date()
      };
    } else if (sellSignals.length > buySignals.length && avgConfidence > 0.6) {
      const volatility = this.calculateVolatility(signals[0].symbol);
      const { stopLoss, takeProfit } = this.calculateStopLossTakeProfit('SELL', currentPrice, volatility);
      
      return {
        action: 'SELL',
        symbol: signals[0].symbol,
        confidence: avgConfidence,
        reason: `${sellSignals.length}/${signals.length} strategies agree on SELL`,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        timestamp: new Date()
      };
    }
    
    return { action: 'HOLD', symbol: signals[0].symbol, confidence: 0, reason: 'No consensus', timestamp: new Date() };
  }

  private async executeTrade(signal: Signal, currentPrice: number) {
    const accountSize = 10000;
    const riskAmount = accountSize * (this.config.riskPerTrade / 100);
    
    const stopLoss = signal.stopLoss!;
    const takeProfit = signal.takeProfit!;
    
    const stopLossDistance = Math.abs(currentPrice - stopLoss);
    const volume = riskAmount / (stopLossDistance * 10000);
    const finalVolume = Math.min(volume, this.config.maxPositionSize);
    
    const trade: ActiveTrade = {
      id: `trade_${Date.now()}_${signal.symbol}`,
      symbol: signal.symbol,
      action: signal.action,
      entryPrice: currentPrice,
      volume: finalVolume,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      entryTime: new Date(),
      pnl: 0
    };
    
    this.activeTrades.push(trade);
    this.dailyTrades++;
    
    await this.telegramBot.sendTradeAlert({
      symbol: trade.symbol,
      action: trade.action,
      price: trade.entryPrice,
      confidence: signal.confidence,
      signalType: 'Automated Strategy',
      volume: trade.volume,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit
    });
    
    console.log(`📊 TRADE EXECUTED: ${trade.action} ${trade.symbol} at ${trade.entryPrice} | SL: ${stopLoss} | TP: ${takeProfit}`);
  }

  private updateActiveTrades(symbol: string, currentPrice: number) {
    for (let i = 0; i < this.activeTrades.length; i++) {
      const trade = this.activeTrades[i];
      if (trade.symbol === symbol) {
        if (trade.action === 'BUY') {
          trade.pnl = (currentPrice - trade.entryPrice) * 10000 * trade.volume;
          
          if (currentPrice <= trade.stopLoss) {
            this.closeTrade(trade, currentPrice, 'Stop Loss');
            this.activeTrades.splice(i, 1);
            i--;
          } else if (currentPrice >= trade.takeProfit) {
            this.closeTrade(trade, currentPrice, 'Take Profit');
            this.activeTrades.splice(i, 1);
            i--;
          }
        } else {
          trade.pnl = (trade.entryPrice - currentPrice) * 10000 * trade.volume;
          
          if (currentPrice >= trade.stopLoss) {
            this.closeTrade(trade, currentPrice, 'Stop Loss');
            this.activeTrades.splice(i, 1);
            i--;
          } else if (currentPrice <= trade.takeProfit) {
            this.closeTrade(trade, currentPrice, 'Take Profit');
            this.activeTrades.splice(i, 1);
            i--;
          }
        }
      }
    }
  }

  private async closeTrade(trade: ActiveTrade, exitPrice: number, reason: string) {
    this.dailyPnL += trade.pnl;
    
    await this.telegramBot.sendAlert(
      `Trade Closed - ${reason}`,
      `${trade.action} ${trade.symbol}\nEntry: ${trade.entryPrice}\nExit: ${exitPrice}\nP&L: $${trade.pnl.toFixed(2)}\nDaily P&L: $${this.dailyPnL.toFixed(2)}`,
      trade.pnl >= 0 ? 'info' : 'warning'
    );
    
    console.log(`🔒 TRADE CLOSED: ${trade.action} ${trade.symbol} | ${reason} | P&L: $${trade.pnl.toFixed(2)}`);
  }

  start() {
    this.isRunning = true;
    this.dailyPnL = 0;
    this.dailyTrades = 0;
    console.log('🤖 Automated trading bot started');
    this.telegramBot.sendAlert('Trading Bot', '🤖 Bot activated - monitoring RSI, MACD, MA, Bollinger, and News strategies', 'info');
  }

  stop(reason?: string) {
    this.isRunning = false;
    console.log(`🛑 Bot stopped${reason ? `: ${reason}` : ''}`);
    this.telegramBot.sendAlert('Trading Bot', `⏸️ Bot stopped${reason ? `: ${reason}` : ''}`, 'warning');
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTrades: this.activeTrades.length,
      dailyPnL: this.dailyPnL,
      dailyTrades: this.dailyTrades,
      config: this.config
    };
  }

  getActiveTrades() {
    return this.activeTrades;
  }
      }
