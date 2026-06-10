"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  Bot, MessageCircle, Play, Pause, Activity, Settings, 
  TrendingUp, TrendingDown, Shield, Wifi, WifiOff, 
  DollarSign, ChevronRight, ChevronLeft, Target, Radar, Download,
  BarChart3, Award, Star, Zap, Clock, BookOpen, Percent
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import TradingViewChart from './components/TradingViewChart';

// ============ TYPES ============
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

// ============ MAIN COMPONENT ============
export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [useLiveData, setUseLiveData] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  const [accountBalance, setAccountBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [showRiskCalculator, setShowRiskCalculator] = useState(false);
  
  const [positions, setPositions] = useState<Position[]>([
    { id: '1', symbol: 'EUR/USD', direction: 'LONG', entryPrice: 1.0850, currentPrice: 1.0892, volume: 0.1, pnl: 420, pnlPercent: 0.39, stopLoss: 1.0820, takeProfit: 1.0950, frozen: false },
    { id: '2', symbol: 'GBP/USD', direction: 'LONG', entryPrice: 1.2670, currentPrice: 1.2715, volume: 0.1, pnl: 450, pnlPercent: 0.36, stopLoss: 1.2640, takeProfit: 1.2770, frozen: true },
    { id: '3', symbol: 'USD/JPY', direction: 'SHORT', entryPrice: 157.20, currentPrice: 157.85, volume: 0.05, pnl: -325, pnlPercent: -0.21, stopLoss: 158.00, takeProfit: 156.00, frozen: false },
    { id: '4', symbol: 'AUD/USD', direction: 'LONG', entryPrice: 0.6620, currentPrice: 0.6645, volume: 0.1, pnl: 250, pnlPercent: 0.38, stopLoss: 0.6590, takeProfit: 0.6680, frozen: false },
    { id: '5', symbol: 'USD/CAD', direction: 'SHORT', entryPrice: 1.3740, currentPrice: 1.3715, volume: 0.1, pnl: 250, pnlPercent: 0.18, stopLoss: 1.3770, takeProfit: 1.3680, frozen: false },
  ]);
  
  const [equityData] = useState([
    { time: '9:30', equity: 10000 }, { time: '10:00', equity: 10150 }, 
    { time: '10:30', equity: 10200 }, { time: '11:00', equity: 10180 }, 
    { time: '11:30', equity: 10300 }, { time: '12:00', equity: 10250 },
  ]);

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;
  const frozenCount = positions.filter(p => p.frozen).length;

  // Calculate position size
  const calculatePositionSize = (balance: number, risk: number, stopLossPips: number = 30): number => {
    const riskAmount = balance * (risk / 100);
    const positionSize = riskAmount / (stopLossPips * 10);
    return Math.min(positionSize, 0.1);
  };

  // Get Zambia trading hours
  const getTradingHours = () => {
    const now = new Date();
    const zambiaHour = now.getUTCHours() + 2;
    if (zambiaHour >= 15 && zambiaHour < 19) return { quality: 'Best', emoji: '🔥', message: 'Prime trading window' };
    if (zambiaHour >= 10 && zambiaHour < 15) return { quality: 'Good', emoji: '✅', message: 'Good trading window' };
    return { quality: 'Low', emoji: '⚠️', message: 'Low liquidity - trade with caution' };
  };

  // Check bot status on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch('/api/live-signals');
        const data = await response.json();
        setBotRunning(data.running);
      } catch (error) {
        console.error('Error checking status:', error);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // Simulate price updates
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      setPositions(prev => prev.map(p => ({
        ...p,
        currentPrice: p.currentPrice + (Math.random() - 0.5) * 0.0003,
        pnl: p.direction === 'LONG' 
          ? ((p.currentPrice + (Math.random() - 0.5) * 0.0003) - p.entryPrice) * 10000 * p.volume
          : (p.entryPrice - (p.currentPrice + (Math.random() - 0.5) * 0.0003)) * 10000 * p.volume,
      })));
      setWsConnected(true);
    }, 5000);
    return () => clearInterval(interval);
  }, [botRunning]);

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
      toast.success(botRunning ? 'Bot stopped' : 'Bot started - signals every 60 seconds');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
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
          {['dashboard', 'calculator', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${activeTab === tab ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white border-l-2 border-emerald-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'calculator' && <Percent className="w-4 h-4" />}
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
                  <p className="text-xs text-gray-400">{botRunning ? 'Signals Active' : 'Standby'}</p>
                  <p className="text-[10px] text-gray-500">Manual Trading Mode</p>
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
                <span className="text-xs text-emerald-400">{useLiveData ? 'Live Demo' : 'Demo Mode'}</span>
              </div>
              <button onClick={() => setUseLiveData(!useLiveData)} className={`text-xs px-2 py-1 rounded ${useLiveData ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                {useLiveData ? '📡 Live' : '🎮 Demo'}
              </button>
              <button onClick={() => setShowChart(!showChart)} className={`text-xs px-2 py-1 rounded ${showChart ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                📊 Chart
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setShowRiskCalculator(!showRiskCalculator)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <Percent className="w-4 h-4" /> Risk Calc
              </button>
              <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-all ${botRunning ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Signals Active' : 'Start Signals'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Trading Hours Banner */}
              <div className={`rounded-xl p-4 ${getTradingHours().quality === 'Best' ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Zambia Trading Hours (UTC+2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getTradingHours().emoji}</span>
                    <span>{getTradingHours().message}</span>
                  </div>
                </div>
              </div>

              {/* Chart Section */}
              {showChart && (
                <div>
                  <div className="flex gap-2 mb-3">
                    {['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD'].map(sym => (
                      <button key={sym} onClick={() => setSelectedSymbol(sym)} className={`px-3 py-1 rounded text-xs ${selectedSymbol === sym ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400'}`}>
                        {sym}
                      </button>
                    ))}
                  </div>
                  <TradingViewChart symbol={selectedSymbol} interval="60" theme="dark" />
                </div>
              )}

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Total P&L</div>
                  <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(0)}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Win Rate</div>
                  <div className="text-2xl font-bold text-purple-400">{winRate.toFixed(0)}%</div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Active Positions</div>
                  <div className="text-2xl font-bold">{positions.length}</div>
                  {frozenCount > 0 && <div className="text-xs text-yellow-500">{frozenCount} frozen</div>}
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Bot Status</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-sm">{botRunning ? 'Active' : 'Standby'}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Account Balance</div>
                  <div className="text-xl font-bold text-blue-400">${accountBalance}</div>
                </div>
              </div>

              {/* Equity Curve */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
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

              {/* Positions Table */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800 flex justify-between items-center">
                  <h3 className="font-medium flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> Open Positions</h3>
                  <span className="text-xs text-gray-500">Updates every 5 seconds</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50">
                      <tr className="text-gray-400">
                        <th className="px-4 py-2 text-left">Symbol</th><th className="px-4 py-2 text-left">Direction</th>
                        <th className="px-4 py-2 text-left">Entry</th><th className="px-4 py-2 text-left">Current</th>
                        <th className="px-4 py-2 text-left">P&L</th><th className="px-4 py-2 text-left">P&L %</th>
                        <th className="px-4 py-2 text-left">SL/TP</th><th className="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positions.map(p => (
                        <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="px-4 py-3 font-medium">{p.symbol}</td>
                          <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${p.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{p.direction}</span></td>
                          <td className="px-4 py-3 font-mono">{p.entryPrice.toFixed(5)}</td>
                          <td className="px-4 py-3 font-mono text-blue-400">{p.currentPrice.toFixed(5)}</td>
                          <td className={`px-4 py-3 font-medium ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(0)}</td>
                          <td className={`px-4 py-3 ${p.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{p.pnlPercent >= 0 ? '+' : ''}{p.pnlPercent.toFixed(2)}%</td>
                          <td className="px-4 py-3 text-xs text-gray-500">{p.stopLoss.toFixed(4)}/{p.takeProfit.toFixed(4)}</td>
                          <td className="px-4 py-3">{p.frozen ? <span className="flex items-center gap-1 text-yellow-400 text-xs"><Shield className="w-3 h-3" /> Frozen</span> : <span className="text-green-400 text-xs">Active</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* CALCULATOR TAB */}
          {activeTab === 'calculator' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 className="font-medium text-lg mb-4 flex items-center gap-2"><Percent className="w-5 h-5 text-blue-400" /> Position Size Calculator</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Account Balance ($)</label>
                    <input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2 text-white" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Risk Per Trade (%)</label>
                    <input type="number" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} step="0.5" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2 text-white" />
                    <p className="text-xs text-gray-500 mt-1">Recommended: 1-2% per trade</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Stop Loss (pips)</label>
                    <input type="number" defaultValue="30" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2 text-white" />
                  </div>
                  <div className="bg-emerald-500/10 rounded-lg p-4">
                    <div className="text-sm text-emerald-400 mb-2">Recommended Position Size:</div>
                    <div className="text-3xl font-bold text-emerald-400">{calculatePositionSize(accountBalance, riskPercent, 30).toFixed(3)} lots</div>
                    <div className="text-xs text-gray-500 mt-2">Risk amount: ${(accountBalance * riskPercent / 100).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
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
                    <span className="text-gray-400">Trading Mode:</span>
                    <span className="text-blue-400">Manual Signals</span>
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
                    <li>Each signal includes Entry, Stop Loss, and Take Profit</li>
                    <li>Open your <span className="text-cyan-400">MT5 mobile app</span> to execute trades</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Risk Calculator Modal */}
      {showRiskCalculator && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Position Size Calculator</h3>
            <div>
              <label className="text-sm text-gray-400">Account Balance ($)</label>
              <input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-400">Risk Per Trade (%)</label>
              <input type="number" value={riskPercent} onChange={(e) => setRiskPercent(Number(e.target.value))} step="0.5" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-400">Stop Loss (pips)</label>
              <input type="number" defaultValue="30" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-4 mt-4">
              <div className="text-sm text-emerald-400 mb-2">Recommended Position Size:</div>
              <div className="text-3xl font-bold text-emerald-400">{calculatePositionSize(accountBalance, riskPercent, 30).toFixed(3)} lots</div>
            </div>
            <button onClick={() => setShowRiskCalculator(false)} className="w-full mt-4 bg-emerald-500/20 text-emerald-400 py-2 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  );
                                                }
