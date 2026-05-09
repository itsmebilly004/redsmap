import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { TopShell } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { send, contractTypeFor, type TradeCategory } from "@/lib/deriv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Play,
  Square,
  RotateCcw,
  Download,
  Save,
  Activity,
  Target,
  ShieldAlert,
  Wallet,
  Settings2,
  Layers,
  ChevronRight,
  Info,
  History,
  Timer,
  Fingerprint,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_PRESETS } from "./trading-bots";

export const Route = createFileRoute("/bot-builder")({
  validateSearch: z.object({ preset: z.string().optional() }),
  component: BotBuilder,
});

const MARKETS = {
  "R_10": "Volatility 10 Index",
  "R_25": "Volatility 25 Index",
  "R_50": "Volatility 50 Index",
  "R_75": "Volatility 75 Index",
  "R_100": "Volatility 100 Index",
  "1HZ10V": "Volatility 10 (1s) Index",
  "1HZ100V": "Volatility 100 (1s) Index",
};

function BotBuilder() {
  const { user } = useAuth();
  const { preset } = Route.useSearch();
  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  // --- BOT CONFIGURATION STATE ---
  const [botName, setBotName] = useState("ArkTrader Strategy");
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("even_odd");
  const [contractType, setContractType] = useState("even");
  
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [martingale, setMartingale] = useState(2.0);
  const [maxSteps, setMaxSteps] = useState(5);
  const [currentStep, setCurrentStep] = useState(0);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  const [prediction, setPrediction] = useState(5);
  const [cooldown, setCooldown] = useState(1);

  const [stopLoss, setStopLoss] = useState(50);
  const [takeProfit, setTakeProfit] = useState(50);

  // --- RUNTIME STATE ---
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string; type?: string }[]>([]);

  useEffect(() => {
    if (preset) {
      const config = BOT_PRESETS.find(b => b.id === preset);
      if (config) {
        setSymbol(config.market);
        setInitialStake(config.stake);
        setCurrentStake(config.stake);
        setTakeProfit(config.tp);
        setStopLoss(config.sl);
        setMartingale(config.martingale);
        setBotName(config.name);
        setTradeType(config.tradeType as TradeCategory);
        setContractType(config.contractType);
      }
    }
  }, [preset]);

  const logJournal = (msg: string, type = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const saveBot = async () => {
    if (!user) return toast.error("Sign in to save strategies.");
    const { error } = await supabase.from("bots").upsert({
      user_id: user.id,
      name: botName,
      strategy: { symbol, initialStake, martingale, stopLoss, takeProfit, duration, prediction, maxSteps },
      status: running ? "running" : "stopped"
    });
    if (error) toast.error("Error: " + error.message);
    else toast.success("Strategy stored in Cloud");
  };

  const toggleBot = () => {
    if (!token) return toast.error("Connect Deriv first.");
    const next = !running;
    setRunning(next);
    runningRef.current = next;
    if (next) {
      logJournal("▶️ Execution sequence initiated", "success");
      runCycle();
    } else {
      logJournal("⏹️ Execution sequence halted", "error");
    }
  };

  async function runCycle() {
    if (!token || !runningRef.current) return;

    if (stats.profit >= takeProfit || stats.profit <= -stopLoss) {
      logJournal("🏁 Target Threshold Reached. Stopping.", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      await send({ authorize: token });
      const ct = contractTypeFor(tradeType, contractType);
      
      const proposal = await send({
        proposal: 1, amount: currentStake, basis: "stake", contract_type: ct,
        currency: derivCurrency, symbol: symbol, duration: duration, duration_unit: durationUnit,
        ...(tradeType === 'over_under' || tradeType === 'matches_differs' ? { barrier: String(prediction) } : {})
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      logJournal(`Order: ${currentStake} ${derivCurrency} on ${ct}`);

      const poll = setInterval(async () => {
        if (!runningRef.current) { clearInterval(poll); return; }
        const res = await send({ proposal_open_contract: 1, contract_id: buy.buy.contract_id });
        const c = res.proposal_open_contract;
        
        if (c.is_sold) {
          clearInterval(poll);
          const pnl = Number(c.profit);
          const won = pnl > 0;

          setStats(s => ({ runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), profit: s.profit + pnl }));
          logJournal(`${won ? 'WIN' : 'LOSS'} | P&L: ${pnl.toFixed(2)}`, won ? 'success' : 'error');

          if (won) {
            setCurrentStake(initialStake);
            setCurrentStep(0);
          } else {
            setCurrentStake(prev => Number((prev * martingale).toFixed(2)));
            setCurrentStep(prev => prev + 1);
          }

          if (runningRef.current) setTimeout(runCycle, cooldown * 1000);
        }
      }, 1000);

    } catch (e: any) {
      logJournal(`API Error: ${e.message}`, 'error');
      setRunning(false);
      runningRef.current = false;
    }
  }

  const winRate = stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0;

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-[#f8f9fa] lg:grid lg:grid-cols-[240px_1fr_360px]">
        
        {/* LEFT: WORKSPACE BLOCKS (Matched to Dashboard Sidebar) */}
        <aside className="hidden border-r border-[oklch(0.92_0.005_240)] bg-white/70 backdrop-blur-xl lg:flex flex-col p-4 space-y-1">
          <div className="flex items-center gap-2 mb-4 text-[#333] font-bold uppercase text-[10px] tracking-widest opacity-50 px-3">
            <Layers className="size-4" /> Workspace
          </div>
          {[
            { n: 'Parameters', c: 'bg-blue-500' },
            { n: 'Purchase Logic', c: 'bg-[oklch(0.7_0.17_150)]' }, // Dashboard Green
            { n: 'Risk Manager', c: 'bg-rose-500' }
          ].map(b => (
            <button key={b.n} onClick={() => toast.info(`${b.n} active`)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[oklch(0.96_0.005_240)] text-[oklch(0.35_0.02_260)]">
              <div className={cn("size-2 rounded-full", b.c)} /> {b.n}
            </button>
          ))}
        </aside>

        {/* CENTER: MAIN INTERFACE (Matched to Dashboard Cards) */}
        <main className="flex flex-col min-w-0 border-r border-[oklch(0.92_0.005_240)] overflow-hidden">
          <header className="flex items-center justify-between p-5 border-b border-[oklch(0.92_0.005_240)] bg-white/50">
            <div className="flex items-center gap-4">
               <div className="size-10 rounded-xl bg-[oklch(0.93_0.06_150)] flex items-center justify-center text-[oklch(0.35_0.12_150)] border border-[oklch(0.7_0.17_150)]/30">
                 <Zap className="size-5 fill-current" />
               </div>
               <div>
                 <h1 className="font-bold text-[#333] text-lg tracking-tight">{botName}</h1>
                 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                   <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[oklch(0.7_0.17_150)] animate-pulse" /> Live</span>
                   <ChevronRight className="size-3" />
                   <span>{symbol}</span>
                 </div>
               </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="bg-white border-[#e5e5e5] hover:bg-slate-50 text-xs font-bold text-[#333]" onClick={saveBot}><Save className="size-3.5 mr-2 text-[oklch(0.7_0.17_150)]"/> Save Strategy</Button>
               <Button variant="outline" size="sm" className="bg-white border-[#e5e5e5] hover:bg-slate-50 text-xs font-bold text-[#333]"><Download className="size-3.5 mr-2 text-blue-500"/> Export XML</Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Card: Trade Setup */}
              <div className="bg-white border border-[oklch(0.92_0.005_240)] rounded-xl p-6 space-y-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-[oklch(0.7_0.17_150)] flex items-center gap-2 tracking-widest"><Wallet className="size-4"/> Trade Setup</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Asset Index</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333]"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-white border-[#e5e5e5]">{Object.entries(MARKETS).map(([v,l]) => <SelectItem key={v} value={v} className="font-bold">{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Stake ($)</Label>
                       <Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333] focus:border-[oklch(0.7_0.17_150)]"/>
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Martingale (x)</Label>
                       <Input type="number" value={martingale} onChange={e=>setMartingale(Number(e.target.value))} className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333] focus:border-blue-400"/>
                     </div>
                  </div>
                </div>
              </div>

              {/* Card: Dynamic Parameters */}
              <div className="bg-white border border-[oklch(0.92_0.005_240)] rounded-xl p-6 space-y-6 shadow-sm">
                <h3 className="text-xs font-bold uppercase text-blue-500 flex items-center gap-2 tracking-widest"><Settings2 className="size-4"/> Parameters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Duration</Label>
                    <div className="flex gap-1">
                      <Input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333] w-16 text-center"/>
                      <Select value={durationUnit} onValueChange={setDurationUnit}>
                        <SelectTrigger className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold flex-1 text-xs text-[#333]"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-white border-[#e5e5e5]">
                          <SelectItem value="t">Ticks</SelectItem>
                          <SelectItem value="s">Sec</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Digit Prediction</Label>
                    <Select value={String(prediction)} onValueChange={v => setPrediction(Number(v))}>
                      <SelectTrigger className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333]"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-white border-[#e5e5e5]">
                        {[0,1,2,3,4,5,6,7,8,9].map(d => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Step Cap</Label>
                     <Input type="number" value={maxSteps} onChange={e=>setMaxSteps(Number(e.target.value))} className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333]"/>
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-black text-slate-400 ml-1">Cooldown (s)</Label>
                     <Input type="number" value={cooldown} onChange={e=>setCooldown(Number(e.target.value))} className="bg-[#fcfcfc] border-[#e5e5e5] h-11 rounded-lg font-bold text-[#333]"/>
                   </div>
                </div>
              </div>

              {/* Card: Risk Limits (md:col-span-2) */}
              <div className="bg-white border border-[oklch(0.92_0.005_240)] rounded-xl p-6 space-y-6 shadow-sm md:col-span-2">
                <h3 className="text-xs font-bold uppercase text-[oklch(0.7_0.17_150)] flex items-center gap-2 tracking-widest"><ShieldAlert className="size-4"/> Risk Management</h3>
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Profit Target</span>
                      <span className="text-xl font-bold text-[oklch(0.45_0.17_150)]">+{takeProfit} <span className="text-[10px] text-slate-400">USD</span></span>
                    </div>
                    <input type="range" min="1" max="2000" className="w-full accent-[oklch(0.7_0.17_150)] bg-[#f0f0f0] h-1.5 rounded-full appearance-none cursor-pointer" value={takeProfit} onChange={e=>setTakeProfit(Number(e.target.value))}/>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-bold uppercase text-slate-400">Stop Loss Limit</span>
                      <span className="text-xl font-bold text-rose-500">-{stopLoss} <span className="text-[10px] text-slate-400">USD</span></span>
                    </div>
                    <input type="range" min="1" max="2000" className="w-full accent-rose-500 bg-[#f0f0f0] h-1.5 rounded-full appearance-none cursor-pointer" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT SIDEBAR: ANALYTICS (Matched to Dashboard) */}
        <aside className="flex flex-col bg-white/70 backdrop-blur-2xl shadow-xl">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-14 bg-white border-b border-[oklch(0.92_0.005_240)] rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none font-bold text-xs uppercase tracking-widest data-[state=active]:bg-[oklch(0.7_0.17_150)] data-[state=active]:text-white text-slate-500">Summary</TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none font-bold text-xs uppercase tracking-widest data-[state=active]:bg-[oklch(0.7_0.17_150)] data-[state=active]:text-white text-slate-500">Live Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-6 space-y-6 flex flex-col justify-between overflow-hidden">
              <div className="space-y-4">
                <div className="bg-[#fcfcfc] border border-[oklch(0.92_0.005_240)] rounded-2xl p-6 relative overflow-hidden group">
                   <div className="text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Total P&L</div>
                   <div className={cn("text-5xl font-bold tabular-nums tracking-tighter", stats.profit >= 0 ? "text-[oklch(0.45_0.17_150)]" : "text-rose-500")}>
                     {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                   </div>
                   <Activity className="absolute -bottom-4 -right-4 size-20 text-slate-100 group-hover:text-emerald-50 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-xl border border-[oklch(0.92_0.005_240)] text-center shadow-sm">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Win Rate</span>
                    <div className="text-2xl font-bold text-blue-500">{winRate}%</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-[oklch(0.92_0.005_240)] text-center shadow-sm">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Trades</span>
                    <div className="text-2xl font-bold text-[#333] font-mono">{stats.runs}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-[oklch(0.92_0.005_240)]">
                  <div className="flex justify-between text-[11px] font-bold uppercase">
                    <span className="text-[oklch(0.45_0.17_150)] flex items-center gap-1.5"><Fingerprint className="size-3"/> Wins: {stats.wins}</span>
                    <span className="text-rose-500 flex items-center gap-1.5"><ShieldAlert className="size-3"/> Loss: {stats.losses}</span>
                  </div>
                  <button onClick={() => { setStats({runs:0, wins:0, losses:0, profit:0}); setCurrentStake(initialStake); logJournal("Stats reset"); }} className="w-full mt-2 text-[10px] font-bold text-blue-500 hover:underline uppercase tracking-widest flex items-center justify-center gap-2">
                    <RotateCcw className="size-3"/> Reset Performance
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                 <Button onClick={toggleBot} className={cn("w-full h-20 rounded-2xl text-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg", running ? "bg-rose-500 text-white" : "bg-[oklch(0.7_0.17_150)] text-white shadow-emerald-500/20")}>
                    {running ? <><Square className="size-6 mr-3 fill-current"/> STOP BOT</> : <><Play className="size-7 mr-3 fill-current"/> START BOT</>}
                 </Button>
                 {!token && <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-bold text-rose-500 text-center uppercase">Deriv Disconnected</div>}
              </div>
            </TabsContent>

            <TabsContent value="journal" className="flex-1 bg-[#fcfcfc] p-4 overflow-y-auto space-y-2">
              {journal.map((j, i) => (
                <div key={i} className={cn("p-3 rounded-lg border text-[11px] font-medium leading-relaxed", j.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-600" : j.type === 'success' ? "bg-emerald-50 border-emerald-100 text-[oklch(0.4_0.15_150)]" : "bg-white border-[#e5e5e5] text-slate-600 shadow-sm")}>
                  <div className="flex justify-between opacity-50 mb-1"><span>{j.time}</span> <Timer className="size-3"/></div>
                  <div>{j.msg}</div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}