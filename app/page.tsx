"use client";

import { useState, useEffect } from "react";
import { Toaster, toast } from "react-hot-toast";
import { 
  Bot, MessageCircle, Play, Pause, Activity, Settings, 
  TrendingUp, TrendingDown, Shield, Wifi, WifiOff, 
  DollarSign, ChevronRight, ChevronLeft, Target, Radar, Download 
} from "lucide-react";
import { 
  AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from "recharts";
import { TelegramAlertBot, TradeAlert } from './lib/telegram-alerts';
import { AlphaVantageAPI } from './lib/broker-api';

// ============ TELEGRAM BOT INITIALIZATION ============
const telegramBot = new TelegramAlertBot();
telegramBot.setToken('8798974385:AAFjbGdsC3qJVe0FwQ581nCPb0VBC_4m68Q', '7724961440');

// ============ API INITIALIZATION ============
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

const calculatePnL = (position: Position, currentPrice: number): number => {
  if (position.direction === 'LONG') {
    return (currentPrice - position.entryPrice) * 10000 * position.volume;
  } else {
    return (position.entryPrice - currentPrice) * 10000 * position.volume;
  }
};

export default function Home() {
  const [botRunning, setBotRunning] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [useLiveData, setUseLiveData] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  
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
  
  const [pnlData] = useState([
    { date: 'Mon', pnl: 120 }, { date: 'Tue', pnl: -80 }, { date: 'Wed', pnl: 200 },
    { date: 'Thu', pnl: 150 }, { date: 'Fri', pnl: -50 }, 
  ]);

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

  // Generate mock news
  useEffect(() => {
    if (!botRunning) return;
    
    const interval = setInterval(() => {
      const headlines = [
        `Fed ${Math.random() > 0.5 ? 'hints at' : 'signals'} rate change`,
        `ECB ${Math.random() > 0.5 ? 'hawkish' : 'dovish'} comments`,
        `BOJ maintains policy as expected`,
      ];
      
      const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];
      const sentiment = Math.random() > 0.5 ? 'hawkish' : 'dovish';
      const currency = currencies[Math.floor(Math.random() * currencies.length)];
      
      const newSignal: NewsItem = {
        id: Date.now().toString(),
        headline: headlines[Math.floor(Math.random() * headlines.length)],
        currency: currency,
        sentiment: sentiment,
        confidence: 0.6 + Math.random() * 0.35,
        timestamp: new Date(),
        source: ['Reuters', 'Bloomberg', 'FT', 'WSJ'][Math.floor(Math.random() * 4)]
      };
      
      setNewsFeed(prev => [newSignal, ...prev.slice(0, 19)]);
    }, 20000);
    
    return () => clearInterval(interval);
  }, [botRunning]);

  const toggleBot = async () => {
    if (!botRunning) {
      setBotRunning(true);
      await telegramBot.sendAlert('Trading Bot', '🤖 Bot activated - monitoring markets', 'info');
      toast.success('🤖 Trading bot activated');
    } else {
      setBotRunning(false);
      await telegramBot.sendAlert('Trading Bot', '⏸️ Bot paused', 'warning');
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

  const exportData = () => {
    const data = { positions, newsFeed, exportDate: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forexpulse_export_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  };

  const totalPnL = positions.reduce((sum, p) => sum + p.pnl, 0);
  const winRate = positions.length ? (positions.filter(p => p.pnl > 0).length / positions.length) * 100 : 0;
  const frozenCount = positions.filter(p => p.frozen).length;

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
        <header className="sticky top-0 z-30 border-b border-gray-800 bg-gray-950/95 backdrop-blur-xl px-6 py-3">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${wsConnected ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {useLiveData ? 'Alpha Vantage' : 'Demo Mode'}
              </div>
              <button onClick={() => setUseLiveData(!useLiveData)} className={`text-xs px-2 py-1 rounded ${useLiveData ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-700 text-gray-400'}`}>
                {useLiveData ? '📡 Live' : '🎮 Demo'}
              </button>
            </div>
            
            <div className="flex gap-2">
              <button onClick={sendTestAlert} className="bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <MessageCircle className="w-4 h-4" /> Test Alert
              </button>
              <button onClick={exportData} className="bg-gray-800 text-gray-400 hover:bg-gray-700 px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" /> Export
              </button>
              <button onClick={toggleBot} className={`px-4 py-1.5 rounded-lg flex items-center gap-2 text-sm ${botRunning ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'}`}>
                {botRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {botRunning ? 'Bot Active' : 'Start Bot'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
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
                    <span className="text-sm">{botRunning ? 'Trading' : 'Standby'}</span>
                  </div>
                </div>
                <div className="rounded-xl bg-gray-900 border border-gray-800 p-4">
                  <div className="text-xs text-gray-400">Data Source</div>
                  <div className="text-sm font-bold mt-1 text-blue-400">{useLiveData ? 'Alpha Vantage' : 'Demo'}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <span className="text-gray-400">Alpha Vantage API:</span>
                    <span className="text-green-400">✓ Configured</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-800">
                    <span className="text-gray-400">Trading Bot:</span>
                    <span className={botRunning ? "text-green-400" : "text-yellow-400"}>{botRunning ? "🟢 Running" : "🟡 Stopped"}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-400">Data Source:</span>
                    <span className={useLiveData ? "text-blue-400" : "text-yellow-400"}>{useLiveData ? "Alpha Vantage (Live Forex)" : "Demo Mode"}</span>
                  </div>
                </div>
                <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-300">📌 How to use:</p>
                  <ol className="text-xs text-gray-400 list-decimal list-inside mt-2 space-y-1">
                    <li>Message your bot on Telegram (click Start)</li>
                    <li>Click <span className="text-cyan-400">"Start Bot"</span> to begin automated trading</li>
                    <li>Click <span className="text-cyan-400">"Test Alert"</span> to verify Telegram connection</li>
                    <li>Toggle <span className="text-cyan-400">"Live/Demo"</span> to switch data sources</li>
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
