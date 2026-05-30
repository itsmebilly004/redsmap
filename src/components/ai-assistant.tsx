import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { BrainCircuit, Info, Play, RefreshCw, Rocket, Sparkles, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { useBotRunner } from "@/context/bot-runner-context";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import {
  persistAssistantButtonPosition,
  readActivityMemory,
  readAssistantButtonPosition,
  readBotMonitorSnapshot,
  readRememberedMarket,
  readTrackedTrades,
  recordActivity,
  recordBotPresetActivity,
} from "@/lib/activity-memory";
import { readSavedBotPresets } from "@/lib/bot-builder-state";
import { deployBotFromAiSuggestion } from "@/lib/bot-builder-memory";
import {
  analyzeBestBotOpportunities,
  analyzeBestMarketForContract,
  analyzeDigitsForSymbol,
  recommendStakeAndMartingale,
  type BotOpportunity,
  type DigitMarketAnalysis,
  type ManualContractKind,
  type ManualMarketSuggestion,
  type StakeRecommendation,
} from "@/lib/market-analysis";
import { setManualTradePickup } from "@/lib/manual-trade-pickup";
import { cn } from "@/lib/utils";

type AssistantView = "best-bot" | "manual" | "memory";

const MANUAL_CONTRACT_OPTIONS: { kind: ManualContractKind; label: string; description: string }[] = [
  { kind: "even_odd", label: "Even / Odd", description: "Last digit of the exit spot." },
  { kind: "over_under", label: "Over / Under", description: "Last digit above or below a threshold." },
  { kind: "matches_differs", label: "Matches / Differs", description: "Last digit equals (or doesn't) a number." },
  { kind: "rise_fall", label: "Rise / Fall", description: "Will the price end higher or lower." },
];

const ASSISTANT_BUTTON_SIZE_DESKTOP = 56;
const ASSISTANT_BUTTON_SIZE_MOBILE = 40;

/** Run-loop inputs the user fills in BEFORE launching the bot market scan. */
type BotScanInputs = {
  stake: string;
  stopLoss: string;
  takeProfit: string;
  martingale: string;
  maxRuns: string;
};

/** Manual-trade inputs — same as the bot, minus martingale and number of runs. */
type ManualScanInputs = {
  stake: string;
  stopLoss: string;
  takeProfit: string;
};

const DEFAULT_BOT_INPUTS: BotScanInputs = {
  stake: "1",
  stopLoss: "30",
  takeProfit: "100",
  martingale: "2",
  maxRuns: "50",
};

const DEFAULT_MANUAL_INPUTS: ManualScanInputs = {
  stake: "1",
  stopLoss: "10",
  takeProfit: "20",
};

type ParsedBotSettings = {
  stake: number;
  stopLoss: number;
  takeProfit: number;
  martingale: number;
  maxRuns: number;
};

type ParsedManualSettings = {
  stake: number;
  stopLoss: number;
  takeProfit: number;
};

function parsePositive(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseNonNegative(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

/** Validate the bot inputs; returns the parsed settings or a human error string. */
function parseBotInputs(inputs: BotScanInputs): { settings: ParsedBotSettings } | { error: string } {
  const stake = parsePositive(inputs.stake);
  if (stake == null || stake < 0.35) return { error: "Enter a stake of at least 0.35." };
  const martingale = parsePositive(inputs.martingale);
  if (martingale == null || martingale < 1)
    return { error: "Martingale must be 1 or greater (1 = no martingale)." };
  const maxRuns = parsePositive(inputs.maxRuns);
  if (maxRuns == null) return { error: "Enter the number of runs (1 or more)." };
  const stopLoss = parseNonNegative(inputs.stopLoss);
  if (stopLoss == null) return { error: "Stop loss must be 0 or a positive amount." };
  const takeProfit = parseNonNegative(inputs.takeProfit);
  if (takeProfit == null) return { error: "Take profit must be 0 or a positive amount." };
  return {
    settings: {
      stake: Math.round(stake * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
      martingale: Math.round(martingale * 100) / 100,
      maxRuns: Math.max(1, Math.round(maxRuns)),
    },
  };
}

/** Validate the manual inputs; returns the parsed settings or a human error string. */
function parseManualInputs(
  inputs: ManualScanInputs,
): { settings: ParsedManualSettings } | { error: string } {
  const stake = parsePositive(inputs.stake);
  if (stake == null || stake < 0.35) return { error: "Enter a stake of at least 0.35." };
  const stopLoss = parseNonNegative(inputs.stopLoss);
  if (stopLoss == null) return { error: "Stop loss must be 0 or a positive amount." };
  const takeProfit = parseNonNegative(inputs.takeProfit);
  if (takeProfit == null) return { error: "Take profit must be 0 or a positive amount." };
  return {
    settings: {
      stake: Math.round(stake * 100) / 100,
      stopLoss: Math.round(stopLoss * 100) / 100,
      takeProfit: Math.round(takeProfit * 100) / 100,
    },
  };
}

export function AiAssistant({
  currentPath,
  showBotMonitor,
}: {
  currentPath: string;
  showBotMonitor: boolean;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { balance, currency } = useDerivBalanceContext();
  const { toggleRun } = useBotRunner();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<AssistantView>("best-bot");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [viewport, setViewport] = useState(() => readViewport());
  const [digitAnalysis, setDigitAnalysis] = useState<DigitMarketAnalysis | null>(null);
  const [botOpportunities, setBotOpportunities] = useState<BotOpportunity[]>([]);
  const [manualKind, setManualKind] = useState<ManualContractKind | null>(null);
  const [manualSuggestions, setManualSuggestions] = useState<ManualMarketSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [lastAnalysisAt, setLastAnalysisAt] = useState<Date | null>(null);
  // User-entered run-loop settings, captured BEFORE the AI market scan. The scan
  // is gated behind these being armed so the recommendation is sized to the
  // user's own stake/risk, then carried into the deploy / manual handoff.
  const [botInputs, setBotInputs] = useState<BotScanInputs>(DEFAULT_BOT_INPUTS);
  const [manualInputs, setManualInputs] = useState<ManualScanInputs>(DEFAULT_MANUAL_INPUTS);
  const [botScanArmed, setBotScanArmed] = useState(false);
  const [manualScanArmed, setManualScanArmed] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const dragRef = useRef<{
    moved: boolean;
    originX: number;
    originY: number;
    pointerId: number;
    startX: number;
    startY: number;
  } | null>(null);

  const buttonSize = viewport.width < 640 ? ASSISTANT_BUTTON_SIZE_MOBILE : ASSISTANT_BUTTON_SIZE_DESKTOP;
  const activeScope = scopeFromPath(currentPath);
  const currentMarket =
    readRememberedMarket(user?.id, activeScope, readRememberedMarket(user?.id, "manual", "1HZ100V") ?? "1HZ100V") ??
    "1HZ100V";
  const memorySnapshot = useMemo(() => readActivityMemory(user?.id), [open, refreshKey, user?.id]);
  const trades = useMemo(() => readTrackedTrades(user?.id).slice(0, 6), [open, refreshKey, user?.id]);
  const savedPresets = useMemo(() => readSavedBotPresets(user?.id), [open, refreshKey, user?.id]);
  const botMonitorSnapshot = useMemo(() => readBotMonitorSnapshot(user?.id), [open, refreshKey, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncViewport = () => {
      setViewport(readViewport());
    };
    syncViewport();
    window.addEventListener("resize", syncViewport, { passive: true });
    window.addEventListener("orientationchange", syncViewport);
    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored =
      readAssistantButtonPosition(user?.id) ?? defaultButtonPosition(viewport, showBotMonitor);
    setPosition(clampPosition(stored, viewport, buttonSize));
  }, [buttonSize, showBotMonitor, user?.id, viewport]);

  useEffect(() => {
    if (!open) return;
    if (view === "memory") return;
    // The scan only runs once the user has entered their settings and pressed
    // "Run AI Market Scan" (and, for manual, picked a contract family).
    if (view === "best-bot" && !botScanArmed) return;
    if (view === "manual" && (!manualKind || !manualScanArmed)) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run =
      view === "best-bot"
        ? analyzeBestBotOpportunities().then((result) => {
            if (cancelled) return;
            setBotOpportunities(result);
            recordActivity(user?.id, {
              message: `Ran AI bot scan across ${result.length} presets.`,
              meta: { view, market: currentMarket },
              type: "assistant",
            });
          })
        : analyzeBestMarketForContract(manualKind!).then((result) => {
            if (cancelled) return;
            setManualSuggestions(result);
            // Stash a digit analysis for the chosen market so the digit-heatmap
            // card still renders for digit-style contracts.
            if (manualKind !== "rise_fall" && result[0]?.symbol) {
              analyzeDigitsForSymbol(result[0].symbol)
                .then((digit) => {
                  if (!cancelled) setDigitAnalysis(digit);
                })
                .catch(() => {});
            } else {
              setDigitAnalysis(null);
            }
            recordActivity(user?.id, {
              message: `Ran AI manual scan for ${manualKind}.`,
              meta: { kind: manualKind, view },
              type: "assistant",
            });
          });

    run
      .then(() => {
        if (!cancelled) setLastAnalysisAt(new Date());
      })
      .catch((analysisError) => {
        if (cancelled) return;
        setError(
          analysisError instanceof Error
            ? analysisError.message
            : "The market analysis could not be completed.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [botScanArmed, currentMarket, manualKind, manualScanArmed, open, refreshKey, user?.id, view]);

  const panelStyle = useMemo(() => {
    const panelWidth = Math.min(viewport.width - 16, viewport.width < 640 ? 340 : 380);
    const panelHeight = Math.min(viewport.height - 88, viewport.width < 640 ? 520 : 560);
    const anchor = position ?? defaultButtonPosition(viewport, showBotMonitor);
    return {
      height: panelHeight,
      left: clampNumber(anchor.x + buttonSize - panelWidth, 8, viewport.width - panelWidth - 8),
      top: clampNumber(anchor.y - panelHeight - 12, 64, viewport.height - panelHeight - 8),
      width: panelWidth,
    };
  }, [buttonSize, position, showBotMonitor, viewport]);

  function toggleOpen() {
    setOpen((value) => !value);
    setRefreshKey((value) => value + 1);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    dragRef.current = {
      moved: false,
      originX: position?.x ?? defaultButtonPosition(viewport, showBotMonitor).x,
      originY: position?.y ?? defaultButtonPosition(viewport, showBotMonitor).y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }
    const next = clampPosition(
      { x: drag.originX + deltaX, y: drag.originY + deltaY },
      viewport,
      buttonSize,
    );
    setPosition(next);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    if (position) {
      persistAssistantButtonPosition(user?.id, position);
    }
    if (!drag.moved) toggleOpen();
  }

  const bestBot = botOpportunities.find((item) => item.launchable) ?? botOpportunities[0] ?? null;

  // Parsed + validated user inputs. The launch uses these directly; the AI's
  // own risk-sizing (below) is shown only as guidance.
  const parsedBot = useMemo(() => parseBotInputs(botInputs), [botInputs]);
  const parsedManual = useMemo(() => parseManualInputs(manualInputs), [manualInputs]);

  const stakeRecommendation: StakeRecommendation | null = useMemo(() => {
    if (!bestBot) return null;
    return recommendStakeAndMartingale({
      balance,
      presetMartingale: bestBot.presetMartingale,
      presetMartingaleMode: bestBot.presetMartingaleMode,
      presetStake: bestBot.presetStake,
    });
  }, [balance, bestBot]);

  function handleRunBotScan() {
    if ("error" in parsedBot) {
      setInputError(parsedBot.error);
      return;
    }
    setInputError(null);
    setBotScanArmed(true);
    setRefreshKey((value) => value + 1);
  }

  function handleEditBotInputs() {
    setBotScanArmed(false);
    setBotOpportunities([]);
    setError(null);
  }

  async function handleLaunchBestBot() {
    if (!bestBot || !user?.id) {
      if (!user?.id) {
        toast.error("Sign in to deploy a bot.");
        navigate({ to: "/auth", search: { mode: "signin" } });
      }
      return;
    }
    if (!bestBot.launchable) {
      toast.error("This bot isn't registered as a deployable preset.");
      return;
    }
    if ("error" in parsedBot) {
      setInputError(parsedBot.error);
      return;
    }
    const settings = parsedBot.settings;
    setLaunching(true);
    try {
      await deployBotFromAiSuggestion({
        martingale: settings.martingale,
        maxRuns: settings.maxRuns,
        presetId: bestBot.presetId,
        stake: settings.stake,
        stopLoss: settings.stopLoss,
        takeProfit: settings.takeProfit,
        userId: user.id,
      });
      recordBotPresetActivity(user.id, "deployed", bestBot.name, bestBot.presetId);
      recordActivity(user.id, {
        message: `AI launched ${bestBot.name} on ${bestBot.marketLabel} — stake ${settings.stake.toFixed(2)}, martingale ${settings.martingale}×, ${settings.maxRuns} runs.`,
        meta: {
          martingale: settings.martingale,
          maxRuns: settings.maxRuns,
          presetId: bestBot.presetId,
          stake: settings.stake,
          stopLoss: settings.stopLoss,
          takeProfit: settings.takeProfit,
        },
        type: "assistant",
      });
      toast.success(`Deployed ${bestBot.name} — auto-running on ${bestBot.marketLabel}.`);
      setOpen(false);
      navigate({ to: "/bot-builder" });
      // Auto-start the run once the deploy is persisted. The run loop lives in the
      // root BotRunnerProvider (survives navigation); the brief delay lets the
      // bot-builder workspace mount so block highlighting tracks the live run.
      window.setTimeout(() => {
        toggleRun();
      }, 600);
    } catch (launchError) {
      const message =
        launchError instanceof Error ? launchError.message : "Could not launch this bot.";
      toast.error(message);
    } finally {
      setLaunching(false);
    }
  }

  function handleRerun() {
    setRefreshKey((value) => value + 1);
  }

  function handleManualKindChange(kind: ManualContractKind | null) {
    setManualKind(kind);
    setManualSuggestions([]);
    setDigitAnalysis(null);
    setError(null);
    // Re-arm required: the user must press scan again after switching family.
    setManualScanArmed(false);
  }

  function handleRunManualScan() {
    if (!manualKind) {
      setInputError("Pick a contract type to scan.");
      return;
    }
    if ("error" in parsedManual) {
      setInputError(parsedManual.error);
      return;
    }
    setInputError(null);
    setManualScanArmed(true);
    setRefreshKey((value) => value + 1);
  }

  function handleEditManualInputs() {
    setManualScanArmed(false);
    setManualSuggestions([]);
    setDigitAnalysis(null);
    setError(null);
  }

  const topManualSuggestion = manualSuggestions[0] ?? null;

  function handleLaunchManualTrader() {
    if (!topManualSuggestion || !manualKind) return;
    if ("error" in parsedManual) {
      setInputError(parsedManual.error);
      return;
    }
    const settings = parsedManual.settings;
    // Resolve the AI's suggested side into the concrete trade-panel side value
    // (+ prediction digit) so the manual trader can auto-fire the trade.
    const resolved = resolveManualSide(manualKind, topManualSuggestion.side);
    setManualTradePickup({
      autoRun: true,
      predictionDigit: resolved.predictionDigit,
      side: resolved.side,
      stake: settings.stake,
      stopLoss: settings.stopLoss,
      symbol: topManualSuggestion.symbol,
      takeProfit: settings.takeProfit,
      tradeType: manualKind,
    });
    recordActivity(user?.id, {
      message: `AI auto-trade handoff to manual trader: ${topManualSuggestion.side} on ${topManualSuggestion.symbol} @ ${settings.stake.toFixed(2)} ${currency || "USD"} (TP ${settings.takeProfit}, SL ${settings.stopLoss}).`,
      meta: {
        kind: manualKind,
        predictionDigit: resolved.predictionDigit ?? null,
        side: resolved.side,
        stake: settings.stake,
        stopLoss: settings.stopLoss,
        symbol: topManualSuggestion.symbol,
        takeProfit: settings.takeProfit,
      },
      type: "assistant",
    });
    setOpen(false);
    navigate({ to: "/" });
  }

  return (
    <>
      {open && (
        <aside
          className="fixed z-50 overflow-hidden rounded-2xl border border-[#d7dce0] bg-white shadow-2xl dark:border-[#2a2f35] dark:bg-[#101214]"
          style={panelStyle}
        >
          <div className="flex items-center justify-between border-b border-[#e7eaee] px-4 py-3 dark:border-[#24282d]">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-bold">
                <BrainCircuit className="size-4 text-[#4bb4b3]" />
                <span className="truncate">AI Market Assistant</span>
              </div>
              <div className="truncate text-[11px] text-[#6b7280] dark:text-[#aab1b8]">
                {lastAnalysisAt
                  ? `Updated ${lastAnalysisAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} · ${currentMarket}`
                  : `Current market: ${currentMarket}`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRefreshKey((value) => value + 1)}
                className="flex size-8 items-center justify-center rounded-full border border-[#d7dce0] text-[#51606c] transition hover:bg-[#f5f7f8] dark:border-[#2a2f35] dark:text-[#c9d0d7] dark:hover:bg-[#171a1d]"
                aria-label="Refresh AI analysis"
              >
                <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex size-8 items-center justify-center rounded-full border border-[#d7dce0] text-[#51606c] transition hover:bg-[#f5f7f8] dark:border-[#2a2f35] dark:text-[#c9d0d7] dark:hover:bg-[#171a1d]"
                aria-label="Close AI assistant"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-[#e7eaee] px-3 py-2 dark:border-[#24282d]">
            {([
              ["best-bot", "Best Bot"],
              ["manual", "Manual Trader"],
              ["memory", "Memory"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  view === value
                    ? "bg-[#4bb4b3] text-white"
                    : "bg-[#eef2f4] text-[#42505b] hover:bg-[#e4eaee] dark:bg-[#171a1d] dark:text-[#d4dbe2] dark:hover:bg-[#1f2428]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-[calc(100%-7.25rem)] overflow-y-auto px-4 py-4 text-sm">
            {loading && <AssistantInfoCard title="Running analysis">Pulling the latest 500 ticks across every synthetic market for the recommendation.</AssistantInfoCard>}
            {!loading && error && <AssistantInfoCard tone="error" title="Analysis failed">{error}</AssistantInfoCard>}

            {/* Step 1 (Best Bot): capture the user's run-loop settings BEFORE the scan. */}
            {view === "best-bot" && !botScanArmed && (
              <BotScanForm
                currency={currency}
                error={inputError}
                inputs={botInputs}
                onChange={setBotInputs}
                onScan={handleRunBotScan}
              />
            )}

            {!loading && !error && view === "best-bot" && botScanArmed && bestBot && (
              <div className="space-y-3">
                <YourSettingsCard
                  onEdit={handleEditBotInputs}
                  rows={[
                    ["Stake", `${botInputs.stake} ${currency || "USD"}`],
                    ["Martingale", `${botInputs.martingale}×`],
                    ["Take profit", `${botInputs.takeProfit} ${currency || "USD"}`],
                    ["Stop loss", `${botInputs.stopLoss} ${currency || "USD"}`],
                    ["Number of runs", botInputs.maxRuns],
                  ]}
                />

                <AssistantInfoCard title={`Top pick: ${bestBot.name}`}>
                  Strongest empirical edge right now on <strong>{bestBot.marketLabel}</strong>. Win rate
                  in the last 500 ticks: <strong>{bestBot.actualProbability.toFixed(1)}%</strong> vs. a
                  uniform expectation of <strong>{bestBot.expectedProbability.toFixed(1)}%</strong> (edge{" "}
                  <strong className={bestBot.edge >= 0 ? "text-[#078a5b]" : "text-[#cc2f39]"}>
                    {signedPercent(bestBot.edge)}
                  </strong>
                  ).
                </AssistantInfoCard>

                {stakeRecommendation && (
                  <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                      AI guidance (for reference — your settings above are used)
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                      <RecommendationStat
                        label="Stake"
                        value={`${stakeRecommendation.stake.toFixed(2)} ${currency || "USD"}`}
                      />
                      <RecommendationStat
                        label="Martingale"
                        value={`${stakeRecommendation.martingale.toFixed(2)}×`}
                      />
                      <RecommendationStat
                        label="Risk band"
                        value={capitalize(stakeRecommendation.riskBand)}
                      />
                      <RecommendationStat
                        label={`Worst-case (${stakeRecommendation.worstCaseLossStreak} losses)`}
                        value={`-${stakeRecommendation.worstCaseLoss.toFixed(2)} ${currency || "USD"}`}
                        valueClassName="text-[#cc2f39]"
                      />
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-[#62707c] dark:text-[#aab1b8]">
                      {stakeRecommendation.rationale}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLaunchBestBot()}
                    disabled={!bestBot.launchable || launching || !user?.id}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white shadow transition",
                      bestBot.launchable && user?.id
                        ? "bg-[#4bb4b3] hover:bg-[#3aa19f]"
                        : "bg-[#9ca3af] cursor-not-allowed",
                      launching && "opacity-70",
                    )}
                  >
                    <Rocket className="size-4" />
                    {launching
                      ? "Launching..."
                      : !user?.id
                        ? "Sign in to launch"
                        : !bestBot.launchable
                          ? "Not deployable"
                          : `Launch & auto-run on ${bestBot.marketLabel}`}
                  </button>
                  <button
                    type="button"
                    onClick={handleRerun}
                    disabled={loading}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d7dce0] bg-white px-3 py-2.5 text-sm font-semibold text-[#42505b] transition hover:bg-[#f5f7f8] dark:border-[#2a2f35] dark:bg-[#101214] dark:text-[#d4dbe2] dark:hover:bg-[#171a1d]"
                  >
                    <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                    Rerun
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                    Other ranked bots
                  </div>
                  {botOpportunities.slice(0, 4).map((item) => (
                    <div
                      key={item.presetId}
                      className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-semibold">{item.name}</div>
                        {!item.launchable && (
                          <span className="rounded-full bg-[#fff7e0] px-2 py-0.5 text-[10px] font-bold text-[#a36b00] dark:bg-[#3a2a00] dark:text-[#ffd166]">
                            Not deployable
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#62707c] dark:text-[#aab1b8]">
                        {item.marketLabel} · {item.tradeType.replace("_", " ")} / {item.contractType}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs">
                        <span>Actual {item.actualProbability.toFixed(1)}%</span>
                        <span>Expected {item.expectedProbability.toFixed(1)}%</span>
                        <span className={item.edge >= 0 ? "text-[#078a5b]" : "text-[#cc2f39]"}>
                          Edge {signedPercent(item.edge)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <AccuracyDisclaimer />
              </div>
            )}

            {/* Step 1 (Manual): pick a contract family + enter settings, then scan. */}
            {view === "manual" && !manualScanArmed && (
              <div className="space-y-3">
                <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                    Step 1 · What do you want to trade?
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {MANUAL_CONTRACT_OPTIONS.map((option) => (
                      <button
                        key={option.kind}
                        type="button"
                        onClick={() => handleManualKindChange(option.kind)}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-left text-xs transition",
                          manualKind === option.kind
                            ? "border-[#4bb4b3] bg-[#e6f8f7] text-[#087a78] dark:border-[#4bb4b3] dark:bg-[#103536] dark:text-[#8be6e4]"
                            : "border-[#d7dce0] bg-white text-[#41515d] hover:bg-[#f5f7f8] dark:border-[#2a2f35] dark:bg-[#101214] dark:text-[#d4dbe2] dark:hover:bg-[#171a1d]",
                        )}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-0.5 text-[11px] opacity-80">{option.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <ManualScanForm
                  canScan={Boolean(manualKind)}
                  currency={currency}
                  error={inputError}
                  inputs={manualInputs}
                  onChange={setManualInputs}
                  onScan={handleRunManualScan}
                />
              </div>
            )}

            {!loading && !error && view === "manual" && manualScanArmed && (
              <div className="space-y-3">
                {manualKind && manualSuggestions.length > 0 && (
                  <>
                    <YourSettingsCard
                      onEdit={handleEditManualInputs}
                      rows={[
                        ["Stake", `${manualInputs.stake} ${currency || "USD"}`],
                        ["Take profit", `${manualInputs.takeProfit} ${currency || "USD"}`],
                        ["Stop loss", `${manualInputs.stopLoss} ${currency || "USD"}`],
                      ]}
                    />

                    <AssistantInfoCard title={`Best market right now`}>
                      For <strong>{labelForKind(manualKind)}</strong>, the strongest setup is{" "}
                      <strong>{manualSuggestions[0].side}</strong> on{" "}
                      <strong>{manualSuggestions[0].marketLabel}</strong>. Empirical hit-rate{" "}
                      <strong>{manualSuggestions[0].probability.toFixed(1)}%</strong> vs. uniform{" "}
                      <strong>{manualSuggestions[0].expected.toFixed(1)}%</strong> (edge{" "}
                      <strong
                        className={
                          manualSuggestions[0].edge >= 0 ? "text-[#078a5b]" : "text-[#cc2f39]"
                        }
                      >
                        {signedPercent(manualSuggestions[0].edge)}
                      </strong>
                      ).
                    </AssistantInfoCard>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleRerun}
                        disabled={loading}
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-[#d7dce0] bg-white px-3 py-2.5 text-sm font-semibold text-[#42505b] transition hover:bg-[#f5f7f8] dark:border-[#2a2f35] dark:bg-[#101214] dark:text-[#d4dbe2] dark:hover:bg-[#171a1d]"
                      >
                        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                        Rerun
                      </button>
                      <button
                        type="button"
                        onClick={handleLaunchManualTrader}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#4bb4b3] px-3 py-2.5 text-sm font-bold text-white shadow transition hover:bg-[#3aa19f]"
                      >
                        <Play className="size-4" />
                        Launch &amp; auto-trade
                      </button>
                    </div>
                    <p className="text-[11px] leading-5 text-[#62707c] dark:text-[#aab1b8]">
                      Launch opens the manual trader with your stake, take-profit and stop-loss
                      pre-filled on {manualSuggestions[0].marketLabel}, then places one trade
                      automatically on the AI-picked side. Re-launch (or tap a buy button) for the
                      next trade.
                    </p>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                        Ranked markets
                      </div>
                      {manualSuggestions.slice(0, 6).map((item) => (
                        <div
                          key={item.symbol}
                          className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                            <span>{item.marketLabel}</span>
                            <span className="text-xs font-bold text-[#4bb4b3]">{item.side}</span>
                          </div>
                          <div className="mt-1 text-[11px] leading-5 text-[#62707c] dark:text-[#aab1b8]">
                            {item.detail}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                            <span>Actual {item.probability.toFixed(1)}%</span>
                            <span>Expected {item.expected.toFixed(1)}%</span>
                            <span className={item.edge >= 0 ? "text-[#078a5b]" : "text-[#cc2f39]"}>
                              Edge {signedPercent(item.edge)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {digitAnalysis && manualKind !== "rise_fall" && (
                      <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
                        <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                          Digit heatmap · {digitAnalysis.marketLabel}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {digitAnalysis.percentages.map((pct, digit) => (
                            <span
                              key={digit}
                              className={cn(
                                "rounded-full border px-2.5 py-1 text-xs font-semibold",
                                digitAnalysis.hottestDigits.includes(digit)
                                  ? "border-[#4bb4b3] bg-[#e6f8f7] text-[#087a78] dark:border-[#4bb4b3] dark:bg-[#103536] dark:text-[#8be6e4]"
                                  : "border-[#d7dce0] bg-white text-[#41515d] dark:border-[#2a2f35] dark:bg-[#101214] dark:text-[#d4dbe2]",
                              )}
                            >
                              {digit}: {pct.toFixed(1)}%
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 text-xs text-[#62707c] dark:text-[#aab1b8]">
                          Sample size {digitAnalysis.sampleSize}. Latest digit{" "}
                          {digitAnalysis.latestDigit ?? "-"}.
                        </div>
                      </div>
                    )}

                    <AccuracyDisclaimer />
                  </>
                )}
              </div>
            )}

            {!loading && !error && view === "memory" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <MemoryCard label="Current market" value={currentMarket} />
                  <MemoryCard label="Saved bot presets" value={savedPresets.length} />
                  <MemoryCard label="Tracked trades" value={trades.length} />
                  <MemoryCard
                    label="Bot monitor P/L"
                    value={
                      botMonitorSnapshot
                        ? `${botMonitorSnapshot.stats.totalProfitLoss.toFixed(2)}`
                        : "0.00"
                    }
                    valueClassName={
                      (botMonitorSnapshot?.stats.totalProfitLoss ?? 0) >= 0
                        ? "text-[#078a5b]"
                        : "text-[#cc2f39]"
                    }
                  />
                </div>

                <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                    Recent trade memory
                  </div>
                  <div className="mt-2 space-y-2">
                    {trades.length === 0 && <div className="text-xs text-[#62707c] dark:text-[#aab1b8]">No tracked trades yet.</div>}
                    {trades.map((trade) => (
                      <div key={trade.id} className="rounded-lg border border-[#e7eaee] bg-white px-3 py-2 text-xs dark:border-[#24282d] dark:bg-[#101214]">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{trade.market}</span>
                          <span
                            className={cn(
                              trade.status === "open" && "text-[#64707c] dark:text-[#aab1b8]",
                              trade.status === "won" && "text-[#078a5b]",
                              (trade.status === "lost" || trade.status === "sold") && "text-[#cc2f39]",
                            )}
                          >
                            {trade.status}
                          </span>
                        </div>
                        <div className="mt-1 text-[#62707c] dark:text-[#aab1b8]">
                          {trade.source} · {trade.contractType} · {trade.stake.toFixed(2)} {trade.currency}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
                    Recent activity
                  </div>
                  <div className="mt-2 space-y-2">
                    {memorySnapshot.activities.length === 0 && (
                      <div className="text-xs text-[#62707c] dark:text-[#aab1b8]">No saved activity yet.</div>
                    )}
                    {memorySnapshot.activities.slice(0, 6).map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-lg border border-[#e7eaee] bg-white px-3 py-2 text-xs dark:border-[#24282d] dark:bg-[#101214]"
                      >
                        <div className="font-medium">{activity.message}</div>
                        <div className="mt-1 text-[#62707c] dark:text-[#aab1b8]">
                          {new Date(activity.time).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}

      {position && (
        <button
          aria-label="AI assistant"
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ left: position.x, top: position.y, touchAction: "none" }}
          className="fixed z-50 flex items-center justify-center rounded-full bg-gradient-to-br from-[#0f766e] to-[#0f172a] text-white shadow-lg transition-transform hover:scale-105"
        >
          <div
            className={cn(
              "relative flex items-center justify-center rounded-full",
              buttonSize === ASSISTANT_BUTTON_SIZE_MOBILE ? "size-10" : "size-14",
            )}
          >
            <Sparkles className={buttonSize === ASSISTANT_BUTTON_SIZE_MOBILE ? "size-4" : "size-5"} />
            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-white bg-[#4bb4b3]" />
            <span
              className={cn(
                "absolute -bottom-1 font-bold",
                buttonSize === ASSISTANT_BUTTON_SIZE_MOBILE ? "text-[8px]" : "text-[10px]",
              )}
            >
              AI
            </span>
          </div>
        </button>
      )}
    </>
  );
}

function AssistantInfoCard({
  children,
  title,
  tone = "default",
}: {
  children: ReactNode;
  title: string;
  tone?: "default" | "error";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-sm",
        tone === "error"
          ? "border-[#ffd4d7] bg-[#fff4f5] text-[#a52a34] dark:border-[#4a2025] dark:bg-[#221316] dark:text-[#ff98a1]"
          : "border-[#d8e7e6] bg-[#eef9f8] text-[#245a58] dark:border-[#1f403f] dark:bg-[#102726] dark:text-[#9ee5e3]",
      )}
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 leading-6">{children}</div>
    </div>
  );
}

function RecommendationStat({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-bold text-[#172029] dark:text-[#f1f5f9]", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function NumberField({
  label,
  suffix,
  value,
  onChange,
  step = "any",
  min = "0",
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  min?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
        {label}
      </span>
      <div className="mt-1 flex items-center rounded-lg border border-[#d7dce0] bg-white px-2 focus-within:border-[#4bb4b3] dark:border-[#2a2f35] dark:bg-[#101214]">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent py-2 text-sm font-semibold text-[#172029] outline-none dark:text-[#f1f5f9]"
        />
        {suffix && (
          <span className="pl-1 text-[10px] font-semibold text-[#8a949d] dark:text-[#7c858c]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function BotScanForm({
  currency,
  error,
  inputs,
  onChange,
  onScan,
}: {
  currency: string;
  error: string | null;
  inputs: BotScanInputs;
  onChange: (next: BotScanInputs) => void;
  onScan: () => void;
}) {
  const cur = currency || "USD";
  return (
    <div className="space-y-3">
      <AssistantInfoCard title="Step 1 · Set your bot parameters">
        Enter your stake, risk limits, martingale and number of runs. The AI scans for the best
        market + bot, applies these to the bot builder, and auto-runs it on launch.
      </AssistantInfoCard>
      <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Stake" suffix={cur} value={inputs.stake} onChange={(v) => onChange({ ...inputs, stake: v })} min="0.35" />
          <NumberField label="Martingale" suffix="×" value={inputs.martingale} onChange={(v) => onChange({ ...inputs, martingale: v })} min="1" />
          <NumberField label="Take profit" suffix={cur} value={inputs.takeProfit} onChange={(v) => onChange({ ...inputs, takeProfit: v })} />
          <NumberField label="Stop loss" suffix={cur} value={inputs.stopLoss} onChange={(v) => onChange({ ...inputs, stopLoss: v })} />
          <NumberField label="Number of runs" value={inputs.maxRuns} onChange={(v) => onChange({ ...inputs, maxRuns: v })} step="1" min="1" />
        </div>
        {error && <div className="mt-2 text-[11px] font-medium text-[#cc2f39]">{error}</div>}
      </div>
      <button
        type="button"
        onClick={onScan}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#4bb4b3] px-3 py-2.5 text-sm font-bold text-white shadow transition hover:bg-[#3aa19f]"
      >
        <BrainCircuit className="size-4" />
        Run AI Market Scan
      </button>
    </div>
  );
}

function ManualScanForm({
  canScan,
  currency,
  error,
  inputs,
  onChange,
  onScan,
}: {
  canScan: boolean;
  currency: string;
  error: string | null;
  inputs: ManualScanInputs;
  onChange: (next: ManualScanInputs) => void;
  onScan: () => void;
}) {
  const cur = currency || "USD";
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
          Step 2 · Set your trade parameters
        </div>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <NumberField label="Stake" suffix={cur} value={inputs.stake} onChange={(v) => onChange({ ...inputs, stake: v })} min="0.35" />
          <NumberField label="Take profit" suffix={cur} value={inputs.takeProfit} onChange={(v) => onChange({ ...inputs, takeProfit: v })} />
          <NumberField label="Stop loss" suffix={cur} value={inputs.stopLoss} onChange={(v) => onChange({ ...inputs, stopLoss: v })} />
        </div>
        {error && <div className="mt-2 text-[11px] font-medium text-[#cc2f39]">{error}</div>}
      </div>
      <button
        type="button"
        onClick={onScan}
        disabled={!canScan}
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white shadow transition",
          canScan ? "bg-[#4bb4b3] hover:bg-[#3aa19f]" : "bg-[#9ca3af] cursor-not-allowed",
        )}
      >
        <BrainCircuit className="size-4" />
        {canScan ? "Run AI Market Scan" : "Pick a contract type first"}
      </button>
    </div>
  );
}

function YourSettingsCard({
  onEdit,
  rows,
}: {
  onEdit: () => void;
  rows: [string, string | number][];
}) {
  return (
    <div className="rounded-xl border border-[#d8e7e6] bg-[#eef9f8] p-3 dark:border-[#1f403f] dark:bg-[#102726]">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#245a58] dark:text-[#9ee5e3]">
          Your settings (applied to the bot)
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-[#bfe0de] bg-white px-2 py-1 text-[10px] font-semibold text-[#247a77] transition hover:bg-[#e6f8f7] dark:border-[#2c4f4e] dark:bg-[#0c1e1d] dark:text-[#8be6e4]"
        >
          Edit
        </button>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {rows.map(([label, value]) => (
          <RecommendationStat key={label} label={label} value={String(value)} />
        ))}
      </div>
    </div>
  );
}

function AccuracyDisclaimer() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-[#e6deb1] bg-[#fff9e6] px-3 py-2 text-[11px] leading-5 text-[#7a5a00] dark:border-[#3a2f00] dark:bg-[#23200d] dark:text-[#f5d76e]">
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <div>
        Suggestions are statistical leans from the most recent 500 ticks. Deriv synthetic indices are
        RNG-driven — every digit converges to 10% and every coin flip to 50% over time. Treat this as
        a signal, not a guarantee. Trade only what you can afford to lose.
      </div>
    </div>
  );
}

function labelForKind(kind: ManualContractKind): string {
  return MANUAL_CONTRACT_OPTIONS.find((option) => option.kind === kind)?.label ?? kind;
}

/**
 * Translate a `ManualMarketSuggestion.side` label (e.g. "Over 5", "Differs 0",
 * "Rise") into the trade-panel side `value` and prediction digit so the manual
 * trader can auto-fire the exact trade the AI recommended.
 */
function resolveManualSide(
  kind: ManualContractKind,
  sideLabel: string,
): { predictionDigit?: number; side: string } {
  const normalized = sideLabel.trim().toLowerCase();
  const digitMatch = normalized.match(/(\d+)/);
  const predictionDigit = digitMatch ? Number(digitMatch[1]) : undefined;
  if (kind === "even_odd") {
    return { side: normalized.startsWith("odd") ? "odd" : "even" };
  }
  if (kind === "rise_fall") {
    return { side: normalized.startsWith("fall") ? "down" : "up" };
  }
  if (kind === "over_under") {
    return { predictionDigit, side: normalized.startsWith("under") ? "under" : "over" };
  }
  // matches_differs
  return { predictionDigit, side: normalized.startsWith("matches") ? "matches" : "differs" };
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MemoryCard({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: number | string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[#e7eaee] bg-[#f7f9fa] p-3 dark:border-[#24282d] dark:bg-[#141719]">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#64707c] dark:text-[#aab1b8]">
        {label}
      </div>
      <div className={cn("mt-2 text-sm font-bold text-[#172029] dark:text-[#f1f5f9]", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

function scopeFromPath(pathname: string) {
  if (pathname.startsWith("/analysis")) return "analysis" as const;
  if (pathname.startsWith("/charts")) return "charts" as const;
  if (pathname.startsWith("/bot-builder")) return "bot-builder" as const;
  return "manual" as const;
}

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function readViewport() {
  if (typeof window === "undefined") {
    return { height: 800, width: 1280 };
  }
  return { height: window.innerHeight, width: window.innerWidth };
}

function defaultButtonPosition(
  viewport: { height: number; width: number },
  showBotMonitor: boolean,
) {
  const size =
    viewport.width < 640 ? ASSISTANT_BUTTON_SIZE_MOBILE : ASSISTANT_BUTTON_SIZE_DESKTOP;
  return {
    x: viewport.width - size - 16,
    y: viewport.height - size - (showBotMonitor ? 84 : 16),
  };
}

function clampPosition(
  position: { x: number; y: number },
  viewport: { height: number; width: number },
  buttonSize: number,
) {
  return {
    x: clampNumber(position.x, 8, viewport.width - buttonSize - 8),
    y: clampNumber(position.y, 64, viewport.height - buttonSize - 8),
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
