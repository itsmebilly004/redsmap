import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  GripVertical,
  Save,
  Activity,
  Target,
  ShieldAlert,
  Wallet,
  TrendingUp,
  Settings2,
  Layers,
  ChevronRight,
  Info,
  History,
  FileCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_PRESETS } from "./trading-bots";

const searchSchema = z.object({
  preset: z.string().optional(),
});

export const Route = createFileRoute("/bot-builder")({
  validateSearch: searchSchema,
  component: BotBuilder,
});

const BLOCK_META = [
  { id: "trade_params", title: "Trade Parameters", icon: Settings2, color: "text-sky-400" },
  { id: "purchase_logic", title: "Purchase Logic", icon: Target, color: "text-emerald-400" },
  { id: "restart_cond", title: "Restart Conditions", icon: RotateCcw, color: "text-orange-400" },
];

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

  // Bot Configuration State
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType] = useState<TradeCategory>("even_odd");
  const [contractType] = useState("even");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);
  const [martingale, setMartingale] = useState(2.0);
  const [botName, setBotName] = useState("New Strategy");

  // UI / Runtime State
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string; type?: 'info' | 'error' | 'success' }[]>([]);

  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  // 1. Load Presets
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
        toast.success(`Preset "${config.name}" deployed`);
      }
    }
  }, [preset]);

  // 2. Journaling
  const logJournal = (msg: string, type: any = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  // 3. Save Functionality
  const saveBot = async () => {
    if (!user) return toast.error("Please sign in to save.");
    const { error } = await supabase.from("bots").upsert({
      user_id: user.id,
      name: botName,
      strategy: { symbol, initialStake, martingale, stopLoss, takeProfit },
      status: running ? "running" : "stopped"
    });
    if (error) toast.error("Save failed: " + error.message);
    else toast.success("Strategy saved to Cloud");
  };

  // 4. XML Export Functionality
  const exportXML = () => {
    const xmlContent = `<xml><strategy name="${botName}"><market>${symbol}</market><stake>${initialStake}</stake></strategy></xml>`;
    const blob = new Blob([xmlContent], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${botName.replace(/\s+/g, "_")}.xml`;
    a.click();
    toast.success("XML Strategy Exported");
  };

  // 5. Trading Execution Loop
  async function runCycle() {
    if (!token || !running) return;

    if (stats.profit >= takeProfit || (stats.profit <= -stopLoss)) {
      const result = stats.profit >= takeProfit ? "TARGET REACHED" : "STOP LOSS HIT";
      logJournal(`🛑 Bot Stopped: ${result}`, stats.profit >= takeProfit ? 'success' : 'error');
      setRunning(false);
      return;
    }

    try {
      await send({ authorize: token });
      const ct = contractTypeFor(tradeType, contractType);
      const proposal = await send({
        proposal: 1, amount: currentStake, basis: "stake", contract_type: ct,
        currency: derivCurrency, symbol: symbol, duration: 1, duration_unit: "t"
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      logJournal(`Order Placed: ${currentStake} ${derivCurrency}`);

      const poll = setInterval(async () => {
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
          if (running) setTimeout(runCycle, 800);
        }
      }, 1000);
    } catch (e: any) {
      logJournal(`Critical Error: ${e.message}`, 'error');
      setRunning(false);
    }
  }

  useEffect(() => { if (running) runCycle(); }, [running]);

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] flex-col lg:grid lg:grid-cols-[240px_1fr_340px] overflow-hidden bg-slate-950">
        
        {/* LEFT: WORKSPACE BLOCKS */}
        <aside className="hidden flex-col border-r border-white/5 bg-slate-900/30 lg:flex">
          <div className="p-4 flex items-center gap-2 border-b border-white/5">
            <Layers className="size-4 text-sky-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logic Workspace</span>
          </div>
          <div className="p-3 space-y-2">
            {BLOCK_META.map((b) => (
              <button 
                key={b.id} 
                onClick={() => toast.info(`Adding ${b.title} to flow...`)}
                className="w-full group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 transition hover:bg-white/[0.06] active:scale-95"
              >
                <div className={cn("rounded-lg bg-slate-950 p-2 border border-white/5", b.color)}>
                  <b.icon className="size-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-300">{b.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* CENTER: MAIN BUILDER */}
        <main className="flex flex-col flex-1 min-w-0">
          {/* Internal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-slate-900/20">
            <div className="flex items-center gap-4">
              <div className="size-10 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400 border border-sky-500/30">
                <FileCode className="size-5" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white tracking-tight">{botName}</h1>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live</span>
                  <ChevronRight className="size-3" />
                  <span>{symbol}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveBot} variant="outline" size="sm" className="bg-slate-800 border-white/10 hover:bg-slate-700 text-xs h-8">
                <Save className="size-3.5 mr-2" /> Save
              </Button>
              <Button onClick={exportXML} variant="outline" size="sm" className="bg-slate-800 border-white/10 hover:bg-slate-700 text-xs h-8">
                <Download className="size-3.5 mr-2" /> XML
              </Button>
            </div>
          </div>

          {/* Config Grid */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <div className="grid gap-6">
              {/* Row 1: Market */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <Wallet className="size-3.5 text-sky-400" /> Market Configuration
                  </h3>
                  <div className="space-y-3">
                    <Label className="text-[11px] text-slate-400 uppercase font-bold">Select Asset</Label>
                    <Select value={symbol} onValueChange={setSymbol}>
                      <SelectTrigger className="bg-slate-950 border-white/10 h-10 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-white/10">
                        {Object.entries(MARKETS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-slate-400 uppercase font-bold">Base Stake</Label>
                      <Input type="number" value={initialStake} onChange={e => setInitialStake(Number(e.target.value))} className="bg-slate-950 border-white/10 h-10 rounded-lg font-mono text-white" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-slate-400 uppercase font-bold">Martingale</Label>
                      <Input type="number" value={martingale} onChange={e => setMartingale(Number(e.target.value))} className="bg-slate-950 border-white/10 h-10 rounded-lg font-mono text-white" />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-5 space-y-6">
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <ShieldAlert className="size-3.5 text-orange-400" /> Session Limits
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Take Profit</span>
                      <span className="text-emerald-400 font-black text-sm font-mono">+{takeProfit} {derivCurrency || 'USD'}</span>
                    </div>
                    <input type="range" min="1" max="1000" className="w-full accent-emerald-500 bg-slate-950 h-1.5 rounded-full" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} />
                    
                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Stop Loss</span>
                      <span className="text-rose-500 font-black text-sm font-mono">-{stopLoss} {derivCurrency || 'USD'}</span>
                    </div>
                    <input type="range" min="1" max="1000" className="w-full accent-rose-500 bg-slate-950 h-1.5 rounded-full" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
                  </div>
                </div>
              </div>

              {/* Bot Info Message */}
              <div className="bg-sky-500/5 border border-sky-500/10 rounded-xl p-4 flex gap-4">
                <Info className="size-5 text-sky-400 shrink-0" />
                <p className="text-[11px] text-slate-400 leading-normal">
                  The bot uses a **Dynamic Martingale** engine. On every loss, the next stake is multiplied by <span className="text-white font-bold">{martingale}x</span>. 
                  On a win, the stake resets to <span className="text-white font-bold">${initialStake}</span>.
                </p>
              </div>
            </div>
          </div>
        </main>

        {/* RIGHT: ANALYTICS & LOGS */}
        <aside className="flex flex-col border-l border-white/5 bg-slate-900/40">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-12 bg-slate-950 rounded-none border-b border-white/5">
              <TabsTrigger value="summary" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-sky-500 data-[state=active]:text-white">Performance</TabsTrigger>
              <TabsTrigger value="journal" className="text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-sky-500 data-[state=active]:text-white">Live Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-5 flex flex-col justify-between overflow-hidden">
              <div className="space-y-4">
                <div className="bg-slate-950 border border-white/5 rounded-2xl p-5 shadow-inner">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Total Net Profit</span>
                  <div className={cn("text-4xl font-black tabular-nums mt-1", stats.profit >= 0 ? "text-emerald-400" : "text-rose-500")}>
                    {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-slate-950 border border-white/5 rounded-xl p-3 text-center">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Win Rate</span>
                    <div className="text-xl font-black text-sky-400 font-mono">{stats.runs > 0 ? Math.round((stats.wins/stats.runs)*100) : 0}%</div>
                  </div>
                  <div className="bg-slate-950 border border-white/5 rounded-xl p-3 text-center">
                    <span className="text-[8px] font-bold text-slate-500 uppercase">Cycles</span>
                    <div className="text-xl font-black text-white font-mono">{stats.runs}</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 text-[11px] font-bold">
                  <div className="flex justify-between text-emerald-400/80 uppercase"><span>Profit Wins</span> <span>{stats.wins}</span></div>
                  <div className="flex justify-between text-rose-500/80 uppercase"><span>Martingale Losses</span> <span>{stats.losses}</span></div>
                </div>
              </div>

              <div className="pt-4 space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-500">
                    <span>Session Progress</span>
                    <span>{stats.runs}%</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-sky-500 transition-all duration-700" style={{ width: `${Math.min(stats.runs, 100)}%` }} />
                  </div>
                </div>

                {!running ? (
                  <Button 
                    onClick={() => setRunning(true)} 
                    className="w-full h-16 rounded-2xl bg-sky-500 text-white font-black text-lg shadow-[0_10px_30px_-10px_rgba(14,165,233,0.5)] hover:bg-sky-400 transition-all active:scale-95"
                    disabled={!token}
                  >
                    <Play className="size-6 mr-3 fill-current" /> START BOT
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setRunning(false)} 
                    variant="destructive" 
                    className="w-full h-16 rounded-2xl font-black text-lg shadow-[0_10px_30px_-10px_rgba(225,29,72,0.5)] active:scale-95"
                  >
                    <Square className="size-5 mr-3 fill-current" /> STOP BOT
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 flex-1 bg-slate-950/50 flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                {journal.map((j, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-lg border-l-2 text-[10px] font-mono leading-tight",
                    j.type === 'error' ? "bg-rose-500/5 border-rose-500/50 text-rose-300" :
                    j.type === 'success' ? "bg-emerald-500/5 border-emerald-500/50 text-emerald-300" :
                    "bg-white/[0.02] border-white/5 text-slate-400"
                  )}>
                    <div className="flex justify-between mb-1 opacity-30"><span>EVENT</span> <span>{j.time}</span></div>
                    <div className="font-bold">{j.msg}</div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}