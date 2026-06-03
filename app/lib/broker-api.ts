export interface BrokerOrder {
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface BrokerPosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  units: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  stopLoss?: number;
  takeProfit?: number;
}

// Alpha Vantage API for live prices
export class AlphaVantageAPI {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ALPHA_VANTAGE_KEY || 'MUTVWYGAE0PTMVI1';
  }

  async getLivePrice(symbol: string): Promise<number | null> {
    try {
      const fromTo = symbol.replace('/', '');
      const fromCurrency = fromTo.slice(0, 3);
      const toCurrency = fromTo.slice(3);
      const url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${fromCurrency}&to_currency=${toCurrency}&apikey=${this.apiKey}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data['Realtime Currency Exchange Rate']) {
        return parseFloat(data['Realtime Currency Exchange Rate']['5. Exchange Rate']);
      }
      return null;
    } catch (error) {
      console.error('Alpha Vantage error:', error);
      return null;
    }
  }

  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    const prices: Record<string, number> = {};
    for (const symbol of symbols) {
      const price = await this.getLivePrice(symbol);
      if (price) prices[symbol] = price;
      // Rate limiting: 5 calls per minute, add delay
      await new Promise(resolve => setTimeout(resolve, 12000));
    }
    return prices;
  }
}

// OANDA Broker API (placeholder - add your keys when ready)
export class OandaBrokerAPI {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.OANDA_API_KEY || '';
    this.accountId = process.env.OANDA_ACCOUNT_ID || '';
    this.baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api-fxtrade.oanda.com/v3'
      : 'https://api-fxpractice.oanda.com/v3';
  }

  isConfigured(): boolean {
    return !!this.apiKey && !!this.accountId;
  }

  async placeMarketOrder(order: BrokerOrder): Promise<{ orderId: string; filledPrice: number } | null> {
    if (!this.isConfigured()) {
      console.log('OANDA not configured - mock order placed');
      return { orderId: 'mock_' + Date.now(), filledPrice: 1.0892 };
    }
    // Actual OANDA implementation would go here
    return null;
  }
}

// MT5 Broker API (placeholder)
export class MT5BrokerAPI {
  private gatewayUrl: string;
  private apiKey: string;

  constructor() {
    this.gatewayUrl = process.env.MT5_GATEWAY_URL || '';
    this.apiKey = process.env.MT5_API_KEY || '';
  }

  isConfigured(): boolean {
    return !!this.gatewayUrl && !!this.apiKey;
  }
}
