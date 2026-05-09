// src/routes/bot-builder.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { TopShell } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { send, contractTypeFor, type TradeCategory } from "@/lib/deriv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Play, Square, RotateCcw, Download, GripVertical, Save, Activity, Target, ShieldAlert, Wallet, TrendingUp, Settings2, Layers, ChevronRight, Info, History, FileCode } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_PRESETS } from "./trading-bots";

export const Route = createFileRoute("/bot-builder")({
  validateSearch: z.object({ preset: z.string().optional() }),
  component: BotBuilder,
});

const MARKETS = { "R_10": "Volatility 10", "R_25": "Volatility 25", "R_50": "Volatility 50", "R_75": "Volatility 75", "R_100": "Volatility 100", "1HZ10V": "Volatility 10 (1s)", "1HZ100V": "Volatility 100 (1s)" };

function BotBuilder() {
  const { user } = useAuth();
  const { preset } = Route.useSearch();
  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  // Bot Config
  const [symbol, setSymbol] = useState("R_100");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);
  const [martingale, setMartingale] = useState(2.0);
  const [botName, setBotName] = useState("New Strategy");

  // State Management for seamless operation
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false); // Used to instantly halt execution loops
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
      }
    }
  }, [preset]);

  const logJournal = (msg: string, type = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const resetPerformance = () => {
    setStats({ runs: 0, wins: 0, losses: 0, profit: 0 });
    setJournal([]);
    setCurrentStake(initialStake);
    toast.success("Performance session reset");
  };

  const toggleBot = () => {
    const nextState = !running;
    setRunning(nextState);
    runningRef.current = nextState;
    
    if (nextState) {
      logJournal("🚀 Bot execution started", "success");
      runCycle();
    } else {
      logJournal("🛑 Bot execution stopped", "error");
    }
  };

  async function runCycle() {
    if (!token || !runningRef.current) return;

    // Safety Checks
    if (stats.profit >= takeProfit || stats.profit <= -stopLoss) {
      logJournal("🏁 Strategy Target Reached. Halting.", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      await send({ authorize: token });
      const proposal = await send({
        proposal: 1, amount: currentStake, basis: "stake", contract_type: "DIGITEVEN",
        currency: derivCurrency, symbol: symbol, duration: 1, duration_unit: "t"
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      logJournal(`Placed Order: ${currentStake} ${derivCurrency}`);

      const poll = setInterval(async () => {
        if (!runningRef.current) { clearInterval(poll); return; }
        
        const res = await send({ proposal_open_contract: 1, contract_id: buy.buy.contract_id });
        const c = res.proposal_open_contract;
        
        if (c.is_sold) {
          clearInterval(poll);
          const pnl = Number(c.profit);
          const won = pnl > 0;

          setStats(s => ({ runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), profit: s.profit + pnl }));
          logJournal(`${won ? 'WIN' : 'LOSS'}: ${pnl.toFixed(2)}`, won ? 'success' : 'error');

          if (won) setCurrentStake(initialStake);
          else setCurrentStake(prev => Number((prev * martingale).toFixed(2)));

          // Seamless loop without refresh
          if (runningRef.current) setTimeout(runCycle, 500);
        }
      }, 1000);

    } catch (e: any) {
      logJournal(`Error: ${e.message}`, 'error');
      setRunning(false);
      runningRef.current = false;
    }
  }

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-slate-950 lg:grid lg:grid-cols-[240px_1fr_340px]">
        
        {/* LEFT BLOCKS */}
        <aside className="hidden border-r border-white/5 bg-slate-900/20 lg:flex flex-col p-4 space-y-2">
          <div className="flex items-center gap-2 mb-4 opacity-50"><Layers className="size-4" /><span className="text-[10px] font-black uppercase">Workspace</span></div>
          {['Trade Params', 'Purchase Logic', 'Restart Logic'].map(b => (
            <div key={b} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl text-[11px] font-bold text-slate-400 flex items-center gap-2">
              <div className="size-2 rounded-full bg-sky-500" /> {b}
            </div>
          ))}
        </aside>

        {/* CENTER WORKSPACE */}
        <main className="flex flex-col min-w-0 border-r border-white/5">
          <header className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/10">
            <div className="flex items-center gap-4">
               <div className="size-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/30"><FileCode className="size-5" /></div>
               <div><h1 className="font-black text-white">{botName}</h1><div className="text-[10px] font-bold text-slate-500 uppercase">{symbol}</div></div>
            </div>
            <div className="flex gap-2">
               <Button variant="outline" size="sm" className="bg-slate-800 border-white/10 text-xs" onClick={() => toast.success("Saved")}><Save className="size-3.5 mr-2"/> Save</Button>
               <Button variant="outline" size="sm" className="bg-slate-800 border-white/10 text-xs"><Download className="size-3.5 mr-2"/> XML</Button>
            </div>
          </header>

          <div className="p-8 grid gap-8 md:grid-cols-2 overflow-y-auto">
            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6">
              <h3 className="text-xs font-black uppercase text-sky-400 flex items-center gap-2"><Wallet className="size-4"/> Configuration</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-slate-500">Asset</Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="bg-slate-950 border-white/10 h-12 rounded-xl"><SelectValue/></SelectTrigger>
                    <SelectContent>{Object.entries(MARKETS).map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Stake</Label><Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="bg-slate-950 border-white/10 h-12 rounded-xl font-black"/></div>
                   <div className="space-y-2"><Label className="text-[10px] uppercase font-black text-slate-500">Martingale</Label><Input type="number" value={martingale} onChange={e=>setMartingale(Number(e.target.value))} className="bg-slate-950 border-white/10 h-12 rounded-xl font-black"/></div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-white/10 rounded-3xl p-6 space-y-6">
              <h3 className="text-xs font-black uppercase text-orange-400 flex items-center gap-2"><ShieldAlert className="size-4"/> Limits</h3>
              <div className="space-y-6">
                <div className="space-y-2"><div className="flex justify-between text-[10px] font-black uppercase"><span>Take Profit</span><span className="text-emerald-400">{takeProfit}</span></div><input type="range" min="1" max="5000" className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-full" value={takeProfit} onChange={e=>setTakeProfit(Number(e.target.value))}/></div>
                <div className="space-y-2"><div className="flex justify-between text-[10px] font-black uppercase"><span>Stop Loss</span><span className="text-rose-500">{stopLoss}</span></div><input type="range" min="1" max="5000" className="w-full accent-rose-500 bg-slate-950 h-1.5 rounded-full" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))}/></div>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT ANALYTICS */}
        <aside className="flex flex-col bg-slate-900 shadow-2xl">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-14 bg-slate-950 border-b border-white/5 rounded-none">
              <TabsTrigger value="summary" className="text-[10px] font-black uppercase">Summary</TabsTrigger>
              <TabsTrigger value="journal" className="text-[10px] font-black uppercase">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="summary" className="p-6 space-y-6 flex flex-col justify-between flex-1">
              <div className="space-y-4">
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-5">
                   <div className="text-[9px] font-black text-slate-500 uppercase mb-1">Total Profit</div>
                   <div className={cn("text-4xl font-black tabular-nums", stats.profit >= 0 ? "text-emerald-400" : "text-rose-500")}>{stats.profit.toFixed(2)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/5"><div className="text-[8px] font-bold text-slate-500 uppercase">Win Rate</div><div className="text-xl font-black text-sky-400">{winRate}%</div></div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-white/5"><div className="text-[8px] font-bold text-slate-500 uppercase">Runs</div><div className="text-xl font-black text-white">{stats.runs}</div></div>
                </div>
                <div className="flex justify-between text-[11px] font-black uppercase pt-4 border-t border-white/5">
                  <span className="text-slate-500">Wins: {stats.wins}</span>
                  <span className="text-slate-500">Loss: {stats.losses}</span>
                  <button onClick={resetPerformance} className="text-sky-500 hover:text-sky-300 flex items-center gap-1"><RotateCcw className="size-3"/> Reset</button>
                </div>
              </div>

              <div className="space-y-4">
                 <Button onClick={toggleBot} className={cn("w-full h-20 rounded-[28px] text-xl font-black transition-all", running ? "bg-rose-600 hover:bg-rose-500" : "bg-sky-500 hover:bg-sky-400 shadow-lg shadow-sky-500/20")}>
                    {running ? <><Square className="size-6 mr-3 fill-current"/> STOP BOT</> : <><Play className="size-7 mr-3 fill-current"/> START BOT</>}
                 </Button>
                 {!token && <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-[10px] font-bold text-rose-300 text-center uppercase tracking-tighter">Connection Required</div>}
              </div>
            </TabsContent>
            <TabsContent value="journal" className="flex-1 bg-slate-950/50 p-4 overflow-y-auto space-y-2">
              {journal.map((j, i) => (
                <div key={i} className={cn("p-3 rounded-lg border-l-2 text-[10px] font-mono", j.type === 'error' ? "bg-rose-500/5 border-rose-500 text-rose-300" : j.type === 'success' ? "bg-emerald-500/5 border-emerald-500 text-emerald-300" : "bg-white/[0.02] border-white/5 text-slate-400")}>
                  <div className="flex justify-between opacity-30 mb-1"><span>{j.time}</span></div>
                  <div className="font-bold">{j.msg}</div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}