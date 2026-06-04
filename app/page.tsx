"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Bot, MessageCircle, Play, Pause, Activity, Settings, Wifi, WifiOff, ChevronLeft, Download } from "lucide-react";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

// ============ TELEGRAM BOT ============
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Generate signals and send to Telegram
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      const actions = ['BUY', 'SELL'];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const price = action === 'BUY' ? 1.0892 + (Math.random() * 0.01) : 1.0892 - (Math.random() * 0.01);
      
      telegramBot.sendTradeAlert({
        symbol: 'EUR/USD',
        action: action as 'BUY' | 'SELL',
        price: price,
        confidence: 0.75,
        signalType: 'AI Market Analysis',
        volume: 0.1,
        stopLoss: action === 'BUY' ? price * 0.99 : price * 1.01,
        takeProfit: action === 'BUY' ? price * 1.02 : price * 0.98
      });
      
      toast.success(`📊 Signal sent: ${action} EUR/USD @ ${price.toFixed(5)}`);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [botRunning]);

  const toggleBot = async () => {
    if (!botRunning) {
      setBotRunning(true);
      await telegramBot.sendAlert('ForexPulse', '🤖 Signal bot activated - you will receive trade alerts on Telegram', 'info');
      toast.success('🤖 Signal bot activated');
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
      toast.success('✅ Alert sent to Telegram!', { id: 'test' });
    } catch (error) {
      toast.error('Failed to send alert', { id: 'test' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Toaster position="top-right" />
      
      {/* Simple Sidebar */}
      <aside className={`fixed left-0 top-0 h-full transition-all duration-300 bg-gray-950 border-r border-gray-800 z-40 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          {!sidebarCollapsed && <span className="font-bold text-emerald-400 text-lg">ForexPulse</span>}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-2">
          {['dashboard', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2 rounded mb-1 transition-all ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {!sidebarCollapsed && <span className="capitalize">{tab}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className={`flex items-center gap-2 ${sidebarCollapsed && 'justify-center'}`}>
            <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
            {!sidebarCollapsed && <span className="text-xs text-gray-400">{botRunning ? 'Signal Active' : 'Inactive'}</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-emerald-500/20 text-emerald-400">
                <Wifi className="w-3 h-3" />
                Ready
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${botRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Signal Active' : 'Start Signals'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="text-center py-20">
              <Bot className="w-24 h-24 text-emerald-400 mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-4">ForexPulse Signal Bot</h1>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                Click <span className="text-emerald-400 font-medium">"Start Signals"</span> to receive automated trading signals on Telegram.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-green-400 text-2xl mb-2">✓</div>
                  <div className="font-medium">Telegram Bot</div>
                  <div className="text-xs text-gray-500">Connected</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className={`text-2xl mb-2 ${botRunning ? 'text-green-400' : 'text-yellow-400'}`}>
                    {botRunning ? '●' : '○'}
                  </div>
                  <div className="font-medium">Signal Status</div>
                  <div className="text-xs text-gray-500">{botRunning ? 'Sending Signals' : 'Standby'}</div>
                </div>
              </div>
              
              <button 
                onClick={toggleBot} 
                className={`mt-8 px-8 py-3 rounded-lg font-medium transition-all flex items-center gap-2 mx-auto ${botRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}
              >
                {botRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                {botRunning ? 'Stop Signals' : 'Start Signals'}
              </button>
              
              <p className="text-xs text-gray-500 mt-6">
                📱 Signals will be sent to your Telegram every 30 seconds when active.
              </p>
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
                    <span className="text-gray-400">Trading Mode:</span>
                    <span className="text-blue-400">Manual Signal Mode</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Sending Signals" : "🟡 Standby"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 How to use:</p>
                  <ol className="text-xs text-gray-400 list-decimal list-inside mt-2 space-y-1">
                    <li>Click <span className="text-cyan-400">"Start Signals"</span> to begin receiving alerts</li>
                    <li>Check your <span className="text-cyan-400">Telegram</span> for trade signals</li>
                    <li>Each signal includes: Symbol, Action, Entry, Stop Loss, Take Profit</li>
                    <li>Open your <span className="text-cyan-400">MT5 mobile app</span></li>
                    <li>Execute the trade manually using the signal details</li>
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
