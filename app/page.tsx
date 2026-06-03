"use client";

import { useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { Bot, MessageCircle, Play, Pause, Activity, Settings, Wifi, ChevronLeft } from "lucide-react";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

// Initialize Telegram bot with your working token
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  const toggleBot = async () => {
    setBotRunning(!botRunning);
    await telegramBot.sendAlert('Trading Bot', botRunning ? 'Bot paused' : 'Bot activated', 'info');
    toast.success(botRunning ? 'Bot paused' : 'Bot activated');
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
      toast.success('✅ Alert sent to Telegram! Check your phone.', { id: 'test' });
    } catch (error) {
      toast.error('Failed to send alert', { id: 'test' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Toaster position="top-right" />
      
      <aside className={`fixed left-0 top-0 h-full transition-all duration-300 bg-gray-950 border-r border-gray-800 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          {!sidebarCollapsed && <span className="font-bold text-emerald-400">ForexPulse</span>}
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
            {!sidebarCollapsed && <span className="text-xs text-gray-400">{botRunning ? 'Bot Active' : 'Bot Inactive'}</span>}
          </div>
        </div>
      </aside>

      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Wifi className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-gray-400">Live Demo Mode</span>
          </div>
          <div className="flex gap-2">
            <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
              <MessageCircle className="w-4 h-4" /> Test Alert
            </button>
            <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${botRunning ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
              {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {botRunning ? 'Bot Active' : 'Start Bot'}
            </button>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="text-center py-20">
              <Bot className="w-20 h-20 text-emerald-400 mx-auto mb-4" />
              <h1 className="text-3xl font-bold mb-2">ForexPulse is Running!</h1>
              <p className="text-gray-400 mb-6">Your Telegram bot is configured and ready to send alerts.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-green-400 text-2xl mb-2">✓</div>
                  <div className="font-medium">Bot Token</div>
                  <div className="text-xs text-gray-500">Configured</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className="text-green-400 text-2xl mb-2">✓</div>
                  <div className="font-medium">Chat ID</div>
                  <div className="text-xs text-gray-500">7724961440</div>
                </div>
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                  <div className={`text-2xl mb-2 ${botRunning ? 'text-green-400' : 'text-yellow-400'}`}>{botRunning ? '●' : '○'}</div>
                  <div className="font-medium">Bot Status</div>
                  <div className="text-xs text-gray-500">{botRunning ? 'Active' : 'Standby'}</div>
                </div>
              </div>
              
              <button onClick={sendTestAlert} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-6 py-3 rounded-lg font-medium">
                📱 Send Test Alert to Telegram
              </button>
              
              <p className="text-xs text-gray-500 mt-6">
                Make sure you have started a chat with your bot first (search for it on Telegram and click "Start")
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h2 className="text-xl font-bold mb-4">⚙️ Configuration</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Telegram Bot Token:</span>
                    <span className="text-green-400">✓ Configured</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Telegram Chat ID:</span>
                    <span className="text-green-400">7724961440</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Running" : "🟡 Stopped"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 To receive alerts, message your bot on Telegram first:</p>
                  <p className="text-xs text-gray-400 mt-2">Search for your bot → Click "Start" → Type /start → Then click Test Alert</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
