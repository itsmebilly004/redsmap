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
  Search,
  ChevronDown,
  Trash2,
  FolderOpen,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Plus,
  CloudCheck,
  RefreshCw,
  LayoutGrid,
  TrendingUp,
  Target,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_PRESETS } from "./trading-bots";

export const Route = createFileRoute("/bot-builder")({
  validateSearch: z.object({ preset: z.string().optional() }),
  component: BotBuilder,
});

const MARKETS: Record<string, string> = {
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
  const [botId, setBotId] = useState<string | null>(null);
  const [botName, setBotName] = useState("My Deriv Bot");
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("rise_fall");
  const [contractType, setContractType] = useState("both");
  
  const [initialStake, setInitialStake] = useState(0.35);
  const [currentStake, setCurrentStake] = useState(0.35);
  const [martingale, setMartingale] = useState(2.0);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  const [cooldown, setCooldown] = useState(1); // Added missing cooldown state
  
  // Manual Limits
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);

  // --- UI / RUNTIME STATE ---
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("saved");
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0, stake: 0, payout: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string; type?: string }[]>([]);

  // SYNC FIX: Update currentStake when initialStake changes while bot is idle
  useEffect(() => {
    if (!running) {
      setCurrentStake(initialStake);
    }
  }, [initialStake, running]);

  // 1. Handle Presets
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
        if (config.tradeType) setTradeType(config.tradeType as TradeCategory);
      }
    }
  }, [preset]);

  // 2. Real-time Auto-Save (Fixed Infinite Loop)
  useEffect(() => {
    if (!user) return;
    
    const performSave = async () => {
      setSaveStatus("saving");
      const { data, error } = await supabase.from("bots").upsert({
        id: botId || undefined, // Use existing ID if available
        user_id: user.id,
        name: botName,
        strategy: { symbol, tradeType, contractType, initialStake, martingale, duration, durationUnit, stopLoss, takeProfit, cooldown },
        status: running ? "running" : "stopped"
      }).select("id").single();

      if (!error && data) {
        // Only update botId if it was previously null to prevent re-triggering this effect
        if (!botId) setBotId(data.id);
        setSaveStatus("saved");
      } else {
        setSaveStatus("idle");
      }
    };

    const timeoutId = setTimeout(performSave, 2000);
    return () => clearTimeout(timeoutId);
    // Removed botId from dependencies to prevent loop
  }, [botName, symbol, tradeType, contractType, initialStake, martingale, duration, durationUnit, stopLoss, takeProfit, user, running, cooldown]);

  // 3. Execution Logic
  const logJournal = (msg: string, type = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const toggleBot = () => {
    if (!token) return toast.error("Connect Deriv first.");
    const next = !running;
    setRunning(next);
    runningRef.current = next;
    if (next) {
      logJournal("▶️ Bot execution initiated", "success");
      runCycle();
    } else {
      logJournal("⏹️ Bot execution stopped", "error");
    }
  };

  async function runCycle() {
    if (!token || !runningRef.current) return;

    if (stats.profit >= takeProfit) {
      logJournal(`🎯 Take Profit reached!`, "success");
      setRunning(false);
      runningRef.current = false;
      return;
    }
    if (stats.profit <= -stopLoss) {
      logJournal(`🛑 Stop Loss reached!`, "error");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      await send({ authorize: token });
      const ct = contractTypeFor(tradeType, contractType === 'both' ? 'up' : contractType);
      
      const proposal = await send({
        proposal: 1, amount: currentStake, basis: "stake", contract_type: ct,
        currency: derivCurrency, symbol: symbol, duration: duration, duration_unit: durationUnit
      });

      const buy = await send({ buy: proposal.proposal.id, price: currentStake });
      
      const poll = setInterval(async () => {
        if (!runningRef.current) { clearInterval(poll); return; }
        const res = await send({ proposal_open_contract: 1, contract_id: buy.buy.contract_id });
        const c = res.proposal_open_contract;
        
        if (c.is_sold) {
          clearInterval(poll);
          const pnl = Number(c.profit);
          const won = pnl > 0;

          setStats(s => ({ 
            runs: s.runs + 1, wins: s.wins + (won ? 1 : 0), losses: s.losses + (won ? 0 : 1), 
            profit: s.profit + pnl, stake: s.stake + currentStake, payout: s.payout + Number(c.payout)
          }));

          logJournal(`${won ? 'WIN' : 'LOSS'}: ${pnl.toFixed(2)}`, won ? 'success' : 'error');

          if (won) setCurrentStake(initialStake);
          else setCurrentStake(prev => Number((prev * martingale).toFixed(2)));

          if (runningRef.current) setTimeout(runCycle, cooldown * 1000);
        }
      }, 1500);

    } catch (e: any) {
      logJournal(`Error: ${e.message}`, 'error');
      setRunning(false);
      runningRef.current = false;
    }
  }

  return (
    <TopShell>
      <div className="flex h-[calc(100vh-64px)] flex-col lg:flex-row bg-[#f2f3f4] overflow-hidden text-[#333]">
        
        <aside className="w-full lg:w-[280px] bg-white border-r border-[#e5e5e5] flex flex-col shrink-0">
          <div className="p-3">
            <Button className="w-full bg-[#ff444f] hover:bg-[#eb3e48] text-white font-bold h-11 rounded-md text-sm">
              Quick strategy
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
             <div className="px-4 py-2.5 flex items-center justify-between border-b border-[#f2f3f4]">
                <span className="text-sm font-bold">Blocks menu</span>
                <ChevronDown className="size-4" />
             </div>
             <div className="p-3">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input placeholder="Search" className="pl-9 h-10 border-[#e5e5e5] bg-[#f2f3f4]/40 text-sm" />
                </div>
                <div className="space-y-0.5">
                  {["Trade parameters", "Purchase conditions", "Sell conditions (optional)", "Restart trading conditions", "Analysis", "Utility"].map((item) => (
                    <div key={item} className="px-3 py-2.5 text-sm font-medium hover:bg-[#f2f3f4] rounded-md cursor-pointer flex justify-between items-center group transition-colors">
                      {item}
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-14 bg-white border-b border-[#e5e5e5] flex items-center px-4 justify-between">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              <ToolbarBtn icon={RefreshCw} />
              <ToolbarBtn icon={FolderOpen} />
              <ToolbarBtn icon={Save} />
              <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
              <ToolbarBtn icon={LayoutGrid} />
              <ToolbarBtn icon={TrendingUp} />
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
               {saveStatus === "saving" ? (
                 <><RefreshCw className="size-3 text-blue-500 animate-spin" /><span className="text-[10px] font-black uppercase text-blue-600">Syncing</span></>
               ) : (
                 <><CloudCheck className="size-3.5 text-emerald-500" /><span className="text-[10px] font-black uppercase text-emerald-600">Saved</span></>
               )}
            </div>
          </div>

          <div className="flex-1 p-8 overflow-auto bg-[#f2f3f4]">
            <div className="flex flex-col gap-8 items-start pb-32">
              
              <div className="w-full max-w-2xl bg-white border border-[#e5e5e5] rounded shadow-md overflow-hidden">
                <div className="bg-[#064e6e] px-4 py-2.5 flex items-center justify-between text-white text-[13px] font-bold">
                  <div className="flex items-center gap-2"><Plus className="size-3" /> 1. Trade parameters</div>
                </div>
                <div className="p-5 space-y-5 text-[12px]">
                   <div className="flex flex-wrap items-center gap-3">
                      <span className="text-slate-500">Market:</span>
                      <InlineSelect value={symbol} options={Object.keys(MARKETS)} labels={MARKETS} onChange={setSymbol} />
                   </div>
                   
                   <div className="pt-4 border-t border-[#f2f3f4] grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-500 font-bold">Duration:</Label>
                          <div className="flex gap-1.5 items-center">
                            <InlineSelect value={durationUnit} options={["t", "s", "m"]} labels={{t: "Ticks", s: "Sec", m: "Min"}} onChange={setDurationUnit} />
                            <Input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="w-16 h-8 text-center" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-500 font-bold">Stake (USD):</Label>
                          <Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="w-24 h-8" />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-slate-500 font-bold">Martingale:</Label>
                          <Input type="number" value={martingale} onChange={e=>setMartingale(Number(e.target.value))} className="w-24 h-8" />
                        </div>
                      </div>

                      <div className="space-y-4 border-l border-slate-100 pl-8">
                        <div className="flex items-center justify-between">
                          <Label className="text-emerald-600 font-bold uppercase text-[10px]">Take Profit:</Label>
                          <Input type="number" value={takeProfit} onChange={e=>setTakeProfit(Number(e.target.value))} className="w-24 h-8 text-emerald-600" />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-red-600 font-bold uppercase text-[10px]">Stop Loss:</Label>
                          <Input type="number" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))} className="w-24 h-8 text-red-600" />
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              <div className="w-[320px] bg-white border border-[#e5e5e5] rounded shadow-md overflow-hidden">
                <div className="bg-[#064e6e] px-4 py-2.5 text-white text-[13px] font-bold flex gap-2 items-center">
                   <Target className="size-3" /> 2. Purchase conditions
                </div>
                <div className="p-5">
                   <div className="flex items-center gap-3">
                      <span className="text-slate-500">Purchase</span>
                      <InlineSelect value="Rise" options={["Rise", "Fall"]} />
                   </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-full lg:w-[380px] bg-white border-l border-[#e5e5e5] flex flex-col shrink-0">
          <div className="p-5 border-b border-[#e5e5e5] flex items-center justify-between gap-4">
            <button 
              onClick={toggleBot} 
              className={cn(
                "h-11 px-8 font-black rounded text-sm flex items-center justify-center gap-3 transition-all shadow-sm w-32",
                running ? "bg-[#ff444f] text-white" : "bg-[#4bb4b3] text-white"
              )}
            >
              {running ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              {running ? "Stop" : "Run"}
            </button>
            
            <div className="flex-1">
               <div className="text-[11px] font-bold text-[#333] mb-1.5 text-center uppercase tracking-tighter">
                 {running ? "Bot is operational" : "Bot is not running"}
               </div>
               <div className="h-1.5 w-full bg-[#f2f3f4] rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", running ? "bg-[#4bb4b3] w-full" : "w-0")} />
               </div>
            </div>
          </div>

          <Tabs defaultValue="summary" className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3 h-12 bg-white border-b border-[#e5e5e5] rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] text-[11px] font-bold uppercase">Summary</TabsTrigger>
              <TabsTrigger value="history" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] text-[11px] font-bold uppercase">History</TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] text-[11px] font-bold uppercase">Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-8 flex flex-col justify-between overflow-hidden">
              {stats.runs === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center">
                  <p className="text-sm text-slate-400 leading-relaxed font-medium">
                    Hit Run to start tracking.
                  </p>
                </div>
              ) : (
                <div className="space-y-10">
                   <div className="grid grid-cols-3 gap-x-4 gap-y-10 text-center">
                      <StatItem label="Total stake" value={`${stats.stake.toFixed(2)}`} />
                      <StatItem label="Total payout" value={`${stats.payout.toFixed(2)}`} />
                      <StatItem label="No. of runs" value={String(stats.runs)} />
                      <StatItem label="Losses" value={String(stats.losses)} color="text-red-500" />
                      <StatItem label="Wins" value={String(stats.wins)} color="text-[#4bb4b3]" />
                      <StatItem label="Profit/loss" value={`${stats.profit.toFixed(2)}`} color={stats.profit >= 0 ? "text-[#4bb4b3]" : "text-red-500"} />
                   </div>
                </div>
              )}

              <div className="pt-8 border-t border-[#f2f3f4]">
                <Button 
                  variant="outline" 
                  onClick={() => setStats({runs:0, wins:0, losses:0, profit:0, stake:0, payout:0})} 
                  className="w-full border-[#e5e5e5] font-bold text-[#333] h-12 rounded"
                >
                  Reset Performance
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 flex-1 overflow-y-auto p-5 space-y-3 bg-[#f8f9fa]">
              {journal.map((j, i) => (
                <div key={i} className="text-[11px] font-semibold text-slate-600 flex gap-3 border-b border-black/5 pb-2">
                   <span className="shrink-0 text-slate-400 font-mono">{j.time}</span>
                   <span className={cn(j.type === 'success' ? "text-teal-600" : j.type === 'error' ? "text-rose-600" : "")}>
                     {j.msg}
                   </span>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}

function ToolbarBtn({ icon: Icon, onClick }: { icon: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="p-2.5 hover:bg-[#f2f3f4] rounded transition-colors text-slate-500 hover:text-slate-900">
      <Icon className="size-4" />
    </button>
  );
}

function InlineSelect({ value, options, labels, onChange }: { value: string; options: string[]; labels?: any; onChange?: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-fit bg-white border-[#e5e5e5] rounded px-3 text-[12px] font-bold gap-2 shadow-sm">
        <SelectValue>{labels?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white border-[#e5e5e5]">
        {options.map(o => <SelectItem key={o} value={o} className="text-xs font-bold">{labels?.[o] ?? o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function StatItem({ label, value, color = "text-[#333]" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
      <span className={cn("text-[14px] font-black tabular-nums", color)}>{value}</span>
    </div>
  );
}