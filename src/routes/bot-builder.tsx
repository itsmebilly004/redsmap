import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  DollarSign,
  Download,
  Flag,
  FolderOpen,
  GripVertical,
  LayoutList,
  LineChart,
  MessageSquare,
  Minus,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  ShoppingCart,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { TopShell } from "@/components/top-shell";
import {
  BotRunMonitorPanel,
  type BotMonitorJournalEntry,
  type BotMonitorStats,
  type BotMonitorStatus,
  type BotMonitorTransaction,
} from "@/components/bot-run-monitor";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  persistBotMonitorSnapshot,
  recordBotPresetActivity,
  rememberMarketSelection,
  updateTrackedTrade,
  upsertTrackedTrade,
} from "@/lib/activity-memory";
import {
  ensureDerivTradingConnection,
  getDerivTradingErrorMessage,
  type TradeCategory,
  type TradingAdapter,
} from "@/lib/deriv";
import { BOT_PRESET_CONFIGS, type BotPresetConfig } from "@/lib/bot-presets";
import { buyProposal, requestProposal, subscribeOpenContract } from "@/lib/deriv-trading-service";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import { numberFrom } from "@/lib/contract-state";
import { cn } from "@/lib/utils";

const search = z.object({
  preset: z.string().optional(),
});

export const Route = createFileRoute("/bot-builder")({
  component: BotBuilderPage,
  validateSearch: search,
});

type BotStatus = BotMonitorStatus;
type DurationUnit = "m" | "s" | "t";
type TradeTypeUi = "digits" | "higher_lower" | "multiplier" | "rise_fall" | "touch_no_touch";
type DigitContract = "even_odd" | "matches_differs" | "over_under";
type SellConditionType = "sell_available" | "take_profit" | "stop_loss" | "contract_expired";
type SellCondition = { id: string; type: SellConditionType };
type RestartConditionType = "trade_again" | "on_win" | "on_loss" | "never";
type BlockKey = "trade" | "purchase" | "sell" | "restart" | "functions";
type BlockPosition = { x: number; y: number };

type BotSettings = {
  assetCategory: string;
  candleInterval: string;
  conditionJoin: "All" | "Any";
  conditionLeft: string;
  conditionOperator: string;
  conditionRight: string;
  currency: string;
  digitContract: DigitContract;
  duration: number;
  durationUnit: DurationUnit;
  market: string;
  martingale: number;
  maxRuns: number;
  maxStake: number;
  purchaseDirection: string;
  restartBuySellOnError: boolean;
  restartCondition: RestartConditionType;
  restartLastTradeOnError: boolean;
  runOnceAtStart: boolean;
  selectedDigit: number;
  sellConditions: SellCondition[];
  stake: number;
  stopLoss: number;
  symbol: string;
  takeProfit: number;
  tradeEveryTick: boolean;
  tradeType: TradeTypeUi;
};

type BotStats = BotMonitorStats;
type Transaction = BotMonitorTransaction;
type JournalEntry = BotMonitorJournalEntry;
type Settlement = {
  entrySpot: number | null;
  exitSpot: number | null;
  payout: number;
  profit: number;
  status: "lost" | "open" | "won";
};
type SavedBotPreset = {
  id: string;
  name: string;
  savedAt: string;
  settings: BotSettings;
  source: "deployed" | "imported" | "manual";
};
type ImportedBotSettings = {
  name: string;
  settings: BotSettings;
};

const CURRENT_SETTINGS_STORAGE_VERSION = 1;
const SAVED_PRESETS_STORAGE_VERSION = 1;
const BLOCK_POSITIONS_KEY = "arktrader:bot-builder:block-positions";
const BLOCK_VISIBILITY_KEY = "arktrader:bot-builder:block-visibility";
const BLOCK_COLLAPSED_KEY = "arktrader:bot-builder:block-collapsed";
const BLOCK_COMMENTS_KEY = "arktrader:bot-builder:block-comments";

const INITIAL_BLOCK_POSITIONS: Record<BlockKey, BlockPosition> = {
  trade: { x: 24, y: 0 },
  purchase: { x: 24, y: 600 },
  sell: { x: 820, y: 0 },
  restart: { x: 820, y: 240 },
  functions: { x: 24, y: 820 },
};

const DEFAULT_VISIBLE_BLOCKS: Record<BlockKey, boolean> = {
  trade: true,
  purchase: true,
  sell: true,
  restart: true,
  functions: false,
};

const BLOCK_LABELS: Record<BlockKey, string> = {
  trade: "Trade parameters",
  purchase: "Purchase conditions",
  sell: "Sell conditions",
  restart: "Restart trading conditions",
  functions: "Functions",
};

const BLOCK_DIMENSIONS: Record<BlockKey, { width: number; height: number }> = {
  trade: { width: 780, height: 560 },
  purchase: { width: 490, height: 240 },
  sell: { width: 490, height: 200 },
  restart: { width: 490, height: 90 },
  functions: { width: 760, height: 640 },
};

const BLOCK_COLLAPSED_HEIGHT = 46;
const WORKSPACE_PADDING_X = 64;
const WORKSPACE_PADDING_Y = 80;
const WORKSPACE_TOOLBAR_HEIGHT = 62;
const WORKSPACE_MIN_WIDTH = 720;
const WORKSPACE_MIN_HEIGHT = 380;

const symbolOptions = [
  { label: "Volatility 10 Index", value: "R_10" },
  { label: "Volatility 25 Index", value: "R_25" },
  { label: "Volatility 50 Index", value: "R_50" },
  { label: "Volatility 75 Index", value: "R_75" },
  { label: "Volatility 100 Index", value: "R_100" },
  { label: "Volatility 10 (1s) Index", value: "1HZ10V" },
  { label: "Volatility 25 (1s) Index", value: "1HZ25V" },
  { label: "Volatility 50 (1s) Index", value: "1HZ50V" },
  { label: "Volatility 75 (1s) Index", value: "1HZ75V" },
  { label: "Volatility 100 (1s) Index", value: "1HZ100V" },
];

const sellConditionLabels: Record<SellConditionType, string> = {
  contract_expired: "Contract expired",
  sell_available: "Sell is available",
  stop_loss: "Stop loss reached",
  take_profit: "Take profit reached",
};

const restartConditionLabels: Record<RestartConditionType, string> = {
  never: "Never trade again",
  on_loss: "Trade again on loss",
  on_win: "Trade again on win",
  trade_again: "Trade again",
};

const initialSettings: BotSettings = {
  assetCategory: "Continuous Indices",
  candleInterval: "1 minute",
  conditionJoin: "All",
  conditionLeft: "Last Digit",
  conditionOperator: ">",
  conditionRight: "3",
  currency: "USD",
  digitContract: "over_under",
  duration: 1,
  durationUnit: "t",
  market: "Derived",
  martingale: 1.5,
  maxRuns: 1,
  maxStake: 500,
  purchaseDirection: "over",
  restartBuySellOnError: true,
  restartCondition: "trade_again",
  restartLastTradeOnError: true,
  runOnceAtStart: true,
  selectedDigit: 4,
  sellConditions: [{ id: "sc-default", type: "sell_available" }],
  stake: 1,
  stopLoss: 30,
  symbol: "R_10",
  takeProfit: 100,
  tradeEveryTick: false,
  tradeType: "digits",
};

const blockMenu = [
  { section: "trade", title: "Trade parameters" },
  { section: "purchase", title: "Purchase conditions" },
  { section: "sell", title: "Sell conditions (optional)" },
  { section: "restart", title: "Restart trading conditions" },
  { collapsible: true, section: "analysis", title: "Analysis" },
  { collapsible: true, section: "utility", title: "Utility" },
];

const BOT_TRADE_MAX_ATTEMPTS = 2;
const DERIV_TEMPORARY_PROCESSING_MESSAGE =
  "Sorry, an error occurred while processing your request.";

// ─── Storage helpers ──────────────────────────────────────────────────────────

function currentSettingsStorageKey(userId?: string | null) {
  return `arktrader:bot-builder:${userId ?? "guest"}:current-settings`;
}

function savedPresetsStorageKey(userId?: string | null) {
  return `arktrader:bot-builder:${userId ?? "guest"}:saved-presets`;
}

function readCurrentBotSettings(userId?: string | null) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(currentSettingsStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== CURRENT_SETTINGS_STORAGE_VERSION) return null;
    if (!isRecord(parsed.settings)) return null;
    return settingsFromRecord(parsed.settings);
  } catch {
    return null;
  }
}

function writeCurrentBotSettings(userId: string | null | undefined, settings: BotSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      currentSettingsStorageKey(userId),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        settings,
        version: CURRENT_SETTINGS_STORAGE_VERSION,
      }),
    );
  } catch {
    /* best effort */
  }
}

function readSavedBotPresets(userId?: string | null): SavedBotPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(savedPresetsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || parsed.version !== SAVED_PRESETS_STORAGE_VERSION) return [];
    if (!Array.isArray(parsed.presets)) return [];
    return parsed.presets
      .map(savedPresetFromRecord)
      .filter((preset): preset is SavedBotPreset => Boolean(preset));
  } catch {
    return [];
  }
}

function writeSavedBotPresets(userId: string | null | undefined, presets: SavedBotPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      savedPresetsStorageKey(userId),
      JSON.stringify({
        presets,
        savedAt: new Date().toISOString(),
        version: SAVED_PRESETS_STORAGE_VERSION,
      }),
    );
  } catch {
    /* best effort */
  }
}

function readBlockPositions(): Record<BlockKey, BlockPosition> {
  if (typeof window === "undefined") return { ...INITIAL_BLOCK_POSITIONS };
  try {
    const raw = window.localStorage.getItem(BLOCK_POSITIONS_KEY);
    if (!raw) return { ...INITIAL_BLOCK_POSITIONS };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { ...INITIAL_BLOCK_POSITIONS };
    return {
      functions: positionFrom(parsed.functions) ?? INITIAL_BLOCK_POSITIONS.functions,
      purchase: positionFrom(parsed.purchase) ?? INITIAL_BLOCK_POSITIONS.purchase,
      restart: positionFrom(parsed.restart) ?? INITIAL_BLOCK_POSITIONS.restart,
      sell: positionFrom(parsed.sell) ?? INITIAL_BLOCK_POSITIONS.sell,
      trade: positionFrom(parsed.trade) ?? INITIAL_BLOCK_POSITIONS.trade,
    };
  } catch {
    return { ...INITIAL_BLOCK_POSITIONS };
  }
}

function writeBlockPositions(positions: Record<BlockKey, BlockPosition>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOCK_POSITIONS_KEY, JSON.stringify(positions));
  } catch {
    /* best effort */
  }
}

function readBlockVisibility(): Record<BlockKey, boolean> {
  if (typeof window === "undefined") return { ...DEFAULT_VISIBLE_BLOCKS };
  try {
    const raw = window.localStorage.getItem(BLOCK_VISIBILITY_KEY);
    if (!raw) return { ...DEFAULT_VISIBLE_BLOCKS };
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return { ...DEFAULT_VISIBLE_BLOCKS };
    return {
      trade: parsed.trade !== false,
      purchase: parsed.purchase !== false,
      sell: parsed.sell !== false,
      restart: parsed.restart !== false,
      functions: parsed.functions === true,
    };
  } catch {
    return { ...DEFAULT_VISIBLE_BLOCKS };
  }
}

function writeBlockVisibility(visibility: Record<BlockKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOCK_VISIBILITY_KEY, JSON.stringify(visibility));
  } catch {
    /* best effort */
  }
}

function readCollapsedBlocks(): Record<BlockKey, boolean> {
  const empty: Record<BlockKey, boolean> = {
    trade: false,
    purchase: false,
    sell: false,
    restart: false,
    functions: false,
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(BLOCK_COLLAPSED_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return empty;
    return {
      trade: parsed.trade === true,
      purchase: parsed.purchase === true,
      sell: parsed.sell === true,
      restart: parsed.restart === true,
      functions: parsed.functions === true,
    };
  } catch {
    return empty;
  }
}

function writeCollapsedBlocks(state: Record<BlockKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOCK_COLLAPSED_KEY, JSON.stringify(state));
  } catch {
    /* best effort */
  }
}

function readBlockComments(): Partial<Record<BlockKey, string>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BLOCK_COMMENTS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const out: Partial<Record<BlockKey, string>> = {};
    for (const key of ["trade", "purchase", "sell", "restart", "functions"] as BlockKey[]) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim()) out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeBlockComments(comments: Partial<Record<BlockKey, string>>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BLOCK_COMMENTS_KEY, JSON.stringify(comments));
  } catch {
    /* best effort */
  }
}

function positionFrom(value: unknown): BlockPosition | null {
  if (!isRecord(value)) return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function savedPresetFromRecord(value: unknown) {
  if (!isRecord(value) || !isRecord(value.settings)) return null;
  const source = value.source;
  return {
    id: readString(value, "id", crypto.randomUUID()),
    name: readString(value, "name", "Saved bot preset"),
    savedAt: readString(value, "savedAt", new Date().toISOString()),
    settings: settingsFromRecord(value.settings),
    source:
      source === "deployed" || source === "imported" || source === "manual" ? source : "manual",
  } satisfies SavedBotPreset;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function BotBuilderPage() {
  const { user, loading: authLoading } = useAuth();
  const { preset } = Route.useSearch();
  const { account, currency: accountCurrency, refreshBalances } = useDerivBalanceContext();
  const isMobile = useIsMobile();
  const [settings, setSettings] = useState<BotSettings>(initialSettings);
  const [status, setStatus] = useState<BotStatus>("stopped");
  const [activeTab, setActiveTab] = useState("summary");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [monitorCollapsed, setMonitorCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(0.9);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([
    {
      id: "ready",
      message: "Bot builder is ready. Configure the blocks and press Run.",
      time: formatTime(),
      type: "info",
    },
  ]);
  const [stats, setStats] = useState<BotStats>({
    contractsLost: 0,
    contractsWon: 0,
    runs: 0,
    totalPayout: 0,
    totalProfitLoss: 0,
    totalStake: 0,
  });
  const [history, setHistory] = useState<BotSettings[]>([]);
  const [redoStack, setRedoStack] = useState<BotSettings[]>([]);
  const [savedPresets, setSavedPresets] = useState<SavedBotPreset[]>([]);
  const [activeSavedPresetId, setActiveSavedPresetId] = useState<string | null>(null);
  const [activePresetName, setActivePresetName] = useState("Unsaved bot");
  const [hydratedStorageUser, setHydratedStorageUser] = useState<string | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [blockPositions, setBlockPositions] = useState<Record<BlockKey, BlockPosition>>(
    () => readBlockPositions(),
  );
  const [visibleBlocks, setVisibleBlocks] = useState<Record<BlockKey, boolean>>(
    () => readBlockVisibility(),
  );
  const [collapsedBlocks, setCollapsedBlocks] = useState<Record<BlockKey, boolean>>(
    () => readCollapsedBlocks(),
  );
  const [blockComments, setBlockComments] = useState<Partial<Record<BlockKey, string>>>(
    () => readBlockComments(),
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const loadedRoutePresetRef = useRef<string | null>(null);
  const skipPersistOnceRef = useRef(false);
  const runningRef = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!isMobile) return;
    setLeftCollapsed(true);
    setMonitorCollapsed(true);
  }, [isMobile]);

  useEffect(() => {
    if (authLoading) return;
    const storageUserId = user?.id ?? "guest";
    const routePresetId = preset?.trim();
    const routePresetKey = `${storageUserId}:${routePresetId ?? ""}`;
    const localPresets = readSavedBotPresets(user?.id);
    setSavedPresets(localPresets);

    if (routePresetId && loadedRoutePresetRef.current !== routePresetKey) {
      const deployedPreset = BOT_PRESET_CONFIGS.find((item) => item.id === routePresetId);
      loadedRoutePresetRef.current = routePresetKey;
      hydratedUserRef.current = storageUserId;
      setHydratedStorageUser(storageUserId);
      setStorageReady(true);

      if (!deployedPreset) {
        toast.error("That bot preset could not be found.");
        addJournal(`Preset ${routePresetId} was not found.`, "error");
        return;
      }

      const nextSettings = settingsFromBotPreset(deployedPreset);
      skipPersistOnceRef.current = true;
      setSettings(nextSettings);
      settingsRef.current = nextSettings;
      setHistory([]);
      setRedoStack([]);
      setActiveSavedPresetId(null);
      setActivePresetName(deployedPreset.name);
      writeCurrentBotSettings(user?.id, nextSettings);
      recordBotPresetActivity(user?.id, "deployed", deployedPreset.name, deployedPreset.id);
      addJournal(`Loaded deployed preset: ${deployedPreset.name}.`, "success");
      toast.success(`${deployedPreset.name} loaded in the bot builder.`);
      return;
    }

    if (!routePresetId && hydratedUserRef.current !== storageUserId) {
      const storedSettings = readCurrentBotSettings(user?.id);
      hydratedUserRef.current = storageUserId;
      setHydratedStorageUser(storageUserId);
      setStorageReady(true);

      if (storedSettings) {
        skipPersistOnceRef.current = true;
        setSettings(storedSettings);
        settingsRef.current = storedSettings;
        setHistory([]);
        setRedoStack([]);
        setActiveSavedPresetId(null);
        setActivePresetName("Restored bot");
        addJournal("Restored the last bot builder configuration.", "success");
      }
      return;
    }

    setHydratedStorageUser(storageUserId);
    setStorageReady(true);
  }, [authLoading, preset, user?.id]);

  useEffect(() => {
    const storageUserId = user?.id ?? "guest";
    if (!storageReady || hydratedStorageUser !== storageUserId) return;
    if (skipPersistOnceRef.current) {
      skipPersistOnceRef.current = false;
      return;
    }
    writeCurrentBotSettings(user?.id, settings);
  }, [hydratedStorageUser, settings, storageReady, user?.id]);

  useEffect(() => {
    if (!accountCurrency) return;
    updateSettings({ currency: accountCurrency });
  }, [accountCurrency]);

  useEffect(() => {
    rememberMarketSelection(user?.id, "bot-builder", settings.symbol);
  }, [settings.symbol, user?.id]);

  useEffect(() => {
    persistBotMonitorSnapshot(user?.id, {
      journal,
      stats,
      status,
      transactions,
      updatedAt: new Date().toISOString(),
    });
  }, [journal, stats, status, transactions, user?.id]);

  const filteredMenu = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return blockMenu;
    return blockMenu.filter((item) => item.title.toLowerCase().includes(query));
  }, [searchTerm]);

  function addJournal(message: string, type: JournalEntry["type"] = "info") {
    setJournal((current) => [
      { id: crypto.randomUUID(), message, time: formatTime(), type },
      ...current,
    ]);
  }

  function updateSettings(patch: Partial<BotSettings>) {
    setSettings((current) => {
      const next = normalizeSettings({ ...current, ...patch });
      if (JSON.stringify(next) === JSON.stringify(current)) return current;
      setHistory((items) => [...items.slice(-24), current]);
      setRedoStack([]);
      return next;
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setRedoStack((items) => [settings, ...items]);
    setSettings(previous);
    setHistory((items) => items.slice(0, -1));
    addJournal("Undo applied.", "info");
  }

  function redo() {
    const next = redoStack[0];
    if (!next) return;
    setHistory((items) => [...items, settings]);
    setSettings(next);
    setRedoStack((items) => items.slice(1));
    addJournal("Redo applied.", "info");
  }

  function resetBot() {
    runningRef.current = false;
    setStatus("stopped");
    setStats({
      contractsLost: 0,
      contractsWon: 0,
      runs: 0,
      totalPayout: 0,
      totalProfitLoss: 0,
      totalStake: 0,
    });
    setTransactions([]);
    addJournal("Bot statistics reset.", "info");
  }

  function resetLayout() {
    setBlockPositions({ ...INITIAL_BLOCK_POSITIONS });
    writeBlockPositions(INITIAL_BLOCK_POSITIONS);
    toast.success("Block layout reset.");
  }

  function saveSettings() {
    const suggestedName =
      activePresetName === "Unsaved bot" || activePresetName === "Restored bot"
        ? "My bot preset"
        : activePresetName;
    const name = window.prompt("Save bot preset as", suggestedName)?.trim();
    if (!name) return;

    const now = new Date().toISOString();
    const existingPreset = savedPresets.find((item) => item.id === activeSavedPresetId);
    const savedPreset: SavedBotPreset = {
      id: existingPreset?.id ?? `preset-${crypto.randomUUID()}`,
      name,
      savedAt: now,
      settings: settingsRef.current,
      source: existingPreset?.source ?? "manual",
    };
    const nextPresets = [savedPreset, ...savedPresets.filter((item) => item.id !== savedPreset.id)];

    setSavedPresets(nextPresets);
    setActiveSavedPresetId(savedPreset.id);
    setActivePresetName(name);
    writeSavedBotPresets(user?.id, nextPresets);
    writeCurrentBotSettings(user?.id, settingsRef.current);
    recordBotPresetActivity(user?.id, "saved", name, savedPreset.id);
    addJournal(`Preset "${name}" saved locally.`, "success");
    toast.success("Bot preset saved.");
  }

  function loadSavedPreset(savedPreset: SavedBotPreset) {
    setSettings(savedPreset.settings);
    settingsRef.current = savedPreset.settings;
    setHistory([]);
    setRedoStack([]);
    setActiveSavedPresetId(savedPreset.id);
    setActivePresetName(savedPreset.name);
    writeCurrentBotSettings(user?.id, savedPreset.settings);
    recordBotPresetActivity(user?.id, "loaded", savedPreset.name, savedPreset.id);
    addJournal(`Loaded saved preset: ${savedPreset.name}.`, "success");
    toast.success(`${savedPreset.name} loaded.`);
  }

  function deleteSavedPreset(presetId: string) {
    const presetToDelete = savedPresets.find((item) => item.id === presetId);
    if (!presetToDelete) return;
    const confirmed = window.confirm(`Delete "${presetToDelete.name}" from saved presets?`);
    if (!confirmed) return;

    const nextPresets = savedPresets.filter((item) => item.id !== presetId);
    setSavedPresets(nextPresets);
    writeSavedBotPresets(user?.id, nextPresets);
    if (activeSavedPresetId === presetId) {
      setActiveSavedPresetId(null);
      setActivePresetName("Unsaved bot");
    }
    recordBotPresetActivity(user?.id, "deleted", presetToDelete.name, presetToDelete.id);
    addJournal(`Deleted preset: ${presetToDelete.name}.`, "warning");
    toast.success("Bot preset deleted.");
  }

  async function importBotFile(file?: File) {
    if (!file) return;
    try {
      const imported = parseImportedBot(await file.text(), file.name);
      const savedPreset: SavedBotPreset = {
        id: `import-${crypto.randomUUID()}`,
        name: imported.name,
        savedAt: new Date().toISOString(),
        settings: imported.settings,
        source: "imported",
      };
      const nextPresets = [
        savedPreset,
        ...savedPresets.filter((item) => item.id !== savedPreset.id),
      ];

      setSavedPresets(nextPresets);
      setSettings(imported.settings);
      settingsRef.current = imported.settings;
      setHistory([]);
      setRedoStack([]);
      setActiveSavedPresetId(savedPreset.id);
      setActivePresetName(imported.name);
      writeSavedBotPresets(user?.id, nextPresets);
      writeCurrentBotSettings(user?.id, imported.settings);
      recordBotPresetActivity(user?.id, "imported", imported.name, savedPreset.id);
      addJournal(`Imported bot file: ${file.name}.`, "success");
      toast.success("Bot imported into the builder.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The bot file could not be imported.";
      addJournal(message, "error");
      toast.error(message);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const handleBlockMove = useCallback((blockId: BlockKey, x: number, y: number) => {
    setBlockPositions((prev) => {
      const next = { ...prev, [blockId]: { x, y } };
      writeBlockPositions(next);
      return next;
    });
  }, []);

  const hideBlock = useCallback(
    (blockId: BlockKey) => {
      setVisibleBlocks((prev) => {
        const next = { ...prev, [blockId]: false };
        writeBlockVisibility(next);
        return next;
      });
      addJournal(`Removed ${BLOCK_LABELS[blockId]} from the workspace.`, "info");
    },
    [],
  );

  const showBlock = useCallback((blockId: BlockKey) => {
    setVisibleBlocks((prev) => {
      if (prev[blockId]) return prev;
      const next = { ...prev, [blockId]: true };
      writeBlockVisibility(next);
      return next;
    });
  }, []);

  const toggleBlockCollapse = useCallback((blockId: BlockKey) => {
    setCollapsedBlocks((prev) => {
      const next = { ...prev, [blockId]: !prev[blockId] };
      writeCollapsedBlocks(next);
      return next;
    });
  }, []);

  const setBlockComment = useCallback((blockId: BlockKey, comment: string) => {
    setBlockComments((prev) => {
      const next = { ...prev };
      if (comment.trim()) next[blockId] = comment.trim();
      else delete next[blockId];
      writeBlockComments(next);
      return next;
    });
  }, []);

  const deleteAllBlocks = useCallback(() => {
    const allHidden: Record<BlockKey, boolean> = {
      trade: false,
      purchase: false,
      sell: false,
      restart: false,
      functions: false,
    };
    setVisibleBlocks(allHidden);
    writeBlockVisibility(allHidden);
    addJournal("Cleared all blocks from the workspace.", "warning");
  }, []);

  const downloadBlock = useCallback(
    (blockId: BlockKey) => {
      const payload = {
        block: blockId,
        label: BLOCK_LABELS[blockId],
        savedAt: new Date().toISOString(),
        settings: settingsRef.current,
      };
      try {
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${blockId}-block.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addJournal(`Downloaded ${BLOCK_LABELS[blockId]} block.`, "success");
      } catch {
        toast.error("Block download failed.");
      }
    },
    [],
  );

  async function runBot() {
    if (status === "running") {
      runningRef.current = false;
      setStatus("stopped");
      addJournal(
        "Stop requested. The bot will stop after the current contract settles.",
        "warning",
      );
      return;
    }

    if (!account) {
      toast.error("Connect and select a Deriv account before running the bot.");
      addJournal("Run blocked: no Deriv account selected.", "error");
      return;
    }

    runningRef.current = true;
    setStatus("running");
    setActiveTab("summary");
    addJournal("Bot run started.", "success");

    try {
      const session = await ensureDerivTradingConnection(account, { context: "bot-builder-run" });
      const runCurrency = accountCurrency || account.currency || settingsRef.current.currency;
      const context = {
        adapter: session.adapter,
        contractType: contractTypeLabel(settingsRef.current),
        selectedAccountId: session.account_id,
        selectedAccountType: session.normalizedType,
      };
      let currentStake = settingsRef.current.stake;
      let runningProfit = stats.totalProfitLoss;

      for (let index = 0; runningRef.current && index < settingsRef.current.maxRuns; index += 1) {
        const snapshot = normalizeSettings({ ...settingsRef.current, currency: runCurrency });
        const stake = clampNumber(currentStake, 0.35, snapshot.maxStake);
        if (!conditionAllowsTrade(snapshot, stake, index + 1, runningProfit)) {
          addJournal("Purchase condition is false. Waiting for the next run cycle.", "warning");
          if (!snapshot.tradeEveryTick) break;
          await sleep(700);
          continue;
        }

        const input = proposalInput(snapshot, stake);
        let settlement: Settlement | null = null;
        let tradeError: unknown = null;
        for (let attempt = 1; attempt <= BOT_TRADE_MAX_ATTEMPTS; attempt += 1) {
          let contractWasBought = false;
          try {
            const payload = buildStandardProposalPayload(input, session.adapter as TradingAdapter);
            addJournal(
              `Requesting proposal for ${contractTypeLabel(snapshot)} with ${stake.toFixed(2)} ${snapshot.currency}.`,
            );
            const proposal = await requestProposal(payload, {
              ...context,
              contractType: String(payload.contract_type ?? context.contractType),
            });
            const proposalId = String(proposal.proposal?.id ?? "");
            const askPrice = positiveNumberFrom(proposal.proposal?.ask_price, stake) ?? stake;
            const buy = await buyProposal(proposalId, askPrice, {
              ...context,
              contractType: String(payload.contract_type ?? context.contractType),
            });
            const contractId = String(buy.buy?.contract_id ?? "");
            contractWasBought = true;
            const record: Transaction = {
              contractId,
              entrySpot: null,
              exitSpot: null,
              id: crypto.randomUUID(),
              payout: 0,
              profit: 0,
              stake,
              status: "open",
              time: formatTime(),
            };
            setTransactions((items) => [record, ...items]);
            upsertTrackedTrade(user?.id, {
              contractId,
              contractType: String(payload.contract_type ?? context.contractType),
              currency: snapshot.currency,
              id: record.id,
              market: snapshot.symbol,
              openedAt: new Date().toISOString(),
              payout: 0,
              profitLoss: 0,
              source: "bot-builder",
              stake,
              status: "open",
            });
            addJournal(`Bought contract ${contractId}. Waiting for settlement.`, "success");
            settlement = await waitForSettlement(contractId);

            setTransactions((items) =>
              items.map((item) =>
                item.id === record.id
                  ? {
                      ...item,
                      entrySpot: settlement?.entrySpot ?? null,
                      exitSpot: settlement?.exitSpot ?? null,
                      payout: settlement?.payout ?? 0,
                      profit: settlement?.profit ?? 0,
                      status: settlement?.status ?? "open",
                    }
                  : item,
              ),
            );
            updateTrackedTrade(user?.id, contractId, {
              closedAt: new Date().toISOString(),
              payout: settlement?.payout ?? 0,
              profitLoss: settlement?.profit ?? 0,
              status:
                settlement?.status === "won"
                  ? "won"
                  : settlement?.status === "lost"
                    ? "lost"
                    : "open",
            });
            tradeError = null;
            break;
          } catch (error) {
            tradeError = error;
            if (
              !contractWasBought &&
              attempt < BOT_TRADE_MAX_ATTEMPTS &&
              shouldRetryBotTrade(error)
            ) {
              addJournal("Deriv returned a temporary processing error. Retrying once.", "warning");
              await sleep(1500);
              continue;
            }
            break;
          }
        }

        if (!settlement) {
          const message = getDerivTradingErrorMessage(tradeError);
          if (snapshot.restartBuySellOnError || snapshot.restartLastTradeOnError) {
            addJournal(`Skipped one bot run after Deriv rejected the trade: ${message}`, "warning");
            await sleep(700);
            continue;
          }
          throw tradeError;
        }

        runningProfit += settlement.profit;
        setStats((current) => ({
          contractsLost: current.contractsLost + (settlement.status === "lost" ? 1 : 0),
          contractsWon: current.contractsWon + (settlement.status === "won" ? 1 : 0),
          runs: current.runs + 1,
          totalPayout: current.totalPayout + settlement.payout,
          totalProfitLoss: current.totalProfitLoss + settlement.profit,
          totalStake: current.totalStake + stake,
        }));
        addJournal(
          `Contract settled ${settlement.status}. P/L ${settlement.profit.toFixed(2)} ${snapshot.currency}.`,
          settlement.status === "won"
            ? "success"
            : settlement.status === "lost"
              ? "warning"
              : "info",
        );
        await refreshBalances("bot-builder-trade-complete", account.account_id).catch((error) => {
          console.warn("[Bot Builder] balance refresh after settled trade failed", error);
        });

        if (runningProfit >= snapshot.takeProfit || runningProfit <= -Math.abs(snapshot.stopLoss)) {
          addJournal("Profit or loss threshold reached. Bot stopped.", "warning");
          break;
        }

        if (snapshot.restartCondition === "never") break;
        if (snapshot.restartCondition === "on_win" && settlement.status !== "won") break;
        if (snapshot.restartCondition === "on_loss" && settlement.status !== "lost") break;

        currentStake =
          settlement.status === "lost"
            ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
            : snapshot.stake;
        if (!snapshot.tradeEveryTick) await sleep(1000);
      }

      await refreshBalances("bot-builder-run-complete", account.account_id).catch((error) => {
        console.warn("[Bot Builder] final balance refresh after run failed", error);
      });
      setStatus("stopped");
      runningRef.current = false;
      addJournal("Bot run completed.", "success");
    } catch (error) {
      const message = getDerivTradingErrorMessage(error);
      runningRef.current = false;
      setStatus("error");
      addJournal(message, "error");
      toast.error(message);
    }
  }

  return (
    <TopShell showAssistantButton={false} showBotMonitor={false}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.xml,application/json,text/xml,application/xml"
        className="hidden"
        onChange={(event) => void importBotFile(event.target.files?.[0])}
      />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#e9eaec] p-2 text-[#171717] dark:bg-[#0f0f0f]">
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden lg:grid lg:h-[calc(100dvh-6.25rem)] lg:min-h-[620px] lg:gap-4",
            leftCollapsed && monitorCollapsed && "lg:grid-cols-[52px_minmax(0,1fr)_52px]",
            leftCollapsed && !monitorCollapsed && "lg:grid-cols-[52px_minmax(0,1fr)_354px]",
            !leftCollapsed && monitorCollapsed && "lg:grid-cols-[228px_minmax(0,1fr)_52px]",
            !leftCollapsed && !monitorCollapsed && "lg:grid-cols-[228px_minmax(0,1fr)_354px]",
          )}
        >
          <BlocksMenu
            activeSavedPresetId={activeSavedPresetId}
            collapsed={leftCollapsed}
            filteredMenu={filteredMenu}
            onAddBlock={showBlock}
            onDeletePreset={deleteSavedPreset}
            onLoadPreset={loadSavedPreset}
            onSearch={setSearchTerm}
            onToggle={() => setLeftCollapsed((value) => !value)}
            searchTerm={searchTerm}
            savedPresets={savedPresets}
            visibleBlocks={visibleBlocks}
          />
          <WorkspaceCanvas
            blockComments={blockComments}
            blockPositions={blockPositions}
            collapsedBlocks={collapsedBlocks}
            monitorCollapsed={monitorCollapsed}
            onBlockMove={handleBlockMove}
            onDeleteAllBlocks={deleteAllBlocks}
            onDownloadBlock={downloadBlock}
            onHideBlock={hideBlock}
            onImport={() => fileInputRef.current?.click()}
            onRedo={redo}
            onReset={resetBot}
            onResetLayout={resetLayout}
            onSave={saveSettings}
            onSetBlockComment={setBlockComment}
            onToggleCollapse={toggleBlockCollapse}
            onUndo={undo}
            onZoomIn={() => setZoom((value) => Math.min(1.2, Number((value + 0.05).toFixed(2))))}
            onZoomOut={() => setZoom((value) => Math.max(0.7, Number((value - 0.05).toFixed(2))))}
            settings={settings}
            updateSettings={updateSettings}
            visibleBlocks={visibleBlocks}
            zoom={zoom}
          />
          <BotRunMonitorPanel
            activeTab={activeTab}
            collapsed={monitorCollapsed}
            currency={settings.currency}
            journal={journal}
            onReset={resetBot}
            onRun={runBot}
            onToggleCollapse={() => setMonitorCollapsed((value) => !value)}
            setActiveTab={setActiveTab}
            stats={stats}
            status={status}
            transactions={transactions}
          />
        </div>
      </div>
    </TopShell>
  );
}

// ─── Blocks menu ──────────────────────────────────────────────────────────────

function BlocksMenu({
  activeSavedPresetId,
  collapsed,
  filteredMenu,
  onAddBlock,
  onDeletePreset,
  onLoadPreset,
  onSearch,
  onToggle,
  searchTerm,
  savedPresets,
  visibleBlocks,
}: {
  activeSavedPresetId: string | null;
  collapsed: boolean;
  filteredMenu: typeof blockMenu;
  onAddBlock: (blockId: BlockKey) => void;
  onDeletePreset: (presetId: string) => void;
  onLoadPreset: (preset: SavedBotPreset) => void;
  onSearch: (value: string) => void;
  onToggle: () => void;
  searchTerm: string;
  savedPresets: SavedBotPreset[];
  visibleBlocks: Record<BlockKey, boolean>;
}) {
  function handleMenuClick(section: string) {
    const map: Record<string, BlockKey> = {
      trade: "trade",
      purchase: "purchase",
      sell: "sell",
      restart: "restart",
    };
    const blockId = map[section];
    if (!blockId) return;
    if (!visibleBlocks[blockId]) {
      onAddBlock(blockId);
    }
  }
  if (collapsed) {
    return (
      <aside className="flex min-h-0 flex-col items-center bg-[#f5f5f5] py-2 dark:bg-[#151515]">
        <button
          type="button"
          onClick={onToggle}
          className="flex size-9 items-center justify-center rounded-[4px] border border-[#d0d2d4] bg-white dark:border-[#333] dark:bg-[#101010]"
        >
          <ChevronRight className="size-5" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex min-h-0 max-h-[28dvh] flex-col overflow-hidden bg-[#f5f5f5] text-[#101213] lg:max-h-none lg:overflow-hidden dark:bg-[#151515] dark:text-[#eeeeee]">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-[54px] items-center justify-between bg-[#eceeef] px-5 text-base font-bold dark:bg-[#202020]"
      >
        <span>Blocks menu</span>
        <ChevronUp className="size-5" />
      </button>

      <div className="border-b border-[#e1e1e1] bg-white p-4 dark:border-[#2b2b2b] dark:bg-[#151515]">
        <label className="flex h-8 items-center gap-2 rounded-[6px] border border-[#d3d5d6] bg-white px-3 text-[#8d8f92] dark:border-[#333] dark:bg-[#101010]">
          <Search className="size-4" />
          <input
            value={searchTerm}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent text-sm text-[#333] outline-none placeholder:text-[#a0a0a0] dark:text-[#eeeeee]"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-[#151515]">
        {filteredMenu.map((item) => {
          const blockKey =
            item.section === "trade" || item.section === "purchase" || item.section === "sell" || item.section === "restart"
              ? (item.section as BlockKey)
              : null;
          const isHidden = blockKey ? !visibleBlocks[blockKey] : false;
          return (
            <a
              key={item.title}
              href={`#${item.section}`}
              onClick={(event) => {
                if (blockKey && isHidden) {
                  event.preventDefault();
                  handleMenuClick(item.section);
                }
              }}
              className="flex h-[41px] w-full items-center justify-between border-b border-[#eeeeee] px-5 text-left text-sm font-bold hover:bg-[#f7f7f7] dark:border-[#2b2b2b] dark:hover:bg-[#202020]"
              title={isHidden ? "Click to add this block to the workspace" : undefined}
            >
              <span className="flex items-center gap-2">
                {item.title}
                {isHidden && (
                  <span className="rounded-full bg-[#075773]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#075773] dark:bg-[#0a8ca8]/20 dark:text-[#76d9eb]">
                    + Add
                  </span>
                )}
              </span>
              {item.collapsible && <ChevronDown className="size-5" />}
            </a>
          );
        })}
      </div>

      <div className="border-t border-[#e1e1e1] bg-white px-3 py-3 dark:border-[#2b2b2b] dark:bg-[#151515]">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[#656565] dark:text-[#b7b7b7]">
          Saved presets
        </div>
        {savedPresets.length === 0 ? (
          <div className="rounded-[4px] border border-dashed border-[#d7d9db] px-3 py-3 text-xs leading-5 text-[#6e6e6e] dark:border-[#333] dark:text-[#b7b7b7]">
            Save or import a bot to keep it here after refresh.
          </div>
        ) : (
          <div className="max-h-48 space-y-2 overflow-auto pr-1">
            {savedPresets.map((preset) => (
              <div
                key={preset.id}
                className={cn(
                  "flex items-center gap-2 rounded-[4px] border border-[#e0e0e0] bg-[#f8f8f8] p-2 dark:border-[#333] dark:bg-[#202020]",
                  activeSavedPresetId === preset.id &&
                    "border-[#4bb4b3] bg-[#e8f7f7] dark:bg-[#143030]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onLoadPreset(preset)}
                  className="min-w-0 flex-1 text-left"
                  title={`Load ${preset.name}`}
                >
                  <div className="truncate text-xs font-bold">{preset.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-[#777]">
                    {preset.source} / {formatShortDate(preset.savedAt)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onDeletePreset(preset.id)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-[3px] text-[#777] hover:bg-[#ff444f]/10 hover:text-[#c52832]"
                  title={`Delete ${preset.name}`}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Workspace canvas ─────────────────────────────────────────────────────────

function WorkspaceCanvas({
  blockComments,
  blockPositions,
  collapsedBlocks,
  monitorCollapsed,
  onBlockMove,
  onDeleteAllBlocks,
  onDownloadBlock,
  onHideBlock,
  onImport,
  onRedo,
  onReset,
  onResetLayout,
  onSave,
  onSetBlockComment,
  onToggleCollapse,
  onUndo,
  onZoomIn,
  onZoomOut,
  settings,
  updateSettings,
  visibleBlocks,
  zoom,
}: {
  blockComments: Partial<Record<BlockKey, string>>;
  blockPositions: Record<BlockKey, BlockPosition>;
  collapsedBlocks: Record<BlockKey, boolean>;
  monitorCollapsed: boolean;
  onBlockMove: (blockId: BlockKey, x: number, y: number) => void;
  onDeleteAllBlocks: () => void;
  onDownloadBlock: (blockId: BlockKey) => void;
  onHideBlock: (blockId: BlockKey) => void;
  onImport: () => void;
  onRedo: () => void;
  onReset: () => void;
  onResetLayout: () => void;
  onSave: () => void;
  onSetBlockComment: (blockId: BlockKey, comment: string) => void;
  onToggleCollapse: (blockId: BlockKey) => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
  visibleBlocks: Record<BlockKey, boolean>;
  zoom: number;
}) {
  const dragRef = useRef<{
    blockId: BlockKey;
    startMouseX: number;
    startMouseY: number;
    startBlockX: number;
    startBlockY: number;
  } | null>(null);
  const dustbinRef = useRef<HTMLDivElement | null>(null);
  const onBlockMoveRef = useRef(onBlockMove);
  onBlockMoveRef.current = onBlockMove;
  const onHideBlockRef = useRef(onHideBlock);
  onHideBlockRef.current = onHideBlock;
  const [dustbinHover, setDustbinHover] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    blockId: BlockKey;
    x: number;
    y: number;
  } | null>(null);

  function isOverDustbin(clientX: number, clientY: number) {
    const rect = dustbinRef.current?.getBoundingClientRect();
    if (!rect) return false;
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!dragRef.current) return;
      const { blockId, startMouseX, startMouseY, startBlockX, startBlockY } = dragRef.current;
      const dx = (e.clientX - startMouseX) / zoom;
      const dy = (e.clientY - startMouseY) / zoom;
      onBlockMoveRef.current(
        blockId,
        Math.max(0, startBlockX + dx),
        Math.max(0, startBlockY + dy),
      );
      setDustbinHover(isOverDustbin(e.clientX, e.clientY));
    }
    function handleMouseUp(e: MouseEvent) {
      if (dragRef.current && isOverDustbin(e.clientX, e.clientY)) {
        onHideBlockRef.current(dragRef.current.blockId);
      }
      dragRef.current = null;
      setDustbinHover(false);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [zoom]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClickAway() {
      setContextMenu(null);
    }
    window.addEventListener("click", handleClickAway);
    window.addEventListener("scroll", handleClickAway, true);
    return () => {
      window.removeEventListener("click", handleClickAway);
      window.removeEventListener("scroll", handleClickAway, true);
    };
  }, [contextMenu]);

  function startDrag(blockId: BlockKey, pos: BlockPosition, event: React.MouseEvent) {
    event.preventDefault();
    dragRef.current = {
      blockId,
      startBlockX: pos.x,
      startBlockY: pos.y,
      startMouseX: event.clientX,
      startMouseY: event.clientY,
    };
  }

  function openContextMenu(blockId: BlockKey, event: React.MouseEvent) {
    event.preventDefault();
    setContextMenu({ blockId, x: event.clientX, y: event.clientY });
  }

  function handleAddComment(blockId: BlockKey) {
    const existing = blockComments[blockId] ?? "";
    const result = window.prompt(`Comment for ${BLOCK_LABELS[blockId]}`, existing);
    if (result === null) return;
    onSetBlockComment(blockId, result);
  }

  function blockProps(blockId: BlockKey) {
    return {
      collapsed: collapsedBlocks[blockId] ?? false,
      comment: blockComments[blockId],
      onContextMenu: (event: React.MouseEvent) => openContextMenu(blockId, event),
      onDragStart: (event: React.MouseEvent) => startDrag(blockId, blockPositions[blockId], event),
    };
  }

  const canvasSize = useMemo(() => {
    let maxRight = 0;
    let maxBottom = 0;
    let anyVisible = false;
    for (const key of ["trade", "purchase", "sell", "restart", "functions"] as BlockKey[]) {
      if (!visibleBlocks[key]) continue;
      anyVisible = true;
      const pos = blockPositions[key];
      const dim = BLOCK_DIMENSIONS[key];
      const height = collapsedBlocks[key] ? BLOCK_COLLAPSED_HEIGHT : dim.height;
      maxRight = Math.max(maxRight, pos.x + dim.width);
      maxBottom = Math.max(maxBottom, pos.y + height);
    }
    if (!anyVisible) {
      return { width: WORKSPACE_MIN_WIDTH, height: WORKSPACE_MIN_HEIGHT };
    }
    const scaledWidth = Math.ceil((maxRight + WORKSPACE_PADDING_X) * zoom);
    const scaledHeight = Math.ceil((maxBottom + WORKSPACE_PADDING_Y) * zoom);
    return {
      width: Math.max(WORKSPACE_MIN_WIDTH, scaledWidth),
      height: Math.max(WORKSPACE_MIN_HEIGHT, scaledHeight + WORKSPACE_TOOLBAR_HEIGHT),
    };
  }, [blockPositions, collapsedBlocks, visibleBlocks, zoom]);

  return (
    <section
      className={cn(
        "relative min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-[#101010]",
        monitorCollapsed ? "pb-0" : "pb-0",
        "lg:h-auto lg:min-h-0 lg:flex-none",
      )}
    >
      <WorkspaceToolbar
        onImport={onImport}
        onRedo={onRedo}
        onReset={onReset}
        onResetLayout={onResetLayout}
        onSave={onSave}
        onUndo={onUndo}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
      <ScrollArea className="h-full">
        <div
          className="relative bg-white dark:bg-[#101010]"
          style={{
            width: canvasSize.width,
            minWidth: "100%",
            height: canvasSize.height,
            minHeight: "100%",
          }}
        >
          <div
            className="absolute left-0 top-[62px] origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            {visibleBlocks.trade && (
              <div
                className="absolute"
                style={{ left: blockPositions.trade.x, top: blockPositions.trade.y }}
              >
                <TradeParametersBlock
                  settings={settings}
                  updateSettings={updateSettings}
                  {...blockProps("trade")}
                />
              </div>
            )}

            {visibleBlocks.purchase && (
              <div
                className="absolute"
                style={{ left: blockPositions.purchase.x, top: blockPositions.purchase.y }}
              >
                <PurchaseConditionsBlock
                  settings={settings}
                  updateSettings={updateSettings}
                  {...blockProps("purchase")}
                />
              </div>
            )}

            {visibleBlocks.sell && (
              <div
                className="absolute"
                style={{ left: blockPositions.sell.x, top: blockPositions.sell.y }}
              >
                <SellConditionsBlock
                  settings={settings}
                  updateSettings={updateSettings}
                  {...blockProps("sell")}
                />
              </div>
            )}

            {visibleBlocks.restart && (
              <div
                className="absolute"
                style={{ left: blockPositions.restart.x, top: blockPositions.restart.y }}
              >
                <RestartTradingConditionsBlock
                  settings={settings}
                  updateSettings={updateSettings}
                  {...blockProps("restart")}
                />
              </div>
            )}

            {visibleBlocks.functions && (
              <div
                className="absolute"
                style={{ left: blockPositions.functions.x, top: blockPositions.functions.y }}
              >
                <FunctionStack
                  settings={settings}
                  updateSettings={updateSettings}
                  {...blockProps("functions")}
                />
              </div>
            )}
          </div>

          <div className="absolute right-[-9px] top-1/2 z-20 flex h-12 w-5 -translate-y-1/2 items-center justify-center border border-[#d2d2d2] bg-white text-[#5d5d5d] dark:border-[#333] dark:bg-[#151515]">
            <ChevronLeft className="size-4" />
            <ChevronRight className="-ml-3 size-4" />
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div
        ref={dustbinRef}
        className={cn(
          "group pointer-events-auto absolute bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all duration-200",
          dustbinHover
            ? "scale-125 border-solid border-[#c52832] bg-[#ffe5e7] text-[#c52832] opacity-100 shadow-lg shadow-[#c52832]/40"
            : "border-dashed border-[#b9bdc2] bg-white/70 text-[#6b7177]/80 opacity-60 shadow-sm backdrop-blur-sm hover:scale-110 hover:opacity-100 hover:shadow-md dark:border-[#444] dark:bg-[#151515]/70 dark:text-[#b7b7b7]/80",
        )}
        title="Drag a block here to remove it from the workspace"
      >
        <Trash2 className={cn("size-5 transition-transform", dustbinHover && "scale-125")} />
      </div>

      {contextMenu && (
        <BlockContextMenu
          blockId={contextMenu.blockId}
          collapsed={collapsedBlocks[contextMenu.blockId] ?? false}
          onAddComment={() => {
            handleAddComment(contextMenu.blockId);
            setContextMenu(null);
          }}
          onClose={() => setContextMenu(null)}
          onDeleteAll={() => {
            const confirmed = window.confirm("Delete all blocks from the workspace?");
            if (confirmed) onDeleteAllBlocks();
            setContextMenu(null);
          }}
          onDelete={() => {
            onHideBlock(contextMenu.blockId);
            setContextMenu(null);
          }}
          onDownload={() => {
            onDownloadBlock(contextMenu.blockId);
            setContextMenu(null);
          }}
          onToggleCollapse={() => {
            onToggleCollapse(contextMenu.blockId);
            setContextMenu(null);
          }}
          x={contextMenu.x}
          y={contextMenu.y}
        />
      )}
    </section>
  );
}

function BlockContextMenu({
  blockId,
  collapsed,
  onAddComment,
  onClose,
  onDelete,
  onDeleteAll,
  onDownload,
  onToggleCollapse,
  x,
  y,
}: {
  blockId: BlockKey;
  collapsed: boolean;
  onAddComment: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDeleteAll: () => void;
  onDownload: () => void;
  onToggleCollapse: () => void;
  x: number;
  y: number;
}) {
  const items: Array<{
    disabled?: boolean;
    hint?: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick: () => void;
  }> = [
    {
      disabled: true,
      hint: "Each block is unique in this workspace",
      icon: Copy,
      label: "Duplicate",
      onClick: () => {},
    },
    { icon: MessageSquare, label: "Add Comment", onClick: onAddComment },
    {
      icon: collapsed ? ChevronDown : ChevronUp,
      label: collapsed ? "Expand Block" : "Collapse Block",
      onClick: onToggleCollapse,
    },
    { icon: Trash2, label: "Remove Block", onClick: onDelete },
    { icon: Trash2, label: "Delete All Blocks", onClick: onDeleteAll },
    { icon: Download, label: "Download Block", onClick: onDownload },
  ];

  return (
    <div
      role="menu"
      aria-label={`Options for ${BLOCK_LABELS[blockId]}`}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      className="fixed z-50 w-56 rounded-md border border-[#d8d9dc] bg-white py-1 text-sm shadow-lg dark:border-[#2f2f2f] dark:bg-[#151515]"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.disabled}
          title={item.hint}
          onClick={() => {
            if (item.disabled) return;
            item.onClick();
          }}
          className={cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px]",
            item.disabled
              ? "cursor-not-allowed text-[#a8acb1]"
              : "text-[#1f1f1f] hover:bg-[#f3f4f6] dark:text-[#e6e6e6] dark:hover:bg-[#202020]",
          )}
        >
          <item.icon className="size-4" />
          <span>{item.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={onClose}
        className="mt-1 w-full border-t border-[#eee] px-3 py-1.5 text-left text-[11px] text-[#777] hover:bg-[#f3f4f6] dark:border-[#2b2b2b] dark:text-[#a0a0a0] dark:hover:bg-[#202020]"
      >
        Close
      </button>
    </div>
  );
}

// ─── Workspace toolbar ────────────────────────────────────────────────────────

function WorkspaceToolbar({
  onImport,
  onRedo,
  onReset,
  onResetLayout,
  onSave,
  onUndo,
  onZoomIn,
  onZoomOut,
}: {
  onImport: () => void;
  onRedo: () => void;
  onReset: () => void;
  onResetLayout: () => void;
  onSave: () => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const actions = [
    { icon: RefreshCw, label: "Reset stats", onClick: onReset },
    { icon: FolderOpen, label: "Import bot", onClick: onImport },
    { icon: Save, label: "Save preset", onClick: onSave },
    { icon: LayoutList, label: "Reset layout", onClick: onResetLayout },
    { icon: LineChart, label: "Analysis view", onClick: onZoomOut },
    { icon: BarChart2, label: "Chart view", onClick: onZoomIn },
    { icon: Undo2, label: "Undo", onClick: onUndo },
    { icon: Redo2, label: "Redo", onClick: onRedo },
    { icon: ZoomIn, label: "Zoom in", onClick: onZoomIn },
    { icon: ZoomOut, label: "Zoom out", onClick: onZoomOut },
  ];

  return (
    <div className="absolute left-0 right-0 top-0 z-30 flex h-[54px] items-center overflow-x-auto bg-white px-2 sm:px-4 dark:bg-[#101010]">
      <div className="flex h-10 shrink-0 items-center overflow-hidden rounded-[4px] border border-[#d0d2d4] bg-white dark:border-[#333] dark:bg-[#151515]">
        {actions.map(({ icon: Icon, label, onClick }, index) => (
          <button
            key={label}
            aria-label={label}
            className={cn(
              "flex size-10 items-center justify-center text-[#1f1f1f] hover:bg-[#f5f5f5] dark:text-[#e6e6e6] dark:hover:bg-[#202020]",
              index === 3 || index === 5 || index === 7
                ? "border-r border-[#d9dbdc]"
                : "border-r border-transparent",
            )}
            title={label}
            type="button"
            onClick={onClick}
          >
            <Icon className="size-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Block visual primitives ──────────────────────────────────────────────────

/**
 * Full-width drag-handle header for each main block.
 * The user grabs this to move the block around the canvas.
 * Right-click opens the block context menu.
 */
function BlockHeader({
  collapsed,
  icon: Icon,
  onContextMenu,
  onMouseDown,
  onToggleCollapse,
  title,
}: {
  collapsed?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  title: string;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      className="flex h-[38px] w-full cursor-grab select-none items-center gap-2 rounded-t-[4px] bg-[#075773] px-3 text-sm font-bold text-white active:cursor-grabbing dark:bg-[#053a4e]"
    >
      {Icon && <Icon className="size-[15px] shrink-0 opacity-75" />}
      <span className="flex-1">{title}</span>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleCollapse();
          }}
          onMouseDown={(event) => event.stopPropagation()}
          className="flex size-5 items-center justify-center rounded text-white/80 hover:bg-white/10 hover:text-white"
          title={collapsed ? "Expand block" : "Collapse block"}
        >
          {collapsed ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
        </button>
      )}
      <GripVertical className="size-4 shrink-0 opacity-30" />
    </div>
  );
}

/** Yellow sticky-note style comment shown above a block when set. */
function BlockComment({ text }: { text: string }) {
  return (
    <div className="mb-1 inline-flex max-w-full items-start gap-1 rounded-t-[4px] rounded-br-[4px] border-l-[3px] border-[#f1b945] bg-[#fff4d4] px-2 py-1 text-[10px] italic text-[#5a4500] shadow-sm dark:bg-[#3a2f12] dark:text-[#fde3a7]">
      <MessageSquare className="mt-[1px] size-3 shrink-0 opacity-70" />
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </div>
  );
}

/** Smaller inner header used for sub-sections within a block. */
function SectionHeader({
  className,
  title,
  width,
}: {
  className?: string;
  title: string;
  width?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[26px] items-center rounded-t-[3px] bg-[#075773] px-3 text-[10px] font-bold text-white dark:bg-[#053a4e]",
        width ?? "w-full",
        className,
      )}
    >
      {title}
    </div>
  );
}

/** Dark teal body wrapper for a block. */
function BlockBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-b-[4px] bg-[#075773] pb-2.5 pr-2 pt-1.5 dark:bg-[#053a4e]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The connector-shaped content tab from the Deriv block builder images.
 * Renders a gray rounded pill with a small left-side connector protrusion.
 */
function TabBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("my-1.5 flex items-stretch", className)}>
      {/* Left connector notch */}
      <div className="h-auto min-h-[28px] w-[6px] shrink-0 self-center rounded-l-[2px] bg-[#e9e9e9] dark:bg-[#2d2d2d]" />
      {/* Main content */}
      <div className="flex min-h-[28px] flex-1 flex-wrap items-center gap-1.5 rounded-r-[3px] bg-[#e9e9e9] px-2 py-1 text-[11px] text-[#242424] shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:bg-[#2d2d2d] dark:text-[#e9e9e9]">
        {children}
      </div>
    </div>
  );
}

/** Empty slot tab — shows as a blank connector area for optional conditions. */
function EmptyTabSlot({ className }: { className?: string }) {
  return (
    <div className={cn("my-1.5 flex items-stretch opacity-60", className)}>
      <div className="h-auto min-h-[26px] w-[6px] shrink-0 self-center rounded-l-[2px] bg-[#e0e0e0] dark:bg-[#2a2a2a]" />
      <div className="flex min-h-[26px] flex-1 items-center rounded-r-[3px] border border-dashed border-[#c8c8c8] bg-[#f0f0f0] px-2 text-[10px] italic text-[#aaa] dark:border-[#3a3a3a] dark:bg-[#252525]">
        drop block here
      </div>
    </div>
  );
}

function BlockLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex min-h-[26px] items-center gap-1 rounded-[3px] bg-[#eeeeee] px-2 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] dark:bg-[#2d2d2d] dark:text-[#e9e9e9]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SetLine({ label, plus, value }: { label: string; plus?: boolean; value?: React.ReactNode }) {
  return (
    <BlockLine className="w-fit">
      set <Pill>{label}</Pill>
      {value && <>to {value}</>}
      {plus && <RoundPlus />}
    </BlockLine>
  );
}

// ─── Block components ─────────────────────────────────────────────────────────

function TradeParametersBlock({
  collapsed,
  comment,
  onContextMenu,
  onDragStart,
  onToggleCollapse,
  settings,
  updateSettings,
}: {
  collapsed?: boolean;
  comment?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div id="trade" className="w-[780px]">
      {comment && <BlockComment text={comment} />}
      <BlockHeader
        title="1. Trade parameters"
        onMouseDown={onDragStart}
        onContextMenu={onContextMenu}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      {!collapsed && (
      <BlockBody className="space-y-0 pl-0">
        <div className="space-y-2 px-2 pb-2 pt-2">
          <BlockLine>
            Market:{" "}
            <SelectPill
              options={["Derived"]}
              value={settings.market}
              onChange={(market) => updateSettings({ market })}
            />{" "}
            <span className="text-white/70">&gt;</span>{" "}
            <SelectPill
              options={["Continuous Indices"]}
              value={settings.assetCategory}
              onChange={(assetCategory) => updateSettings({ assetCategory })}
            />{" "}
            <span className="text-white/70">&gt;</span>{" "}
            <SelectPill
              options={symbolOptions}
              value={settings.symbol}
              onChange={(symbol) => updateSettings({ symbol })}
            />
          </BlockLine>

          <BlockLine>
            Trade Type:{" "}
            <SelectPill
              options={[
                { label: "Digits", value: "digits" },
                { label: "Rise/Fall", value: "rise_fall" },
                { label: "Higher/Lower", value: "higher_lower" },
                { label: "Touch/No Touch", value: "touch_no_touch" },
                { label: "Multiplier", value: "multiplier" },
              ]}
              value={settings.tradeType}
              onChange={(tradeType) => updateSettings({ tradeType: tradeType as TradeTypeUi })}
            />{" "}
            <span className="text-white/70">&gt;</span>{" "}
            <SelectPill
              options={contractFamilyOptions(settings.tradeType)}
              value={contractFamilyValue(settings)}
              onChange={(value) => updateSettings(contractFamilyPatch(settings.tradeType, value))}
            />
          </BlockLine>

          <BlockLine>
            Contract Type:{" "}
            <SelectPill
              options={purchaseDirectionOptions(settings)}
              value={settings.purchaseDirection}
              onChange={(purchaseDirection) => updateSettings({ purchaseDirection })}
            />
          </BlockLine>

          <BlockLine>
            Default Candle Interval:{" "}
            <SelectPill
              options={["1 minute", "2 minutes", "5 minutes", "15 minutes"]}
              value={settings.candleInterval}
              onChange={(candleInterval) => updateSettings({ candleInterval })}
            />
          </BlockLine>

          <BlockLine className="w-[420px]">
            <span>Restart buy/sell on error (disable for better performance):</span>{" "}
            <TinyCheckbox
              checked={settings.restartBuySellOnError}
              onChange={(restartBuySellOnError) => updateSettings({ restartBuySellOnError })}
            />
          </BlockLine>

          <BlockLine className="w-[440px]">
            <span>Restart last trade on error (bot ignores the unsuccessful trade):</span>{" "}
            <TinyCheckbox
              checked={settings.restartLastTradeOnError}
              onChange={(restartLastTradeOnError) => updateSettings({ restartLastTradeOnError })}
            />
          </BlockLine>

          <BlockLine className="w-[220px]">
            Trade every tick:{" "}
            <TinyCheckbox
              checked={settings.tradeEveryTick}
              onChange={(tradeEveryTick) => updateSettings({ tradeEveryTick })}
            />
          </BlockLine>
        </div>

        {/* Run once at start sub-section */}
        <SectionHeader title="Run once at start:" width="w-[220px]" className="ml-2" />
        <div className="mx-2 mb-2 space-y-1 rounded-b-[3px] bg-[#e8e8e8] p-2 dark:bg-[#222]">
          <BlockLine className="w-fit">
            Run at start{" "}
            <TinyCheckbox
              checked={settings.runOnceAtStart}
              onChange={(runOnceAtStart) => updateSettings({ runOnceAtStart })}
            />
          </BlockLine>
          <SetLine
            label="stake"
            value={
              <NumberPill
                min={0.35}
                step={0.01}
                value={settings.stake}
                onChange={(stake) => updateSettings({ stake })}
              />
            }
          />
          <SetLine
            label="maxStake"
            value={
              <NumberPill
                min={0.35}
                step={0.01}
                value={settings.maxStake}
                onChange={(maxStake) => updateSettings({ maxStake })}
              />
            }
          />
          <SetLine
            label="martingale"
            value={
              <NumberPill
                min={1}
                step={0.1}
                value={settings.martingale}
                onChange={(martingale) => updateSettings({ martingale })}
              />
            }
          />
          <SetLine
            label="Expected Profit"
            value={
              <NumberPill
                min={0}
                step={1}
                value={settings.takeProfit}
                onChange={(takeProfit) => updateSettings({ takeProfit })}
              />
            }
          />
          <SetLine
            label="Stop Loss"
            value={
              <NumberPill
                min={0}
                step={1}
                value={settings.stopLoss}
                onChange={(stopLoss) => updateSettings({ stopLoss })}
              />
            }
          />
          <SetLine
            label="No. of runs"
            value={
              <NumberPill
                min={1}
                step={1}
                value={settings.maxRuns}
                onChange={(maxRuns) => updateSettings({ maxRuns })}
              />
            }
          />
        </div>

        {/* Trade options sub-section */}
        <SectionHeader title="Trade options:" width="w-[160px]" className="ml-2" />
        <div className="mx-2 rounded-b-[3px] bg-[#e8e8e8] p-2 dark:bg-[#222]">
          <BlockLine className="flex-wrap">
            Duration:{" "}
            <SelectPill
              options={[
                { label: "Ticks", value: "t" },
                { label: "Seconds", value: "s" },
                { label: "Minutes", value: "m" },
              ]}
              value={settings.durationUnit}
              onChange={(durationUnit) =>
                updateSettings({ durationUnit: durationUnit as DurationUnit })
              }
            />{" "}
            <NumberPill
              min={1}
              step={1}
              value={settings.duration}
              onChange={(duration) => updateSettings({ duration })}
            />{" "}
            Stake: {settings.currency}{" "}
            <NumberPill
              min={0.35}
              step={0.01}
              value={settings.stake}
              onChange={(stake) => updateSettings({ stake })}
            />{" "}
            <span className="text-[10px] text-[#666] dark:text-[#999]">(min: 0.35 · max: 50000)</span>{" "}
            prediction:{" "}
            <NumberPill
              min={0}
              step={1}
              value={settings.selectedDigit}
              onChange={(selectedDigit) => updateSettings({ selectedDigit })}
            />
          </BlockLine>
        </div>
      </BlockBody>
      )}
    </div>
  );
}

function PurchaseConditionsBlock({
  collapsed,
  comment,
  onContextMenu,
  onDragStart,
  onToggleCollapse,
  settings,
  updateSettings,
}: {
  collapsed?: boolean;
  comment?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div id="purchase" className="w-[490px]">
      {comment && <BlockComment text={comment} />}
      <BlockHeader
        icon={ShoppingCart}
        title="2. Purchase conditions"
        onMouseDown={onDragStart}
        onContextMenu={onContextMenu}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      {!collapsed && (
      <BlockBody>
        {/* Main purchase direction — matches reference image */}
        <TabBlock>
          <span className="font-medium">Purchase</span>
          <SelectPill
            options={purchaseDirectionOptions(settings)}
            value={settings.purchaseDirection}
            onChange={(purchaseDirection) => updateSettings({ purchaseDirection })}
          />
        </TabBlock>

        {/* Condition join logic */}
        <TabBlock>
          <span>if</span>
          <SelectPill
            options={["All", "Any"]}
            value={settings.conditionJoin}
            onChange={(conditionJoin) =>
              updateSettings({ conditionJoin: conditionJoin as "All" | "Any" })
            }
          />
          <span>condition is true</span>
        </TabBlock>

        {/* Condition expression */}
        <TabBlock>
          <SelectPill
            options={["Last Digit", "Total Profit", "Stake", "Run Count"]}
            value={settings.conditionLeft}
            onChange={(conditionLeft) => updateSettings({ conditionLeft })}
          />
          <SelectPill
            options={[">", "<", "=", "contains"]}
            value={settings.conditionOperator}
            onChange={(conditionOperator) => updateSettings({ conditionOperator })}
          />
          <TextPill
            value={settings.conditionRight}
            onChange={(conditionRight) => updateSettings({ conditionRight })}
          />
        </TabBlock>

        {/* Quick digit range hints */}
        <TabBlock className="opacity-80">
          <span className="text-[10px] text-[#666] dark:text-[#999]">
            digit range: 0 – 9 · use &quot;contains&quot; for comma-separated values
          </span>
        </TabBlock>
      </BlockBody>
      )}
    </div>
  );
}

function SellConditionsBlock({
  collapsed,
  comment,
  onContextMenu,
  onDragStart,
  onToggleCollapse,
  settings,
  updateSettings,
}: {
  collapsed?: boolean;
  comment?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  function addCondition() {
    const newCondition: SellCondition = { id: crypto.randomUUID(), type: "sell_available" };
    updateSettings({ sellConditions: [...settings.sellConditions, newCondition] });
  }

  function removeCondition(id: string) {
    if (settings.sellConditions.length <= 1) return;
    updateSettings({ sellConditions: settings.sellConditions.filter((c) => c.id !== id) });
  }

  function updateConditionType(id: string, type: SellConditionType) {
    updateSettings({
      sellConditions: settings.sellConditions.map((c) => (c.id === id ? { ...c, type } : c)),
    });
  }

  return (
    <div id="sell" className="w-[490px]">
      {comment && <BlockComment text={comment} />}
      <BlockHeader
        icon={DollarSign}
        title="3. Sell conditions"
        onMouseDown={onDragStart}
        onContextMenu={onContextMenu}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      {!collapsed && (
      <BlockBody>
        {settings.sellConditions.map((condition, index) => (
          <div key={condition.id}>
            <TabBlock>
              <span>if</span>
              <span className="inline-flex items-center rounded-full border border-[#c8c8c8] bg-white px-2 py-0.5 shadow-sm dark:border-[#444] dark:bg-[#1a1a1a]">
                <select
                  value={condition.type}
                  onChange={(e) => updateConditionType(condition.id, e.target.value as SellConditionType)}
                  className="bg-transparent text-[10px] font-medium text-[#333] outline-none dark:text-[#e9e9e9]"
                >
                  {Object.entries(sellConditionLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </span>
              <span>then</span>
              {settings.sellConditions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCondition(condition.id)}
                  className="ml-auto flex size-5 items-center justify-center rounded-full bg-[#cc3333] text-white hover:bg-[#aa2222]"
                  title="Remove this condition"
                >
                  <Minus className="size-3" />
                </button>
              )}
            </TabBlock>
            {/* Action slot — placeholder for the sell action */}
            {index === 0 && <EmptyTabSlot />}
          </div>
        ))}

        {/* Add condition button */}
        <div className="ml-[6px] mt-2">
          <button
            type="button"
            onClick={addCondition}
            className="flex size-7 items-center justify-center rounded-full bg-[#333] text-white hover:bg-[#444] dark:bg-[#555] dark:hover:bg-[#666]"
            title="Add sell condition"
          >
            <Plus className="size-4" />
          </button>
        </div>
      </BlockBody>
      )}
    </div>
  );
}

function RestartTradingConditionsBlock({
  collapsed,
  comment,
  onContextMenu,
  onDragStart,
  onToggleCollapse,
  settings,
  updateSettings,
}: {
  collapsed?: boolean;
  comment?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div id="restart" className="w-[490px]">
      {comment && <BlockComment text={comment} />}
      <BlockHeader
        icon={Flag}
        title="4. Restart trading conditions"
        onMouseDown={onDragStart}
        onContextMenu={onContextMenu}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      {!collapsed && (
      <BlockBody>
        <TabBlock>
          <select
            value={settings.restartCondition}
            onChange={(e) =>
              updateSettings({ restartCondition: e.target.value as RestartConditionType })
            }
            className="bg-transparent text-[11px] font-medium text-[#242424] outline-none dark:text-[#e9e9e9]"
          >
            {Object.entries(restartConditionLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </TabBlock>
      </BlockBody>
      )}
    </div>
  );
}

function FunctionStack({
  collapsed,
  comment,
  onContextMenu,
  onDragStart,
  onToggleCollapse,
  settings,
  updateSettings,
}: {
  collapsed?: boolean;
  comment?: string;
  onContextMenu?: (e: React.MouseEvent) => void;
  onDragStart: (e: React.MouseEvent) => void;
  onToggleCollapse?: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div className="w-[760px]">
      {comment && <BlockComment text={comment} />}
      <BlockHeader
        title="Functions"
        onMouseDown={onDragStart}
        onContextMenu={onContextMenu}
        onToggleCollapse={onToggleCollapse}
        collapsed={collapsed}
      />
      {!collapsed && (
      <BlockBody className="pt-2">
        <div className="space-y-2 px-2 text-[10px] text-[#242424] dark:text-[#e9e9e9]">
          <BlockLine className="w-[430px]">
            function <strong>Martingale Core Functionality</strong> with:
          </BlockLine>
          <BlockLine className="w-[380px]">
            function <strong>Martingale Trade Amount ()</strong> multiplier{" "}
            <NumberPill
              min={1}
              step={0.1}
              value={settings.martingale}
              onChange={(martingale) => updateSettings({ martingale })}
            />
          </BlockLine>
          <BlockLine className="w-[340px]">
            function <strong>marketwizard v1.5 ()</strong> max runs{" "}
            <NumberPill
              min={1}
              step={1}
              value={settings.maxRuns}
              onChange={(maxRuns) => updateSettings({ maxRuns })}
            />
          </BlockLine>
        </div>

        <div className="mx-2 mt-3 space-y-2 rounded-[3px] bg-[#e8e8e8] p-3 text-[10px] dark:bg-[#1e1e1e]">
          <BlockLine className="w-[650px]">
            function <strong>Martingale Trade Again After Purchase</strong> with: martingale:profit,
            martingale:resultIsWin <RoundPlus />
          </BlockLine>
          <BlockLine className="ml-6 w-[420px]">
            change <Pill>martingale:totalProfit</Pill> by <Pill>martingale:profit</Pill>
          </BlockLine>
          <BlockLine className="ml-6 w-[580px]">
            set <Pill>martingale:totalProfit</Pill> to <Pill>round</Pill>{" "}
            <Pill>martingale:totalProfit</Pill> * 100 / 100
          </BlockLine>
          <BlockLine className="ml-6 w-[570px]">
            Martingale Core Functionality with: martingale:resultIsWin{" "}
            <Pill>martingale:resultIsWin</Pill>
          </BlockLine>
          <BlockLine className="ml-6 w-[390px]">
            set <Pill>Notification:totalProfit</Pill> to create text with <RoundPlus />
          </BlockLine>
          <BlockLine className="ml-12 w-[220px]">
            Total Profit: <RoundMinus />
          </BlockLine>
          <BlockLine className="ml-12 w-[245px]">
            <Pill>martingale:totalProfit</Pill> <RoundMinus />
          </BlockLine>
          <BlockLine className="ml-6 w-[520px]">
            Notify <Pill>blue</Pill> with sound: <Pill>Silent</Pill>{" "}
            <Pill>Notification:totalProfit</Pill>
          </BlockLine>
          <BlockLine className="ml-6 w-[340px]">
            set <Pill>martingale:tradeAgain</Pill> to{" "}
            <SelectPill
              options={[
                { label: "false", value: "false" },
                { label: "true", value: "true" },
              ]}
              value={settings.restartLastTradeOnError ? "true" : "false"}
              onChange={(value) => updateSettings({ restartLastTradeOnError: value === "true" })}
            />
          </BlockLine>
          <BlockLine className="ml-6 w-[620px]">
            if <Pill>martingale:totalProfit</Pill> &lt;{" "}
            <NumberPill
              min={0}
              step={1}
              value={settings.takeProfit}
              onChange={(takeProfit) => updateSettings({ takeProfit })}
            />{" "}
            then stop
          </BlockLine>
          <BlockLine className="ml-12 w-[650px]">
            if <Pill>martingale:totalProfit</Pill> &gt;{" "}
            <NumberPill
              min={0}
              step={1}
              value={settings.stopLoss}
              onChange={(stopLoss) => updateSettings({ stopLoss })}
            />{" "}
            then stop
          </BlockLine>
        </div>
      </BlockBody>
      )}
    </div>
  );
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border border-[#d8d8d8] bg-white px-2 text-[10px] shadow-sm dark:border-[#444] dark:bg-[#1a1a1a] dark:text-[#e9e9e9]">
      {children}
      <ChevronDown className="ml-1 size-3" />
    </span>
  );
}

function SelectPill({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: Array<string | { label: string; value: string }>;
  value: string;
}) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border border-[#d8d8d8] bg-white px-1 text-[10px] shadow-sm dark:border-[#444] dark:bg-[#1a1a1a]">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[180px] bg-transparent px-1 text-[10px] font-medium text-[#333] outline-none dark:text-[#e9e9e9]"
      >
        {options.map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </span>
  );
}

function NumberPill({
  min,
  onChange,
  step,
  value,
}: {
  min: number;
  onChange: (value: number) => void;
  step: number;
  value: number;
}) {
  return (
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-[22px] w-[62px] rounded-full border border-[#d8d8d8] bg-white px-2 text-right text-[10px] font-medium shadow-sm outline-none dark:border-[#444] dark:bg-[#1a1a1a] dark:text-[#e9e9e9]"
    />
  );
}

function TextPill({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-[22px] w-[80px] rounded-full border border-[#d8d8d8] bg-white px-2 text-[10px] font-medium shadow-sm outline-none dark:border-[#444] dark:bg-[#1a1a1a] dark:text-[#e9e9e9]"
    />
  );
}

function TinyCheckbox({
  checked,
  onChange,
}: {
  checked?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex size-4 items-center justify-center rounded-[2px] border text-[10px]",
        checked
          ? "border-[#075773] bg-[#075773] text-white dark:border-[#0a8ca8] dark:bg-[#0a8ca8]"
          : "border-[#bbb] bg-white dark:border-[#555] dark:bg-[#1a1a1a]",
      )}
    >
      {checked ? "✓" : ""}
    </button>
  );
}

function RoundPlus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white dark:bg-[#555]">
      +
    </span>
  );
}

function RoundMinus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white dark:bg-[#555]">
      -
    </span>
  );
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function settingsFromBotPreset(preset: BotPresetConfig): BotSettings {
  const stake = Number(preset.stake) || initialSettings.stake;
  const martingale = Number(preset.martingale) || initialSettings.martingale;
  const direction = preset.contractType.toLowerCase();
  const condition =
    preset.tradeType === "even_odd"
      ? {
          conditionOperator: "contains",
          conditionRight: direction === "odd" ? "1,3,5,7,9" : "0,2,4,6,8",
        }
      : preset.tradeType === "matches_differs"
        ? {
            conditionOperator: direction === "matches" ? "=" : ">",
            conditionRight:
              direction === "matches"
                ? String(preset.predictionDigit)
                : String(Math.max(0, preset.predictionDigit - 1)),
          }
        : {
            conditionOperator: direction === "under" ? "<" : ">",
            conditionRight: String(
              direction === "under"
                ? Math.min(9, preset.predictionDigit + 1)
                : Math.max(0, preset.predictionDigit - 1),
            ),
          };

  return normalizeSettings({
    ...initialSettings,
    conditionLeft: "Last Digit",
    conditionOperator: condition.conditionOperator,
    conditionRight: condition.conditionRight,
    digitContract: preset.tradeType,
    duration: preset.duration,
    durationUnit: preset.durationUnit,
    martingale,
    maxRuns: preset.maxRuns,
    maxStake: Math.max(stake, stake * Math.max(1, martingale) * 8),
    purchaseDirection: direction,
    selectedDigit: preset.predictionDigit,
    stake,
    stopLoss: preset.sl,
    symbol: preset.market,
    takeProfit: preset.tp,
    tradeType: "digits",
  });
}

function parseImportedBot(text: string, fileName: string): ImportedBotSettings {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("The selected bot file is empty.");
  if (fileName.toLowerCase().endsWith(".xml") || trimmed.startsWith("<")) {
    return parseXmlBot(trimmed, fileName);
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const container = isRecord(parsed) ? parsed : {};
    const sourceRecord = importedSettingsRecord(container);
    return {
      name: readString(container, "name", stripFileExtension(fileName)),
      settings: settingsFromRecord(sourceRecord),
    };
  } catch {
    throw new Error("Import failed. Select a valid Deriv XML bot or JSON strategy file.");
  }
}

function importedSettingsRecord(container: Record<string, unknown>) {
  const direct = isRecord(container.settings)
    ? container.settings
    : isRecord(container.botSettings)
      ? container.botSettings
      : isRecord(container.configuration)
        ? container.configuration
        : container;
  const tradeParameters = isRecord(direct.tradeParameters) ? direct.tradeParameters : {};
  const riskSettings = isRecord(direct.riskSettings) ? direct.riskSettings : {};
  return { ...direct, ...tradeParameters, ...riskSettings };
}

function parseXmlBot(text: string, fileName: string): ImportedBotSettings {
  const document = new DOMParser().parseFromString(text, "text/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("Import failed. The Deriv XML bot file could not be parsed.");
  }

  const field = (names: string[]) => firstXmlFieldText(document, names);
  const tradeTypeText = [
    field(["TRADETYPE_LIST", "TRADETYPE", "TRADE_TYPE"]),
    field(["TYPE_LIST", "CONTRACT_TYPE", "CONTRACTTYPE"]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const prediction = firstFiniteNumber([
    field(["PREDICTION", "BARRIER", "LAST_DIGIT"]),
    firstXmlNumberFromVariable(document, ["prediction", "digit", "barrier"]),
  ]);
  const stake = firstFiniteNumber([
    field(["AMOUNT", "STAKE"]),
    firstXmlNumberFromVariable(document, ["stake", "amount", "initial amount"]),
  ]);

  const next: BotSettings = {
    ...initialSettings,
    currency: field(["CURRENCY", "CURRENCY_LIST"]) ?? initialSettings.currency,
    duration:
      firstFiniteNumber([
        field(["DURATION", "DURATION_LIST"]),
        firstXmlNumberFromVariable(document, ["duration"]),
      ]) ?? initialSettings.duration,
    durationUnit: durationUnitValue(
      field(["DURATIONTYPE_LIST", "DURATION_UNIT", "DURATION_UNIT_LIST"])?.toLowerCase(),
      initialSettings.durationUnit,
    ),
    maxRuns:
      firstXmlNumberFromVariable(document, ["max runs", "runs", "tradesno", "trades no"]) ??
      initialSettings.maxRuns,
    martingale:
      firstXmlNumberFromVariable(document, ["martingale", "multiplier"]) ??
      initialSettings.martingale,
    selectedDigit: prediction ?? initialSettings.selectedDigit,
    stake: stake ?? initialSettings.stake,
    stopLoss:
      firstXmlNumberFromVariable(document, ["stop loss", "stoploss", "loss limit"]) ??
      initialSettings.stopLoss,
    symbol: field(["SYMBOL_LIST", "SYMBOL", "MARKET_LIST", "MARKET"]) ?? initialSettings.symbol,
    takeProfit:
      firstXmlNumberFromVariable(document, ["expected profit", "take profit", "profit target"]) ??
      initialSettings.takeProfit,
    tradeType: "digits",
  };

  if (
    tradeTypeText.includes("over") ||
    tradeTypeText.includes("under") ||
    tradeTypeText.includes("digitover") ||
    tradeTypeText.includes("digitunder")
  ) {
    next.digitContract = "over_under";
    next.purchaseDirection =
      tradeTypeText.includes("under") || tradeTypeText.includes("digitunder") ? "under" : "over";
  } else if (
    tradeTypeText.includes("matches") ||
    tradeTypeText.includes("differs") ||
    tradeTypeText.includes("digitmatch") ||
    tradeTypeText.includes("digitdiff")
  ) {
    next.digitContract = "matches_differs";
    next.purchaseDirection =
      tradeTypeText.includes("differs") || tradeTypeText.includes("digitdiff")
        ? "differs"
        : "matches";
  } else if (
    tradeTypeText.includes("even") ||
    tradeTypeText.includes("odd") ||
    tradeTypeText.includes("digiteven") ||
    tradeTypeText.includes("digitodd")
  ) {
    next.digitContract = "even_odd";
    next.purchaseDirection =
      tradeTypeText.includes("odd") || tradeTypeText.includes("digitodd") ? "odd" : "even";
  }

  if (next.purchaseDirection === "under") {
    next.conditionOperator = "<";
    next.conditionRight = String(Math.min(9, next.selectedDigit + 1));
  } else if (next.purchaseDirection === "odd") {
    next.conditionOperator = "contains";
    next.conditionRight = "1,3,5,7,9";
  } else if (next.purchaseDirection === "even") {
    next.conditionOperator = "contains";
    next.conditionRight = "0,2,4,6,8";
  } else {
    next.conditionOperator = ">";
    next.conditionRight = String(Math.max(0, next.selectedDigit - 1));
  }

  next.maxStake = Math.max(next.stake, next.stake * Math.max(1, next.martingale) * 8);

  return {
    name: stripFileExtension(fileName),
    settings: normalizeSettings(next),
  };
}

function settingsFromRecord(record: Record<string, unknown>): BotSettings {
  const isPresetLike =
    typeof record.contractType === "string" &&
    typeof record.tradeType === "string" &&
    ("tp" in record || "sl" in record || "predictionDigit" in record);
  if (isPresetLike) {
    const stake = readNumber(record, "stake", initialSettings.stake);
    const martingale = readNumber(record, "martingale", initialSettings.martingale);
    const digitContract = digitContractValue(record.tradeType, initialSettings.digitContract);
    const selectedDigit = readNumber(record, "predictionDigit", initialSettings.selectedDigit);
    const purchaseDirection = readString(record, "contractType", initialSettings.purchaseDirection);
    const condition =
      digitContract === "even_odd"
        ? {
            conditionOperator: "contains",
            conditionRight: purchaseDirection === "odd" ? "1,3,5,7,9" : "0,2,4,6,8",
          }
        : digitContract === "matches_differs"
          ? {
              conditionOperator: purchaseDirection === "matches" ? "=" : ">",
              conditionRight:
                purchaseDirection === "matches"
                  ? String(selectedDigit)
                  : String(Math.max(0, selectedDigit - 1)),
            }
          : {
              conditionOperator: purchaseDirection === "under" ? "<" : ">",
              conditionRight: String(
                purchaseDirection === "under"
                  ? Math.min(9, selectedDigit + 1)
                  : Math.max(0, selectedDigit - 1),
              ),
            };
    return normalizeSettings({
      ...initialSettings,
      conditionOperator: condition.conditionOperator,
      conditionRight: condition.conditionRight,
      digitContract,
      duration: readNumber(record, "duration", initialSettings.duration),
      durationUnit: durationUnitValue(record.durationUnit, initialSettings.durationUnit),
      martingale,
      maxRuns: readNumber(record, "maxRuns", initialSettings.maxRuns),
      maxStake: Math.max(stake, stake * Math.max(1, martingale) * 8),
      purchaseDirection,
      selectedDigit,
      stake,
      stopLoss: readNumber(record, "sl", initialSettings.stopLoss),
      symbol: readString(record, "market", initialSettings.symbol),
      takeProfit: readNumber(record, "tp", initialSettings.takeProfit),
      tradeType: "digits",
    });
  }

  return normalizeSettings({
    ...initialSettings,
    assetCategory: readString(record, "assetCategory", initialSettings.assetCategory),
    candleInterval: readString(record, "candleInterval", initialSettings.candleInterval),
    conditionJoin: conditionJoinValue(record.conditionJoin, initialSettings.conditionJoin),
    conditionLeft: readString(record, "conditionLeft", initialSettings.conditionLeft),
    conditionOperator: readString(record, "conditionOperator", initialSettings.conditionOperator),
    conditionRight: readString(record, "conditionRight", initialSettings.conditionRight),
    currency: readString(record, "currency", initialSettings.currency),
    digitContract: digitContractValue(record.digitContract, initialSettings.digitContract),
    duration: readNumber(record, "duration", initialSettings.duration),
    durationUnit: durationUnitValue(record.durationUnit, initialSettings.durationUnit),
    market: readString(record, "market", initialSettings.market),
    martingale: readNumber(record, "martingale", initialSettings.martingale),
    maxRuns: readNumber(record, "maxRuns", initialSettings.maxRuns),
    maxStake: readNumber(record, "maxStake", initialSettings.maxStake),
    purchaseDirection: readString(record, "purchaseDirection", initialSettings.purchaseDirection),
    restartBuySellOnError: readBoolean(
      record,
      "restartBuySellOnError",
      initialSettings.restartBuySellOnError,
    ),
    restartCondition: restartConditionValue(
      record.restartCondition,
      initialSettings.restartCondition,
    ),
    restartLastTradeOnError: readBoolean(
      record,
      "restartLastTradeOnError",
      initialSettings.restartLastTradeOnError,
    ),
    runOnceAtStart: readBoolean(record, "runOnceAtStart", initialSettings.runOnceAtStart),
    selectedDigit: readNumber(record, "selectedDigit", initialSettings.selectedDigit),
    sellConditions: sellConditionsFromRecord(record),
    stake: readNumber(record, "stake", initialSettings.stake),
    stopLoss: readNumber(record, "stopLoss", initialSettings.stopLoss),
    symbol: readString(record, "symbol", initialSettings.symbol),
    takeProfit: readNumber(record, "takeProfit", initialSettings.takeProfit),
    tradeEveryTick: readBoolean(record, "tradeEveryTick", initialSettings.tradeEveryTick),
    tradeType: tradeTypeValue(record.tradeType, initialSettings.tradeType),
  });
}

function normalizeSettings(settings: BotSettings): BotSettings {
  const patch: Partial<BotSettings> = {};
  if (settings.tradeType !== "digits") {
    patch.digitContract = "even_odd";
  }
  if (
    !purchaseDirectionOptions(settings).some((item) => item.value === settings.purchaseDirection)
  ) {
    patch.purchaseDirection = purchaseDirectionOptions(settings)[0]?.value ?? "even";
  }
  const digitContract = patch.digitContract ?? settings.digitContract;
  const purchaseDirection = patch.purchaseDirection ?? settings.purchaseDirection;
  let selectedDigit = Math.max(0, Math.min(9, Math.round(Number(settings.selectedDigit) || 0)));
  if (settings.tradeType === "digits" && digitContract === "over_under") {
    if (purchaseDirection === "over") selectedDigit = Math.min(8, selectedDigit);
    if (purchaseDirection === "under") selectedDigit = Math.max(1, selectedDigit);
  }

  const sellConditions =
    Array.isArray(settings.sellConditions) && settings.sellConditions.length > 0
      ? settings.sellConditions
      : initialSettings.sellConditions;

  return {
    ...settings,
    ...patch,
    duration: Math.max(1, Math.round(Number(settings.duration) || 1)),
    martingale: clampNumber(settings.martingale, 1, 100),
    maxRuns: Math.max(1, Math.round(Number(settings.maxRuns) || 1)),
    maxStake: clampNumber(settings.maxStake, 0.35, 50000),
    selectedDigit,
    sellConditions,
    stake: clampNumber(settings.stake, 0.35, 50000),
    stopLoss: Math.max(0, Number(settings.stopLoss) || 0),
    takeProfit: Math.max(0, Number(settings.takeProfit) || 0),
  };
}

// ─── Contract/trade option helpers ───────────────────────────────────────────

function contractFamilyOptions(tradeType: TradeTypeUi) {
  if (tradeType === "digits") {
    return [
      { label: "Even/Odd", value: "even_odd" },
      { label: "Over/Under", value: "over_under" },
      { label: "Matches/Differs", value: "matches_differs" },
    ];
  }
  if (tradeType === "rise_fall") return [{ label: "Rise/Fall", value: "rise_fall" }];
  if (tradeType === "higher_lower") return [{ label: "Higher/Lower", value: "higher_lower" }];
  if (tradeType === "touch_no_touch") return [{ label: "Touch/No Touch", value: "touch_no_touch" }];
  return [{ label: "Multiplier", value: "multiplier" }];
}

function contractFamilyValue(settings: BotSettings) {
  return settings.tradeType === "digits" ? settings.digitContract : settings.tradeType;
}

function contractFamilyPatch(tradeType: TradeTypeUi, value: string): Partial<BotSettings> {
  if (tradeType === "digits") {
    const digitContract = value as DigitContract;
    return {
      digitContract,
      purchaseDirection:
        digitContract === "even_odd"
          ? "even"
          : digitContract === "matches_differs"
            ? "matches"
            : "over",
    };
  }
  return {
    purchaseDirection:
      value === "rise_fall"
        ? "up"
        : value === "higher_lower"
          ? "higher"
          : value === "touch_no_touch"
            ? "touch"
            : "up",
    tradeType: value as TradeTypeUi,
  };
}

function purchaseDirectionOptions(settings: BotSettings) {
  const category = settings.tradeType === "digits" ? settings.digitContract : settings.tradeType;
  if (category === "even_odd") {
    return [
      { label: "Even", value: "even" },
      { label: "Odd", value: "odd" },
    ];
  }
  if (category === "over_under") {
    return [
      { label: "Over", value: "over" },
      { label: "Under", value: "under" },
    ];
  }
  if (category === "matches_differs") {
    return [
      { label: "Matches", value: "matches" },
      { label: "Differs", value: "differs" },
    ];
  }
  if (category === "rise_fall") {
    return [
      { label: "Rise", value: "up" },
      { label: "Fall", value: "down" },
    ];
  }
  if (category === "higher_lower") {
    return [
      { label: "Higher", value: "higher" },
      { label: "Lower", value: "lower" },
    ];
  }
  if (category === "touch_no_touch") {
    return [
      { label: "Touch", value: "touch" },
      { label: "No Touch", value: "no_touch" },
    ];
  }
  return [
    { label: "Multiplier Up", value: "up" },
    { label: "Multiplier Down", value: "down" },
  ];
}

function tradeCategory(settings: BotSettings): TradeCategory {
  if (settings.tradeType === "digits") return settings.digitContract;
  return settings.tradeType;
}

function contractTypeLabel(settings: BotSettings) {
  return `${contractFamilyOptions(settings.tradeType).find((item) => item.value === contractFamilyValue(settings))?.label ?? "Contract"} / ${purchaseDirectionOptions(settings).find((item) => item.value === settings.purchaseDirection)?.label ?? settings.purchaseDirection}`;
}

function proposalInput(settings: BotSettings, stake: number): ProposalInput {
  return {
    barrier:
      tradeCategory(settings) === "higher_lower" || tradeCategory(settings) === "touch_no_touch"
        ? "+0.10"
        : String(settings.selectedDigit),
    currency: settings.currency,
    duration: settings.duration,
    durationUnit: settings.durationUnit,
    market: settings.symbol,
    multiplier: 100,
    payoutMode: "stake",
    selectedDigit: settings.selectedDigit,
    side: settings.purchaseDirection,
    stake,
    stopLoss: settings.stopLoss,
    takeProfit: settings.takeProfit,
    tradeType: tradeCategory(settings),
  };
}

function conditionAllowsTrade(
  settings: BotSettings,
  stake: number,
  runNumber: number,
  totalProfit: number,
) {
  const leftValue =
    settings.conditionLeft === "Total Profit"
      ? totalProfit
      : settings.conditionLeft === "Stake"
        ? stake
        : settings.conditionLeft === "Run Count"
          ? runNumber
          : settings.selectedDigit;
  const rightValue = Number(settings.conditionRight);
  if (settings.conditionOperator === "contains") {
    return settings.conditionRight
      .split(",")
      .map((item) => item.trim())
      .includes(String(leftValue));
  }
  if (!Number.isFinite(rightValue)) return true;
  if (settings.conditionOperator === ">") return leftValue > rightValue;
  if (settings.conditionOperator === "<") return leftValue < rightValue;
  return leftValue === rightValue;
}

// ─── Trade execution helpers ──────────────────────────────────────────────────

async function waitForSettlement(contractId: string): Promise<Settlement> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => Promise<void>) | undefined;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ entrySpot: null, exitSpot: null, payout: 0, profit: 0, status: "open" });
      void unsubscribe?.();
    }, 45000);

    subscribeOpenContract(contractId, (contract) => {
      const statusText = String(contract.status ?? "").toLowerCase();
      const isSold =
        contract.is_sold === 1 ||
        contract.is_sold === true ||
        contract.is_expired === 1 ||
        contract.is_expired === true ||
        statusText === "won" ||
        statusText === "lost" ||
        statusText === "sold";
      if (!isSold || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      const entrySpot = numberFrom(
        contract.entry_spot,
        contract.entry_tick,
        contract.entry_tick_display_value,
      );
      const exitSpot = numberFrom(
        contract.exit_spot,
        contract.exit_tick,
        contract.exit_tick_display_value,
        contract.sell_spot,
        contract.current_spot,
        contract.current_tick,
        contract.current_spot_display_value,
      );
      const profit = Number(contract.profit ?? 0);
      const payout = Number(contract.payout ?? contract.sell_price ?? contract.bid_price ?? 0);
      resolve({
        entrySpot,
        exitSpot,
        payout: Number.isFinite(payout) ? payout : 0,
        profit: Number.isFinite(profit) ? profit : 0,
        status: profit >= 0 ? "won" : "lost",
      });
      void unsubscribe?.();
    })
      .then((off) => {
        unsubscribe = off;
      })
      .catch((error) => {
        window.clearTimeout(timeout);
        reject(error);
      });
  });
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function shouldRetryBotTrade(error: unknown) {
  const message = getDerivTradingErrorMessage(error).toLowerCase();
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase();
  return (
    message.includes(DERIV_TEMPORARY_PROCESSING_MESSAGE.toLowerCase()) ||
    message.includes("timed out") ||
    code.includes("internal") ||
    code.includes("rate") ||
    code.includes("timeout")
  );
}

function positiveNumberFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

function clampNumber(value: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "saved";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function stripFileExtension(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "Imported bot";
}

// ─── Type coercions ───────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string, fallback: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readNumber(record: Record<string, unknown>, key: string, fallback: number) {
  const value = record[key];
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean) {
  const value = record[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function durationUnitValue(value: unknown, fallback: DurationUnit): DurationUnit {
  if (value === "m" || value === "s" || value === "t") return value;
  if (value === "minutes") return "m";
  if (value === "seconds") return "s";
  if (value === "ticks") return "t";
  return fallback;
}

function digitContractValue(value: unknown, fallback: DigitContract): DigitContract {
  if (value === "even_odd" || value === "matches_differs" || value === "over_under") {
    return value;
  }
  const normalized = String(value ?? "").toLowerCase();
  if (normalized.includes("over") || normalized.includes("under")) return "over_under";
  if (normalized.includes("match") || normalized.includes("differ")) return "matches_differs";
  if (normalized.includes("even") || normalized.includes("odd")) return "even_odd";
  return fallback;
}

function tradeTypeValue(value: unknown, fallback: TradeTypeUi): TradeTypeUi {
  if (
    value === "digits" ||
    value === "higher_lower" ||
    value === "multiplier" ||
    value === "rise_fall" ||
    value === "touch_no_touch"
  ) {
    return value;
  }
  return fallback;
}

function conditionJoinValue(value: unknown, fallback: "All" | "Any") {
  return value === "All" || value === "Any" ? value : fallback;
}

function restartConditionValue(value: unknown, fallback: RestartConditionType): RestartConditionType {
  if (
    value === "trade_again" ||
    value === "on_win" ||
    value === "on_loss" ||
    value === "never"
  ) {
    return value;
  }
  return fallback;
}

function sellConditionsFromRecord(record: Record<string, unknown>): SellCondition[] {
  const raw = record.sellConditions;
  if (!Array.isArray(raw) || raw.length === 0) return initialSettings.sellConditions;
  const parsed = raw
    .filter(isRecord)
    .map((item) => ({
      id: readString(item, "id", crypto.randomUUID()),
      type: sellConditionTypeValue(item.type),
    }));
  return parsed.length > 0 ? parsed : initialSettings.sellConditions;
}

function sellConditionTypeValue(value: unknown): SellConditionType {
  if (
    value === "sell_available" ||
    value === "take_profit" ||
    value === "stop_loss" ||
    value === "contract_expired"
  ) {
    return value;
  }
  return "sell_available";
}

function firstFiniteNumber(values: Array<number | string | null | undefined>) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}

function firstXmlFieldText(document: Document, names: string[]) {
  for (const name of names) {
    const field = document.querySelector(`field[name="${name}"]`);
    const value = field?.textContent?.trim();
    if (value) return value;
  }
  return undefined;
}

function firstXmlNumberFromVariable(document: Document, variableHints: string[]) {
  const variables = Array.from(document.querySelectorAll('block[type="variables_set"]'));
  for (const block of variables) {
    const variableName = block.querySelector('field[name="VAR"]')?.textContent?.trim() ?? "";
    const normalizedName = variableName.toLowerCase();
    if (!variableHints.some((hint) => normalizedName.includes(hint))) continue;
    const value =
      block.querySelector('value[name="VALUE"] field[name="NUM"]')?.textContent?.trim() ??
      block.querySelector('field[name="NUM"]')?.textContent?.trim();
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return undefined;
}
