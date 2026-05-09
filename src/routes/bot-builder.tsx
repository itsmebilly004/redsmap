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
  Maximize2,
  ExternalLink,
  Plus,
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
  const [botName, setBotName] = useState("My Deriv Bot");
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("rise_fall");
  const [contractType, setContractType] = useState("both");
  
  const [initialStake, setInitialStake] = useState(0.35);
  const [currentStake, setCurrentStake] = useState(0.35);
  const [martingale, setMartingale] = useState(2.0);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  
  const [stopLoss, setStopLoss] = useState(50);
  const [takeProfit, setTakeProfit] = useState(50);

  // --- RUNTIME STATE ---
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0, stake: 0, payout: 0 });
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
      }
    }
  }, [preset]);

  const logJournal = (msg: string, type = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const toggleBot = () => {
    if (!token) return toast.error("Connect Deriv first.");
    const next = !running;
    setRunning(next);
    runningRef.current = next;
    if (next) {
      logJournal("▶️ Bot started", "success");
      runCycle();
    } else {
      logJournal("⏹️ Bot stopped", "error");
    }
  };

  async function runCycle() {
    if (!token || !runningRef.current) return;

    if (stats.profit >= takeProfit || stats.profit <= -stopLoss) {
      logJournal("🏁 Target Reached. Halting.", "info");
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
            runs: s.runs + 1, 
            wins: s.wins + (won ? 1 : 0), 
            losses: s.losses + (won ? 0 : 1), 
            profit: s.profit + pnl,
            stake: s.stake + currentStake,
            payout: s.payout + Number(c.payout)
          }));

          logJournal(`${won ? 'WIN' : 'LOSS'}: ${pnl.toFixed(2)} ${derivCurrency}`, won ? 'success' : 'error');

          if (won) setCurrentStake(initialStake);
          else setCurrentStake(prev => Number((prev * martingale).toFixed(2)));

          if (runningRef.current) setTimeout(runCycle, 1000);
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
      <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row bg-[#f2f3f4] overflow-hidden">
        
        {/* --- LEFT SIDEBAR (Blocks Menu) --- */}
        <aside className="w-full lg:w-[280px] bg-white border-r border-[#e5e5e5] flex flex-col shrink-0">
          <div className="p-3">
            <Button className="w-full bg-[#ff444f] hover:bg-[#eb3e48] text-white font-bold h-10 rounded-md">
              Quick strategy
            </Button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
             <div className="px-4 py-2 flex items-center justify-between border-b border-[#f2f3f4]">
                <span className="text-sm font-bold text-[#333]">Blocks menu</span>
                <ChevronDown className="size-4 text-[#333]" />
             </div>
             
             <div className="p-3">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input placeholder="Search" className="pl-9 h-9 border-[#e5e5e5] bg-[#f2f3f4]/50 text-sm" />
                </div>
                
                <div className="space-y-1">
                  {["Trade parameters", "Purchase conditions", "Sell conditions (optional)", "Restart trading conditions", "Analysis", "Utility"].map((item) => (
                    <div key={item} className="px-3 py-2 text-sm font-medium text-[#333] hover:bg-[#f2f3f4] rounded-md cursor-pointer flex justify-between items-center group">
                      {item}
                      {(item === "Analysis" || item === "Utility") && <ChevronDown className="size-3 text-slate-400" />}
                    </div>
                  ))}
                </div>
             </div>
          </div>
        </aside>

        {/* --- CENTER WORKSPACE (Visual Blocks) --- */}
        <main className="flex-1 flex flex-col min-w-0 relative">
          {/* Workspace Toolbar */}
          <div className="h-14 bg-white border-b border-[#e5e5e5] flex items-center px-4 gap-1 overflow-x-auto scrollbar-hide">
            <ToolbarBtn icon={RotateCcw} />
            <ToolbarBtn icon={FolderOpen} />
            <ToolbarBtn icon={Save} onClick={() => toast.success("Saved")} />
            <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
            <ToolbarBtn icon={Undo2} />
            <ToolbarBtn icon={Redo2} />
            <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
            <ToolbarBtn icon={ZoomIn} />
            <ToolbarBtn icon={ZoomOut} />
          </div>

          <div className="flex-1 p-6 overflow-auto custom-scrollbar relative">
            <div className="flex flex-col gap-6 items-start pb-20">
              
              {/* Block 1: Trade Parameters */}
              <div className="w-full max-w-2xl bg-white border border-[#e5e5e5] rounded shadow-sm overflow-hidden">
                <div className="bg-[#064e6e] px-4 py-2 flex items-center gap-2 text-white text-sm font-bold">
                  <Plus className="size-3" /> 1. Trade parameters
                </div>
                <div className="p-4 space-y-4 text-[13px]">
                   <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[#666]">Market:</span>
                      <InlineSelect value="Derived" options={["Derived"]} />
                      <span className="text-slate-300">&gt;</span>
                      <InlineSelect value="Continuous Indices" options={["Continuous Indices"]} />
                      <span className="text-slate-300">&gt;</span>
                      <InlineSelect value={symbol} options={Object.keys(MARKETS)} labels={MARKETS} onChange={setSymbol} />
                   </div>

                   <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[#666]">Trade Type:</span>
                      <InlineSelect value="Up/Down" options={["Up/Down"]} />
                      <span className="text-slate-300">&gt;</span>
                      <InlineSelect value="Rise/Fall" options={["Rise/Fall"]} />
                   </div>

                   <div className="flex items-center gap-2">
                      <span className="text-[#666]">Contract Type:</span>
                      <InlineSelect value={contractType} options={["both", "up", "down"]} onChange={setContractType} />
                   </div>

                   <div className="pt-2 border-t border-[#f2f3f4] space-y-3">
                      <div className="flex items-center gap-4">
                        <Label className="text-[#666] w-24">Duration:</Label>
                        <div className="flex gap-1 items-center">
                          <InlineSelect value={durationUnit} options={["t", "s", "m"]} labels={{t: "Ticks", s: "Seconds", m: "Minutes"}} onChange={setDurationUnit} />
                          <Input type="number" value={duration} onChange={e=>setDuration(Number(e.target.value))} className="w-16 h-8 text-center" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Label className="text-[#666] w-24">Stake:</Label>
                        <div className="flex gap-1 items-center">
                           <span className="text-xs font-bold text-slate-400">USD</span>
                           <Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="w-24 h-8" />
                           <span className="text-[10px] text-slate-400 ml-2">(min: 0.35 - max: 50000)</span>
                        </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Block 2: Purchase Conditions */}
              <div className="w-[300px] bg-white border border-[#e5e5e5] rounded shadow-sm overflow-hidden">
                <div className="bg-[#064e6e] px-4 py-2 text-white text-sm font-bold flex gap-2 items-center">
                   <Target className="size-3" /> 2. Purchase conditions
                </div>
                <div className="p-4">
                   <div className="flex items-center gap-2">
                      <span className="text-[13px] text-[#666]">Purchase</span>
                      <InlineSelect value="Rise" options={["Rise", "Fall"]} />
                   </div>
                </div>
              </div>

              {/* Block 4: Restart Conditions */}
              <div className="w-[350px] bg-white border border-[#e5e5e5] rounded shadow-sm overflow-hidden">
                <div className="bg-[#064e6e] px-4 py-2 text-white text-sm font-bold flex gap-2 items-center">
                   <RotateCcw className="size-3" /> 4. Restart trading conditions
                </div>
                <div className="p-4">
                   <div className="bg-[#f2f3f4] px-3 py-2 rounded text-[13px] font-medium text-[#333]">
                      Trade again
                   </div>
                </div>
              </div>
            </div>

            {/* Floating Trash */}
            <div className="absolute bottom-10 right-10 flex flex-col items-center gap-2">
               <div className="size-16 bg-[#e5e5e5] rounded-lg flex items-center justify-center text-slate-400">
                  <Trash2 className="size-8" />
               </div>
            </div>
          </div>
        </main>

        {/* --- RIGHT SIDEBAR (Performance & Controls) --- */}
        <aside className="w-full lg:w-[350px] bg-white border-l border-[#e5e5e5] flex flex-col shrink-0">
          {/* Run Header */}
          <div className="p-4 border-b border-[#e5e5e5] bg-[#f8f9fa] flex items-center justify-between">
            <Button 
              onClick={toggleBot} 
              className={cn(
                "h-10 px-6 font-bold rounded shadow-sm flex items-center gap-2 transition-all",
                running ? "bg-[#ff444f] hover:bg-[#eb3e48] text-white" : "bg-[#4bb4b3] hover:bg-[#3da1a0] text-white"
              )}
            >
              {running ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              {running ? "Stop" : "Run"}
            </Button>
            
            <div className="flex-1 ml-4">
               <div className="text-[11px] font-bold text-[#666] mb-1 text-center">
                 {running ? "Bot is running" : "Bot is not running"}
               </div>
               <div className="h-1.5 w-full bg-[#e5e5e5] rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-1000", running ? "bg-[#4bb4b3] w-full" : "w-0")} />
               </div>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-3 h-12 bg-white border-b border-[#e5e5e5] rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent font-bold text-xs">Summary</TabsTrigger>
              <TabsTrigger value="transactions" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent font-bold text-xs">Transactions</TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent font-bold text-xs">Journal</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 flex flex-col p-6 space-y-8">
              {stats.runs === 0 ? (
                <div className="flex-1 flex items-center justify-center text-center px-4">
                  <p className="text-sm text-[#999] leading-relaxed">
                    When you're ready to trade, hit <span className="font-bold text-[#333]">Run</span>.<br />
                    You'll be able to track your bot's performance here.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                   <div className="grid grid-cols-3 gap-y-6 text-center">
                      <StatItem label="Total stake" value={`${stats.stake.toFixed(2)} USD`} />
                      <StatItem label="Total payout" value={`${stats.payout.toFixed(2)} USD`} />
                      <StatItem label="No. of runs" value={String(stats.runs)} />
                      <StatItem label="Contracts lost" value={String(stats.losses)} color="text-red-500" />
                      <StatItem label="Contracts won" value={String(stats.wins)} color="text-green-500" />
                      <StatItem label="Total profit/loss" value={`${stats.profit.toFixed(2)} USD`} color={stats.profit >= 0 ? "text-green-500" : "text-red-500"} />
                   </div>
                </div>
              )}

              <div className="pt-6 border-t border-[#f2f3f4]">
                <Button 
                  variant="outline" 
                  onClick={() => { setStats({runs:0, wins:0, losses:0, profit:0, stake:0, payout:0}); logJournal("Reset performed"); }} 
                  className="w-full border-[#e5e5e5] font-bold text-[#333] h-11"
                >
                  Reset
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="journal" className="m-0 flex-1 overflow-y-auto p-4 space-y-2 bg-[#f8f9fa]">
              {journal.map((j, i) => (
                <div key={i} className="text-[11px] font-medium text-[#666] flex gap-2">
                   <span className="shrink-0 text-[#999]">{j.time}</span>
                   <span className={cn(j.type === 'success' ? "text-green-600" : j.type === 'error' ? "text-red-600" : "")}>
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

// --- SUB-COMPONENTS ---

function ToolbarBtn({ icon: Icon, onClick }: { icon: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="p-2 hover:bg-[#f2f3f4] rounded transition-colors text-slate-500 hover:text-[#333]">
      <Icon className="size-4" />
    </button>
  );
}

function InlineSelect({ value, options, labels, onChange }: { value: string; options: string[]; labels?: any; onChange?: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-fit bg-white border-[#e5e5e5] rounded px-2 text-[12px] font-bold gap-2">
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
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold text-[#999] uppercase">{label}</span>
      <span className={cn("text-[13px] font-black tabular-nums", color)}>{value}</span>
    </div>
  );
}