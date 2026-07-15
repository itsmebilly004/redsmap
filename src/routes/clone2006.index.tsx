import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Maximize2, Minimize2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DerivChart } from "@/components/deriv-chart";
import { TopShell } from "@/components/top-shell";
import { TradePanel } from "@/components/trade-panel";
import { useAuth } from "@/hooks/use-auth";
import { readRememberedMarket, rememberMarketSelection } from "@/lib/activity-memory";
import {
  consumeManualTradePickup,
  MANUAL_TRADE_PICKUP_EVENT,
  type ManualTradePickup,
} from "@/lib/manual-trade-pickup";
import {
  DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE,
  recordDerivOAuthTrace,
  fetchTicks,
  type TradeCategory,
} from "@/lib/deriv";
import { isDigitTrade } from "@/lib/trade-types";
import { calculateDigitStats, digitsFromPrices } from "@/lib/digit-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/clone2006/")({
  head: () => ({
    meta: [
      { title: "ArkTrader Hub - Real-time Deriv Trading Platform (Clone)" },
      {
        name: "description",
        content:
          "Trade synthetic indices in real time with live Deriv charts, bots, analytics, and copy trading.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user } = useAuth();
  const [aiPickup, setAiPickup] = useState<ManualTradePickup | null>(() =>
    consumeManualTradePickup(),
  );
  const [pickupVersion, setPickupVersion] = useState(0);
  const [symbol, setSymbol] = useState(
    () =>
      aiPickup?.symbol ??
      readRememberedMarket(undefined, "manual", "1HZ100V") ??
      "1HZ100V",
  );
  const [tickPrices, setTickPrices] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTicks(symbol, 500)
      .then((ticks) => {
        if (!cancelled) {
          setTickPrices((prev) => {
            if (prev.length < 500) {
              return ticks.map((t) => t.value);
            }
            return prev;
          });
        }
      })
      .catch((err) => {
        console.warn("Failed to prefetch history for DCircles:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);
  const [price, setPrice] = useState<number | null>(null);
  const [tradeType, setTradeType] = useState<TradeCategory>(aiPickup?.tradeType ?? "accumulator");
  const [barriers, setBarriers] = useState<{
    breached?: boolean;
    entry: number | null;
    high: number | null;
    low: number | null;
    profit: number | null;
    profitCurrency?: string;
    profitStatus?: "active" | "lost" | "sold" | null;
  }>({
    entry: null,
    high: null,
    low: null,
    profit: null,
    profitStatus: null,
  });
  const lossOverlayTimerRef = useRef<number | null>(null);
  const barrierFlashTimerRef = useRef<number | null>(null);
  const breachedRef = useRef(false);
  const lossOverlayDismissedRef = useRef(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chartHeight = isMobile
    ? tradeType === "accumulator"
      ? 182
      : isDigitTrade(tradeType)
        ? 164
        : 172
    : 380;
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (aiPickup?.symbol) {
      rememberMarketSelection(user?.id, "manual", aiPickup.symbol);
      return;
    }
    const remembered = readRememberedMarket(user?.id, "manual");
    if (!remembered) return;
    setSymbol((current) => (current === remembered ? current : remembered));
  }, [aiPickup?.symbol, user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePickup = () => {
      const next = consumeManualTradePickup();
      if (!next) return;
      setAiPickup(next);
      setSymbol(next.symbol);
      setTradeType(next.tradeType);
      setTickPrices([]);
      rememberMarketSelection(user?.id, "manual", next.symbol);
      setPickupVersion((value) => value + 1);
    };
    window.addEventListener(MANUAL_TRADE_PICKUP_EVENT, handlePickup);
    return () => window.removeEventListener(MANUAL_TRADE_PICKUP_EVENT, handlePickup);
  }, [user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    return () => {
      if (lossOverlayTimerRef.current !== null) {
        window.clearTimeout(lossOverlayTimerRef.current);
      }
      if (barrierFlashTimerRef.current !== null) {
        window.clearTimeout(barrierFlashTimerRef.current);
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
    }
  }, []);

  const handleMarketChange = useCallback(
    (nextSymbol: string) => {
      setSymbol(nextSymbol);
      setTickPrices([]); 
      rememberMarketSelection(user?.id, "manual", nextSymbol);
    },
    [user?.id],
  );

  const handlePrice = useCallback((p: number | null) => {
    setPrice(p);
    if (p !== null) setTickPrices((prev) => [...prev.slice(-499), p]);
  }, []);

  const handleAccumulatorBarriers = useCallback(
    (next: {
      breached?: boolean;
      entry: number | null;
      high: number | null;
      low: number | null;
      profit?: number | null;
      profitCurrency?: string;
      profitStatus?: "active" | "lost" | "sold" | null;
    }) => {
      const nextStatus = next.profitStatus ?? null;
      const justBreached = Boolean(next.breached) && !breachedRef.current;
      breachedRef.current = Boolean(next.breached);

      if (nextStatus !== "lost" && lossOverlayTimerRef.current !== null) {
        window.clearTimeout(lossOverlayTimerRef.current);
        lossOverlayTimerRef.current = null;
      }
      if (nextStatus !== "lost") {
        lossOverlayDismissedRef.current = false;
      }

      if (justBreached) {
        if (barrierFlashTimerRef.current !== null) {
          window.clearTimeout(barrierFlashTimerRef.current);
        }
        barrierFlashTimerRef.current = window.setTimeout(() => {
          barrierFlashTimerRef.current = null;
          setBarriers((current) => ({ ...current, breached: false }));
        }, 1250);
      }

      if (nextStatus === "sold") {
        setBarriers((current) => ({
          ...current,
          ...next,
          breached: justBreached ? true : current.breached,
          profit: null,
          profitStatus: null,
        }));
        return;
      }

      const suppressLostOverlay = nextStatus === "lost" && lossOverlayDismissedRef.current;

      setBarriers((current) => ({
        ...current,
        ...next,
        breached: justBreached ? true : current.breached,
        profit: suppressLostOverlay ? null : (next.profit ?? null),
        profitStatus: suppressLostOverlay ? null : nextStatus,
      }));

      if (nextStatus === "lost" && !lossOverlayDismissedRef.current && lossOverlayTimerRef.current === null) {
        lossOverlayTimerRef.current = window.setTimeout(() => {
          lossOverlayTimerRef.current = null;
          lossOverlayDismissedRef.current = true;
          setBarriers((current) => ({ ...current, profit: null, profitStatus: null }));
        }, 2000);
      }
    },
    [],
  );

  return (
    <TopShell>
      {!isMobile && (
        <>
          <div
            className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]"
            style={{ height: "calc(100dvh - 12rem)" }}
          >
            <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[oklch(0.92_0.005_240)] bg-white p-3 dark:border-[#242424] dark:bg-[#151515]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Manual Trader (Simulated)</div>
                  <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)] dark:text-[#999999]">
                    {price !== null ? price.toFixed(4) : "-"}
                  </div>
                </div>
                <Link
                  to="/clone2006/admin"
                  className="rounded-md border border-red-500/30 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                >
                  Manage Balances
                </Link>
              </div>
              <div className="relative min-h-0 flex-1">
                <DerivChart
                  symbol={symbol}
                  onSymbolChange={handleMarketChange}
                  onPrice={handlePrice}
                  height={chartHeight}
                  entryPrice={barriers.entry}
                  highBarrier={barriers.high}
                  lowBarrier={barriers.low}
                  barrierBreached={barriers.breached}
                  accumulatorProfit={barriers.profit}
                  accumulatorProfitCurrency={barriers.profitCurrency}
                  accumulatorProfitStatus={barriers.profitStatus}
                  showDigitStats={isDigitTrade(tradeType)}
                  showSymbolSelector
                />
              </div>
              <p className="mt-2 text-xs text-[oklch(0.5_0.02_260)] dark:text-[#999999]">
                Simulated trades. Actual Deriv account connection is not used.
              </p>
            </section>
            <aside className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-y-auto bg-[oklch(0.97_0.003_240)] p-3 pb-3 dark:bg-[#0e0e0e]">
              <TradePanel
                key={`trade-panel-${pickupVersion}`}
                market={symbol}
                lastPrice={price}
                initialStake={aiPickup?.stake}
                initialTradeType={aiPickup?.tradeType}
                initialSide={aiPickup?.side}
                initialPredictionDigit={aiPickup?.predictionDigit}
                initialDuration={aiPickup?.durationTicks}
                initialTakeProfit={aiPickup?.takeProfit}
                initialStopLoss={aiPickup?.stopLoss}
                autoExecute={aiPickup?.autoRun}
                onAccumulatorBarriers={handleAccumulatorBarriers}
                onMarketChange={handleMarketChange}
                onTradeTypeChange={setTradeType}
                showMarketSelector={false}
              />
            </aside>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-2 dark:border-[#242424] dark:bg-[#151515]">
            <Link
              to="/clone2006/bot-builder"
              aria-label="Open bot builder"
              title="Bot Builder"
              className="rounded-md p-1.5 font-mono text-xs text-[oklch(0.45_0.02_260)] transition-colors hover:bg-[#f2f3f4] hover:text-[#333333] dark:text-[#999999] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
            >
              <Bot className="size-4" />
            </Link>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
              title={isFullscreen ? "Exit full screen" : "Enter full screen"}
              className="rounded-md p-1.5 font-mono text-xs text-[oklch(0.45_0.02_260)] transition-colors hover:bg-[#f2f3f4] hover:text-[#333333] dark:text-[#999999] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </>
      )}

      {isMobile && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ height: "calc(100dvh - 11rem)" }}>
          <div className="flex shrink-0 items-center justify-between border-b border-[#e5e5e5] bg-white px-3 py-2 dark:border-[#242424] dark:bg-[#151515]">
            <div>
              <div className="text-xs font-medium text-[#646464] dark:text-[#999999]">Manual Trader (Simulated)</div>
              <div className="font-mono text-xl font-bold tabular-nums text-[#1f2328] dark:text-[#f2f2f2]">
                {price !== null ? price.toFixed(2) : "—"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/clone2006/admin"
                className="text-[10px] font-medium text-red-500 hover:underline"
              >
                Manage
              </Link>
              <Link
                to="/clone2006/bot-builder"
                className="flex items-center gap-1 rounded-md border border-[#d6d6d6] bg-white px-2 py-1.5 text-[10px] font-medium text-[#646464] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#b7b7b7]"
              >
                <Bot className="size-3" /> Bots
              </Link>
            </div>
          </div>

          {isDigitTrade(tradeType) && (
            <MobileDigitStatsRow tickPrices={tickPrices} currentPrice={price} />
          )}

          <div className="min-h-0 flex-1 overflow-y-auto pb-20 bg-[oklch(0.97_0.003_240)] dark:bg-[#0e0e0e]">
            <div className="p-2 pb-0 max-h-[45vh] overflow-y-auto overscroll-contain">
              <TradePanel
                key={`trade-panel-${pickupVersion}`}
                market={symbol}
                lastPrice={price}
                initialStake={aiPickup?.stake}
                initialTradeType={aiPickup?.tradeType}
                initialSide={aiPickup?.side}
                initialPredictionDigit={aiPickup?.predictionDigit}
                initialDuration={aiPickup?.durationTicks}
                initialTakeProfit={aiPickup?.takeProfit}
                initialStopLoss={aiPickup?.stopLoss}
                autoExecute={aiPickup?.autoRun}
                onAccumulatorBarriers={handleAccumulatorBarriers}
                onMarketChange={handleMarketChange}
                onTradeTypeChange={setTradeType}
                showMarketSelector
                stickyActions
              />
            </div>
            <div className="mt-2 border-t border-[#e5e5e5] bg-white px-1 pt-1 dark:border-[#242424] dark:bg-[#151515]">
              <div className="mb-1 px-2 pt-1 text-xs font-medium text-[#646464] dark:text-[#999999]">
                Live Chart
              </div>
              <DerivChart
                symbol={symbol}
                onSymbolChange={handleMarketChange}
                onPrice={handlePrice}
                height={220}
                entryPrice={barriers.entry}
                highBarrier={barriers.high}
                lowBarrier={barriers.low}
                barrierBreached={barriers.breached}
                accumulatorProfit={barriers.profit}
                accumulatorProfitCurrency={barriers.profitCurrency}
                accumulatorProfitStatus={barriers.profitStatus}
                showDigitStats={false}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </TopShell>
  );
}

function MobileDigitStatsRow({
  tickPrices,
  currentPrice,
}: {
  tickPrices: number[];
  currentPrice: number | null;
}) {
  const digits = digitsFromPrices(tickPrices, 500);
  const stats = calculateDigitStats(digits);
  const latest = stats.latest;
  const DCIRCLE_MAX_PCT = 12;
  const max = Math.max(...stats.percentages);

  return (
    <div className="shrink-0 overflow-x-auto border-b border-[#e5e5e5] bg-white px-2 py-2 dark:border-[#242424] dark:bg-[#151515]">
      <div className="flex min-w-max items-end justify-center gap-1.5 px-1">
        {stats.percentages.map((realPct, digit) => {
          const cappedPct = Math.min(realPct, DCIRCLE_MAX_PCT);
          const highlighted = realPct === max && max > 0;
          const isCurrent = latest === digit;
          return (
            <div key={digit} className="flex w-9 flex-col items-center">
              <div
                className={cn(
                  "relative flex size-8 items-center justify-center rounded-full border-2 bg-white text-sm font-bold text-[#333333] dark:bg-[#101010] dark:text-[#f2f2f2]",
                  highlighted
                    ? "border-[#4bb4b3] shadow-[0_0_0_3px_#e5f7f6] dark:shadow-[0_0_0_3px_rgba(75,180,179,0.25)]"
                    : "border-[#d6d6d6] dark:border-[#444]",
                  isCurrent && "border-[#ff444f]",
                )}
              >
                {digit}
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(${highlighted ? "#4bb4b3" : "#d6d6d6"} ${Math.min(100, cappedPct) * 3.6}deg, transparent 0deg)`,
                    mask: "radial-gradient(circle, transparent 58%, black 60%)",
                    WebkitMask: "radial-gradient(circle, transparent 58%, black 60%)",
                  }}
                />
              </div>
              <div className="mt-0.5 text-[9px] font-semibold text-[#646464] dark:text-[#d8d8d8]">
                {realPct.toFixed(1)}%
              </div>
              <div
                className={cn(
                  "mt-0 h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent",
                  isCurrent
                    ? highlighted
                      ? "border-t-[#4bb4b3]"
                      : "border-t-[#ff444f]"
                    : "border-t-transparent",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
