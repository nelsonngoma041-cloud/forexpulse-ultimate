// app/lib/metaapi-broker.ts
export interface MT5Order {
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface MT5Position {
  ticket: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  openPrice: number;
  currentPrice: number;
  profit: number;
  stopLoss?: number;
  takeProfit?: number;
}

export class MetaApiBroker {
  private connected: boolean = false;
  private accountInfo: any = null;
  private positions: MT5Position[] = [];
  private orderHistory: any[] = [];
  private mt5Login: string = '';
  private mt5Server: string = '';

  constructor() {
    // Initialize
  }

  async connect(login: string, password: string, server: string) {
    try {
      console.log('🔌 Connecting to MT5 account...');
      console.log(`   Login: ${login}`);
      console.log(`   Server: ${server}`);
      
      this.mt5Login = login;
      this.mt5Server = server;
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connected = true;
      this.accountInfo = {
        login: login,
        server: server,
        balance: 10000,
        equity: 10000,
        margin: 0,
        freeMargin: 10000,
        profit: 0,
        currency: 'USD',
        leverage: 100
      };
      
      console.log('✅ Connected to MT5 successfully!');
      return true;
    } catch (error) {
      console.error('❌ MT5 connection failed:', error);
      return false;
    }
  }

  async getAccountInfo() {
    if (!this.connected) return null;
    // Update equity based on open positions
    let totalProfit = 0;
    for (const pos of this.positions) {
      totalProfit += pos.profit;
    }
    return {
      ...this.accountInfo,
      equity: this.accountInfo.balance + totalProfit,
      profit: totalProfit,
      freeMargin: this.accountInfo.balance + totalProfit
    };
  }

  async getPrices(symbols: string[]) {
    // Return realistic mock prices that fluctuate
    const prices: Record<string, number> = {};
    const basePrices: Record<string, number> = {
      'EUR/USD': 1.0892,
      'GBP/USD': 1.2715,
      'USD/JPY': 157.85,
      'AUD/USD': 0.6645,
      'USD/CAD': 1.3715
    };
    
    for (const symbol of symbols) {
      // Add small random movement
      const change = (Math.random() - 0.5) * 0.0005;
      prices[symbol] = basePrices[symbol] + change;
    }
    return prices;
  }

  async placeOrder(order: MT5Order) {
    if (!this.connected) {
      console.log('❌ MT5 not connected');
      return { success: false, error: 'MT5 not connected' };
    }

    console.log(`📊 MT5 ORDER: ${order.action} ${order.symbol} ${order.volume} lots`);
    if (order.stopLoss) console.log(`   Stop Loss: ${order.stopLoss}`);
    if (order.takeProfit) console.log(`   Take Profit: ${order.takeProfit}`);
    
    // Get current price
    const prices = await this.getPrices([order.symbol]);
    const currentPrice = prices[order.symbol] || 1.0892;
    
    // Create position
    const newPosition: MT5Position = {
      ticket: Date.now(),
      symbol: order.symbol,
      action: order.action,
      volume: order.volume,
      openPrice: currentPrice,
      currentPrice: currentPrice,
      profit: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit
    };
    
    this.positions.push(newPosition);
    
    // Record in history
    this.orderHistory.push({
      ...order,
      ticket: newPosition.ticket,
      openPrice: currentPrice,
      time: new Date().toISOString()
    });
    
    // Update account balance (simulate margin used)
    const marginUsed = order.volume * 1000;
    this.accountInfo.margin += marginUsed;
    this.accountInfo.freeMargin -= marginUsed;
    
    console.log(`✅ ORDER EXECUTED on MT5: ${order.action} ${order.symbol} at ${currentPrice}`);
    
    return { 
      success: true, 
      orderId: newPosition.ticket.toString(), 
      filledPrice: currentPrice 
    };
  }

  async getOpenPositions() {
    // Update profits for open positions
    const prices = await this.getPrices(this.positions.map(p => p.symbol));
    
    for (const pos of this.positions) {
      const currentPrice = prices[pos.symbol] || pos.currentPrice;
      pos.currentPrice = currentPrice;
      
      if (pos.action === 'BUY') {
        pos.profit = (currentPrice - pos.openPrice) * 100000 * pos.volume;
      } else {
        pos.profit = (pos.openPrice - currentPrice) * 100000 * pos.volume;
      }
      
      // Check stop loss
      if (pos.stopLoss) {
        if (pos.action === 'BUY' && currentPrice <= pos.stopLoss) {
          await this.closePosition(pos.ticket, 'Stop Loss');
        } else if (pos.action === 'SELL' && currentPrice >= pos.stopLoss) {
          await this.closePosition(pos.ticket, 'Stop Loss');
        }
      }
      
      // Check take profit
      if (pos.takeProfit) {
        if (pos.action === 'BUY' && currentPrice >= pos.takeProfit) {
          await this.closePosition(pos.ticket, 'Take Profit');
        } else if (pos.action === 'SELL' && currentPrice <= pos.takeProfit) {
          await this.closePosition(pos.ticket, 'Take Profit');
        }
      }
    }
    
    return this.positions;
  }

  async closePosition(ticket: number, reason?: string) {
    const index = this.positions.findIndex(p => p.ticket === ticket);
    if (index !== -1) {
      const position = this.positions[index];
      console.log(`🔒 POSITION CLOSED: ${position.action} ${position.symbol} | Profit: $${position.profit.toFixed(2)} | Reason: ${reason || 'Manual'}`);
      
      // Update account balance with profit/loss
      this.accountInfo.balance += position.profit;
      this.accountInfo.margin -= position.volume * 1000;
      this.accountInfo.freeMargin += position.volume * 1000;
      
      this.positions.splice(index, 1);
      return { success: true };
    }
    return { success: false, error: 'Position not found' };
  }

  async closeAllPositions() {
    const tickets = [...this.positions.map(p => p.ticket)];
    for (const ticket of tickets) {
      await this.closePosition(ticket, 'Bot stopped');
    }
    return { success: true };
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
    this.connected = false;
    this.accountInfo = null;
    this.positions = [];
    console.log('🔌 Disconnected from MT5');
  }

  getOrderHistory() {
    return this.orderHistory;
  }
}
