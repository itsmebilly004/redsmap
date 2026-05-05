import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

export const Route = createFileRoute("/bot-builder")({
  head: () => ({
    meta: [
      { title: "Bot Builder — ArkTrader Hub" },
      { name: "description", content: "Build automated Deriv trading bots with martingale, take-profit, and stop-loss controls." },
    ],
  }),
  component: BotBuilder,
});

const BLOCK_MENU = [
  { label: "Analysis Logics", emoji: "🔥" },
  { label: "Trade parameters" },
  { label: "Purchase conditions" },
  { label: "Sell conditions (optional)" },
  { label: "Restart trading conditions" },
  { label: "Analysis", chevron: true },
  { label: "Utility", chevron: true },
  { label: "Virtual Hook Switcher" },
  { label: "Binarytools" },
];

const MARKETS: Record<string, { label: string; symbols: { value: string; label: string }[] }[]> = {
  Derived: [
    {
      label: "Continuous Indices",
      symbols: [
        { value: "R_10", label: "Volatility 10 Index" },
        { value: "R_25", label: "Volatility 25 Index" },
        { value: "R_50", label: "Volatility 50 Index" },
        { value: "R_75", label: "Volatility 75 Index" },
        { value: "R_100", label: "Volatility 100 Index" },
      ],
    },
  ],
};

const TRADE_TYPES: Record<string, { value: string; label: string; contracts: { value: string; label: string }[] }[]> = {
  Digits: [
    { value: "even_odd", label: "Even/Odd", contracts: [{ value: "even", label: "Even" }, { value: "odd", label: "Odd" }] },
    { value: "over_under", label: "Over/Under", contracts: [{ value: "over", label: "Over" }, { value: "under", label: "Under" }] },
    { value: "matches_differs", label: "Matches/Differs", contracts: [{ value: "matches", label: "Matches" }, { value: "differs", label: "Differs" }] },
  ],
  "Ups & Downs": [
    { value: "rise_fall", label: "Rise/Fall", contracts: [{ value: "up", label: "Rise" }, { value: "down", label: "Fall" }] },
    { value: "higher_lower", label: "Higher/Lower", contracts: [{ value: "higher", label: "Higher" }, { value: "lower", label: "Lower" }] },
  ],
};

// Zod schemas for trade parameters with friendly messages
const paramSchemas = {
  stake: z.number({ invalid_type_error: "Stake must be a number" })
    .positive("Stake must be greater than 0")
    .max(10000, "Stake cannot exceed 10,000"),
  stakeW: z.number({ invalid_type_error: "Must be a number" })
    .min(0.1, "Must be at least 0.1")
    .max(100, "Cannot exceed 100"),
  stopLoss: z.number({ invalid_type_error: "Stop loss must be a number" })
    .nonnegative("Stop loss cannot be negative")
    .max(1_000_000, "Stop loss is unrealistically large"),
  takeProfit: z.number({ invalid_type_error: "Take profit must be a number" })
    .nonnegative("Take profit cannot be negative")
    .max(1_000_000, "Take profit is unrealistically large"),
  durationTicks: z.number({ invalid_type_error: "Ticks must be a number" })
    .int("Ticks must be a whole number")
    .min(1, "Need at least 1 tick")
    .max(10, "Maximum is 10 ticks"),
  martingaleAfterLoss: z.number({ invalid_type_error: "Must be a number" })
    .min(1, "Multiplier must be at least 1")
    .max(10, "Multiplier capped at 10x to limit risk"),
};

type ParamKey = keyof typeof paramSchemas;

// Strategy blocks (drag-and-drop reorderable)
const DEFAULT_BLOCKS = ["trade_parameters", "sell_conditions", "restart_conditions"] as const;
type BlockId = (typeof DEFAULT_BLOCKS)[number];
const BLOCK_META: Record<BlockId, { index: number; title: string; icon?: string }> = {
  trade_parameters: { index: 1, title: "Trade parameters" },
  sell_conditions: { index: 3, title: "Sell conditions" },
  restart_conditions: { index: 4, title: "Restart trading conditions", icon: "🎯" },
};

function BotBuilder() {
  const { user } = useAuth();
  const now = useNow();

  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Trade parameters
  const [marketGroup, setMarketGroup] = useState("Derived");
  const [marketSubgroup, setMarketSubgroup] = useState("Continuous Indices");
  const [symbol, setSymbol] = useState("R_100");
  const [tradeTypeGroup, setTradeTypeGroup] = useState("Digits");
  const [tradeType, setTradeType] = useState<TradeCategory>("even_odd");
  const [contractType, setContractType] = useState("even");
  const [candleInterval, setCandleInterval] = useState("1 minute");
  const [restartOnError, setRestartOnError] = useState(false);
  const [restartLastOnError, setRestartLastOnError] = useState(true);

  // Run-once parameters
  const [stake, setStake] = useState(1);
  const [stakeW, setStakeW] = useState(1);
  const [stopLoss, setStopLoss] = useState(2000);
  const [takeProfit, setTakeProfit] = useState(2);
  const [durationTicks, setDurationTicks] = useState(1);
  const [martingaleAfterLoss, setMartingaleAfterLoss] = useState(1);

  // Block order (drag-and-drop)
  const [blockOrder, setBlockOrder] = useState<BlockId[]>([...DEFAULT_BLOCKS]);
  const [dragId, setDragId] = useState<BlockId | null>(null);

  // Saved bots
  const [bots, setBots] = useState<{ id: string; name: string }[]>([]);
  const [currentBotId, setCurrentBotId] = useState<string | null>(null);
  const [botName, setBotName] = useState("");

  // Right pane state
  const [tab, setTab] = useState("summary");
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({
    totalStake: 0, totalPayout: 0, runs: 0,
    contractsLost: 0, contractsWon: 0, totalProfit: 0,
  });
  const [transactions, setTransactions] = useState<
    { id: string; time: string; type: string; stake: number; profit: number }[]
  >([]);
  const [journal, setJournal] = useState<{ time: string; msg: string }[]>([]);

  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);

  // Validate parameters live
  const errors = useMemo<Partial<Record<ParamKey, string>>>(() => {
    const values: Record<ParamKey, number> = { stake, stakeW, stopLoss, takeProfit, durationTicks, martingaleAfterLoss };
    const out: Partial<Record<ParamKey, string>> = {};
    (Object.keys(values) as ParamKey[]).forEach((k) => {
      const r = paramSchemas[k].safeParse(values[k]);
      if (!r.success) out[k] = r.error.issues[0]?.message ?? "Invalid";
    });
    return out;
  }, [stake, stakeW, stopLoss, takeProfit, durationTicks, martingaleAfterLoss]);
  const hasErrors = Object.keys(errors).length > 0;

  // Fetch deriv account
  useEffect(() => {
    if (!user) return;
    supabase
      .from("deriv_accounts")
      .select("api_token, is_demo")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_demo", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) { setToken(data.api_token); setIsDemo(data.is_demo); }
      });
  }, [user]);

  // Load saved bots
  async function loadBots() {
    if (!user) return;
    const { data } = await supabase
      .from("bots").select("id, name").eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setBots((data ?? []) as any);
  }
  useEffect(() => { loadBots(); }, [user]);

  const tradeTypesInGroup = TRADE_TYPES[tradeTypeGroup] ?? [];
  const currentTT = tradeTypesInGroup.find((t) => t.value === tradeType) ?? tradeTypesInGroup[0];

  useEffect(() => {
    const first = TRADE_TYPES[tradeTypeGroup]?.[0];
    if (first && !TRADE_TYPES[tradeTypeGroup].some((t) => t.value === tradeType)) {
      setTradeType(first.value as TradeCategory);
      setContractType(first.contracts[0].value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradeTypeGroup]);

  function logJournal(msg: string) {
    setJournal((j) => [{ time: new Date().toLocaleTimeString(), msg }, ...j].slice(0, 200));
  }

  function buildStrategy() {
    return {
      symbol, tradeType, contractType, stake, stakeW, stopLoss, takeProfit,
      durationTicks, martingaleAfterLoss, candleInterval, restartOnError,
      restartLastOnError, marketGroup, marketSubgroup, tradeTypeGroup,
      blockOrder,
    };
  }

  async function saveBot(saveAs = false) {
    if (!user) { toast.error("Sign in to save bots."); return; }
    if (hasErrors) { toast.error("Fix invalid parameters before saving."); return; }
    const name = botName.trim() || `${currentTT?.label ?? tradeType} on ${symbol}`;
    const payload = { name, user_id: user.id, strategy: buildStrategy() as any, status: "idle" };
    if (currentBotId && !saveAs) {
      const { error } = await supabase.from("bots").update(payload).eq("id", currentBotId);
      if (error) { toast.error(error.message); return; }
      toast.success("Strategy updated");
    } else {
      const { data, error } = await supabase.from("bots").insert(payload).select("id, name").single();
      if (error) { toast.error(error.message); return; }
      setCurrentBotId((data as any).id);
      setBotName((data as any).name);
      toast.success("Strategy saved");
    }
    loadBots();
  }

  async function loadBotById(id: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from("bots").select("id, name, strategy")
      .eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error || !data) { toast.error("Could not load bot"); return; }
    const s = ((data as any).strategy ?? {}) as any;
    setCurrentBotId((data as any).id);
    setBotName((data as any).name);
    if (s.symbol) setSymbol(s.symbol);
    if (s.tradeType) setTradeType(s.tradeType);
    if (s.contractType) setContractType(s.contractType);
    if (typeof s.stake === "number") setStake(s.stake);
    if (typeof s.stakeW === "number") setStakeW(s.stakeW);
    if (typeof s.stopLoss === "number") setStopLoss(s.stopLoss);
    if (typeof s.takeProfit === "number") setTakeProfit(s.takeProfit);
    if (typeof s.durationTicks === "number") setDurationTicks(s.durationTicks);
    if (typeof s.martingaleAfterLoss === "number") setMartingaleAfterLoss(s.martingaleAfterLoss);
    if (s.candleInterval) setCandleInterval(s.candleInterval);
    if (typeof s.restartOnError === "boolean") setRestartOnError(s.restartOnError);
    if (typeof s.restartLastOnError === "boolean") setRestartLastOnError(s.restartLastOnError);
    if (s.marketGroup) setMarketGroup(s.marketGroup);
    if (s.marketSubgroup) setMarketSubgroup(s.marketSubgroup);
    if (s.tradeTypeGroup) setTradeTypeGroup(s.tradeTypeGroup);
    if (Array.isArray(s.blockOrder) && s.blockOrder.length > 0) {
      const valid = s.blockOrder.filter((b: any): b is BlockId => DEFAULT_BLOCKS.includes(b));
      const missing = DEFAULT_BLOCKS.filter((b) => !valid.includes(b));
      setBlockOrder([...valid, ...missing]);
    }
    toast.success(`Loaded "${(data as any).name}"`);
  }

  async function runOne() {
    if (!token) { toast.error("Connect your Deriv account first."); return; }
    if (hasErrors) { toast.error("Fix invalid parameters before running."); return; }
    try {
      await send({ authorize: token });
      const ct = contractTypeFor(tradeType, contractType);
      const proposal: any = {
        proposal: 1, amount: stake, basis: "stake", contract_type: ct,
        currency: "USD", symbol, duration: durationTicks, duration_unit: "t",
      };
      if (tradeType === "over_under" || tradeType === "matches_differs") proposal.barrier = "5";
      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) throw new Error("No proposal");
      const buyResp = await send({ buy: proposalId, price: stake });
      const contract = buyResp.buy;
      logJournal(`Bought ${ct} contract ${contract.contract_id}`);

      const { data: trade } = await supabase.from("trades").insert({
        user_id: user!.id, contract_id: String(contract.contract_id),
        market: symbol, trade_type: ct, stake, payout: contract.payout,
        result: "open", is_demo: isDemo,
      }).select().single();

      const poll = setInterval(async () => {
        try {
          const r = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = r.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            const won = profit >= 0;
            setStats((s) => ({
              totalStake: s.totalStake + stake,
              totalPayout: s.totalPayout + Number(contract.payout ?? 0),
              runs: s.runs + 1,
              contractsLost: s.contractsLost + (won ? 0 : 1),
              contractsWon: s.contractsWon + (won ? 1 : 0),
              totalProfit: s.totalProfit + profit,
            }));
            setTransactions((t) =>
              [{ id: String(contract.contract_id), time: new Date().toLocaleTimeString(), type: ct, stake, profit }, ...t].slice(0, 200));
            logJournal(`${won ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} USD`);
            if ((trade as any)?.id) {
              await supabase.from("trades").update({ profit, result: won ? "win" : "loss" }).eq("id", (trade as any).id);
            }
          }
        } catch { /* ignore */ }
      }, 1500);
      setTimeout(() => clearInterval(poll), 120000);
    } catch (e: any) {
      logJournal(`Error: ${e.message ?? "trade failed"}`);
      toast.error(e.message ?? "Trade failed");
    }
  }

  async function startBot() {
    if (!token) { toast.error("Connect your Deriv account first."); return; }
    if (hasErrors) { toast.error("Fix invalid parameters before running."); return; }
    setRunning(true);
    logJournal("Bot started");
    await runOne();
    setRunning(false);
    logJournal("Bot finished one cycle");
  }

  function resetStats() {
    setStats({ totalStake: 0, totalPayout: 0, runs: 0, contractsLost: 0, contractsWon: 0, totalProfit: 0 });
    setTransactions([]);
    setJournal([]);
  }

  function exportCsv() {
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines: string[] = [];
    lines.push("Section,Time,Type,Stake,Profit,Message");
    for (const t of transactions) {
      lines.push(["transaction", t.time, t.type, t.stake.toFixed(2), t.profit.toFixed(2), ""].map(escape).join(","));
    }
    for (const j of journal) {
      lines.push(["journal", j.time, "", "", "", j.msg].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-${(botName || "session").replace(/\s+/g, "-")}-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  // Drag and drop reorder
  function onDragStart(id: BlockId) { setDragId(id); }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  function onDrop(target: BlockId) {
    if (!dragId || dragId === target) { setDragId(null); return; }
    setBlockOrder((order) => {
      const next = order.filter((b) => b !== dragId);
      const idx = next.indexOf(target);
      next.splice(idx, 0, dragId);
      return next;
    });
    setDragId(null);
  }

  const filteredMenu = useMemo(
    () => BLOCK_MENU.filter((b) => b.label.toLowerCase().includes(search.toLowerCase())),
    [search],
  );

  // ---- Block renderers ----
  function renderBlock(id: BlockId) {
    const meta = BLOCK_META[id];
    const dragHandle = (
      <button
        draggable
        onDragStart={() => onDragStart(id)}
        onDragOver={onDragOver}
        onDrop={() => onDrop(id)}
        className="flex cursor-grab items-center gap-1 rounded bg-white/15 px-1.5 py-0.5 text-[10px] active:cursor-grabbing"
        title="Drag to reorder"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-3" />
      </button>
    );

    if (id === "trade_parameters") {
      return (
        <div
          key={id}
          onDragOver={onDragOver}
          onDrop={() => onDrop(id)}
          className={cn("w-full max-w-full overflow-hidden rounded-md shadow-md", dragId === id && "opacity-60")}
        >
          <div className="flex items-center gap-2 bg-[oklch(0.32_0.13_265)] px-3 py-2 text-sm font-semibold text-white">
            {dragHandle}
            {meta.index}. {meta.title}
          </div>
          <div className="space-y-2 bg-[oklch(0.99_0.003_240)] p-3 text-[13px]">
            <Row label="Market:">
              <Pill><NativeSelect value={marketGroup} onChange={setMarketGroup} options={Object.keys(MARKETS)} /></Pill>
              <span>&gt;</span>
              <Pill><NativeSelect value={marketSubgroup} onChange={setMarketSubgroup} options={MARKETS[marketGroup].map((g) => g.label)} /></Pill>
              <span>&gt;</span>
              <Pill>
                <NativeSelect
                  value={symbol} onChange={setSymbol}
                  options={MARKETS[marketGroup].find((g) => g.label === marketSubgroup)!.symbols.map((s) => s.value)}
                  labels={Object.fromEntries(MARKETS[marketGroup].find((g) => g.label === marketSubgroup)!.symbols.map((s) => [s.value, s.label]))}
                />
              </Pill>
            </Row>
            <Row label="Trade Type:">
              <Pill><NativeSelect value={tradeTypeGroup} onChange={setTradeTypeGroup} options={Object.keys(TRADE_TYPES)} /></Pill>
              <span>&gt;</span>
              <Pill>
                <NativeSelect
                  value={tradeType} onChange={(v) => setTradeType(v as TradeCategory)}
                  options={tradeTypesInGroup.map((t) => t.value)}
                  labels={Object.fromEntries(tradeTypesInGroup.map((t) => [t.value, t.label]))}
                />
              </Pill>
            </Row>
            <Row label="Contract Type:">
              <Pill>
                <NativeSelect
                  value={contractType} onChange={setContractType}
                  options={(currentTT?.contracts ?? []).map((c) => c.value)}
                  labels={Object.fromEntries((currentTT?.contracts ?? []).map((c) => [c.value, c.label]))}
                />
              </Pill>
            </Row>
            <Row label="Default Candle Interval:">
              <Pill>
                <NativeSelect value={candleInterval} onChange={setCandleInterval}
                  options={["1 minute", "2 minutes", "3 minutes", "5 minutes", "10 minutes", "15 minutes", "30 minutes", "1 hour"]} />
              </Pill>
            </Row>
            <CheckRow label="Restart buy/sell on error (disable for better performance):" checked={restartOnError} onChange={setRestartOnError} />
            <CheckRow label="Restart last trade on error (bot ignores the unsuccessful trade):" checked={restartLastOnError} onChange={setRestartLastOnError} />

            <SubBlockHeader title="Run once at start:" />
            <ParamRow label="stake" value={stake} onChange={setStake} error={errors.stake} />
            <ParamRow label="stake w" value={stakeW} onChange={setStakeW} error={errors.stakeW} />
            <ParamRow label="stop loss" value={stopLoss} onChange={setStopLoss} error={errors.stopLoss} />
            <ParamRow label="take profit" value={takeProfit} onChange={setTakeProfit} error={errors.takeProfit} />
            <ParamRow label="Duration ticks" value={durationTicks} onChange={setDurationTicks} error={errors.durationTicks} />
            <ParamRow label="Product Martingale after loss" value={martingaleAfterLoss} onChange={setMartingaleAfterLoss} error={errors.martingaleAfterLoss} />
          </div>
        </div>
      );
    }

    return (
      <div
        key={id}
        onDragOver={onDragOver}
        onDrop={() => onDrop(id)}
        className={cn(
          "flex items-center gap-2 rounded-md bg-[oklch(0.32_0.13_265)] px-3 py-2 text-sm font-semibold text-white shadow",
          dragId === id && "opacity-60",
        )}
      >
        {dragHandle}
        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px]">{meta.icon ?? "▤"}</span>
        {meta.index}. {meta.title}
        <ChevronDown className="ml-auto size-3.5" />
      </div>
    );
  }

  // ---- Reusable left & right panels (shared between desktop + mobile sheets) ----
  const blocksMenu = (
    <>
      <div className="p-3">
        <button className="w-full rounded-md bg-[oklch(0.27_0.12_265)] px-4 py-2 text-sm font-semibold text-white shadow">
          Quick strategy
        </button>
      </div>
      <div className="border-t border-[oklch(0.94_0.005_240)] px-3 py-2 text-center text-xs font-medium tracking-wide text-[oklch(0.4_0.02_260)]">
        Blocks menu <ChevronDown className="ml-1 inline size-3" />
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[oklch(0.6_0.02_260)]" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
            className="h-8 rounded-full bg-[oklch(0.96_0.005_240)] pl-7 text-sm" />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto pb-3">
        {filteredMenu.map((b, i) => (
          <button key={b.label}
            className={cn("flex w-full items-center justify-between border-b border-[oklch(0.95_0.005_240)] px-4 py-2.5 text-left text-sm hover:bg-[oklch(0.97_0.005_240)]",
              i === 0 && "font-medium")}>
            <span>{b.label} {b.emoji && <span className="ml-1">{b.emoji}</span>}</span>
            {b.chevron && <ChevronDown className="size-3.5 text-[oklch(0.5_0.02_260)]" />}
          </button>
        ))}
      </nav>
    </>
  );

  const runPanel = (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col">
      <TabsList className="grid grid-cols-3 rounded-none bg-transparent p-0">
        <TabsTrigger value="summary" className="rounded-none data-[state=active]:bg-[oklch(0.62_0.18_150)] data-[state=active]:text-white">Summary</TabsTrigger>
        <TabsTrigger value="transactions" className="rounded-none">Transactions</TabsTrigger>
        <TabsTrigger value="journal" className="rounded-none">Journal</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="m-0 flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center bg-[oklch(0.97_0.005_240)] px-6 py-8 text-center text-sm text-[oklch(0.45_0.02_260)]">
          When you're ready to trade, hit <strong className="mx-1">Run</strong>.
          <br />You'll be able to track your bot's performance here.
        </div>
        <div className="border-t border-[oklch(0.92_0.005_240)] p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="mr-1 size-3" /> Export CSV
            </Button>
            <span className="text-xs text-[oklch(0.55_0.18_265)] underline">What's this?</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Total stake" value={`${stats.totalStake.toFixed(2)} USD`} />
            <Stat label="Total payout" value={`${stats.totalPayout.toFixed(2)} USD`} />
            <Stat label="No. of runs" value={String(stats.runs)} />
            <Stat label="Contracts lost" value={String(stats.contractsLost)} />
            <Stat label="Contracts won" value={String(stats.contractsWon)} />
            <Stat label="Total profit" value={stats.totalProfit.toFixed(2)} />
          </div>
          <Button variant="ghost" onClick={resetStats} className="mt-4 w-full bg-[oklch(0.96_0.005_240)] text-[oklch(0.5_0.02_260)]">
            Reset
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="transactions" className="m-0 flex-1 overflow-auto p-3 text-xs">
        <div className="mb-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 size-3" /> Export CSV
          </Button>
        </div>
        {transactions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</div>
        ) : (
          <table className="w-full">
            <thead className="text-left text-[oklch(0.5_0.02_260)]">
              <tr><th>Time</th><th>Type</th><th>Stake</th><th>Profit</th></tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-[oklch(0.95_0.005_240)]">
                  <td>{t.time}</td><td>{t.type}</td><td>{t.stake.toFixed(2)}</td>
                  <td className={t.profit >= 0 ? "text-emerald-600" : "text-rose-600"}>{t.profit.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TabsContent>

      <TabsContent value="journal" className="m-0 flex-1 overflow-auto p-3 text-xs">
        <div className="mb-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="mr-1 size-3" /> Export CSV
          </Button>
        </div>
        {journal.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No log entries.</div>
        ) : (
          <ul className="space-y-1">
            {journal.map((j, i) => (
              <li key={i} className="border-b border-[oklch(0.95_0.005_240)] pb-1">
                <span className="mr-2 text-[oklch(0.5_0.02_260)]">{j.time}</span>{j.msg}
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );

  return (
    <TopShell>
      <div className="flex min-h-[640px] flex-col bg-[oklch(0.97_0.005_240)] lg:h-[calc(100vh-180px)]">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"><Menu className="mr-1 size-4" /> Blocks</Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex w-72 flex-col p-0">
              <SheetHeader className="px-4 pt-4"><SheetTitle>Blocks menu</SheetTitle></SheetHeader>
              {blocksMenu}
            </SheetContent>
          </Sheet>
          <div className="flex-1" />
          <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"><Activity className="mr-1 size-4" /> Run panel</Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-80 flex-col p-0 sm:w-96">
              <SheetHeader className="px-4 pt-4"><SheetTitle>Bot performance</SheetTitle></SheetHeader>
              <div className="flex flex-1 flex-col">{runPanel}</div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex flex-1 min-h-0 flex-col lg:grid lg:grid-cols-[260px_1fr_360px]">
          {/* LEFT: Blocks menu (desktop only) */}
          <aside className="hidden flex-col border-r border-[oklch(0.92_0.005_240)] bg-white lg:flex">
            {blocksMenu}
          </aside>

          {/* CENTER: workspace */}
          <section className="flex flex-1 flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-1 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 text-[oklch(0.45_0.02_260)]">
              <ToolbarBtn icon={FolderOpen} title="Open" />
              <ToolbarBtn icon={ListOrdered} title="Sort" />
              <Divider />
              <ToolbarBtn icon={LineChart} title="Chart" />
              <ToolbarBtn icon={BarChartHorizontal} title="Trend" />
              <Divider />
              <ToolbarBtn icon={Undo2} title="Undo" />
              <ToolbarBtn icon={Redo2} title="Redo" />
              <Divider />
              <ToolbarBtn icon={ZoomIn} title="Zoom in" />
              <ToolbarBtn icon={ZoomOut} title="Zoom out" />

              <div className="ml-auto flex items-center gap-2">
                <Select value={currentBotId ?? ""} onValueChange={(v) => v && loadBotById(v)}>
                  <SelectTrigger className="h-7 w-[180px] text-xs">
                    <SelectValue placeholder="Load saved bot…" />
                  </SelectTrigger>
                  <SelectContent>
                    {bots.length === 0
                      ? <div className="px-2 py-1 text-xs text-muted-foreground">No bots yet</div>
                      : bots.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input value={botName} onChange={(e) => setBotName(e.target.value.slice(0, 80))}
                  placeholder="Bot name" className="h-7 w-[160px] text-xs" />
              </div>
            </div>

            {/* Workspace */}
            <div className="relative flex-1 overflow-auto bg-[oklch(0.97_0.005_240)] p-4 sm:p-6">
              {hasErrors && (
                <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  Please fix the highlighted parameter errors below before saving or running this bot.
                </div>
              )}
              <div className="flex flex-col gap-4">
                {blockOrder.map((id) => renderBlock(id))}
              </div>
            </div>
          </section>

          {/* RIGHT: Run panel (desktop) */}
          <aside className="hidden flex-col border-l border-[oklch(0.92_0.005_240)] bg-white lg:flex">
            {runPanel}
          </aside>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[oklch(0.92_0.13_95)] px-3 py-1 text-xs font-semibold text-[oklch(0.3_0.1_80)]">
              Risk Disclaimer
            </span>
            <Button size="sm" onClick={() => saveBot(false)} variant="outline" disabled={hasErrors}>
              <Save className="mr-1 size-3" /> {currentBotId ? "Update" : "Save"}
            </Button>
            {currentBotId && (
              <Button size="sm" onClick={() => saveBot(true)} variant="outline" disabled={hasErrors}>
                Save as new
              </Button>
            )}
            {running ? (
              <Button size="sm" variant="destructive" onClick={() => setRunning(false)}>
                <Square className="mr-1 size-3" /> Stop
              </Button>
            ) : (
              <Button size="sm" className="bg-[oklch(0.55_0.22_265)] text-white" onClick={startBot} disabled={hasErrors}>
                <Play className="mr-1 size-3" /> Run
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={resetStats}>
              <RotateCcw className="mr-1 size-3" /> Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={exportCsv}>
              <Download className="mr-1 size-3" /> CSV
            </Button>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-[oklch(0.45_0.02_260)]">
            <span className={cn("inline-block size-2 rounded-full", token ? "bg-emerald-500" : "bg-rose-500")} />
            <span className="hidden sm:inline">{now}</span>
            <Shield className="size-3.5" />
            <Sun className="size-3.5" />
            <HelpCircle className="size-3.5" />
            <Globe className="size-3.5" />
            <span className="font-sans font-medium">EN</span>
            <Maximize2 className="size-3.5" />
          </div>
        </div>
      </div>
    </TopShell>
  );
}

/* ---------- helpers ---------- */

function useNow() {
  const [t, setT] = useState(() => formatNow());
  useEffect(() => {
    const i = setInterval(() => setT(formatNow()), 1000);
    return () => clearInterval(i);
  }, []);
  return t;
}
function formatNow() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT`;
}

function ToolbarBtn({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <button title={title} className="rounded p-1.5 hover:bg-[oklch(0.95_0.005_240)]">
      <Icon className="size-4" />
    </button>
  );
}
function Divider() {
  return <span className="mx-1 hidden h-5 w-px bg-[oklch(0.92_0.005_240)] sm:inline-block" />;
}

function SubBlockHeader({ title }: { title: string }) {
  return (
    <div className="-mx-3 mt-2 bg-[oklch(0.32_0.13_265)] px-3 py-1.5 text-xs font-semibold text-white">
      {title}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded bg-white px-2 py-1.5 shadow-sm">
      <span className="font-medium text-[oklch(0.3_0.05_260)]">{label}</span>
      {children}
    </div>
  );
}
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-[oklch(0.97_0.005_240)] px-2 py-0.5 text-xs ring-1 ring-[oklch(0.9_0.005_240)]">
      {children}
    </span>
  );
}
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded bg-white px-2 py-1.5 text-[12px] shadow-sm">
      <span className="text-[oklch(0.3_0.05_260)]">{label}</span>
      <Checkbox checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}
function ParamRow({
  label, value, onChange, error,
}: { label: string; value: number; onChange: (n: number) => void; error?: string }) {
  return (
    <div className="rounded bg-white px-2 py-1.5 text-[12px] shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-[oklch(0.4_0.05_260)]">set</span>
        <Pill>{label}</Pill>
        <span>to</span>
        <input
          type="number"
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          aria-invalid={!!error}
          className={cn(
            "w-20 rounded-full bg-[oklch(0.97_0.005_240)] px-2 py-0.5 text-center text-xs ring-1 focus:outline-none",
            error ? "ring-rose-400 focus:ring-rose-500" : "ring-[oklch(0.9_0.005_240)]",
          )}
        />
      </div>
      {error && <div className="mt-1 pl-1 text-[11px] text-rose-600">{error}</div>}
    </div>
  );
}

function NativeSelect({
  value, onChange, options, labels,
}: { value: string; onChange: (v: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-5 border-0 bg-transparent p-0 text-xs shadow-none focus:ring-0">
        <SelectValue>{labels?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{labels?.[o] ?? o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-[oklch(0.25_0.05_260)]">{label}</div>
      <div className="text-[oklch(0.45_0.02_260)]">{value}</div>
    </div>
  );
}
