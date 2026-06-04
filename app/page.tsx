"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Bot, MessageCircle, Play, Pause, Activity, Settings, Wifi, WifiOff, ChevronLeft, Download, Server } from "lucide-react";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

// ============ TELEGRAM BOT ============
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

const currencyPairs = [
  { symbol: 'EUR/USD', basePrice: 1.0892 },
  { symbol: 'GBP/USD', basePrice: 1.2715 },
  { symbol: 'USD/JPY', basePrice: 157.85 },
  { symbol: 'AUD/USD', basePrice: 0.6645 },
  { symbol: 'USD/CAD', basePrice: 1.3715 },
];

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Check bot status on load
  useEffect(() => {
    fetch('/api/signals')
      .then(res => res.json())
      .then(data => setBotRunning(data.running))
      .catch(console.error);
  }, []);

  const toggleBot = async () => {
    const action = botRunning ? 'stop' : 'start';
    const response = await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const result = await response.json();
    
    if (result.success) {
      setBotRunning(!botRunning);
      toast.success(botRunning ? 'Signal bot stopped' : 'Signal bot started - running 24/7 on server');
    } else {
      toast.error('Failed to toggle bot');
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

  const sendManualSignal = async (symbol: string, action: 'BUY' | 'SELL', price: number) => {
    const isJpy = symbol === 'USD/JPY';
    let stopLoss, takeProfit;
    
    if (action === 'BUY') {
      if (isJpy) {
        stopLoss = price - 3.0;
        takeProfit = price + 6.0;
      } else {
        stopLoss = price - 0.0030;
        takeProfit = price + 0.0060;
      }
    } else {
      if (isJpy) {
        stopLoss = price + 3.0;
        takeProfit = price - 6.0;
      } else {
        stopLoss = price + 0.0030;
        takeProfit = price - 0.0060;
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
            {!sidebarCollapsed && <span className="text-xs text-gray-400">{botRunning ? 'Server Active' : 'Server Standby'}</span>}
          </div>
        </div>
      </aside>

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                <Server className="w-3 h-3" />
                24/7 Server Mode
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${botRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Signals Active' : 'Start 24/7 Signals'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="text-center py-12">
              <Bot className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold mb-2">24/7 Forex Signal Bot</h1>
              <p className="text-gray-400 mb-6">
                Signals run on Vercel servers - they continue even after you close your browser!
              </p>
              
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 max-w-md mx-auto mb-8">
                <p className="text-sm text-emerald-400">✓ Server runs 24/7</p>
                <p className="text-sm text-emerald-400 mt-1">✓ Signals continue after closing browser</p>
                <p className="text-sm text-emerald-400 mt-1">✓ Works while phone is locked</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {currencyPairs.map((pair) => (
                  <div key={pair.symbol} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                    <div className="text-lg font-bold text-emerald-400">{pair.symbol}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      Base: {pair.basePrice}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button 
                        onClick={() => sendManualSignal(pair.symbol, 'BUY', pair.basePrice)}
                        className="flex-1 bg-emerald-500/20 text-emerald-400 py-1 rounded text-sm hover:bg-emerald-500/30"
                      >
                        BUY
                      </button>
                      <button 
                        onClick={() => sendManualSignal(pair.symbol, 'SELL', pair.basePrice)}
                        className="flex-1 bg-red-500/20 text-red-400 py-1 rounded text-sm hover:bg-red-500/30"
                      >
                        SELL
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-8 p-4 bg-gray-900 rounded-lg border border-gray-800 max-w-md mx-auto">
                <h3 className="text-emerald-400 font-medium mb-2">📊 Server Status</h3>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Status:</span>
                  <span className={botRunning ? "text-green-400" : "text-yellow-400"}>
                    {botRunning ? "🟢 Running 24/7" : "⚪ Click Start to begin"}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Signal Frequency:</span>
                  <span className="text-blue-400">Every 60 seconds</span>
                </div>
              </div>
            </div>
          )}

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
                          onClick={() => sendManualSignal(pair.symbol, 'BUY', pair.basePrice)}
                          className="flex-1 bg-emerald-500/20 text-emerald-400 py-2 rounded-lg hover:bg-emerald-500/30 transition font-medium"
                        >
                          📈 BUY
                        </button>
                        <button 
                          onClick={() => sendManualSignal(pair.symbol, 'SELL', pair.basePrice)}
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
                    <span className="text-blue-400">5 Major Pairs</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Runtime:</span>
                    <span className="text-blue-400">24/7 Server Mode</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Running 24/7" : "🟡 Standby"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 How it works:</p>
                  <ol className="text-xs text-gray-400 list-decimal list-inside mt-2 space-y-1">
                    <li>Click <span className="text-cyan-400">"Start 24/7 Signals"</span> once</li>
                    <li>The bot runs on Vercel servers - NOT your browser</li>
                    <li>Close the browser, lock your phone - signals continue!</li>
                    <li>Signals sent every 60 seconds for all 5 pairs</li>
                    <li>Use Telegram to receive alerts anywhere</li>
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
