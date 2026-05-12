import { createFileRoute } from "@tanstack/react-router";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import {
  send,
  ensureDerivTradingConnection,
  getDerivTradingErrorMessage,
  getStatus,
  getTradingSocketAccountId,
  tradingAuthorizationIsFresh,
  type TradeCategory,
} from "@/lib/deriv";
import { buildAccumulatorProposalPayload } from "@/lib/accumulator-engine";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import { buyProposal, requestProposal } from "@/lib/deriv-trading-service";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BarChart3,
  Blocks,
  ChevronDown,
  ChevronRight,
  CloudCheck,
  Copy,
  DollarSign,
  Download,
  FileJson,
  FolderOpen,
  GripVertical,
  History,
  Info,
  ListChecks,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Play,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isDemoAccount } from "@/lib/deriv-account";
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
  { id: "params", title: "Trade parameters", blocks: [] },
  { id: "purchase", title: "Purchase conditions", blocks: [] },
  { id: "sell", title: "Sell conditions", blocks: [] },
  { id: "restart", title: "Restart trading conditions", blocks: [] },
  { id: "analysis", title: "Analysis", blocks: ["Last digit", "Total profit/loss", "Win rate"] },
  { id: "utility", title: "Utility", blocks: ["Variables", "Logic", "Notifications"] },
];

const INITIAL_BLOCK_POSITIONS: Record<string, { x: number; y: number }> = {
  params: { x: 36, y: 40 },
  purchase: { x: 560, y: 42 },
  sell: { x: 560, y: 238 },
  restart: { x: 36, y: 455 },
  analysis: { x: 920, y: 42 },
  utility: { x: 920, y: 270 },
};

const BLOCK_DIMENSIONS: Record<string, { height: number; width: number }> = {
  params: { width: 470, height: 360 },
  purchase: { width: 340, height: 145 },
  sell: { width: 360, height: 180 },
  restart: { width: 320, height: 135 },
  analysis: { width: 360, height: 170 },
  utility: { width: 360, height: 170 },
};

type JournalEntry = { time: string; message: string; type: "info" | "success" | "error" };
type BotStats = {
  losses: number;
  payout: number;
  profit: number;
  runs: number;
  stake: number;
  wins: number;
};
type TradePanelMode = "hidden" | "collapsed" | "expanded";
type TradeRecord = {
  closedAt?: string;
  contractId: string;
  contractType: string;
  currency: string;
  id: string;
  market: string;
  openedAt: string;
  payout?: number;
  profit?: number;
  side: string;
  stake: number;
  status: "open" | "won" | "lost";
};
type BotBuilderSnapshot = {
  activeBlocks: string[];
  barrierOffset: string;
  botName: string;
  duration: number;
  durationUnit: string;
  initialStake: number;
  martingale: number;
  maxRuns: number;
  predictionDigit: number;
  purchaseSide: string;
  sellAtLoss: number;
  sellAtProfit: number;
  stopLoss: number;
  symbol: string;
  takeProfit: number;
  tradeType: TradeCategory;
  workspaceZoom: number;
};
function BotBuilder() {
  const { user } = useAuth();
  const { preset } = Route.useSearch();
  const {
    account: derivAccount,
    currency: derivCurrency,
    refreshBalances,
  } = useDerivBalanceContext();
  const token = derivAccount?.deriv_token ?? null;

  const [botId, setBotId] = useState<string | null>(null);
  const [botName, setBotName] = useState("ArkTrader Bot");
  const [searchTerm, setSearchTerm] = useState("");
  const [openMenu, setOpenMenu] = useState("params");
  const [blocksMenuCollapsed, setBlocksMenuCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  });
  const [activeBlocks, setActiveBlocks] = useState<string[]>([
    "params",
    "purchase",
    "sell",
    "restart",
  ]);
  const [blockPositions, setBlockPositions] =
    useState<Record<string, { x: number; y: number }>>(INITIAL_BLOCK_POSITIONS);
  const [draggingBlock, setDraggingBlock] = useState<string | null>(null);
  const [trashActive, setTrashActive] = useState(false);
  const [athenaEnabled, setAthenaEnabled] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [tradePanelMode, setTradePanelMode] = useState<TradePanelMode>("hidden");
  const [tradePanelDismissed, setTradePanelDismissed] = useState(false);
  const [utcNow, setUtcNow] = useState(() => new Date());

  const [symbol, setSymbol] = useState("1HZ100V");
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const trashRef = useRef<HTMLButtonElement | null>(null);
  const dragStateRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{
    id: string;
    overTrash: boolean;
    x: number;
    y: number;
  } | null>(null);
  const lastSnapshotRef = useRef<string>("");
  const applyingHistoryRef = useRef(false);
  const saveBotNowRef = useRef<(showToast?: boolean) => Promise<void>>(async () => {});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">("saved");
  const [panelTab, setPanelTab] = useState("summary");
  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const [workspaceZoom, setWorkspaceZoom] = useState(1);
  const [stats, setStats] = useState<BotStats>({
    runs: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    stake: 0,
    payout: 0,
  });
  const statsRef = useRef(stats);
  const currentStakeRef = useRef(currentStake);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [tradeRecords, setTradeRecords] = useState<TradeRecord[]>([]);

  const availableSides = SIDE_OPTIONS[tradeType];
  const snapshot = useMemo<BotBuilderSnapshot>(
    () => ({
      activeBlocks,
      barrierOffset,
      botName,
      duration,
      durationUnit,
      initialStake,
      martingale,
      maxRuns,
      predictionDigit,
      purchaseSide,
      sellAtLoss,
      sellAtProfit,
      stopLoss,
      symbol,
      takeProfit,
      tradeType,
      workspaceZoom,
    }),
    [
      activeBlocks,
      barrierOffset,
      botName,
      duration,
      durationUnit,
      initialStake,
      martingale,
      maxRuns,
      predictionDigit,
      purchaseSide,
      sellAtLoss,
      sellAtProfit,
      stopLoss,
      symbol,
      takeProfit,
      tradeType,
      workspaceZoom,
    ],
  );
  const filteredMenu = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return BLOCK_MENU;
    return BLOCK_MENU.map((group) => ({
      ...group,
      blocks: group.blocks.filter((block) => block.toLowerCase().includes(query)),
    })).filter((group) => group.title.toLowerCase().includes(query) || group.blocks.length > 0);
  }, [searchTerm]);
  const workspaceSize = useMemo(() => {
    return activeBlocks.reduce(
      (size, id) => {
        const position = blockPositions[id] ?? INITIAL_BLOCK_POSITIONS[id] ?? { x: 40, y: 40 };
        const dimensions = BLOCK_DIMENSIONS[id] ?? { width: 360, height: 180 };
        return {
          height: Math.max(size.height, position.y + dimensions.height + 140),
          width: Math.max(size.width, position.x + dimensions.width + 120),
        };
      },
      { height: 760, width: 1160 },
    );
  }, [activeBlocks, blockPositions]);

  useEffect(() => {
    const interval = window.setInterval(() => setUtcNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!draggingBlock) return;

    function pointerToWorkspace(event: PointerEvent) {
      const workspace = workspaceRef.current;
      if (!workspace) return null;
      const rect = workspace.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    }

    function pointerIsOverTrash(event: PointerEvent) {
      const rect = trashRef.current?.getBoundingClientRect();
      if (!rect) return false;
      return (
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      );
    }

    function handlePointerMove(event: PointerEvent) {
      const dragState = dragStateRef.current;
      const point = pointerToWorkspace(event);
      if (!dragState || !point) return;
      pendingDragRef.current = {
        id: dragState.id,
        overTrash: pointerIsOverTrash(event),
        x: Math.max(0, Math.round(point.x - dragState.offsetX)),
        y: Math.max(0, Math.round(point.y - dragState.offsetY)),
      };
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = window.requestAnimationFrame(() => {
        const pending = pendingDragRef.current;
        dragFrameRef.current = null;
        if (!pending) return;
        setBlockPositions((positions) => {
          const current = positions[pending.id];
          if (current?.x === pending.x && current.y === pending.y) return positions;
          return {
            ...positions,
            [pending.id]: { x: pending.x, y: pending.y },
          };
        });
        setTrashActive(pending.overTrash);
      });
    }

    function handlePointerUp(event: PointerEvent) {
      const dragState = dragStateRef.current;
      const shouldDelete = pointerIsOverTrash(event);
      if (dragState && shouldDelete) {
        removeBlock(dragState.id);
        toast.success("Block removed");
      }
      dragStateRef.current = null;
      pendingDragRef.current = null;
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      setDraggingBlock(null);
      setTrashActive(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
    };
  }, [draggingBlock]);

  useEffect(() => {
    if (!availableSides.some((side) => side.value === purchaseSide)) {
      setPurchaseSide(availableSides[0]?.value ?? "up");
    }
  }, [availableSides, purchaseSide]);

  useEffect(() => {
    if (!running) setCurrentStake(initialStake);
  }, [initialStake, running]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    currentStakeRef.current = currentStake;
  }, [currentStake]);

  useEffect(() => {
    if (!derivAccount || !token) return;
    const preparedAuthorizationFresh =
      Boolean(derivAccount.token_source && derivAccount.trading_adapter) &&
      tradingAuthorizationIsFresh({
        account_id: derivAccount.account_id,
        trading_authorized: Boolean(derivAccount.trading_authorized),
        trading_adapter: derivAccount.trading_adapter!,
        token_source: derivAccount.token_source!,
        trading_authorized_at: derivAccount.trading_authorized_at ?? null,
        last_trading_error: derivAccount.last_trading_error ?? null,
      });
    console.info("[Deriv Bot] page load active dashboard account", {
      selectedAccountId: derivAccount.account_id,
      loginid: derivAccount.loginid,
      is_demo: derivAccount.is_demo,
      normalizedType: derivAccount.normalizedType,
      token_source: derivAccount.token_source ?? null,
      deriv_token_exists: Boolean(derivAccount.deriv_token),
      expires_at: derivAccount.expires_at ?? null,
      trading_authorized: derivAccount.trading_authorized ?? false,
      trading_adapter: derivAccount.trading_adapter ?? null,
      trading_authorized_at: derivAccount.trading_authorized_at ?? null,
      tradingAuthorizationFresh: preparedAuthorizationFresh,
      last_trading_error: derivAccount.last_trading_error ?? null,
    });
    console.info("[Deriv Bot] page-load trading authorization retry skipped", {
      selectedAccountId: derivAccount.account_id,
      loginid: derivAccount.loginid,
      normalizedType: derivAccount.normalizedType,
      token_source: derivAccount.token_source ?? null,
      tradingAuthorizationFresh: preparedAuthorizationFresh,
      last_trading_error: derivAccount.last_trading_error ?? null,
      connectionStatus: getStatus(),
      websocketAccountId: getTradingSocketAccountId(),
      reason:
        "Bot page load does not retry OAuth OTP; starting the bot will prepare the trading connection once.",
    });
  }, [
    derivAccount?.account_id,
    derivAccount,
    derivAccount?.deriv_token,
    derivAccount?.expires_at,
    derivAccount?.normalizedType,
    derivAccount?.token_source,
    derivAccount?.trading_authorized,
    derivAccount?.trading_adapter,
    derivAccount?.trading_authorized_at,
    derivAccount?.last_trading_error,
    token,
  ]);

  useEffect(() => {
    const serialized = JSON.stringify(snapshot);
    if (!lastSnapshotRef.current) {
      lastSnapshotRef.current = serialized;
      return;
    }
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      lastSnapshotRef.current = serialized;
      return;
    }
    if (serialized === lastSnapshotRef.current) return;
    setUndoStack((items) => [...items, lastSnapshotRef.current].slice(-50));
    setRedoStack([]);
    lastSnapshotRef.current = serialized;
  }, [snapshot]);

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
    setActiveBlocks(["params", "purchase", "sell", "restart"]);
  }, [preset]);

  useEffect(() => {
    if (!user) return;
    const timeoutId = setTimeout(async () => {
      setSaveStatus("saving");
      await saveBotNowRef.current(false);
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
    workspaceZoom,
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
    setTradeRecords([]);
    setTradePanelMode("hidden");
    setTradePanelDismissed(false);
    setCurrentStake(initialStake);
    toast.success("Workspace reset");
  }

  function applySnapshot(next: BotBuilderSnapshot) {
    applyingHistoryRef.current = true;
    setActiveBlocks(next.activeBlocks);
    setBarrierOffset(next.barrierOffset);
    setBotName(next.botName);
    setDuration(next.duration);
    setDurationUnit(next.durationUnit);
    setInitialStake(next.initialStake);
    setCurrentStake(next.initialStake);
    setMartingale(next.martingale);
    setMaxRuns(next.maxRuns);
    setPredictionDigit(next.predictionDigit);
    setPurchaseSide(next.purchaseSide);
    setSellAtLoss(next.sellAtLoss);
    setSellAtProfit(next.sellAtProfit);
    setStopLoss(next.stopLoss);
    setSymbol(next.symbol);
    setTakeProfit(next.takeProfit);
    setTradeType(next.tradeType);
    setWorkspaceZoom(next.workspaceZoom);
  }

  function undo() {
    const previous = undoStack.at(-1);
    if (!previous) {
      toast.message("Nothing to undo");
      return;
    }
    setUndoStack((items) => items.slice(0, -1));
    setRedoStack((items) => [...items, JSON.stringify(snapshot)].slice(-50));
    applySnapshot(JSON.parse(previous) as BotBuilderSnapshot);
  }

  function redo() {
    const next = redoStack.at(-1);
    if (!next) {
      toast.message("Nothing to redo");
      return;
    }
    setRedoStack((items) => items.slice(0, -1));
    setUndoStack((items) => [...items, JSON.stringify(snapshot)].slice(-50));
    applySnapshot(JSON.parse(next) as BotBuilderSnapshot);
  }

  function quickStrategy() {
    setActiveBlocks(["params", "purchase", "sell", "restart", "analysis"]);
    setTradeType("over_under");
    setPurchaseSide("under");
    setSymbol("1HZ100V");
    setInitialStake(1);
    setCurrentStake(1);
    setDuration(1);
    setDurationUnit("t");
    setPredictionDigit(5);
    setMartingale(1.95);
    setTakeProfit(20);
    setStopLoss(10);
    setMaxRuns(50);
    setSellAtProfit(0);
    setSellAtLoss(0);
    logJournal("Quick strategy configured", "info");
    toast.success("Quick strategy configured");
  }

  async function saveBotNow(showToast = true) {
    if (!user) {
      setSaveStatus("idle");
      if (showToast) toast.error("Sign in to save bots.");
      return;
    }
    setSaveStatus("saving");
    const { workspaceZoom: _workspaceZoom, ...strategy } = snapshot;
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
      if (showToast) toast.error(error.message);
      return;
    }
    setBotId(data.id);
    setSaveStatus("saved");
    if (showToast) toast.success("Bot saved");
  }

  saveBotNowRef.current = saveBotNow;

  function exportBot() {
    const payload = {
      exportedAt: new Date().toISOString(),
      name: botName,
      type: "arktrader-bot-builder-config",
      version: 1,
      strategy: snapshot,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${
      botName
        .trim()
        .replace(/[^a-z0-9]+/gi, "-")
        .replace(/^-|-$/g, "") || "arktrader-bot"
    }.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logJournal("Bot configuration downloaded", "success");
  }

  async function importBotFile(file: File) {
    const text = await file.text();
    try {
      const payload = JSON.parse(text) as { name?: string; strategy?: Partial<BotBuilderSnapshot> };
      if (!payload.strategy) throw new Error("Missing strategy");
      applySnapshot({
        ...snapshot,
        ...payload.strategy,
        activeBlocks: payload.strategy.activeBlocks?.length
          ? payload.strategy.activeBlocks
          : snapshot.activeBlocks,
        botName: payload.name ?? payload.strategy.botName ?? file.name.replace(/\.[^.]+$/, ""),
        tradeType: (payload.strategy.tradeType ?? snapshot.tradeType) as TradeCategory,
      });
      logJournal(`Imported ${file.name}`, "success");
      toast.success("Bot imported");
    } catch {
      setBotName(file.name.replace(/\.[^.]+$/, ""));
      setActiveBlocks(["params", "purchase", "sell", "restart", "analysis"]);
      logJournal(`Imported ${file.name} as a reference file`, "info");
      toast.success("File loaded as bot reference");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void importBotFile(file);
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
    setActiveBlocks(["params", "purchase", "sell", "restart"]);
    toast.success(`${config.name} loaded`);
  }

  function logJournal(message: string, type: JournalEntry["type"] = "info") {
    setJournal((entries) =>
      [{ time: new Date().toLocaleTimeString(), message, type }, ...entries].slice(0, 80),
    );
  }

  function showTradePanel(mode: Exclude<TradePanelMode, "hidden"> = "expanded") {
    setTradePanelDismissed(false);
    setTradePanelMode(mode);
  }

  function closeTradePanel() {
    setTradePanelDismissed(true);
    setTradePanelMode("hidden");
  }

  function recordTradeOpened(trade: TradeRecord) {
    setTradeRecords((records) => [trade, ...records].slice(0, 120));
    if (!tradePanelDismissed) {
      setTradePanelMode((mode) => (mode === "hidden" ? "collapsed" : mode));
    }
  }

  function recordTradeClosed(
    id: string,
    updates: Pick<TradeRecord, "closedAt" | "payout" | "profit" | "status">,
  ) {
    setTradeRecords((records) =>
      records.map((record) => (record.id === id ? { ...record, ...updates } : record)),
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
      currentStakeRef.current = initialStake;
      setCurrentStake(initialStake);
      const stopConditionTriggered =
        statsRef.current.runs >= maxRuns ||
        statsRef.current.profit >= takeProfit ||
        statsRef.current.profit <= -Math.abs(stopLoss);
      if (stopConditionTriggered) {
        const cleared = { runs: 0, wins: 0, losses: 0, profit: 0, stake: 0, payout: 0 };
        statsRef.current = cleared;
        setStats(cleared);
        logJournal("Previous run hit a stop condition — stats cleared", "info");
      }
      if (!tradePanelDismissed)
        setTradePanelMode((mode) => (mode === "hidden" ? "collapsed" : mode));
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
    if (derivAccount.normalizedType !== "demo" && derivAccount.normalizedType !== "real") {
      logJournal("Selected Deriv account type could not be verified from its prefix.", "error");
      setRunning(false);
      runningRef.current = false;
      return;
    }
    if (
      statsRef.current.runs >= maxRuns ||
      statsRef.current.profit >= takeProfit ||
      statsRef.current.profit <= -Math.abs(stopLoss)
    ) {
      logJournal("Stop condition reached", "info");
      setRunning(false);
      runningRef.current = false;
      return;
    }

    try {
      const tradingSession = await ensureDerivTradingConnection(derivAccount, {
        context: "bot-builder-trade",
      });
      const normalizedDurationUnit =
        durationUnit === "s" || durationUnit === "m" ? durationUnit : "t";
      const proposal =
        tradeType === "accumulator"
          ? buildAccumulatorProposalPayload(
              {
                currency: derivCurrency || "USD",
                growthRate: 0.03,
                market: symbol,
                stake: currentStakeRef.current,
                takeProfit: sellAtProfit > 0 ? sellAtProfit : null,
              },
              tradingSession.adapter,
            )
          : buildStandardProposalPayload(
              {
                barrier: barrierOffset,
                currency: derivCurrency || "USD",
                duration,
                durationUnit: normalizedDurationUnit,
                market: symbol,
                multiplier: 100,
                payoutMode: "stake",
                selectedDigit: predictionDigit,
                side: purchaseSide,
                stake: currentStakeRef.current,
                stopLoss: sellAtLoss,
                takeProfit: sellAtProfit,
                tradeType,
              } satisfies ProposalInput,
              tradingSession.adapter,
            );
      const contractType = proposal.contract_type;
      console.info("[Deriv Bot] Placing trade", {
        selectedAccountId: derivAccount.account_id,
        selectedLoginId: derivAccount.loginid,
        detected_prefix: derivAccount.detected_prefix,
        normalizedType: derivAccount.normalizedType,
        final_tab_placement: derivAccount.final_tab_placement,
        is_demo: isDemoAccount(derivAccount),
        is_virtual: isDemoAccount(derivAccount),
        sessionAccountId: tradingSession.sessionAccountId,
        tokenExists: Boolean(tradingSession.token),
        tokenExpiry: tradingSession.expiresAt,
        tokenSource: tradingSession.tokenSource,
        adapter: tradingSession.adapter,
        websocketMode: tradingSession.websocketMode,
        wsAccountId: getTradingSocketAccountId(),
        finalProposalPayload: proposal,
      });

      const quote = await requestProposal(proposal, {
        adapter: tradingSession.adapter,
        selectedAccountId: tradingSession.account_id,
        selectedAccountType: tradingSession.normalizedType,
        contractType,
      });
      const proposalId = quote.proposal?.id;
      if (!proposalId) throw new Error("No proposal returned");

      const stakeForTrade = currentStakeRef.current;
      const askPrice = Number(quote.proposal?.ask_price ?? stakeForTrade);
      const buy = await buyProposal(String(proposalId), askPrice, {
        adapter: tradingSession.adapter,
        selectedAccountId: tradingSession.account_id,
        selectedAccountType: tradingSession.normalizedType,
        contractType,
      });
      const contractId = String(buy.buy?.contract_id ?? "");
      if (!contractId) throw new Error("No contract id returned");
      const tradeRecordId = `${contractId}-${Date.now()}`;
      recordTradeOpened({
        contractId,
        contractType,
        currency: derivCurrency || "USD",
        id: tradeRecordId,
        market: symbol,
        openedAt: new Date().toISOString(),
        side: availableSides.find((side) => side.value === purchaseSide)?.label ?? purchaseSide,
        stake: stakeForTrade,
        status: "open",
      });
      logJournal(`Purchased ${contractType} on ${symbol}`, "success");
      void refreshBalances("bot-trade-placed").catch((error) => {
        console.warn("[Deriv Bot] balance refresh after buy failed", error);
      });

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
        recordTradeClosed(tradeRecordId, {
          closedAt: new Date().toISOString(),
          payout: Number(contract.payout ?? 0),
          profit: pnl,
          status: won ? "won" : "lost",
        });
        setStats((current) => ({
          runs: current.runs + 1,
          wins: current.wins + (won ? 1 : 0),
          losses: current.losses + (won ? 0 : 1),
          profit: current.profit + pnl,
          stake: current.stake + stakeForTrade,
          payout: current.payout + Number(contract.payout ?? 0),
        }));
        const nextStake = won
          ? initialStake
          : Number((currentStakeRef.current * martingale).toFixed(2));
        currentStakeRef.current = nextStake;
        setCurrentStake(nextStake);
        logJournal(
          `${won ? "Win" : "Loss"} ${pnl.toFixed(2)} ${derivCurrency || ""}`,
          won ? "success" : "error",
        );
        void refreshBalances("bot-trade-closed").catch((error) => {
          console.warn("[Deriv Bot] balance refresh after close failed", error);
        });
        if (runningRef.current) setTimeout(runCycle, 750);
      }, 1000);
    } catch (error: unknown) {
      logJournal(getDerivTradingErrorMessage(error), "error");
      setRunning(false);
      runningRef.current = false;
    }
  }

  function getBlockPosition(id: string) {
    return blockPositions[id] ?? INITIAL_BLOCK_POSITIONS[id] ?? { x: 40, y: 40 };
  }

  function startBlockDrag(event: React.PointerEvent<HTMLDivElement>, id: string) {
    if (event.button !== 0) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const rect = workspace.getBoundingClientRect();
    const position = getBlockPosition(id);
    dragStateRef.current = {
      id,
      offsetX: event.clientX - rect.left - position.x,
      offsetY: event.clientY - rect.top - position.y,
    };
    setDraggingBlock(id);
    setTrashActive(false);
    event.preventDefault();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen?.();
  }

  function setStakeAmount(value: number, message: string) {
    const nextStake = Math.max(0.35, Number(value.toFixed(2)));
    setInitialStake(nextStake);
    setCurrentStake(nextStake);
    toast.success(message);
  }

  function applyStakePercent(percent: number) {
    const balance = Number(derivAccount?.balance ?? 0);
    if (!Number.isFinite(balance) || balance <= 0) {
      toast.error("No account balance available.");
      return;
    }
    const nextStake = (balance * percent) / 100;
    setStakeAmount(
      nextStake,
      `Stake set to ${percent}% (${Math.max(0.35, nextStake).toFixed(2)} ${
        derivCurrency || "USD"
      })`,
    );
  }

  function showAnalysisBlock() {
    addBlock("analysis");
    setBlockPositions((positions) => ({
      ...positions,
      analysis: positions.analysis ?? INITIAL_BLOCK_POSITIONS.analysis,
    }));
    toast.success("Analysis block opened");
  }

  function openChartsPage() {
    window.location.assign("/charts");
  }

  function toggleAthena() {
    setAthenaEnabled((enabled) => {
      const next = !enabled;
      toast.message(next ? "Athena enabled" : "Athena disabled");
      return next;
    });
  }

  return (
    <TopShell showAssistantButton={false}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f3f4f6] text-[#111827]">
        <section className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[#d6d8dc] bg-white px-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.xml"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
            <Button
              onClick={quickStrategy}
              className="h-8 shrink-0 rounded-full bg-[#0ea5e9] px-4 text-xs font-bold text-white shadow-sm hover:bg-[#0284c7]"
            >
              Quick strategy
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]">
                  Tools <ChevronDown className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-44 border-[#d6d8dc] bg-white text-[#111827] shadow-lg">
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <FolderOpen className="size-4" /> Import
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void saveBotNow(true)}>
                  <Save className="size-4" /> Save
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportBot}>
                  <Download className="size-4" /> Export
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={undo} disabled={!undoStack.length}>
                  <Undo2 className="size-4" /> Undo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={redo} disabled={!redoStack.length}>
                  <Redo2 className="size-4" /> Redo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={resetWorkspace}>
                  <RotateCcw className="size-4" /> Reset stats
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill icon={DollarSign} label="% Stake" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 border-[#d6d8dc] bg-white text-[#111827] shadow-lg">
                <DropdownMenuItem onSelect={() => applyStakePercent(0.5)}>
                  0.5% of balance
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyStakePercent(1)}>
                  1% of balance
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyStakePercent(2)}>
                  2% of balance
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setStakeAmount(1, `Stake reset to 1 ${derivCurrency || "USD"}`)}
                >
                  Fixed 1 {derivCurrency || "USD"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill icon={BarChart3} label="ChartLord" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48 border-[#d6d8dc] bg-white text-[#111827] shadow-lg">
                <DropdownMenuItem onSelect={openChartsPage}>
                  <BarChart3 className="size-4" /> Open charts
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={showAnalysisBlock}>
                  <Blocks className="size-4" /> Show analysis block
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <ToolbarPill icon={FileJson} label="Strategy" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64 border-[#d6d8dc] bg-white text-[#111827] shadow-lg">
                <DropdownMenuItem onSelect={quickStrategy}>
                  <Sparkles className="size-4" /> Quick strategy
                </DropdownMenuItem>
                {BOT_PRESETS.slice(0, 6).map((item) => (
                  <DropdownMenuItem key={item.id} onSelect={() => loadPreset(item.id)}>
                    {item.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <button
              type="button"
              onClick={() => showTradePanel("expanded")}
              className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              <ListChecks className="size-4" />
              Trades
              {tradeRecords.length > 0 && (
                <span className="rounded-full bg-[#e0f2fe] px-1.5 py-0.5 text-[10px] font-black text-[#0369a1]">
                  {tradeRecords.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleAthena}
              className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
            >
              Athena
              <span
                className={cn(
                  "relative h-4 w-8 rounded-full transition",
                  athenaEnabled ? "bg-[#16a34a]" : "bg-[#cbd5e1]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 size-3 rounded-full bg-white shadow transition",
                    athenaEnabled ? "left-4" : "left-0.5",
                  )}
                />
              </span>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-[#d6d8dc] bg-[#f8fafc] px-3 py-1.5">
              {saveStatus === "saving" ? (
                <RefreshCw className="size-3.5 animate-spin text-[#2563eb]" />
              ) : (
                <CloudCheck className="size-3.5 text-[#16a34a]" />
              )}
              <span className="text-[11px] font-bold uppercase text-[#475569]">
                {saveStatus === "saving" ? "Saving" : saveStatus === "saved" ? "Saved" : "Offline"}
              </span>
            </div>
            <Button
              onClick={toggleBot}
              className={cn(
                "h-8 rounded-full px-4 text-xs font-bold text-white shadow-sm",
                running ? "bg-[#dc2626] hover:bg-[#b91c1c]" : "bg-[#16a34a] hover:bg-[#15803d]",
              )}
            >
              {running ? (
                <Square className="mr-2 size-3.5 fill-current" />
              ) : (
                <Play className="mr-2 size-3.5 fill-current" />
              )}
              {running ? "Stop" : "Run"}
            </Button>
            <span className="hidden rounded-full border border-[#d6d8dc] bg-[#f8fafc] px-3 py-1.5 text-[11px] font-bold uppercase text-[#475569] xl:inline-flex">
              {running ? "Bot is running" : "Bot is not running"}
            </span>
          </div>
        </section>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <aside
            className={cn(
              "flex shrink-0 flex-col border-r border-[#d6d8dc] bg-white transition-[width]",
              blocksMenuCollapsed ? "w-12" : "w-[180px] sm:w-[220px]",
            )}
          >
            <button
              type="button"
              onClick={() => setBlocksMenuCollapsed((value) => !value)}
              className="flex h-11 items-center justify-between gap-2 border-b border-[#e5e7eb] px-3 text-left text-sm font-bold text-[#111827]"
            >
              {!blocksMenuCollapsed && <span className="truncate">Blocks menu</span>}
              {blocksMenuCollapsed ? (
                <PanelLeftOpen className="size-4 shrink-0 text-[#64748b]" />
              ) : (
                <PanelLeftClose className="size-4 shrink-0 text-[#64748b]" />
              )}
            </button>

            {!blocksMenuCollapsed && (
              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#94a3b8]" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search"
                    className="h-9 rounded-md border-[#d6d8dc] bg-[#f8fafc] pl-9 text-sm text-[#111827] placeholder:text-[#94a3b8]"
                  />
                </div>

                <div className="space-y-1">
                  {filteredMenu.map((group) => {
                    const expandable = group.blocks.length > 0;
                    const active = activeBlocks.includes(group.id);
                    return (
                      <div key={group.id} className="overflow-hidden rounded-md">
                        <button
                          type="button"
                          onClick={() =>
                            expandable
                              ? setOpenMenu(openMenu === group.id ? "" : group.id)
                              : addBlock(group.id)
                          }
                          className={cn(
                            "flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-[#334155] hover:bg-[#f1f5f9]",
                            active && "bg-[#e0f2fe] text-[#075985]",
                          )}
                        >
                          <span className="truncate">{group.title}</span>
                          {expandable ? (
                            <ChevronRight
                              className={cn(
                                "size-4 shrink-0 transition-transform",
                                openMenu === group.id && "rotate-90",
                              )}
                            />
                          ) : (
                            <Plus className="size-4 shrink-0" />
                          )}
                        </button>
                        {expandable && openMenu === group.id && (
                          <div className="space-y-1 bg-[#f8fafc] p-2">
                            {group.blocks.map((block) => (
                              <button
                                key={block}
                                type="button"
                                onClick={() => addBlock(group.id)}
                                className="flex w-full items-center justify-between rounded border border-[#e2e8f0] bg-white px-2 py-1.5 text-left text-xs font-medium text-[#475569] hover:border-[#38bdf8]"
                              >
                                <span>{block}</span>
                                <Plus className="size-3.5 text-[#0284c7]" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          <main className="relative min-w-0 flex-1 overflow-auto bg-[#f3f4f6]">
            <div
              ref={workspaceRef}
              className="relative"
              style={{ height: workspaceSize.height, width: workspaceSize.width }}
            >
              <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(#e5e7eb_1px,transparent_1px),linear-gradient(90deg,#e5e7eb_1px,transparent_1px)] [background-size:28px_28px]" />

              {activeBlocks.includes("params") && (
                <WorkspaceBlock
                  id="params"
                  isDragging={draggingBlock === "params"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("params")}
                  position={getBlockPosition("params")}
                  title="1. Trade parameters"
                  width={BLOCK_DIMENSIONS.params.width}
                >
                  <div className="space-y-3">
                    <Field label="Market">
                      <div className="flex flex-wrap gap-2">
                        <InlineSelect
                          value="derived"
                          options={["derived"]}
                          labels={{ derived: "Derived" }}
                        />
                        <InlineSelect
                          value="continuous"
                          options={["continuous"]}
                          labels={{ continuous: "Continuous Indices" }}
                        />
                        <InlineSelect
                          value={symbol}
                          options={Object.keys(MARKETS)}
                          onChange={setSymbol}
                        />
                      </div>
                    </Field>
                    <Field label="Trade Type">
                      <div className="flex flex-wrap gap-2">
                        <InlineSelect
                          value="up_down"
                          options={["up_down"]}
                          labels={{ up_down: "Up/Down" }}
                        />
                        <InlineSelect
                          value={tradeType}
                          options={Object.keys(TRADE_TYPE_LABELS)}
                          labels={TRADE_TYPE_LABELS}
                          onChange={(value) => setTradeType(value as TradeCategory)}
                        />
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Contract Type">
                        <InlineSelect value="both" options={["both"]} labels={{ both: "Both" }} />
                      </Field>
                      <Field label="Default Candle Interval">
                        <InlineSelect value="1m" options={["1m"]} labels={{ "1m": "1 minute" }} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <CheckOption label="Restart buy/sell on error" />
                      <CheckOption defaultChecked label="Restart last trade on error" />
                    </div>
                    <BlockSection title="Run once at start">
                      <div className="min-h-9 rounded-md border border-[#8fbec3] bg-[#d6eeee]" />
                    </BlockSection>
                    <BlockSection title="Trade options">
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Duration">
                          <div className="flex flex-wrap gap-2">
                            <InlineSelect
                              value={durationUnit}
                              options={["t", "s", "m"]}
                              labels={{ t: "Ticks", s: "Seconds", m: "Minutes" }}
                              onChange={setDurationUnit}
                            />
                            <NumberInput value={duration} min={1} step={1} onChange={setDuration} />
                          </div>
                        </Field>
                        <Field label="Stake">
                          <div className="flex flex-wrap gap-2">
                            <InlineSelect
                              value={derivCurrency || "USD"}
                              options={[derivCurrency || "USD"]}
                            />
                            <NumberInput
                              value={initialStake}
                              min={0.35}
                              step={0.01}
                              onChange={setInitialStake}
                            />
                          </div>
                        </Field>
                      </div>
                    </BlockSection>
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("purchase") && (
                <WorkspaceBlock
                  id="purchase"
                  isDragging={draggingBlock === "purchase"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("purchase")}
                  position={getBlockPosition("purchase")}
                  title="2. Purchase conditions"
                  width={BLOCK_DIMENSIONS.purchase.width}
                >
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
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("sell") && (
                <WorkspaceBlock
                  id="sell"
                  isDragging={draggingBlock === "sell"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("sell")}
                  position={getBlockPosition("sell")}
                  title="3. Sell conditions"
                  width={BLOCK_DIMENSIONS.sell.width}
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#0f3f47]">
                      <span>if</span>
                      <InlineSelect
                        value="sell_available"
                        options={["sell_available"]}
                        labels={{ sell_available: "Sell is available" }}
                      />
                      <span>then</span>
                    </div>
                    <NestedSlot />
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("restart") && (
                <WorkspaceBlock
                  id="restart"
                  isDragging={draggingBlock === "restart"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("restart")}
                  position={getBlockPosition("restart")}
                  title="4. Restart trading conditions"
                  width={BLOCK_DIMENSIONS.restart.width}
                >
                  <div className="inline-flex h-10 items-center rounded-md border border-[#8fbec3] bg-[#e8f6f6] px-3 text-sm font-bold text-[#0f3f47]">
                    Trade again
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("analysis") && (
                <WorkspaceBlock
                  id="analysis"
                  isDragging={draggingBlock === "analysis"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("analysis")}
                  position={getBlockPosition("analysis")}
                  title="5. Analysis"
                  width={BLOCK_DIMENSIONS.analysis.width}
                >
                  <div className="grid grid-cols-3 gap-2">
                    <Metric
                      label="Win rate"
                      value={`${stats.runs ? ((stats.wins / stats.runs) * 100).toFixed(1) : "0.0"}%`}
                    />
                    <Metric
                      label="Total P/L"
                      value={`${stats.profit >= 0 ? "+" : ""}${stats.profit.toFixed(2)}`}
                    />
                    <Metric label="Payout" value={stats.payout.toFixed(2)} />
                  </div>
                </WorkspaceBlock>
              )}

              {activeBlocks.includes("utility") && (
                <WorkspaceBlock
                  id="utility"
                  isDragging={draggingBlock === "utility"}
                  onDragStart={startBlockDrag}
                  onRemove={() => removeBlock("utility")}
                  position={getBlockPosition("utility")}
                  title="6. Utility"
                  width={BLOCK_DIMENSIONS.utility.width}
                >
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(JSON.stringify(snapshot, null, 2));
                        toast.success("Configuration copied");
                      }}
                      className="h-9 rounded-md border-[#8fbec3] bg-white text-xs font-bold text-[#0f3f47]"
                    >
                      <Copy className="mr-2 size-4" />
                      Copy config
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setJournal([]);
                        toast.success("Journal cleared");
                      }}
                      className="h-9 rounded-md border-[#8fbec3] bg-white text-xs font-bold text-[#0f3f47]"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Clear journal
                    </Button>
                  </div>
                </WorkspaceBlock>
              )}
            </div>

            {tradePanelMode !== "hidden" && (
              <ProfitLossPanel
                currency={derivCurrency || "USD"}
                journal={journal}
                mode={tradePanelMode}
                records={tradeRecords}
                running={running}
                stats={stats}
                onClose={closeTradePanel}
                onModeChange={setTradePanelMode}
              />
            )}

            <div className="pointer-events-none fixed bottom-12 right-6 z-40 flex flex-col items-center gap-3">
              {assistantOpen && (
                <div className="pointer-events-auto w-72 rounded-lg border border-[#cbd5e1] bg-white p-3 text-sm text-[#334155] shadow-xl">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-bold text-[#111827]">Bot assistant</div>
                    <button
                      type="button"
                      onClick={() => setAssistantOpen(false)}
                      className="rounded p-1 text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111827]"
                      aria-label="Close bot assistant"
                    >
                      <Minimize2 className="size-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={quickStrategy}
                      className="h-8 rounded-md border-[#cbd5e1] text-xs font-bold text-[#334155]"
                    >
                      Quick
                    </Button>
                    <Button
                      variant="outline"
                      onClick={showAnalysisBlock}
                      className="h-8 rounded-md border-[#cbd5e1] text-xs font-bold text-[#334155]"
                    >
                      Analysis
                    </Button>
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setAssistantOpen((value) => !value)}
                className="pointer-events-auto flex size-[60px] items-center justify-center rounded-full bg-[#16a34a] text-base font-black text-white shadow-[0_0_28px_rgba(22,163,74,0.42)] transition hover:scale-105"
                aria-label="AI assistant"
              >
                AI
              </button>
              <button
                ref={trashRef}
                type="button"
                onClick={() => {
                  setActiveBlocks([]);
                  toast.success("Workspace cleared");
                }}
                className={cn(
                  "pointer-events-auto flex size-10 items-center justify-center rounded-full border bg-white text-[#64748b] shadow-md transition",
                  trashActive
                    ? "border-[#ef4444] bg-[#fee2e2] text-[#dc2626] scale-110"
                    : "border-[#cbd5e1] hover:border-[#ef4444] hover:text-[#dc2626]",
                )}
                aria-label="Delete blocks"
                title="Delete blocks"
              >
                <Trash2 className="size-5" />
              </button>
            </div>
          </main>
        </div>

        <footer className="flex h-8 shrink-0 items-center justify-between border-t border-[#d6d8dc] bg-white px-4 text-xs text-[#475569]">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-[#16a34a]" />
            <span className="font-medium">{derivAccount?.account_id ?? "Ready"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono">{formatUtcTimestamp(utcNow)}</span>
            <IconButton icon={Download} label="Export" onClick={exportBot} />
            <IconButton icon={Maximize2} label="Fullscreen" onClick={toggleFullscreen} />
          </div>
        </footer>
      </div>
    </TopShell>
  );
}

function ProfitLossPanel({
  currency,
  journal,
  mode,
  onClose,
  onModeChange,
  records,
  running,
  stats,
}: {
  currency: string;
  journal: JournalEntry[];
  mode: Exclude<TradePanelMode, "hidden">;
  onClose: () => void;
  onModeChange: (mode: TradePanelMode) => void;
  records: TradeRecord[];
  running: boolean;
  stats: BotStats;
}) {
  const profitPositive = stats.profit >= 0;
  const winRate = stats.runs ? ((stats.wins / stats.runs) * 100).toFixed(1) : "0.0";
  const openRecords = records.filter((record) => record.status === "open");
  const closedRecords = records.filter((record) => record.status !== "open");

  if (mode === "collapsed") {
    return (
      <div className="fixed bottom-10 left-[236px] z-40 flex items-center overflow-hidden rounded-full border border-[#cbd5e1] bg-white shadow-lg">
        <button
          type="button"
          onClick={() => onModeChange("expanded")}
          className="flex items-center gap-3 px-3 py-2 text-left"
        >
          <span
            className={cn("size-2.5 rounded-full", running ? "bg-[#22c55e]" : "bg-[#94a3b8]")}
          />
          <span className="text-xs font-bold text-[#334155]">Trades</span>
          <span
            className={cn(
              "font-mono text-xs font-black",
              profitPositive ? "text-[#166534]" : "text-[#991b1b]",
            )}
          >
            {profitPositive ? "+" : ""}
            {stats.profit.toFixed(2)} {currency}
          </span>
          <Maximize2 className="size-4 text-[#64748b]" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="border-l border-[#e2e8f0] px-2 py-2 text-[#64748b] hover:bg-[#f8fafc] hover:text-[#111827]"
          aria-label="Hide trade panel"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-10 right-4 top-[118px] z-40 flex w-[min(440px,calc(100vw-1rem))] flex-col overflow-hidden rounded-lg border border-[#cbd5e1] bg-white shadow-2xl">
      <div className="flex shrink-0 items-center justify-between bg-[#0f4c5c] px-3 py-2 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <History className="size-4 shrink-0" />
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">Trades and transactions</div>
            <div className="text-[10px] font-bold uppercase text-white/70">
              {running ? "Bot running" : "Bot stopped"}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange("collapsed")}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Collapse trade panel"
          >
            <Minimize2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
            aria-label="Hide trade panel"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div
          className={cn(
            "rounded-md border p-3",
            profitPositive
              ? "border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]"
              : "border-[#fecaca] bg-[#fef2f2] text-[#991b1b]",
          )}
        >
          <div className="text-[10px] font-bold uppercase opacity-70">Total profit / loss</div>
          <div className="mt-1 font-mono text-2xl font-black">
            {profitPositive ? "+" : ""}
            {stats.profit.toFixed(2)} {currency}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <PanelMetric label="Runs" value={stats.runs} />
          <PanelMetric label="Wins" value={stats.wins} />
          <PanelMetric label="Losses" value={stats.losses} />
          <PanelMetric label="Win %" value={`${winRate}%`} />
        </div>

        <TradeList emptyText="No open trades." records={openRecords} title="Placed trades" />
        <TradeList
          emptyText="No completed trades yet."
          records={closedRecords}
          title="Closed trades"
        />

        <section className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-[#475569]">
            <ListChecks className="size-4" />
            Bot transaction history
          </div>
          {journal.length === 0 ? (
            <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#64748b]">
              Transactions appear when the bot runs.
            </div>
          ) : (
            <div className="space-y-2">
              {journal.slice(0, 24).map((entry, index) => (
                <div
                  key={`${entry.time}-${index}`}
                  className={cn(
                    "rounded-md border bg-white p-2 text-xs",
                    entry.type === "success" && "border-[#bbf7d0] text-[#166534]",
                    entry.type === "error" && "border-[#fecaca] text-[#991b1b]",
                    entry.type === "info" && "border-[#e2e8f0] text-[#475569]",
                  )}
                >
                  <div className="mb-1 font-mono text-[10px] font-bold opacity-70">
                    {entry.time}
                  </div>
                  {entry.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TradeList({
  emptyText,
  records,
  title,
}: {
  emptyText: string;
  records: TradeRecord[];
  title: string;
}) {
  return (
    <section className="mt-4">
      <div className="mb-2 text-xs font-black uppercase text-[#475569]">{title}</div>
      {records.length === 0 ? (
        <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-3 text-sm text-[#64748b]">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="rounded-md border border-[#e2e8f0] bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[#111827]">
                    {record.contractType} / {record.market}
                  </div>
                  <div className="mt-1 text-xs text-[#64748b]">
                    {record.side} / {formatTradeDate(record.openedAt)}
                  </div>
                </div>
                <TradeStatusBadge status={record.status} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <PanelMetric
                  label="Stake"
                  value={`${record.stake.toFixed(2)} ${record.currency}`}
                />
                <PanelMetric
                  label="Payout"
                  value={record.payout === undefined ? "..." : record.payout.toFixed(2)}
                />
                <PanelMetric
                  label="P/L"
                  value={record.profit === undefined ? "..." : record.profit.toFixed(2)}
                />
              </div>
              <div className="mt-2 truncate font-mono text-[10px] text-[#94a3b8]">
                Contract {record.contractId}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function TradeStatusBadge({ status }: { status: TradeRecord["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-[10px] font-black uppercase",
        status === "open" && "bg-[#e0f2fe] text-[#0369a1]",
        status === "won" && "bg-[#dcfce7] text-[#166534]",
        status === "lost" && "bg-[#fee2e2] text-[#991b1b]",
      )}
    >
      {status}
    </span>
  );
}

function PanelMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#e2e8f0] bg-[#f8fafc] p-2">
      <div className="text-[9px] font-bold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 truncate font-mono text-sm font-bold text-[#111827]">{value}</div>
    </div>
  );
}

function WorkspaceBlock({
  children,
  id,
  isDragging,
  onDragStart,
  onRemove,
  position,
  title,
  width,
}: {
  children: React.ReactNode;
  id: string;
  isDragging: boolean;
  onDragStart: (event: React.PointerEvent<HTMLDivElement>, id: string) => void;
  onRemove: () => void;
  position: { x: number; y: number };
  title: string;
  width: number;
}) {
  return (
    <div
      className={cn(
        "absolute min-w-0 overflow-hidden rounded-md border border-[#0b3b46]/30 bg-[#b8dde0] shadow-[0_10px_24px_rgba(15,76,92,0.18)] transition-shadow",
        isDragging && "z-30 shadow-[0_18px_38px_rgba(15,76,92,0.34)]",
      )}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        width,
        zIndex: isDragging ? 30 : 10,
      }}
    >
      <div
        onPointerDown={(event) => onDragStart(event, id)}
        className={cn(
          "flex touch-none cursor-grab select-none items-center justify-between bg-[#0f4c5c] px-3 py-2 text-white",
          isDragging && "cursor-grabbing",
        )}
      >
        <div className="flex min-w-0 items-center gap-2 text-sm font-bold">
          <GripVertical className="size-4 opacity-70" />
          <span className="truncate">{title}</span>
        </div>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onRemove}
          className="rounded p-1 hover:bg-white/15"
          aria-label={`Remove ${title}`}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

const ToolbarPill = forwardRef<HTMLButtonElement, { icon: LucideIcon; label: string }>(
  ({ icon: Icon, label, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className="flex h-8 shrink-0 items-center gap-2 rounded-full border border-[#cbd5e1] bg-white px-3 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc]"
        {...props}
      >
        <Icon className="size-4" />
        <span>{label}</span>
        <ChevronDown className="size-3.5" />
      </button>
    );
  },
);
ToolbarPill.displayName = "ToolbarPill";

function IconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded text-[#475569] hover:bg-[#f1f5f9] hover:text-[#111827]"
      aria-label={label}
      title={label}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="min-w-0 rounded-md border border-[#92c3c8] bg-[#d5eeee] px-2.5 py-2">
      <Label className="mb-1.5 block text-[11px] font-bold text-[#16434c]">{label}</Label>
      <div className="min-w-0">{children}</div>
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
      <SelectTrigger className="h-7 min-w-[92px] rounded-full border-[#8fbec3] bg-white px-3 text-xs font-bold text-[#0f3f47] shadow-sm data-[placeholder]:text-[#64748b]">
        <SelectValue>{labels?.[value] ?? value}</SelectValue>
      </SelectTrigger>
      <SelectContent className="border-[#cbd5e1] bg-white text-[#111827]">
        {options.map((option) => (
          <SelectItem key={option} value={option} className="text-xs font-bold text-[#111827]">
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
        "h-7 w-20 rounded-full border-[#8fbec3] bg-white px-3 text-right font-mono text-xs font-bold text-[#0f3f47] shadow-sm",
        className,
      )}
    />
  );
}

function CheckOption({ defaultChecked, label }: { defaultChecked?: boolean; label: string }) {
  return (
    <label className="flex min-h-9 items-center gap-2 rounded-md border border-[#92c3c8] bg-[#d5eeee] px-2.5 text-[11px] font-bold text-[#16434c]">
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="size-3.5 rounded border-[#6aaab0] accent-[#0f4c5c]"
      />
      <span className="leading-tight">{label}</span>
    </label>
  );
}

function BlockSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-md border border-[#92c3c8] bg-[#cce8ea] p-2.5">
      <div className="mb-2 text-[11px] font-bold text-[#16434c]">{title}</div>
      {children}
    </div>
  );
}

function NestedSlot() {
  return (
    <div className="min-h-16 rounded-md border-2 border-dashed border-[#76aeb5] bg-[#d6eeee] shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" />
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-[#92c3c8] bg-[#d5eeee] p-2">
      <div className="text-[9px] font-bold uppercase text-[#3f6970]">{label}</div>
      <div className="mt-1 font-mono text-sm font-bold text-[#0f3f47]">{value}</div>
    </div>
  );
}

function formatTradeDate(value: string) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatUtcTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} GMT`;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-[#eeeeee] py-2 first:border-t-0">
      <span className="text-xs font-bold text-[#777777]">{label}</span>
      <span className="max-w-[170px] truncate text-right text-xs font-bold">{value}</span>
    </div>
  );
}
