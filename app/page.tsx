"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, Settings, Play, Pause, MessageCircle,
  TrendingUp, TrendingDown, Minus, ChevronLeft,
  AlertTriangle, Percent, Zap, Radio, Clock,
  BarChart2, Shield, Target, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import TradingViewChart from "./components/TradingViewChart";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Position {
  id: string;
  symbol: string;
  direction: "LONG" | "SHORT";
  entryPrice: number;
  currentPrice: number;
  volume: number;
  stopLoss: number;
  takeProfit: number;
  frozen: boolean;
  openTime: string;
}

interface EquityPoint { time: string; equity: number; }
interface SignalHistory {
  id: string;
  symbol: string;
  action: "BUY" | "SELL" | "HOLD";
  confidence: number;
  time: string;
  rsi: number;
  result?: "WIN" | "LOSS" | "OPEN";
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD"] as const;

const PIP_MULT: Record<string, number> = {
  "EUR/USD": 10000, "GBP/USD": 10000, "USD/JPY": 100,
  "AUD/USD": 10000, "USD/CAD": 10000,
};

const INITIAL_POSITIONS: Position[] = [
  { id:"1", symbol:"EUR/USD", direction:"LONG",  entryPrice:1.08500, currentPrice:1.08920, volume:0.1, stopLoss:1.0820, takeProfit:1.0950, frozen:false, openTime:"09:14" },
  { id:"2", symbol:"GBP/USD", direction:"LONG",  entryPrice:1.26700, currentPrice:1.27150, volume:0.1, stopLoss:1.2640, takeProfit:1.2770, frozen:true,  openTime:"10:02" },
  { id:"3", symbol:"USD/JPY", direction:"SHORT", entryPrice:157.200, currentPrice:157.850, volume:0.05,stopLoss:158.00, takeProfit:156.00, frozen:false, openTime:"10:45" },
  { id:"4", symbol:"AUD/USD", direction:"LONG",  entryPrice:0.66200, currentPrice:0.66450, volume:0.1, stopLoss:0.6590, takeProfit:0.6680, frozen:false, openTime:"11:30" },
  { id:"5", symbol:"USD/CAD", direction:"SHORT", entryPrice:1.37400, currentPrice:1.37150, volume:0.1, stopLoss:1.3770, takeProfit:1.3680, frozen:false, openTime:"12:15" },
];

const INITIAL_EQUITY: EquityPoint[] = [
  { time:"Mon", equity:9800 }, { time:"Tue", equity:10050 },
  { time:"Wed", equity:9920 }, { time:"Thu", equity:10280 },
  { time:"Fri", equity:10150 }, { time:"Sat", equity:10420 },
  { time:"Now", equity:10520 },
];

const INITIAL_SIGNALS: SignalHistory[] = [
  { id:"s1", symbol:"EUR/USD", action:"BUY",  confidence:82, time:"12:01", rsi:34.2, result:"WIN"  },
  { id:"s2", symbol:"GBP/USD", action:"SELL", confidence:71, time:"11:02", rsi:67.8, result:"LOSS" },
  { id:"s3", symbol:"USD/JPY", action:"BUY",  confidence:88, time:"10:14", rsi:29.1, result:"WIN"  },
  { id:"s4", symbol:"AUD/USD", action:"SELL", confidence:74, time:"09:33", rsi:71.4, result:"WIN"  },
  { id:"s5", symbol:"EUR/USD", action:"BUY",  confidence:79, time:"08:50", rsi:38.6, result:"OPEN" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPnL(p: Position): number {
  const mult = PIP_MULT[p.symbol] ?? 10000;
  const diff = p.direction === "LONG"
    ? p.currentPrice - p.entryPrice
    : p.entryPrice - p.currentPrice;
  return diff * mult * p.volume * 10;
}

function getSession() {
  const h = parseInt(new Date().toLocaleString("en-GB", {
    timeZone: "Africa/Lusaka", hour: "numeric", hour12: false
  }), 10);
  if (h >= 15 && h < 19) return { label: "London/NY", quality: 3, color: "#00D4AA" };
  if (h >= 10 && h < 15) return { label: "London",    quality: 2, color: "#F0B429" };
  if (h >= 3  && h < 10) return { label: "Tokyo",     quality: 1, color: "#6B7A99" };
  return                         { label: "Off-hours", quality: 0, color: "#3D4A63" };
}

function zambiaTime() {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Africa/Lusaka", hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

function calcLotSize(balance: number, risk: number, slPips: number) {
  if (slPips <= 0) return 0;
  return Math.min(Math.round((balance * risk / 100) / (slPips * 10) * 1000) / 1000, 0.1);
}

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function PulseRing({ active }: { active: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {active && (
        <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
          style={{ backgroundColor: "#00D4AA" }} />
      )}
      <span className="relative inline-flex rounded-full h-3 w-3"
        style={{ backgroundColor: active ? "#00D4AA" : "#3D4A63" }} />
    </span>
  );
}

function StatCard({ label, value, sub, accent, icon: Icon }: {
  label: string; value: string; sub?: string;
  accent?: string; icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-1"
      style={{ backgroundColor: "#0A1628", border: "1px solid #1A2A45" }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium tracking-widest uppercase"
          style={{ color: "#4A5A7A" }}>{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: "#4A5A7A" }} />}
      </div>
      <div className="font-mono text-2xl font-bold tracking-tight"
        style={{ color: accent || "#E8EDF5" }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: "#4A5A7A" }}>{sub}</div>}
    </div>
  );
}

function SignalBadge({ action }: { action: "BUY" | "SELL" | "HOLD" }) {
  const cfg = {
    BUY:  { bg: "rgba(0,212,170,0.12)",  color: "#00D4AA", label: "▲ BUY"  },
    SELL: { bg: "rgba(255,69,96,0.12)",   color: "#FF4560", label: "▼ SELL" },
    HOLD: { bg: "rgba(107,122,153,0.12)", color: "#6B7A99", label: "— HOLD" },
  }[action];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-bold"
      style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? "#00D4AA" : value >= 65 ? "#F0B429" : "#FF4560";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-1" style={{ background: "#1A2A45" }}>
        <div className="h-1 rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="font-mono text-xs w-8 text-right" style={{ color }}>{value}%</span>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab]                         = useState<"dashboard" | "signals" | "calculator" | "settings">("dashboard");
  const [navOpen, setNavOpen]                 = useState(true);
  const [botRunning, setBotRunning]           = useState(false);
  const [signalCount, setSignalCount]         = useState(0);
  const [mt5Connected, setMt5Connected]       = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [showChart, setShowChart]             = useState(true);
  const [selectedPair, setSelectedPair]       = useState("EURUSD");
  const [positions, setPositions]             = useState<Position[]>(INITIAL_POSITIONS);
  const [equity, setEquity]                   = useState<EquityPoint[]>(INITIAL_EQUITY);
  const [signals, setSignals]                 = useState<SignalHistory[]>(INITIAL_SIGNALS);
  const [clock, setClock]                     = useState(zambiaTime());
  const [balance, setBalance]                 = useState(1000);
  const [risk, setRisk]                       = useState(1);
  const [slPips, setSlPips]                   = useState(30);
  const [toast, setToast]                     = useState<{ msg: string; ok: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const session = getSession();

  // derived
  const posWithPnL = positions.map(p => ({ ...p, pnl: calcPnL(p) }));
  const totalPnL   = posWithPnL.reduce((s, p) => s + p.pnl, 0);
  const openCount  = positions.length;
  const winCount   = signals.filter(s => s.result === "WIN").length;
  const totalClosed = signals.filter(s => s.result !== "OPEN").length;
  const winRate    = totalClosed ? Math.round(winCount / totalClosed * 100) : 0;

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // clock tick
  useEffect(() => {
    const id = setInterval(() => setClock(zambiaTime()), 1000);
    return () => clearInterval(id);
  }, []);

  // poll bot status
  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/live-signals");
        if (!res.ok) return;
        const d = await res.json();
        setBotRunning(d.running ?? false);
        setSignalCount(d.signalCount ?? 0);
        setMt5Connected(d.mt5Connected ?? false);
      } catch { /* ignore */ }
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // live price simulation
  useEffect(() => {
    if (!botRunning) return;
    const id = setInterval(() => {
      setPositions(prev => prev.map(p => ({
        ...p,
        currentPrice: Number((p.currentPrice + (Math.random() - 0.5) * 0.0004)
          .toFixed(p.symbol === "USD/JPY" ? 3 : 5)),
      })));
      setEquity(prev => {
        const last = prev[prev.length - 1];
        const next = { time: clock.slice(0, 5), equity: Math.round(last.equity + (Math.random() - 0.47) * 60) };
        const updated = [...prev, next];
        return updated.length > 24 ? updated.slice(-24) : updated;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [botRunning, clock]);

  const toggleBot = useCallback(async () => {
    if (toggling) return;
    setToggling(true);
    try {
      const res = await fetch("/api/live-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: botRunning ? "stop" : "start", balance, risk }),
      });
      const d = await res.json();
      if (d.success) {
        setBotRunning(!botRunning);
        showToast(botRunning ? "Bot stopped" : "Bot started — signals every 60s");
      } else {
        showToast(d.message || "Action failed", false);
      }
    } catch { showToast("Could not reach server", false); }
    finally { setToggling(false); }
  }, [botRunning, toggling, balance, risk]);

  const sendTest = useCallback(async () => {
    try {
      const res = await fetch("/api/live-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const d = await res.json();
      showToast(d.success ? "Test signal sent to Telegram ✓" : d.message || "Failed", d.success);
      if (d.success) {
        setSignals(prev => [{
          id: Date.now().toString(),
          symbol: d.signal?.symbol || "EUR/USD",
          action: d.signal?.action || "BUY",
          confidence: d.signal?.confidence || 75,
          time: clock.slice(0, 5),
          rsi: d.signal?.rsi || 50,
          result: "OPEN",
        }, ...prev.slice(0, 9)]);
        setSignalCount(c => c + 1);
      }
    } catch { showToast("Could not reach server", false); }
  }, [clock]);

  const unfreezePos = (id: string) => {
    setPositions(prev => prev.map(p => p.id === id ? { ...p, frozen: false } : p));
    showToast("Position unfrozen");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const NAV_ITEMS = [
    { id: "dashboard",  label: "Dashboard",  Icon: BarChart2   },
    { id: "signals",    label: "Signals",    Icon: Radio       },
    { id: "calculator", label: "Calculator", Icon: Percent     },
    { id: "settings",   label: "Settings",   Icon: Settings    },
  ] as const;

  return (
    <div className="min-h-screen flex font-sans"
      style={{ background: "#050C1A", color: "#E8EDF5" }}>

      {/* Scanline texture overlay */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)",
          mixBlendMode: "overlay",
        }} />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200"
        style={{
          width: navOpen ? 220 : 60,
          background: "#050C1A",
          borderRight: "1px solid #1A2A45",
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0"
          style={{ borderBottom: "1px solid #1A2A45" }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, #00D4AA, #0099FF)" }}>
            <Zap className="w-4 h-4 text-white" />
          </div>
          {navOpen && (
            <div>
              <div className="text-sm font-bold tracking-tight" style={{ color: "#E8EDF5" }}>ForexPulse</div>
              <div className="text-[10px] tracking-widest uppercase" style={{ color: "#00D4AA" }}>PRO</div>
            </div>
          )}
          <button onClick={() => setNavOpen(!navOpen)}
            className="ml-auto p-1 rounded hover:bg-white/5 transition-colors"
            style={{ color: "#4A5A7A" }}>
            <ChevronLeft className={`w-4 h-4 transition-transform ${navOpen ? "" : "rotate-180"}`} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id as typeof tab)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                background: tab === id ? "rgba(0,212,170,0.08)" : "transparent",
                color: tab === id ? "#00D4AA" : "#4A5A7A",
                borderLeft: tab === id ? "2px solid #00D4AA" : "2px solid transparent",
              }}>
              <Icon className="w-4 h-4 shrink-0" />
              {navOpen && <span className="font-medium">{label}</span>}
              {navOpen && id === "signals" && signalCount > 0 && (
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: "rgba(0,212,170,0.15)", color: "#00D4AA" }}>
                  {signalCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bot status */}
        <div className="px-3 pb-4">
          <div className="rounded-lg p-3" style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
            <div className="flex items-center gap-2">
              <PulseRing active={botRunning} />
              {navOpen && (
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color: botRunning ? "#00D4AA" : "#4A5A7A" }}>
                    {botRunning ? "Sending signals" : "Standby"}
                  </div>
                  {botRunning && (
                    <div className="text-[10px] font-mono truncate" style={{ color: "#4A5A7A" }}>
                      {signalCount} sent · {clock}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-h-screen transition-all duration-200 relative z-10"
        style={{ marginLeft: navOpen ? 220 : 60 }}>

        {/* Header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6"
          style={{ background: "rgba(5,12,26,0.95)", borderBottom: "1px solid #1A2A45", backdropFilter: "blur(12px)" }}>

          {/* Session + clock */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: session.color }} />
              <span className="text-xs font-mono" style={{ color: session.color }}>{session.label}</span>
            </div>
            <span className="text-xs font-mono" style={{ color: "#4A5A7A" }}>{clock} CAT</span>
            {mt5Connected && (
              <span className="text-xs px-2 py-1 rounded font-mono"
                style={{ background: "rgba(0,212,170,0.08)", color: "#00D4AA", border: "1px solid rgba(0,212,170,0.2)" }}>
                MT5 ●
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChart(s => !s)}
              className="h-8 px-3 rounded text-xs font-medium transition-colors"
              style={{
                background: showChart ? "rgba(99,102,241,0.1)" : "transparent",
                color: showChart ? "#818CF8" : "#4A5A7A",
                border: "1px solid",
                borderColor: showChart ? "rgba(99,102,241,0.3)" : "#1A2A45",
              }}>
              Chart
            </button>
            <button onClick={sendTest}
              className="h-8 px-3 rounded text-xs font-medium transition-colors"
              style={{ background: "rgba(0,153,255,0.08)", color: "#0099FF", border: "1px solid rgba(0,153,255,0.2)" }}>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5" /> Test
              </span>
            </button>
            <button onClick={toggleBot} disabled={toggling}
              className="h-8 px-4 rounded text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
              style={{
                background: botRunning ? "rgba(255,69,96,0.1)" : "rgba(0,212,170,0.1)",
                color: botRunning ? "#FF4560" : "#00D4AA",
                border: `1px solid ${botRunning ? "rgba(255,69,96,0.3)" : "rgba(0,212,170,0.3)"}`,
              }}>
              {toggling
                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                : botRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />
              }
              {botRunning ? "Stop" : "Start"}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">

          {/* ══ DASHBOARD ══════════════════════════════════════════════════════ */}
          {tab === "dashboard" && (
            <>
              {/* Session quality bar */}
              <div className="rounded-xl px-5 py-3 flex items-center justify-between"
                style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4" style={{ color: session.color }} />
                  <span className="text-sm font-medium" style={{ color: session.color }}>
                    {session.label} Session
                  </span>
                  <div className="flex gap-1">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-5 h-1.5 rounded-full"
                        style={{ background: i <= session.quality ? session.color : "#1A2A45" }} />
                    ))}
                  </div>
                </div>
                <span className="text-xs font-mono" style={{ color: "#4A5A7A" }}>
                  {session.quality === 3 ? "Highest liquidity" :
                   session.quality === 2 ? "Good liquidity" :
                   session.quality === 1 ? "Low liquidity" : "Market closed"}
                </span>
              </div>

              {/* KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Total P&L" icon={TrendingUp}
                  value={`${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(0)}`}
                  accent={totalPnL >= 0 ? "#00D4AA" : "#FF4560"}
                  sub="open positions" />
                <StatCard label="Win Rate" icon={Target}
                  value={`${winRate}%`} accent="#F0B429"
                  sub={`${winCount}/${totalClosed} closed`} />
                <StatCard label="Open Positions" icon={Activity}
                  value={String(openCount)}
                  sub={positions.filter(p=>p.frozen).length > 0 ? `${positions.filter(p=>p.frozen).length} frozen` : "all active"} />
                <StatCard label="Signals Sent" icon={Radio}
                  value={String(signalCount)}
                  accent={botRunning ? "#00D4AA" : "#4A5A7A"}
                  sub={botRunning ? "bot active" : "bot stopped"} />
                <StatCard label="Account" icon={Shield}
                  value={`$${balance.toLocaleString()}`}
                  accent="#0099FF" sub={`${risk}% risk / trade`} />
              </div>

              {/* Chart */}
              {showChart && (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1A2A45" }}>
                  <div className="flex items-center gap-2 px-4 py-3"
                    style={{ borderBottom: "1px solid #1A2A45", background: "#0A1628" }}>
                    {PAIRS.map(p => (
                      <button key={p} onClick={() => setSelectedPair(p)}
                        className="px-3 py-1 rounded text-xs font-mono transition-all"
                        style={{
                          background: selectedPair === p ? "rgba(0,212,170,0.1)" : "transparent",
                          color: selectedPair === p ? "#00D4AA" : "#4A5A7A",
                          border: `1px solid ${selectedPair === p ? "rgba(0,212,170,0.3)" : "transparent"}`,
                        }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <TradingViewChart symbol={selectedPair} interval="60" theme="dark" />
                </div>
              )}

              {/* Equity curve */}
              <div className="rounded-xl p-5" style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold tracking-wide" style={{ color: "#E8EDF5" }}>
                    Equity Curve
                  </span>
                  <span className="text-xs font-mono" style={{ color: "#4A5A7A" }}>
                    {equity.length > 1
                      ? `${equity[equity.length-1].equity > equity[0].equity ? "+" : ""}$${(equity[equity.length-1].equity - equity[0].equity).toFixed(0)}`
                      : ""}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={equity}>
                    <defs>
                      <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00D4AA" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1A2A45" strokeDasharray="4 4" />
                    <XAxis dataKey="time" stroke="#2A3A55" tick={{ fill: "#4A5A7A", fontSize: 11, fontFamily: "monospace" }} />
                    <YAxis stroke="#2A3A55" tick={{ fill: "#4A5A7A", fontSize: 11, fontFamily: "monospace" }} domain={["auto","auto"]} />
                    <Tooltip
                      contentStyle={{ background: "#0A1628", border: "1px solid #1A2A45", borderRadius: 8, color: "#E8EDF5" }}
                      formatter={(v: number) => [`$${v.toLocaleString()}`, "Equity"]}
                      labelStyle={{ color: "#4A5A7A", fontFamily: "monospace", fontSize: 11 }}
                    />
                    <ReferenceLine y={10000} stroke="#1A2A45" strokeDasharray="4 4" />
                    <Area type="monotone" dataKey="equity" stroke="#00D4AA" strokeWidth={2} fill="url(#eqGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Positions table */}
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1A2A45" }}>
                <div className="flex items-center justify-between px-5 py-3.5"
                  style={{ background: "#0A1628", borderBottom: "1px solid #1A2A45" }}>
                  <span className="text-sm font-semibold">Open Positions</span>
                  <span className="text-xs font-mono" style={{ color: "#4A5A7A" }}>
                    {botRunning ? "● Live" : "● Paused"}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid #1A2A45" }}>
                        {["Symbol","Dir","Entry","Current","P&L","SL / TP","Status"].map(h => (
                          <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold tracking-widest uppercase"
                            style={{ color: "#4A5A7A", background: "#070F1E" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {posWithPnL.map((p, i) => (
                        <tr key={p.id}
                          className="transition-colors"
                          style={{
                            borderBottom: i < posWithPnL.length - 1 ? "1px solid #0F1E35" : "none",
                            background: "transparent",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#0A1628")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <td className="px-5 py-3.5 font-mono font-bold text-xs" style={{ color: "#E8EDF5" }}>
                            {p.symbol}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold">
                              {p.direction === "LONG"
                                ? <><TrendingUp  className="w-3 h-3" style={{ color: "#00D4AA" }} /><span style={{ color: "#00D4AA" }}>LONG</span></>
                                : <><TrendingDown className="w-3 h-3" style={{ color: "#FF4560" }} /><span style={{ color: "#FF4560" }}>SHORT</span></>
                              }
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#6B7A99" }}>
                            {p.entryPrice.toFixed(p.symbol === "USD/JPY" ? 3 : 5)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#E8EDF5" }}>
                            {p.currentPrice.toFixed(p.symbol === "USD/JPY" ? 3 : 5)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-sm font-bold"
                            style={{ color: p.pnl >= 0 ? "#00D4AA" : "#FF4560" }}>
                            {p.pnl >= 0 ? "+" : ""}${p.pnl.toFixed(0)}
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#4A5A7A" }}>
                            <span style={{ color: "#FF4560" }}>{p.stopLoss.toFixed(4)}</span>
                            {" / "}
                            <span style={{ color: "#00D4AA" }}>{p.takeProfit.toFixed(4)}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            {p.frozen
                              ? <button onClick={() => unfreezePos(p.id)}
                                  className="text-xs font-mono px-2 py-1 rounded transition-colors"
                                  style={{ background: "rgba(240,180,41,0.1)", color: "#F0B429", border: "1px solid rgba(240,180,41,0.2)" }}
                                  title="Click to unfreeze">
                                  🔒 Frozen
                                </button>
                              : <span className="text-xs font-mono" style={{ color: "#00D4AA" }}>● Active</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl px-5 py-4 flex gap-3"
                style={{ background: "rgba(240,180,41,0.04)", border: "1px solid rgba(240,180,41,0.15)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#F0B429" }} />
                <p className="text-xs leading-relaxed" style={{ color: "#6B7A99" }}>
                  <span style={{ color: "#F0B429" }}>Demo mode.</span> Signals use simulated price history.
                  Positions are not connected to a live broker. Do not risk real capital based on these signals alone.
                </p>
              </div>
            </>
          )}

          {/* ══ SIGNALS ════════════════════════════════════════════════════════ */}
          {tab === "signals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Signal History</h2>
                <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "#4A5A7A" }}>
                  <span style={{ color: "#00D4AA" }}>{winCount}W</span>
                  <span>/</span>
                  <span style={{ color: "#FF4560" }}>{totalClosed - winCount}L</span>
                  <span>· {winRate}% win rate</span>
                </div>
              </div>

              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #1A2A45" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1A2A45" }}>
                      {["Time","Symbol","Signal","Confidence","RSI","Result"].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold tracking-widest uppercase"
                          style={{ color: "#4A5A7A", background: "#070F1E" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {signals.map((s, i) => (
                      <tr key={s.id}
                        style={{ borderBottom: i < signals.length - 1 ? "1px solid #0F1E35" : "none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#0A1628")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        className="transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "#4A5A7A" }}>{s.time}</td>
                        <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{ color: "#E8EDF5" }}>{s.symbol}</td>
                        <td className="px-5 py-3.5"><SignalBadge action={s.action} /></td>
                        <td className="px-5 py-3.5 w-36"><ConfidenceBar value={s.confidence} /></td>
                        <td className="px-5 py-3.5 font-mono text-xs"
                          style={{ color: s.rsi < 35 ? "#00D4AA" : s.rsi > 65 ? "#FF4560" : "#6B7A99" }}>
                          {s.rsi.toFixed(1)}
                        </td>
                        <td className="px-5 py-3.5">
                          {s.result === "WIN"  && <span className="text-xs font-mono font-bold" style={{ color: "#00D4AA" }}>● WIN</span>}
                          {s.result === "LOSS" && <span className="text-xs font-mono font-bold" style={{ color: "#FF4560" }}>● LOSS</span>}
                          {s.result === "OPEN" && <span className="text-xs font-mono font-bold" style={{ color: "#F0B429" }}>◌ OPEN</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ══ CALCULATOR ═════════════════════════════════════════════════════ */}
          {tab === "calculator" && (
            <div className="max-w-md space-y-5">
              <h2 className="text-lg font-bold">Position Size Calculator</h2>
              <div className="rounded-xl p-6 space-y-5" style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
                {[
                  { label: "Account balance (USD)", value: balance, set: setBalance, step: 100, min: 100 },
                  { label: "Risk per trade (%)", value: risk, set: setRisk, step: 0.5, min: 0.1, max: 10 },
                  { label: "Stop loss (pips)", value: slPips, set: setSlPips, step: 5, min: 1 },
                ].map(({ label, value, set, step, min, max }) => (
                  <label key={label} className="block">
                    <span className="text-xs font-semibold tracking-widest uppercase block mb-2"
                      style={{ color: "#4A5A7A" }}>{label}</span>
                    <input type="number" value={value} step={step} min={min} max={max}
                      onChange={e => set(Number(e.target.value))}
                      className="w-full rounded-lg px-4 py-2.5 font-mono text-sm outline-none transition-colors"
                      style={{ background: "#070F1E", border: "1px solid #1A2A45", color: "#E8EDF5" }}
                      onFocus={e => (e.target.style.borderColor = "#00D4AA")}
                      onBlur={e  => (e.target.style.borderColor = "#1A2A45")}
                    />
                  </label>
                ))}

                <div className="rounded-xl p-5" style={{ background: "#070F1E", border: "1px solid rgba(0,212,170,0.2)" }}>
                  <div className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: "#4A5A7A" }}>
                    Result
                  </div>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="font-mono text-5xl font-bold" style={{ color: "#00D4AA" }}>
                      {calcLotSize(balance, risk, slPips).toFixed(3)}
                    </span>
                    <span className="mb-2 font-mono text-sm" style={{ color: "#4A5A7A" }}>lots</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div>
                      <div style={{ color: "#4A5A7A" }}>Risk amount</div>
                      <div style={{ color: "#E8EDF5" }}>${(balance * risk / 100).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#4A5A7A" }}>Max drawdown</div>
                      <div style={{ color: "#FF4560" }}>–${(balance * risk / 100).toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: "#4A5A7A" }}>Pip value</div>
                      <div style={{ color: "#E8EDF5" }}>${(calcLotSize(balance, risk, slPips) * 10).toFixed(2)}/pip</div>
                    </div>
                    <div>
                      <div style={{ color: "#4A5A7A" }}>1:2 take profit</div>
                      <div style={{ color: "#00D4AA" }}>+${(balance * risk / 100 * 2).toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ SETTINGS ═══════════════════════════════════════════════════════ */}
          {tab === "settings" && (
            <div className="max-w-lg space-y-5">
              <h2 className="text-lg font-bold">Configuration</h2>

              {/* Status */}
              <div className="rounded-xl p-5 space-y-0" style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
                {[
                  { label: "Telegram bot",     value: "Connected",           color: "#00D4AA" },
                  { label: "MT5 bridge",        value: mt5Connected ? "Connected" : "Not configured", color: mt5Connected ? "#00D4AA" : "#F0B429" },
                  { label: "Signal interval",   value: "Every 60 seconds",    color: "#6B7A99" },
                  { label: "Trading engine",    value: "RSI + MACD + MA",     color: "#6B7A99" },
                  { label: "Bot status",        value: botRunning ? `Running — ${signalCount} sent` : "Standby", color: botRunning ? "#00D4AA" : "#F0B429" },
                ].map((row, i, arr) => (
                  <div key={row.label} className="flex justify-between py-3.5 text-sm"
                    style={{ borderBottom: i < arr.length-1 ? "1px solid #0F1E35" : "none" }}>
                    <span style={{ color: "#4A5A7A" }}>{row.label}</span>
                    <span className="font-mono text-xs" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>

              {/* How to use */}
              <div className="rounded-xl p-5" style={{ background: "#0A1628", border: "1px solid #1A2A45" }}>
                <div className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: "#4A5A7A" }}>
                  How to use
                </div>
                <ol className="space-y-3">
                  {[
                    ["Start Signals", "Press Start in the header to begin receiving alerts"],
                    ["Telegram",      "A signal arrives every 60 seconds with entry, SL, TP, and lot size"],
                    ["MT5",           "Open Exness on your phone and execute the trade manually"],
                    ["Risk",          "Never risk more than 1–2% of your account per trade"],
                    ["Sessions",      "Best time to trade: 3 PM–7 PM Zambia time (London/NY overlap)"],
                  ].map(([title, desc], i) => (
                    <li key={title} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: "rgba(0,212,170,0.1)", color: "#00D4AA" }}>
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-xs" style={{ color: "#E8EDF5" }}>{title} — </span>
                        <span className="text-xs" style={{ color: "#6B7A99" }}>{desc}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Risk warning */}
              <div className="rounded-xl p-5 flex gap-3"
                style={{ background: "rgba(255,69,96,0.04)", border: "1px solid rgba(255,69,96,0.15)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#FF4560" }} />
                <p className="text-xs leading-relaxed" style={{ color: "#6B7A99" }}>
                  <span style={{ color: "#FF4560" }}>Risk warning.</span> Forex trading involves significant risk of loss.
                  These signals use simulated data for educational purposes. Only trade money you can afford to lose.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-2xl"
          style={{
            background: "#0A1628",
            border: `1px solid ${toast.ok ? "rgba(0,212,170,0.3)" : "rgba(255,69,96,0.3)"}`,
            color: toast.ok ? "#00D4AA" : "#FF4560",
          }}>
          <span>{toast.ok ? "✓" : "✗"}</span>
          {toast.msg}
        </div>
      )}

    </div>
  );
}
