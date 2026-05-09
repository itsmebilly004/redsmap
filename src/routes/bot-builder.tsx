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

const DEFAULT_BLOCKS = ["trade_parameters", "purchase_logic", "restart_conditions"] as const;
type BlockId = (typeof DEFAULT_BLOCKS)[number];

const BLOCK_META: Record<BlockId, { title: string; icon: any; color: string }> = {
  trade_parameters: { title: "Trade Parameters", icon: Settings2, color: "text-sky-400" },
  purchase_logic: { title: "Purchase Logic", icon: Target, color: "text-emerald-400" },
  restart_conditions: { title: "Restart Conditions", icon: RotateCcw, color: "text-orange-400" },
};

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

  // Strategy State
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("even_odd");
  const [contractType, setContractType] = useState("even");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);
  const [martingale, setMartingale] = useState(2.0);
  const [botName, setBotName] = useState("Custom Strategy");

  // UI State
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string; type?: 'info' | 'error' | 'success' }[]>([]);

  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  useEffect(() => {
    if (preset) {
      const config = BOT_PRESETS.find(b => b.id === preset);
      if (config) {
        setSymbol(config.market);
        setTradeType(config.tradeType as TradeCategory);
        setContractType(config.contractType);
        setInitialStake(config.stake);
        setCurrentStake(config.stake);
        setTakeProfit(config.tp);
        setStopLoss(config.sl);
        setMartingale(config.martingale);
        setBotName(config.name);
        toast.success(`Preset "${config.name}" loaded`);
      }
    }
  }, [preset]);

  const logJournal = (msg: string, type: any = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 100));
  };

  async function runCycle() {
    if (!token || !running) return;

    if (stats.profit >= takeProfit) {
      logJournal("🎯 Take Profit Reached!", 'success');
      setRunning(false);
      return;
    }
    if (Math.abs(stats.profit) >= stopLoss && stats.profit < 0) {
      logJournal("🛑 Stop Loss Hit!", 'error');
      setRunning(false);
      return;
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
        duration: 1,
        duration_unit: "t",
        ...(tradeType === 'over_under' ? { barrier: "5" } : {})
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      logJournal(`Executing ${ct}...`);

      const poll = setInterval(async () => {
        const res = await send({ proposal_open_contract: 1, contract_id: buy.buy.contract_id });
        const c = res.proposal_open_contract;

        if (c.is_sold) {
          clearInterval(poll);
          const pnl = Number(c.profit);
          const won = pnl > 0;

          setStats(s => ({
            runs: s.runs + 1,
            wins: s.wins + (won ? 1 : 0),
            losses: s.losses + (won ? 0 : 1),
            profit: s.profit + pnl
          }));

          logJournal(`${won ? 'WIN' : 'LOSS'} cycle complete: ${pnl.toFixed(2)}`, won ? 'success' : 'error');

          if (won) setCurrentStake(initialStake);
          else setCurrentStake(prev => Number((prev * martingale).toFixed(2)));

          if (running) setTimeout(runCycle, 1000);
        }
      }, 1500);

    } catch (e: any) {
      logJournal(`Runtime Error: ${e.message}`, 'error');
      setRunning(false);
    }
  }

  useEffect(() => {
    if (running) runCycle();
  }, [running]);

  const winRate = stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0;

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] flex-col lg:grid lg:grid-cols-[260px_1fr_400px]">
        
        {/* LEFT SIDEBAR: BLOCK LIST */}
        <aside className="hidden flex-col border-r border-white/10 bg-slate-900/50 backdrop-blur-md lg:flex">
          <div className="p-4 flex items-center gap-2 border-b border-white/5">
            <Layers className="size-4 text-sky-400" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-300">Logic Workspace</span>
          </div>
          
          <div className="flex-1 space-y-3 p-4">
            {(Object.keys(BLOCK_META) as BlockId[]).map((id) => {
              const meta = BLOCK_META[id];
              return (
                <div key={id} className="group flex cursor-grab items-center gap-3 rounded-xl border border-white/10 bg-slate-800/40 p-4 transition hover:border-sky-500/50 hover:bg-slate-800 active:cursor-grabbing shadow-sm">
                  <div className={cn("rounded-lg bg-white/5 p-2 shadow-inner", meta.color)}>
                    <meta.icon className="size-4" />
                  </div>
                  <span className="text-sm font-bold text-slate-100">{meta.title}</span>
                  <GripVertical className="ml-auto size-4 text-slate-600 opacity-0 group-hover:opacity-100" />
                </div>
              );
            })}
            
            <div className="mt-10 rounded-2xl border-2 border-dashed border-white/5 p-6 text-center">
              <p className="text-xs font-medium leading-relaxed text-slate-400">
                Drag blocks here to build custom triggers.
              </p>
            </div>
          </div>
        </aside>

        {/* CENTER: BOT BUILDER WORKSPACE */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-slate-950 p-6">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-sky-500 flex items-center justify-center text-white shadow-[0_0_30px_-5px_rgba(14,165,233,0.5)]">
                <Activity className="size-7" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white">{botName}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-black text-emerald-400 uppercase border border-emerald-500/20">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Ticks
                  </span>
                  <ChevronRight className="size-3 text-slate-600" />
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    {MARKETS[symbol as keyof typeof MARKETS] || symbol}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button variant="secondary" className="rounded-xl font-bold bg-slate-800 text-white hover:bg-slate-700 h-11 px-5 border border-white/5">
                <Save className="mr-2 size-5" /> Save Bot
              </Button>
              <Button variant="outline" className="rounded-xl font-bold border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 h-11 px-5">
                <Download className="mr-2 size-5" /> XML
              </Button>
            </div>
          </header>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Configuration Card */}
            <section className="rounded-[32px] border border-white/10 bg-slate-900 p-8 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-sky-400">
                  <Wallet className="size-5" /> Market & Position
                </h3>
                <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <Info className="size-4 text-slate-500" />
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-sm font-bold text-slate-200 ml-1">Asset Index</Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="h-14 rounded-2xl bg-slate-950 border-white/10 text-white font-bold text-base focus:ring-sky-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-white/10 text-white">
                      {Object.entries(MARKETS).map(([v, l]) => <SelectItem key={v} value={v} className="focus:bg-sky-500">{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200 ml-1">Initial Stake</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={initialStake} 
                        onChange={e => setInitialStake(Number(e.target.value))}
                        className="h-14 rounded-2xl bg-slate-950 border-white/20 pl-10 text-lg font-black text-white focus:border-sky-500 transition-colors"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sky-500 font-bold">$</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-bold text-slate-200 ml-1">Martingale</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={martingale} 
                        onChange={e => setMartingale(Number(e.target.value))}
                        className="h-14 rounded-2xl bg-slate-950 border-white/20 pl-10 text-lg font-black text-white focus:border-sky-500 transition-colors"
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 font-bold">x</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Risk Control Card */}
            <section className="rounded-[32px] border border-white/10 bg-slate-900 p-8 shadow-2xl">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-orange-400">
                  <ShieldAlert className="size-5" /> Safety Mechanisms
                </h3>
                <Settings2 className="size-5 text-slate-600" />
              </div>

              <div className="space-y-10">
                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Take Profit Target</span>
                    <span className="text-2xl font-black text-emerald-400">+{takeProfit} <span className="text-xs text-slate-500 ml-1">{derivCurrency || 'USD'}</span></span>
                  </div>
                  <input 
                    type="range" min="1" max="5000" step="1"
                    className="w-full accent-emerald-500 bg-slate-950 h-2.5 rounded-full appearance-none cursor-pointer border border-white/5"
                    value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} 
                  />
                </div>

                <div className="space-y-5">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Max Stop Loss</span>
                    <span className="text-2xl font-black text-rose-500">-{stopLoss} <span className="text-xs text-slate-500 ml-1">{derivCurrency || 'USD'}</span></span>
                  </div>
                  <input 
                    type="range" min="1" max="5000" step="1"
                    className="w-full accent-rose-500 bg-slate-950 h-2.5 rounded-full appearance-none cursor-pointer border border-white/5"
                    value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} 
                  />
                </div>
              </div>
              
              <div className="mt-8 rounded-2xl bg-white/[0.03] p-4 border border-white/5 flex gap-3">
                <Info className="size-5 text-sky-400 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-slate-400 leading-normal">
                  Auto-Stop: Trading will immediately cease if your session profit hits <span className="text-emerald-400">+{takeProfit}</span> or if your loss exceeds <span className="text-rose-500">-{stopLoss}</span>.
                </p>
              </div>
            </section>
          </div>
        </main>

        {/* RIGHT SIDEBAR: PERFORMANCE PANEL */}
        <aside className="flex flex-col border-l border-white/10 bg-slate-900 shadow-2xl">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-16 bg-slate-950/50 border-b border-white/10 rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none data-[state=active]:bg-sky-500 data-[state=active]:text-white font-black text-xs uppercase tracking-widest text-slate-400 transition-all">
                <Activity className="size-4 mr-2" /> Performance
              </TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none data-[state=active]:bg-sky-500 data-[state=active]:text-white font-black text-xs uppercase tracking-widest text-slate-400 transition-all">
                <History className="size-4 mr-2" /> Live Logs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-8 space-y-8 overflow-y-auto">
              {/* Primary Stats */}
              <div className="grid grid-cols-1 gap-6">
                <div className="relative overflow-hidden rounded-3xl bg-slate-950 border-2 border-white/5 p-6 shadow-inner">
                  <div className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2">Total Net Profit</div>
                  <div className={cn("text-5xl font-black tracking-tighter tabular-nums", stats.profit >= 0 ? "text-emerald-400" : "text-rose-500")}>
                    {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                  </div>
                  <TrendingUp className={cn("absolute -bottom-4 -right-4 size-24 opacity-[0.03]", stats.profit >= 0 ? "text-emerald-400" : "text-rose-500")} />
                </div>
                
                <div className="rounded-3xl bg-slate-950 border-2 border-white/5 p-6 shadow-inner">
                  <div className="text-[11px] font-black uppercase text-slate-500 tracking-[0.2em] mb-2">Accuracy (Win Rate)</div>
                  <div className="text-5xl font-black tracking-tighter tabular-nums text-sky-400">
                    {winRate}%
                  </div>
                </div>
              </div>

              {/* Counts Breakdown */}
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-white/[0.03] p-5 border border-white/5">
                  <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total Cycles</span>
                  <span className="text-xl font-black text-white">{stats.runs}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-emerald-400/5 p-5 border border-emerald-400/10">
                  <span className="text-sm font-bold text-emerald-400/80 uppercase tracking-widest">Wins</span>
                  <span className="text-xl font-black text-emerald-400">{stats.wins}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-rose-500/5 p-5 border border-rose-500/10">
                  <span className="text-sm font-bold text-rose-500/80 uppercase tracking-widest">Losses</span>
                  <span className="text-xl font-black text-rose-500">{stats.losses}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                {!running ? (
                  <Button 
                    onClick={() => setRunning(true)} 
                    className="w-full h-20 rounded-[28px] text-xl font-black shadow-[0_20px_40px_-10px_rgba(14,165,233,0.4)] bg-sky-500 text-white hover:bg-sky-400 hover:scale-[1.02] active:scale-[0.98] transition-all" 
                    disabled={!token}
                  >
                    <Play className="mr-3 size-7 fill-current" /> START TRADING BOT
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setRunning(false)} 
                    variant="destructive" 
                    className="w-full h-20 rounded-[28px] text-xl font-black hover:bg-rose-500 bg-rose-600 shadow-[0_20px_40px_-10px_rgba(225,29,72,0.4)] transition-all"
                  >
                    <Square className="mr-3 size-6 fill-current" /> STOP STRATEGY
                  </Button>
                )}
                
                {!token && (
                  <div className="mt-6 flex items-start gap-3 rounded-2xl bg-rose-500/10 p-5 border border-rose-500/20">
                    <ShieldAlert className="size-5 text-rose-500 shrink-0 mt-0.5" /> 
                    <p className="text-xs font-bold text-rose-300 leading-tight">
                      Authentication Required. Please connect your Deriv account to enable trading.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 flex-1 flex flex-col p-4 bg-slate-950">
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {journal.map((j, i) => (
                  <div key={i} className={cn(
                    "p-4 rounded-2xl border-l-4 text-xs font-bold leading-relaxed shadow-sm",
                    j.type === 'error' ? "bg-rose-500/10 border-rose-600 text-rose-100" :
                    j.type === 'success' ? "bg-emerald-500/10 border-emerald-500 text-emerald-100" :
                    "bg-slate-900 border-sky-500 text-slate-100"
                  )}>
                    <div className="flex justify-between items-center opacity-60 mb-2 border-b border-white/5 pb-1">
                      <span className="uppercase tracking-tighter">Event Protocol</span>
                      <span className="font-mono">{j.time}</span>
                    </div>
                    <div className="font-mono leading-tight">{j.msg}</div>
                  </div>
                ))}
                {journal.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-700 py-20">
                    <Activity className="size-16 mb-4 animate-pulse opacity-10" />
                    <p className="text-sm font-black uppercase tracking-[0.3em] opacity-20">System Idle</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}