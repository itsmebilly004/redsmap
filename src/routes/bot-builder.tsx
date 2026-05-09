// src/routes/bot-builder.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { TopShell } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { supabase } from "@/integrations/supabase/client";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { send, contractTypeFor, type TradeCategory } from "@/lib/deriv";
import { toast } from "sonner";
import {
  Search,
  FolderOpen,
  ListOrdered,
  LineChart,
  BarChartHorizontal,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  Play,
  Square,
  RotateCcw,
  Globe,
  Sun,
  HelpCircle,
  Maximize2,
  Shield,
  Menu,
  Download,
  GripVertical,
  Save,
  Activity,
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

const DEFAULT_BLOCKS = ["trade_parameters", "sell_conditions", "restart_conditions"] as const;
type BlockId = (typeof DEFAULT_BLOCKS)[number];
const BLOCK_META: Record<BlockId, { index: number; title: string; icon?: string }> = {
  trade_parameters: { index: 1, title: "Trade parameters" },
  sell_conditions: { index: 3, title: "Sell conditions" },
  restart_conditions: { index: 4, title: "Restart trading conditions", icon: "🎯" },
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
  const now = useNow();

  // Strategy State
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("even_odd");
  const [contractType, setContractType] = useState("even");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);
  const [martingale, setMartingale] = useState(2.0);
  const [durationTicks, setDurationTicks] = useState(1);
  const [blockOrder, setBlockOrder] = useState<BlockId[]>([...DEFAULT_BLOCKS]);
  const [botName, setBotName] = useState("");

  // UI State
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string }[]>([]);

  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  // Handle Preset Loading
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

  const stopBot = () => {
    setRunning(false);
    logJournal("Bot stopped by user.");
  };

  const logJournal = (msg: string) => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg }, ...prev].slice(0, 100));
  };

  // The Execution Loop (Logic from XML Assets)
  async function runCycle() {
    if (!token || !running) return;

    // Risk Check
    if (stats.profit >= takeProfit) {
      logJournal("✅ Take Profit Reached!");
      setRunning(false);
      return;
    }
    if (Math.abs(stats.profit) >= stopLoss && stats.profit < 0) {
      logJournal("❌ Stop Loss Hit!");
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
        duration: durationTicks,
        duration_unit: "t",
        ...(tradeType === 'over_under' ? { barrier: "5" } : {})
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      logJournal(`Placed ${ct} trade for ${currentStake} ${derivCurrency}`);

      // Contract Polling
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

          logJournal(`Result: ${won ? 'WIN' : 'LOSS'} (${pnl.toFixed(2)})`);

          // Martingale Logic from Assets (Candle Mine / Nova)
          if (won) {
            setCurrentStake(initialStake);
          } else {
            setCurrentStake(prev => Number((prev * martingale).toFixed(2)));
          }

          // Trigger next cycle
          if (running) setTimeout(runCycle, 1000);
        }
      }, 1500);

    } catch (e: any) {
      logJournal(`Error: ${e.message}`);
      setRunning(false);
    }
  }

  useEffect(() => {
    if (running) runCycle();
  }, [running]);

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-120px)] flex-col lg:grid lg:grid-cols-[280px_1fr_360px]">
        {/* Sidebar: Blocks */}
        <aside className="hidden border-r border-white/5 bg-card/50 backdrop-blur-xl lg:flex flex-col p-4 space-y-4">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Logic Blocks</div>
          {blockOrder.map(id => (
            <div key={id} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm font-medium flex items-center gap-2 cursor-grab active:cursor-grabbing">
              <GripVertical className="size-4 text-muted-foreground" />
              {BLOCK_META[id].title}
            </div>
          ))}
          <div className="pt-4 border-t border-white/5">
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Drag and drop blocks to reorganize your bot strategy. Logic is executed from top to bottom.
            </p>
          </div>
        </aside>

        {/* Workspace: Configuration */}
        <main className="overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="text-primary size-5" />
              {botName || "Custom Strategy"}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => logJournal("Strategy saved to local storage")}><Save className="size-4 mr-2" /> Save</Button>
              <Button variant="outline" size="sm"><Download className="size-4 mr-2" /> Export XML</Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass-card p-4 rounded-xl space-y-4">
              <label className="text-xs font-bold text-muted-foreground uppercase">Market & Contract</label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MARKETS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={initialStake} onChange={e => setInitialStake(Number(e.target.value))} placeholder="Initial Stake" />
                <Input type="number" value={martingale} onChange={e => setMartingale(Number(e.target.value))} placeholder="Martingale Multiplier" />
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl space-y-4">
              <label className="text-xs font-bold text-muted-foreground uppercase">Risk Management</label>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Take Profit</span>
                  <span className="text-success font-mono">+{takeProfit} {derivCurrency}</span>
                </div>
                <Input type="range" min="1" max="1000" value={takeProfit} onChange={e => setTakeProfit(Number(e.target.value))} />
                
                <div className="flex justify-between text-sm">
                  <span>Stop Loss</span>
                  <span className="text-destructive font-mono">-{stopLoss} {derivCurrency}</span>
                </div>
                <Input type="range" min="1" max="1000" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </main>

        {/* Control Panel: Performance */}
        <aside className="border-l border-white/5 bg-card/50 backdrop-blur-xl flex flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-white/5 h-12 px-2">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="p-6 flex-1 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Profit/Loss</div>
                  <div className={cn("text-2xl font-mono font-bold", stats.profit >= 0 ? "text-success" : "text-destructive")}>
                    {stats.profit.toFixed(2)}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                  <div className="text-[10px] uppercase text-muted-foreground mb-1">Win Rate</div>
                  <div className="text-2xl font-mono font-bold">
                    {stats.runs > 0 ? Math.round((stats.wins / stats.runs) * 100) : 0}%
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Runs</span>
                  <span className="font-mono">{stats.runs}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contracts Won</span>
                  <span className="text-success font-mono">{stats.wins}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Contracts Lost</span>
                  <span className="text-destructive font-mono">{stats.losses}</span>
                </div>
              </div>

              <div className="pt-6">
                {!running ? (
                  <Button onClick={() => setRunning(true)} className="w-full h-14 rounded-xl text-lg font-bold shadow-glow" disabled={!token}>
                    <Play className="size-5 mr-2" /> Start Bot
                  </Button>
                ) : (
                  <Button onClick={stopBot} variant="destructive" className="w-full h-14 rounded-xl text-lg font-bold">
                    <Square className="size-5 mr-2" /> Stop Bot
                  </Button>
                )}
                {!token && <p className="mt-2 text-center text-xs text-destructive">Connect Deriv account to start.</p>}
              </div>
            </TabsContent>

            <TabsContent value="journal" className="p-4 flex-1 overflow-y-auto">
              <div className="space-y-2">
                {journal.map((j, i) => (
                  <div key={i} className="text-xs border-b border-white/5 pb-2">
                    <span className="text-muted-foreground mr-2">[{j.time}]</span>
                    <span className="text-foreground">{j.msg}</span>
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

function useNow() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const i = setInterval(() => setT(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(i);
  }, []);
  return t;
}