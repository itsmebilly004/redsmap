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
  DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE,
  recordDerivOAuthTrace,
  type TradeCategory,
} from "@/lib/deriv";
import { isDigitTrade } from "@/lib/trade-types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArkTrader Hub - Real-time Deriv Trading Platform" },
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
  const [symbol, setSymbol] = useState(
    () => readRememberedMarket(undefined, "manual", "1HZ100V") ?? "1HZ100V",
  );
  const [price, setPrice] = useState<number | null>(null);
  const [tradeType, setTradeType] = useState<TradeCategory>("accumulator");
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
    const remembered = readRememberedMarket(user?.id, "manual");
    if (!remembered) return;
    setSymbol((current) => (current === remembered ? current : remembered));
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
      /* user dismissed prompt or browser blocked it — ignore */
    }
  }, []);

  const handleMarketChange = useCallback(
    (nextSymbol: string) => {
      setSymbol(nextSymbol);
      rememberMarketSelection(user?.id, "manual", nextSymbol);
    },
    [user?.id],
  );

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const hasOAuthCallback =
      (params.get("code") && params.get("state")) || (params.get("error") && params.get("state"));
    if (hasOAuthCallback) {
      console.warn("[Deriv OAuth] OAuth callback landed on root; forwarding to callback route", {
        searchKeys: Array.from(params.keys()),
        hasCode: Boolean(params.get("code")),
        hasState: Boolean(params.get("state")),
        hasError: Boolean(params.get("error")),
        referrer: document.referrer || null,
      });
      window.location.replace(`/deriv-callback${window.location.search}`);
      return;
    }
    if (params.get("account")) {
      recordDerivOAuthTrace("oauth-dashboard-style-return-on-root", {
        currentHref: window.location.href,
        searchKeys: Array.from(params.keys()),
        accountParam: params.get("account"),
        hasCode: Boolean(params.get("code")),
        hasState: Boolean(params.get("state")),
        referrer: document.referrer || null,
        reason:
          "Deriv returned a dashboard-style account query instead of OAuth code/state. Token exchange cannot run without the authorization code.",
      });
      sessionStorage.setItem(
        "deriv_oauth_provider_redirect_failure",
        DERIV_OAUTH_DASHBOARD_FAILURE_MESSAGE,
      );
      navigate({ to: "/auth", search: { mode: "signin" } });
      return;
    }
    if (params.get("error")) {
      navigate({ to: "/auth", search: { mode: "signin" } });
    }
  }, [navigate]);

  return (
    <TopShell>
      {/* ── Desktop layout: chart left, trade panel right ──────────────────── */}
      {!isMobile && (
        <>
          <div
            className="grid min-h-0 flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_320px]"
            style={{ height: "calc(100dvh - 12rem)" }}
          >
            <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-r border-[oklch(0.92_0.005_240)] bg-white p-3 dark:border-[#242424] dark:bg-[#151515]">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Manual Trader</div>
                  <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)] dark:text-[#999999]">
                    {price !== null ? price.toFixed(4) : "-"}
                  </div>
                </div>
              </div>
              <div className="relative min-h-0 flex-1">
                <DerivChart
                  symbol={symbol}
                  onSymbolChange={handleMarketChange}
                  onPrice={setPrice}
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
                Live data streamed from the Deriv WebSocket API. Sign in to place real trades.
              </p>
            </section>
            <aside className="flex min-h-0 min-w-0 flex-col gap-1.5 overflow-y-auto bg-[oklch(0.97_0.003_240)] p-3 pb-3 dark:bg-[#0e0e0e]">
              <TradePanel
                market={symbol}
                lastPrice={price}
                onAccumulatorBarriers={handleAccumulatorBarriers}
                onMarketChange={handleMarketChange}
                onTradeTypeChange={setTradeType}
                showMarketSelector={false}
              />
            </aside>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-2 dark:border-[#242424] dark:bg-[#151515]">
            <Link
              to="/bot-builder"
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

      {/* ── Mobile layout: Deriv-style, price header + scrollable params + sticky buy/sell ── */}
      {isMobile && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" style={{ height: "calc(100dvh - 11rem)" }}>
          {/* Sticky price header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[#e5e5e5] bg-white px-3 py-2 dark:border-[#242424] dark:bg-[#151515]">
            <div>
              <div className="text-xs font-medium text-[#646464] dark:text-[#999999]">Manual Trader</div>
              <div className="font-mono text-xl font-bold tabular-nums text-[#1f2328] dark:text-[#f2f2f2]">
                {price !== null ? price.toFixed(2) : "—"}
              </div>
            </div>
            <Link
              to="/bot-builder"
              className="flex items-center gap-1 rounded-md border border-[#d6d6d6] bg-white px-2 py-1.5 text-[10px] font-medium text-[#646464] dark:border-[#2a2a2a] dark:bg-[#1a1a1a] dark:text-[#b7b7b7]"
            >
              <Bot className="size-3" /> Bots
            </Link>
          </div>

          {/* Scrollable content: trade params → chart */}
          <div className="min-h-0 flex-1 overflow-y-auto pb-20 bg-[oklch(0.97_0.003_240)] dark:bg-[#0e0e0e]">
            <div className="p-2 pb-0">
              <TradePanel
                market={symbol}
                lastPrice={price}
                onAccumulatorBarriers={handleAccumulatorBarriers}
                onMarketChange={handleMarketChange}
                onTradeTypeChange={setTradeType}
                showMarketSelector
                stickyActions
              />
            </div>
            {/* Chart below trade params — scroll down to see it */}
            <div className="mt-2 border-t border-[#e5e5e5] bg-white px-1 pt-1 dark:border-[#242424] dark:bg-[#151515]">
              <div className="mb-1 px-2 pt-1 text-xs font-medium text-[#646464] dark:text-[#999999]">
                Live Chart
              </div>
              <DerivChart
                symbol={symbol}
                onSymbolChange={handleMarketChange}
                onPrice={setPrice}
                height={220}
                entryPrice={barriers.entry}
                highBarrier={barriers.high}
                lowBarrier={barriers.low}
                barrierBreached={barriers.breached}
                accumulatorProfit={barriers.profit}
                accumulatorProfitCurrency={barriers.profitCurrency}
                accumulatorProfitStatus={barriers.profitStatus}
                showDigitStats={isDigitTrade(tradeType)}
                compact
              />
            </div>
          </div>
        </div>
      )}
    </TopShell>
  );
}
