// app/lib/metaapi-broker.ts
import MetaApi from 'metaapi.cloud-sdk';

export interface MT5Order {
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export class MetaApiBroker {
  private api: any;
  private account: any;
  private connected: boolean = false;
  private accountInfo: any = null;
  private token: string;
  private accountId: string;

  constructor() {
    this.token = process.env.NEXT_PUBLIC_METAAPI_TOKEN || '';
    this.accountId = process.env.NEXT_PUBLIC_METAAPI_ACCOUNT_ID || '';
    this.api = new MetaApi(this.token);
  }

  async connect(login: string, password: string, server: string) {
    try {
      console.log('🔌 Connecting to MetaApi MT5 account...');
      
      // Get the account
      this.account = await this.api.metatraderAccountApi.getAccount(this.accountId);
      
      // Deploy the account (start the MT5 terminal in cloud)
      await this.account.deploy();
      
      // Wait for connection
      await this.account.waitConnected();
      
      this.connected = true;
      
      // Get account info
      const info = await this.account.getAccountInformation();
      this.accountInfo = {
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        profit: info.profit,
        currency: info.currency,
        leverage: info.leverage
      };
      
      console.log('✅ Connected to MT5 successfully!');
      console.log(`   Balance: $${this.accountInfo.balance}`);
      return true;
      
    } catch (error) {
      console.error('❌ MT5 connection failed:', error);
      return false;
    }
  }

  async getAccountInfo() {
    if (!this.connected) return null;
    try {
      const info = await this.account.getAccountInformation();
      return {
        balance: info.balance,
        equity: info.equity,
        margin: info.margin,
        freeMargin: info.freeMargin,
        profit: info.profit,
        currency: info.currency
      };
    } catch (error) {
      return this.accountInfo;
    }
  }

  async getPrices(symbols: string[]) {
    if (!this.connected) return {};
    try {
      // Convert symbols to MT5 format (EURUSD instead of EUR/USD)
      const mt5Symbols = symbols.map(s => s.replace('/', ''));
      const rates = await this.account.getRates(mt5Symbols);
      
      const prices: Record<string, number> = {};
      for (const rate of rates) {
        prices[rate.symbol.replace('', '/')] = (rate.bid + rate.ask) / 2;
      }
      return prices;
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    }
  }

  async placeOrder(order: MT5Order) {
    if (!this.connected) {
      return { success: false, error: 'MT5 not connected' };
    }

    try {
      // Convert symbol to MT5 format (EURUSD instead of EUR/USD)
      const mt5Symbol = order.symbol.replace('/', '');
      
      const tradeOrder = {
        symbol: mt5Symbol,
        type: order.action === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        volume: order.volume,
        stopLoss: order.stopLoss,
        takeProfit: order.takeProfit,
        comment: order.comment || 'ForexPulse Bot'
      };
      
      const result = await this.account.trade(tradeOrder);
      
      console.log(`✅ ORDER EXECUTED: ${order.action} ${order.symbol} at ${result.price}`);
      
      return { 
        success: true, 
        orderId: result.orderId, 
        filledPrice: result.price 
      };
      
    } catch (error) {
      console.error('Order placement error:', error);
      return { success: false, error: String(error) };
    }
  }

  async getOpenPositions() {
    if (!this.connected) return [];
    try {
      const positions = await this.account.getPositions();
      return positions.map((pos: any) => ({
        ticket: pos.id,
        symbol: pos.symbol,
        action: pos.type === 'ORDER_TYPE_BUY' ? 'BUY' : 'SELL',
        volume: pos.volume,
        openPrice: pos.openPrice,
        currentPrice: pos.currentPrice,
        profit: pos.unrealizedProfit,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit
      }));
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  async closePosition(ticket: string) {
    if (!this.connected) return { success: false };
    try {
      await this.account.closePosition(ticket);
      console.log(`✅ Position closed: ${ticket}`);
      return { success: true };
    } catch (error) {
      console.error('Error closing position:', error);
      return { success: false };
    }
  }

  async closeAllPositions() {
    const positions = await this.getOpenPositions();
    for (const pos of positions) {
      await this.closePosition(pos.ticket);
    }
    return { success: true };
  }

  isConnected() {
    return this.connected;
  }

  disconnect() {
    this.connected = false;
    console.log('🔌 Disconnected from MT5');
  }
}
