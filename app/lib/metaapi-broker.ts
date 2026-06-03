// app/lib/metaapi-broker.ts
import MetaApi from 'metaapi.cloud-sdk';

export class MetaApiBroker {
  private api: any;
  private account: any;
  private connected: boolean = false;

  constructor() {
    const token = process.env.METAAPI_TOKEN || '';
    this.api = new MetaApi(token);
  }

  async connect(accountId: string) {
    try {
      console.log('Connecting to MetaApi MT5 account...');
      this.account = await this.api.metatraderAccountApi.getAccount(accountId);
      await this.account.deploy();
      await this.account.waitConnected();
      this.connected = true;
      console.log('✅ Connected to MT5 demo account successfully!');
      
      // Get account info to verify
      const info = await this.getAccountInfo();
      console.log(`Account balance: $${info.balance}`);
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
      console.error('Error getting account info:', error);
      return null;
    }
  }

  async getPrices(symbols: string[]) {
    if (!this.connected) return {};
    try {
      const rates = await this.account.getRates(symbols);
      const prices: Record<string, number> = {};
      if (Array.isArray(rates)) {
        rates.forEach((rate: any) => {
          prices[rate.symbol] = (rate.bid + rate.ask) / 2;
        });
      }
      return prices;
    } catch (error) {
      console.error('Error fetching prices:', error);
      return {};
    }
  }

  async placeOrder(symbol: string, action: 'BUY' | 'SELL', volume: number, stopLoss?: number, takeProfit?: number) {
    if (!this.connected) {
      console.log('MT5 not connected - demo order only');
      return { orderId: `demo_${Date.now()}`, filledPrice: 1.0892, success: false };
    }

    try {
      const order = {
        symbol: symbol.replace('/', ''),
        type: action === 'BUY' ? 'ORDER_TYPE_BUY' : 'ORDER_TYPE_SELL',
        volume: volume,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        comment: 'ForexPulse Bot'
      };
      
      const result = await this.account.trade(order);
      console.log(`✅ Order placed: ${action} ${symbol} at ${result.price}`);
      return { orderId: result.orderId, filledPrice: result.price, success: true };
    } catch (error) {
      console.error('Error placing order:', error);
      return { success: false, error: error };
    }
  }

  async getOpenPositions() {
    if (!this.connected) return [];
    try {
      const positions = await this.account.getPositions();
      return positions;
    } catch (error) {
      console.error('Error getting positions:', error);
      return [];
    }
  }

  async closeOrder(orderId: string) {
    if (!this.connected) return false;
    try {
      await this.account.trade({ orderId: orderId, action: 'CLOSE' });
      console.log(`✅ Order closed: ${orderId}`);
      return true;
    } catch (error) {
      console.error('Error closing order:', error);
      return false;
    }
  }

  isConnected() {
    return this.connected;
  }
  }
