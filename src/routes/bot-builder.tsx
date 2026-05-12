import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  FolderOpen,
  LayoutList,
  LineChart,
  Play,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Square,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";

import { TopShell } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import {
  ensureDerivTradingConnection,
  getDerivTradingErrorMessage,
  type TradeCategory,
  type TradingAdapter,
} from "@/lib/deriv";
import { buyProposal, requestProposal, subscribeOpenContract } from "@/lib/deriv-trading-service";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bot-builder")({
  component: BotBuilderPage,
});

type BotStatus = "error" | "running" | "stopped";
type DurationUnit = "m" | "s" | "t";
type TradeTypeUi = "digits" | "higher_lower" | "multiplier" | "rise_fall" | "touch_no_touch";
type DigitContract = "even_odd" | "matches_differs" | "over_under";
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
  restartLastTradeOnError: boolean;
  runOnceAtStart: boolean;
  selectedDigit: number;
  stake: number;
  stopLoss: number;
  symbol: string;
  takeProfit: number;
  tradeEveryTick: boolean;
  tradeType: TradeTypeUi;
};
type BotStats = {
  contractsLost: number;
  contractsWon: number;
  runs: number;
  totalPayout: number;
  totalProfitLoss: number;
  totalStake: number;
};
type Transaction = {
  contractId: string;
  id: string;
  payout: number;
  profit: number;
  stake: number;
  status: "lost" | "open" | "won";
  time: string;
};
type JournalEntry = {
  id: string;
  message: string;
  time: string;
  type: "error" | "info" | "success" | "warning";
};
type Settlement = {
  payout: number;
  profit: number;
  status: "lost" | "open" | "won";
};

const STORAGE_KEY = "arktrader:bot-builder:deriv-style-settings";

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

const initialSettings: BotSettings = {
  assetCategory: "Continuous Indices",
  candleInterval: "1 minute",
  conditionJoin: "All",
  conditionLeft: "Last Digit",
  conditionOperator: ">",
  conditionRight: "4",
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
  restartLastTradeOnError: true,
  runOnceAtStart: true,
  selectedDigit: 4,
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

function BotBuilderPage() {
  const { account, currency: accountCurrency, refreshBalances } = useDerivBalanceContext();
  const [settings, setSettings] = useState<BotSettings>(initialSettings);
  const [status, setStatus] = useState<BotStatus>("stopped");
  const [activeTab, setActiveTab] = useState("summary");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
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
  const runningRef = useRef(false);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!accountCurrency) return;
    updateSettings({ currency: accountCurrency });
  }, [accountCurrency]);

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

  function saveSettings() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsRef.current, null, 2));
    addJournal("Bot settings saved locally.", "success");
    toast.success("Bot settings saved.");
  }

  function loadSettings() {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      toast.info("No saved bot settings found.");
      return;
    }
    const parsed = JSON.parse(raw) as BotSettings;
    updateSettings(parsed);
    addJournal("Saved bot settings loaded.", "success");
  }

  function applyQuickStrategy() {
    updateSettings({
      digitContract: "over_under",
      duration: 1,
      durationUnit: "t",
      martingale: 1.5,
      maxRuns: 3,
      maxStake: 50,
      purchaseDirection: "over",
      selectedDigit: 4,
      stake: 1,
      stopLoss: 30,
      takeProfit: 100,
      tradeType: "digits",
    });
    addJournal("Quick strategy applied.", "success");
  }

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
      const context = {
        adapter: session.adapter,
        contractType: contractTypeLabel(settingsRef.current),
        selectedAccountId: account.account_id,
        selectedAccountType: account.normalizedType,
      };
      let currentStake = settingsRef.current.stake;
      let runningProfit = stats.totalProfitLoss;

      for (let index = 0; runningRef.current && index < settingsRef.current.maxRuns; index += 1) {
        const snapshot = settingsRef.current;
        const stake = clampNumber(currentStake, 0.35, snapshot.maxStake);
        if (!conditionAllowsTrade(snapshot, stake, index + 1, runningProfit)) {
          addJournal("Purchase condition is false. Waiting for the next run cycle.", "warning");
          if (!snapshot.tradeEveryTick) break;
          await sleep(700);
          continue;
        }

        const input = proposalInput(snapshot, stake);
        let settlement: Settlement;
        try {
          const payload = buildStandardProposalPayload(input, session.adapter as TradingAdapter);
          addJournal(
            `Requesting proposal for ${contractTypeLabel(snapshot)} with ${stake.toFixed(2)} ${snapshot.currency}.`,
          );
          const proposal = await requestProposal(payload, context);
          const proposalId = String(proposal.proposal?.id ?? "");
          const askPrice = Number(proposal.proposal?.ask_price ?? stake);
          const buy = await buyProposal(proposalId, askPrice, context);
          const contractId = String(buy.buy?.contract_id ?? "");
          const record: Transaction = {
            contractId,
            id: crypto.randomUUID(),
            payout: 0,
            profit: 0,
            stake,
            status: "open",
            time: formatTime(),
          };
          setTransactions((items) => [record, ...items]);
          addJournal(`Bought contract ${contractId}. Waiting for settlement.`, "success");
          settlement = await waitForSettlement(contractId);

          setTransactions((items) =>
            items.map((item) =>
              item.id === record.id
                ? {
                    ...item,
                    payout: settlement.payout,
                    profit: settlement.profit,
                    status: settlement.status,
                  }
                : item,
            ),
          );
        } catch (error) {
          const message = getDerivTradingErrorMessage(error);
          if (snapshot.restartBuySellOnError || snapshot.restartLastTradeOnError) {
            addJournal(`Trade error recovered: ${message}`, "warning");
            await sleep(700);
            continue;
          }
          throw error;
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

        if (runningProfit >= snapshot.takeProfit || runningProfit <= -Math.abs(snapshot.stopLoss)) {
          addJournal("Profit or loss threshold reached. Bot stopped.", "warning");
          break;
        }
        currentStake =
          settlement.status === "lost"
            ? clampNumber(stake * snapshot.martingale, 0.35, snapshot.maxStake)
            : snapshot.stake;
        if (!snapshot.tradeEveryTick) await sleep(1000);
      }

      await refreshBalances("bot-builder-run");
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
    <TopShell showAssistantButton={false}>
      <div className="min-w-0 bg-[#e9eaec] p-2 text-[#171717] dark:bg-[#0f0f0f]">
        <div
          className={cn(
            "grid h-[calc(100dvh-6.25rem)] min-h-[620px] grid-cols-1 gap-4 overflow-hidden",
            leftCollapsed
              ? "lg:grid-cols-[52px_minmax(0,1fr)_354px]"
              : "lg:grid-cols-[228px_minmax(0,1fr)_354px]",
          )}
        >
          <BlocksMenu
            collapsed={leftCollapsed}
            filteredMenu={filteredMenu}
            onQuickStrategy={applyQuickStrategy}
            onSearch={setSearchTerm}
            onToggle={() => setLeftCollapsed((value) => !value)}
            searchTerm={searchTerm}
          />
          <WorkspaceCanvas
            onLoad={loadSettings}
            onRedo={redo}
            onReset={resetBot}
            onSave={saveSettings}
            onUndo={undo}
            onZoomIn={() => setZoom((value) => Math.min(1.2, Number((value + 0.05).toFixed(2))))}
            onZoomOut={() => setZoom((value) => Math.max(0.7, Number((value - 0.05).toFixed(2))))}
            settings={settings}
            updateSettings={updateSettings}
            zoom={zoom}
          />
          <RunSummaryPanel
            activeTab={activeTab}
            currency={settings.currency}
            journal={journal}
            onReset={resetBot}
            onRun={runBot}
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

function BlocksMenu({
  collapsed,
  filteredMenu,
  onQuickStrategy,
  onSearch,
  onToggle,
  searchTerm,
}: {
  collapsed: boolean;
  filteredMenu: typeof blockMenu;
  onQuickStrategy: () => void;
  onSearch: (value: string) => void;
  onToggle: () => void;
  searchTerm: string;
}) {
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
    <aside className="flex min-h-0 flex-col overflow-hidden bg-[#f5f5f5] text-[#101213] dark:bg-[#151515] dark:text-[#eeeeee]">
      <button
        type="button"
        onClick={onQuickStrategy}
        className="mx-2 mt-2 flex h-40 min-h-10 items-start justify-center rounded-[4px] bg-[#ff444f] px-3 pt-3 text-sm font-bold text-white shadow-sm lg:h-40"
      >
        Quick strategy
      </button>

      <button
        type="button"
        onClick={onToggle}
        className="mt-2 flex h-[54px] items-center justify-between bg-[#eceeef] px-5 text-base font-bold dark:bg-[#202020]"
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

      <div className="min-h-0 flex-1 bg-white dark:bg-[#151515]">
        {filteredMenu.map((item) => (
          <a
            key={item.title}
            href={`#${item.section}`}
            className="flex h-[41px] w-full items-center justify-between border-b border-[#eeeeee] px-5 text-left text-sm font-bold hover:bg-[#f7f7f7] dark:border-[#2b2b2b] dark:hover:bg-[#202020]"
          >
            <span>{item.title}</span>
            {item.collapsible && <ChevronDown className="size-5" />}
          </a>
        ))}
      </div>
    </aside>
  );
}

function WorkspaceCanvas({
  onLoad,
  onRedo,
  onReset,
  onSave,
  onUndo,
  onZoomIn,
  onZoomOut,
  settings,
  updateSettings,
  zoom,
}: {
  onLoad: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
  zoom: number;
}) {
  return (
    <section className="relative min-h-0 overflow-hidden bg-white dark:bg-[#101010]">
      <WorkspaceToolbar
        onLoad={onLoad}
        onRedo={onRedo}
        onReset={onReset}
        onSave={onSave}
        onUndo={onUndo}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />
      <ScrollArea className="h-full">
        <div className="relative h-[1420px] min-w-[1320px] bg-white dark:bg-[#101010]">
          <div
            className="absolute left-6 top-[62px] origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            <TradeParametersBlock settings={settings} updateSettings={updateSettings} />
            <PurchaseConditionsBlock settings={settings} updateSettings={updateSettings} />
            <FunctionStack settings={settings} updateSettings={updateSettings} />
          </div>
          <div className="absolute right-[-9px] top-1/2 z-20 flex h-12 w-5 -translate-y-1/2 items-center justify-center border border-[#d2d2d2] bg-white text-[#5d5d5d] dark:border-[#333] dark:bg-[#151515]">
            <ChevronLeft className="size-4" />
            <ChevronRight className="-ml-3 size-4" />
          </div>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </section>
  );
}

function WorkspaceToolbar({
  onLoad,
  onRedo,
  onReset,
  onSave,
  onUndo,
  onZoomIn,
  onZoomOut,
}: {
  onLoad: () => void;
  onRedo: () => void;
  onReset: () => void;
  onSave: () => void;
  onUndo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  const actions = [
    { icon: RefreshCw, label: "Reset", onClick: onReset },
    { icon: FolderOpen, label: "Load", onClick: onLoad },
    { icon: Save, label: "Save", onClick: onSave },
    { icon: LayoutList, label: "Workspace layout", onClick: onReset },
    { icon: LineChart, label: "Analysis view", onClick: onZoomOut },
    { icon: BarChart2, label: "Chart view", onClick: onZoomIn },
    { icon: Undo2, label: "Undo", onClick: onUndo },
    { icon: Redo2, label: "Redo", onClick: onRedo },
    { icon: ZoomIn, label: "Zoom in", onClick: onZoomIn },
    { icon: ZoomOut, label: "Zoom out", onClick: onZoomOut },
  ];

  return (
    <div className="absolute left-0 top-0 z-30 flex h-[54px] items-center bg-white pl-4 dark:bg-[#101010]">
      <div className="flex h-10 items-center overflow-hidden rounded-[4px] border border-[#d0d2d4] bg-white dark:border-[#333] dark:bg-[#151515]">
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

function RunSummaryPanel({
  activeTab,
  currency,
  journal,
  onReset,
  onRun,
  setActiveTab,
  stats,
  status,
  transactions,
}: {
  activeTab: string;
  currency: string;
  journal: JournalEntry[];
  onReset: () => void;
  onRun: () => void;
  setActiveTab: (value: string) => void;
  stats: BotStats;
  status: BotStatus;
  transactions: Transaction[];
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden bg-white dark:bg-[#151515]">
      <div className="flex h-[49px] items-center gap-3 bg-[#f7f7f7] dark:bg-[#1c1c1c]">
        <Button
          className={cn(
            "h-[40px] w-[82px] rounded-none text-base font-bold text-white",
            status === "running"
              ? "bg-[#ff444f] hover:bg-[#ef3f49]"
              : "bg-[#4bb4b3] hover:bg-[#43a5a4]",
          )}
          onClick={onRun}
        >
          {status === "running" ? (
            <Square className="mr-1 size-4 fill-white" />
          ) : (
            <Play className="mr-1 size-5 fill-white" />
          )}
          {status === "running" ? "Stop" : "Run"}
        </Button>
        <div className="mr-4 flex h-[38px] flex-1 flex-col items-center justify-center rounded-[2px] border border-[#cfd2d4] bg-white dark:border-[#333] dark:bg-[#101010]">
          <div className="text-xs font-bold">
            Bot is{" "}
            {status === "running" ? "running" : status === "error" ? "in error" : "not running"}
          </div>
          <div className="mt-2 h-1 w-[92%] rounded-full bg-[#d8d8d8]">
            <div
              className={cn(
                "h-1 rounded-full",
                status === "running" && "w-3/4 bg-[#4bb4b3]",
                status === "stopped" && "w-[4px] bg-[#111]",
                status === "error" && "w-1/2 bg-[#ff444f]",
              )}
            />
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="grid h-10 w-full grid-cols-3 rounded-none border-b border-[#e5e5e5] bg-white p-0 dark:border-[#2b2b2b] dark:bg-[#151515]">
          {["summary", "transactions", "journal"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="h-full rounded-none border-b-2 border-transparent bg-transparent text-sm font-medium capitalize text-[#444] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:font-bold data-[state=active]:shadow-none dark:text-[#e6e6e6]"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="summary" className="m-0 min-h-0 flex-1 bg-white p-4 dark:bg-[#151515]">
          <div className="flex h-[258px] items-center justify-center bg-[#f1f2f3] px-8 text-center text-sm leading-5 text-[#444] dark:bg-[#202020] dark:text-[#d8d8d8]">
            <p>
              When you're ready to trade, hit <strong>Run.</strong>
              <br />
              You'll be able to track your bot's
              <br />
              performance here.
            </p>
          </div>

          <div className="bg-[#f1f2f3] pb-4 dark:bg-[#202020]">
            <div className="px-5 pt-4 text-right text-[11px] underline">What's this?</div>
            <div className="grid grid-cols-3 gap-y-6 px-5 pt-3 text-center">
              <SummaryMetric label="Total stake" value={formatMoney(stats.totalStake, currency)} />
              <SummaryMetric
                label="Total payout"
                value={formatMoney(stats.totalPayout, currency)}
              />
              <SummaryMetric label="No. of runs" value={stats.runs} />
              <SummaryMetric label="Contracts lost" value={stats.contractsLost} />
              <SummaryMetric label="Contracts won" value={stats.contractsWon} />
              <SummaryMetric
                label="Total profit/loss"
                value={formatMoney(stats.totalProfitLoss, currency)}
              />
            </div>
          </div>

          <button
            className="mt-3 h-10 w-full rounded-[3px] border border-[#999] bg-white text-sm font-bold hover:bg-[#f7f7f7] dark:bg-[#151515] dark:hover:bg-[#202020]"
            type="button"
            onClick={onReset}
          >
            Reset
          </button>
        </TabsContent>

        <TabsContent value="transactions" className="m-0 min-h-0 flex-1 bg-white dark:bg-[#151515]">
          <ScrollArea className="h-full p-4">
            {transactions.length === 0 ? (
              <EmptyPanel title="No transactions yet" />
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="rounded-[4px] border border-[#e5e5e5] bg-[#f8f8f8] p-3 text-xs dark:border-[#333] dark:bg-[#202020]"
                  >
                    <div className="flex items-center justify-between gap-2 font-bold">
                      <span>Contract {transaction.contractId}</span>
                      <span className="capitalize">{transaction.status}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                      <SummaryMetric
                        label="Stake"
                        value={formatMoney(transaction.stake, currency)}
                      />
                      <SummaryMetric
                        label="Payout"
                        value={formatMoney(transaction.payout, currency)}
                      />
                      <SummaryMetric
                        label="P/L"
                        value={formatMoney(transaction.profit, currency)}
                      />
                    </div>
                    <div className="mt-2 text-[10px] text-[#777]">{transaction.time}</div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
        <TabsContent value="journal" className="m-0 min-h-0 flex-1 bg-white dark:bg-[#151515]">
          <ScrollArea className="h-full p-4">
            <div className="space-y-2">
              {journal.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    "rounded-[4px] border bg-[#f8f8f8] p-3 text-xs dark:bg-[#202020]",
                    entry.type === "error" && "border-[#ff444f] text-[#b4232d]",
                    entry.type === "success" && "border-[#4bb4b3] text-[#087a78]",
                    entry.type === "warning" && "border-[#f2b84b] text-[#8a5f00]",
                    entry.type === "info" && "border-[#e5e5e5] dark:border-[#333]",
                  )}
                >
                  <div className="mb-1 font-mono text-[10px] opacity-70">{entry.time}</div>
                  {entry.message}
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function SummaryMetric({ label, value }: { label: number | string; value: number | string }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-[#333] dark:text-[#eeeeee]">{label}</div>
      <div className="mt-3 text-xs text-[#333] dark:text-[#eeeeee]">{value}</div>
    </div>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center bg-[#f1f2f3] text-sm text-[#555] dark:bg-[#202020] dark:text-[#d8d8d8]">
      {title}
    </div>
  );
}

function TradeParametersBlock({
  settings,
  updateSettings,
}: {
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div id="trade" className="w-[760px]">
      <GreenHeader title="1. Trade parameters" width="w-[210px]" />
      <div className="rounded-b-[3px] bg-[#075773] pb-2 pl-2 pr-3 pt-2 text-[10px] text-[#242424] shadow-sm">
        <div className="space-y-2">
          <BlockLine>
            Market:{" "}
            <SelectPill
              options={["Derived"]}
              value={settings.market}
              onChange={(market) => updateSettings({ market })}
            />{" "}
            <span>&gt;</span>{" "}
            <SelectPill
              options={["Continuous Indices"]}
              value={settings.assetCategory}
              onChange={(assetCategory) => updateSettings({ assetCategory })}
            />{" "}
            <span>&gt;</span>{" "}
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
            <span>&gt;</span>{" "}
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
          <BlockLine className="w-[265px]">
            Restart buy/sell on error (disable for better performance):{" "}
            <TinySquare
              checked={settings.restartBuySellOnError}
              onChange={(restartBuySellOnError) => updateSettings({ restartBuySellOnError })}
            />
          </BlockLine>
          <BlockLine className="w-[276px]">
            Restart last trade on error (bot ignores the unsuccessful trade):{" "}
            <TinySquare
              checked={settings.restartLastTradeOnError}
              onChange={(restartLastTradeOnError) => updateSettings({ restartLastTradeOnError })}
            />
          </BlockLine>
          <BlockLine className="w-[162px]">
            Trade every tick:{" "}
            <TinySquare
              checked={settings.tradeEveryTick}
              onChange={(tradeEveryTick) => updateSettings({ tradeEveryTick })}
            />
          </BlockLine>
        </div>
        <GreenHeader title="Run once at start:" width="w-[210px]" className="mt-2" />
        <div className="space-y-1 rounded-b-[3px] bg-[#eeeeee] p-1">
          <BlockLine className="w-[140px]">
            Run at start{" "}
            <TinySquare
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
        <GreenHeader title="Trade options:" width="w-[210px]" className="mt-2" />
        <BlockLine className="w-[940px]">
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
          Stake:{" "}
          <SelectPill
            options={["USD", "EUR", "GBP", "USDT"]}
            value={settings.currency}
            onChange={(currency) => updateSettings({ currency })}
          />{" "}
          <NumberPill
            min={0.35}
            step={0.01}
            value={settings.stake}
            onChange={(stake) => updateSettings({ stake })}
          />{" "}
          (min: 0.35 - max: 50000) prediction:{" "}
          <NumberPill
            min={0}
            step={1}
            value={settings.selectedDigit}
            onChange={(selectedDigit) => updateSettings({ selectedDigit })}
          />
        </BlockLine>
      </div>
    </div>
  );
}

function PurchaseConditionsBlock({
  settings,
  updateSettings,
}: {
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div id="purchase" className="mt-6 w-[460px]">
      <GreenHeader title="2. Purchase conditions" width="w-[210px]" />
      <div className="rounded-b-[3px] bg-[#075773] p-2 text-[10px] text-[#242424]">
        <BlockLine className="w-[420px]">
          Purchase{" "}
          <SelectPill
            options={purchaseDirectionOptions(settings)}
            value={settings.purchaseDirection}
            onChange={(purchaseDirection) => updateSettings({ purchaseDirection })}
          />{" "}
          if{" "}
          <SelectPill
            options={["All", "Any"]}
            value={settings.conditionJoin}
            onChange={(conditionJoin) =>
              updateSettings({ conditionJoin: conditionJoin as "All" | "Any" })
            }
          />{" "}
          condition is true
        </BlockLine>
        <BlockLine className="mt-1 w-[430px]">
          <SelectPill
            options={["Last Digit", "Total Profit", "Stake", "Run Count"]}
            value={settings.conditionLeft}
            onChange={(conditionLeft) => updateSettings({ conditionLeft })}
          />{" "}
          <SelectPill
            options={[">", "<", "=", "contains"]}
            value={settings.conditionOperator}
            onChange={(conditionOperator) => updateSettings({ conditionOperator })}
          />{" "}
          <TextPill
            value={settings.conditionRight}
            onChange={(conditionRight) => updateSettings({ conditionRight })}
          />
        </BlockLine>
        <NestedMini label="Last Digit >" settings={settings} updateSettings={updateSettings} />
        <NestedMini label="Last Digit <" settings={settings} updateSettings={updateSettings} />
      </div>
    </div>
  );
}

function FunctionStack({
  settings,
  updateSettings,
}: {
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div className="mt-8 w-[740px] space-y-10 text-[10px] text-[#242424]">
      <BlockLine className="w-[430px]">
        function <strong>Martingale Core Functionality</strong> with:
      </BlockLine>
      <BlockLine className="ml-0 w-[360px]">
        function <strong>Martingale Trade Amount ()</strong> multiplier{" "}
        <NumberPill
          min={1}
          step={0.1}
          value={settings.martingale}
          onChange={(martingale) => updateSettings({ martingale })}
        />
      </BlockLine>
      <BlockLine className="ml-0 w-[330px]">
        function <strong>marketwizard v1.5 ()</strong> max runs{" "}
        <NumberPill
          min={1}
          step={1}
          value={settings.maxRuns}
          onChange={(maxRuns) => updateSettings({ maxRuns })}
        />
      </BlockLine>
      <div id="restart" className="space-y-2 rounded-[3px] bg-[#ededed] p-3">
        <BlockLine className="w-[650px]">
          function <strong>Martingale Trade Again After Purchase</strong> with: martingale:profit,
          martingale:resultIsWin <RoundPlus />
        </BlockLine>
        <BlockLine className="ml-6 w-[410px]">
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
        <BlockLine className="ml-6 w-[330px]">
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
    </div>
  );
}

function GreenHeader({
  className,
  title,
  width,
}: {
  className?: string;
  title: string;
  width: string;
}) {
  return (
    <div
      className={cn(
        "flex h-[28px] items-center rounded-t-[3px] bg-[#075773] px-3 text-xs font-bold text-white",
        width,
        className,
      )}
    >
      {title}
    </div>
  );
}

function BlockLine({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex min-h-[26px] items-center gap-1 rounded-[3px] bg-[#eeeeee] px-2 shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SetLine({
  label,
  plus,
  value,
}: {
  label: string;
  plus?: boolean;
  value?: React.ReactNode;
}) {
  return (
    <BlockLine className="w-fit">
      set <Pill>{label}</Pill>
      {value && <>to {value}</>}
      {plus && <RoundPlus />}
    </BlockLine>
  );
}

function NestedMini({
  label,
  settings,
  updateSettings,
}: {
  label: string;
  settings: BotSettings;
  updateSettings: (patch: Partial<BotSettings>) => void;
}) {
  return (
    <div className="ml-8 mt-1 flex w-[220px] items-center justify-between rounded-[3px] bg-[#eeeeee] px-2 py-1">
      <span>{label}</span>
      <NumberPill
        min={0}
        step={1}
        value={settings.selectedDigit}
        onChange={(selectedDigit) => updateSettings({ selectedDigit })}
      />
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-full border border-[#d8d8d8] bg-white px-2 text-[10px] shadow-sm">
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
    <span className="inline-flex h-[22px] items-center rounded-full border border-[#d8d8d8] bg-white px-1 text-[10px] shadow-sm">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[160px] bg-transparent px-1 text-[10px] font-medium outline-none"
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
      className="h-[22px] w-[58px] rounded-full border border-[#d8d8d8] bg-white px-2 text-right text-[10px] font-medium shadow-sm outline-none"
    />
  );
}

function TextPill({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-[22px] w-[70px] rounded-full border border-[#d8d8d8] bg-white px-2 text-[10px] font-medium shadow-sm outline-none"
    />
  );
}

function TinySquare({
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
      className="inline-flex size-4 items-center justify-center rounded-[2px] bg-white text-[10px]"
    >
      {checked ? "x" : ""}
    </button>
  );
}

function RoundPlus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white">
      +
    </span>
  );
}

function RoundMinus() {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-[#333] text-[11px] font-bold text-white">
      -
    </span>
  );
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
  return {
    ...settings,
    ...patch,
    duration: Math.max(1, Math.round(Number(settings.duration) || 1)),
    martingale: clampNumber(settings.martingale, 1, 100),
    maxRuns: Math.max(1, Math.round(Number(settings.maxRuns) || 1)),
    maxStake: clampNumber(settings.maxStake, 0.35, 50000),
    selectedDigit: Math.max(0, Math.min(9, Math.round(Number(settings.selectedDigit) || 0))),
    stake: clampNumber(settings.stake, 0.35, 50000),
    stopLoss: Math.max(0, Number(settings.stopLoss) || 0),
    takeProfit: Math.max(0, Number(settings.takeProfit) || 0),
  };
}

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

async function waitForSettlement(contractId: string): Promise<Settlement> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => Promise<void>) | undefined;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ payout: 0, profit: 0, status: "open" });
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
      const profit = Number(contract.profit ?? 0);
      const payout = Number(contract.payout ?? contract.sell_price ?? contract.bid_price ?? 0);
      resolve({
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

function clampNumber(value: number, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function formatMoney(value: number, currency = "USD") {
  return `${Number(value).toFixed(2)} ${currency}`;
}

function formatTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
