"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  Bot, MessageCircle, Play, Pause, Activity, Settings, 
  Wifi, WifiOff, ChevronLeft, TrendingUp, TrendingDown, 
  BarChart3, Target, Shield, AlertCircle, Zap, Award
} from "lucide-react";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [botStatus, setBotStatus] = useState({ running: false, message: '' });

  useEffect(() => {
    fetch('/api/live-signals')
      .then(res => res.json())
      .then(data => {
        setBotRunning(data.running);
        setBotStatus(data);
      })
      .catch(console.error);
  }, []);

  const toggleBot = async () => {
    const action = botRunning ? 'stop' : 'start';
    const response = await fetch('/api/live-signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    const result = await response.json();
    
    if (result.success) {
      setBotRunning(!botRunning);
      toast.success(botRunning ? 'Trading bot stopped' : 'Professional trading bot started - analyzing RSI, MACD, and trends');
    }
  };

  const sendTestAlert = async () => {
    const testSignal: TradeAlert = {
      symbol: 'EUR/USD',
      action: 'BUY',
      price: 1.0892,
      confidence: 0.92,
      signalType: 'RSI Oversold + MACD Bullish Crossover',
      volume: 0.1,
      stopLoss: 1.0860,
      takeProfit: 1.0950
    };
    await telegramBot.sendTradeAlert(testSignal);
    toast.success('Test signal sent! Check Telegram');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full transition-all duration-300 bg-gray-950/95 backdrop-blur-xl border-r border-gray-800 z-40 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span className="font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">ForexPulse</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">PRO</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-3">
          {['dashboard', 'signals', 'analysis', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${activeTab === tab ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white border-l-2 border-emerald-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'signals' && <Target className="w-4 h-4" />}
              {tab === 'analysis' && <BarChart3 className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {!sidebarCollapsed && <span className="capitalize text-sm">{tab}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <div className={`bg-gray-800/50 rounded-lg p-2 ${sidebarCollapsed ? 'text-center' : ''}`}>
            <div className={`flex items-center gap-2 ${sidebarCollapsed && 'justify-center'}`}>
              <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              {!sidebarCollapsed && (
                <div className="flex-1">
                  <p className="text-xs text-gray-400">{botRunning ? 'Trading Active' : 'Standby'}</p>
                  <p className="text-[10px] text-gray-500">24/7 Server Mode</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="text-xs text-emerald-400">Live Market Data</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <BarChart3 className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-blue-400">RSI • MACD • MA</span>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={sendTestAlert} className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 hover:to-blue-500/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all">
                <MessageCircle className="w-4 h-4" /> Test Signal
              </button>
              <button onClick={toggleBot} className={`px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${botRunning ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400 hover:from-red-500/30' : 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400 hover:from-emerald-500/30'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Stop Bot' : 'Start Professional Trading'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="bg-gradient-to-r from-gray-900 to-gray-950 rounded-2xl p-8 border border-gray-800">
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-10 h-10 text-emerald-400" />
                  <div>
                    <h1 className="text-2xl font-bold">Professional Trading Bot</h1>
                    <p className="text-gray-400 text-sm">Real-time market analysis using RSI, MACD & Moving Averages</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Technical Analysis</p>
                      <p className="text-sm font-medium">RSI • MACD • MA</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Target className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Risk Management</p>
                      <p className="text-sm font-medium">SL/TP Protection</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">24/7 Operation</p>
                      <p className="text-sm font-medium">Cloud-Based Server</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="font-medium mb-4 flex items-center gap-2">🤖 Bot Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Status</span>
                      <span className={botRunning ? "text-emerald-400 font-medium" : "text-yellow-400"}>
                        {botRunning ? "🟢 Active - Analyzing Markets" : "⚪ Inactive"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Analysis Method</span>
                      <span className="text-blue-400">RSI + MACD + MA Crossover</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Currency Pairs</span>
                      <span className="text-blue-400">5 Major Pairs</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400">Signal Frequency</span>
                      <span className="text-blue-400">Every 60 seconds</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="font-medium mb-4 flex items-center gap-2">📊 What We Analyze</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                      <span className="text-sm">Relative Strength Index (RSI) - Oversold/Overbought</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                      <span className="text-sm">MACD - Trend Direction & Momentum</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                      <span className="text-sm">50 & 200 Moving Averages - Trend Confirmation</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                      <span className="text-sm">Support & Resistance Levels</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'signals' && (
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
              <Bot className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Professional Signals</h2>
              <p className="text-gray-400 mb-6">Signals are generated using real-time technical analysis</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-gray-800/50 rounded-xl p-4 text-left">
                  <div className="text-emerald-400 text-sm mb-2">BUY Signal Example</div>
                  <div className="text-xs text-gray-400">RSI: 28 (Oversold)</div>
                  <div className="text-xs text-gray-400">MACD: Bullish Crossover</div>
                  <div className="text-xs text-gray-400">Price: Above 200 MA</div>
                  <div className="text-xs text-emerald-400 mt-2">→ BUY with 92% confidence</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-4 text-left">
                  <div className="text-red-400 text-sm mb-2">SELL Signal Example</div>
                  <div className="text-xs text-gray-400">RSI: 72 (Overbought)</div>
                  <div className="text-xs text-gray-400">MACD: Bearish Crossover</div>
                  <div className="text-xs text-gray-400">Price: Below 50 MA</div>
                  <div className="text-xs text-red-400 mt-2">→ SELL with 88% confidence</div>
                </div>
              </div>
              
              <button onClick={toggleBot} className={`mt-6 px-6 py-3 rounded-xl font-medium transition-all ${botRunning ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {botRunning ? 'Stop Bot' : 'Start Professional Trading'}
              </button>
            </div>
          )}

          {activeTab === 'analysis' && (
            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">Technical Indicators Explained</h2>
              <div className="space-y-4">
                <div className="p-4 bg-gray-800/30 rounded-xl">
                  <h3 className="font-medium text-emerald-400 mb-2">📈 RSI (Relative Strength Index)</h3>
                  <p className="text-sm text-gray-400">Measures momentum on a scale of 0-100. Below 30 = Oversold (Buy signal). Above 70 = Overbought (Sell signal).</p>
                </div>
                <div className="p-4 bg-gray-800/30 rounded-xl">
                  <h3 className="font-medium text-blue-400 mb-2">📊 MACD (Moving Average Convergence Divergence)</h3>
                  <p className="text-sm text-gray-400">Shows trend direction and momentum. Bullish crossover when MACD crosses above signal line.</p>
                </div>
                <div className="p-4 bg-gray-800/30 rounded-xl">
                  <h3 className="font-medium text-purple-400 mb-2">📉 Moving Averages (50 & 200)</h3>
                  <p className="text-sm text-gray-400">Identifies trend direction. Golden cross (50 above 200) signals uptrend. Death cross signals downtrend.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h2 className="text-xl font-bold mb-4">⚙️ Configuration</h2>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Telegram Bot:</span>
                    <span className="text-green-400">✓ Connected</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Analysis Engine:</span>
                    <span className="text-blue-400">RSI + MACD + MA</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Currency Pairs:</span>
                    <span className="text-blue-400">EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Professional Trading Active" : "🟡 Standby"}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
                                                                                                                                                                      }
