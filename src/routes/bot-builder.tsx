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
  Timer,
  ShieldAlert,
  Wallet,
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

const MENU_ITEMS = [
  { id: "params", label: "Trade parameters" },
  { id: "purchase", label: "Purchase conditions" },
  { id: "sell", label: "Sell conditions (optional)" },
  { id: "restart", label: "Restart trading conditions" },
  { id: "analysis", label: "Analysis", hasSub: true },
  { id: "utility", label: "Utility", hasSub: true },
];

function BotBuilder() {
  const { user } = useAuth();
  const { preset } = Route.useSearch();
  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  // --- BOT CONFIGURATION STATE ---
  const [botId, setBotId] = useState<string | null>(null);
  const [botName, setBotName] = useState("ArkTrader Bot");
  const [searchTerm, setSearchSetTerm] = useState("");
  
  // Visibility State for functional blocks
  const [activeBlocks, setActiveBlocks] = useState<string[]>(["params", "purchase", "restart"]);

  // Logic Values
  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("rise_fall");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [martingale, setMartingale] = useState(2.0);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  const [stopLoss, setStopLoss] = useState(10);
  const [takeProfit, setTakeProfit] = useState(10);
  const [purchaseChoice, setPurchaseChoice] = useState("Rise");

  // --- RUNTIME STATE ---
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("saved");
  const [tab, setTab] = useState("summary");
  const [stats, setStats] = useState({ runs: 0, wins: 0, losses: 0, profit: 0, stake: 0, payout: 0 });
  const [journal, setJournal] = useState<{ time: string; msg: string; type?: string }[]>([]);

  // Sync Stake Edits
  useEffect(() => {
    if (!running) setCurrentStake(initialStake);
  }, [initialStake, running]);

  // 1. Handle Presets & Load Existing
  useEffect(() => {
    if (preset) {
      const config = BOT_PRESETS.find(b => b.id === preset);
      if (config) {
        setSymbol(config.market);
        setInitialStake(config.stake);
        setTakeProfit(config.tp);
        setStopLoss(config.sl);
        setMartingale(config.martingale);
        setBotName(config.name);
      }
    }
  }, [preset]);

  // 2. Real-time Auto-Save (Functional Persistence)
  useEffect(() => {
    if (!user) return;
    const performSave = async () => {
      setSaveStatus("saving");
      const strategyData = { 
        symbol, tradeType, initialStake, martingale, 
        duration, durationUnit, stopLoss, takeProfit, 
        purchaseChoice, activeBlocks 
      };
      
      const { data, error } = await supabase.from("bots").upsert({
        id: botId || undefined,
        user_id: user.id,
        name: botName,
        strategy: strategyData,
        status: running ? "running" : "stopped"
      }).select("id").single();

      if (!error && data) {
        setBotId(data.id);
        setSaveStatus("saved");
      } else setSaveStatus("idle");
    };
    const timeoutId = setTimeout(performSave, 1500);
    return () => clearTimeout(timeoutId);
  }, [botName, symbol, tradeType, initialStake, martingale, duration, durationUnit, stopLoss, takeProfit, purchaseChoice, activeBlocks, user, running]);

  // 3. Block Menu Logic
  const toggleBlock = (id: string) => {
    if (activeBlocks.includes(id)) {
      setActiveBlocks(activeBlocks.filter(b => b !== id));
    } else {
      setActiveBlocks([...activeBlocks, id]);
      toast.success(`Block "${id}" added to canvas`);
    }
  };

  const filteredMenu = MENU_ITEMS.filter(item => 
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 4. Execution Logic
  const logJournal = (msg: string, type = 'info') => {
    setJournal(prev => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 50));
  };

  const toggleBot = () => {
    if (!token) return toast.error("Connect Deriv first.");
    const next = !running;
    setRunning(next);
    runningRef.current = next;
    if (next) {
      logJournal("▶️ Trading Engine Started", "success");
      runCycle();
    } else {
      logJournal("⏹️ Trading Engine Stopped", "error");
    }
  };

  async function runCycle() {
    if (!token || !runningRef.current) return;

    if (stats.profit >= takeProfit || stats.profit <= -stopLoss) {
      logJournal("🏁 Limits reached. Strategy complete.", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      await send({ authorize: token });
      const side = purchaseChoice.toLowerCase() === "rise" ? "up" : "down";
      const ct = contractTypeFor(tradeType, side);
      
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

          logJournal(`${won ? 'WIN' : 'LOSS'}: ${pnl.toFixed(2)} ${derivCurrency}`, won ? 'success' : 'error');

          if (won) setCurrentStake(initialStake);
          else setCurrentStake(prev => Number((prev * martingale).toFixed(2)));

          if (runningRef.current) setTimeout(runCycle, 1000);
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
      <div className="flex h-[calc(100vh-56px)] flex-col lg:flex-row bg-[#f2f3f4] overflow-hidden text-[#333]">
        
        {/* --- LEFT SIDEBAR (Blocks Menu) --- */}
        <aside className="w-full lg:w-[280px] bg-white border-r border-[#e5e5e5] flex flex-col shrink-0">
          <div className="p-3">
            <Button className="w-full bg-[#ff444f] hover:bg-[#eb3e48] text-white font-bold h-10 rounded-md">
              Quick strategy
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
             <div className="px-4 py-3 flex items-center justify-between border-b border-[#f2f3f4]">
                <span className="text-sm font-bold">Blocks menu</span>
                <ChevronDown className="size-4" />
             </div>
             <div className="p-3">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  <Input 
                    placeholder="Search" 
                    value={searchTerm}
                    onChange={(e) => setSearchSetTerm(e.target.value)}
                    className="pl-9 h-10 border-[#e5e5e5] bg-[#f2f3f4]/40 text-sm" 
                  />
                </div>
                <div className="space-y-1">
                  {filteredMenu.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleBlock(item.id)}
                      className={cn(
                        "w-full px-3 py-2.5 text-sm font-medium rounded-md flex justify-between items-center transition-colors",
                        activeBlocks.includes(item.id) ? "bg-[#f2f3f4] text-[#333]" : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      {item.label}
                      {item.hasSub && <ChevronDown className="size-3.5 text-slate-400" />}
                    </button>
                  ))}
                </div>
             </div>
          </div>
        </aside>

        {/* --- CENTER WORKSPACE (Canvas) --- */}
        <main className="flex-1 flex flex-col min-w-0 relative border-r border-[#e5e5e5]">
          <div className="h-14 bg-white border-b border-[#e5e5e5] flex items-center px-4 justify-between">
            <div className="flex items-center gap-1">
              <ToolbarBtn icon={RefreshCw} onClick={() => window.location.reload()} />
              <ToolbarBtn icon={FolderOpen} />
              <ToolbarBtn icon={Save} onClick={() => toast.success("Saved Manually")} />
              <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
              <ToolbarBtn icon={Undo2} />
              <ToolbarBtn icon={Redo2} />
              <div className="w-px h-6 bg-[#e5e5e5] mx-1" />
              <ToolbarBtn icon={ZoomIn} />
              <ToolbarBtn icon={ZoomOut} />
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
               {saveStatus === "saving" ? (
                 <><RefreshCw className="size-3 text-blue-500 animate-spin" /><span className="text-[10px] font-black uppercase text-blue-600">Syncing...</span></>
               ) : (
                 <><CloudCheck className="size-3.5 text-emerald-500" /><span className="text-[10px] font-black uppercase text-emerald-600">Cloud Ready</span></>
               )}
            </div>
          </div>

          <div className="flex-1 p-8 overflow-auto custom-scrollbar relative bg-[#f8f9fa]">
            <div className="flex flex-col gap-8 items-start pb-32">
              
              {/* Block 1: Trade Parameters */}
              {activeBlocks.includes("params") && (
                <div className="w-full max-w-2xl bg-white border border-[#e5e5e5] rounded shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="bg-[#064e6e] px-4 py-2.5 flex items-center justify-between text-white text-[13px] font-bold">
                    <div className="flex items-center gap-2"><Plus className="size-3" /> 1. Trade parameters</div>
                    <button onClick={() => toggleBlock("params")}><Trash2 className="size-3.5 hover:text-red-400" /></button>
                  </div>
                  <div className="p-5 space-y-5 text-[12px]">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-slate-500">Market:</span>
                        <InlineSelect value="Derived" options={["Derived"]} />
                        <ChevronRight className="size-3 text-slate-300" />
                        <InlineSelect value={symbol} options={Object.keys(MARKETS)} labels={MARKETS} onChange={setSymbol} />
                    </div>
                    <div className="pt-4 border-t border-[#f2f3f4] grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Stake (USD):</Label>
                            <Input type="number" value={initialStake} onChange={e=>setInitialStake(Number(e.target.value))} className="w-24 h-8 bg-[#fcfcfc] border-[#e5e5e5] font-black" />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-slate-500 font-bold uppercase text-[10px]">Martingale (x):</Label>
                            <Input type="number" value={martingale} onChange={e=>setMartingale(Number(e.target.value))} className="w-24 h-8 bg-[#fcfcfc] border-[#e5e5e5] font-black" />
                          </div>
                        </div>
                        <div className="space-y-4 border-l border-slate-100 pl-8">
                          <div className="flex items-center justify-between">
                            <Label className="text-emerald-600 font-bold uppercase text-[10px]">Take Profit:</Label>
                            <Input type="number" value={takeProfit} onChange={e=>setTakeProfit(Number(e.target.value))} className="w-24 h-8 text-emerald-600 font-bold" />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="text-red-600 font-bold uppercase text-[10px]">Stop Loss:</Label>
                            <Input type="number" value={stopLoss} onChange={e=>setStopLoss(Number(e.target.value))} className="w-24 h-8 text-red-600 font-bold" />
                          </div>
                        </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Block 2: Purchase Conditions */}
              {activeBlocks.includes("purchase") && (
                <div className="w-[320px] bg-white border border-[#e5e5e5] rounded shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="bg-[#064e6e] px-4 py-2.5 text-white text-[13px] font-bold flex justify-between items-center">
                    <div className="flex items-center gap-2"><Target className="size-3" /> 2. Purchase logic</div>
                    <button onClick={() => toggleBlock("purchase")}><Trash2 className="size-3.5 hover:text-red-400" /></button>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500 font-bold">Purchase</span>
                        <InlineSelect value={purchaseChoice} options={["Rise", "Fall"]} onChange={setPurchaseChoice} />
                    </div>
                  </div>
                </div>
              )}

              {/* Block 3: Restart */}
              {activeBlocks.includes("restart") && (
                <div className="w-[380px] bg-white border border-[#e5e5e5] rounded shadow-md overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="bg-[#064e6e] px-4 py-2.5 text-white text-[13px] font-bold flex justify-between items-center">
                    <div className="flex items-center gap-2"><RotateCcw className="size-3" /> 4. Trading session</div>
                    <button onClick={() => toggleBlock("restart")}><Trash2 className="size-3.5 hover:text-red-400" /></button>
                  </div>
                  <div className="p-5">
                    <div className="bg-[#f2f3f4] px-4 py-3 rounded text-[12px] font-bold text-slate-600 border border-black/5">
                        Trade again automatically
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="absolute bottom-12 right-12 opacity-20 hover:opacity-100 transition-opacity">
               <div className="size-24 bg-slate-200 rounded-3xl flex items-center justify-center text-slate-400 shadow-inner">
                  <Trash2 className="size-12" />
               </div>
            </div>
          </div>
        </main>

        {/* --- RIGHT SIDEBAR (Execution) --- */}
        <aside className="w-full lg:w-[350px] bg-white flex flex-col shrink-0">
          <div className="p-5 border-b border-[#e5e5e5] bg-white flex items-center justify-between gap-4">
            <Button 
              onClick={toggleBot} 
              className={cn(
                "h-11 px-8 font-black rounded text-sm flex items-center justify-center gap-3 transition-all shadow-sm w-32",
                running ? "bg-[#ff444f] text-white" : "bg-[#4bb4b3] text-white"
              )}
            >
              {running ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
              {running ? "Stop" : "Run"}
            </Button>
            
            <div className="flex-1">
               <div className="text-[10px] font-bold text-slate-400 mb-1.5 text-center uppercase">
                 {running ? "Bot is operational" : "System Standby"}
               </div>
               <div className="h-1.5 w-full bg-[#f2f3f4] rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-700", running ? "bg-[#4bb4b3] w-full" : "w-0")} />
               </div>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col">
            <TabsList className="grid grid-cols-2 h-12 bg-white border-b border-[#e5e5e5] rounded-none p-0">
              <TabsTrigger value="summary" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] text-[10px] font-bold uppercase">Summary</TabsTrigger>
              <TabsTrigger value="journal" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-[#ff444f] text-[10px] font-bold uppercase">Logs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="summary" className="m-0 flex-1 p-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div className="bg-[#fcfcfc] border border-[#e5e5e5] rounded-2xl p-5 shadow-inner">
                   <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total P&L</div>
                   <div className={cn("text-4xl font-black tabular-nums tracking-tighter", stats.profit >= 0 ? "text-[oklch(0.7_0.17_150)]" : "text-rose-500")}>
                     {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] text-center shadow-sm">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Accuracy</span>
                    <div className="text-xl font-bold text-blue-500">{stats.runs > 0 ? Math.round((stats.wins/stats.runs)*100) : 0}%</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#e5e5e5] text-center shadow-sm">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Trades</span>
                    <div className="text-xl font-bold text-[#333]">{stats.runs}</div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] font-bold uppercase border-t border-[#f2f3f4] pt-4">
                  <span className="text-emerald-600">Wins: {stats.wins}</span>
                  <span className="text-rose-500">Loss: {stats.losses}</span>
                </div>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setStats({runs:0, wins:0, losses:0, profit:0, stake:0, payout:0})} 
                className="w-full font-bold h-11 border-[#e5e5e5] text-slate-400 hover:text-slate-600"
              >
                Reset Stats
              </Button>
            </TabsContent>

            <TabsContent value="journal" className="flex-1 bg-[#fcfcfc] p-4 overflow-y-auto space-y-2 scrollbar-hide">
              {journal.map((j, i) => (
                <div key={i} className={cn("p-3 rounded-lg border text-[11px] font-medium leading-relaxed", j.type === 'error' ? "bg-rose-50 border-rose-100 text-rose-600" : j.type === 'success' ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-white border-[#e5e5e5] text-slate-600")}>
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

// --- HELPERS ---

function ToolbarBtn({ icon: Icon, onClick }: { icon: any; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="p-2.5 hover:bg-[#f2f3f4] rounded text-slate-400 hover:text-slate-900 transition-colors">
      <Icon className="size-4" />
    </button>
  );
}

function InlineSelect({ value, options, labels, onChange }: { value: string; options: string[]; labels?: any; onChange?: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-7 w-fit bg-white border-[#e5e5e5] rounded px-3 text-[11px] font-bold gap-2">
        <SelectValue>{labels?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white border-[#e5e5e5]">
        {options.map(o => <SelectItem key={o} value={o} className="text-xs font-bold">{labels?.[o] ?? o}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}