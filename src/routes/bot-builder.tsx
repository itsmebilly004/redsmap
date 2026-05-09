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
import {
  send,
  setAuthenticatedAccount,
  getTradingSocketAccountId,
  contractTypeFor,
  type TradeCategory,
} from "@/lib/deriv";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Blocks,
  ChevronDown,
  ChevronRight,
  CloudCheck,
  Copy,
  Download,
  FolderOpen,
  GripVertical,
  Info,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Square,
  Trash2,
  Undo2,
  Upload,
  Wallet,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { BOT_PRESETS } from "./trading-bots";

export const Route = createFileRoute("/bot-builder")({
  validateSearch: z.object({ preset: z.string().optional() }),
  component: BotBuilder,
});

const MARKETS: Record<string, string> = {
  R_10: "Volatility 10 Index",
  R_25: "Volatility 25 Index",
  R_50: "Volatility 50 Index",
  R_75: "Volatility 75 Index",
  R_100: "Volatility 100 Index",
  "1HZ10V": "Volatility 10 (1s) Index",
  "1HZ25V": "Volatility 25 (1s) Index",
  "1HZ50V": "Volatility 50 (1s) Index",
  "1HZ75V": "Volatility 75 (1s) Index",
  "1HZ100V": "Volatility 100 (1s) Index",
};

const TRADE_TYPE_LABELS: Record<TradeCategory, string> = {
  rise_fall: "Rise/Fall",
  higher_lower: "Higher/Lower",
  touch_no_touch: "Touch/No Touch",
  even_odd: "Even/Odd",
  over_under: "Over/Under",
  matches_differs: "Matches/Differs",
  accumulator: "Accumulator",
  multiplier: "Multiplier",
};

const SIDE_OPTIONS: Record<TradeCategory, { value: string; label: string }[]> = {
  rise_fall: [
    { value: "up", label: "Rise" },
    { value: "down", label: "Fall" },
  ],
  higher_lower: [
    { value: "higher", label: "Higher" },
    { value: "lower", label: "Lower" },
  ],
  touch_no_touch: [
    { value: "touch", label: "Touch" },
    { value: "no_touch", label: "No touch" },
  ],
  even_odd: [
    { value: "even", label: "Even" },
    { value: "odd", label: "Odd" },
  ],
  over_under: [
    { value: "over", label: "Over" },
    { value: "under", label: "Under" },
  ],
  matches_differs: [
    { value: "matches", label: "Matches" },
    { value: "differs", label: "Differs" },
  ],
  accumulator: [{ value: "buy", label: "Buy accumulator" }],
  multiplier: [
    { value: "up", label: "Multiplier up" },
    { value: "down", label: "Multiplier down" },
  ],
};

const BLOCK_MENU = [
  {
    id: "params",
    title: "Set up your trade",
    blocks: ["Trade parameters", "Trade options", "Market list"],
  },
  {
    id: "purchase",
    title: "Purchase contract",
    blocks: ["Purchase conditions", "Purchase contract", "Prediction"],
  },
  {
    id: "sell",
    title: "Sell conditions",
    blocks: ["Sell at profit", "Sell at loss", "Check contract"],
  },
  {
    id: "restart",
    title: "Trade again",
    blocks: ["Restart trading conditions", "Stop limits", "Repeat trade"],
  },
  { id: "analysis", title: "Analysis", blocks: ["Last digit", "Total profit/loss", "Win rate"] },
  { id: "utility", title: "Utility", blocks: ["Variables", "Math", "Logic", "Notifications"] },
];

type JournalEntry = { time: string; message: string; type: "info" | "success" | "error" };
type BotProposalPayload = Record<string, unknown> & {
  proposal: 1;
  amount: number;
  basis: "stake";
  contract_type: string;
  currency: string;
  underlying_symbol: string;
  duration: number;
  duration_unit: string;
  barrier?: string;
  limit_order?: {
    take_profit?: number;
    stop_loss?: number;
  };
};

function BotBuilder() {
  const { user } = useAuth();
  const { preset } = Route.useSearch();
  const { account: derivAccount, currency: derivCurrency } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  const [botId, setBotId] = useState<string | null>(null);
  const [botName, setBotName] = useState("ArkTrader Bot");
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenu, setOpenMenu] = useState("params");
  const [activeBlocks, setActiveBlocks] = useState<string[]>(["params", "purchase", "restart"]);

  const [symbol, setSymbol] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeCategory>("rise_fall");
  const [purchaseSide, setPurchaseSide] = useState("up");
  const [initialStake, setInitialStake] = useState(1);
  const [currentStake, setCurrentStake] = useState(1);
  const [martingale, setMartingale] = useState(2);
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState("t");
  const [predictionDigit, setPredictionDigit] = useState(5);
  const [barrierOffset, setBarrierOffset] = useState("+0.10");
  const [takeProfit, setTakeProfit] = useState(10);
  const [stopLoss, setStopLoss] = useState(10);
  const [maxRuns, setMaxRuns] = useState(25);
  const [sellAtProfit, setSellAtProfit] = useState(0);
  const [sellAtLoss, setSellAtLoss] = useState(0);

  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("saved");
  const [panelTab, setPanelTab] = useState("summary");
  const [stats, setStats] = useState({
    runs: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    stake: 0,
    payout: 0,
  });
  const [journal, setJournal] = useState<JournalEntry[]>([]);

  const availableSides = SIDE_OPTIONS[tradeType];
  const filteredMenu = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return BLOCK_MENU;
    return BLOCK_MENU.map((group) => ({
      ...group,
      blocks: group.blocks.filter((block) => block.toLowerCase().includes(query)),
    })).filter((group) => group.title.toLowerCase().includes(query) || group.blocks.length > 0);
  }, [searchTerm]);

  useEffect(() => {
    if (!availableSides.some((side) => side.value === purchaseSide)) {
      setPurchaseSide(availableSides[0]?.value ?? "up");
    }
  }, [availableSides, purchaseSide]);

  useEffect(() => {
    if (!running) setCurrentStake(initialStake);
  }, [initialStake, running]);

  useEffect(() => {
    if (!preset) return;
    const config = BOT_PRESETS.find((item) => item.id === preset);
    if (!config) return;
    const nextTradeType = config.tradeType as TradeCategory;
    setBotName(config.name);
    setSymbol(config.market);
    setTradeType(nextTradeType);
    setPurchaseSide(config.contractType ?? SIDE_OPTIONS[nextTradeType]?.[0]?.value ?? "up");
    setInitialStake(config.stake);
    setCurrentStake(config.stake);
    setTakeProfit(config.tp);
    setStopLoss(config.sl);
    setMartingale(config.martingale);
    setPredictionDigit(5);
    setActiveBlocks(["params", "purchase", "restart"]);
  }, [preset]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(async () => {
      setSaveStatus("saving");
      const strategy = {
        symbol,
        tradeType,
        purchaseSide,
        initialStake,
        martingale,
        duration,
        durationUnit,
        predictionDigit,
        barrierOffset,
        takeProfit,
        stopLoss,
        maxRuns,
        sellAtProfit,
        sellAtLoss,
        activeBlocks,
      };

      const { data, error } = await supabase
        .from("bots")
        .upsert({
          id: botId || undefined,
          user_id: user.id,
          name: botName,
          strategy,
          status: running ? "running" : "stopped",
        })
        .select("id")
        .single();

      if (error) {
        setSaveStatus("idle");
        return;
      }
      setBotId(data.id);
      setSaveStatus("saved");
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [
    activeBlocks,
    barrierOffset,
    botId,
    botName,
    duration,
    durationUnit,
    initialStake,
    martingale,
    maxRuns,
    predictionDigit,
    purchaseSide,
    running,
    sellAtLoss,
    sellAtProfit,
    stopLoss,
    symbol,
    takeProfit,
    tradeType,
    user,
  ]);

  function addBlock(id: string) {
    setActiveBlocks((blocks) => (blocks.includes(id) ? blocks : [...blocks, id]));
  }

  function removeBlock(id: string) {
    setActiveBlocks((blocks) => blocks.filter((block) => block !== id));
  }

  function resetWorkspace() {
    setRunning(false);
    runningRef.current = false;
    setStats({ runs: 0, wins: 0, losses: 0, profit: 0, stake: 0, payout: 0 });
    setJournal([]);
    setCurrentStake(initialStake);
    toast.success("Workspace reset");
  }

  function loadPreset(id: string) {
    const config = BOT_PRESETS.find((item) => item.id === id);
    if (!config) return;
    const nextTradeType = config.tradeType as TradeCategory;
    setBotName(config.name);
    setSymbol(config.market);
    setTradeType(nextTradeType);
    setPurchaseSide(config.contractType ?? SIDE_OPTIONS[nextTradeType]?.[0]?.value ?? "up");
    setInitialStake(config.stake);
    setCurrentStake(config.stake);
    setTakeProfit(config.tp);
    setStopLoss(config.sl);
    setMartingale(config.martingale);
    setActiveBlocks(["params", "purchase", "restart"]);
    toast.success(`${config.name} loaded`);
  }

  function logJournal(message: string, type: JournalEntry["type"] = "info") {
    setJournal((entries) =>
      [{ time: new Date().toLocaleTimeString(), message, type }, ...entries].slice(0, 80),
    );
  }

  function toggleBot() {
    if (!token) {
      toast.error("Connect Deriv first.");
      return;
    }
    const next = !running;
    setRunning(next);
    runningRef.current = next;
    if (next) {
      logJournal("Trading engine started", "success");
      void runCycle();
    } else {
      logJournal("Trading engine stopped", "error");
    }
  }

  async function runCycle() {
    if (!token || !runningRef.current) return;
    if (!derivAccount) {
      logJournal("Select a Deriv account before running the bot.", "error");
      setRunning(false);
      runningRef.current = false;
      return;
    }
    if (
      stats.runs >= maxRuns ||
      stats.profit >= takeProfit ||
      stats.profit <= -Math.abs(stopLoss)
    ) {
      logJournal("Stop condition reached", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      const contractType = contractTypeFor(tradeType, purchaseSide);
      const proposal: BotProposalPayload = {
        proposal: 1,
        amount: currentStake,
        basis: "stake",
        contract_type: contractType,
        currency: derivCurrency || "USD",
        underlying_symbol: symbol,
        duration,
        duration_unit: durationUnit,
      };

      if (["over_under", "matches_differs"].includes(tradeType))
        proposal.barrier = String(predictionDigit);
      if (["higher_lower", "touch_no_touch"].includes(tradeType)) proposal.barrier = barrierOffset;
      if (sellAtProfit > 0 || sellAtLoss > 0) {
        proposal.limit_order = {};
        if (sellAtProfit > 0) proposal.limit_order.take_profit = sellAtProfit;
        if (sellAtLoss > 0) proposal.limit_order.stop_loss = sellAtLoss;
      }
      setAuthenticatedAccount(
        token,
        derivAccount.account_id,
        derivAccount.is_virtual ?? derivAccount.is_demo,
      );
      console.info("[Deriv Bot] Placing trade", {
        selectedAccountId: derivAccount.account_id,
        selectedLoginId: derivAccount.loginid,
        is_demo: derivAccount.is_demo,
        is_virtual: derivAccount.is_virtual,
        wsAccountId: getTradingSocketAccountId(),
        finalProposalPayload: proposal,
      });

      const quote = await send(proposal);
      const proposalId = quote.proposal?.id;
      if (!proposalId) throw new Error("No proposal returned");

      const buy = await send({ buy: proposalId, price: currentStake });
      const contractId = buy.buy?.contract_id;
      logJournal(`Purchased ${contractType} on ${symbol}`, "success");

      const poll = setInterval(async () => {
        if (!runningRef.current) {
          clearInterval(poll);
          return;
        }
        const response = await send({ proposal_open_contract: 1, contract_id: contractId });
        const contract = response.proposal_open_contract;
        if (!contract?.is_sold) return;

        clearInterval(poll);
        const pnl = Number(contract.profit ?? 0);
        const won = pnl > 0;
        setStats((current) => ({
          runs: current.runs + 1,
          wins: current.wins + (won ? 1 : 0),
          losses: current.losses + (won ? 0 : 1),
          profit: current.profit + pnl,
          stake: current.stake + currentStake,
          payout: current.payout + Number(contract.payout ?? 0),
        }));
        setCurrentStake(won ? initialStake : Number((currentStake * martingale).toFixed(2)));
        logJournal(
          `${won ? "Win" : "Loss"} ${pnl.toFixed(2)} ${derivCurrency || ""}`,
          won ? "success" : "error",
        );
        if (runningRef.current) setTimeout(runCycle, 750);
      }, 1000);
    } catch (error: unknown) {
      logJournal(error instanceof Error ? error.message : "Bot execution failed", "error");
      setRunning(false);
      runningRef.current = false;
    }
  }

  return (
    <TopShell>
      <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[#f2f3f4] text-[#333333] lg:h-[calc(100dvh-104px)] lg:flex-row">
        <aside className="flex max-h-[45dvh] w-full shrink-0 flex-col border-b border-[#dedede] bg-white lg:max-h-none lg:w-[280px] lg:border-b-0 lg:border-r xl:w-[312px]">
          <div className="border-b border-[#e6e6e6] p-3">
            <Button className="h-10 w-full rounded bg-[#ff444f] text-sm font-bold text-white hover:bg-[#eb3e48]">
              Quick strategy
            </Button>
          </div>

          <Tabs defaultValue="blocks" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid h-11 grid-cols-2 rounded-none border-b border-[#e6e6e6] bg-white p-0">
              <TabsTrigger
                value="blocks"
                className="rounded-none border-b-2 border-transparent text-xs font-bold data-[state=active]:border-[#ff444f] data-[state=active]:shadow-none"
              >
                Blocks menu
              </TabsTrigger>
              <TabsTrigger
                value="presets"
                className="rounded-none border-b-2 border-transparent text-xs font-bold data-[state=active]:border-[#ff444f] data-[state=active]:shadow-none"
              >
                Presets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="blocks" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#999999]" />
                <Input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search"
                  className="h-10 rounded border-[#d6d6d6] bg-[#f7f7f7] pl-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                {filteredMenu.map((group) => (
                  <div key={group.id} className="rounded border border-[#eeeeee] bg-white">
                    <button
                      onClick={() => setOpenMenu(openMenu === group.id ? "" : group.id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-bold hover:bg-[#f6f6f6]"
                    >
                      {group.title}
                      <ChevronDown
                        className={cn("size-4 transition", openMenu === group.id && "rotate-180")}
                      />
                    </button>
                    {openMenu === group.id && (
                      <div className="space-y-1 border-t border-[#eeeeee] bg-[#fafafa] p-2">
                        {group.blocks.map((block) => (
                          <button
                            key={block}
                            onClick={() => addBlock(group.id)}
                            className="flex w-full items-center justify-between rounded border border-[#e4e4e4] bg-white px-3 py-2 text-left text-xs font-medium hover:border-[#ff444f]"
                          >
                            <span>{block}</span>
                            <Plus className="size-3.5 text-[#ff444f]" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="presets" className="m-0 min-h-0 flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
                {BOT_PRESETS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadPreset(item.id)}
                    className="w-full rounded border border-[#e5e5e5] bg-white p-3 text-left hover:border-[#ff444f] hover:bg-[#fff7f7]"
                  >
                    <div className="text-sm font-bold">{item.name}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-5 text-[#646464]">
                      {item.desc}
                    </div>
                    <div className="mt-2 flex gap-1 text-[10px] font-bold uppercase text-[#777777]">
                      <span className="rounded bg-[#f2f3f4] px-2 py-1">{item.market}</span>
                      <span className="rounded bg-[#f2f3f4] px-2 py-1">
                        {item.tradeType.replace("_", " ")}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        <main className="flex min-h-[520px] min-w-0 flex-1 flex-col border-b border-[#dedede] lg:min-h-0 lg:border-b-0 lg:border-r">
          <div className="flex min-h-12 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#dedede] bg-white px-2 py-2 sm:px-3">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <ToolbarButton
                icon={FolderOpen}
                label="Import"
                onClick={() => toast.message("Import XML is not wired yet")}
              />
              <ToolbarButton
                icon={Upload}
                label="Upload"
                onClick={() => toast.message("Upload is not wired yet")}
              />
              <ToolbarButton icon={Save} label="Save" onClick={() => toast.success("Bot saved")} />
              <ToolbarButton
                icon={Download}
                label="Download"
                onClick={() => toast.message("Download XML is not wired yet")}
              />
              <div className="mx-1 hidden h-6 w-px bg-[#e1e1e1] sm:block" />
              <ToolbarButton icon={Undo2} label="Undo" />
              <ToolbarButton icon={Redo2} label="Redo" />
              <ToolbarButton icon={ZoomIn} label="Zoom in" />
              <ToolbarButton icon={ZoomOut} label="Zoom out" />
              <ToolbarButton icon={RotateCcw} label="Reset" onClick={resetWorkspace} />
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded border border-[#e4e4e4] bg-[#fafafa] px-3 py-1.5">
              {saveStatus === "saving" ? (
                <RefreshCw className="size-3.5 animate-spin text-[#377cbd]" />
              ) : (
                <CloudCheck className="size-3.5 text-[#4bb4b3]" />
              )}
              <span className="text-[11px] font-bold uppercase text-[#646464]">
                {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Offline"}
              </span>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-auto bg-[#f7f8f9]">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(#e8e8e8_1px,transparent_1px),linear-gradient(90deg,#e8e8e8_1px,transparent_1px)] [background-size:24px_24px]" />
            <div className="relative flex min-h-full w-full min-w-0 flex-col items-start gap-4 p-3 pb-20 sm:p-5 lg:gap-5 lg:p-8 lg:pb-24">
              <div className="flex w-full min-w-0 flex-wrap items-center gap-2 rounded border border-[#d9d9d9] bg-white px-3 py-2 shadow-sm sm:w-auto sm:gap-3 sm:px-4">
                <Blocks className="size-4 text-[#ff444f]" />
                <Input
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                  className="h-8 min-w-0 flex-1 border-[#e4e4e4] text-sm font-bold sm:w-[320px] sm:flex-none"
                />
                <span className="rounded bg-[#f2f3f4] px-2 py-1 text-[10px] font-bold uppercase text-[#646464]">
                  Editable preset
                </span>
              </div>

              {activeBlocks.includes("params") && (
                <WorkspaceBlock
                  color="#0f6b8f"
                  title="1. Trade parameters"
                  onRemove={() => removeBlock("params")}
                  width="720px"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Market">
                      <InlineSelect
                        value={symbol}
                        options={Object.keys(MARKETS)}
                        labels={MARKETS}
                        onChange={setSymbol}
                      />
                    </Field>
                    <Field label="Trade type">
                      <InlineSelect
                        value={tradeType}
                        options={Object.keys(TRADE_TYPE_LABELS)}
                        labels={TRADE_TYPE_LABELS}
                        onChange={(value) => setTradeType(value as TradeCategory)}
                      />
                    </Field>
                    <Field label="Stake">
                      <NumberInput
                        value={initialStake}
                        min={0.35}
                        step={0.01}
                        onChange={setInitialStake}
                      />
                    </Field>
                    <Field label="Duration">
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <NumberInput
                          value={duration}
                          min={1}
                          step={1}
                          onChange={setDuration}
                          className="sm:w-24"
                        />
                        <InlineSelect
                          value={durationUnit}
                          options={["t", "s", "m"]}
                          labels={{ t: "Ticks", s: "Seconds", m: "Minutes" }}
                          onChange={setDurationUnit}
                        />
                      </div>
                    </Field>
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("purchase") && (
                <WorkspaceBlock
                  color="#1b8a5a"
                  title="2. Purchase conditions"
                  onRemove={() => removeBlock("purchase")}
                  width="560px"
                >
                  <div className="space-y-4">
                    <Field label="Purchase">
                      <InlineSelect
                        value={purchaseSide}
                        options={availableSides.map((side) => side.value)}
                        labels={Object.fromEntries(
                          availableSides.map((side) => [side.value, side.label]),
                        )}
                        onChange={setPurchaseSide}
                      />
                    </Field>
                    {["over_under", "matches_differs"].includes(tradeType) && (
                      <Field label="Prediction digit">
                        <InlineSelect
                          value={String(predictionDigit)}
                          options={["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]}
                          onChange={(value) => setPredictionDigit(Number(value))}
                        />
                      </Field>
                    )}
                    {["higher_lower", "touch_no_touch"].includes(tradeType) && (
                      <Field label="Barrier offset">
                        <Input
                          value={barrierOffset}
                          onChange={(event) => setBarrierOffset(event.target.value)}
                          className="h-8 w-32 border-[#d6d6d6]"
                        />
                      </Field>
                    )}
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("sell") && (
                <WorkspaceBlock
                  color="#d47b00"
                  title="3. Sell conditions"
                  onRemove={() => removeBlock("sell")}
                  width="520px"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Sell at profit">
                      <NumberInput
                        value={sellAtProfit}
                        min={0}
                        step={0.01}
                        onChange={setSellAtProfit}
                      />
                    </Field>
                    <Field label="Sell at loss">
                      <NumberInput
                        value={sellAtLoss}
                        min={0}
                        step={0.01}
                        onChange={setSellAtLoss}
                      />
                    </Field>
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("restart") && (
                <WorkspaceBlock
                  color="#6b4ca6"
                  title="4. Restart trading conditions"
                  onRemove={() => removeBlock("restart")}
                  width="680px"
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Take profit">
                      <NumberInput
                        value={takeProfit}
                        min={0}
                        step={0.01}
                        onChange={setTakeProfit}
                      />
                    </Field>
                    <Field label="Stop loss">
                      <NumberInput value={stopLoss} min={0} step={0.01} onChange={setStopLoss} />
                    </Field>
                    <Field label="Recovery multiplier">
                      <NumberInput
                        value={martingale}
                        min={1}
                        step={0.05}
                        onChange={setMartingale}
                      />
                    </Field>
                    <Field label="Max runs">
                      <NumberInput value={maxRuns} min={1} step={1} onChange={setMaxRuns} />
                    </Field>
                  </div>
                </WorkspaceBlock>
              )}

              <div className="absolute bottom-8 right-8 hidden size-24 items-center justify-center rounded border-2 border-dashed border-[#d0d0d0] bg-white/80 text-[#999999] lg:flex">
                <Trash2 className="size-9" />
              </div>
            </div>
          </div>
        </main>

        <aside className="flex w-full shrink-0 flex-col bg-white lg:w-[320px] xl:w-[360px]">
          <div className="border-b border-[#dedede] p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="size-4 text-[#646464]" />
              <div className="min-w-0">
                <div className="text-xs font-bold uppercase text-[#999999]">Account</div>
                <div className="truncate text-sm font-bold">
                  {derivAccount?.account_id ?? "No Deriv account"}
                </div>
              </div>
            </div>
            <Button
              onClick={toggleBot}
              className={cn(
                "h-12 w-full rounded text-sm font-bold text-white",
                running ? "bg-[#ff444f] hover:bg-[#eb3e48]" : "bg-[#4bb4b3] hover:bg-[#399998]",
              )}
            >
              {running ? (
                <Square className="mr-2 size-4 fill-current" />
              ) : (
                <Play className="mr-2 size-4 fill-current" />
              )}
              {running ? "Stop" : "Run"}
            </Button>
          </div>

          <Tabs
            value={panelTab}
            onValueChange={setPanelTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="grid h-11 grid-cols-2 rounded-none border-b border-[#dedede] bg-white p-0">
              <TabsTrigger
                value="summary"
                className="rounded-none border-b-2 border-transparent text-xs font-bold data-[state=active]:border-[#ff444f] data-[state=active]:shadow-none"
              >
                Summary
              </TabsTrigger>
              <TabsTrigger
                value="journal"
                className="rounded-none border-b-2 border-transparent text-xs font-bold data-[state=active]:border-[#ff444f] data-[state=active]:shadow-none"
              >
                Journal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="m-0 flex-1 p-4">
              <div className="rounded border border-[#e5e5e5] bg-[#fafafa] p-4">
                <div className="text-[10px] font-bold uppercase text-[#999999]">
                  Total profit/loss
                </div>
                <div
                  className={cn(
                    "mt-1 font-mono text-4xl font-bold",
                    stats.profit >= 0 ? "text-[#0b8f62]" : "text-[#ff444f]",
                  )}
                >
                  {stats.profit >= 0 ? "+" : ""}
                  {stats.profit.toFixed(2)}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Metric label="Runs" value={stats.runs} />
                <Metric label="Wins" value={stats.wins} />
                <Metric label="Losses" value={stats.losses} />
                <Metric label="Stake" value={stats.stake.toFixed(2)} />
              </div>

              <div className="mt-4 rounded border border-[#e5e5e5] bg-white p-4 text-sm">
                <div className="mb-3 flex items-center gap-2 font-bold">
                  <Settings2 className="size-4" />
                  Active configuration
                </div>
                <SummaryRow label="Market" value={MARKETS[symbol] ?? symbol} />
                <SummaryRow label="Trade" value={TRADE_TYPE_LABELS[tradeType]} />
                <SummaryRow
                  label="Purchase"
                  value={
                    availableSides.find((side) => side.value === purchaseSide)?.label ??
                    purchaseSide
                  }
                />
                <SummaryRow label="Stake" value={`${initialStake} ${derivCurrency || "USD"}`} />
              </div>

              <Button
                variant="outline"
                onClick={resetWorkspace}
                className="mt-4 h-10 w-full rounded border-[#d6d6d6] text-sm font-bold"
              >
                Reset stats
              </Button>
            </TabsContent>

            <TabsContent
              value="journal"
              className="m-0 min-h-0 flex-1 overflow-y-auto bg-[#fafafa] p-3"
            >
              {journal.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-sm text-[#777777]">
                  <Info className="mb-2 size-5" />
                  Journal entries appear when the bot runs.
                </div>
              ) : (
                <div className="space-y-2">
                  {journal.map((entry, index) => (
                    <div
                      key={`${entry.time}-${index}`}
                      className={cn(
                        "rounded border bg-white p-3 text-xs",
                        entry.type === "success" && "border-[#bde8dc] text-[#0b7757]",
                        entry.type === "error" && "border-[#ffd1d4] text-[#cc2f39]",
                        entry.type === "info" && "border-[#e5e5e5] text-[#555555]",
                      )}
                    >
                      <div className="mb-1 text-[10px] font-bold uppercase opacity-60">
                        {entry.time}
                      </div>
                      {entry.message}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </TopShell>
  );
}

function WorkspaceBlock({
  children,
  color,
  onRemove,
  title,
  width,
}: {
  children: React.ReactNode;
  color: string;
  onRemove: () => void;
  title: string;
  width: string;
}) {
  return (
    <div
      className="relative min-w-0 rounded border border-[#cfcfcf] bg-white shadow-sm"
      style={{ width, maxWidth: "100%" }}
    >
      <div className="absolute -left-3 top-8 hidden h-6 w-3 rounded-l bg-white shadow-[inset_0_0_0_1px_#cfcfcf] sm:block" />
      <div className="absolute -right-3 top-16 hidden h-6 w-3 rounded-r bg-white shadow-[inset_0_0_0_1px_#cfcfcf] sm:block" />
      <div
        className="flex items-center justify-between rounded-t px-3 py-2 text-white"
        style={{ backgroundColor: color }}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <GripVertical className="size-4 opacity-70" />
          <span className="truncate">{title}</span>
        </div>
        <button
          onClick={onRemove}
          className="rounded p-1 hover:bg-white/15"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-xs font-bold text-[#646464] hover:bg-[#f2f3f4] hover:text-[#333333]"
      title={label}
    >
      <Icon className="size-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex min-h-10 min-w-0 flex-col gap-2 rounded border border-[#eeeeee] bg-[#fafafa] px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Label className="shrink-0 text-xs font-bold text-[#555555]">{label}</Label>
      <div className="min-w-0 sm:max-w-[65%]">{children}</div>
    </div>
  );
}

function InlineSelect({
  labels,
  onChange,
  options,
  value,
}: {
  labels?: Record<string, string>;
  onChange?: (value: string) => void;
  options: string[];
  value: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full min-w-0 rounded border-[#d6d6d6] bg-white px-3 text-xs font-bold sm:w-[190px]">
        <SelectValue>{labels?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-white">
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-xs font-bold">
            {labels?.[option] ?? option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NumberInput({
  className,
  min,
  onChange,
  step,
  value,
}: {
  className?: string;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <Input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn(
        "h-8 w-full rounded border-[#d6d6d6] bg-white text-right font-mono text-xs font-bold sm:w-32",
        className,
      )}
    />
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-[#e5e5e5] bg-white p-3">
      <div className="text-[10px] font-bold uppercase text-[#999999]">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-[#eeeeee] py-2 first:border-t-0">
      <span className="text-xs font-bold text-[#777777]">{label}</span>
      <span className="max-w-[170px] truncate text-right text-xs font-bold">{value}</span>
    </div>
  );
}
