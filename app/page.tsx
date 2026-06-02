"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  TrendingUp, TrendingDown, Shield, Clock, DollarSign, Activity, Zap,
  AlertTriangle, Settings, Play, Pause, Download, Upload, Bot,
  BarChart3, MessageCircle, Database, Wifi, WifiOff, GitBranch,
  Target, Radar, RefreshCw, Save, Globe, Phone, Award, Star,
  ChevronRight, ChevronLeft, Maximize2, Minimize2, Bell, BellOff
} from "lucide-react";
import { 
  AreaChart, Area, LineChart, Line, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, Scatter, RadialBarChart, RadialBar, PieChart, Pie, Cell
} from "recharts";
import { MockPriceWebSocket, LivePriceWebSocket } from './lib/websocket-prices';
import { OandaBrokerAPI, MT5BrokerAPI } from './lib/broker-api';
import { BacktestingEngine, BacktestConfig, BacktestResult } from './lib/backtesting';
import { TelegramAlertBot, TradeAlert, DailyReport } from './lib/telegram-alerts';

// ========== INITIALIZE SERVICES WITH HARDCODED TELEGRAM CREDENTIALS ==========
const telegramBot = new TelegramAlertBot();
// @ts-ignore - Bypass readonly for testing
telegramBot.botToken = '8677113455:AAHYDfIYndZ4sVcNtKrqS56b_DqC3V4uurQ'; // !!! IMPORTANT: REPLACE WITH YOUR REAL BOT TOKEN !!!
// @ts-ignore - Bypass readonly for testing
telegramBot.chatId = '7724961440'; // Your confirmed Chat ID

const backtestEngine = new BacktestingEngine();
const priceWS = new MockPriceWebSocket(); // Switch to LivePriceWebSocket for production
const oandaBroker = new OandaBrokerAPI();
const mt5Broker = new MT5BrokerAPI();
// =============================================================================

// Types
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
  entryTime: Date;
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
  url?: string;
}

interface AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  dailyPnL: number;
  dailyPnLPercent: number;
  weeklyPnL: number;
  monthlyPnL: number;
}

export default function ForexPulseUltimate() {
  // UI State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trading' | 'backtest' | 'settings'>('dashboard');
  const [botRunning, setBotRunning] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [brokerType, setBrokerType] = useState<'oanda' | 'mt5' | 'demo'>('demo');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);
  
  // Data State
  const [positions, setPositions] = useState<Position[]>([]);
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([]);
  const [account, setAccount] = useState<AccountInfo>({
    balance: 10000, equity: 10250, margin: 1250, freeMargin: 8750,
    marginLevel: 820, dailyPnL: 250, dailyPnLPercent: 2.5,
    weeklyPnL: 850, monthlyPnL: 1240
  });
  const [backtestResults, setBacktestResults] = useState<BacktestResult | null>(null);
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    initialCapital: 10000,
    symbol: 'EUR/USD',
    strategy: 'moving_average_crossover',
    parameters: { fastPeriod: 10, slowPeriod: 30, stopLossPips: 30, takeProfitPips: 60 },
    riskPerTrade: 1.5,
    maxConcurrentTrades: 3
  });
  const [isBacktesting, setIsBacktesting] = useState(false);
  
  // Chart data
  const [equityData, setEquityData] = useState<{ time: string; equity: number }[]>([]);
  const [pnlData, setPnlData] = useState<{ date: string; pnl: number }[]>([]);
  
  // Refs
  const unsubscribeRefs = useRef<Array<() => void>>([]);

  // Initialize demo positions
  useEffect(() => {
    const demoPositions: Position[] = [
      { id: '1', symbol: 'EUR/USD', direction: 'LONG', entryPrice: 1.0850, currentPrice: 1.0892, volume: 0.1, pnl: 420, pnlPercent: 0.39, stopLoss: 1.0820, takeProfit: 1.0950, entryTime: new Date(Date.now() - 2 * 60 * 60 * 1000), frozen: false },
      { id: '2', symbol: 'GBP/USD', direction: 'LONG', entryPrice: 1.2670, currentPrice: 1.2715, volume: 0.1, pnl: 450, pnlPercent: 0.36, stopLoss: 1.2640, takeProfit: 1.2770, entryTime: new Date(Date.now() - 1 * 60 * 60 * 1000), frozen: true },
      { id: '3', symbol: 'USD/JPY', direction: 'SHORT', entryPrice: 157.20, currentPrice: 157.85, volume: 0.05, pnl: -325, pnlPercent: -0.21, stopLoss: 158.00, takeProfit: 156.00, entryTime: new Date(Date.now() - 3 * 60 * 60 * 1000), frozen: false },
    ];
    setPositions(demoPositions);
    
    // Generate mock news
    const mockNews: NewsItem[] = [
      { id: '1', headline: 'Fed signals rate pause amid cooling inflation', currency: 'USD', sentiment: 'dovish', confidence: 0.85, timestamp: new Date(Date.now() - 1000 * 60 * 5), source: 'Reuters' },
      { id: '2', headline: "ECB's Lagarde hints at July hike, cites wage pressures", currency: 'EUR', sentiment: 'hawkish', confidence: 0.78, timestamp: new Date(Date.now() - 1000 * 60 * 15), source: 'Bloomberg' },
      { id: '3', headline: 'BoJ maintains ultra-loose policy, yen weakens', currency: 'JPY', sentiment: 'dovish', confidence: 0.92, timestamp: new Date(Date.now() - 1000 * 60 * 30), source: 'Nikkei' },
      { id: '4', headline: 'Bank of England says rates to stay higher for longer', currency: 'GBP', sentiment: 'hawkish', confidence: 0.81, timestamp: new Date(Date.now() - 1000 * 60 * 45), source: 'FT' },
      { id: '5', headline: 'RBA holds but removes hawkish bias, AUD slips', currency: 'AUD', sentiment: 'dovish', confidence: 0.74, timestamp: new Date(Date.now() - 1000 * 60 * 60), source: 'AFR' },
    ];
    setNewsFeed(mockNews);
    
    // Generate mock equity curve
    const mockEquity = Array.from({ length: 30 }, (_, i) => ({
      time: `${9 + Math.floor(i / 2)}:${(i % 2) * 30}`,
      equity: 10000 + Math.sin(i / 3) * 200 + Math.random() * 100
    }));
    setEquityData(mockEquity);
    
    // Generate mock PnL data
    const mockPnL = Array.from({ length: 7 }, (_, i) => ({
      date: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
      pnl: Math.random() * 500 - 100
    }));
    setPnlData(mockPnL);
  }, []);

  // WebSocket connection for live prices
  useEffect(() => {
    const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
    
    const unsubscribes = symbols.map(symbol => 
      priceWS.subscribe(symbol, (price) => {
        setPositions(prev => prev.map(p => 
          p.symbol === symbol ? {
            ...p,
            currentPrice: price,
            pnl: p.direction === 'LONG' 
              ? (price - p.entryPrice) * 10000 * p.volume
              : (p.entryPrice - price) * 10000 * p.volume,
            pnlPercent: p.direction === 'LONG'
              ? ((price - p.entryPrice) / p.entryPrice) * 100
              : ((p.entryPrice - price) / p.entryPrice) * 100
          } : p
        ));
        setWsConnected(true);
      })
    );
    
    unsubscribeRefs.current = unsubscribes;
    
    return () => {
      unsubscribeRefs.current.forEach(unsubscribe => unsubscribe());
      priceWS.disconnect();
    };
  }, []);

  // Simulate bot trading
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      const newSignal: NewsItem = {
        id: Date.now().toString(),
        headline: Math.random() > 0.5 
          ? `BREAKING: ${['Fed', 'ECB', 'BOE', 'BOJ'][Math.floor(Math.random() * 4)]} signals policy shift`
          : `NEW: ${['Inflation', 'Employment', 'GDP', 'Trade'][Math.floor(Math.random() * 4)]} data beats expectations`,
        currency: ['USD', 'EUR', 'GBP', 'JPY', 'AUD'][Math.floor(Math.random() * 5)],
        sentiment: Math.random() > 0.5 ? 'hawkish' : 'dovish',
        confidence: 0.6 + Math.random() * 0.35,
        timestamp: new Date(),
        source: ['Reuters', 'Bloomberg', 'FT', 'WSJ'][Math.floor(Math.random() * 4)]
      };
      
      setNewsFeed(prev => [newSignal, ...prev.slice(0, 19)]);
      
      if (showNotifications) {
        toast.custom((t) => (
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-2xl p-3 border-l-4 border-emerald-500">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm">Bot Signal Generated</span>
            </div>
            <div className="text-xs mt-1">{newSignal.currency} - {newSignal.sentiment.toUpperCase()}</div>
          </div>
        ), { duration: 3000 });
      }
    }, 15000);
    
    return () => clearInterval(interval);
  }, [botRunning, showNotifications]);

  const toggleBot = async () => {
    if (!botRunning) {
      setBotRunning(true);
      await telegramBot.sendAlert('Trading Bot', 'Bot has been activated and is now monitoring markets', 'info');
      toast.success('🤖 Trading bot activated');
    } else {
      setBotRunning(false);
      await telegramBot.sendAlert('Trading Bot', 'Bot has been paused', 'warning');
      toast('⏸️ Bot paused');
    }
  };

  const sendTestTelegram = async () => {
    const testTrade: TradeAlert = {
      symbol: 'EUR/USD',
      action: 'BUY',
      price: 1.0892,
      confidence: 0.85,
      signalType: 'News Sentiment Analysis',
      volume: 0.1,
      stopLoss: 1.0860,
      takeProfit: 1.0950
    };
    await telegramBot.sendTradeAlert(testTrade);
    toast.success('Test alert sent to Telegram');
  };

  const runBacktest = async () => {
    setIsBacktesting(true);
    toast.loading('Running backtest... This may take a moment', { id: 'backtest' });
    
    try {
      const results = await backtestEngine.runBacktest(backtestConfig);
      setBacktestResults(results);
      toast.success(`Backtest complete! ${results.totalTrades} trades, ${results.totalReturnPercent.toFixed(2)}% return`, { id: 'backtest' });
    } catch (error) {
      toast.error('Backtest failed: ' + (error as Error).message, { id: 'backtest' });
    } finally {
      setIsBacktesting(false);
    }
  };

  const exportData = () => {
    const data = {
      positions,
      account,
      backtestResults,
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forexpulse_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported successfully');
  };

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;
  const frozenCount = positions.filter(p => p.frozen).length;

  const getSentimentIcon = (sentiment: string) => {
    return sentiment === 'hawkish' 
      ? <TrendingUp className="w-3 h-3 text-emerald-400" />
      : <TrendingDown className="w-3 h-3 text-red-400" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 h-full z-40 transition-all duration-300 bg-gray-950 border-r border-gray-800 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <Bot className="w-6 h-6 text-emerald-500" />
                <span className="font-bold bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">ForexPulse</span>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1 rounded-lg hover:bg-gray-800">
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
          
          <nav className="flex-1 p-2 space-y-1">
            {[
              { id: 'dashboard', icon: Activity, label: 'Dashboard' },
              { id: 'trading', icon: Target, label: 'Trading' },
              { id: 'backtest', icon: BarChart3, label: 'Backtest' },
              { id: 'settings', icon: Settings, label: 'Settings' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                  activeTab === item.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {!sidebarCollapsed && <span className="text-sm">{item.label}</span>}
              </button>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-800">
            <div className={`flex items-center gap-2 ${sidebarCollapsed && 'justify-center'}`}>
              <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              {!sidebarCollapsed && <span className="text-xs text-gray-400">{botRunning ? 'Bot Active' : 'Bot Inactive'}</span>}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${wsConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {wsConnected ? 'Live Data' : 'Demo Mode'}
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                  <Globe className="w-3 h-3" />
                  {brokerType.toUpperCase()}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button onClick={sendTestTelegram} className="rounded-lg bg-cyan-500/20 px-3 py-1.5 text-sm text-cyan-400 hover:bg-cyan-500/30 transition flex items-center gap-2">
                <MessageCircle className="w-4 h-4" />
                Test Alert
              </button>
              <button onClick={exportData} className="rounded-lg bg-gray-800 p-2 hover:bg-gray-700 transition">
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={toggleBot}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 font-medium transition-all ${
                  botRunning ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"
                }`}
              >
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? "Bot Active" : "Start Bot"}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {/* DASHBOARD TAB */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-5 gap-4">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Total P&L</span>
                    <DollarSign className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${totalPnL >= 0 ? '+' : ''}{totalPnL.toFixed(0)}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Win Rate</span>
                    <Target className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-purple-400">{winRate.toFixed(0)}%</div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Active Positions</span>
                    <Activity className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1">{positions.length}</div>
                  {frozenCount > 0 && <div className="text-xs text-yellow-500 mt-1">{frozenCount} frozen</div>}
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Bot Status</span>
                    <Bot className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-2 h-2 rounded-full ${botRunning ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-sm font-medium">{botRunning ? 'Trading' : 'Standby'}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Account Equity</span>
                    <Award className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-blue-400">${account.equity.toLocaleString()}</div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-2 gap-6">
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">Equity Curve</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={equityData}>
                      <defs>
                        <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="time" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                      <Area type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={2} fill="url(#equityGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <h3 className="text-sm font-medium text-gray-400 mb-4">Daily P&L</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={pnlData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                      <YAxis stroke="#6b7280" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {pnlData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.pnl >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Positions Table */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-950">
                  <h3 className="font-medium flex items-center gap-2"><Target className="w-4 h-4 text-emerald-400" /> Open Positions</h3>
                  <span className="text-xs text-gray-500">Live prices updating via WebSocket</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-800/50 border-b border-gray-800">
                      <tr className="text-gray-400">
                        <th className="px-4 py-2 text-left">Symbol</th>
                        <th className="px-4 py-2 text-left">Direction</th>
                        <th className="px-4 py-2 text-left">Entry</th>
                        <th className="px-4 py-2 text-left">Current</th>
                        <th className="px-4 py-2 text-left">P&L</th>
                        <th className="px-4 py-2 text-left">P&L %</th>
                        <th className="px-4 py-2 text-left">SL/TP</th>
                        <th className="px-4 py-2 text-left">Status</th>
                      <tr>
                    </thead>
                    <tbody>
                      {positions.map(position => (
                        <tr key={position.id} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition">
                          <td className="px-4 py-3 font-medium">{position.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded px-2 py-0.5 text-xs font-medium ${
                              position.direction === 'LONG' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {position.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">{position.entryPrice.toFixed(5)}</td>
                          <td className="px-4 py-3 font-mono text-blue-400">{position.currentPrice.toFixed(5)}</td>
                          <td className={`px-4 py-3 font-medium ${position.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            ${position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(0)}
                           </td>
                          <td className={`px-4 py-3 ${position.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                           </td>
                          <td className="px-4 py-3 text-xs text-gray-500">
                            {position.stopLoss.toFixed(4)} / {position.takeProfit.toFixed(4)}
                           </td>
                          <td className="px-4 py-3">
                            {position.frozen ? (
                              <span className="flex items-center gap-1 text-yellow-400 text-xs">
                                <Shield className="w-3 h-3" /> Frozen
                              </span>
                            ) : (
                              <span className="text-green-400 text-xs">Active</span>
                            )}
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* News Feed */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3 bg-gray-950">
                  <h3 className="font-medium flex items-center gap-2"><Radar className="w-4 h-4 text-blue-400" /> Live AI News Feed</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-emerald-400">Monitoring {newsFeed.length} signals</span>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto divide-y divide-gray-800">
                  {newsFeed.slice(0, 15).map(signal => (
                    <div key={signal.id} className="p-3 hover:bg-gray-800/30 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-xs font-bold text-gray-400 px-1.5 py-0.5 rounded bg-gray-800">{signal.currency}</span>
                            <span className={`flex items-center gap-1 text-xs font-medium ${signal.sentiment === 'hawkish' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {getSentimentIcon(signal.sentiment)}
                              {signal.sentiment.toUpperCase()}
                            </span>
                            <span className="text-xs text-gray-600">{(signal.confidence * 100).toFixed(0)}% conf</span>
                            <span className="text-xs text-gray-600">{signal.source}</span>
                          </div>
                          <p className="text-sm leading-tight">{signal.headline}</p>
                          <div className="text-xs text-gray-500 mt-1">{signal.timestamp.toLocaleTimeString()}</div>
                        </div>
                        <button className="ml-2 p-1 rounded hover:bg-gray-700 transition">
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TRADING TAB */}
          {activeTab === 'trading' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                {/* Manual Trading Panel */}
                <div className="col-span-2 rounded-xl bg-gray-900 border border-gray-800 p-6">
                  <h3 className="font-medium text-lg mb-4">📈 Manual Trading</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-gray-400">Symbol</label>
                      <select className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2">
                        <option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option>
                        <option>AUD/USD</option><option>USD/CAD</option><option>NZD/USD</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Volume (lots)</label>
                      <input type="number" defaultValue="0.1" step="0.01" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Stop Loss (pips)</label>
                      <input type="number" defaultValue="30" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Take Profit (pips)</label>
                      <input type="number" defaultValue="60" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button className="rounded-lg bg-emerald-500/20 text-emerald-400 py-2 hover:bg-emerald-500/30 transition font-medium">
                      BUY
                    </button>
                    <button className="rounded-lg bg-red-500/20 text-red-400 py-2 hover:bg-red-500/30 transition font-medium">
                      SELL
                    </button>
                  </div>
                </div>

                {/* Account Info */}
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                  <h3 className="font-medium mb-4">💰 Account Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-gray-400">Balance</span><span className="font-mono">${account.balance.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Equity</span><span className="font-mono text-emerald-400">${account.equity.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Margin Used</span><span className="font-mono">${account.margin.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Free Margin</span><span className="font-mono text-blue-400">${account.freeMargin.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Margin Level</span><span className="font-mono">{account.marginLevel.toFixed(0)}%</span></div>
                    <div className="border-t border-gray-800 my-2" />
                    <div className="flex justify-between"><span className="text-gray-400">Daily P&L</span><span className={`font-mono ${account.dailyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${account.dailyPnL >= 0 ? '+' : ''}{account.dailyPnL}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Weekly P&L</span><span className={`font-mono ${account.weeklyPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${account.weeklyPnL >= 0 ? '+' : ''}{account.weeklyPnL}</span></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BACKTEST TAB */}
          {activeTab === 'backtest' && (
            <div className="space-y-6">
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium text-lg mb-4">📊 Backtesting Engine</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-xs text-gray-400">Strategy</label>
                    <select 
                      value={backtestConfig.strategy}
                      onChange={e => setBacktestConfig({...backtestConfig, strategy: e.target.value as any})}
                      className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2"
                    >
                      <option value="moving_average_crossover">MA Crossover</option>
                      <option value="rsi_mean_reversion">RSI Mean Reversion</option>
                      <option value="bollinger_bands">Bollinger Bands</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Symbol</label>
                    <select 
                      value={backtestConfig.symbol}
                      onChange={e => setBacktestConfig({...backtestConfig, symbol: e.target.value})}
                      className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2"
                    >
                      <option>EUR/USD</option><option>GBP/USD</option><option>USD/JPY</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Initial Capital</label>
                    <input 
                      type="number" 
                      value={backtestConfig.initialCapital}
                      onChange={e => setBacktestConfig({...backtestConfig, initialCapital: parseFloat(e.target.value)})}
                      className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2"
                    />
                  </div>
                </div>
                <button 
                  onClick={runBacktest} 
                  disabled={isBacktesting}
                  className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition disabled:opacity-50"
                >
                  {isBacktesting ? 'Running...' : 'Run Backtest'}
                </button>
              </div>

              {backtestResults && (
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                  <h3 className="font-medium mb-4">📈 Backtest Results</h3>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Total Return</div><div className="text-xl font-bold text-emerald-400">{backtestResults.totalReturnPercent.toFixed(2)}%</div></div>
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Sharpe Ratio</div><div className="text-xl font-bold text-blue-400">{backtestResults.sharpeRatio.toFixed(2)}</div></div>
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Max Drawdown</div><div className="text-xl font-bold text-red-400">{backtestResults.maxDrawdownPercent.toFixed(2)}%</div></div>
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Win Rate</div><div className="text-xl font-bold text-purple-400">{backtestResults.winRate.toFixed(1)}%</div></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Total Trades</div><div className="text-lg font-bold">{backtestResults.totalTrades}</div></div>
                    <div className="p-3 rounded-lg bg-gray-800/30"><div className="text-xs text-gray-400">Profit Factor</div><div className="text-lg font-bold text-emerald-400">{backtestResults.profitFactor.toFixed(2)}</div></div>
                  </div>
                  
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={backtestResults.equityCurve}>
                      <defs><linearGradient id="btEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid stroke="#1f2937" />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickFormatter={(v) => new Date(v).toLocaleDateString()} />
                      <YAxis stroke="#6b7280" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none' }} />
                      <Area type="monotone" dataKey="equity" stroke="#10b981" fill="url(#btEquity)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium text-lg mb-4">🤖 Bot Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Risk Per Trade (%)</label>
                    <input type="number" defaultValue="1.5" step="0.5" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Max Daily Loss ($)</label>
                    <input type="number" defaultValue="500" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Max Daily Trades</label>
                    <input type="number" defaultValue="10" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Min Confidence to Trade (%)</label>
                    <input type="number" defaultValue="70" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Freeze Minutes Before Events</label>
                    <input type="number" defaultValue="10" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
                <h3 className="font-medium text-lg mb-4">🔌 API Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-400">Telegram Bot Token</label>
                    <input type="password" placeholder="Enter bot token" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                    <p className="text-xs text-gray-500 mt-1">Get from @BotFather on Telegram</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Telegram Chat ID</label>
                    <input type="text" placeholder="Enter chat ID" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">OANDA API Key</label>
                    <input type="password" placeholder="Enter OANDA API key" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400">Alpha Vantage API Key</label>
                    <input type="password" placeholder="Enter API key" className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2" />
                  </div>
                  <button className="w-full bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-lg hover:bg-emerald-500/30 transition">
                    Save All Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
