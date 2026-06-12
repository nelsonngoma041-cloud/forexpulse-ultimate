"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Activity, Settings, Play, Pause, MessageCircle,
  TrendingUp, TrendingDown, ChevronLeft,
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
  id: string; symbol: string; direction: "LONG" | "SHORT";
  entryPrice: number; currentPrice: number; volume: number;
  stopLoss: number; takeProfit: number; frozen: boolean; openTime: string;
}
interface EquityPoint { time: string; equity: number; }
interface SignalHistory {
  id: string; symbol: string; action: "BUY" | "SELL" | "HOLD";
  confidence: number; time: string; rsi: number; result?: "WIN" | "LOSS" | "OPEN";
}

// ─── Seed data ─────────────────────────────────────────────────────────────────

const PAIRS = ["EURUSD","GBPUSD","USDJPY","AUDUSD","USDCAD"] as const;

const PIP_MULT: Record<string,number> = {
  "EUR/USD":10000,"GBP/USD":10000,"USD/JPY":100,"AUD/USD":10000,"USD/CAD":10000
};

const INIT_POS: Position[] = [
  {id:"1",symbol:"EUR/USD",direction:"LONG", entryPrice:1.08500,currentPrice:1.08920,volume:0.1,stopLoss:1.0820,takeProfit:1.0950,frozen:false,openTime:"09:14"},
  {id:"2",symbol:"GBP/USD",direction:"LONG", entryPrice:1.26700,currentPrice:1.27150,volume:0.1,stopLoss:1.2640,takeProfit:1.2770,frozen:true, openTime:"10:02"},
  {id:"3",symbol:"USD/JPY",direction:"SHORT",entryPrice:157.200,currentPrice:157.850,volume:0.05,stopLoss:158.00,takeProfit:156.00,frozen:false,openTime:"10:45"},
  {id:"4",symbol:"AUD/USD",direction:"LONG", entryPrice:0.66200,currentPrice:0.66450,volume:0.1,stopLoss:0.6590,takeProfit:0.6680,frozen:false,openTime:"11:30"},
  {id:"5",symbol:"USD/CAD",direction:"SHORT",entryPrice:1.37400,currentPrice:1.37150,volume:0.1,stopLoss:1.3770,takeProfit:1.3680,frozen:false,openTime:"12:15"},
];

const INIT_EQUITY: EquityPoint[] = [
  {time:"Mon",equity:9800},{time:"Tue",equity:10050},{time:"Wed",equity:9920},
  {time:"Thu",equity:10280},{time:"Fri",equity:10150},{time:"Sat",equity:10420},{time:"Now",equity:10520},
];

const INIT_SIGNALS: SignalHistory[] = [
  {id:"s1",symbol:"EUR/USD",action:"BUY", confidence:82,time:"12:01",rsi:34.2,result:"WIN"},
  {id:"s2",symbol:"GBP/USD",action:"SELL",confidence:71,time:"11:02",rsi:67.8,result:"LOSS"},
  {id:"s3",symbol:"USD/JPY",action:"BUY", confidence:88,time:"10:14",rsi:29.1,result:"WIN"},
  {id:"s4",symbol:"AUD/USD",action:"SELL",confidence:74,time:"09:33",rsi:71.4,result:"WIN"},
  {id:"s5",symbol:"EUR/USD",action:"BUY", confidence:79,time:"08:50",rsi:38.6,result:"OPEN"},
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcPnL(p: Position) {
  const m = PIP_MULT[p.symbol] ?? 10000;
  return (p.direction==="LONG" ? p.currentPrice-p.entryPrice : p.entryPrice-p.currentPrice)*m*p.volume*10;
}

function getSession() {
  const h = parseInt(new Date().toLocaleString("en-GB",{timeZone:"Africa/Lusaka",hour:"numeric",hour12:false}),10);
  if(h>=15&&h<19) return {label:"London / NY",quality:3,color:"#00D4AA"};
  if(h>=10&&h<15) return {label:"London",     quality:2,color:"#F0B429"};
  if(h>=3 &&h<10) return {label:"Tokyo",      quality:1,color:"#6B7A99"};
  return               {label:"Off-hours",   quality:0,color:"#3D4A63"};
}

function zt() {
  return new Date().toLocaleTimeString("en-GB",{timeZone:"Africa/Lusaka",hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

function lotSize(bal:number,risk:number,sl:number) {
  if(sl<=0) return 0;
  return Math.min(Math.round((bal*risk/100)/(sl*10)*1000)/1000,0.1);
}

// ─── Micro components ─────────────────────────────────────────────────────────

function PulseRing({active}:{active:boolean}) {
  return (
    <span className="relative flex h-3 w-3 shrink-0">
      {active&&<span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{background:"#00D4AA"}}/>}
      <span className="relative rounded-full h-3 w-3" style={{background:active?"#00D4AA":"#3D4A63"}}/>
    </span>
  );
}

function KPI({label,value,sub,color,Icon}:{label:string;value:string;sub?:string;color?:string;Icon?:React.ElementType}) {
  return (
    <div className="rounded-xl p-5" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold tracking-widest uppercase" style={{color:"#4A5A7A"}}>{label}</span>
        {Icon&&<Icon className="w-3.5 h-3.5" style={{color:"#4A5A7A"}}/>}
      </div>
      <div className="font-mono text-2xl font-bold" style={{color:color||"#E8EDF5"}}>{value}</div>
      {sub&&<div className="text-[11px] mt-1" style={{color:"#4A5A7A"}}>{sub}</div>}
    </div>
  );
}

function SigBadge({action}:{action:"BUY"|"SELL"|"HOLD"}) {
  const c={
    BUY: {bg:"rgba(0,212,170,0.12)", color:"#00D4AA",txt:"▲ BUY"},
    SELL:{bg:"rgba(255,69,96,0.12)",  color:"#FF4560",txt:"▼ SELL"},
    HOLD:{bg:"rgba(107,122,153,0.12)",color:"#6B7A99",txt:"— HOLD"},
  }[action];
  return <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold" style={{background:c.bg,color:c.color}}>{c.txt}</span>;
}

function ConfBar({v}:{v:number}) {
  const col=v>=80?"#00D4AA":v>=65?"#F0B429":"#FF4560";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 rounded-full" style={{background:"#1A2A45"}}>
        <div className="h-1 rounded-full" style={{width:`${v}%`,background:col}}/>
      </div>
      <span className="text-[11px] font-mono w-8 text-right" style={{color:col}}>{v}%</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab = "dashboard"|"signals"|"calculator"|"settings";

export default function Home() {
  const [tab,setTab]           = useState<Tab>("dashboard");
  const [nav,setNav]           = useState(true);
  const [bot,setBot]           = useState(false);
  const [sigCnt,setSigCnt]     = useState(0);
  const [mt5,setMt5]           = useState(false);
  const [busy,setBusy]         = useState(false);
  const [chart,setChart]       = useState(true);
  const [pair,setPair]         = useState("EURUSD");
  const [pos,setPos]           = useState<Position[]>(INIT_POS);
  const [eq,setEq]             = useState<EquityPoint[]>(INIT_EQUITY);
  const [sigs,setSigs]         = useState<SignalHistory[]>(INIT_SIGNALS);
  const [clk,setClk]           = useState(zt());
  const [bal,setBal]           = useState(1000);
  const [risk,setRisk]         = useState(1);
  const [sl,setSl]             = useState(30);
  const [toast,setToast]       = useState<{msg:string;ok:boolean}|null>(null);
  const tRef = useRef<ReturnType<typeof setTimeout>|null>(null);

  const session = getSession();
  const posP    = pos.map(p=>({...p,pnl:calcPnL(p)}));
  const totalPnL= posP.reduce((s,p)=>s+p.pnl,0);
  const wins    = sigs.filter(s=>s.result==="WIN").length;
  const closed  = sigs.filter(s=>s.result!=="OPEN").length;
  const wr      = closed?Math.round(wins/closed*100):0;

  function notify(msg:string,ok=true){
    setToast({msg,ok});
    if(tRef.current)clearTimeout(tRef.current);
    tRef.current=setTimeout(()=>setToast(null),3500);
  }

  // clock
  useEffect(()=>{const id=setInterval(()=>setClk(zt()),1000);return()=>clearInterval(id);},[]);

  // poll status
  useEffect(()=>{
    const check=async()=>{
      try{
        const r=await fetch("/api/live-signals");
        if(!r.ok)return;
        const d=await r.json();
        setBot(d.running??false);setSigCnt(d.signalCount??0);setMt5(d.mt5Connected??false);
      }catch{}
    };
    check();
    const id=setInterval(check,5000);
    return()=>clearInterval(id);
  },[]);

  // sim prices
  useEffect(()=>{
    if(!bot)return;
    const id=setInterval(()=>{
      setPos(prev=>prev.map(p=>({...p,currentPrice:Number((p.currentPrice+(Math.random()-0.5)*0.0004).toFixed(p.symbol==="USD/JPY"?3:5))})));
      setEq(prev=>{
        const last=prev[prev.length-1];
        const n={time:clk.slice(0,5),equity:Math.round(last.equity+(Math.random()-0.47)*60)};
        const u=[...prev,n];
        return u.length>24?u.slice(-24):u;
      });
    },5000);
    return()=>clearInterval(id);
  },[bot,clk]);

  const toggleBot=useCallback(async()=>{
    if(busy)return;setBusy(true);
    try{
      const r=await fetch("/api/live-signals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:bot?"stop":"start",balance:bal,risk})});
      const d=await r.json();
      if(d.success){setBot(!bot);notify(bot?"Bot stopped":"Bot started — signals every 60s");}
      else notify(d.message||"Failed",false);
    }catch{notify("Could not reach server",false);}
    finally{setBusy(false);}
  },[bot,busy,bal,risk]);

  const sendTest=useCallback(async()=>{
    try{
      const r=await fetch("/api/live-signals",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"test"})});
      const d=await r.json();
      notify(d.success?"Test signal sent ✓":d.message||"Failed",d.success);
      if(d.success){
        setSigs(prev=>[{id:Date.now().toString(),symbol:d.signal?.symbol||"EUR/USD",action:d.signal?.action||"BUY",confidence:d.signal?.confidence||75,time:clk.slice(0,5),rsi:d.signal?.rsi||50,result:"OPEN"},...prev.slice(0,9)]);
        setSigCnt(c=>c+1);
      }
    }catch{notify("Could not reach server",false);}
  },[clk]);

  const NAVITEMS:[Tab,string,React.ElementType][]=[
    ["dashboard","Dashboard",BarChart2],
    ["signals","Signals",Radio],
    ["calculator","Calculator",Percent],
    ["settings","Settings",Settings],
  ];

  // ─── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex" style={{background:"#050C1A",color:"#E8EDF5",fontFamily:"Inter,system-ui,sans-serif"}}>

      {/* scanline */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.025) 2px,rgba(0,0,0,0.025) 4px)",mixBlendMode:"overlay"}}/>

      {/* sidebar */}
      <aside className="fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-200"
        style={{width:nav?220:60,background:"#050C1A",borderRight:"1px solid #1A2A45"}}>

        {/* logo */}
        <div className="flex items-center gap-3 px-4 h-16 shrink-0" style={{borderBottom:"1px solid #1A2A45"}}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{background:"linear-gradient(135deg,#00D4AA,#0099FF)"}}>
            <Zap className="w-4 h-4 text-white"/>
          </div>
          {nav&&<div><div className="text-sm font-bold">ForexPulse</div><div className="text-[10px] tracking-widest uppercase" style={{color:"#00D4AA"}}>PRO</div></div>}
          <button onClick={()=>setNav(!nav)} className="ml-auto p-1 rounded hover:bg-white/5" style={{color:"#4A5A7A"}}>
            <ChevronLeft className={`w-4 h-4 transition-transform ${nav?"":"rotate-180"}`}/>
          </button>
        </div>

        {/* nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {NAVITEMS.map(([id,label,Icon])=>(
            <button key={id} onClick={()=>setTab(id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{background:tab===id?"rgba(0,212,170,0.08)":"transparent",color:tab===id?"#00D4AA":"#4A5A7A",borderLeft:tab===id?"2px solid #00D4AA":"2px solid transparent"}}>
              <Icon className="w-4 h-4 shrink-0"/>
              {nav&&<span className="font-medium">{label}</span>}
              {nav&&id==="signals"&&sigCnt>0&&(
                <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full" style={{background:"rgba(0,212,170,0.15)",color:"#00D4AA"}}>{sigCnt}</span>
              )}
            </button>
          ))}
        </nav>

        {/* bot pill */}
        <div className="px-3 pb-4">
          <div className="rounded-lg p-3" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
            <div className="flex items-center gap-2">
              <PulseRing active={bot}/>
              {nav&&<div className="flex-1 min-w-0">
                <div className="text-xs font-medium" style={{color:bot?"#00D4AA":"#4A5A7A"}}>{bot?"Sending signals":"Standby"}</div>
                {bot&&<div className="text-[10px] font-mono truncate" style={{color:"#4A5A7A"}}>{sigCnt} sent · {clk}</div>}
              </div>}
            </div>
          </div>
        </div>
      </aside>

      {/* main */}
      <main className="flex-1 flex flex-col min-h-screen relative z-10 transition-all duration-200"
        style={{marginLeft:nav?220:60}}>

        {/* header */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between px-6"
          style={{background:"rgba(5,12,26,0.95)",borderBottom:"1px solid #1A2A45",backdropFilter:"blur(12px)"}}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{background:session.color}}/>
              <span className="text-xs font-mono" style={{color:session.color}}>{session.label}</span>
            </div>
            <span className="text-xs font-mono hidden sm:block" style={{color:"#4A5A7A"}}>{clk} CAT</span>
            {mt5&&<span className="text-[11px] px-2 py-1 rounded font-mono" style={{background:"rgba(0,212,170,0.08)",color:"#00D4AA",border:"1px solid rgba(0,212,170,0.2)"}}>MT5 ●</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setChart(s=>!s)}
              className="h-8 px-3 rounded text-xs font-medium"
              style={{background:chart?"rgba(99,102,241,0.1)":"transparent",color:chart?"#818CF8":"#4A5A7A",border:`1px solid ${chart?"rgba(99,102,241,0.3)":"#1A2A45"}`}}>
              Chart
            </button>
            <button onClick={sendTest}
              className="h-8 px-3 rounded text-xs font-medium flex items-center gap-1.5"
              style={{background:"rgba(0,153,255,0.08)",color:"#0099FF",border:"1px solid rgba(0,153,255,0.2)"}}>
              <MessageCircle className="w-3.5 h-3.5"/>Test
            </button>
            <button onClick={toggleBot} disabled={busy}
              className="h-8 px-4 rounded text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
              style={{background:bot?"rgba(255,69,96,0.1)":"rgba(0,212,170,0.1)",color:bot?"#FF4560":"#00D4AA",border:`1px solid ${bot?"rgba(255,69,96,0.3)":"rgba(0,212,170,0.3)"}`}}>
              {busy?<RefreshCw className="w-3.5 h-3.5 animate-spin"/>:bot?<Pause className="w-3.5 h-3.5"/>:<Play className="w-3.5 h-3.5"/>}
              {bot?"Stop":"Start"}
            </button>
          </div>
        </header>

        <div className="flex-1 p-6 space-y-6">

          {/* DASHBOARD */}
          {tab==="dashboard"&&<>
            {/* session bar */}
            <div className="rounded-xl px-5 py-3 flex items-center justify-between" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4" style={{color:session.color}}/>
                <span className="text-sm font-semibold" style={{color:session.color}}>{session.label} Session</span>
                <div className="flex gap-1">{[1,2,3].map(i=><div key={i} className="w-5 h-1.5 rounded-full" style={{background:i<=session.quality?session.color:"#1A2A45"}}/>)}</div>
              </div>
              <span className="text-xs font-mono hidden sm:block" style={{color:"#4A5A7A"}}>
                {["Market closed","Low liquidity","Good liquidity","Highest liquidity"][session.quality]}
              </span>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KPI label="Total P&L" icon={TrendingUp} value={`${totalPnL>=0?"+":""}$${totalPnL.toFixed(0)}`} color={totalPnL>=0?"#00D4AA":"#FF4560"} sub="open positions"/>
              <KPI label="Win Rate" icon={Target} value={`${wr}%`} color="#F0B429" sub={`${wins}/${closed} closed`}/>
              <KPI label="Positions" icon={Activity} value={String(pos.length)} sub={pos.filter(p=>p.frozen).length>0?`${pos.filter(p=>p.frozen).length} frozen`:"all active"}/>
              <KPI label="Signals" icon={Radio} value={String(sigCnt)} color={bot?"#00D4AA":"#4A5A7A"} sub={bot?"bot active":"stopped"}/>
              <KPI label="Account" icon={Shield} value={`$${bal.toLocaleString()}`} color="#0099FF" sub={`${risk}% risk/trade`}/>
            </div>

            {/* chart */}
            {chart&&(
              <div className="rounded-xl overflow-hidden" style={{border:"1px solid #1A2A45"}}>
                <div className="flex items-center gap-2 px-4 py-3" style={{borderBottom:"1px solid #1A2A45",background:"#0A1628"}}>
                  {PAIRS.map(p=>(
                    <button key={p} onClick={()=>setPair(p)}
                      className="px-3 py-1 rounded text-xs font-mono"
                      style={{background:pair===p?"rgba(0,212,170,0.1)":"transparent",color:pair===p?"#00D4AA":"#4A5A7A",border:`1px solid ${pair===p?"rgba(0,212,170,0.3)":"transparent"}`}}>
                      {p}
                    </button>
                  ))}
                </div>
                <TradingViewChart symbol={pair} interval="60" theme="dark"/>
              </div>
            )}

            {/* equity */}
            <div className="rounded-xl p-5" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Equity Curve</span>
                <span className="text-xs font-mono" style={{color:eq[eq.length-1].equity>=eq[0].equity?"#00D4AA":"#FF4560"}}>
                  {eq.length>1?`${eq[eq.length-1].equity>=eq[0].equity?"+":""}$${(eq[eq.length-1].equity-eq[0].equity).toFixed(0)}`:""}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={eq}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#00D4AA" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#1A2A45" strokeDasharray="4 4"/>
                  <XAxis dataKey="time" stroke="#2A3A55" tick={{fill:"#4A5A7A",fontSize:11,fontFamily:"monospace"}}/>
                  <YAxis stroke="#2A3A55" tick={{fill:"#4A5A7A",fontSize:11,fontFamily:"monospace"}} domain={["auto","auto"]}/>
                  <Tooltip contentStyle={{background:"#0A1628",border:"1px solid #1A2A45",borderRadius:8}} formatter={(v:number)=>[`$${v.toLocaleString()}`,"Equity"]} labelStyle={{color:"#4A5A7A",fontFamily:"monospace",fontSize:11}}/>
                  <ReferenceLine y={10000} stroke="#1A2A45" strokeDasharray="4 4"/>
                  <Area type="monotone" dataKey="equity" stroke="#00D4AA" strokeWidth={2} fill="url(#g)"/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* positions */}
            <div className="rounded-xl overflow-hidden" style={{border:"1px solid #1A2A45"}}>
              <div className="flex items-center justify-between px-5 py-3.5" style={{background:"#0A1628",borderBottom:"1px solid #1A2A45"}}>
                <span className="text-sm font-semibold">Open Positions</span>
                <span className="text-[11px] font-mono" style={{color:bot?"#00D4AA":"#4A5A7A"}}>{bot?"● Live prices":"● Paused"}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{borderBottom:"1px solid #1A2A45"}}>
                      {["Symbol","Dir","Entry","Current","P&L","SL / TP","Status"].map(h=>(
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold tracking-widest uppercase" style={{color:"#4A5A7A",background:"#070F1E"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {posP.map((p,i)=>(
                      <tr key={p.id} style={{borderBottom:i<posP.length-1?"1px solid #0F1E35":"none"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#0A1628")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                        className="transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{color:"#E8EDF5"}}>{p.symbol}</td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold">
                            {p.direction==="LONG"
                              ?<><TrendingUp className="w-3 h-3" style={{color:"#00D4AA"}}/><span style={{color:"#00D4AA"}}>LONG</span></>
                              :<><TrendingDown className="w-3 h-3" style={{color:"#FF4560"}}/><span style={{color:"#FF4560"}}>SHORT</span></>}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{color:"#6B7A99"}}>{p.entryPrice.toFixed(p.symbol==="USD/JPY"?3:5)}</td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{color:"#E8EDF5"}}>{p.currentPrice.toFixed(p.symbol==="USD/JPY"?3:5)}</td>
                        <td className="px-5 py-3.5 font-mono text-sm font-bold" style={{color:p.pnl>=0?"#00D4AA":"#FF4560"}}>{p.pnl>=0?"+":""}${p.pnl.toFixed(0)}</td>
                        <td className="px-5 py-3.5 font-mono text-xs">
                          <span style={{color:"#FF4560"}}>{p.stopLoss.toFixed(4)}</span>
                          <span style={{color:"#4A5A7A"}}> / </span>
                          <span style={{color:"#00D4AA"}}>{p.takeProfit.toFixed(4)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.frozen
                            ?<button onClick={()=>setPos(prev=>prev.map(x=>x.id===p.id?{...x,frozen:false}:x))}
                                className="text-[11px] font-mono px-2 py-1 rounded"
                                style={{background:"rgba(240,180,41,0.1)",color:"#F0B429",border:"1px solid rgba(240,180,41,0.2)"}}>🔒 Frozen</button>
                            :<span className="text-[11px] font-mono" style={{color:"#00D4AA"}}>● Active</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* disclaimer */}
            <div className="rounded-xl px-5 py-4 flex gap-3" style={{background:"rgba(240,180,41,0.04)",border:"1px solid rgba(240,180,41,0.12)"}}>
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{color:"#F0B429"}}/>
              <p className="text-xs leading-relaxed" style={{color:"#6B7A99"}}>
                <span style={{color:"#F0B429"}}>Demo mode.</span> Signals use simulated price history. Positions are not connected to a live broker. Do not risk real capital based on these signals alone.
              </p>
            </div>
          </>}

          {/* SIGNALS */}
          {tab==="signals"&&(
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Signal History</h2>
                <div className="text-xs font-mono flex items-center gap-2" style={{color:"#4A5A7A"}}>
                  <span style={{color:"#00D4AA"}}>{wins}W</span><span>/</span>
                  <span style={{color:"#FF4560"}}>{closed-wins}L</span>
                  <span>· {wr}% win rate</span>
                </div>
              </div>
              <div className="rounded-xl overflow-hidden" style={{border:"1px solid #1A2A45"}}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{borderBottom:"1px solid #1A2A45"}}>
                      {["Time","Symbol","Signal","Confidence","RSI","Result"].map(h=>(
                        <th key={h} className="px-5 py-3 text-left text-[10px] font-semibold tracking-widest uppercase" style={{color:"#4A5A7A",background:"#070F1E"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sigs.map((s,i)=>(
                      <tr key={s.id} style={{borderBottom:i<sigs.length-1?"1px solid #0F1E35":"none"}}
                        onMouseEnter={e=>(e.currentTarget.style.background="#0A1628")}
                        onMouseLeave={e=>(e.currentTarget.style.background="transparent")}
                        className="transition-colors">
                        <td className="px-5 py-3.5 font-mono text-xs" style={{color:"#4A5A7A"}}>{s.time}</td>
                        <td className="px-5 py-3.5 font-mono text-xs font-bold" style={{color:"#E8EDF5"}}>{s.symbol}</td>
                        <td className="px-5 py-3.5"><SigBadge action={s.action}/></td>
                        <td className="px-5 py-3.5 w-36"><ConfBar v={s.confidence}/></td>
                        <td className="px-5 py-3.5 font-mono text-xs" style={{color:s.rsi<35?"#00D4AA":s.rsi>65?"#FF4560":"#6B7A99"}}>{s.rsi.toFixed(1)}</td>
                        <td className="px-5 py-3.5 font-mono text-xs font-bold">
                          {s.result==="WIN" &&<span style={{color:"#00D4AA"}}>● WIN</span>}
                          {s.result==="LOSS"&&<span style={{color:"#FF4560"}}>● LOSS</span>}
                          {s.result==="OPEN"&&<span style={{color:"#F0B429"}}>◌ OPEN</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CALCULATOR */}
          {tab==="calculator"&&(
            <div className="max-w-md space-y-5">
              <h2 className="text-lg font-bold">Position Size Calculator</h2>
              <div className="rounded-xl p-6 space-y-5" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
                {([["Account balance (USD)",bal,setBal,100,100,undefined],["Risk per trade (%)",risk,setRisk,0.5,0.1,10],["Stop loss (pips)",sl,setSl,5,1,undefined]] as [string,number,React.Dispatch<React.SetStateAction<number>>,number,number,number|undefined][]).map(([label,val,setVal,step,min,max])=>(
                  <label key={label as string} className="block">
                    <span className="text-[10px] font-semibold tracking-widest uppercase block mb-2" style={{color:"#4A5A7A"}}>{label as string}</span>
                    <input type="number" value={val as number} step={step as number} min={min as number} max={max as number}
                      onChange={e=>(setVal as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))}
                      className="w-full rounded-lg px-4 py-2.5 font-mono text-sm outline-none"
                      style={{background:"#070F1E",border:"1px solid #1A2A45",color:"#E8EDF5"}}
                      onFocus={e=>e.target.style.borderColor="#00D4AA"}
                      onBlur={e=>e.target.style.borderColor="#1A2A45"}
                    />
                  </label>
                ))}
                <div className="rounded-xl p-5" style={{background:"#070F1E",border:"1px solid rgba(0,212,170,0.2)"}}>
                  <div className="text-[10px] font-semibold tracking-widest uppercase mb-3" style={{color:"#4A5A7A"}}>Result</div>
                  <div className="flex items-end gap-2 mb-4">
                    <span className="font-mono text-5xl font-bold" style={{color:"#00D4AA"}}>{lotSize(bal,risk,sl).toFixed(3)}</span>
                    <span className="mb-2 font-mono text-sm" style={{color:"#4A5A7A"}}>lots</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    {[["Risk amount",`$${(bal*risk/100).toFixed(2)}`,"#E8EDF5"],["Max drawdown",`-$${(bal*risk/100).toFixed(2)}`,"#FF4560"],["Pip value",`$${(lotSize(bal,risk,sl)*10).toFixed(2)}/pip`,"#E8EDF5"],["1:2 TP",`+$${(bal*risk/100*2).toFixed(2)}`,"#00D4AA"]].map(([l,v,c])=>(
                      <div key={l as string}><div style={{color:"#4A5A7A"}}>{l as string}</div><div style={{color:c as string}}>{v as string}</div></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {tab==="settings"&&(
            <div className="max-w-lg space-y-5">
              <h2 className="text-lg font-bold">Configuration</h2>
              <div className="rounded-xl p-5" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
                {([["Telegram bot","Connected","#00D4AA"],["MT5 bridge",mt5?"Connected":"Not configured",mt5?"#00D4AA":"#F0B429"],["Signal interval","Every 60 seconds","#6B7A99"],["Engine","RSI + MACD + MA crossover","#6B7A99"],["Bot status",bot?`Running — ${sigCnt} sent`:"Standby",bot?"#00D4AA":"#F0B429"]] as [string,string,string][]).map(([l,v,c],i,a)=>(
                  <div key={l} className="flex justify-between py-3.5 text-sm" style={{borderBottom:i<a.length-1?"1px solid #0F1E35":"none"}}>
                    <span style={{color:"#4A5A7A"}}>{l}</span>
                    <span className="font-mono text-xs" style={{color:c}}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-5" style={{background:"#0A1628",border:"1px solid #1A2A45"}}>
                <div className="text-[10px] font-semibold tracking-widest uppercase mb-4" style={{color:"#4A5A7A"}}>How to use</div>
                <ol className="space-y-3">
                  {[["Start Signals","Press Start to begin receiving Telegram alerts every 60s"],["Read the signal","Each alert has Entry, SL, TP, lot size, and indicator readings"],["Execute on MT5","Open Exness app, enter the trade manually using the signal values"],["Best sessions","3 PM–7 PM Zambia time = London/NY overlap, highest liquidity"],["Risk rule","Never exceed 1–2% account risk per trade"]] .map(([t,d],i)=>(
                    <li key={t} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5" style={{background:"rgba(0,212,170,0.1)",color:"#00D4AA"}}>{i+1}</span>
                      <div><span className="font-semibold text-xs" style={{color:"#E8EDF5"}}>{t} — </span><span className="text-xs" style={{color:"#6B7A99"}}>{d}</span></div>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="rounded-xl p-5 flex gap-3" style={{background:"rgba(255,69,96,0.04)",border:"1px solid rgba(255,69,96,0.15)"}}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{color:"#FF4560"}}/>
                <p className="text-xs leading-relaxed" style={{color:"#6B7A99"}}>
                  <span style={{color:"#FF4560"}}>Risk warning.</span> Forex trading involves significant risk. Signals are generated from simulated data for educational purposes only. Only trade money you can afford to lose.
                </p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* toast */}
      {toast&&(
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-2xl"
          style={{background:"#0A1628",border:`1px solid ${toast.ok?"rgba(0,212,170,0.3)":"rgba(255,69,96,0.3)"}`,color:toast.ok?"#00D4AA":"#FF4560"}}>
          {toast.ok?"✓":"✗"} {toast.msg}
        </div>
      )}
    </div>
  );
}
