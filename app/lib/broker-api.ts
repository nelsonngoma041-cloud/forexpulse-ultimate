import axios from 'axios';

export interface BrokerOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  stopLoss?: number;
  takeProfit?: number;
  comment?: string;
}

export interface BrokerPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface AccountSummary {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  unrealizedPnL: number;
}

// OANDA REST API Integration
export class OandaBrokerAPI {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OANDA_API_KEY || '';
    this.accountId = process.env.OANDA_ACCOUNT_ID || '';
    // Use practice/demo environment by default
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-fxtrade.oanda.com/v3'
      : 'https://api-fxpractice.oanda.com/v3';
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.accountId;
  }

  async getAccountSummary(): Promise<AccountSummary | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/accounts/${this.accountId}/summary`, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      const account = response.data.account;
      return {
        balance: parseFloat(account.balance),
        equity: parseFloat(account.nav),
        margin: parseFloat(account.marginUsed),
        freeMargin: parseFloat(account.marginAvailable),
        marginLevel: parseFloat(account.marginRate) * 100,
        unrealizedPnL: parseFloat(account.unrealizedPL),
      };
    } catch (error) {
      console.error('OANDA account fetch error:', error);
      return null;
    }
  }

  async getPrices(symbols: string[]): Promise<Record<string, number>> {
    try {
      const instruments = symbols.map(s => s.replace('/', '_')).join(',');
      const response = await axios.get(`${this.baseUrl}/accounts/${this.accountId}/pricing`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        params: { instruments }
      });
      
      const prices: Record<string, number> = {};
      response.data.prices.forEach((price: any) => {
        const symbol = price.instrument.replace('_', '/');
        const bid = parseFloat(price.bids[0].price);
        const ask = parseFloat(price.asks[0].price);
        prices[symbol] = (bid + ask) / 2;
      });
      return prices;
    } catch (error) {
      console.error('OANDA price fetch error:', error);
      return {};
    }
  }

  async placeMarketOrder(order: BrokerOrder): Promise<{ orderId: string; filledPrice: number; filledUnits: number } | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/accounts/${this.accountId}/orders`, {
        order: {
          type: 'MARKET',
          instrument: order.symbol.replace('/', '_'),
          units: order.side === 'BUY' ? order.units : -order.units,
          stopLossOnFill: order.stopLoss ? {
            price: order.stopLoss.toString(),
            timeInForce: 'GTC'
          } : undefined,
          takeProfitOnFill: order.takeProfit ? {
            price: order.takeProfit.toString(),
            timeInForce: 'GTC'
          } : undefined,
        }
      }, {
        headers: { 
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      const transaction = response.data.orderFillTransaction;
      return {
        orderId: transaction.id,
        filledPrice: parseFloat(transaction.price),
        filledUnits: Math.abs(transaction.units)
      };
    } catch (error: any) {
      console.error('Order placement error:', error.response?.data || error.message);
      return null;
    }
  }

  async getOpenPositions(): Promise<BrokerPosition[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/accounts/${this.accountId}/positions`, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      
      return response.data.positions
        .filter((p: any) => p.long.units !== '0' || p.short.units !== '0')
        .map((p: any) => {
          const isLong = p.long.units !== '0';
          return {
            id: p.instrument,
            symbol: p.instrument.replace('_', '/'),
            side: isLong ? 'BUY' : 'SELL',
            units: parseFloat(isLong ? p.long.units : p.short.units),
            avgPrice: parseFloat(isLong ? p.long.averagePrice : p.short.averagePrice),
            currentPrice: 0,
            pnl: parseFloat(p.unrealizedPL),
            pnlPercent: 0,
            stopLoss: isLong ? (p.long.stopLossOrder?.price ? parseFloat(p.long.stopLossOrder.price) : undefined) : undefined,
            takeProfit: isLong ? (p.long.takeProfitOrder?.price ? parseFloat(p.long.takeProfitOrder.price) : undefined) : undefined,
          };
        });
    } catch (error) {
      console.error('Fetch positions error:', error);
      return [];
    }
  }

  async closePosition(positionId: string, units?: number): Promise<boolean> {
    try {
      const response = await axios.delete(`${this.baseUrl}/accounts/${this.accountId}/positions/${positionId}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        params: units ? { units: units.toString() } : {}
      });
      return response.status === 200;
    } catch (error) {
      console.error('Close position error:', error);
      return false;
    }
  }
}

// MT5 Bridge via REST API
export class MT5BrokerAPI {
  private gatewayUrl: string;
  private apiKey: string;

  constructor() {
    this.gatewayUrl = process.env.MT5_GATEWAY_URL || 'http://localhost:3001';
    this.apiKey = process.env.MT5_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.gatewayUrl && !!this.apiKey;
  }

  async executeTrade(symbol: string, action: 'buy' | 'sell', volume: number, sl?: number, tp?: number, comment?: string): Promise<any> {
    try {
      const response = await axios.post(`${this.gatewayUrl}/api/trade`, {
        symbol,
        action,
        volume,
        sl,
        tp,
        comment,
        apiKey: this.apiKey
      });
      return response.data;
    } catch (error) {
      console.error('MT5 trade error:', error);
      return null;
    }
  }

  async getAccountInfo(): Promise<any> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/api/account`, {
        params: { apiKey: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('MT5 account error:', error);
      return null;
    }
  }

  async getOpenPositions(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.gatewayUrl}/api/positions`, {
        params: { apiKey: this.apiKey }
      });
      return response.data;
    } catch (error) {
      console.error('MT5 positions error:', error);
      return [];
    }
  }

  async closePosition(ticket: number): Promise<boolean> {
    try {
      const response = await axios.post(`${this.gatewayUrl}/api/close`, {
        ticket,
        apiKey: this.apiKey
      });
      return response.data.success;
    } catch (error) {
      console.error('MT5 close error:', error);
      return false;
    }
  }
}
