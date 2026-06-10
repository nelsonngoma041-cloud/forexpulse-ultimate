"use client";

import { useState, useEffect, useRef } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  Bot, MessageCircle, Play, Pause, Activity, Settings, 
  TrendingUp, TrendingDown, Shield, Wifi, WifiOff, 
  DollarSign, ChevronRight, ChevronLeft, Target, Radar, Download,
  BarChart3, TrendingUp as TrendingUpIcon, Award, Star, Zap,
  Clock, BookOpen, Volume2, PieChart, Percent
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';
import { AlphaVantageAPI } from './lib/broker-api';
import TradingViewChart from './components/TradingViewChart';

// ============ TELEGRAM BOT ============
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');
const alphaVantage = new AlphaVantageAPI();

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

interface NewsItem {
  id: string;
  headline: string;
  currency: string;
  sentiment: 'hawkish' | 'dovish';
  confidence: number;
  timestamp: Date;
  source: string;
}

interface TradeJournal {
  id: string;
  symbol: string;
  action: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  entryTime: Date;
  exitTime: Date;
  notes: string;
}

// ============ HELPER FUNCTIONS ============
const calculatePnL = (position: Position, currentPrice: number): number => {
  if (position.direction === 'LONG') {
    return (currentPrice - position.entryPrice) * 10000 * position.volume;
  } else {
    return (position.entryPrice - currentPrice) * 10000 * position.volume;
  }
};

const calculatePositionSize = (accountBalance: number, riskPercent: number, stopLossPips: number): number => {
  const riskAmount = accountBalance * (riskPercent / 100);
  const positionSize = riskAmount / (stopLossPips * 10);
  return Math.min(positionSize, 0.1);
};

const getZambiaTradingHours = () => {
  const now = new Date();
  const zambiaHour = now.getUTCHours() + 2;
  
  if (zambiaHour >= 15 && zambiaHour < 19) {
    return { quality: 'Best', emoji: '🔥', message: 'Prime trading window - HIGH liquidity' };
  } else if (zambiaHour >= 10 && zambiaHour < 15) {
    return { quality: 'Good', emoji: '✅', message: 'Good liquidity - recommended' };
  } else if (zambiaHour >= 19 && zambiaHour < 22) {
    return { quality: 'Low', emoji: '⚠️', message: 'Low liquidity - trade with caution' };
  } else {
    return { quality: 'Avoid', emoji: '😴', message: 'Avoid trading - low volume' };
  }
};

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [useLiveData, setUseLiveData] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('EURUSD');
  
  // Trade Journal State
  const [tradeJournal, setTradeJournal] = useState<TradeJournal[]>([]);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [journalNotes, setJournalNotes] = useState('');
  
  // Account Settings
  const [accountBalance, setAccountBalance] = useState(1000);
  const [riskPercent, setRiskPercent] = useState(1);
  const [showRiskCalculator, setShowRiskCalculator] = useState(false);
  
  // Sound Notifications
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [positions, setPositions] = useState<Position[]>([
    { id: '1', symbol: 'EUR/USD', direction: 'LONG', entryPrice: 1.0850, currentPrice: 1.0892, volume: 0.1, pnl: 420, pnlPercent: 0.39, stopLoss: 1.0820, takeProfit: 1.0950, frozen: false },
    { id: '2', symbol: 'GBP/USD', direction: 'LONG', entryPrice: 1.2670, currentPrice: 1.2715, volume: 0.1, pnl: 450, pnlPercent: 0.36, stopLoss: 1.2640, takeProfit: 1.2770, frozen: true },
    { id: '3', symbol: 'USD/JPY', direction: 'SHORT', entryPrice: 157.20, currentPrice: 157.85, volume: 0.05, pnl: -325, pnlPercent: -0.21, stopLoss: 158.00, takeProfit: 156.00, frozen: false },
    { id: '4', symbol: 'AUD/USD', direction: 'LONG', entryPrice: 0.6620, currentPrice: 0.6645, volume: 0.1, pnl: 250, pnlPercent: 0.38, stopLoss: 0.6590, takeProfit: 0.6680, frozen: false },
    { id: '5', symbol: 'USD/CAD', direction: 'SHORT', entryPrice: 1.3740, currentPrice: 1.3715, volume: 0.1, pnl: 250, pnlPercent: 0.18, stopLoss: 1.3770, takeProfit: 1.3680, frozen: false },
  ]);
  
  const [newsFeed, setNewsFeed] = useState<NewsItem[]>([
    { id: '1', headline: 'Fed signals rate pause amid cooling inflation', currency: 'USD', sentiment: 'dovish', confidence: 0.85, timestamp: new Date(), source: 'Reuters' },
    { id: '2', headline: "ECB's Lagarde hints at July hike", currency: 'EUR', sentiment: 'hawkish', confidence: 0.78, timestamp: new Date(), source: 'Bloomberg' },
    { id: '3', headline: 'BoJ maintains ultra-loose policy', currency: 'JPY', sentiment: 'dovish', confidence: 0.92, timestamp: new Date(), source: 'Nikkei' },
  ]);
  
  const [equityData] = useState([
    { time: '9:30', equity: 10000 }, { time: '10:00', equity: 10150 }, 
    { time: '10:30', equity: 10200 }, { time: '11:00', equity: 10180 }, 
    { time: '11:30', equity: 10300 }, { time: '12:00', equity: 10250 },
  ]);

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;
  const frozenCount = positions.filter(p => p.frozen).length;

  // Play notification sound
  const playSignalSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  // Save trade to journal
  const saveToJournal = (symbol: string, action: string, entryPrice: number, exitPrice: number, pnl: number) => {
    const newEntry: TradeJournal = {
      id: Date.now().toString(),
      symbol,
      action,
      entryPrice,
      exitPrice,
      pnl,
      entryTime: new Date(),
      exitTime: new Date(),
      notes: journalNotes || 'No notes'
    };
    setTradeJournal(prev => [newEntry, ...prev]);
    toast.success('Trade saved to journal!');
    setShowJournalModal(false);
    setJournalNotes('');
  };

  // Get journal statistics
  const getJournalStats = () => {
    const totalTrades = tradeJournal.length;
    const winningTrades = tradeJournal.filter(t => t.pnl > 0).length;
    const totalPnL = tradeJournal.reduce((sum, t) => sum + t.pnl, 0);
    const winRate = totalTrades ? (winningTrades / totalTrades) * 100 : 0;
    return { totalTrades, winningTrades, totalPnL, winRate };
  };

  // Toggle bot
  const toggleBot = () => {
    setBotRunning(!botRunning);
    toast.success(botRunning ? 'Signal bot stopped' : 'Signal bot started - you will receive alerts on Telegram');
  };

  // Live price updates
  useEffect(() => {
    if (!botRunning) return;
    
    let isMounted = true;
    
    const fetchPrices = async () => {
      const symbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'];
      for (const symbol of symbols) {
        try {
          let price: number | null = null;
          if (useLiveData) {
            price = await alphaVantage.getLivePrice(symbol);
          } else {
            price = 1.0892 + (Math.random() - 0.5) * 0.005;
          }
          
          if (price && isMounted) {
            setPositions(prev => prev.map(p => 
              p.symbol === symbol ? { 
                ...p, 
                currentPrice: price, 
                pnl: calculatePnL(p, price),
                pnlPercent: (calculatePnL(p, price) / 10000) * 100
              } : p
            ));
            setWsConnected(true);
          }
        } catch (error) {
          console.error(`Error fetching price for ${symbol}:`, error);
        }
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [botRunning, useLiveData]);

  // Generate signals and send to Telegram
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      const tradingHours = getZambiaTradingHours();
      const signals = [
        { symbol: 'EUR/USD', action: 'BUY', price: positions.find(p => p.symbol === 'EUR/USD')?.currentPrice || 1.0892, stopLoss: 1.0860, takeProfit: 1.0950, confidence: 85 },
        { symbol: 'GBP/USD', action: 'BUY', price: positions.find(p => p.symbol === 'GBP/USD')?.currentPrice || 1.2715, stopLoss: 1.2680, takeProfit: 1.2780, confidence: 72 },
        { symbol: 'USD/JPY', action: 'SELL', price: positions.find(p => p.symbol === 'USD/JPY')?.currentPrice || 157.85, stopLoss: 158.50, takeProfit: 156.50, confidence: 68 },
      ];
      
      const randomSignal = signals[Math.floor(Math.random() * signals.length)];
      const positionSize = calculatePositionSize(accountBalance, riskPercent, 30);
      
      playSignalSound();
      
      const message = `${randomSignal.action === 'BUY' ? '🟢📈' : '🔴📉'} *${randomSignal.action} SIGNAL* ${randomSignal.action === 'BUY' ? '📈🟢' : '📉🔴'}\n\n` +
        `*Symbol:* ${randomSignal.symbol}\n` +
        `*Action:* ${randomSignal.action}\n` +
        `*Entry:* ${randomSignal.price.toFixed(5)}\n` +
        `*Stop Loss:* ${randomSignal.stopLoss.toFixed(5)}\n` +
        `*Take Profit:* ${randomSignal.takeProfit.toFixed(5)}\n` +
        `*Confidence:* ${randomSignal.confidence}%\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *POSITION SIZE*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Account: $${accountBalance}\n` +
        `Risk: ${riskPercent}% = $${(accountBalance * riskPercent / 100).toFixed(2)}\n` +
        `👉 *Recommended: ${positionSize.toFixed(3)} lots*\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *PRE-TRADE CHECKLIST*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `[ ] ${tradingHours.emoji} ${tradingHours.message}\n` +
        `[ ] Position size: ${positionSize.toFixed(3)} lots\n` +
        `[ ] Stop Loss at ${randomSignal.stopLoss.toFixed(5)}\n` +
        `[ ] Take Profit at ${randomSignal.takeProfit.toFixed(5)}\n\n` +
        `⏰ Zambia time: ${new Date().toLocaleTimeString()}`;
      
      telegramBot.sendMessage(message);
      toast.success(`📊 ${randomSignal.action} signal sent!`);
    }, 60000);
    
    return () => clearInterval(interval);
  }, [botRunning, positions, accountBalance, riskPercent, soundEnabled]);

  const journalStats = getJournalStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <Toaster position="top-right" />
      
      <audio ref={audioRef} src="https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3" preload="auto" />
      
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
          {['dashboard', 'journal', 'calculator', 'settings'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-all ${activeTab === tab ? 'bg-gradient-to-r from-emerald-500/20 to-blue-500/20 text-white border-l-2 border-emerald-400' : 'text-gray-400 hover:bg-gray-800/50'}`}>
              {tab === 'dashboard' && <Activity className="w-4 h-4" />}
              {tab === 'journal' && <BookOpen className="w-4 h-4" />}
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
                  <p className="text-xs text-gray-400">{botRunning ? 'Signal Active' : 'Standby'}</p>
                  <p className="text-[10px] text-gray-500">Manual Mode</p>
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
                <span className="text-xs text-emerald-400">{useLiveData ? 'Live Data' : 'Demo Mode'}</span>
              </div>
              <button onClick={() => setUseLiveData(!useLiveData)} className={`text-xs px-2 py-1 rounded ${useLiveData ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                {useLiveData ? '📡 Live' : '🎮 Demo'}
              </button>
              <button onClick={() => setShowChart(!showChart)} className={`text-xs px-2 py-1 rounded ${showChart ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                📊 Chart
              </button>
              <button onClick={() => setSoundEnabled(!soundEnabled)} className={`text-xs px-2 py-1 rounded ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-700 text-gray-400'}`}>
                {soundEnabled ? '🔊 On' : '🔇 Off'}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setShowRiskCalculator(!showRiskCalculator)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <Percent className="w-4 h-4" /> Risk Calc
              </button>
              <button onClick={() => setShowJournalModal(!showJournalModal)} className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <BookOpen className="w-4 h-4" /> Journal
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
              <div className={`rounded-xl p-4 ${getZambiaTradingHours().quality === 'Best' ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-blue-500/20 border border-blue-500/30'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    <span className="font-medium">Zambia Trading Hours (UTC+2)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getZambiaTradingHours().emoji}</span>
                    <span>{getZambiaTradingHours().message}</span>
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
                  <span className="text-xs text-gray-500">Updates every 30 seconds</span>
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

              {/* News Feed */}
              <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden">
                <div className="flex justify-between items-center border-b border-gray-800 px-4 py-3">
                  <h3 className="font-medium flex items-center gap-2"><Radar className="w-4 h-4 text-blue-400" /> Live AI News Feed</h3>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /><span className="text-xs text-emerald-400">Monitoring</span></div>
                </div>
                <div className="divide-y divide-gray-800 max-h-64 overflow-y-auto">
                  {newsFeed.map(signal => (
                    <div key={signal.id} className="p-3 hover:bg-gray-800/30">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-800">{signal.currency}</span>
                        <span className={`flex items-center gap-1 text-xs ${signal.sentiment === 'hawkish' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {signal.sentiment === 'hawkish' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {signal.sentiment.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-600">{(signal.confidence * 100).toFixed(0)}% conf</span>
                        <span className="text-xs text-gray-600">{signal.source}</span>
                      </div>
                      <p className="text-sm">{signal.headline}</p>
                      <div className="text-xs text-gray-500 mt-1">{signal.timestamp.toLocaleTimeString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* JOURNAL TAB */}
          {activeTab === 'journal' && (
            <div className="rounded-xl bg-gray-900 border border-gray-800 p-6">
              <h3 className="font-medium text-lg mb-4 flex items-center gap-2"><BookOpen className="w-5 h-5 text-emerald-400" /> Trade Journal</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="p-3 rounded-lg bg-gray-800/30 text-center">
                  <div className="text-xs text-gray-400">Total Trades</div>
                  <div className="text-2xl font-bold text-blue-400">{journalStats.totalTrades}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/30 text-center">
                  <div className="text-xs text-gray-400">Winning Trades</div>
                  <div className="text-2xl font-bold text-emerald-400">{journalStats.winningTrades}</div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/30 text-center">
                  <div className="text-xs text-gray-400">Total P&L</div>
                  <div className={`text-2xl font-bold ${journalStats.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${journalStats.totalPnL.toFixed(0)}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-gray-800/30 text-center">
                  <div className="text-xs text-gray-400">Win Rate</div>
                  <div className="text-2xl font-bold text-purple-400">{journalStats.winRate.toFixed(0)}%</div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-800/50">
                    <tr className="text-gray-400">
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Symbol</th>
                      <th className="px-4 py-2 text-left">Action</th>
                      <th className="px-4 py-2 text-left">Entry</th>
                      <th className="px-4 py-2 text-left">Exit</th>
                      <th className="px-4 py-2 text-left">P&L</th>
                      <th className="px-4 py-2 text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tradeJournal.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-8 text-gray-500">No trades recorded yet.</td></tr>
                    ) : (
                      tradeJournal.map(trade => (
                        <tr key={trade.id} className="border-b border-gray-800/50">
                          <td className="px-4 py-3 text-xs">{new Date(trade.entryTime).toLocaleString()}</td>
                          <td className="px-4 py-3">{trade.symbol}</td>
                          <td className="px-4 py-3"><span className={`rounded px-2 py-0.5 text-xs ${trade.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{trade.action}</span></td>
                          <td className="px-4 py-3 font-mono">{trade.entryPrice.toFixed(5)}</td>
                          <td className="px-4 py-3 font-mono">{trade.exitPrice.toFixed(5)}</td>
                          <td className={`px-4 py-3 ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>${trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}</td>
                          <td className="px-4 py-3 text-xs truncate max-w-[150px]">{trade.notes}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
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
                    <span className="text-gray-400">Sound Alerts:</span>
                    <span className={soundEnabled ? "text-green-400" : "text-red-400"}>{soundEnabled ? "🔊 Enabled" : "🔇 Disabled"}</span>
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
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Trade Journal Modal */}
      {showJournalModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-xl p-6 max-w-md w-full mx-4 border border-gray-700">
            <h3 className="text-lg font-bold mb-4">Save Trade to Journal</h3>
            <textarea value={journalNotes} onChange={(e) => setJournalNotes(e.target.value)} className="w-full mt-1 rounded bg-gray-800 border-gray-700 p-2 text-white h-24" placeholder="Enter trade notes..." />
            <div className="flex gap-3 mt-4">
              <button onClick={() => saveToJournal('EUR/USD', 'BUY', 1.0892, 1.0920, 28)} className="flex-1 bg-emerald-500/20 text-emerald-400 py-2 rounded-lg">Save Profit</button>
              <button onClick={() => saveToJournal('EUR/USD', 'BUY', 1.0892, 1.0870, -22)} className="flex-1 bg-red-500/20 text-red-400 py-2 rounded-lg">Save Loss</button>
            </div>
            <button onClick={() => setShowJournalModal(false)} className="w-full mt-3 bg-gray-800 text-gray-400 py-2 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

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
