"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  Bot, MessageCircle, Play, Pause, Activity, Settings, 
  TrendingUp, TrendingDown, Shield, Wifi, WifiOff, 
  ChevronRight, ChevronLeft, Target, Download,
  BarChart3, Award, Zap
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";

const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

interface Position {
  id: string;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  currentPrice: number;
  volume: number;
  pnl: number;
  pnlPercent: number;
  stopLoss: number;
  takeProfit: number;
  frozen: boolean;
}

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [positions] = useState<Position[]>([
    { id: '1', symbol: 'EUR/USD', direction: 'LONG', entryPrice: 1.0850, currentPrice: 1.0892, volume: 0.1, pnl: 420, pnlPercent: 0.39, stopLoss: 1.0820, takeProfit: 1.0950, frozen: false },
    { id: '2', symbol: 'GBP/USD', direction: 'LONG', entryPrice: 1.2670, currentPrice: 1.2715, volume: 0.1, pnl: 450, pnlPercent: 0.36, stopLoss: 1.2640, takeProfit: 1.2770, frozen: true },
    { id: '3', symbol: 'USD/JPY', direction: 'SHORT', entryPrice: 157.20, currentPrice: 157.85, volume: 0.05, pnl: -325, pnlPercent: -0.21, stopLoss: 158.00, takeProfit: 156.00, frozen: false },
  ]);

  // Check bot status on load
  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const response = await fetch('/api/live-signals');
        const data = await response.json();
        setBotRunning(data.running);
      } catch (error) {
        console.error('Error checking bot status:', error);
      }
    };
    
    checkBotStatus();
    const interval = setInterval(checkBotStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;

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
      toast.success(botRunning ? 'Bot stopped' : 'Professional bot started - analyzing markets');
    }
  };

  const sendTestAlert = async () => {
    const response = await fetch('/api/live-signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' })
    });
    if (response.ok) {
      toast.success('Test signal sent to Telegram!');
    }
  };

  const equityData = [
    { time: '9:30', equity: 10000 }, { time: '10:00', equity: 10150 }, 
    { time: '10:30', equity: 10200 }, { time: '11:00', equity: 10180 }, 
    { time: '11:30', equity: 10300 }, { time: '12:00', equity: 10250 },
  ];

  const pnlData = [
    { date: 'Mon', pnl: 120 }, { date: 'Tue', pnl: -80 }, { date: 'Wed', pnl: 200 },
    { date: 'Thu', pnl: 150 }, { date: 'Fri', pnl: -50 }, { date: 'Sat', pnl: 180 }, { date: 'Sun', pnl: 90 },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Toaster position="top-right" />
      
      <aside className={`fixed left-0 top-0 h-full transition-all duration-300 bg-gray-950/95 border-r border-gray-800 z-40 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="p-4 border-b border-gray-800 flex justify-between items-center">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-400" />
              <span className="font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">ForexPulsePRO</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="text-gray-400 hover:text-white">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-3">
          {['dashboard', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${activeTab === tab ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white border-l-2 border-emerald-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {!sidebarCollapsed && <span className="capitalize text-sm">{tab}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-3">
          <div className="bg-gray-800/50 rounded-lg p-2">
            <div className="flex items-center gap-2">
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
              <button onClick={sendTestAlert} className="bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 hover:from-cyan-500/30 px-4 py-2 rounded-lg flex items-center gap-2 text-sm transition-all">
                <MessageCircle className="w-4 h-4" /> Test Signal
              </button>
              <button onClick={toggleBot} className={`px-5 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${botRunning ? 'bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-400' : 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-400'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Stop Bot' : 'Start Professional Trading'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-400">Total P&L</div>
                  <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(0)}
                  </div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-400">Win Rate</div>
                  <div className="text-2xl font-bold text-purple-400">{winRate.toFixed(0)}%</div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-400">Bot Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-sm">{botRunning ? 'Active' : 'Standby'}</span>
                  </div>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="text-xs text-gray-400">Data Source</div>
                  <div className="text-sm font-bold mt-1 text-blue-400">Twelve Data (Live)</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm text-gray-400 mb-4">Equity Curve</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={equityData}>
                      <CartesianGrid stroke="#1f2937" />
                      <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                      <Area type="monotone" dataKey="equity" stroke="#10b981" fill="#10b981" fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <h3 className="text-sm text-gray-400 mb-4">Daily P&L</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={pnlData}>
                      <CartesianGrid stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {pnlData.map((entry, idx) => <Cell key={idx} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="font-medium flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> Open Positions</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50">
                      <tr className="text-gray-400">
                        <th className="px-4 py-2 text-left">Symbol</th><th className="px-4 py-2 text-left">Direction</th>
                        <th className="px-4 py-2 text-left">Entry</th><th className="px-4 py-2 text-left">Current</th>
                        <th className="px-4 py-2 text-left">P&L</th><th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(p => (
                        <tr key={p.id} className="border-b border-gray-800/50">
                          <td className="px-4 py-3 font-medium">{p.symbol}</td>
                          <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${p.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{p.direction}</span></td>
                          <td className="px-4 py-3 font-mono">{p.entryPrice.toFixed(5)}</td>
                          <td className="px-4 py-3 font-mono text-blue-400">{p.currentPrice.toFixed(5)}</td>
                          <td className={`px-4 py-3 font-medium ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}</td>
                          <td className="px-4 py-3">{p.frozen ? <span className="flex items-center gap-1 text-yellow-400 text-xs"><Shield className="w-3 h-3" /> Frozen</span> : <span className="text-green-400 text-xs">Active</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                    <span className="text-gray-400">Twelve Data API:</span>
                    <span className="text-green-400">✓ Configured</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Analysis Engine:</span>
                    <span className="text-blue-400">RSI + MACD + MA</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Bot Status:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Professional Trading Active" : "🟡 Standby"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 How to use:</p>
                  <ol className="text-xs text-gray-400 list-decimal list-inside mt-2 space-y-1">
                    <li>Click <span className="text-cyan-400">"Start Professional Trading"</span></li>
                    <li>Bot analyzes 5 currency pairs every 60 seconds</li>
                    <li>Signals appear here and on Telegram</li>
                    <li>Each signal includes Entry, Stop Loss, Take Profit</li>
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
