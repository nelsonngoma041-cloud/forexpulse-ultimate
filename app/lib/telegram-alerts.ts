export interface TradeAlert {
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  confidence: number;
  signalType: string;
  volume?: number;
  stopLoss?: number;
  takeProfit?: number;
}

export class TelegramAlertBot {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor() {
    this.botToken = '';
    this.chatId = '';
    this.baseUrl = '';
  }

  setToken(token: string, chatId: string) {
    this.botToken = token;
    this.chatId = chatId;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(message: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.error('Telegram not configured');
      return false;
    }

    try {
      const url = `${this.baseUrl}/sendMessage?chat_id=${this.chatId}&text=${encodeURIComponent(message)}&parse_mode=HTML`;
      const response = await fetch(url);
      const result = await response.json();
      return result.ok === true;
    } catch (error) {
      console.error('Telegram error:', error);
      return false;
    }
  }

  async sendTradeAlert(trade: TradeAlert): Promise<boolean> {
    const emoji = trade.action === 'BUY' ? '🟢' : '🔴';
    const directionEmoji = trade.action === 'BUY' ? '📈' : '📉';
    
    const message = `
${emoji} ${directionEmoji} <b>${trade.action} SIGNAL</b> ${directionEmoji} ${emoji}

<b>💰 Symbol:</b> ${trade.symbol}
<b>⚡ Action:</b> ${trade.action}
<b>💵 Entry Price:</b> ${trade.price}
<b>🎯 Confidence:</b> ${(trade.confidence * 100).toFixed(0)}%
<b>📊 Signal Type:</b> ${trade.signalType}
${trade.volume ? `<b>📦 Volume:</b> ${trade.volume}` : ''}
${trade.stopLoss ? `<b>🛑 Stop Loss:</b> ${trade.stopLoss}` : ''}
${trade.takeProfit ? `<b>🎯 Take Profit:</b> ${trade.takeProfit}` : ''}

<i>🤖 Automated trading bot executing order...</i>
    `;
    return this.sendMessage(message);
  }

  async sendAlert(title: string, message: string, severity: 'info' | 'warning' | 'error' = 'info'): Promise<boolean> {
    const icons = { info: 'ℹ️', warning: '⚠️', error: '🚨' };
    const fullMessage = `${icons[severity]} <b>${title}</b>\n\n${message}`;
    return this.sendMessage(fullMessage);
  }
}
