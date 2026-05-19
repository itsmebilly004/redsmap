import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { AiAssistant } from "@/components/ai-assistant";
import {
  BotRunMonitorPanel,
  DEFAULT_BOT_MONITOR_JOURNAL,
  EMPTY_BOT_MONITOR_STATS,
  type BotMonitorJournalEntry,
  type BotMonitorStats,
  type BotMonitorStatus,
  type BotMonitorTransaction,
} from "@/components/bot-run-monitor";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { useTheme } from "@/hooks/use-theme";
import {
  persistBotMonitorSnapshot,
  readBotMonitorSnapshot,
  updateTrackedTrade,
  upsertTrackedTrade,
} from "@/lib/activity-memory";
import {
  ensureDerivTradingConnection,
  getDerivTradingErrorMessage,
  type TradeCategory,
  type TradingAdapter,
  buildLegacyOAuthUrl,
  buildOAuthUrl,
  disconnectAll,
  redirectToDerivLegacyOAuth,
  redirectToDerivOAuth,
  sanitizeDerivOAuthUrl,
} from "@/lib/deriv";
import { resolveRunnableBotSettings, type BotBuilderSettings } from "@/lib/bot-builder-state";
import { getDerivWorkspace } from "@/external/bot-builder/blockly-runtime";
import { readSavedWorkspaceXml } from "@/external/bot-builder/workspace-persistence";
import { buyProposal, requestProposal, sellContract, subscribeOpenContract } from "@/lib/deriv-trading-service";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import {
  initBotState,
  runAfterPurchase,
  runBeforePurchase,
  runDuringPurchase,
  runTickAnalysis,
  evalBotPrediction,
  getBotStakeVar,
  getXmlOhlcGranularity,
  purchaseTypeToSide,
  type BotVarState,
  type OhlcCandle,
} from "@/lib/bot-xml-runtime";
import { DERIV_LEGACY_WEBSOCKET_URL, DERIV_LEGACY_APP_ID } from "@/lib/deriv-config";
import dbot from "@/external/bot-skeleton/scratch/dbot";
import DBotStore from "@/external/bot-skeleton/scratch/dbot-store";
import { observer as globalObserver } from "@/external/bot-skeleton/utils/observer";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  LayoutGrid,
  Bot,
  LineChart as LineChartIcon,
  BarChart3,
  Cpu,
  Microscope,
  Target,
  Users,
  Plug,
  ChevronDown,
  LogOut,
  ChevronUp,
  RefreshCw,
  Moon,
  Sun,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type DerivAccount } from "@/hooks/use-deriv-balance";
import { numberFrom } from "@/lib/contract-state";
import { hasDerivAccountPrefix, isDemoAccount } from "@/lib/deriv-account";

const CURRENCY_META: Record<string, { country?: string; name: string; symbol?: string }> = {
  AUD: { country: "au", name: "Australian Dollar" },
  BTC: { name: "Bitcoin", symbol: "B" },
  ETH: { name: "Ethereum", symbol: "E" },
  EUR: { country: "eu", name: "Euro" },
  GBP: { country: "gb", name: "British Pound" },
  LTC: { name: "Litecoin", symbol: "L" },
  tUSDT: { name: "Tether TRC20", symbol: "T" },
  USDC: { name: "USD Coin", symbol: "$" },
  USDT: { name: "Tether", symbol: "T" },
  USD: { country: "us", name: "US Dollar" },
};

function currencyMeta(currency?: string | null) {
  return CURRENCY_META[currency ?? ""] ?? { name: currency || "Trading account" };
}

function formatBalance(value?: number | null, currency?: string | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency ? ` ${currency}` : ""}`;
}

function totalAssetsLabel(accounts: DerivAccount[]) {
  const totals = accounts.reduce<Record<string, number>>((acc, account) => {
    const currency = account.currency || "USD";
    acc[currency] = (acc[currency] ?? 0) + Number(account.balance ?? 0);
    return acc;
  }, {});
  const entries = Object.entries(totals);
  if (!entries.length) return "0.00 USD";
  return entries.map(([assetCurrency, amount]) => formatBalance(amount, assetCurrency)).join(" + ");
}

type TabDef = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
};

export const TOP_TABS: TabDef[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/bot-builder", label: "Bot Builder", icon: Bot },
  { to: "/", label: "Manual Traders", icon: LineChartIcon },
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/trading-bots", label: "Trading Bots", icon: Cpu },
  { to: "/analysis", label: "Analysis Tool", icon: Microscope },
  { to: "/strategies", label: "Strategies", icon: Target },
  { to: "/copy-trading", label: "Copy Trading", icon: Users },
];

const BOT_TRADE_MAX_ATTEMPTS = 2;
const DERIV_TEMPORARY_PROCESSING_MESSAGE =
  "Sorry, an error occurred while processing your request.";

type Settlement = {
  entrySpot: number | null;
  exitSpot: number | null;
  payout: number;
  profit: number;
  status: "lost" | "open" | "won";
  // Extra readDetails fields populated from the settled contract
  transactionIdSell: string | null;
  entryTickTime: number | null;
  exitTickTime: number | null;
  barrierValue: string | null;
};

export function TopShell({
  children,
  showAssistantButton = true,
  showBotMonitor = true,
}: {
  children: ReactNode;
  showAssistantButton?: boolean;
  showBotMonitor?: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, accounts, balance, currency, refreshing, refreshBalances, switchAccount } =
    useDerivBalanceContext();
  const { theme, toggleTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeAccountTab, setActiveAccountTab] = useState<"real" | "demo">("real");
  const [botMonitorCollapsed, setBotMonitorCollapsed] = useState(true);
  const [botMonitorTab, setBotMonitorTab] = useState("summary");
  const [botMonitorStatus, setBotMonitorStatus] = useState<BotMonitorStatus>("stopped");
  const [botRunConnecting, setBotRunConnecting] = useState(false);
  const [botMonitorStats, setBotMonitorStats] = useState<BotMonitorStats>(EMPTY_BOT_MONITOR_STATS);
  const [botMonitorTransactions, setBotMonitorTransactions] = useState<BotMonitorTransaction[]>([]);
  const [botMonitorJournal, setBotMonitorJournal] = useState<BotMonitorJournalEntry[]>(
    DEFAULT_BOT_MONITOR_JOURNAL,
  );
  const [botMonitorMemoryReady, setBotMonitorMemoryReady] = useState(false);
  const footerBotRunningRef = useRef(false);
  const footerBotStatsRef = useRef(EMPTY_BOT_MONITOR_STATS);

  const realAccounts = useMemo(
    () => accounts.filter((account) => account.normalizedType === "real"),
    [accounts],
  );
  const demoAccounts = useMemo(
    () => accounts.filter((account) => account.normalizedType === "demo"),
    [accounts],
  );
  const visibleAccounts = activeAccountTab === "real" ? realAccounts : demoAccounts;

  useEffect(() => {
    if (!account || dropdownOpen) return;
    if (account.normalizedType !== "real" && account.normalizedType !== "demo") return;
    setActiveAccountTab(account.normalizedType);
  }, [account, dropdownOpen]);

  useEffect(() => {
    footerBotStatsRef.current = botMonitorStats;
  }, [botMonitorStats]);

  useEffect(() => {
    const snapshot = readBotMonitorSnapshot(user?.id);
    if (!snapshot) {
      setBotMonitorStatus("stopped");
      setBotMonitorStats(EMPTY_BOT_MONITOR_STATS);
      setBotMonitorTransactions([]);
      setBotMonitorJournal(DEFAULT_BOT_MONITOR_JOURNAL);
      setBotMonitorMemoryReady(true);
      return;
    }
    setBotMonitorStatus(snapshot.status === "running" ? "stopped" : snapshot.status);
    setBotMonitorStats(snapshot.stats);
    setBotMonitorTransactions(snapshot.transactions);
    setBotMonitorJournal(snapshot.journal.length ? snapshot.journal : DEFAULT_BOT_MONITOR_JOURNAL);
    setBotMonitorMemoryReady(true);
  }, [user?.id]);

  useEffect(() => {
    if (!botMonitorMemoryReady) return;
    persistBotMonitorSnapshot(user?.id, {
      journal: botMonitorJournal,
      stats: botMonitorStats,
      status: botMonitorStatus,
      transactions: botMonitorTransactions,
      updatedAt: new Date().toISOString(),
    });
  }, [
    botMonitorJournal,
    botMonitorMemoryReady,
    botMonitorStats,
    botMonitorStatus,
    botMonitorTransactions,
    user?.id,
  ]);

  // Register DDBOt engine observer events and map them to BotRunMonitorPanel state.
  // These fire whenever dbot.runBot() is active and the interpreter emits events.
  useEffect(() => {
    const onBotRunning = () => {
      setBotRunConnecting(false);
      setBotMonitorStatus("running");
      setBotMonitorTab("summary");
      setBotMonitorCollapsed(false);
    };
    const onBotStop = () => {
      setBotMonitorStatus("stopped");
      footerBotRunningRef.current = false;
    };
    const onBotInfo = (info: Record<string, unknown>) => {
      setBotMonitorStats({
        contractsWon: Number(info.totalWins ?? 0),
        contractsLost: Number(info.totalLosses ?? 0),
        runs: Number(info.totalRuns ?? 0),
        totalPayout: Number(info.totalPayout ?? 0),
        totalProfitLoss: Number(info.totalProfit ?? 0),
        totalStake: Number(info.totalStake ?? 0),
      });
    };
    const onBotContract = (data: Record<string, unknown>) => {
      const contractId = String(data.contract_id ?? "");
      if (!contractId) return;
      const status = String(data.status ?? "open").toLowerCase();
      const mappedStatus: BotMonitorTransaction["status"] =
        status === "won" ? "won" : status === "lost" ? "lost" : "open";
      setBotMonitorTransactions((items) => {
        const existing = items.find((t) => t.contractId === contractId);
        if (existing) {
          return items.map((t) =>
            t.contractId === contractId
              ? {
                  ...t,
                  profit: Number(data.profit ?? t.profit),
                  payout: Number(data.payout ?? t.payout),
                  status: mappedStatus === "open" ? t.status : mappedStatus,
                }
              : t,
          );
        }
        return [
          {
            contractId,
            entrySpot: data.entry_spot ? Number(data.entry_spot) : null,
            exitSpot: data.exit_spot ? Number(data.exit_spot) : null,
            id: crypto.randomUUID(),
            payout: Number(data.payout ?? 0),
            profit: Number(data.profit ?? 0),
            stake: Number(data.buy_price ?? 0),
            status: mappedStatus,
            time: formatTime(),
          },
          ...items,
        ];
      });
    };
    const onLogSuccess = (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      setBotMonitorJournal((items) => [
        { id: crypto.randomUUID(), message, time: formatTime(), type: "success" },
        ...items,
      ]);
    };
    const onLogError = (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      setBotMonitorJournal((items) => [
        { id: crypto.randomUUID(), message, time: formatTime(), type: "error" },
        ...items,
      ]);
    };
    const onLogNotify = (data: { message?: string; type?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      const rawType = typeof data === "object" ? (data?.type ?? "info") : "info";
      const type: BotMonitorJournalEntry["type"] =
        rawType === "error" ? "error" :
        rawType === "success" ? "success" :
        rawType === "warn" ? "warning" :
        "info";
      setBotMonitorJournal((items) => [
        { id: crypto.randomUUID(), message, time: formatTime(), type },
        ...items,
      ]);
    };
    const onLogWarn = (data: { message?: string } | string) => {
      const message = typeof data === "string" ? data : (data?.message ?? "");
      setBotMonitorJournal((items) => [
        { id: crypto.randomUUID(), message, time: formatTime(), type: "warning" },
        ...items,
      ]);
    };
    const onBotClickStop = () => {
      footerBotRunningRef.current = false;
      setBotRunConnecting(false);
      setBotMonitorStatus("stopped");
      void dbot.terminateBot?.();
    };
    const onClientInvalidToken = () => {
      footerBotRunningRef.current = false;
      setBotRunConnecting(false);
      setBotMonitorStatus("stopped");
      addFooterBotJournal("Deriv authorization failed. Please reconnect your account.", "error");
      void dbot.terminateBot?.();
    };

    globalObserver.register("bot.running", onBotRunning);
    globalObserver.register("bot.stop", onBotStop);
    globalObserver.register("bot.info", onBotInfo);
    globalObserver.register("bot.contract", onBotContract);
    globalObserver.register("ui.log.success", onLogSuccess);
    globalObserver.register("ui.log.error", onLogError);
    globalObserver.register("ui.log.notify", onLogNotify);
    globalObserver.register("ui.log.warn", onLogWarn);
    globalObserver.register("bot.click_stop", onBotClickStop);
    globalObserver.register("client.invalid_token", onClientInvalidToken);

    return () => {
      globalObserver.unregister("bot.running", onBotRunning);
      globalObserver.unregister("bot.stop", onBotStop);
      globalObserver.unregister("bot.info", onBotInfo);
      globalObserver.unregister("bot.contract", onBotContract);
      globalObserver.unregister("ui.log.success", onLogSuccess);
      globalObserver.unregister("ui.log.error", onLogError);
      globalObserver.unregister("ui.log.notify", onLogNotify);
      globalObserver.unregister("ui.log.warn", onLogWarn);
      globalObserver.unregister("bot.click_stop", onBotClickStop);
      globalObserver.unregister("client.invalid_token", onClientInvalidToken);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.info(
      "[Deriv Accounts] dropdown normalized account placement",
      accounts.map((item) => ({
        raw_account_id: item.account_id,
        raw_loginid: item.loginid,
        detected_prefix: item.detected_prefix,
        normalizedType: item.normalizedType,
        final_tab_placement: item.final_tab_placement,
      })),
    );
    console.info("[Deriv Accounts] dropdown realAccounts", realAccounts);
    console.info("[Deriv Accounts] dropdown demoAccounts", demoAccounts);
    console.info("[Deriv Accounts] dropdown selectedAccount", account);
    console.assert(
      realAccounts.every((item) => item.normalizedType === "real"),
      "[Deriv Accounts] Real tab contains a non-real account",
      realAccounts,
    );
    console.assert(
      demoAccounts.every((item) => item.normalizedType === "demo"),
      "[Deriv Accounts] Demo tab contains a non-demo account",
      demoAccounts,
    );
    console.assert(
      realAccounts.every((item) => !hasDerivAccountPrefix(item, "DOT")),
      "[Deriv Accounts] Real tab contains a DOT demo account",
      realAccounts,
    );
    console.assert(
      demoAccounts.every((item) => !hasDerivAccountPrefix(item, "ROT")),
      "[Deriv Accounts] Demo tab contains a ROT real account",
      demoAccounts,
    );
    const unknownAccounts = accounts.filter((item) => item.normalizedType === "unknown");
    if (unknownAccounts.length) {
      console.warn(
        "[Deriv Accounts] unknown accounts not rendered in account tabs",
        unknownAccounts,
      );
    }
  }, [account, accounts, demoAccounts, realAccounts]);

  async function handleLogout() {
    if (user) {
      await supabase.from("sessions").update({ is_active: false }).eq("user_id", user.id);
    }
    disconnectAll();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" } });
  }

  async function handleConnectDeriv() {
    try {
      const url = await buildOAuthUrl({ returnTo: "/dashboard/settings" });
      console.log("Deriv OAuth URL:", sanitizeDerivOAuthUrl(url));
      redirectToDerivOAuth(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start Deriv OAuth.";
      console.error("[Deriv OAuth] Shell connect failed", error);
      toast.error(message);
    }
  }

  function handleConnectLegacyDeriv() {
    try {
      const url = buildLegacyOAuthUrl({ returnTo: "/dashboard/settings" });
      console.log("Deriv Legacy OAuth URL:", url);
      redirectToDerivLegacyOAuth(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start Deriv legacy OAuth.";
      console.error("[Deriv Legacy OAuth] Shell connect failed", error);
      toast.error(message);
    }
  }

  async function handleRefreshBalances() {
    try {
      await refreshBalances("manual-dropdown");
      toast.success("Deriv balances refreshed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh Deriv balances.";
      console.error("[Deriv Balance] manual refresh failed", error);
      toast.error(message);
    }
  }

  function handleDeposit() {
    window.open("https://app.deriv.com/cashier/deposit", "_blank", "noopener,noreferrer");
  }

  function addFooterBotJournal(message: string, type: BotMonitorJournalEntry["type"] = "info") {
    setBotMonitorJournal((current) => [
      { id: crypto.randomUUID(), message, time: formatTime(), type },
      ...current,
    ]);
  }

  async function handleDbotBotRun() {
    if (botMonitorStatus === "running") {
      footerBotRunningRef.current = false;
      setBotRunConnecting(false);
      await dbot.terminateBot?.();
      return;
    }

    if (!account) {
      setBotMonitorCollapsed(false);
      setBotMonitorTab("journal");
      addFooterBotJournal("Run blocked: no Deriv account selected.", "error");
      toast.error("Connect and select a Deriv account before running the bot.");
      return;
    }

    const accountIsReal = account.normalizedType === "real" || account.is_demo === false;
    if (accountIsReal) {
      const SESSION_WARNED_KEY = "arktrader:bot:real-account-session-warned";
      const alreadyWarned = (() => {
        try { return sessionStorage.getItem(SESSION_WARNED_KEY) === "1"; } catch { return false; }
      })();
      if (!alreadyWarned) {
        const accountLabel = account.loginid || account.account_id;
        const confirmed = window.confirm(
          `You are about to run a bot on a REAL Deriv account (${accountLabel}). This will use real funds. Continue?`,
        );
        if (!confirmed) {
          addFooterBotJournal("Run cancelled — confirmation declined on real account.", "warning");
          toast.info("Bot run cancelled.");
          return;
        }
        try { sessionStorage.setItem(SESSION_WARNED_KEY, "1"); } catch { /* noop */ }
      }
    }

    // Bridge token into the localStorage keys that api_base reads via V2GetActiveToken().
    const activeToken = account.deriv_token ?? "";
    const activeLoginId = account.loginid ?? account.account_id ?? "";
    const isOAuthAccount =
      (account as { token_source?: string }).token_source === "oauth_access_token";

    if (isOAuthAccount) {
      // DerivAPIBasic speaks the Deriv WS v3 protocol and requires a legacy Deriv API token.
      // OAuth2 JWTs only work with the Deriv v2 REST/WS API — completely different protocol.
      // Redirect through the legacy OAuth flow (/redirect callback) which issues real API
      // tokens. After returning, token_source becomes "deriv_legacy_token" and the user
      // clicks Run again — the else-if branch below handles it correctly.
      toast.info(
        "The bot engine requires a Deriv API token. Redirecting to Deriv for authorization...",
        { duration: 4000 },
      );
      const returnTo = window.location.pathname + window.location.search;
      redirectToDerivLegacyOAuth(buildLegacyOAuthUrl({ returnTo }));
      return;
    } else if (activeToken) {
      // Legacy Deriv API token — authorize directly via WebSocket.
      try {
        localStorage.setItem("authToken", activeToken);
        localStorage.setItem("active_loginid", activeLoginId);
        localStorage.setItem("accountsList", JSON.stringify({ [activeLoginId]: activeToken }));
      } catch {
        // ignore storage errors
      }
    }

    // Refresh the DBotStore client so trade_definition.js sees is_logged_in=true.
    // DBotStore.setInstance() is called once at workspace init time — if auth
    // hadn't resolved yet then, client.is_logged_in is frozen as false.
    const dbotStoreInstance = DBotStore.instance;
    if (dbotStoreInstance) {
      dbotStoreInstance.client = {
        loginid: activeLoginId,
        currency: currency ?? account.currency ?? "USD",
        balance: parseFloat(String(balance ?? account.balance ?? 0)),
        landing_company_shortcode: "svg",
        is_logged_in: true,
        getToken: (_loginid?: string) => activeToken,
      };
    }

    setBotMonitorStats(EMPTY_BOT_MONITOR_STATS);
    setBotMonitorTransactions([]);
    setBotMonitorJournal(DEFAULT_BOT_MONITOR_JOURNAL);
    footerBotStatsRef.current = EMPTY_BOT_MONITOR_STATS;
    footerBotRunningRef.current = true;

    setBotMonitorStatus("running");
    setBotMonitorCollapsed(false);
    setBotMonitorTab("summary");

    try {
      await dbot.runBot?.();
    } catch (error) {
      const message = getDerivTradingErrorMessage(error);
      footerBotRunningRef.current = false;
      setBotMonitorStatus("stopped");
      addFooterBotJournal(message, "error");
      toast.error(message);
    }
  }

  function resetFooterBotMonitor() {
    footerBotRunningRef.current = false;
    setBotMonitorStatus("stopped");
    setBotMonitorStats(EMPTY_BOT_MONITOR_STATS);
    setBotMonitorTransactions([]);
    setBotMonitorJournal(DEFAULT_BOT_MONITOR_JOURNAL);
    setBotMonitorTab("summary");
  }

  async function handleFooterBotRun() {
    if (botMonitorStatus === "running") {
      footerBotRunningRef.current = false;
      setBotRunConnecting(false);
      await dbot.terminateBot?.();
      return;
    }

    const workspace = getDerivWorkspace();
    if (workspace?.getAllBlocks?.()?.length) {
      const { persistWorkspaceSnapshot } =
        await import("@/external/bot-builder/workspace-persistence");
      persistWorkspaceSnapshot(user?.id, workspace);
    }

    const settings = resolveRunnableBotSettings(user?.id);
    if (!settings) {
      navigate({ to: "/bot-builder" });
      return;
    }

    if (!account) {
      toast.error("Connect and select a Deriv account before running the bot.");
      addFooterBotJournal("Run blocked: no Deriv account selected.", "error");
      return;
    }

    // Safety guard: confirm before placing real-money trades — only once per browser session.
    const accountIsReal = account.normalizedType === "real" || account.is_demo === false;
    if (accountIsReal) {
      const SESSION_WARNED_KEY = "arktrader:bot:real-account-session-warned";
      const alreadyWarned = (() => {
        try { return sessionStorage.getItem(SESSION_WARNED_KEY) === "1"; } catch { return false; }
      })();
      if (!alreadyWarned) {
        const accountLabel = account.loginid || account.account_id;
        const confirmed = window.confirm(
          `You are about to run a bot on a REAL Deriv account (${accountLabel}). This will use real funds. Continue?`,
        );
        if (!confirmed) {
          addFooterBotJournal("Run cancelled — confirmation declined on real account.", "warning");
          toast.info("Bot run cancelled.");
          return;
        }
        try { sessionStorage.setItem(SESSION_WARNED_KEY, "1"); } catch { /* noop */ }
      }
    }

    // Reset the running totals for this new run so the Summary card shows the
    // profit/loss from THIS run only — not a stale accumulation from previous
    // sessions. The journal/transactions get the run-start marker fresh too.
    setBotMonitorStats(EMPTY_BOT_MONITOR_STATS);
    setBotMonitorTransactions([]);
    setBotMonitorJournal(DEFAULT_BOT_MONITOR_JOURNAL);
    footerBotStatsRef.current = EMPTY_BOT_MONITOR_STATS;

    footerBotRunningRef.current = true;
    setBotMonitorStatus("running");
    setBotMonitorTab("summary");
    setBotMonitorCollapsed(false);
    addFooterBotJournal(
      `Bot run started on ${account.normalizedType === "demo" ? "DEMO" : "REAL"} account (${account.loginid || account.account_id}).`,
      "success",
    );

    let stopTickWs: () => void = () => {};
    try {
      const session = await ensureDerivTradingConnection(account, { context: "footer-bot-run" });
      const sessionAccountUpper = String(session.account_id ?? "")
        .trim()
        .toUpperCase();
      const selectedAccountUpper = String(account.account_id ?? "")
        .trim()
        .toUpperCase();
      if (!sessionAccountUpper || sessionAccountUpper !== selectedAccountUpper) {
        footerBotRunningRef.current = false;
        setBotMonitorStatus("stopped");
        const message = `Run aborted: trading session resolved to ${session.account_id} but the selected account is ${account.account_id}. Switch accounts deliberately from the header and try again.`;
        addFooterBotJournal(message, "error");
        toast.error(
          "Bot run aborted because the trading account did not match the selected account.",
        );
        return;
      }
      const runCurrency = currency || account.currency || settings.currency;
      const context = {
        adapter: session.adapter,
        contractType: contractTypeLabel(settings),
        selectedAccountId: session.account_id,
        selectedAccountType: session.normalizedType,
      };
      let currentStake = settings.stake;
      let runningProfit = 0; // this-run-only tally; matches the reset stats above
      const tpThreshold = Math.abs(Number(settings.takeProfit) || 0);
      const slThreshold = Math.abs(Number(settings.stopLoss) || 0);
      const runCap = Math.max(1, Math.round(Number(settings.maxRuns) || 10000));

      // Read the deployed bot XML once and initialise the block interpreter.
      // This drives stake updates, prediction digit, and contract type per-trade
      // based on the actual XML logic rather than the static settings snapshot.
      const workspaceXml = readSavedWorkspaceXml(user?.id);
      let botState: BotVarState | null = workspaceXml ? initBotState(workspaceXml) : null;
      if (botState) {
        botState.totalProfit = 0;
        const xmlInitStake = getBotStakeVar(botState);
        if (xmlInitStake != null) currentStake = xmlInitStake;
      }

      // Paused while a trade is in-flight so tick_analysis blocks don't mutate
      // bot state during async proposal/buy/settlement, which would advance
      // internal counters beyond where they should be at after_purchase time.
      let botAnalysisPaused = false;

      // Called on every tick while a contract is open — runs during_purchase blocks.
      // Set before waitForSettlement, cleared immediately after it resolves.
      let duringPurchaseCallback: (() => void) | null = null;

      // OHLC candle granularity derived from the XML (e.g. 60 = 1-minute candles)
      const ohlcGranularity = workspaceXml ? getXmlOhlcGranularity(workspaceXml) : 60;
      let ohlcSubId: string | null = null;

      // Tick-driven loop: subscribe to the symbol's public tick stream and
      // drive each trade cycle from a real market tick instead of a timer.
      // Uses the legacy public WebSocket (wss://ws.derivws.com) which supports
      // unauthenticated tick subscriptions — the trading WS does not.
      let pendingTickResolve: ((data: { quote: number; epoch: number }) => void) | null = null;
      let tickSubId: string | null = null;
      const tickWs = new WebSocket(
        `${DERIV_LEGACY_WEBSOCKET_URL}?app_id=${DERIV_LEGACY_APP_ID}`,
      );
      const nextTick = (): Promise<{ quote: number; epoch: number }> =>
        new Promise((resolve) => {
          pendingTickResolve = resolve;
        });
      const resolvePendingTick = (quote: number, epoch: number) => {
        if (pendingTickResolve) {
          const resolve = pendingTickResolve;
          pendingTickResolve = null;
          resolve({ quote, epoch });
        }
      };
      tickWs.onopen = () => {
        tickWs.send(JSON.stringify({ ticks: settings.symbol, subscribe: 1 }));
        // Subscribe to OHLC candle stream alongside the tick stream
        tickWs.send(JSON.stringify({
          ticks_history: settings.symbol,
          adjust_start_time: 1,
          count: 100,
          end: "latest",
          granularity: ohlcGranularity,
          style: "candles",
          subscribe: 1,
        }));
      };
      tickWs.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as Record<string, unknown>;
          const sub = msg.subscription as Record<string, unknown> | undefined;

          // Initial candle history batch
          if (msg.msg_type === "candles" && Array.isArray(msg.candles)) {
            if (sub?.id && !ohlcSubId) ohlcSubId = String(sub.id);
            if (botState) {
              const candles: OhlcCandle[] = (msg.candles as Record<string, unknown>[]).map((c) => ({
                open: Number(c.open ?? 0),
                high: Number(c.high ?? 0),
                low: Number(c.low ?? 0),
                close: Number(c.close ?? 0),
                epoch: Number(c.epoch ?? 0),
              }));
              botState.ohlcHistory[ohlcGranularity] = candles;
            }
            return;
          }

          // Incremental candle update
          if (msg.msg_type === "ohlc" && msg.ohlc && typeof msg.ohlc === "object") {
            const o = msg.ohlc as Record<string, unknown>;
            if (sub?.id && !ohlcSubId) ohlcSubId = String(sub.id);
            const gran = Number(o.granularity ?? ohlcGranularity);
            if (botState) {
              const candle: OhlcCandle = {
                open: Number(o.open ?? 0),
                high: Number(o.high ?? 0),
                low: Number(o.low ?? 0),
                close: Number(o.close ?? 0),
                epoch: Number(o.epoch ?? 0),
              };
              const hist = botState.ohlcHistory[gran] ?? [];
              const last = hist[hist.length - 1];
              if (last && last.epoch === candle.epoch) {
                hist[hist.length - 1] = candle;
              } else {
                hist.push(candle);
                if (hist.length > 200) hist.splice(0, hist.length - 200);
              }
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
              // Run during_purchase blocks on each tick while a contract is live
              duringPurchaseCallback?.();
            }
            console.log("[TICK]", { symbol: String(tick.symbol ?? settings.symbol), quote, epoch });
            resolvePendingTick(quote, epoch);
          }
        } catch {
          // ignore malformed messages
        }
      };
      tickWs.onerror = () => resolvePendingTick(0, 0);
      tickWs.onclose = () => resolvePendingTick(0, 0);
      stopTickWs = () => {
        try {
          if (tickWs.readyState === WebSocket.OPEN) {
            if (tickSubId) tickWs.send(JSON.stringify({ forget: tickSubId }));
            if (ohlcSubId) tickWs.send(JSON.stringify({ forget: ohlcSubId }));
          }
          tickWs.close();
        } catch {
          // ignore cleanup errors
        }
      };

      // Run loop is primarily bounded by take-profit / stop-loss thresholds —
      // maxRuns is a safety cap so a misconfigured bot can't trade forever.
      // Each contract that actually settles increments completedRuns; trades
      // that error out don't count.
      let completedRuns = 0;
      while (footerBotRunningRef.current && completedRuns < runCap) {
        const snapshot = { ...settings, currency: runCurrency };
        await nextTick();
        if (!footerBotRunningRef.current) break;
        if (workspaceXml && botState) {
          // Inject live values before_purchase runs so blocks read accurate data
          botState.balance = Number(balance ?? account.balance ?? 0);
          botState.totalRuns = completedRuns;
          runBeforePurchase(workspaceXml, botState);
          drainNotifyQueue(botState, addFooterBotJournal);
          // If before_purchase contains purchase blocks (conditional entry logic)
          // but didn't set one this tick, the entry condition wasn't met.
          // Skip this trade and wait for the next tick — tick analysis keeps running.
          if (botState.hasConditionalPurchase && botState.purchaseType === null) {
            continue;
          }
        }
        // Read stake AFTER before_purchase has run — in DDBOt, before_purchase
        // sets the stake for the current trade, not the next one.
        const xmlBeforeStake = botState ? getBotStakeVar(botState) : null;
        const stake = clampNumber(xmlBeforeStake ?? currentStake, 0.35, snapshot.maxStake);
        const botPrediction =
          workspaceXml && botState ? evalBotPrediction(workspaceXml, botState) : null;
        const baseInput = proposalInput(snapshot, stake);
        const xmlPurchaseOverride =
          botState?.purchaseType ? purchaseTypeToSide(botState.purchaseType) : null;
        const input: ProposalInput = xmlPurchaseOverride
          ? {
              ...baseInput,
              tradeType: xmlPurchaseOverride.tradeType,
              side: xmlPurchaseOverride.side,
              selectedDigit:
                botPrediction != null
                  ? Math.max(0, Math.min(9, Math.round(botPrediction)))
                  : baseInput.selectedDigit,
            }
          : {
              ...baseInput,
              selectedDigit:
                botPrediction != null
                  ? Math.max(0, Math.min(9, Math.round(botPrediction)))
                  : baseInput.selectedDigit,
            };
        let settlement: Settlement | null = null;
        let capturedBuyPrice: number | null = null;
        let tradeError: unknown = null;
        botAnalysisPaused = true;
        for (let attempt = 1; attempt <= BOT_TRADE_MAX_ATTEMPTS; attempt += 1) {
          let contractWasBought = false;
          try {
            const payload = buildStandardProposalPayload(input, session.adapter as TradingAdapter);
            console.log("[PROPOSAL]", JSON.stringify(payload));
            addFooterBotJournal(
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
            capturedBuyPrice = Number(buy.buy?.buy_price ?? 0) || null;
            const contractType = String(payload.contract_type ?? context.contractType);
            const capturedTransactionId = String(buy.buy?.transaction_id ?? "") || null;
            contractWasBought = true;

            // Populate readDetails fields available immediately after buy
            if (botState) {
              botState.transactionId = capturedTransactionId;
              botState.contractType = contractType;
              botState.isSellAtMarketAvailable = false;
              botState.currentSellPrice = 0;
            }

            // Wire up during_purchase execution on each tick while contract is live.
            // Also updates isSellAtMarketAvailable / currentSellPrice from contract messages.
            let sellExecuted = false;
            const onContractUpdate = (contract: Record<string, unknown>) => {
              if (!botState) return;
              botState.isSellAtMarketAvailable =
                !contract.is_sold && Boolean(contract.is_valid_to_sell);
              const bid = Number(contract.bid_price ?? 0);
              const bought = capturedBuyPrice ?? 0;
              botState.currentSellPrice = Math.max(0, bid - bought);
            };
            duringPurchaseCallback = () => {
              if (!workspaceXml || !botState) return;
              runDuringPurchase(workspaceXml, botState);
              drainNotifyQueue(botState, addFooterBotJournal);
              if (botState.sellAtMarketRequested && !sellExecuted) {
                sellExecuted = true;
                const sellPrice = botState.currentSellPrice;
                sellContract(contractId, sellPrice).catch((err) => {
                  console.warn("[Bot] sell_at_market failed", err);
                });
              }
            };

            const record: BotMonitorTransaction = {
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
            setBotMonitorTransactions((items) => [record, ...items]);
            upsertTrackedTrade(user?.id, {
              contractId,
              contractType,
              currency: snapshot.currency,
              id: record.id,
              market: snapshot.symbol,
              openedAt: new Date().toISOString(),
              payout: 0,
              profitLoss: 0,
              source: "bot-footer",
              stake,
              status: "open",
            });
            // Mirror the trade to Supabase so it shows up on the dashboard +
            // analytics pages alongside manual trades. We use `upsert` keyed
            // on (user_id, deriv_contract_id) so a re-run with the same
            // contract id won't duplicate rows, and we keep a handle on the
            // returned row id so the settlement update below targets it.
            let dbTradeId: string | null = null;
            if (user?.id) {
              try {
                const { data: insertedTrade, error: insertError } = await supabase
                  .from("trades")
                  .insert({
                    user_id: user.id,
                    deriv_contract_id: contractId,
                    symbol: snapshot.symbol,
                    trade_type: contractType,
                    stake,
                    payout: Number(buy.buy?.payout ?? 0),
                    status: "open",
                  })
                  .select()
                  .single();
                if (insertError) {
                  console.warn("[Bot Footer] Could not insert trade row", insertError);
                } else {
                  dbTradeId = insertedTrade?.id ?? null;
                }
              } catch (err) {
                console.warn("[Bot Footer] insert trade row threw", err);
              }
            }
            addFooterBotJournal(
              `Bought contract ${contractId}. Waiting for settlement.`,
              "success",
            );
            settlement = await waitForSettlement(contractId, onContractUpdate);

            setBotMonitorTransactions((items) =>
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
            // Close out the Supabase row with the settled result so dashboard
            // / analytics show the right P/L and won/lost status in realtime.
            if (user?.id && dbTradeId) {
              const settledProfit = Number(settlement?.profit ?? 0);
              const settledStatus =
                settlement?.status === "won"
                  ? "won"
                  : settlement?.status === "lost"
                    ? "lost"
                    : "open";
              try {
                const { error: updateError } = await supabase
                  .from("trades")
                  .update({
                    profit_loss: settledProfit,
                    payout: Number(settlement?.payout ?? 0),
                    status: settledStatus,
                    closed_at: new Date().toISOString(),
                  })
                  .eq("id", dbTradeId);
                if (updateError) {
                  console.warn("[Bot Footer] Could not update settled trade", updateError);
                }
              } catch (err) {
                console.warn("[Bot Footer] update settled trade threw", err);
              }
            }
            duringPurchaseCallback = null;
            tradeError = null;
            break;
          } catch (error) {
            duringPurchaseCallback = null;
            tradeError = error;
            if (
              !contractWasBought &&
              attempt < BOT_TRADE_MAX_ATTEMPTS &&
              shouldRetryBotTrade(error)
            ) {
              addFooterBotJournal(
                "Deriv returned a temporary processing error. Retrying once.",
                "warning",
              );
              await sleep(750);
              continue;
            }
            break;
          }
        }

        if (!settlement) {
          const message = getDerivTradingErrorMessage(tradeError);
          if (snapshot.restartBuySellOnError || snapshot.restartLastTradeOnError) {
            addFooterBotJournal(
              `Skipped one bot run after Deriv rejected the trade: ${message}`,
              "warning",
            );
            continue;
          }
          throw tradeError;
        }

        runningProfit += settlement.profit;
        completedRuns += 1;
        setBotMonitorStats((current) => ({
          contractsLost: current.contractsLost + (settlement.status === "lost" ? 1 : 0),
          contractsWon: current.contractsWon + (settlement.status === "won" ? 1 : 0),
          runs: current.runs + 1,
          totalPayout: current.totalPayout + settlement.payout,
          totalProfitLoss: current.totalProfitLoss + settlement.profit,
          totalStake: current.totalStake + stake,
        }));
        addFooterBotJournal(
          `Contract settled ${settlement.status}. Run ${completedRuns}/${runCap}. P/L ${runningProfit.toFixed(2)} ${snapshot.currency}.`,
          settlement.status === "won"
            ? "success"
            : settlement.status === "lost"
              ? "warning"
              : "info",
        );
        await refreshBalances("footer-bot-trade-complete", account.account_id).catch((error) => {
          console.warn("[Top Shell] balance refresh after settled trade failed", error);
        });

        if (tpThreshold > 0 && runningProfit >= tpThreshold) {
          addFooterBotJournal(
            `Take-profit reached (+${runningProfit.toFixed(2)} ${snapshot.currency} ≥ ${tpThreshold.toFixed(2)}). Bot stopped.`,
            "success",
          );
          break;
        }
        if (slThreshold > 0 && runningProfit <= -slThreshold) {
          addFooterBotJournal(
            `Stop-loss reached (${runningProfit.toFixed(2)} ${snapshot.currency} ≤ -${slThreshold.toFixed(2)}). Bot stopped.`,
            "warning",
          );
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
          // Populate full readDetails contract fields from the settled contract
          botState.entryTickTime = settlement.entryTickTime;
          botState.exitTickTime = settlement.exitTickTime;
          botState.barrierValue = settlement.barrierValue;
          // Reset sell-at-market flags for next cycle
          botState.isSellAtMarketAvailable = false;
          botState.sellAtMarketRequested = false;
          botState.currentSellPrice = 0;
          console.log("[SETTLEMENT]", {
            result: settlement.status,
            entrySpot: settlement.entrySpot,
            exitSpot: settlement.exitSpot,
            buyPrice: capturedBuyPrice,
            payout: settlement.payout,
            lastProfit: settlement.profit,
          });
          runAfterPurchase(workspaceXml, botState);
          drainNotifyQueue(botState, addFooterBotJournal);
          console.log("[STATE AFTER PURCHASE]", {
            stake: botState.vars["stake"],
            loss: botState.vars["loss"],
            totalProfit: botState.totalProfit,
          });
          const xmlStake = getBotStakeVar(botState);
          currentStake =
            xmlStake != null
              ? clampNumber(xmlStake, 0.35, snapshot.maxStake)
              : settlement.status === "lost"
                ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
                : snapshot.stake;
        } else {
          currentStake =
            settlement.status === "lost"
              ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
              : snapshot.stake;
        }
        botAnalysisPaused = false;
        console.log("[NEXT STAKE]", currentStake);
      }

      if (footerBotRunningRef.current && completedRuns >= runCap) {
        addFooterBotJournal(
          `Reached the maximum number of runs (${runCap}) before take-profit or stop-loss was hit.`,
          "info",
        );
      }

      stopTickWs();
      await refreshBalances("footer-bot-run-complete", account.account_id).catch((error) => {
        console.warn("[Top Shell] final balance refresh after run failed", error);
      });
      setBotMonitorStatus("stopped");
      footerBotRunningRef.current = false;
      addFooterBotJournal("Bot run completed.", "success");
    } catch (error) {
      stopTickWs();
      const message = getDerivTradingErrorMessage(error);
      footerBotRunningRef.current = false;
      setBotMonitorStatus("stopped");
      addFooterBotJournal(message, "error");
      toast.error(message);
    }
  }

  return (
    <div className="flex min-h-dvh min-w-0 flex-col overflow-x-hidden bg-[#f2f3f4] text-[#333333] dark:bg-[#0e0e0e] dark:text-[#e6e6e6]">
      <header className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-[#e5e5e5] bg-white px-3 py-2 sm:flex-nowrap md:px-6 dark:border-[#242424] dark:bg-[#151515]">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <BrandLogo
            imageClassName="size-10 rounded-[12px] sm:size-11"
            labelClassName="truncate text-base font-bold tracking-tight text-[#333333] sm:text-lg dark:text-[#e6e6e6]"
          />
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:flex-none sm:gap-4">
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            aria-label="Toggle theme"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#d6d6d6] bg-white text-[#333333] transition hover:bg-[#f2f3f4] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#e6e6e6] dark:hover:bg-[#222]"
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {user && account && (
            <>
              <Button
                onClick={handleDeposit}
                className="hidden h-9 rounded-md bg-[#ff444f] px-5 text-sm font-bold text-white hover:bg-[#eb3e48] sm:inline-flex"
              >
                Deposit
              </Button>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-w-0 max-w-[min(58vw,17rem)] items-center gap-1.5 rounded-full border border-[#d6d6d6] bg-white px-2 py-1.5 transition hover:bg-[#f2f3f4] sm:max-w-full sm:gap-2 sm:px-3 dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:hover:bg-[#222]">
                    <AccountIcon account={account} size="sm" />
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-bold tabular-nums text-[#333333] sm:text-sm dark:text-[#e6e6e6]">
                        {formatBalance(balance ?? account.balance, "").trim()}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-[#646464] dark:text-[#b7b7b7]">
                        {currency || account.currency}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-4 text-[#999999] transition-transform duration-200 dark:text-[#b7b7b7]",
                        dropdownOpen && "rotate-180",
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-[min(calc(100vw-1.5rem),380px)] overflow-hidden rounded-lg border border-[#d6d6d6] bg-white p-0 text-[#333333] shadow-xl dark:border-[#2b2b2b] dark:bg-[#151515] dark:text-[#e6e6e6]"
                >
                  <Tabs
                    value={activeAccountTab}
                    onValueChange={(value) => setActiveAccountTab(value as "real" | "demo")}
                    className="w-full"
                  >
                    <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b border-[#eeeeee] bg-white p-0 dark:border-[#2b2b2b] dark:bg-[#151515]">
                      <TabsTrigger
                        value="real"
                        className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333] data-[state=active]:shadow-none dark:text-[#b7b7b7] dark:data-[state=active]:text-[#f2f2f2]"
                      >
                        Real
                      </TabsTrigger>
                      <TabsTrigger
                        value="demo"
                        className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333] data-[state=active]:shadow-none dark:text-[#b7b7b7] dark:data-[state=active]:text-[#f2f2f2]"
                      >
                        Demo
                      </TabsTrigger>
                    </TabsList>

                    <div className="px-4 pb-2 pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#333333] dark:text-[#f2f2f2]">
                          Deriv accounts
                        </span>
                        <ChevronUp className="size-4 text-[#333333] dark:text-[#f2f2f2]" />
                      </div>

                      <TabsContent value="real" className="mt-0 space-y-1">
                        <AccountList
                          accounts={realAccounts}
                          activeAccountId={account.account_id}
                          emptyText="No real accounts linked."
                          onSelect={(accountId) => {
                            switchAccount(accountId);
                            setDropdownOpen(false);
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="demo" className="mt-0 space-y-1">
                        <AccountList
                          accounts={demoAccounts}
                          activeAccountId={account.account_id}
                          emptyText="No demo accounts linked."
                          onSelect={(accountId) => {
                            switchAccount(accountId);
                            setDropdownOpen(false);
                          }}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>

                  <div className="border-t border-[#eeeeee] bg-white px-4 py-3 dark:border-[#2b2b2b] dark:bg-[#151515]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-[#333333] dark:text-[#f2f2f2]">
                          {totalAssetsLabel(visibleAccounts)}
                        </div>
                        <div className="mt-0.5 text-xs text-[#777777] dark:text-[#b7b7b7]">
                          Total assets in your Deriv accounts.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#eeeeee] bg-[#f9f9f9] px-4 py-3 text-center dark:border-[#2b2b2b] dark:bg-[#101010]">
                    <p className="text-[13px] text-[#333333] dark:text-[#d8d8d8]">
                      Looking for CFD accounts?{" "}
                      <a
                        href="#"
                        className="font-bold text-[#333333] hover:underline dark:text-[#f2f2f2]"
                      >
                        Go to Trader&apos;s Hub
                      </a>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-4 py-3 dark:bg-[#151515]">
                    <Button
                      variant="outline"
                      className="h-9 rounded-md border-[#999999] px-4 text-sm font-bold text-[#333333] hover:bg-[#f2f3f4] dark:border-[#3a3a3a] dark:bg-[#101010] dark:text-[#e6e6e6] dark:hover:bg-[#202020]"
                      onClick={handleRefreshBalances}
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("mr-2 size-4", refreshing && "animate-spin")} />
                      Refresh balances
                    </Button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-sm font-medium text-[#333333] hover:text-[#ff444f] dark:text-[#e6e6e6] dark:hover:text-[#ff6b73]"
                    >
                      Logout <LogOut className="size-4" />
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}

          {user && !account && (
            <div className="flex flex-col items-end gap-0.5">
              <Button
                onClick={handleConnectDeriv}
                className="h-9 rounded-md bg-[#ff444f] px-3 text-sm text-white hover:bg-[#eb3e48] sm:px-4"
              >
                <Plug className="mr-1 size-4" /> <span className="hidden sm:inline">Connect</span>{" "}
                Deriv
              </Button>
              <button
                type="button"
                onClick={handleConnectLegacyDeriv}
                className="text-[10px] font-medium text-[#646464] hover:text-[#ff444f] hover:underline dark:text-[#b7b7b7] dark:hover:text-[#ff6b73]"
              >
                Have an older Deriv API token? Connect here.
              </button>
            </div>
          )}

          {!user && (
            <div className="flex gap-1 sm:gap-2">
              <Button variant="ghost" asChild className="h-9 px-3 text-sm font-medium sm:px-4">
                <Link to="/auth" search={{ mode: "signin" }}>
                  Log in
                </Link>
              </Button>
              <Button
                asChild
                className="h-9 bg-[#3e3e3e] px-3 text-sm font-medium text-white shadow-sm sm:px-4"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <nav className="border-b border-[#e5e5e5] bg-white dark:border-[#242424] dark:bg-[#151515]">
        <div className="flex min-w-0 items-center overflow-x-auto px-1 sm:px-2">
          {TOP_TABS.map((t) => {
            const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-label={t.label}
                className={cn(
                  "flex min-w-max shrink-0 items-center justify-center gap-1.5 px-3 py-2.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-4 sm:py-3 sm:text-sm",
                  active
                    ? "bg-[#4bb4b3] text-white"
                    : "text-[#333333] hover:bg-[#f2f3f4] dark:text-[#cccccc] dark:hover:bg-[#1f1f1f]",
                )}
              >
                <Icon className="size-4" />
                <span className={cn("whitespace-nowrap", active && "uppercase tracking-wide")}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className={cn("flex min-w-0 flex-1 flex-col", showBotMonitor && "pb-14")}>
        {children}
      </main>

      {showBotMonitor && (
        <BotRunMonitorPanel
          activeTab={botMonitorTab}
          collapsed={botMonitorCollapsed}
          connecting={botRunConnecting}
          currency={currency || account?.currency || "USD"}
          journal={botMonitorJournal}
          mode="footer"
          onReset={resetFooterBotMonitor}
          onRun={() => {
            const workspace = getDerivWorkspace();
            const hasBlocks = (workspace?.getAllBlocks?.()?.length ?? 0) > 0;
            if (hasBlocks) {
              void handleDbotBotRun();
            } else {
              // Expand the panel immediately so the user sees activity
              setBotMonitorCollapsed(false);
              setBotMonitorTab("journal");
              void handleFooterBotRun();
            }
          }}
          onToggleCollapse={() => setBotMonitorCollapsed((value) => !value)}
          setActiveTab={setBotMonitorTab}
          stats={botMonitorStats}
          status={botMonitorStatus}
          title="Bot monitor"
          transactions={botMonitorTransactions}
        />
      )}

      {showAssistantButton && (
        <AiAssistant currentPath={pathname} showBotMonitor={showBotMonitor} />
      )}
    </div>
  );
}

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
    settings.purchaseDirection === "odd"
      ? "Odd"
      : settings.purchaseDirection === "even"
        ? "Even"
        : settings.purchaseDirection === "matches"
          ? "Matches"
          : settings.purchaseDirection === "differs"
            ? "Differs"
            : settings.purchaseDirection === "under"
              ? "Under"
              : settings.purchaseDirection === "over"
                ? "Over"
                : settings.purchaseDirection === "higher"
                  ? "Higher"
                  : settings.purchaseDirection === "lower"
                    ? "Lower"
                    : settings.purchaseDirection === "touch"
                      ? "Touch"
                      : settings.purchaseDirection === "no_touch"
                        ? "No Touch"
                        : settings.purchaseDirection === "up"
                          ? "Rise"
                          : settings.purchaseDirection === "down"
                            ? "Fall"
                            : settings.purchaseDirection;
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

function conditionAllowsTrade(
  settings: BotBuilderSettings,
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
          : null; // "Last Digit" and anything else → bypass the condition gate
  if (leftValue === null) return true;
  const rightValue = Number(settings.conditionRight);
  if (settings.conditionOperator === "contains") {
    if (!settings.conditionRight) return true;
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

async function waitForSettlement(
  contractId: string,
  onContractUpdate?: (contract: Record<string, unknown>) => void,
): Promise<Settlement> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => Promise<void>) | undefined;
    const emptySettlement: Settlement = {
      entrySpot: null,
      exitSpot: null,
      payout: 0,
      profit: 0,
      status: "open",
      transactionIdSell: null,
      entryTickTime: null,
      exitTickTime: null,
      barrierValue: null,
    };
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(emptySettlement);
      void unsubscribe?.();
    }, 45000);

    subscribeOpenContract(contractId, (contract) => {
      // Always relay contract updates so during_purchase can read sell availability
      onContractUpdate?.(contract);

      const statusText = String(contract.status ?? "").toLowerCase();
      // Deriv sends is_expired=1 BEFORE sell_price/profit are finalised — triggering
      // on is_expired alone records winning contracts as losses (profit is still the
      // live negative bid-based P/L at that point). Wait for is_sold=1 instead, which
      // guarantees sell_price and profit fields are ready. This matches DDBOt exactly.
      const isSold =
        contract.is_sold === 1 ||
        contract.is_sold === true ||
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
      // For a settled contract Deriv leaves `payout` at the ORIGINAL potential
      // payout regardless of outcome. Real money received is `sell_price`
      // (zero for a lost binary). If the contract won we credit the actual
      // sell_price (falling back to payout); if it lost the payout is zero.
      const sell_price = Number(contract.sell_price ?? 0);
      const contract_buy_price = Number(contract.buy_price ?? 0);
      const potential_payout = Number(contract.payout ?? 0);
      // Compute profit from explicit price fields — more reliable than contract.profit
      // which can lag on the settlement message. sell_price - buy_price matches how
      // Deriv itself defines profit (confirmed from DDBOt helpers.js createDetails).
      const computedProfit =
        sell_price > 0 || contract_buy_price > 0 ? sell_price - contract_buy_price : null;
      const rawProfit = Number(contract.profit);
      const profit =
        computedProfit !== null ? computedProfit : Number.isFinite(rawProfit) ? rawProfit : 0;
      // Use contract.status for reliable win/loss; fall back to profit sign.
      const won =
        statusText === "won"
          ? true
          : statusText === "lost"
            ? false
            : Number.isFinite(profit) && profit > 0;
      const payout = won
        ? sell_price > 0
          ? sell_price
          : potential_payout > 0
            ? potential_payout
            : 0
        : 0;
      // Extract extra readDetails fields from the settled contract
      const entryTickTime = Number(contract.entry_tick_time ?? 0) || null;
      const exitTickTime = Number(contract.exit_tick_time ?? 0) || null;
      const barrierValue = contract.barrier ? String(contract.barrier) : null;
      const transactionIdSell = contract.transaction_ids
        ? String((contract.transaction_ids as Record<string, unknown>).sell ?? "") || null
        : null;
      resolve({
        entrySpot,
        exitSpot,
        payout,
        profit,
        status: won ? "won" : "lost",
        transactionIdSell,
        entryTickTime,
        exitTickTime,
        barrierValue,
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

function drainNotifyQueue(
  state: BotVarState,
  addJournal: (msg: string, type?: BotMonitorJournalEntry["type"]) => void,
) {
  while (state.notifyQueue.length > 0) {
    const item = state.notifyQueue.shift();
    if (!item) break;
    const jType: BotMonitorJournalEntry["type"] =
      item.type === "error" ? "error" :
      item.type === "success" ? "success" :
      item.type === "warn" ? "warning" :
      "info";
    addJournal(`[Bot] ${item.message}`, jType);
  }
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

function AccountList({
  accounts,
  activeAccountId,
  emptyText,
  onSelect,
}: {
  accounts: DerivAccount[];
  activeAccountId: string;
  emptyText: string;
  onSelect: (accountId: string) => void;
}) {
  if (!accounts.length) {
    return (
      <div className="py-8 text-center text-xs text-[#999999] dark:text-[#b7b7b7]">{emptyText}</div>
    );
  }

  return (
    <>
      {accounts.map((account) => (
        <AccountItem
          key={account.account_id}
          account={account}
          isActive={activeAccountId === account.account_id}
          onSelect={() => onSelect(account.account_id)}
        />
      ))}
    </>
  );
}

function AccountItem({
  account,
  isActive,
  onSelect,
}: {
  account: DerivAccount;
  isActive: boolean;
  onSelect: () => void;
}) {
  const demo = isDemoAccount(account);
  const meta = currencyMeta(account.currency);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg p-3 transition-colors",
        isActive
          ? "bg-[#e6e9e9] dark:bg-[#242424]"
          : "bg-transparent hover:bg-[#f2f3f4] dark:hover:bg-[#202020]",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <AccountIcon account={account} />
        <div className="min-w-0 text-left leading-tight">
          <div className="truncate text-sm font-bold text-[#333333] dark:text-[#f2f2f2]">
            {demo ? "Demo" : account.label || meta.name}
          </div>
          <div className="truncate text-[11px] font-medium text-[#999999] dark:text-[#b7b7b7]">
            {account.account_id}
          </div>
        </div>
      </div>
      <div className="shrink-0 pl-2 text-right leading-tight sm:pl-3">
        <div className="text-sm font-bold text-[#333333] dark:text-[#f2f2f2]">
          {formatBalance(account.balance, account.currency)}
        </div>
      </div>
    </button>
  );
}

function AccountIcon({
  account,
  size = "md",
}: {
  account: Pick<
    DerivAccount,
    "account_id" | "loginid" | "currency" | "is_demo" | "is_virtual" | "account_type"
  >;
  size?: "sm" | "md";
}) {
  const demo = isDemoAccount(account);
  const meta = currencyMeta(account.currency);
  const box = size === "sm" ? "size-5" : "size-8";
  const text = size === "sm" ? "text-[10px]" : "text-sm";

  if (demo) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full bg-[#ff444f] text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
          box,
        )}
        title="Demo account"
      >
        <span className={cn("font-black leading-none", text)}>D</span>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white bg-[#85acb0]" />
      </div>
    );
  }

  if (meta.country) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f2f3f4] bg-white dark:border-[#333] dark:bg-[#101010]",
          box,
        )}
        title={meta.name}
      >
        <img
          src={`https://flagcdn.com/w40/${meta.country}.png`}
          srcSet={`https://flagcdn.com/w80/${meta.country}.png 2x`}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-[#d6d6d6] bg-white text-[#333333] dark:border-[#333] dark:bg-[#101010] dark:text-[#f2f2f2]",
        box,
      )}
      title={meta.name}
    >
      <span className={cn("font-bold leading-none", text)}>
        {meta.symbol ?? account.currency?.slice(0, 1) ?? "$"}
      </span>
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 px-3 py-6 sm:px-4 sm:py-10 md:px-8">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-[#646464] dark:text-[#b7b7b7]">{subtitle}</p>
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
