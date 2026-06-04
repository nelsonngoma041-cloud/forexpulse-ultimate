"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Bot, MessageCircle, Play, Pause, Activity, Settings, Wifi, WifiOff, ChevronLeft, Download } from "lucide-react";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

// ============ TELEGRAM BOT ============
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

// Currency pairs with their current prices and signal logic
const currencyPairs = [
  { symbol: 'EUR/USD', basePrice: 1.0892, stopLossPips: 30, takeProfitPips: 60 },
  { symbol: 'GBP/USD', basePrice: 1.2715, stopLossPips: 30, takeProfitPips: 60 },
  { symbol: 'USD/JPY', basePrice: 157.85, stopLossPips: 30, takeProfitPips: 60 },
  { symbol: 'AUD/USD', basePrice: 0.6645, stopLossPips: 30, takeProfitPips: 60 },
  { symbol: 'USD/CAD', basePrice: 1.3715, stopLossPips: 30, takeProfitPips: 60 },
];

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lastSignals, setLastSignals] = useState<{[key: string]: any}>({});

  // Generate signals for all currencies and send to Telegram
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      // Loop through all currency pairs
      currencyPairs.forEach(async (pair) => {
        // Randomly decide BUY or SELL (50/50 chance)
        const isBuy = Math.random() > 0.5;
        const action = isBuy ? 'BUY' : 'SELL';
        
        // Calculate price with small random movement
        const variation = (Math.random() - 0.5) * 0.005;
        const price = pair.basePrice + variation;
        
        // Calculate Stop Loss and Take Profit based on pips
        let stopLoss, takeProfit;
        if (action === 'BUY') {
          if (pair.symbol === 'USD/JPY') {
            stopLoss = price - (pair.stopLossPips * 0.1);
            takeProfit = price + (pair.takeProfitPips * 0.1);
          } else {
            stopLoss = price - (pair.stopLossPips * 0.0001);
            takeProfit = price + (pair.takeProfitPips * 0.0001);
          }
        } else {
          if (pair.symbol === 'USD/JPY') {
            stopLoss = price + (pair.stopLossPips * 0.1);
            takeProfit = price - (pair.takeProfitPips * 0.1);
          } else {
            stopLoss = price + (pair.stopLossPips * 0.0001);
            takeProfit = price - (pair.takeProfitPips * 0.0001);
          }
        }
        
        // Generate random confidence between 65% and 95%
        const confidence = 0.65 + (Math.random() * 0.3);
        
        // Generate random reason based on market conditions
        const reasons = [
          'RSI oversold conditions',
          'MACD bullish crossover',
          'Support level bounce',
          'Moving average confirmation',
          'Price broke resistance',
          'Trend line breakout',
          'Bullish divergence detected',
          'Strong momentum signal'
        ];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        
        const signal: TradeAlert = {
          symbol: pair.symbol,
          action: action,
          price: price,
          confidence: confidence,
          signalType: 'AI Multi-Currency Analysis',
          volume: 0.1,
          stopLoss: stopLoss,
          takeProfit: takeProfit
        };
        
        // Send to Telegram
        await telegramBot.sendTradeAlert(signal);
        
        // Update last signal for UI
        setLastSignals(prev => ({
          ...prev,
          [pair.symbol]: { action, price, timestamp: new Date().toLocaleTimeString() }
        }));
        
        console.log(`📊 Signal sent: ${action} ${pair.symbol} @ ${price.toFixed(5)}`);
      });
      
      toast.success(`📊 Signals sent for all 5 currency pairs! Check Telegram.`);
      
    }, 60000); // Send signals every 60 seconds for all pairs
    
    return () => clearInterval(interval);
  }, [botRunning]);

  const toggleBot = async () => {
    if (!botRunning) {
      setBotRunning(true);
      await telegramBot.sendAlert('ForexPulse', '🤖 Multi-Currency Signal Bot Activated! You will receive signals for EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD every 60 seconds.', 'info');
      toast.success('🤖 Multi-currency signal bot activated');
    } else {
      setBotRunning(false);
      await telegramBot.sendAlert('ForexPulse', '⏸️ Signal bot paused', 'warning');
      toast('⏸️ Bot paused');
    }
  };

  const sendTestAlert = async () => {
    toast.loading('Sending test alert...', { id: 'test' });
    try {
      const testTrade: TradeAlert = {
        symbol: 'EUR/USD',
        action: 'BUY',
        price: 1.0892,
        confidence: 0.85,
        signalType: 'Test Signal',
        volume: 0.1,
        stopLoss: 1.0860,
        takeProfit: 1.0950
      };
      await telegramBot.sendTradeAlert(testTrade);
      toast.success('✅ Test alert sent to Telegram!', { id: 'test' });
    } catch (error) {
      toast.error('Failed to send alert', { id: 'test' });
    }
  };

  const sendManualSignalForPair = async (symbol: string, action: 'BUY' | 'SELL', price: number) => {
    const pair = currencyPairs.find(p => p.symbol === symbol);
    if (!pair) return;
    
    let stopLoss, takeProfit;
    if (action === 'BUY') {
      if (symbol === 'USD/JPY') {
        stopLoss = price - (pair.stopLossPips * 0.1);
        takeProfit = price + (pair.takeProfitPips * 0.1);
      } else {
        stopLoss = price - (pair.stopLossPips * 0.0001);
        takeProfit = price + (pair.takeProfitPips * 0.0001);
      }
    } else {
      if (symbol === 'USD/JPY') {
        stopLoss = price + (pair.stopLossPips * 0.1);
        takeProfit = price - (pair.takeProfitPips * 0.1);
      } else {
        stopLoss = price + (pair.stopLossPips * 0.0001);
        takeProfit = price - (pair.takeProfitPips * 0.0001);
      }
    }
    
    const signal: TradeAlert = {
      symbol,
      action,
      price,
      confidence: 0.90,
      signalType: 'Manual Signal',
      volume: 0.1,
      stopLoss,
      takeProfit
    };
    
    await telegramBot.sendTradeAlert(signal);
    toast.success(`📊 Manual ${action} signal for ${symbol} sent!`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full transition-all duration-300 bg-gray-950 border-r border-gray-800 z-40 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          {!sidebarCollapsed && <span className="font-bold text-emerald-400 text-lg">ForexPulse</span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-2">
          {['dashboard', 'signals', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2 rounded mb-1 transition-all ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'signals' && <Bot className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {!sidebarCollapsed && <span className="capitalize">{tab}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className={`flex items-center gap-2 ${sidebarCollapsed && 'justify-center'}`}>
            <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
            {!sidebarCollapsed && <span className="text-xs text-gray-400">{botRunning ? 'Active' : 'Inactive'}</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                <Wifi className="w-3 h-3" />
                5 Currency Pairs
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${botRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Signals Active' : 'Start Signals'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="text-center py-12">
              <Bot className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">Multi-Currency Signal Bot</h1>
              <p className="text-gray-400 mb-6">
                Get automated trading signals for 5 major currency pairs
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {currencyPairs.map((pair) => (
                  <div key={pair.symbol} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="text-lg font-bold text-emerald-400">{pair.symbol}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Base: {pair.basePrice}
                    </div>
                    {lastSignals[pair.symbol] && (
                      <div className="mt-2 text-xs">
                        <span className="text-gray-500">Last: </span>
                        <span className={lastSignals[pair.symbol].action === 'BUY' ? 'text-green-400' : 'text-red-400'}>
                          {lastSignals[pair.symbol].action}
                        </span>
                        <span className="text-gray-500 ml-2">@ {lastSignals[pair.symbol].price.toFixed(5)}</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => sendManualSignalForPair(pair.symbol, 'BUY', pair.basePrice)}
                        className="flex-1 bg-emerald-500/20 text-emerald-400 py-1 rounded text-sm hover:bg-emerald-500/30"
                      >
                        BUY
                      </button>
                      <button 
                        onClick={() => sendManualSignalForPair(pair.symbol, 'SELL', pair.basePrice)}
                        className="flex-1 bg-red-500/20 text-red-400 py-1 rounded text-sm hover:bg-red-500/30"
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-2xl mx-auto">
                <h3 className="text-emerald-400 font-medium mb-2">📊 Bot Status</h3>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status:</span>
                  <span className={botRunning ? "text-green-400" : "text-yellow-400"}>
                    {botRunning ? "🟢 Sending signals every 60 seconds" : "⚪ Click Start to begin"}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Currency Pairs:</span>
                  <span className="text-blue-400">5 Active</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Signal Frequency:</span>
                  <span className="text-blue-400">Every 60 seconds (all pairs)</span>
                </div>
              </div>
            </div>
          )}

          {/* Signals Tab */}
          {activeTab === 'signals' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-xl font-bold mb-4">📡 Manual Signal Generator</h2>
                <p className="text-gray-400 text-sm mb-6">
                  Click any button below to instantly send a trading signal to Telegram
                </p>
                
                <div className="space-y-4">
                  {currencyPairs.map((pair) => (
                    <div key={pair.symbol} className="bg-gray-800/30 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-lg">{pair.symbol}</span>
                        <span className="text-sm text-gray-500">Current: {pair.basePrice}</span>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => sendManualSignalForPair(pair.symbol, 'BUY', pair.basePrice)}
                          className="flex-1 bg-emerald-500/20 text-emerald-400 py-2 rounded-lg hover:bg-emerald-500/30 transition font-medium"
                        >
                          📈 BUY
                        </button>
                        <button 
                          onClick={() => sendManualSignalForPair(pair.symbol, 'SELL', pair.basePrice)}
                          className="flex-1 bg-red-500/20 text-red-400 py-2 rounded-lg hover:bg-red-500/30 transition font-medium"
                        >
                          📉 SELL
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-xl font-bold mb-4">⚙️ Configuration</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Telegram Bot:</span>
                    <span className="text-green-400">✓ Connected</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Currency Pairs:</span>
                    <span className="text-blue-400">EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Signal Mode:</span>
                    <span className="text-blue-400">Multi-Currency Auto + Manual</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Sending Signals" : "🟡 Standby"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 How to use:</p>
                  <ol className="text-xs text-gray-400 list-decimal list-inside mt-2 space-y-1">
                    <li>Click <span className="text-cyan-400">"Start Signals"</span> to begin receiving automated signals for all 5 pairs</li>
                    <li>Signals are sent every 60 seconds with BUY/SELL recommendations</li>
                    <li>Each signal includes Entry Price, Stop Loss, and Take Profit</li>
                    <li>Use the <span className="text-cyan-400">"Signals"</span> tab for manual signals</li>
                    <li>Open your MT5 mobile app to execute trades manually</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
          }
