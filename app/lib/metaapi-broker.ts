// app/lib/metaapi-broker.ts
export interface MT5Account {
  login: string;
  password: string;
  server: string;
}

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
  private apiKey: string;
  private accountId: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_METAAPI_TOKEN || '';
    this.accountId = process.env.NEXT_PUBLIC_METAAPI_ACCOUNT_ID || '';
  }

  async connect(login: string, password: string, server: string) {
    try {
      console.log('🔌 Connecting to MT5 account...');
      console.log(`   Login: ${login}`);
      console.log(`   Server: ${server}`);
      
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.connected = true;
      this.accountInfo = {
        login: login,
        server: server,
        balance: 10000,
        equity: 10250,
        margin: 1250,
        freeMargin: 8750,
        profit: 250,
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
    return this.accountInfo;
  }

  async getPrices(symbols: string[]) {
    // Return realistic mock prices
    const prices: Record<string, number> = {};
    const mockPrices: Record<string, number> = {
      'EUR/USD': 1.0892 + (Math.random() - 0.5) * 0.0005,
      'GBP/USD': 1.2715 + (Math.random() - 0.5) * 0.0005,
      'USD/JPY': 157.85 + (Math.random() - 0.5) * 0.1,
      'AUD/USD': 0.6645 + (Math.random() - 0.5) * 0.0003,
      'USD/CAD': 1.3715 + (Math.random() - 0.5) * 0.0004
    };
    
    for (const symbol of symbols) {
      prices[symbol] = mockPrices[symbol] || 1.0892;
    }
    return prices;
  }

  async placeOrder(order: MT5Order) {
    if (!this.connected) {
      return { success: false, error: 'MT5 not connected' };
    }

    console.log(`📊 MT5 ORDER: ${order.action} ${order.symbol} ${order.volume} lots`);
    if (order.stopLoss) console.log(`   Stop Loss: ${order.stopLoss}`);
    if (order.takeProfit) console.log(`   Take Profit: ${order.takeProfit}`);
    
    // Simulate order placement
    const mockPrice = order.symbol === 'EUR/USD' ? 1.0892 : 
                     order.symbol === 'GBP/USD' ? 1.2715 :
                     order.symbol === 'USD/JPY' ? 157.85 : 1.0892;
    
    const newPosition: MT5Position = {
      ticket: Date.now(),
      symbol: order.symbol,
      action: order.action,
      volume: order.volume,
      openPrice: mockPrice,
      currentPrice: mockPrice,
      profit: 0,
      stopLoss: order.stopLoss,
      takeProfit: order.takeProfit
    };
    
    this.positions.push(newPosition);
    
    return { 
      success: true, 
      orderId: newPosition.ticket.toString(), 
      filledPrice: mockPrice 
    };
  }

  async getOpenPositions() {
    if (!this.connected) return [];
    return this.positions;
  }

  async closePosition(ticket: number) {
    const index = this.positions.findIndex(p => p.ticket === ticket);
    if (index !== -1) {
      this.positions.splice(index, 1);
      return { success: true };
    }
    return { success: false, error: 'Position not found' };
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
}
