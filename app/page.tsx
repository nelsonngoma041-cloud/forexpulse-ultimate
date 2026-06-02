"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  TrendingUp, TrendingDown, Shield, DollarSign, Activity, Zap,
  AlertTriangle, Settings, Play, Pause, Download, Bot,
  BarChart3, MessageCircle, Wifi, WifiOff,
  Target, Radar, ChevronRight, ChevronLeft,
  Globe, Award, Star
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { MockPriceWebSocket } from './lib/websocket-prices';
import { OandaBrokerAPI, MT5BrokerAPI } from './lib/broker-api';
import { BacktestingEngine, BacktestConfig, BacktestResult } from './lib/backtesting';
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';

// ========== INITIALIZE SERVICES WITH HARDCODED TELEGRAM CREDENTIALS ==========
const telegramBot = new TelegramAlertBot();
// @ts-ignore
telegramBot.botToken = '8677113455:AAHYDfIYndZ4sVcNtKrqS56b_DqC3V4uurQ';
// @ts-ignore
telegramBot.chatId = '7724961440';

const backtestEngine = new BacktestingEngine();
const priceWS = new MockPriceWebSocket();
const oandaBroker = new OandaBrokerAPI();
const mt5Broker = new MT5BrokerAPI();
// =============================================================================

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

interface NewsItem {
  id: string;
  headline: string;
  currency: string;
  sentiment: 'hawkish' | 'dovish';
  confidence: number;
  timestamp: Date;
  source: string;
}

export default function ForexPulseUltimate() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trading' | 'backtest' | 'settings'>('dashboard');
  const [botRunning, setBotRunning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [positions, setPositions] = useState<Position[]>([
    { id: '1', symbol: 'EUR/USD', direction: 'LONG', entryPrice: 1.0850, currentPrice: 1.0892, volume: 0.1, pnl: 420, pnlPercent: 0.39, stopLoss: 1.0820, takeProfit: 1.0950, frozen: false },
    { id: '2', symbol: 'GBP/USD', direction: 'LONG', entryPrice: 1.2670, currentPrice: 1.2715, volume: 0.1, pnl: 450, pnlPercent: 0.36, stopLoss: 1.2640, takeProfit: 1.2770, frozen: true },
    { id: '3', symbol: 'USD/JPY', direction: 'SHORT', entryPrice: 157.20, currentPrice: 157.85, volume: 0.05, pnl: -325, pnlPercent: -0.21, stopLoss: 158.00, takeProfit: 156.00, frozen: false },
  ]);
  
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([
    { id: '1', headline: 'Fed signals rate pause amid cooling inflation', currency: 'USD', sentiment: 'dovish', confidence: 0.85, timestamp: new Date(), source: 'Reuters' },
    { id: '2', headline: "ECB's Lagarde hints at July hike", currency: 'EUR', sentiment: 'hawkish', confidence: 0.78, timestamp: new Date(), source: 'Bloomberg' },
  ]);
  
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  const [equityData] = useState([
    { time: '9:30', equity: 10000 }, { time: '10:00', equity: 10150 }, { time: '10:30', equity: 10200 },
    { time: '11:00', equity: 10180 }, { time: '11:30', equity: 10300 }, { time: '12:00', equity: 10250 },
  ]);
  
  const [pnlData] = useState([
    { date: 'Mon', pnl: 120 }, { date: 'Tue', pnl: -80 }, { date: 'Wed', pnl: 200 },
    { date: 'Thu', pnl: 150 }, { date: 'Fri', pnl: -50 }, { date: 'Sat', pnl: 100 }, { date: 'Sun', pnl: 80 },
  ]);

  // WebSocket connection
  useEffect(() => {
    const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY'];
    const unsubscribes = symbols.map(symbol => 
      priceWS.subscribe(symbol, (price) => {
        setPositions(prev => prev.map(p => 
          p.symbol === symbol ? {
            ...p,
            currentPrice: price,
            pnl: p.direction === 'LONG' ? (price - p.entryPrice) * 10000 * p.volume : (p.entryPrice - price) * 10000 * p.volume,
          } : p
        ));
        setWsConnected(true);
      })
    );
    return () => unsubscribes.forEach(u => u());
  }, []);

  // Bot simulation
  useEffect(() => {
    if (!botRunning) return;
    const interval = setInterval(() => {
      const newSignal: NewsItem = {
        id: Date.now().toString(),
        headline: `Breaking: ${['Fed', 'ECB', 'BOE'][Math.floor(Math.random() * 3)]} signals policy shift`,
        currency: ['USD', 'EUR', 'GBP'][Math.floor(Math.random() * 3)],
        sentiment: Math.random() > 0.5 ? 'hawkish' : 'dovish',
        confidence: 0.6 + Math.random() * 0.35,
        timestamp: new Date(),
        source: ['Reuters', 'Bloomberg'][Math.floor(Math.random() * 2)],
      };
      setNewsFeed(prev => [newSignal, ...prev.slice(0, 19)]);
      toast.success(`New signal: ${newSignal.currency} - ${newSignal.sentiment}`);
    }, 15000);
    return () => clearInterval(interval);
  }, [botRunning]);

  const toggleBot = async () => {
    if (!botRunning) {
      setBotRunning(true);
      await telegramBot.sendAlert('Trading Bot', 'Bot activated', 'info');
      toast.success('🤖 Bot activated');
    } else {
      setBotRunning(false);
      await telegramBot.sendAlert('Trading Bot', 'Bot paused', 'warning');
      toast('⏸️ Bot paused');
    }
  };

  const sendTestTelegram = async () => {
    const testTrade: TradeAlert = {
      symbol: 'EUR/USD', action: 'BUY', price: 1.0892, confidence: 0.85,
      signalType: 'Test', volume: 0.1, stopLoss: 1.0860, takeProfit: 1.0950
    };
    await telegramBot.sendTradeAlert(testTrade);
    toast.success('Test alert sent to Telegram!');
  };

  const runBacktest = async () => {
    setIsBacktesting(true);
    toast.loading('Running backtest...', { id: 'backtest' });
    try {
      const results = await backtestEngine.runBacktest({
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        initialCapital: 10000,
        symbol: 'EUR/USD',
        strategy: 'moving_average_crossover',
        parameters: { fastPeriod: 10, slowPeriod: 30 },
        riskPerTrade: 1.5,
        maxConcurrentTrades: 3
      });
      setBacktestResults(results);
      toast.success(`Backtest complete! ${results.totalTrades} trades, ${results.totalReturnPercent.toFixed(2)}% return`, { id: 'backtest' });
    } catch (error) {
      toast.error('Backtest failed', { id: 'backtest' });
    } finally {
      setIsBacktesting(false);
    }
  };

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;
  const frozenCount = positions.filter(p => p.frozen).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 bg-gray-950 border-r border-gray-800 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Bot className="w-6 h-6 text-emerald-500" />
              <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">ForexPulse</span>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 rounded hover:bg-gray-800">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <nav className="p-2 space-y-1">
          {['dashboard', 'trading', 'backtest', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`w-full flex items-center gap-3 px-3 py-2 rounded transition-all ${activeTab === tab ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'trading' && <Target className="w-4 h-4" />}
              {tab === 'backtest' && <BarChart3 className="w-4 h-4" />}
              {tab === 'settings' && <Settings className="w-4 h-4" />}
              {!sidebarCollapsed && <span className="text-sm capitalize">{tab}</span>}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className={`flex items-center gap-2 ${sidebarCollapsed && 'justify-center'}`}>
            <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
            {!sidebarCollapsed && <span className="text-xs">{botRunning ? 'Bot Active' : 'Bot Inactive'}</span>}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${wsConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {wsConnected ? 'Live Data' : 'Demo Mode'}
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                <Globe className="w-3 h-3" /> DEMO
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={sendTestTelegram} className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-400 hover:bg-cyan-500/30 transition flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={toggleBot} className={`flex items-center gap-2 rounded-lg px-4 py-1.5 font-medium transition ${botRunning ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? "Bot Active" : "Start Bot"}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-4">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Total P&L</div>
                  <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${totalPnL >= 0 ? '+' : ''}{totalPnL}</div>
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
                    <span className="text-sm">{botRunning ? 'Trading' : 'Standby'}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Account Equity</div>
                  <div className="text-2xl font-bold text-blue-400">$10,250</div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-6">
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
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
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

              {/* Positions Table */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-800">
                  <h3 className="font-medium">Open Positions</h3>
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
                          <td className="px-4 py-3">{p.entryPrice.toFixed(5)}</td>
                          <td className="px-4 py-3 text-blue-400">{p.currentPrice.toFixed(5)}</td>
                          <td className={`px-4 py-3 font-medium ${p.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${p.pnl >= 0 ? '+' : ''}{p.pnl}</td>
                          <td className="px-4 py-3">{p.frozen ? <span className="flex items-center gap-1 text-yellow-400 text-xs"><Shield className="w-3 h-3" /> Frozen</span> : <span className="text-green-400 text-xs">Active</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* News Feed */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                  <h3 className="font-medium">Live AI News Feed</h3>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-xs text-emerald-400">Monitoring</span></div>
                </div>
                <div className="divide-y divide-gray-800">
                  {newsFeed.slice(0, 8).map(signal => (
                    <div key={signal.id} className="p-3 hover:bg-gray-800/30">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-800">{signal.currency}</span>
                        <span className={`flex items-center gap-1 text-xs ${signal.sentiment === 'hawkish' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {signal.sentiment === 'hawkish' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {signal.sentiment.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600">{(signal.confidence * 100).toFixed(0)}% conf</span>
                      </div>
                      <p className="text-sm">{signal.headline}</p>
                      <div className="text-xs text-gray-500 mt-1">{signal.source} • {signal.timestamp.toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trading Tab */}
          {activeTab === 'trading' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium text-lg mb-4">📈 Manual Trading</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><label className="text-xs text-gray-400">Symbol</label><select className="w-full mt-1 rounded bg-gray-800 p-2"><option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option></select></div>
                  <div><label className="text-xs text-gray-400">Volume</label><input type="number" defaultValue="0.1" className="w-full mt-1 rounded bg-gray-800 p-2" /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button className="rounded-lg bg-emerald-500/20 text-emerald-400 py-2">BUY</button>
                  <button className="rounded-lg bg-red-500/20 text-red-400 py-2">SELL</button>
                </div>
              </div>
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium mb-4">💰 Account Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-400">Balance</span><span>$10,000</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Equity</span><span className="text-emerald-400">$10,250</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Free Margin</span><span className="text-blue-400">$8,750</span></div>
                </div>
              </div>
            </div>
          )}

          {/* Backtest Tab */}
          {activeTab === 'backtest' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium text-lg mb-4">Backtesting Engine</h3>
                <button onClick={runBacktest} disabled={isBacktesting} className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded">
                  {isBacktesting ? 'Running...' : 'Run Backtest'}
                </button>
              </div>
              {backtestResults && (
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                  <h3 className="font-medium mb-4">Results</h3>
                  <div className="grid grid-cols-4 gap-4">
                    <div><div className="text-xs text-gray-400">Return</div><div className="text-xl font-bold text-emerald-400">{backtestResults.totalReturnPercent.toFixed(2)}%</div></div>
                    <div><div className="text-xs text-gray-400">Sharpe</div><div className="text-xl font-bold text-blue-400">{backtestResults.sharpeRatio.toFixed(2)}</div></div>
                    <div><div className="text-xs text-gray-400">Drawdown</div><div className="text-xl font-bold text-red-400">{backtestResults.maxDrawdownPercent.toFixed(2)}%</div></div>
                    <div><div className="text-xs text-gray-400">Win Rate</div><div className="text-xl font-bold text-purple-400">{backtestResults.winRate.toFixed(1)}%</div></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
              <h3 className="font-medium text-lg mb-4">Configuration</h3>
              <p className="text-gray-400">Telegram alerts are already configured with your bot token.</p>
              <p className="text-gray-400 mt-2">Click "Test Alert" on the dashboard to verify.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
                                          }         
