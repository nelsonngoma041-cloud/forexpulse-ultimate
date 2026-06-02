// Real-time WebSocket price feed
export class LivePriceWebSocket {
  private ws: WebSocket | null = null;
  private subscribers: Map<string, Set<(price: number) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;
    
    // Free demo WebSocket (replace with your broker's URL)
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://stream-fxpractice.oanda.com/v3/accounts';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.authenticate();
        this.subscribeToSymbols();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handlePriceUpdate(data);
        } catch (e) {
          // Handle binary data or non-JSON messages
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected, reconnecting...');
        this.isConnecting = false;
        this.reconnect();
      };
    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.isConnecting = false;
    }
  }

  private authenticate() {
    const apiKey = process.env.NEXT_PUBLIC_OANDA_API_KEY;
    if (apiKey && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'authenticate',
        apiKey: apiKey
      }));
    }
  }

  private subscribeToSymbols() {
    const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'NZD/USD', 'USD/CHF'];
    symbols.forEach(symbol => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          instrument: symbol.replace('/', '_')
        }));
      }
    });
  }

  private handlePriceUpdate(data: any) {
    const symbol = data.instrument?.replace('_', '/');
    const price = data.bids?.[0]?.price || data.price || data.close;
    
    if (symbol && price && this.subscribers.has(symbol)) {
      this.subscribers.get(symbol)?.forEach(cb => cb(parseFloat(price)));
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = 5000 * Math.pow(2, this.reconnectAttempts - 1);
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
      setTimeout(() => this.connect(), delay);
    }
  }

  subscribe(symbol: string, callback: (price: number) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.get(symbol)?.delete(callback);
      if (this.subscribers.get(symbol)?.size === 0) {
        this.subscribers.delete(symbol);
      }
    };
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Mock WebSocket for development (no API key needed)
export class MockPriceWebSocket {
  private subscribers: Map<string, Set<(price: number) => void>> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private basePrices: Record<string, number> = {
    'EUR/USD': 1.0892,
    'GBP/USD': 1.2715,
    'USD/JPY': 157.85,
    'AUD/USD': 0.6620,
    'USD/CAD': 1.3740,
    'NZD/USD': 0.6130,
    'USD/CHF': 0.8840,
  };

  subscribe(symbol: string, callback: (price: number) => void): () => void {
    if (!this.subscribers.has(symbol)) {
      this.subscribers.set(symbol, new Set());
    }
    this.subscribers.get(symbol)!.add(callback);
    
    // Start price simulation if not already running
    if (!this.intervals.has(symbol)) {
      const interval = setInterval(() => {
        const currentPrice = this.basePrices[symbol];
        if (currentPrice) {
          // Random walk with small drift
          const change = (Math.random() - 0.5) * 0.0003;
          const newPrice = Number((currentPrice + change).toFixed(5));
          this.basePrices[symbol] = newPrice;
          this.subscribers.get(symbol)?.forEach(cb => cb(newPrice));
        }
      }, 1000);
      this.intervals.set(symbol, interval);
    }
    
    // Initial callback with current price
    callback(this.basePrices[symbol]);
    
    return () => {
      this.subscribers.get(symbol)?.delete(callback);
      if (this.subscribers.get(symbol)?.size === 0) {
        const interval = this.intervals.get(symbol);
        if (interval) clearInterval(interval);
        this.intervals.delete(symbol);
      }
    };
  }

  disconnect() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
    this.subscribers.clear();
  }
}
