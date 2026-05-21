import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import {
  persistBotMonitorSnapshot,
  readBotMonitorSnapshot,
  updateTrackedTrade,
  upsertTrackedTrade,
} from "@/lib/activity-memory";
import {
  ensureDerivTradingConnection,
  getDerivTradingErrorMessage,
  subscribeBalance,
  type TradeCategory,
  type TradingAdapter,
} from "@/lib/deriv";
import { resolveRunnableBotSettings, type BotBuilderSettings } from "@/lib/bot-builder-state";
import { getDerivWorkspace } from "@/external/bot-builder/blockly-runtime";
import {
  extractSettingsFromXmlText,
  persistWorkspaceSnapshot,
  readSavedWorkspaceXml,
} from "@/external/bot-builder/workspace-persistence";
import { buyProposal, requestProposal, sellContract, subscribeOpenContract } from "@/lib/deriv-trading-service";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import {
  initBotState,
  runAfterPurchase,
  runBeforePurchase,
  runDuringPurchase,
  runSubmarket,
  runTickAnalysis,
  evalBotPrediction,
  getBotStakeVar,
  getXmlOhlcGranularity,
  purchaseTypeToSide,
  type BotVarState,
  type OhlcCandle,
} from "@/lib/bot-xml-runtime";
import { DERIV_LEGACY_WEBSOCKET_URL, DERIV_LEGACY_APP_ID } from "@/lib/deriv-config";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  DEFAULT_BOT_MONITOR_JOURNAL,
  EMPTY_BOT_MONITOR_STATS,
  type BotMonitorJournalEntry,
  type BotMonitorStats,
  type BotMonitorStatus,
  type BotMonitorTransaction,
} from "@/components/bot-run-monitor";
import { numberFrom } from "@/lib/contract-state";

// dbot/DBotStore/globalObserver/api_base access window at module-evaluation time (blockly.js
// line 6 does `window.goog = goog`). Importing them statically in __root.tsx's SSR path crashes
// the server. Load them lazily on the client only.
type _DbotDefault = (typeof import("@/external/bot-skeleton/scratch/dbot"))["default"];
type _DbotStoreDefault = (typeof import("@/external/bot-skeleton/scratch/dbot-store"))["default"];
type _GlobalObserver = (typeof import("@/external/bot-skeleton/utils/observer"))["observer"];
type _ApiBase = (typeof import("@/external/bot-skeleton/services/api/api-base"))["api_base"];

let _dbot: _DbotDefault | null = null;
let _DBotStore: _DbotStoreDefault | null = null;
let _globalObserver: _GlobalObserver | null = null;
let _api_base: _ApiBase | null = null;
let _dbotLoadPromise: Promise<void> | null = null;

function loadDbotModules(): Promise<void> {
  if (_dbotLoadPromise) return _dbotLoadPromise;
  _dbotLoadPromise = Promise.all([
    import("@/external/bot-skeleton/scratch/dbot"),
    import("@/external/bot-skeleton/scratch/dbot-store"),
    import("@/external/bot-skeleton/utils/observer"),
    import("@/external/bot-skeleton/services/api/api-base"),
  ]).then(([dbotMod, storeMod, obsMod, apiBaseMod]) => {
    _dbot = dbotMod.default;
    _DBotStore = storeMod.default;
    _globalObserver = obsMod.observer;
    _api_base = apiBaseMod.api_base;
  });
  return _dbotLoadPromise;
}

const BOT_TRADE_MAX_ATTEMPTS = 2;
const DERIV_TEMPORARY_PROCESSING_MESSAGE =
  "Sorry, an error occurred while processing your request.";

type Settlement = {
  entrySpot: number | null;
  exitSpot: number | null;
  payout: number;
  profit: number;
  status: "lost" | "open" | "won";
  transactionIdSell: string | null;
  entryTickTime: number | null;
  exitTickTime: number | null;
  barrierValue: string | null;
};

export interface BotRunnerContextValue {
  activeTab: string;
  collapsed: boolean;
  connecting: boolean;
  journal: BotMonitorJournalEntry[];
  memoryReady: boolean;
  serverMode: boolean;
  stats: BotMonitorStats;
  status: BotMonitorStatus;
  transactions: BotMonitorTransaction[];
  resetMonitor: () => void;
  setActiveTab: (v: string) => void;
  setCollapsed: (v: boolean) => void;
  stopBot: () => void;
  toggleRun: () => void;
}

const BotRunnerContext = createContext<BotRunnerContextValue | null>(null);

export function useBotRunner(): BotRunnerContextValue {
  const ctx = useContext(BotRunnerContext);
  if (!ctx) throw new Error("useBotRunner must be used within BotRunnerProvider");
  return ctx;
}

export function BotRunnerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { account, balance, currency, refreshBalances } = useDerivBalanceContext();

  const [status, setStatus] = useState<BotMonitorStatus>("stopped");
  const [stats, setStats] = useState<BotMonitorStats>(EMPTY_BOT_MONITOR_STATS);
  const [transactions, setTransactions] = useState<BotMonitorTransaction[]>([]);
  const [journal, setJournal] = useState<BotMonitorJournalEntry[]>(DEFAULT_BOT_MONITOR_JOURNAL);
  const [connecting, setConnecting] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [memoryReady, setMemoryReady] = useState(false);
  const [serverMode, setServerMode] = useState(false);

  // Persistent refs — survive React re-renders and TopShell remounts
  const footerBotRunningRef = useRef(false);
  const footerBotStatsRef = useRef(EMPTY_BOT_MONITOR_STATS);
  const statusRef = useRef<BotMonitorStatus>("stopped");

  // Tracks which run path is active: "dbot" = DBot engine, "footer" = XML loop, null = idle.
  // onBotStop fires when BotBuilder unmounts (navigation) — we must ignore it in "footer" mode.
  const botRunModeRef = useRef<"dbot" | "footer" | null>(null);

  // Always tracks the latest cumulative totals from the DBot engine's bot.info events.
  // Used as the pre-run baseline so the FIRST trade of each run is always captured.
  const lastDbotInfoRef = useRef({ wins: 0, losses: 0, profit: 0, stake: 0, payout: 0, runs: 0 });

  // DBot engine stats baseline: set to lastDbotInfoRef snapshot when run starts so all
  // subsequent bot.info deltas (including the very first trade) display correctly.
  const dBotBaselineRef = useRef<{
    wins: number; losses: number; profit: number; stake: number; payout: number; runs: number;
  } | null>(null);

  // Cleanup for real-time balance subscription (Deriv balance WS stream)
  const balanceSubCleanupRef = useRef<(() => void) | null>(null);

  // Stop signal: these refs let stopBot() unblock any pending async operation
  const pendingTickResolveRef = useRef<((data: { quote: number; epoch: number } | null) => void) | null>(null);
  const stopTickWsFnRef = useRef<(() => void) | null>(null);
  const settlementAbortRef = useRef<(() => void) | null>(null);

  // Server-side background execution refs
  const serverSessionIdRef = useRef<string | null>(null);
  const serverModeRef = useRef(false);
  // Snapshot of browser-run state for server handoff (updated every trade)
  const handoffProfitRef = useRef(0);
  const handoffStakeRef = useRef(0);
  const handoffRunsRef = useRef(0);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Live value refs so async closures always read current account/currency/balance
  const accountRef = useRef(account);
  const currencyRef = useRef(currency);
  const balanceRef = useRef(balance);
  const userRef = useRef(user);

  useEffect(() => { accountRef.current = account; }, [account]);
  useEffect(() => { currencyRef.current = currency; }, [currency]);
  useEffect(() => { balanceRef.current = balance; }, [balance]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { footerBotStatsRef.current = stats; }, [stats]);
  useEffect(() => { statusRef.current = status; }, [status]);

  // Load persisted snapshot on mount / user change
  useEffect(() => {
    const snapshot = readBotMonitorSnapshot(user?.id);
    if (!snapshot) {
      setStatus("stopped");
      setStats(EMPTY_BOT_MONITOR_STATS);
      setTransactions([]);
      setJournal(DEFAULT_BOT_MONITOR_JOURNAL);
      setMemoryReady(true);
      return;
    }
    // Never restore "running" status — if we're mounting, no loop is active
    setStatus(snapshot.status === "running" ? "stopped" : snapshot.status);
    setStats(snapshot.stats);
    setTransactions(snapshot.transactions);
    setJournal(snapshot.journal.length ? snapshot.journal : DEFAULT_BOT_MONITOR_JOURNAL);
    setMemoryReady(true);
  }, [user?.id]);

  // Persist snapshot after any state change
  useEffect(() => {
    if (!memoryReady) return;
    persistBotMonitorSnapshot(user?.id, {
      journal,
      stats,
      status,
      transactions,
      updatedAt: new Date().toISOString(),
    });
  }, [journal, memoryReady, stats, status, transactions, user?.id]);

  const addJournal = useCallback(
    (message: string, type: BotMonitorJournalEntry["type"] = "info") => {
      setJournal((prev) => [
        { id: crypto.randomUUID(), message, time: formatTime(), type },
        ...prev,
      ]);
    },
    [],
  );

  // ── Server session subscription ───────────────────────────────────────────
  const subscribeToServerSession = useCallback(
    (sessionId: string) => {
      if (realtimeChannelRef.current) {
        void supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
      const channel = supabase
        .channel(`bot-session-${sessionId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "active_bot_sessions",
            filter: `id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as {
              status: string;
              running_profit: number;
              completed_runs: number;
              stop_reason: string | null;
              error_message: string | null;
            };
            setStats((prev) => ({
              ...prev,
              totalProfitLoss: row.running_profit,
              runs: row.completed_runs,
            }));
            if (row.status === "stopped" || row.status === "error") {
              serverSessionIdRef.current = null;
              serverModeRef.current = false;
              setServerMode(false);
              setStatus("stopped");
              void supabase.removeChannel(channel);
              realtimeChannelRef.current = null;
              if (row.status === "error") {
                addJournal(`Background bot error: ${row.error_message ?? "Unknown"}`, "error");
                toast.error("Background bot encountered an error");
              } else {
                const reason = row.stop_reason;
                if (reason === "take_profit") {
                  addJournal(
                    `Take-profit reached by background bot. Total: +${row.running_profit.toFixed(2)}`,
                    "success",
                  );
                  toast.success(`Background bot: take-profit reached (+${row.running_profit.toFixed(2)})`);
                } else if (reason === "stop_loss") {
                  addJournal(
                    `Stop-loss reached by background bot. Total: ${row.running_profit.toFixed(2)}`,
                    "warning",
                  );
                  toast.warning(`Background bot: stop-loss reached (${row.running_profit.toFixed(2)})`);
                } else {
                  addJournal(
                    `Background bot completed — ${row.completed_runs} trades executed.`,
                    "success",
                  );
                }
              }
            }
          },
        )
        .subscribe();
      realtimeChannelRef.current = channel;
    },
    [addJournal],
  );

  // ── Check for active server sessions on mount (user returned after closing browser) ──
  useEffect(() => {
    if (!user?.id) return;
    const check = async () => {
      try {
        const { data } = await supabase
          .from("active_bot_sessions")
          .select("id, status, running_profit, completed_runs")
          .eq("user_id", user.id)
          .in("status", ["running", "pending"])
          .order("started_at", { ascending: false })
          .limit(1)
          .single();
        if (data && !serverSessionIdRef.current) {
          serverSessionIdRef.current = data.id;
          serverModeRef.current = true;
          setServerMode(true);
          setStatus("running");
          setStats((prev) => ({
            ...prev,
            totalProfitLoss: data.running_profit,
            runs: data.completed_runs,
          }));
          addJournal("Bot is running in the background on the server. Resuming live updates.", "info");
          subscribeToServerSession(data.id);
        }
      } catch {
        // No active server session — that's fine
      }
    };
    void check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── visibilitychange: hand off to server after 20s of inactivity ──────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Start a 20-second grace period before handing off to server
        if (footerBotRunningRef.current && !serverModeRef.current && serverSessionIdRef.current) {
          handoffTimerRef.current = setTimeout(() => {
            const sessionId = serverSessionIdRef.current;
            if (!sessionId || !footerBotRunningRef.current) return;
            // Stop client runner, hand off to server
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
            const anonKey =
              import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
              import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
            footerBotRunningRef.current = false;
            botRunModeRef.current = null;
            setStatus("running");
            serverModeRef.current = true;
            setServerMode(true);
            pendingTickResolveRef.current?.(null);
            pendingTickResolveRef.current = null;
            settlementAbortRef.current?.();
            settlementAbortRef.current = null;
            stopTickWsFnRef.current?.();
            stopTickWsFnRef.current = null;
            void supabase
              .from("active_bot_sessions")
              .update({
                status: "pending",
                running_profit: handoffProfitRef.current,
                current_stake: handoffStakeRef.current,
                completed_runs: handoffRunsRef.current,
              })
              .eq("id", sessionId);
            if (supabaseUrl && anonKey) {
              fetch(`${supabaseUrl}/functions/v1/run-bot`, {
                method: "POST",
                headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId }),
                keepalive: true,
              }).catch(() => {});
            }
            subscribeToServerSession(sessionId);
            addJournal("Tab went inactive — bot handed off to server. It will keep running in the background.", "info");
            toast.info("Bot is now running in the background on the server.");
          }, 20_000);
        }
      } else {
        // Tab visible again — cancel pending handoff
        if (handoffTimerRef.current) {
          clearTimeout(handoffTimerRef.current);
          handoffTimerRef.current = null;
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── beforeunload: fire sendBeacon so the server picks up immediately ──────
  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionId = serverSessionIdRef.current;
      if (!sessionId) return;
      try {
        navigator.sendBeacon("/api/bot-handoff", JSON.stringify({ sessionId }));
      } catch { /* ignore */ }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Register DBot engine observer events once at mount (client-side only)
  useEffect(() => {
    const onBotRunning = () => {
      setConnecting(false);
      setStatus("running");
      setCollapsed(false);
    };
    const onBotStop = () => {
      // Only stop the loop for DBot engine runs. When the user navigates away from
      // /bot-builder, BotBuilder.tsx calls dbot.terminateBot() on unmount, which
      // emits "bot.stop". If a footer-runner loop is active we must ignore this event.
      if (botRunModeRef.current !== "footer") {
        setStatus("stopped");
        footerBotRunningRef.current = false;
        botRunModeRef.current = null;
      }
    };

    const onBotInfo = (info: Record<string, unknown>) => {
      const hasFullStats =
        "totalWins" in info || "totalLosses" in info || "totalProfit" in info;

      if (hasFullStats) {
        // Always keep lastDbotInfoRef current so the next run can use it as baseline.
        lastDbotInfoRef.current = {
          wins: Number(info.totalWins ?? lastDbotInfoRef.current.wins),
          losses: Number(info.totalLosses ?? lastDbotInfoRef.current.losses),
          profit: Number(info.totalProfit ?? lastDbotInfoRef.current.profit),
          stake: Number(info.totalStake ?? lastDbotInfoRef.current.stake),
          payout: Number(info.totalPayout ?? lastDbotInfoRef.current.payout),
          runs: Number(info.totalRuns ?? lastDbotInfoRef.current.runs),
        };

        // Baseline is set at run-start to the values captured before the run began.
        // If somehow not set yet (race), initialise it to zeros so nothing is lost.
        const b = dBotBaselineRef.current ?? { wins: 0, losses: 0, profit: 0, stake: 0, payout: 0, runs: 0 };
        if (!dBotBaselineRef.current) dBotBaselineRef.current = b;

        const next: BotMonitorStats = {
          contractsWon: "totalWins" in info ? Math.max(0, Number(info.totalWins) - b.wins) : footerBotStatsRef.current.contractsWon,
          contractsLost: "totalLosses" in info ? Math.max(0, Number(info.totalLosses) - b.losses) : footerBotStatsRef.current.contractsLost,
          runs: "totalRuns" in info ? Math.max(0, Number(info.totalRuns) - b.runs) : footerBotStatsRef.current.runs,
          totalPayout: "totalPayout" in info ? Math.max(0, Number(info.totalPayout) - b.payout) : footerBotStatsRef.current.totalPayout,
          totalProfitLoss: "totalProfit" in info ? Number(info.totalProfit) - b.profit : footerBotStatsRef.current.totalProfitLoss,
          totalStake: "totalStake" in info ? Math.max(0, Number(info.totalStake) - b.stake) : footerBotStatsRef.current.totalStake,
        };
        setStats(next);
        footerBotStatsRef.current = next;
      } else if ("totalRuns" in info && dBotBaselineRef.current) {
        const runCount = Math.max(0, Number(info.totalRuns) - dBotBaselineRef.current.runs);
        setStats((prev) => ({ ...prev, runs: runCount }));
        footerBotStatsRef.current = { ...footerBotStatsRef.current, runs: runCount };
      }

      if ("balance" in info && info.balance != null) {
        const raw = String(info.balance).replace(/,/g, "").match(/([\d.]+)/);
        if (raw) {
          const parsed = parseFloat(raw[1]);
          if (Number.isFinite(parsed)) {
            window.dispatchEvent(
              new CustomEvent("deriv:dbot-balance", { detail: { balance: parsed } }),
            );
          }
        }
      }
    };

    const onBotContract = (data: Record<string, unknown>) => {
      const contractId = String(data.contract_id ?? "");
      if (!contractId) return;
      const isSold = Boolean(data.is_sold);
      const rawStatus = String(data.status ?? "").toLowerCase();
      const mappedStatus: BotMonitorTransaction["status"] =
        rawStatus === "won" ? "won" : rawStatus === "lost" ? "lost" : "open";

      setTransactions((items) => {
        const existing = items.find((t) => t.contractId === contractId);
        if (existing) {
          if (!isSold) return items;
          return items.map((t) =>
            t.contractId === contractId
              ? {
                  ...t,
                  status: mappedStatus !== "open" ? mappedStatus : t.status,
                  profit: Number(data.profit ?? t.profit),
                  payout: Number(data.sell_price ?? data.payout ?? t.payout),
                  exitSpot:
                    data.exit_tick != null
                      ? Number(data.exit_tick)
                      : data.exit_spot != null
                        ? Number(data.exit_spot)
                        : t.exitSpot,
                }
              : t,
          );
        }
        return [
          {
            contractId,
            entrySpot:
              data.entry_tick != null
                ? Number(data.entry_tick)
                : data.entry_spot != null
                  ? Number(data.entry_spot)
                  : null,
            exitSpot: isSold
              ? data.exit_tick != null
                ? Number(data.exit_tick)
                : data.exit_spot != null
                  ? Number(data.exit_spot)
                  : null
              : null,
            id: crypto.randomUUID(),
            payout: Number(isSold ? (data.sell_price ?? data.payout ?? 0) : (data.payout ?? 0)),
            profit: isSold ? Number(data.profit ?? 0) : 0,
            stake: Number(data.buy_price ?? 0),
            status: mappedStatus,
            time: formatTime(),
          },
          ...items,
        ];
      });
    };

    type ContractStatusPayload =
      | { id: string; data?: unknown; contract?: Record<string, unknown>; buy?: Record<string, unknown> }
      | string;
    const onContractStatus = (payload: ContractStatusPayload) => {
      if (typeof payload === "string") return;
      const { id, data, contract } = payload;
      if (id === "contract.purchase_sent") {
        addJournal(`Placing trade for ${Number(data ?? 0).toFixed(2)}...`);
      } else if (id === "contract.purchase_received") {
        addJournal(`Contract bought (tx: ${String(data ?? "")})`);
      } else if (id === "contract.sold" && contract) {
        const buyPrice = Number(contract.buy_price ?? 0);
        const sellPrice = Number(contract.sell_price ?? 0);
        const profit = sellPrice - buyPrice;
        const won = profit > 0;
        const cur = String(contract.currency ?? "");
        const profitLabel = `${profit >= 0 ? "+" : ""}${profit.toFixed(2)}${cur ? " " + cur : ""}`;
        const msg = `Contract settled: ${won ? "WON" : "LOST"} — Buy: ${buyPrice.toFixed(2)} | Sell: ${sellPrice.toFixed(2)} | P/L: ${profitLabel}`;
        addJournal(msg, won ? "success" : "error");
      }
    };

    const onLogSuccess = (data: { message?: string; log_type?: string; extra?: Record<string, unknown> } | string) => {
      let message: string;
      if (typeof data === "string") message = data;
      else if (data?.message) message = data.message;
      else if (data?.log_type) message = formatBotLogMessage(data.log_type, data.extra);
      else return;
      if (!message) return;
      addJournal(message, "success");
    };
    const onLogError = (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      if (message) addJournal(message, "error");
    };
    const onLogNotify = (data: { message?: string; type?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      if (!message) return;
      const rawType = typeof data === "object" ? (data?.type ?? "info") : "info";
      const type: BotMonitorJournalEntry["type"] =
        rawType === "error" ? "error" : rawType === "success" ? "success" : rawType === "warn" ? "warning" : "info";
      addJournal(message, type);
    };
    const onLogWarn = (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      if (message) addJournal(message, "warning");
    };
    const onBotClickStop = () => {
      footerBotRunningRef.current = false;
      setConnecting(false);
      setStatus("stopped");
      void _dbot?.terminateBot?.();
    };
    const onClientInvalidToken = () => {
      footerBotRunningRef.current = false;
      setConnecting(false);
      setStatus("stopped");
      addJournal("Deriv authorization failed. Please reconnect your account.", "error");
      void _dbot?.terminateBot?.();
    };

    let unregister: (() => void) | null = null;
    loadDbotModules().then(() => {
      const obs = _globalObserver!;
      obs.register("bot.running", onBotRunning);
      obs.register("bot.stop", onBotStop);
      obs.register("bot.info", onBotInfo);
      obs.register("bot.contract", onBotContract);
      obs.register("contract.status", onContractStatus);
      obs.register("ui.log.success", onLogSuccess);
      obs.register("ui.log.error", onLogError);
      obs.register("ui.log.notify", onLogNotify);
      obs.register("ui.log.warn", onLogWarn);
      obs.register("bot.click_stop", onBotClickStop);
      obs.register("client.invalid_token", onClientInvalidToken);
      unregister = () => {
        obs.unregister("bot.running", onBotRunning);
        obs.unregister("bot.stop", onBotStop);
        obs.unregister("bot.info", onBotInfo);
        obs.unregister("bot.contract", onBotContract);
        obs.unregister("contract.status", onContractStatus);
        obs.unregister("ui.log.success", onLogSuccess);
        obs.unregister("ui.log.error", onLogError);
        obs.unregister("ui.log.notify", onLogNotify);
        obs.unregister("ui.log.warn", onLogWarn);
        obs.unregister("bot.click_stop", onBotClickStop);
        obs.unregister("client.invalid_token", onClientInvalidToken);
      };
    });

    return () => unregister?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop (works from any page, unblocks any pending async op) ──────────────
  const stopBot = useCallback(() => {
    footerBotRunningRef.current = false;
    botRunModeRef.current = null;
    setConnecting(false);
    setStatus("stopped");
    // Stop real-time balance subscription
    balanceSubCleanupRef.current?.();
    balanceSubCleanupRef.current = null;
    // Unblock any awaited nextTick() immediately
    if (pendingTickResolveRef.current) {
      pendingTickResolveRef.current(null);
      pendingTickResolveRef.current = null;
    }
    // Abort any pending settlement wait immediately
    settlementAbortRef.current?.();
    settlementAbortRef.current = null;
    // Close the tick WebSocket
    stopTickWsFnRef.current?.();
    stopTickWsFnRef.current = null;
    void _dbot?.terminateBot?.();
    // Cancel pending server handoff timer
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
    // Clear browser heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    // Stop server session if running
    const sessionId = serverSessionIdRef.current;
    if (sessionId) {
      void supabase
        .from("active_bot_sessions")
        .update({ status: "stopped", stop_reason: "manual", stopped_at: new Date().toISOString() })
        .eq("id", sessionId);
      serverSessionIdRef.current = null;
    }
    if (serverModeRef.current) {
      serverModeRef.current = false;
      setServerMode(false);
    }
    if (realtimeChannelRef.current) {
      void supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  const resetMonitor = useCallback(() => {
    stopBot();
    setStats(EMPTY_BOT_MONITOR_STATS);
    setTransactions([]);
    setJournal(DEFAULT_BOT_MONITOR_JOURNAL);
    setActiveTab("summary");
    dBotBaselineRef.current = null;
    footerBotStatsRef.current = EMPTY_BOT_MONITOR_STATS;
  }, [stopBot]);

  // ── DBot engine run path → always delegates to footer runner ────────────────
  // The DBot engine (dbot.runBot) is tied to the BotBuilder page lifecycle and
  // uses an api_base WebSocket that can be stale at run time. Routing every run
  // through handleFooterBotRun gives us:
  //  • a persistent root-context loop that survives page navigation
  //  • a fresh, authenticated WebSocket via ensureDerivTradingConnection
  //  • unified execution for both built-in and uploaded XML bots
  async function handleDbotBotRun() {
    const currentAccount = accountRef.current;
    if (!currentAccount) {
      setCollapsed(false);
      setActiveTab("journal");
      addJournal("Run blocked: no Deriv account selected.", "error");
      toast.error("Connect and select a Deriv account before running the bot.");
      return;
    }

    // For legacy-token accounts, prime localStorage so BotBuilder workspace
    // display / block highlighting still resolves to the correct account.
    const activeToken = currentAccount.deriv_token ?? "";
    const activeLoginId = currentAccount.loginid ?? currentAccount.account_id ?? "";
    const isOAuthAccount = (currentAccount as { token_source?: string }).token_source === "oauth_access_token";
    if (!isOAuthAccount && activeToken) {
      try {
        localStorage.setItem("authToken", activeToken);
        localStorage.setItem("active_loginid", activeLoginId);
        localStorage.setItem("accountsList", JSON.stringify({ [activeLoginId]: activeToken }));
      } catch { /* ignore */ }
    }

    await handleFooterBotRun();
  }

  // ── Footer (XML-driven) run path ──────────────────────────────────────────
  async function handleFooterBotRun() {
    const workspace = getDerivWorkspace();
    if (workspace?.getAllBlocks?.()?.length) {
      const { persistWorkspaceSnapshot: persist } =
        await import("@/external/bot-builder/workspace-persistence");
      persist(userRef.current?.id, workspace);
    }

    let settings = resolveRunnableBotSettings(userRef.current?.id);
    const rawXml = readSavedWorkspaceXml(userRef.current?.id);
    if (rawXml) {
      try {
        const fresh = extractSettingsFromXmlText(rawXml, settings ?? undefined);
        if (fresh) settings = fresh;
      } catch { /* ignore */ }
    }
    if (!settings) {
      navigate({ to: "/bot-builder" });
      return;
    }

    const currentAccount = accountRef.current;
    if (!currentAccount) {
      toast.error("Connect and select a Deriv account before running the bot.");
      addJournal("Run blocked: no Deriv account selected.", "error");
      return;
    }

    setStats(EMPTY_BOT_MONITOR_STATS);
    setTransactions([]);
    setJournal(DEFAULT_BOT_MONITOR_JOURNAL);
    footerBotStatsRef.current = EMPTY_BOT_MONITOR_STATS;
    footerBotRunningRef.current = true;
    botRunModeRef.current = "footer";
    setStatus("running");
    setActiveTab("summary");
    setCollapsed(false);
    addJournal(
      `Bot run started on ${currentAccount.normalizedType === "demo" ? "DEMO" : "REAL"} account (${currentAccount.loginid || currentAccount.account_id}).`,
      "success",
    );

    // Create a server-side session so the bot can continue if this tab closes
    const userId = userRef.current?.id;
    handoffProfitRef.current = 0;
    handoffStakeRef.current = settings.stake;
    handoffRunsRef.current = 0;
    if (userId && currentAccount.account_id) {
      try {
        const { data: newSession } = await supabase
          .from("active_bot_sessions")
          .insert({
            user_id: userId,
            account_id: currentAccount.account_id,
            settings,
            status: "browser_running",
            current_stake: settings.stake,
          })
          .select("id")
          .single();
        if (newSession) {
          serverSessionIdRef.current = newSession.id;
          serverModeRef.current = false;
          // Heartbeat: keep last_heartbeat_at fresh so orphan-check knows browser is alive
          heartbeatIntervalRef.current = setInterval(() => {
            const sid = serverSessionIdRef.current;
            if (!sid || !footerBotRunningRef.current) return;
            void supabase
              .from("active_bot_sessions")
              .update({
                last_heartbeat_at: new Date().toISOString(),
                running_profit: handoffProfitRef.current,
                current_stake: handoffStakeRef.current,
                completed_runs: handoffRunsRef.current,
              })
              .eq("id", sid);
          }, 30_000);
        }
      } catch { /* session creation is best-effort */ }
    }

    const workspaceXml = readSavedWorkspaceXml(userRef.current?.id);
    let botState: BotVarState | null = workspaceXml ? initBotState(workspaceXml) : null;
    let currentStake = settings.stake;
    if (botState) {
      botState.totalProfit = 0;
      const xmlInitStake = getBotStakeVar(botState);
      if (xmlInitStake != null) currentStake = xmlInitStake;
    }

    const ohlcGranularity = workspaceXml ? getXmlOhlcGranularity(workspaceXml) : 60;

    // Tick stream state — defined here so tick WS can start before trading connection
    let latestTickCache: { quote: number; epoch: number } | null = null;
    let tickSubId: string | null = null;
    let ohlcSubId: string | null = null;
    let tickReconnectAttempts = 0;
    let pingIntervalId: ReturnType<typeof setInterval> | null = null;
    let currentTickWs: WebSocket | null = null;
    let botAnalysisPaused = false;
    let duringPurchaseCallback: (() => void) | null = null;

    const resolvePendingTick = (quote: number, epoch: number) => {
      const resolve = pendingTickResolveRef.current;
      if (resolve) {
        pendingTickResolveRef.current = null;
        resolve({ quote, epoch });
      } else {
        latestTickCache = { quote, epoch };
      }
    };

    const nextTick = (): Promise<{ quote: number; epoch: number } | null> =>
      new Promise((resolve) => {
        if (latestTickCache) {
          const data = latestTickCache;
          latestTickCache = null;
          resolve(data);
          return;
        }
        pendingTickResolveRef.current = resolve;
      });

    let stopTickWs: () => void = () => {};

    const openTickWs = () => {
      const ws = new WebSocket(`${DERIV_LEGACY_WEBSOCKET_URL}?app_id=${DERIV_LEGACY_APP_ID}`);
      currentTickWs = ws;
      tickSubId = null;
      ohlcSubId = null;

      ws.onopen = () => {
        tickReconnectAttempts = 0;
        ws.send(JSON.stringify({ ticks: settings!.symbol, subscribe: 1 }));
        ws.send(JSON.stringify({
          ticks_history: settings!.symbol,
          adjust_start_time: 1,
          count: 100,
          end: "latest",
          granularity: ohlcGranularity,
          style: "candles",
          subscribe: 1,
        }));
        // Keepalive ping every 25 seconds
        if (pingIntervalId) clearInterval(pingIntervalId);
        pingIntervalId = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ping: 1 }));
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const sub = msg.subscription as Record<string, unknown> | undefined;

          if (msg.msg_type === "candles" && Array.isArray(msg.candles)) {
            if (sub?.id && !ohlcSubId) ohlcSubId = String(sub.id);
            if (botState) {
              const candles: OhlcCandle[] = (msg.candles as Record<string, unknown>[]).map((c) => ({
                open: Number(c.open ?? 0), high: Number(c.high ?? 0),
                low: Number(c.low ?? 0), close: Number(c.close ?? 0), epoch: Number(c.epoch ?? 0),
              }));
              botState.ohlcHistory[ohlcGranularity] = candles;
            }
            return;
          }

          if (msg.msg_type === "ohlc" && msg.ohlc && typeof msg.ohlc === "object") {
            const o = msg.ohlc as Record<string, unknown>;
            if (sub?.id && !ohlcSubId) ohlcSubId = String(sub.id);
            const gran = Number(o.granularity ?? ohlcGranularity);
            if (botState) {
              const candle: OhlcCandle = {
                open: Number(o.open ?? 0), high: Number(o.high ?? 0),
                low: Number(o.low ?? 0), close: Number(o.close ?? 0), epoch: Number(o.epoch ?? 0),
              };
              const hist = botState.ohlcHistory[gran] ?? [];
              const last = hist[hist.length - 1];
              if (last && last.epoch === candle.epoch) hist[hist.length - 1] = candle;
              else { hist.push(candle); if (hist.length > 200) hist.splice(0, hist.length - 200); }
              botState.ohlcHistory[gran] = hist;
            }
            return;
          }

          if (sub?.id && !tickSubId) tickSubId = String(sub.id);
          if (msg.msg_type === "tick" && msg.tick && typeof msg.tick === "object") {
            const tick = msg.tick as Record<string, unknown>;
            const quote = Number(tick.quote ?? 0);
            const epoch = Number(tick.epoch ?? 0);
            const pipSize = Number(tick.pip_size ?? 0);
            const qStr = pipSize > 0 ? Number(Math.abs(quote)).toFixed(pipSize) : String(Math.abs(quote));
            const lastDigit = Number(qStr.slice(-1));
            if (botState) {
              botState.tickDigits = [...botState.tickDigits.slice(-49), lastDigit];
              botState.tickPrices = [...(botState.tickPrices ?? []).slice(-49), quote];
              botState.lastTickPrice = quote;
              if (workspaceXml && !botAnalysisPaused) runTickAnalysis(workspaceXml, botState);
              duringPurchaseCallback?.();
            }
            resolvePendingTick(quote, epoch);
          }
        } catch { /* ignore */ }
      };

      ws.onerror = () => {
        if (pingIntervalId) { clearInterval(pingIntervalId); pingIntervalId = null; }
        if (footerBotRunningRef.current) {
          addJournal("Network interruption detected on tick stream — checking connection...", "warning");
        }
      };

      ws.onclose = () => {
        if (pingIntervalId) { clearInterval(pingIntervalId); pingIntervalId = null; }
        if (!footerBotRunningRef.current) return; // bot stopped — don't reconnect
        // Auto-reconnect with exponential back-off (up to 10 attempts)
        if (tickReconnectAttempts < 10) {
          tickReconnectAttempts++;
          const delay = Math.min(500 * tickReconnectAttempts, 8000);
          const reconnectMsg = tickReconnectAttempts === 1
            ? `Weak network detected: tick stream dropped. Reconnecting in ${(delay / 1000).toFixed(1)}s... (attempt ${tickReconnectAttempts}/10)`
            : `Tick stream disconnected — reconnecting in ${(delay / 1000).toFixed(1)}s... (attempt ${tickReconnectAttempts}/10)`;
          addJournal(reconnectMsg, "warning");
          window.setTimeout(openTickWs, delay);
        } else {
          addJournal(
            "Tick stream could not be restored after 10 attempts. Please check your internet connection and restart the bot.",
            "error",
          );
          footerBotRunningRef.current = false;
          setStatus("stopped");
          if (pendingTickResolveRef.current) {
            pendingTickResolveRef.current(null);
            pendingTickResolveRef.current = null;
          }
        }
      };

      return ws;
    };

    stopTickWs = () => {
      footerBotRunningRef.current = false;
      if (pingIntervalId) { clearInterval(pingIntervalId); pingIntervalId = null; }
      try {
        if (currentTickWs?.readyState === WebSocket.OPEN) {
          if (tickSubId) currentTickWs.send(JSON.stringify({ forget: tickSubId }));
          if (ohlcSubId) currentTickWs.send(JSON.stringify({ forget: ohlcSubId }));
          currentTickWs.close();
        }
      } catch { /* ignore */ }
    };
    stopTickWsFnRef.current = stopTickWs;

    // Start tick WS immediately (before trading connection) to reduce first-tick latency.
    // The WS only needs settings.symbol which is already resolved.
    openTickWs();

    try {
      // Warn the user if connecting to Deriv takes unusually long (weak network signal).
      const connectionSlowTimer = window.setTimeout(() => {
        if (footerBotRunningRef.current) {
          addJournal(
            "Connecting to Deriv is taking longer than expected — your network may be slow or unstable.",
            "warning",
          );
        }
      }, 8000);
      const session = await ensureDerivTradingConnection(currentAccount, { context: "footer-bot-run" });
      window.clearTimeout(connectionSlowTimer);

      // Subscribe to the Deriv balance stream on the live trading WS so every
      // contract settlement pushes an accurate balance to the UI immediately.
      balanceSubCleanupRef.current?.();
      balanceSubCleanupRef.current = null;
      subscribeBalance(currentAccount.deriv_token, (b) => {
        window.dispatchEvent(new CustomEvent("deriv:dbot-balance", { detail: { balance: b.balance } }));
      }).then((cleanup) => {
        balanceSubCleanupRef.current = cleanup;
      }).catch(() => {});

      const sessionAccountUpper = String(session.account_id ?? "").trim().toUpperCase();
      const selectedAccountUpper = String(currentAccount.account_id ?? "").trim().toUpperCase();
      if (!sessionAccountUpper || sessionAccountUpper !== selectedAccountUpper) {
        stopTickWs();
        footerBotRunningRef.current = false;
        botRunModeRef.current = null;
        setStatus("stopped");
        const message = `Run aborted: trading session resolved to ${session.account_id} but the selected account is ${currentAccount.account_id}.`;
        addJournal(message, "error");
        toast.error("Bot run aborted because the trading account did not match the selected account.");
        return;
      }

      const runCurrency = currencyRef.current || currentAccount.currency || settings.currency;
      const context = {
        adapter: session.adapter,
        contractType: contractTypeLabel(settings),
        selectedAccountId: session.account_id,
        selectedAccountType: session.normalizedType,
      };
      let runningProfit = 0;
      const tpThreshold = Math.abs(Number(settings.takeProfit) || 0);
      const slThreshold = Math.abs(Number(settings.stopLoss) || 0);
      const runCap = Math.max(1, Math.round(Number(settings.maxRuns) || 10000));

      // Pre-flight proposal: start a proposal request in parallel with the first tick wait
      // so the proposal is ready (or nearly so) when the first tick arrives.
      let preflightProposal: Promise<Awaited<ReturnType<typeof requestProposal>> | null> | null = null;

      const launchPreflight = (stake: number, bState: BotVarState | null) => {
        if (!footerBotRunningRef.current) return;
        try {
          const input = proposalInput({ ...settings!, currency: runCurrency }, stake);
          const xmlPurchaseOverride = bState?.purchaseType ? purchaseTypeToSide(bState.purchaseType) : null;
          const botPrediction = workspaceXml && bState ? evalBotPrediction(workspaceXml, bState) : null;
          const baseOverride = xmlPurchaseOverride
            ? { ...input, tradeType: xmlPurchaseOverride.tradeType, side: xmlPurchaseOverride.side }
            : input;
          const finalInput: ProposalInput = {
            ...baseOverride,
            selectedDigit: botPrediction != null ? Math.max(0, Math.min(9, Math.round(botPrediction))) : baseOverride.selectedDigit,
          };
          const payload = buildStandardProposalPayload(finalInput, session.adapter as TradingAdapter);
          preflightProposal = requestProposal(payload, {
            ...context,
            contractType: String(payload.contract_type ?? context.contractType),
          }).catch(() => null);
        } catch { preflightProposal = null; }
      };

      // Launch preflight immediately (runs while tick stream establishes)
      launchPreflight(currentStake, botState);

      let completedRuns = 0;
      while (footerBotRunningRef.current && completedRuns < runCap) {
        const snapshot = { ...settings, currency: runCurrency };

        const tick = await nextTick();
        if (tick === null || !footerBotRunningRef.current) break;

        if (workspaceXml && botState) {
          botState.balance = Number(balanceRef.current ?? currentAccount.balance ?? 0);
          botState.totalRuns = completedRuns;
          // Run SUBMARKET signal check — only trade when the condition is met
          botState.submarketBreak = false;
          const submarketSignaled = runSubmarket(workspaceXml, botState);
          botState.notifyQueue = []; // suppress per-tick SUBMARKET notify messages (they fire every tick)
          if (!submarketSignaled) {
            // Keep a proposal warm so it's ready when the signal fires
            if (!preflightProposal) launchPreflight(currentStake, botState);
            continue;
          }
          runBeforePurchase(workspaceXml, botState);
          drainNotifyQueue(botState, addJournal);
          if (botState.hasConditionalPurchase && botState.purchaseType === null) {
            continue;
          }
        }

        const xmlBeforeStake = botState ? getBotStakeVar(botState) : null;
        const stake = clampNumber(xmlBeforeStake ?? currentStake, 0.35, snapshot.maxStake);
        const botPrediction = workspaceXml && botState ? evalBotPrediction(workspaceXml, botState) : null;
        const baseInput = proposalInput(snapshot, stake);
        const xmlPurchaseOverride = botState?.purchaseType ? purchaseTypeToSide(botState.purchaseType) : null;
        const input: ProposalInput = xmlPurchaseOverride
          ? {
              ...baseInput,
              tradeType: xmlPurchaseOverride.tradeType,
              side: xmlPurchaseOverride.side,
              selectedDigit: botPrediction != null ? Math.max(0, Math.min(9, Math.round(botPrediction))) : baseInput.selectedDigit,
            }
          : {
              ...baseInput,
              selectedDigit: botPrediction != null ? Math.max(0, Math.min(9, Math.round(botPrediction))) : baseInput.selectedDigit,
            };

        let settlement: Settlement | null = null;
        let capturedBuyPrice: number | null = null;
        let tradeError: unknown = null;
        botAnalysisPaused = true;

        for (let attempt = 1; attempt <= BOT_TRADE_MAX_ATTEMPTS; attempt += 1) {
          let contractWasBought = false;
          try {
            const payload = buildStandardProposalPayload(input, session.adapter as TradingAdapter);

            // Use pre-flighted proposal if available and still valid; otherwise request fresh
            let proposal: Awaited<ReturnType<typeof requestProposal>> | null = null;
            if (preflightProposal && attempt === 1) {
              proposal = await preflightProposal;
              preflightProposal = null;
            }
            if (!proposal) {
              addJournal(
                `Requesting proposal for ${contractTypeLabel(snapshot)} with ${stake.toFixed(2)} ${snapshot.currency}.`,
              );
              proposal = await requestProposal(payload, {
                ...context,
                contractType: String(payload.contract_type ?? context.contractType),
              });
            }

            const proposalId = String(proposal.proposal?.id ?? "");
            const askPrice = positiveNumberFrom(proposal.proposal?.ask_price, stake) ?? stake;
            const buy = await buyProposal(proposalId, askPrice, {
              ...context,
              contractType: String(payload.contract_type ?? context.contractType),
            });
            const contractId = String(buy.buy?.contract_id ?? "");
            capturedBuyPrice = Number(buy.buy?.buy_price ?? 0) || null;
            const contractType = String(payload.contract_type ?? context.contractType);
            const capturedTransactionId = String(buy.buy?.transaction_id ?? "") || null;
            contractWasBought = true;

            if (botState) {
              botState.transactionId = capturedTransactionId;
              botState.contractType = contractType;
              botState.isSellAtMarketAvailable = false;
              botState.currentSellPrice = 0;
            }

            let sellExecuted = false;
            const onContractUpdate = (contract: Record<string, unknown>) => {
              if (!botState) return;
              botState.isSellAtMarketAvailable = !contract.is_sold && Boolean(contract.is_valid_to_sell);
              const bid = Number(contract.bid_price ?? 0);
              const bought = capturedBuyPrice ?? 0;
              botState.currentSellPrice = Math.max(0, bid - bought);
            };
            duringPurchaseCallback = () => {
              if (!workspaceXml || !botState) return;
              runDuringPurchase(workspaceXml, botState);
              drainNotifyQueue(botState, addJournal);
              if (botState.sellAtMarketRequested && !sellExecuted) {
                sellExecuted = true;
                sellContract(contractId, botState.currentSellPrice).catch((err) => {
                  console.warn("[Bot] sell_at_market failed", err);
                });
              }
            };

            const record: BotMonitorTransaction = {
              contractId, entrySpot: null, exitSpot: null,
              id: crypto.randomUUID(), payout: 0, profit: 0, stake, status: "open", time: formatTime(),
            };
            // Show "open" trade immediately — don't wait for DB before displaying it
            setTransactions((items) => [record, ...items]);
            upsertTrackedTrade(userRef.current?.id, {
              contractId, contractType, currency: snapshot.currency, id: record.id,
              market: snapshot.symbol, openedAt: new Date().toISOString(), payout: 0,
              profitLoss: 0, source: "bot-footer", stake, status: "open",
            });

            // Fire the DB insert in parallel with trade execution — supabase latency
            // (~100-300 ms) is hidden behind the settlement wait (seconds).
            // Not awaited in the hot path — chained non-blocking after settlement.
            const dbInsertPromise: Promise<string | null> = userRef.current?.id
              ? supabase.from("trades").insert({
                  user_id: userRef.current.id, deriv_contract_id: contractId,
                  symbol: snapshot.symbol, trade_type: contractType,
                  stake, payout: Number(buy.buy?.payout ?? 0), status: "open",
                })
                .select("id").single()
                .then(({ data, error }) => (!error && data) ? String(data.id) : null)
                .catch(() => null)
              : Promise.resolve(null);

            addJournal(`Bought contract ${contractId}. Waiting for settlement.`, "success");
            settlement = await waitForSettlement(
              contractId,
              (abort) => { settlementAbortRef.current = abort; },
              onContractUpdate,
            );
            settlementAbortRef.current = null;

            if (!footerBotRunningRef.current) break;

            // The real-time balance subscription (subscribeBalance) pushes the
            // accurate balance from Deriv's WS stream immediately after settlement.
            // Keep an optimistic local update as an instant fallback in case the
            // WS balance event arrives slightly after this point.
            const estimatedBalance = (balanceRef.current ?? 0) + settlement.profit;
            window.dispatchEvent(new CustomEvent("deriv:dbot-balance", { detail: { balance: estimatedBalance } }));
            setTransactions((items) =>
              items.map((item) =>
                item.id === record.id
                  ? { ...item, entrySpot: settlement?.entrySpot ?? null, exitSpot: settlement?.exitSpot ?? null, payout: settlement?.payout ?? 0, profit: settlement?.profit ?? 0, status: settlement?.status ?? "open" }
                  : item,
              ),
            );
            updateTrackedTrade(userRef.current?.id, contractId, {
              closedAt: new Date().toISOString(), payout: settlement?.payout ?? 0,
              profitLoss: settlement?.profit ?? 0,
              status: settlement?.status === "won" ? "won" : settlement?.status === "lost" ? "lost" : "open",
            });
            // Non-blocking DB update — chain on the insert promise without awaiting
            if (userRef.current?.id) {
              const capturedSettlement = settlement;
              void dbInsertPromise.then((dbTradeId) => {
                if (!dbTradeId) return;
                return supabase.from("trades").update({
                  profit_loss: Number(capturedSettlement?.profit ?? 0),
                  payout: Number(capturedSettlement?.payout ?? 0),
                  status: capturedSettlement?.status === "won" ? "won" : capturedSettlement?.status === "lost" ? "lost" : "open",
                  closed_at: new Date().toISOString(),
                }).eq("id", dbTradeId).catch(() => {});
              }).catch(() => {});
            }
            duringPurchaseCallback = null;
            tradeError = null;
            break;
          } catch (error) {
            duringPurchaseCallback = null;
            tradeError = error;
            if (!contractWasBought && attempt < BOT_TRADE_MAX_ATTEMPTS && shouldRetryBotTrade(error)) {
              addJournal(
                isNetworkError(error)
                  ? "Trade request failed due to network instability. Retrying once..."
                  : "Deriv returned a temporary processing error. Retrying once.",
                "warning",
              );
              await sleep(50);
              continue;
            }
            break;
          }
        }

        // If the bot was stopped while awaiting settlement, skip all settlement processing.
        if (!footerBotRunningRef.current) continue;

        if (!settlement) {
          const message = getDerivTradingErrorMessage(tradeError);
          if (snapshot.restartBuySellOnError || snapshot.restartLastTradeOnError) {
            addJournal(`Skipped one bot run after Deriv rejected the trade: ${message}`, "warning");
            continue;
          }
          throw tradeError;
        }

        runningProfit += settlement.profit;
        completedRuns += 1;
        handoffProfitRef.current = runningProfit;
        handoffRunsRef.current = completedRuns;
        setStats((current) => ({
          contractsLost: current.contractsLost + (settlement!.status === "lost" ? 1 : 0),
          contractsWon: current.contractsWon + (settlement!.status === "won" ? 1 : 0),
          runs: current.runs + 1,
          totalPayout: current.totalPayout + settlement!.payout,
          totalProfitLoss: current.totalProfitLoss + settlement!.profit,
          totalStake: current.totalStake + stake,
        }));
        addJournal(
          `Contract settled ${settlement.status}. Run ${completedRuns}/${runCap}. P/L ${runningProfit.toFixed(2)} ${snapshot.currency}.`,
          settlement.status === "won" ? "success" : settlement.status === "lost" ? "warning" : "info",
        );
        // Balance refresh was already fired at settlement — no await here.

        if (tpThreshold > 0 && runningProfit >= tpThreshold) {
          addJournal(`Take-profit reached (+${runningProfit.toFixed(2)} ${snapshot.currency} ≥ ${tpThreshold.toFixed(2)}). Bot stopped.`, "success");
          break;
        }
        if (slThreshold > 0 && runningProfit <= -slThreshold) {
          addJournal(`Stop-loss reached (${runningProfit.toFixed(2)} ${snapshot.currency} ≤ -${slThreshold.toFixed(2)}). Bot stopped.`, "warning");
          break;
        }

        if (workspaceXml && botState) {
          botState.result = settlement.status === "won" ? "win" : "loss";
          botState.totalProfit = runningProfit;
          botState.lastProfit = settlement.profit;
          botState.entrySpot = settlement.entrySpot ?? null;
          botState.exitSpot = settlement.exitSpot ?? null;
          botState.buyPrice = capturedBuyPrice;
          botState.payout = settlement.payout ?? null;
          botState.entryTickTime = settlement.entryTickTime;
          botState.exitTickTime = settlement.exitTickTime;
          botState.barrierValue = settlement.barrierValue;
          botState.isSellAtMarketAvailable = false;
          botState.sellAtMarketRequested = false;
          botState.currentSellPrice = 0;
          runAfterPurchase(workspaceXml, botState);
          drainNotifyQueue(botState, addJournal);
          const xmlStake = getBotStakeVar(botState);
          currentStake = xmlStake != null
            ? clampNumber(xmlStake, 0.35, snapshot.maxStake)
            : settlement.status === "lost"
              ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
              : snapshot.stake;
        } else {
          currentStake = settlement.status === "lost"
            ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
            : snapshot.stake;
        }
        handoffStakeRef.current = currentStake;
        botAnalysisPaused = false;

        // Pre-flight the next proposal immediately so it's ready when the next tick arrives
        launchPreflight(currentStake, botState);
      }

      if (footerBotRunningRef.current && completedRuns >= runCap) {
        addJournal(`Reached the maximum number of runs (${runCap}).`, "info");
      }

      stopTickWs();
      stopTickWsFnRef.current = null;
      balanceSubCleanupRef.current?.();
      balanceSubCleanupRef.current = null;
      void refreshBalances("footer-bot-run-complete", currentAccount.account_id).catch(() => {});
      setStatus("stopped");
      footerBotRunningRef.current = false;
      botRunModeRef.current = null;
      addJournal("Bot run completed.", "success");
      // Mark server session as stopped (bot finished in-browser, no server handoff needed)
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      const sessionId = serverSessionIdRef.current;
      if (sessionId && !serverModeRef.current) {
        void supabase
          .from("active_bot_sessions")
          .update({
            status: "stopped",
            stop_reason: "manual",
            running_profit: runningProfit,
            current_stake: currentStake,
            completed_runs: completedRuns,
            stopped_at: new Date().toISOString(),
          })
          .eq("id", sessionId);
        serverSessionIdRef.current = null;
      }
    } catch (error) {
      stopTickWs();
      stopTickWsFnRef.current = null;
      balanceSubCleanupRef.current?.();
      balanceSubCleanupRef.current = null;
      const message = getDerivTradingErrorMessage(error);
      footerBotRunningRef.current = false;
      botRunModeRef.current = null;
      setStatus("stopped");
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      const errSessionId = serverSessionIdRef.current;
      if (errSessionId && !serverModeRef.current) {
        void supabase
          .from("active_bot_sessions")
          .update({ status: "stopped", stop_reason: "manual", stopped_at: new Date().toISOString() })
          .eq("id", errSessionId);
        serverSessionIdRef.current = null;
      }
      if (isNetworkError(error)) {
        addJournal(
          `Network error stopped the bot: ${message} — Please check your internet connection and try again.`,
          "error",
        );
      } else {
        addJournal(message, "error");
      }
      toast.error(message);
    }
  }

  // ── Unified toggle (Run/Stop) ─────────────────────────────────────────────
  const toggleRun = useCallback(() => {
    if (statusRef.current === "running") {
      stopBot();
      return;
    }
    const workspace = getDerivWorkspace();
    const hasBlocks = (workspace?.getAllBlocks?.()?.length ?? 0) > 0;
    if (hasBlocks) {
      void handleDbotBotRun();
    } else {
      setCollapsed(false);
      setActiveTab("journal");
      void handleFooterBotRun();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopBot]);

  const value = useMemo<BotRunnerContextValue>(
    () => ({
      activeTab,
      collapsed,
      connecting,
      journal,
      memoryReady,
      serverMode,
      stats,
      status,
      transactions,
      resetMonitor,
      setActiveTab,
      setCollapsed,
      stopBot,
      toggleRun,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeTab, collapsed, connecting, journal, memoryReady, serverMode, stats, status, transactions],
  );

  return <BotRunnerContext.Provider value={value}>{children}</BotRunnerContext.Provider>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tradeCategory(settings: BotBuilderSettings): TradeCategory {
  if (settings.tradeType === "digits") return settings.digitContract;
  return settings.tradeType;
}

function contractTypeLabel(settings: BotBuilderSettings) {
  const familyLabel =
    settings.tradeType === "digits"
      ? settings.digitContract === "even_odd"
        ? "Even/Odd"
        : settings.digitContract === "matches_differs"
          ? "Matches/Differs"
          : "Over/Under"
      : settings.tradeType === "higher_lower"
        ? "Higher/Lower"
        : settings.tradeType === "rise_fall"
          ? "Rise/Fall"
          : settings.tradeType === "touch_no_touch"
            ? "Touch/No Touch"
            : "Multiplier";
  const directionLabel =
    settings.purchaseDirection === "odd" ? "Odd" :
    settings.purchaseDirection === "even" ? "Even" :
    settings.purchaseDirection === "matches" ? "Matches" :
    settings.purchaseDirection === "differs" ? "Differs" :
    settings.purchaseDirection === "under" ? "Under" :
    settings.purchaseDirection === "over" ? "Over" :
    settings.purchaseDirection === "higher" ? "Higher" :
    settings.purchaseDirection === "lower" ? "Lower" :
    settings.purchaseDirection === "touch" ? "Touch" :
    settings.purchaseDirection === "no_touch" ? "No Touch" :
    settings.purchaseDirection === "up" ? "Rise" :
    settings.purchaseDirection === "down" ? "Fall" :
    settings.purchaseDirection;
  return `${familyLabel} / ${directionLabel}`;
}

function proposalInput(settings: BotBuilderSettings, stake: number): ProposalInput {
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

async function waitForSettlement(
  contractId: string,
  registerAbort: (abort: () => void) => void,
  onContractUpdate?: (contract: Record<string, unknown>) => void,
): Promise<Settlement> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => Promise<void>) | undefined;
    const emptySettlement: Settlement = {
      entrySpot: null, exitSpot: null, payout: 0, profit: 0, status: "open",
      transactionIdSell: null, entryTickTime: null, exitTickTime: null, barrierValue: null,
    };
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(emptySettlement);
      void unsubscribe?.();
    }, 45000);
    registerAbort(() => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      void unsubscribe?.();
      resolve(emptySettlement);
    });

    subscribeOpenContract(contractId, (contract) => {
      onContractUpdate?.(contract);
      const statusText = String(contract.status ?? "").toLowerCase();
      const isSold =
        contract.is_sold === 1 || contract.is_sold === true ||
        statusText === "won" || statusText === "lost" || statusText === "sold";
      if (!isSold || settled) return;
      settled = true;
      window.clearTimeout(timeout);
      const entrySpot = numberFrom(contract.entry_spot, contract.entry_tick, contract.entry_tick_display_value);
      const exitSpot = numberFrom(
        contract.exit_spot, contract.exit_tick, contract.exit_tick_display_value,
        contract.sell_spot, contract.current_spot, contract.current_tick, contract.current_spot_display_value,
      );
      const sell_price = Number(contract.sell_price ?? 0);
      const contract_buy_price = Number(contract.buy_price ?? 0);
      const potential_payout = Number(contract.payout ?? 0);
      const computedProfit = sell_price > 0 || contract_buy_price > 0 ? sell_price - contract_buy_price : null;
      const rawProfit = Number(contract.profit);
      const profit = computedProfit !== null ? computedProfit : Number.isFinite(rawProfit) ? rawProfit : 0;
      const won = statusText === "won" ? true : statusText === "lost" ? false : Number.isFinite(profit) && profit > 0;
      const payout = won ? (sell_price > 0 ? sell_price : potential_payout > 0 ? potential_payout : 0) : 0;
      const entryTickTime = Number(contract.entry_tick_time ?? 0) || null;
      const exitTickTime = Number(contract.exit_tick_time ?? 0) || null;
      const barrierValue = contract.barrier ? String(contract.barrier) : null;
      const transactionIdSell = contract.transaction_ids
        ? String((contract.transaction_ids as Record<string, unknown>).sell ?? "") || null : null;
      resolve({ entrySpot, exitSpot, payout, profit, status: won ? "won" : "lost", transactionIdSell, entryTickTime, exitTickTime, barrierValue });
      void unsubscribe?.();
    })
      .then((off) => { unsubscribe = off; })
      .catch((error) => { window.clearTimeout(timeout); reject(error); });
  });
}

function sleep(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)); }

function drainNotifyQueue(
  state: BotVarState,
  addJournal: (msg: string, type?: BotMonitorJournalEntry["type"]) => void,
) {
  while (state.notifyQueue.length > 0) {
    const item = state.notifyQueue.shift();
    if (!item) break;
    const jType: BotMonitorJournalEntry["type"] =
      item.type === "error" ? "error" : item.type === "success" ? "success" : item.type === "warn" ? "warning" : "info";
    addJournal(`[Bot] ${item.message}`, jType);
  }
}

function isNetworkError(error: unknown): boolean {
  const message = getDerivTradingErrorMessage(error).toLowerCase();
  const name = String((error as Error)?.name ?? "").toLowerCase();
  return (
    name === "networkerror" ||
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("websocket") ||
    message.includes("socket") ||
    message.includes("offline") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("connection refused") ||
    message.includes("connection reset") ||
    message.includes("econnrefused") ||
    message.includes("econnreset")
  );
}

function shouldRetryBotTrade(error: unknown) {
  const message = getDerivTradingErrorMessage(error).toLowerCase();
  const code = String((error as { code?: unknown })?.code ?? "").toLowerCase();
  return (
    message.includes(DERIV_TEMPORARY_PROCESSING_MESSAGE.toLowerCase()) ||
    message.includes("timed out") ||
    code.includes("internal") || code.includes("rate") || code.includes("timeout")
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
  const clamped = Math.min(max, Math.max(min, number));
  // Deriv rejects stakes with more than 2 decimal places
  return Math.round(clamped * 100) / 100;
}

function formatTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatBotLogMessage(logType: string, extra?: Record<string, unknown>): string {
  const currency = String(extra?.currency ?? "");
  const profit = Number(extra?.profit ?? 0);
  const sign = profit >= 0 ? "+" : "";
  const profitStr = `${sign}${Math.abs(profit).toFixed(2)}${currency ? " " + currency : ""}`;
  switch (logType) {
    case "purchase": return extra?.longcode ? `Purchased: ${extra.longcode}` : `Contract purchased (tx: ${extra?.transaction_id ?? ""})`;
    case "profit": return `Trade won: ${profitStr}`;
    case "lost": return `Trade lost: ${profitStr}`;
    case "sell": return `Contract sold at market for ${Number(extra?.sold_for ?? 0).toFixed(2)}${currency ? " " + currency : ""}`;
    case "not_offered": return "Sell at market not currently available";
    case "welcome": return "Bot started";
    case "welcome_back": return "Bot restarted after error";
    case "load_block": return "Bot blocks loaded";
    default: return logType;
  }
}
