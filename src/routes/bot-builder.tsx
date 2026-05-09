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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { send, contractTypeFor, type TradeCategory } from "@/lib/deriv";
import { toast } from "sonner";
import {
  FolderOpen,
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
  trade_parameters: { title: "Trade Parameters", icon: Settings2, color: "text-blue-400" },
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

  const { account: derivAccount, currency: derivCurrency, balance } = useDerivBalanceContext();
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
      logJournal(`Executing ${ct} for ${currentStake} ${derivCurrency}...`);

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

          logJournal(`${won ? '🏆 Won' : '📉 Lost'} trade: ${pnl.toFixed(2)} ${derivCurrency}`, won ? 'success' : 'error');

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
      <div className="flex h-[calc(100vh-64px)] flex-col lg:grid lg:grid-cols-[260px_1fr_380px]">
        
        {/* LEFT: LOGIC BLOCKS SIDEBAR */}
        <aside className="hidden flex-col border-r border-white/5 bg-background/40 backdrop-blur-xl lg:flex">
          <div className="p-4 flex items-center gap-2 text-muted-foreground">
            <Layers className="size-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Logic Workspace</span>
          </div>
          
          <div className="flex-1 space-y-2 p-3">
            {(Object.keys(BLOCK_META) as BlockId[]).map((id) => {
              const meta = BLOCK_META[id];
              return (
                <div key={id} className="group flex cursor-grab items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3 transition hover:bg-white/[0.06] active:cursor-grabbing">
                  <div className={cn("rounded-lg bg-white/5 p-2", meta.color)}>
                    <meta.icon className="size-4" />
                  </div>
                  <span className="text-xs font-medium">{meta.title}</span>
                  <GripVertical className="ml-auto size-3 opacity-0 group-hover:opacity-40" />
                </div>
              );
            })}
            
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-4 text-center">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Drag blocks from the menu to add custom analysis or purchase triggers.
              </p>
            </div>
          </div>
        </aside>

        {/* CENTER: WORKSPACE */}
        <main className="flex flex-1 flex-col overflow-y-auto bg-gradient-to-b from-white/[0.02] to-transparent p-6">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-glow">
                <Activity className="size-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{botName}</h1>
                <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                  <span className="text-emerald-400">● Live Ticks</span>
                  <ChevronRight className="size-3" />
                  <span>{MARKETS[symbol as keyof typeof MARKETS]}</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="rounded-lg h-9">
                <Save className="mr-2 size-4" /> Save
              </Button>
              <Button variant="outline" size="sm" className="rounded-lg h-9 border-white/10 bg-white/5">
                <Download className="mr-2 size-4" /> Export XML
              </Button>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Market & Stake Card */}
            <section className="glass-card rounded-3xl p-6 shadow-card">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                  <Wallet className="size-4 text-blue-400" /> Market & Stake
                </h3>
                <Info className="size-4 text-white/20" />
              </div>
              
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground ml-1">Asset Index</Label>
                  <Select value={symbol} onValueChange={setSymbol}>
                    <SelectTrigger className="h-12 rounded-xl bg-white/[0.03] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(MARKETS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground ml-1">Base Stake</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={initialStake} 
                        onChange={e => setInitialStake(Number(e.target.value))}
                        className="h-12 rounded-xl bg-white/[0.03] border-white/10 pl-10 font-mono"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground ml-1">Martingale</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        value={martingale} 
                        onChange={e => setMartingale(Number(e.target.value))}
                        className="h-12 rounded-xl bg-white/[0.03] border-white/10 pl-10 font-mono"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">x</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Risk Management Card */}
            <section className="glass-card rounded-3xl p-6 shadow-card">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-sm font-bold flex items-center gap-2 uppercase tracking-wide text-muted-foreground">
                  <ShieldAlert className="size-4 text-orange-400" /> Safety Rails
                </h3>
                <Settings2 className="size-4 text-white/20" />
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="uppercase text-muted-foreground">Take Profit</span>
                    <span className="font-mono text-emerald-400">+{takeProfit} {derivCurrency}</span>
                  </div>
                  <input 
                    type="range" min="1" max="1000" step="0.5"
                    className="w-full accent-emerald-500 bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer"
                    value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} 
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="uppercase text-muted-foreground">Max. Stop Loss</span>
                    <span className="font-mono text-rose-400">-{stopLoss} {derivCurrency}</span>
                  </div>
                  <input 
                    type="range" min="1" max="1000" step="0.5"
                    className="w-full accent-rose-500 bg-white/5 h-1.5 rounded-lg appearance-none cursor-pointer"
                    value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} 
                  />
                </div>
              </div>
              
              <div className="mt-6 rounded-xl bg-white/[0.02] p-3 text-[10px] text-muted-foreground leading-relaxed">
                <Info className="size-3 inline mr-1 mb-0.5" />
                The bot will automatically halt all trading activities once either threshold is crossed within the current session.
              </div>
            </section>
          </div>
        </main>

        {/* RIGHT: PERFORMANCE PANEL */}
        <aside className="flex flex-col border-l border-white/5 bg-background/40 backdrop-blur-xl">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-14 bg-white/5 border-b border-white/5 rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none data-[state=active]:bg-white/5 font-bold text-xs uppercase tracking-widest">Dashboard</TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none data-[state=active]:bg-white/5 font-bold text-xs uppercase tracking-widest">Live Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-6 space-y-6">
              {/* Main Metric Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Profit / Loss</div>
                  <div className={cn("text-3xl font-mono font-bold mt-1", stats.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {stats.profit.toFixed(2)}
                  </div>
                  <div className={cn("absolute -bottom-2 -right-2 size-12 opacity-10", stats.profit >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    <TrendingUp className="h-full w-full" />
                  </div>
                </div>
                
                <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Win Rate</div>
                  <div className="text-3xl font-mono font-bold mt-1 text-blue-400">
                    {winRate}%
                  </div>
                </div>
              </div>

              {/* Detail Stats */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Total Trade Cycles</span>
                  <span className="font-mono font-bold">{stats.runs}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Successful Trades</span>
                  <span className="text-emerald-400 font-mono font-bold">{stats.wins}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white/[0.02] px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Failed Trades</span>
                  <span className="text-rose-400 font-mono font-bold">{stats.losses}</span>
                </div>
              </div>

              {/* Dynamic Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  <span>Session Intensity</span>
                  <span>{stats.runs}/100 Trades</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                   <div 
                    className="h-full bg-primary shadow-glow transition-all duration-500" 
                    style={{ width: `${Math.min(stats.runs, 100)}%` }} 
                   />
                </div>
              </div>

              <div className="pt-6">
                {!running ? (
                  <Button 
                    onClick={() => setRunning(true)} 
                    className="w-full h-16 rounded-2xl text-lg font-bold shadow-glow-primary bg-primary text-primary-foreground hover:scale-[1.02] transition-transform" 
                    disabled={!token}
                  >
                    <Play className="mr-2 size-6 fill-current" /> Start Trading Bot
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setRunning(false)} 
                    variant="destructive" 
                    className="w-full h-16 rounded-2xl text-lg font-bold hover:scale-[1.02] transition-transform"
                  >
                    <Square className="mr-2 size-5 fill-current" /> Stop Strategy
                  </Button>
                )}
                {!token && (
                  <p className="mt-4 text-center text-xs text-rose-400 bg-rose-400/10 p-3 rounded-lg border border-rose-400/20">
                    <ShieldAlert className="size-3 inline mr-1" /> No Deriv session found. Please link your account.
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 flex-1 flex flex-col p-4">
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {journal.map((j, i) => (
                  <div key={i} className={cn(
                    "p-3 rounded-xl border text-[11px] font-mono leading-relaxed",
                    j.type === 'error' ? "bg-rose-500/5 border-rose-500/20 text-rose-300" :
                    j.type === 'success' ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-300" :
                    "bg-white/[0.02] border-white/5 text-muted-foreground"
                  )}>
                    <div className="flex justify-between opacity-50 mb-1">
                      <span>Log Event</span>
                      <span>{j.time}</span>
                    </div>
                    <div className="text-foreground">{j.msg}</div>
                  </div>
                ))}
                {journal.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-20 py-20">
                    <Activity className="size-12 mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Awaiting Live Feed</p>
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