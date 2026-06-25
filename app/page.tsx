"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Play, Pause, MessageCircle, TrendingUp, TrendingDown,
  AlertTriangle, Percent, Radio, Clock, BarChart2,
  Shield, Target, RefreshCw, Check, X, Settings,
  ChevronLeft, Zap, Activity
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";
import TradingViewChart from "./components/TradingViewChart";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Position {
  id: string; symbol: string; direction: "LONG" | "SHORT";
  entryPrice: number; currentPrice: number; volume: number;
  stopLoss: number; takeProfit: number; frozen: boolean;
}

interface EquityPoint { time: string; equity: number; }

interface Signal {
  id: string; symbol: string; action: "BUY" | "SELL" | "HOLD";
  confidence: number; time: string; rsi: number;
  result?: "WIN" | "LOSS" | "OPEN";
}

// ─── Constants ────────────────────────────────────────────────────────────────

type Tab = "dashboard" | "signals" | "calculator" | "settings";

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD"] as const;

const PIP: Record<string, number> = {
  "EUR/USD": 10000, "GBP/USD": 10000, "USD/JPY": 100,
  "AUD/USD": 10000, "USD/CAD": 10000,
};

const INIT_POS: Position[] = [
  { id:"1", symbol:"EUR/USD", direction:"LONG",  entryPrice:1.08500, currentPrice:1.08920, volume:0.1, stopLoss:1.0820, takeProfit:1.0950, frozen:false },
  { id:"2", symbol:"GBP/USD", direction:"LONG",  entryPrice:1.26700, currentPrice:1.27150, volume:0.1, stopLoss:1.2640, takeProfit:1.2770, frozen:true  },
  { id:"3", symbol:"USD/JPY", direction:"SHORT", entryPrice:157.200, currentPrice:157.850, volume:0.05,stopLoss:158.00, takeProfit:156.00, frozen:false },
  { id:"4", symbol:"AUD/USD", direction:"LONG",  entryPrice:0.66200, currentPrice:0.66450, volume:0.1, stopLoss:0.6590, takeProfit:0.6680, frozen:false },
  { id:"5", symbol:"USD/CAD", direction:"SHORT", entryPrice:1.37400, currentPrice:1.37150, volume:0.1, stopLoss:1.3770, takeProfit:1.3680, frozen:false },
];

const INIT_EQ: EquityPoint[] = [
  {time:"Mon",equity:9800},{time:"Tue",equity:10050},{time:"Wed",equity:9920},
  {time:"Thu",equity:10280},{time:"Fri",equity:10150},{time:"Sat",equity:10420},{time:"Now",equity:10520},
];

const JOURNAL_KEY = "fpro_journal_v2";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pnl(p: Position) {
  const m = PIP[p.symbol] ?? 10000;
  return (p.direction === "LONG" ? p.currentPrice - p.entryPrice : p.entryPrice - p.currentPrice) * m * p.volume * 10;
}

function session() {
  const h = parseInt(new Date().toLocaleString("en-GB", { timeZone:"Africa/Lusaka", hour:"numeric", hour12:false }), 10);
  if (h >= 15 && h < 19) return { label:"London/NY", quality:3, color:"#00D4AA" };
  if (h >= 10 && h < 15) return { label:"London",    quality:2, color:"#F0B429" };
  if (h >= 3  && h < 10) return { label:"Tokyo",     quality:1, color:"#6B7A99" };
  return                         { label:"Off-hours", quality:0, color:"#3D4A63" };
}

function clock() {
  return new Date().toLocaleTimeString("en-GB", { timeZone:"Africa/Lusaka", hour:"2-digit", minute:"2-digit", second:"2-digit" });
}

function lots(bal: number, risk: number, slPips: number) {
  if (slPips <= 0) return 0;
  return Math.min(Math.round((bal * risk / 100) / (slPips * 10) * 1000) / 1000, 0.1);
}

function loadJournal(): Signal[] {
  try { const r = window.localStorage.getItem(JOURNAL_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
}

function saveJournal(data: Signal[]) {
  try { window.localStorage.setItem(JOURNAL_KEY, JSON.stringify(data)); } catch {}
}

// ─── Mini Components ──────────────────────────────────────────────────────────

function Pulse({ on }: { on: boolean }) {
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {on && <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background:"#00D4AA" }} />}
      <span className="relative rounded-full h-3 w-3" style={{ background: on ? "#00D4AA" : "#3D4A63" }} />
    </span>
  );
}

function Card({ label, value, sub, color, Icon }: { label:string; value:string; sub?:string; color?:string; Icon?:React.ElementType }) {
  return (
    <div className="rounded-xl p-4" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color:"#4A5A7A" }}>{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color:"#4A5A7A" }} />}
      </div>
      <div className="font-mono text-xl font-bold" style={{ color: color || "#E8EDF5" }}>{value}</div>
      {sub && <div className="text-[11px] mt-1" style={{ color:"#4A5A7A" }}>{sub}</div>}
    </div>
  );
}

function Badge({ action }: { action: "BUY"|"SELL"|"HOLD" }) {
  const c = {
    BUY:  { bg:"rgba(0,212,170,0.12)",  color:"#00D4AA", txt:"▲ BUY"  },
    SELL: { bg:"rgba(255,69,96,0.12)",   color:"#FF4560", txt:"▼ SELL" },
    HOLD: { bg:"rgba(107,122,153,0.12)", color:"#6B7A99", txt:"— HOLD" },
  }[action];
  return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold" style={{ background:c.bg, color:c.color }}>{c.txt}</span>;
}

function Bar({ v }: { v: number }) {
  const col = v >= 80 ? "#00D4AA" : v >= 65 ? "#F0B429" : "#FF4560";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full" style={{ background:"#1A2A45" }}>
        <div className="h-1 rounded-full" style={{ width:`${v}%`, background:col }} />
      </div>
      <span className="text-[11px] font-mono w-8 text-right" style={{ color:col }}>{v}%</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab]         = useState<Tab>("dashboard");
  const [nav, setNav]         = useState(true);
  const [mobile, setMobile]   = useState(false);
  const [bot, setBot]         = useState(false);
  const [sigCnt, setSigCnt]   = useState(0);
  const [busy, setBusy]       = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [pair, setPair]       = useState("EURUSD");
  const [pos, setPos]         = useState<Position[]>(INIT_POS);
  const [eq, setEq]           = useState<EquityPoint[]>(INIT_EQ);
  const [sigs, setSigs]       = useState<Signal[]>([]);
  const [loaded, setLoaded]   = useState(false);
  const [clk, setClk]         = useState(clock());
  const [bal, setBal]         = useState(1000);
  const [risk, setRisk]       = useState(1);
  const [sl, setSl]           = useState(30);
  const [toast, setToast]     = useState<{ msg:string; ok:boolean } | null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sess    = session();
  const posP    = pos.map(p => ({ ...p, pnl: pnl(p) }));
  const totalPnL = posP.reduce((s, p) => s + p.pnl, 0);
  const wins    = sigs.filter(s => s.result === "WIN").length;
  const closed  = sigs.filter(s => s.result !== "OPEN" && s.result != null).length;
  const wr      = closed ? Math.round(wins / closed * 100) : 0;
  const openSigs = sigs.filter(s => !s.result || s.result === "OPEN").length;

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    if (tRef.current) clearTimeout(tRef.current);
    tRef.current = setTimeout(() => setToast(null), 3500);
  }

  // mobile check
  useEffect(() => {
    const mq = window.matchMedia("(max-width:767px)");
    const fn = () => setMobile(mq.matches);
    fn(); mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  // clock
  useEffect(() => {
    const id = setInterval(() => setClk(clock()), 1000);
    return () => clearInterval(id);
  }, []);

  // load journal
  useEffect(() => { setSigs(loadJournal()); setLoaded(true); }, []);

  // save journal
  useEffect(() => { if (loaded) saveJournal(sigs); }, [sigs, loaded]);

  // poll status
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/live-signals");
        if (!r.ok) return;
        const d = await r.json();
        setBot(d.running ?? false);
        setSigCnt(d.signalCount ?? 0);
        if (Array.isArray(d.recentSignals) && d.recentSignals.length > 0) {
          setSigs(prev => {
            const ids = new Set(prev.map(s => s.id));
            const fresh = d.recentSignals
              .filter((s: Signal) => !ids.has(s.id))
              .map((s: Signal) => ({ ...s, result: "OPEN" as const }));
            if (!fresh.length) return prev;
            return [...fresh, ...prev].slice(0, 50);
          });
        }
      } catch {}
    };
    check();
    const id = setInterval(check, 5000);
    return () => clearInterval(id);
  }, []);

  // sim prices when bot running
  useEffect(() => {
    if (!bot) return;
    const id = setInterval(() => {
      setPos(prev => prev.map(p => ({
        ...p,
        currentPrice: Number((p.currentPrice + (Math.random() - 0.5) * 0.0004).toFixed(p.symbol === "USD/JPY" ? 3 : 5)),
      })));
      setEq(prev => {
        const last = prev[prev.length - 1];
        const next = { time: clk.slice(0, 5), equity: Math.round(last.equity + (Math.random() - 0.47) * 60) };
        const u = [...prev, next];
        return u.length > 24 ? u.slice(-24) : u;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [bot, clk]);

  // ── Bot toggle ──────────────────────────────────────────────────────────────
  const toggleBot = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/live-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: bot ? "stop" : "start", balance: bal, risk }),
      });
      const text = await res.text();
      let d: { success?: boolean; message?: string };
      try { d = JSON.parse(text); } catch { notify("Server error: " + text.slice(0, 80), false); return; }
      if (d.success) {
        setBot(!bot);
        notify(bot ? "Bot stopped" : "Bot started — check Telegram!");
      } else {
        notify(d.message || "Action failed", false);
      }
    } catch (err) {
      notify("Could not reach server: " + String(err).slice(0, 60), false);
    } finally {
      setBusy(false);
    }
  }, [bot, busy, bal, risk]);

  // ── Test alert ──────────────────────────────────────────────────────────────
  const sendTest = useCallback(async () => {
    try {
      const res = await fetch("/api/live-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const text = await res.text();
      let d: { success?: boolean; message?: string; signal?: Signal };
      try { d = JSON.parse(text); } catch { notify("Server error", false); return; }
      notify(d.success ? "Test signal sent to Telegram ✓" : d.message || "Failed", d.success);
      if (d.success && d.signal) {
        setSigs(prev => [{
          id: Date.now().toString(),
          symbol: d.signal!.symbol,
          action: d.signal!.action,
          confidence: d.signal!.confidence,
          rsi: d.signal!.rsi,
          time: clk.slice(0, 5),
          result: "OPEN",
        }, ...prev].slice(0, 50));
        setSigCnt(c => c + 1);
      }
    } catch (err) {
      notify("Could not reach server: " + String(err).slice(0, 60), false);
    }
  }, [clk]);

  const markResult = (id: string, result: "WIN" | "LOSS") =>
    setSigs(prev => prev.map(s => s.id === id ? { ...s, result } : s));

  const NAV: [Tab, string, React.ElementType][] = [
    ["dashboard",  "Dashboard",  BarChart2],
    ["signals",    "Signals",    Radio],
    ["calculator", "Calculator", Percent],
    ["settings",   "Settings",   Settings],
  ];

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex" style={{ background:"#050C1A", color:"#E8EDF5", fontFamily:"Inter,system-ui,sans-serif" }}>

      {/* scanline */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)", mixBlendMode:"overlay" }} />

      {/* sidebar desktop */}
      {!mobile && (
        <aside className="fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200"
          style={{ width:nav?220:60, background:"#050C1A", borderRight:"1px solid #1A2A45" }}>
          <div className="flex items-center gap-3 px-4 h-16 shrink-0" style={{ borderBottom:"1px solid #1A2A45" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background:"linear-gradient(135deg,#00D4AA,#0099FF)" }}>
              <Zap className="w-4 h-4 text-white" />
            </div>
            {nav && <div><div className="text-sm font-bold">ForexPulse</div><div className="text-[10px] tracking-widest uppercase" style={{ color:"#00D4AA" }}>PRO</div></div>}
            <button onClick={() => setNav(!nav)} className="ml-auto p-1 rounded hover:bg-white/5" style={{ color:"#4A5A7A" }}>
              <ChevronLeft className={`w-4 h-4 transition-transform ${nav ? "" : "rotate-180"}`} />
            </button>
          </div>
          <nav className="flex-1 py-4 px-2 space-y-1">
            {NAV.map(([id, label, Icon]) => (
              <button key={id} onClick={() => setTab(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{ background:tab===id?"rgba(0,212,170,0.08)":"transparent", color:tab===id?"#00D4AA":"#4A5A7A", borderLeft:tab===id?"2px solid #00D4AA":"2px solid transparent" }}>
                <Icon className="w-4 h-4 shrink-0" />
                {nav && <span className="font-medium">{label}</span>}
                {nav && id === "signals" && openSigs > 0 && (
                  <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{ background:"rgba(240,180,41,0.15)", color:"#F0B429" }}>{openSigs}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="px-3 pb-4">
            <div className="rounded-lg p-3" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
              <div className="flex items-center gap-2">
                <Pulse on={bot} />
                {nav && <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium" style={{ color:bot?"#00D4AA":"#4A5A7A" }}>{bot ? "Sending signals" : "Standby"}</div>
                  {bot && <div className="text-[10px] font-mono truncate" style={{ color:"#4A5A7A" }}>{sigCnt} sent · {clk}</div>}
                </div>}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* main */}
      <main className="flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-200"
        style={{ marginLeft: mobile ? 0 : nav ? 220 : 60 }}>

        {/* header */}
        <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 gap-2"
          style={{ background:"rgba(5,12,26,0.95)", borderBottom:"1px solid #1A2A45", backdropFilter:"blur(12px)" }}>
          <div className="flex items-center gap-3">
            {mobile && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ background:"linear-gradient(135deg,#00D4AA,#0099FF)" }}>
                  <Zap className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-bold">ForexPulse <span style={{ color:"#00D4AA" }}>PRO</span></span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background:sess.color }} />
              <span className="text-xs font-mono" style={{ color:sess.color }}>{sess.label}</span>
              <span className="text-xs font-mono" style={{ color:"#4A5A7A" }}>{clk} CAT</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowChart(s => !s)}
              className="h-8 px-2.5 rounded text-xs font-medium"
              style={{ background:showChart?"rgba(99,102,241,0.1)":"transparent", color:showChart?"#818CF8":"#4A5A7A", border:`1px solid ${showChart?"rgba(99,102,241,0.3)":"#1A2A45"}` }}>
              Chart
            </button>
            <button onClick={sendTest}
              className="h-8 px-3 rounded text-xs font-medium flex items-center gap-1.5"
              style={{ background:"rgba(0,153,255,0.08)", color:"#0099FF", border:"1px solid rgba(0,153,255,0.2)" }}>
              <MessageCircle className="w-3.5 h-3.5" /><span className="hidden sm:inline">Test</span>
            </button>
            <button onClick={toggleBot} disabled={busy}
              className="h-8 px-3 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-all"
              style={{ background:bot?"rgba(255,69,96,0.1)":"rgba(0,212,170,0.1)", color:bot?"#FF4560":"#00D4AA", border:`1px solid ${bot?"rgba(255,69,96,0.3)":"rgba(0,212,170,0.3)"}` }}>
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : bot ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {bot ? "Stop" : "Start"}
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 space-y-5" style={{ paddingBottom: mobile ? 88 : 24 }}>

          {/* ══ DASHBOARD ══ */}
          {tab === "dashboard" && <>
            {/* session bar */}
            <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" style={{ color:sess.color }} />
                <span className="text-sm font-semibold" style={{ color:sess.color }}>{sess.label} Session</span>
                <div className="flex gap-1">{[1,2,3].map(i => <div key={i} className="w-4 h-1.5 rounded-full" style={{ background:i<=sess.quality?sess.color:"#1A2A45" }} />)}</div>
              </div>
              <span className="text-xs font-mono hidden sm:block" style={{ color:"#4A5A7A" }}>
                {["Market closed","Low liquidity","Good liquidity","Highest liquidity"][sess.quality]}
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card label="Total P&L" Icon={TrendingUp} value={`${totalPnL>=0?"+":""}$${totalPnL.toFixed(0)}`} color={totalPnL>=0?"#00D4AA":"#FF4560"} sub="open positions" />
              <Card label="Win Rate" Icon={Target} value={closed>0?`${wr}%`:"—"} color="#F0B429" sub={closed>0?`${wins}/${closed} closed`:"no closed trades"} />
              <Card label="Positions" Icon={Activity} value={String(pos.length)} sub={pos.filter(p=>p.frozen).length>0?`${pos.filter(p=>p.frozen).length} frozen`:"all active"} />
              <Card label="Signals" Icon={Radio} value={String(sigCnt)} color={bot?"#00D4AA":"#4A5A7A"} sub={bot?"bot active":"stopped"} />
              <Card label="Account" Icon={Shield} value={`$${bal.toLocaleString()}`} color="#0099FF" sub={`${risk}% risk/trade`} />
            </div>

            {/* chart */}
            {showChart && (
              <div className="rounded-xl overflow-hidden" style={{ border:"1px solid #1A2A45" }}>
                <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto" style={{ background:"#0A1628", borderBottom:"1px solid #1A2A45" }}>
                  {PAIRS.map(p => (
                    <button key={p} onClick={() => setPair(p)}
                      className="px-3 py-1 rounded text-xs font-mono shrink-0"
                      style={{ background:pair===p?"rgba(0,212,170,0.1)":"transparent", color:pair===p?"#00D4AA":"#4A5A7A", border:`1px solid ${pair===p?"rgba(0,212,170,0.3)":"transparent"}` }}>
                      {p}
                    </button>
                  ))}
                </div>
                <TradingViewChart symbol={pair} interval="60" theme="dark" />
              </div>
            )}

            {/* equity curve */}
            <div className="rounded-xl p-4" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Equity Curve</span>
                <span className="text-xs font-mono" style={{ color:eq[eq.length-1].equity>=eq[0].equity?"#00D4AA":"#FF4560" }}>
                  {`${eq[eq.length-1].equity>=eq[0].equity?"+":""}$${(eq[eq.length-1].equity-eq[0].equity).toFixed(0)}`}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={eq}>
                  <defs>
                    <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1A2A45" strokeDasharray="4 4" />
                  <XAxis dataKey="time" stroke="#2A3A55" tick={{ fill:"#4A5A7A", fontSize:10, fontFamily:"monospace" }} />
                  <YAxis stroke="#2A3A55" tick={{ fill:"#4A5A7A", fontSize:10, fontFamily:"monospace" }} domain={["auto","auto"]} />
                  <Tooltip contentStyle={{ background:"#0A1628", border:"1px solid #1A2A45", borderRadius:8 }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Equity"]}
                    labelStyle={{ color:"#4A5A7A", fontFamily:"monospace", fontSize:10 }} />
                  <Area type="monotone" dataKey="equity" stroke="#00D4AA" strokeWidth={2} fill="url(#eg)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* positions table */}
            <div className="rounded-xl overflow-hidden" style={{ border:"1px solid #1A2A45" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ background:"#0A1628", borderBottom:"1px solid #1A2A45" }}>
                <span className="text-sm font-semibold">Open Positions</span>
                <span className="text-[11px] font-mono" style={{ color:bot?"#00D4AA":"#4A5A7A" }}>{bot?"● Live":"● Paused"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom:"1px solid #1A2A45" }}>
                      {["Symbol","Dir","Entry","Current","P&L","SL / TP","Status"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color:"#4A5A7A", background:"#070F1E" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posP.map((p, i) => (
                      <tr key={p.id} style={{ borderBottom:i<posP.length-1?"1px solid #0F1E35":"none" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#0A1628")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        className="transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color:"#E8EDF5" }}>{p.symbol}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold">
                            {p.direction === "LONG"
                              ? <><TrendingUp className="w-3 h-3" style={{ color:"#00D4AA" }} /><span style={{ color:"#00D4AA" }}>LONG</span></>
                              : <><TrendingDown className="w-3 h-3" style={{ color:"#FF4560" }} /><span style={{ color:"#FF4560" }}>SHORT</span></>}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color:"#6B7A99" }}>{p.entryPrice.toFixed(p.symbol==="USD/JPY"?3:5)}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color:"#E8EDF5" }}>{p.currentPrice.toFixed(p.symbol==="USD/JPY"?3:5)}</td>
                        <td className="px-4 py-3 font-mono text-sm font-bold" style={{ color:p.pnl>=0?"#00D4AA":"#FF4560" }}>{p.pnl>=0?"+":""}${p.pnl.toFixed(0)}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          <span style={{ color:"#FF4560" }}>{p.stopLoss.toFixed(4)}</span>
                          <span style={{ color:"#4A5A7A" }}> / </span>
                          <span style={{ color:"#00D4AA" }}>{p.takeProfit.toFixed(4)}</span>
                        </td>
                        <td className="px-4 py-3">
                          {p.frozen
                            ? <button onClick={() => setPos(prev => prev.map(x => x.id===p.id?{...x,frozen:false}:x))}
                                className="text-[11px] font-mono px-2 py-1 rounded"
                                style={{ background:"rgba(240,180,41,0.1)", color:"#F0B429", border:"1px solid rgba(240,180,41,0.2)" }}>
                                🔒 Frozen
                              </button>
                            : <span className="text-[11px] font-mono" style={{ color:"#00D4AA" }}>● Active</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* disclaimer */}
            <div className="rounded-xl px-4 py-3 flex gap-3" style={{ background:"rgba(240,180,41,0.04)", border:"1px solid rgba(240,180,41,0.12)" }}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color:"#F0B429" }} />
              <p className="text-xs leading-relaxed" style={{ color:"#6B7A99" }}>
                <span style={{ color:"#F0B429" }}>Demo mode.</span> Signals are generated from simulated data. Positions are not connected to a live broker. Do not risk real capital based on these signals alone.
              </p>
            </div>
          </>}

          {/* ══ SIGNALS ══ */}
          {tab === "signals" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold">Signal Journal</h2>
                <div className="text-xs font-mono flex items-center gap-2" style={{ color:"#4A5A7A" }}>
                  <span style={{ color:"#00D4AA" }}>{wins}W</span>
                  <span>/</span>
                  <span style={{ color:"#FF4560" }}>{closed-wins}L</span>
                  <span>· {closed>0?`${wr}% win rate`:"no closed trades"}</span>
                </div>
              </div>

              {sigs.length === 0
                ? <div className="rounded-xl p-10 text-center" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
                    <Radio className="w-8 h-8 mx-auto mb-3" style={{ color:"#4A5A7A" }} />
                    <p className="text-sm" style={{ color:"#6B7A99" }}>No signals yet.</p>
                    <p className="text-xs mt-1" style={{ color:"#4A5A7A" }}>Start the bot or press Test Alert — every signal logs here.</p>
                  </div>
                : <div className="rounded-xl overflow-hidden" style={{ border:"1px solid #1A2A45" }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom:"1px solid #1A2A45" }}>
                            {["Time","Symbol","Signal","Confidence","RSI","Result"].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold tracking-widest uppercase" style={{ color:"#4A5A7A", background:"#070F1E" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sigs.map((s, i) => (
                            <tr key={s.id} style={{ borderBottom:i<sigs.length-1?"1px solid #0F1E35":"none" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#0A1628")}
                              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              className="transition-colors">
                              <td className="px-4 py-3 font-mono text-xs" style={{ color:"#4A5A7A" }}>{s.time}</td>
                              <td className="px-4 py-3 font-mono text-xs font-bold" style={{ color:"#E8EDF5" }}>{s.symbol}</td>
                              <td className="px-4 py-3"><Badge action={s.action} /></td>
                              <td className="px-4 py-3 w-32"><Bar v={s.confidence} /></td>
                              <td className="px-4 py-3 font-mono text-xs" style={{ color:s.rsi<35?"#00D4AA":s.rsi>65?"#FF4560":"#6B7A99" }}>{s.rsi.toFixed(1)}</td>
                              <td className="px-4 py-3">
                                {s.result==="WIN"  && <span className="text-xs font-mono font-bold" style={{ color:"#00D4AA" }}>● WIN</span>}
                                {s.result==="LOSS" && <span className="text-xs font-mono font-bold" style={{ color:"#FF4560" }}>● LOSS</span>}
                                {(!s.result || s.result==="OPEN") && (
                                  <div className="flex gap-1.5">
                                    <button onClick={() => markResult(s.id, "WIN")}
                                      className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded"
                                      style={{ background:"rgba(0,212,170,0.08)", color:"#00D4AA", border:"1px solid rgba(0,212,170,0.2)" }}>
                                      <Check className="w-3 h-3" /> Win
                                    </button>
                                    <button onClick={() => markResult(s.id, "LOSS")}
                                      className="flex items-center gap-1 text-[11px] font-mono px-2 py-1 rounded"
                                      style={{ background:"rgba(255,69,96,0.08)", color:"#FF4560", border:"1px solid rgba(255,69,96,0.2)" }}>
                                      <X className="w-3 h-3" /> Loss
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>}
            </div>
          )}

          {/* ══ CALCULATOR ══ */}
          {tab === "calculator" && (
            <div className="max-w-md space-y-5">
              <h2 className="text-lg font-bold">Position Size Calculator</h2>
              <div className="rounded-xl p-5 space-y-4" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
                {([
                  ["Account balance (USD)", bal, setBal, 100, 100, undefined],
                  ["Risk per trade (%)", risk, setRisk, 0.5, 0.1, 10],
                  ["Stop loss (pips)", sl, setSl, 5, 1, undefined],
                ] as [string, number, React.Dispatch<React.SetStateAction<number>>, number, number, number|undefined][]).map(([label, val, set, step, min, max]) => (
                  <label key={label as string} className="block">
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-1.5" style={{ color:"#4A5A7A" }}>{label as string}</span>
                    <input type="number" value={val as number} step={step as number} min={min as number} max={max as number}
                      onChange={e => (set as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))}
                      className="w-full rounded-lg px-4 py-2.5 font-mono text-sm outline-none"
                      style={{ background:"#070F1E", border:"1px solid #1A2A45", color:"#E8EDF5" }}
                      onFocus={e => e.target.style.borderColor = "#00D4AA"}
                      onBlur={e  => e.target.style.borderColor = "#1A2A45"} />
                  </label>
                ))}
                <div className="rounded-xl p-5" style={{ background:"#070F1E", border:"1px solid rgba(0,212,170,0.2)" }}>
                  <div className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{ color:"#4A5A7A" }}>Result</div>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="font-mono text-5xl font-bold" style={{ color:"#00D4AA" }}>{lots(bal, risk, sl).toFixed(3)}</span>
                    <span className="mb-2 font-mono text-sm" style={{ color:"#4A5A7A" }}>lots</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    {[
                      ["Risk amount",  `$${(bal*risk/100).toFixed(2)}`,           "#E8EDF5"],
                      ["Max drawdown", `-$${(bal*risk/100).toFixed(2)}`,          "#FF4560"],
                      ["Pip value",    `$${(lots(bal,risk,sl)*10).toFixed(2)}/pip`, "#E8EDF5"],
                      ["1:2 TP",       `+$${(bal*risk/100*2).toFixed(2)}`,        "#00D4AA"],
                    ].map(([l, v, c]) => (
                      <div key={l as string}>
                        <div style={{ color:"#4A5A7A" }}>{l as string}</div>
                        <div style={{ color:c as string }}>{v as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══ SETTINGS ══ */}
          {tab === "settings" && (
            <div className="max-w-lg space-y-5">
              <h2 className="text-lg font-bold">Configuration</h2>
              <div className="rounded-xl p-5" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
                {([
                  ["Telegram bot",     "Connected",                           "#00D4AA"],
                  ["Signal interval",  "Every 60 seconds",                    "#6B7A99"],
                  ["Engine",           "RSI + MACD + MA signals",             "#6B7A99"],
                  ["Bot status",       bot?`Running — ${sigCnt} sent`:"Standby", bot?"#00D4AA":"#F0B429"],
                ] as [string,string,string][]).map(([l,v,c],i,a) => (
                  <div key={l} className="flex justify-between py-3.5 text-sm gap-3"
                    style={{ borderBottom:i<a.length-1?"1px solid #0F1E35":"none" }}>
                    <span style={{ color:"#4A5A7A" }}>{l}</span>
                    <span className="font-mono text-xs text-right" style={{ color:c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-5" style={{ background:"#0A1628", border:"1px solid #1A2A45" }}>
                <div className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{ color:"#4A5A7A" }}>How to use</div>
                <ol className="space-y-3">
                  {[
                    ["Start Signals",  "Press Start in the header to begin"],
                    ["Telegram",       "A signal arrives every 60 seconds with Entry, SL, TP, lot size"],
                    ["Execute",        "Open Exness app and place the trade manually"],
                    ["Journal",        "Go to Signals tab and mark each trade Win or Loss"],
                    ["Risk rule",      "Never risk more than 1–2% per trade"],
                  ].map(([t,d],i) => (
                    <li key={t} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background:"rgba(0,212,170,0.1)", color:"#00D4AA" }}>{i+1}</span>
                      <div>
                        <span className="font-semibold text-xs" style={{ color:"#E8EDF5" }}>{t} — </span>
                        <span className="text-xs" style={{ color:"#6B7A99" }}>{d}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-xl p-4 flex gap-3" style={{ background:"rgba(255,69,96,0.04)", border:"1px solid rgba(255,69,96,0.15)" }}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color:"#FF4560" }} />
                <p className="text-xs leading-relaxed" style={{ color:"#6B7A99" }}>
                  <span style={{ color:"#FF4560" }}>Risk warning.</span> Forex trading involves significant risk. Only trade money you can afford to lose.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* bottom nav — mobile */}
      {mobile && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-16"
          style={{ background:"#050C1A", borderTop:"1px solid #1A2A45" }}>
          {NAV.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className="flex flex-col items-center justify-center gap-1 flex-1 h-full relative">
              <Icon className="w-5 h-5" style={{ color:tab===id?"#00D4AA":"#4A5A7A" }} />
              <span className="text-[10px] font-medium" style={{ color:tab===id?"#00D4AA":"#4A5A7A" }}>{label}</span>
              {id === "signals" && openSigs > 0 && (
                <span className="absolute top-1.5 right-1/4 w-4 h-4 rounded-full text-[9px] font-mono flex items-center justify-center"
                  style={{ background:"#F0B429", color:"#050C1A" }}>{openSigs}</span>
              )}
            </button>
          ))}
        </nav>
      )}

      {/* toast */}
      {toast && (
        <div className="fixed z-50 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-2xl"
          style={{ bottom: mobile ? 80 : 24, right: 16, background:"#0A1628",
            border:`1px solid ${toast.ok?"rgba(0,212,170,0.3)":"rgba(255,69,96,0.3)"}`,
            color: toast.ok ? "#00D4AA" : "#FF4560", maxWidth: "90vw" }}>
          {toast.ok ? "✓" : "✗"} {toast.msg}
        </div>
      )}
    </div>
  );
}
