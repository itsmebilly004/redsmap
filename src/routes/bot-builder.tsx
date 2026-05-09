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
  const [tradeType, setTradeType] = useState<TradeCategory>("over_under");
  const [contractType, setContractType] = useState("over");
  
  // New Manual Inputs
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [martingale, setMartingale] = useState(2.0);
  const [maxSteps, setMaxSteps] = useState(5); // Stop after X losses
  const [currentStep, setCurrentStep] = useState(0);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  const [prediction, setPrediction] = useState(5);
  const [cooldown, setCooldown] = useState(1); // Seconds between cycles

  // Session Limits
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

    // 1. Safety & Recovery Limit Checks
    if (stats.profit >= takeProfit || stats.profit <= -stopLoss) {
      logJournal("🏁 Target Threshold Reached. Stopping.", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    if (currentStep >= maxSteps) {
      logJournal("⚠️ Max Martingale Steps Exceeded. Resetting.", "error");
      setCurrentStake(initialStake);
      setCurrentStep(0);
    }

    try {
      await send({ authorize: token });
      const ct = contractTypeFor(tradeType, contractType);
      
      const proposal = await send({
        proposal: 1,
        amount: currentStake,
        basis: "stake",
        contract_type: ct,
        currency: derivCurrency,
        symbol: symbol,
        duration: duration,
        duration_unit: durationUnit,
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

          // Respect Cooldown
          if (runningRef.current) setTimeout(runCycle, cooldown * 1000);
        }
      }, 1000);

    } catch (e: any) {
      logJournal(`API Error: ${e.message}`, 'error');
      setRunning(false);
      runningRef.current = false;
    }
  }

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background lg:grid lg:grid-cols-[240px_1fr_360px]">
        
        {/* LEFT: WORKSPACE BLOCKS (Branded) */}
        <aside className="hidden border-r border-border/40 bg-card/30 lg:flex flex-col p-4 space-y-2">
          <div className="flex items-center gap-2 mb-4 text-primary font-black uppercase text-[10px] tracking-widest opacity-70">
            <Layers className="size-4" /> Workspace
          </div>
          {[
            { n: 'Parameters', c: 'text-sky-400' },
            { n: 'Purchase Logic', c: 'text-emerald-400' },
            { n: 'Risk Manager', c: 'text-destructive' }
          ].map(b => (
            <button key={b.n} onClick={() => toast.info(`${b.n} block active`)} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-[11px] font-bold text-slate-300 flex items-center gap-3 transition hover:bg-white/[0.08]">
              <div className={cn("size-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]", b.c.replace('text-', 'bg-'))} /> {b.n}
            </button>
          ))}
        </aside>

        {/* CENTER: MAIN INTERFACE */}
        <main className="flex flex-col min-w-0 border-r border-border/40 overflow-hidden">
          <header className="flex items-center justify-between p-5 border-b border-border/40 bg-card/20">
            <div className="flex items-center gap-4">
               <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_20px_rgba(255,68,79,0.1)]">
                 <Zap className="size-5 fill-current" />
               </div>
               <div>
                 <h1 className="font-black text-white text-lg tracking-tight">{botName}</h1>
                 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                   <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-primary animate-pulse" /> Live</span>
                   <ChevronRight className="size-3" />
                   <span>{symbol}</span>
                 </div>
               </div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold" onClick={saveBot}><Save className="size-3.5 mr-2 text-primary"/> Save Strategy</Button>
               <Button variant="outline" size="sm" className="bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold"><Download className="size-3.5 mr-2 text-sky-400"/> Export XML</Button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
            <div className="grid gap-6 md:grid-cols-2">
              
              {/* Card: Trade Setup */}
              <div className="bg-card border border-border/60 rounded-[24px] p-6 space-y-6 shadow-xl">
                <h3 className="text-xs font-black uppercase text-primary flex items-center gap-2 tracking-widest"><Wallet className="size-4"/> Trade Setup</h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Asset Index</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="bg-background border-white/10 h-11 rounded-xl font-bold"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-card border-white/10">{Object.entries(MARKETS).map(([v,l]) => <SelectItem key={v} value={v} className="font-bold">{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1.5">
                       <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Stake ($)</Label>
                       <Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="bg-background border-white/10 h-11 rounded-xl font-black text-white focus:border-primary"/>
                     </div>
                     <div className="space-y-1.5">
                       <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Martingale (x)</Label>
                       <Input type="number" value={martingale} onChange={e=>setMartingale(Number(e.target.value))} className="bg-background border-white/10 h-11 rounded-xl font-black text-white focus:border-sky-400"/>
                     </div>
                  </div>
                </div>
              </div>

              {/* Card: Dynamic Parameters */}
              <div className="bg-card border border-border/60 rounded-[24px] p-6 space-y-6 shadow-xl">
                <h3 className="text-xs font-black uppercase text-sky-400 flex items-center gap-2 tracking-widest"><Settings2 className="size-4"/> Parameters</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Duration ({durationUnit})</Label>
                    <div className="flex gap-1">
                      <Input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="bg-background border-white/10 h-11 rounded-xl font-black text-white w-16 text-center"/>
                      <Select value={durationUnit} onValueChange={setDurationUnit}>
                        <SelectTrigger className="bg-background border-white/10 h-11 rounded-xl font-bold flex-1 text-xs"><SelectValue/></SelectTrigger>
                        <SelectContent className="bg-card border-white/10">
                          <SelectItem value="t">Ticks</SelectItem>
                          <SelectItem value="s">Sec</SelectItem>
                          <SelectItem value="m">Min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Prediction Digit</Label>
                    <Select value={String(prediction)} onValueChange={v => setPrediction(Number(v))}>
                      <SelectTrigger className="bg-background border-white/10 h-11 rounded-xl font-bold"><SelectValue/></SelectTrigger>
                      <SelectContent className="bg-card border-white/10">
                        {[0,1,2,3,4,5,6,7,8,9].map(d => <SelectItem key={d} value={String(d)} className="font-mono">{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Recovery Limit (Steps)</Label>
                     <Input type="number" value={maxSteps} onChange={e=>setMaxSteps(Number(e.target.value))} className="bg-background border-white/10 h-11 rounded-xl font-black text-white" placeholder="Steps"/>
                   </div>
                   <div className="space-y-1.5">
                     <Label className="text-[10px] uppercase font-black text-muted-foreground ml-1">Cycle Cooldown (s)</Label>
                     <Input type="number" value={cooldown} onChange={e=>setCooldown(Number(e.target.value))} className="bg-background border-white/10 h-11 rounded-xl font-black text-white"/>
                   </div>
                </div>
              </div>

              {/* Card: Risk Limits */}
              <div className="bg-card border border-border/60 rounded-[24px] p-6 space-y-6 shadow-xl md:col-span-2">
                <h3 className="text-xs font-black uppercase text-emerald-400 flex items-center gap-2 tracking-widest"><ShieldAlert className="size-4"/> Risk Management</h3>
                <div className="grid gap-8 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Profit Target</span>
                      <span className="text-xl font-black text-emerald-400">+{takeProfit} <span className="text-[10px] opacity-50 uppercase">{derivCurrency || 'USD'}</span></span>
                    </div>
                    <input type="range" min="1" max="2000" step="5" className="w-full accent-emerald-500 bg-background h-1.5 rounded-full appearance-none cursor-pointer border border-white/5" value={takeProfit} onChange={e=>setTakeProfit(Number(e.target.value))}/>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Stop Loss Limit</span>
                      <span className="text-xl font-black text-primary">-{stopLoss} <span className="text-[10px] opacity-50 uppercase">{derivCurrency || 'USD'}</span></span>
                    </div>
                    <input type="range" min="1" max="2000" step="5" className="w-full accent-primary bg-background h-1.5 rounded-full appearance-none cursor-pointer border border-white/5" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))}/>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: ANALYTICS & CONTROLS */}
        <aside className="flex flex-col bg-card/60 backdrop-blur-2xl shadow-2xl border-l border-border/40">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-14 bg-background/50 border-b border-white/10 rounded-none">
              <TabsTrigger value="summary" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-primary">Performance</TabsTrigger>
              <TabsTrigger value="journal" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:text-sky-400">Live Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-6 space-y-6 flex flex-col justify-between overflow-hidden">
              <div className="space-y-4">
                <div className="bg-background border border-white/5 rounded-3xl p-6 shadow-inner relative overflow-hidden group">
                   <div className="text-[9px] font-black text-muted-foreground uppercase mb-1 tracking-widest">Total Net Profit</div>
                   <div className={cn("text-5xl font-black tabular-nums tracking-tighter", stats.profit >= 0 ? "text-emerald-400" : "text-primary")}>
                     {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                   </div>
                   <Activity className="absolute -bottom-4 -right-4 size-20 text-white/5 group-hover:text-primary/10 transition-colors" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background/80 p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Accuracy</span>
                    <div className="text-2xl font-black text-sky-400">
                      {stats.runs > 0 ? Math.round((stats.wins/stats.runs)*100) : 0}%
                    </div>
                  </div>
                  <div className="bg-background/80 p-4 rounded-2xl border border-white/5 text-center">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Cycles</span>
                    <div className="text-2xl font-black text-white font-mono">{stats.runs}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-4">
                  <div className="flex justify-between text-[11px] font-black uppercase border-b border-white/5 pb-2">
                    <span className="text-emerald-400/70 flex items-center gap-1.5"><Fingerprint className="size-3"/> Wins: {stats.wins}</span>
                    <span className="text-primary/70 flex items-center gap-1.5"><ShieldAlert className="size-3"/> Loss: {stats.losses}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase pt-1">
                    <span>Recovery Step</span>
                    <span>{currentStep} / {maxSteps}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                 <Button onClick={toggleBot} className={cn("w-full h-20 rounded-[32px] text-xl font-black transition-all hover:scale-[1.02] active:scale-95 shadow-2xl", running ? "bg-primary text-white shadow-primary/30" : "bg-sky-500 text-white shadow-sky-500/30")}>
                    {running ? <><Square className="size-6 mr-3 fill-current animate-pulse"/> STOP TRADING</> : <><Play className="size-7 mr-3 fill-current"/> START ENGINE</>}
                 </Button>
                 <button onClick={() => { setStats({runs:0, wins:0, losses:0, profit:0}); setCurrentStake(initialStake); setCurrentStep(0); logJournal("Performance log cleared"); }} className="w-full text-[10px] font-black text-slate-500 hover:text-white uppercase tracking-widest flex items-center justify-center gap-2"><RotateCcw className="size-3"/> Clear Performance History</button>
              </div>
            </TabsContent>

            <TabsContent value="journal" className="flex-1 bg-background/50 p-4 overflow-y-auto space-y-2 scrollbar-hide">
              {journal.map((j, i) => (
                <div key={i} className={cn("p-4 rounded-2xl border-l-4 text-[10px] font-bold font-mono shadow-sm", j.type === 'error' ? "bg-primary/5 border-primary text-primary" : j.type === 'success' ? "bg-emerald-500/5 border-emerald-500 text-emerald-300" : "bg-white/[0.03] border-sky-500 text-slate-300")}>
                  <div className="flex justify-between opacity-30 mb-1 border-b border-white/5 pb-1"><span>{j.time}</span> <Timer className="size-3"/></div>
                  <div className="leading-relaxed">{j.msg}</div>
                </div>
              ))}
              {journal.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-800 uppercase tracking-widest font-black opacity-20">
                  <Activity className="size-16 mb-4" />
                  <p>Feed Idle</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}