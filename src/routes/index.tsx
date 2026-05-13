import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Maximize2, Minimize2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DerivChart } from "@/components/deriv-chart";
import { TopShell } from "@/components/top-shell";
import { TradePanel } from "@/components/trade-panel";
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
  const [symbol, setSymbol] = useState("1HZ100V");
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
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? (isDigitTrade(tradeType) ? 124 : 108) : 340;
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      if (next.profitStatus !== "lost" && lossOverlayTimerRef.current !== null) {
        window.clearTimeout(lossOverlayTimerRef.current);
        lossOverlayTimerRef.current = null;
      }

      if (next.profitStatus === "sold") {
        setBarriers({ ...next, profit: null, profitStatus: null });
        return;
      }

      setBarriers({
        ...next,
        profit: next.profit ?? null,
        profitStatus: next.profitStatus ?? null,
      });

      if (next.profitStatus === "lost" && lossOverlayTimerRef.current === null) {
        lossOverlayTimerRef.current = window.setTimeout(() => {
          lossOverlayTimerRef.current = null;
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
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:overflow-visible lg:h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
        <section className="relative flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-[oklch(0.92_0.005_240)] bg-white p-1 sm:p-3 md:overflow-y-auto lg:border-b-0 lg:border-r dark:border-[#242424] dark:bg-[#151515]">
          <div className="mb-1 hidden items-center justify-between sm:mb-2 md:flex">
            <div>
              <div className="text-sm font-semibold">Manual Trader</div>
              <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)] dark:text-[#999999]">
                {price !== null ? price.toFixed(4) : "-"}
              </div>
            </div>
          </div>


          <DerivChart
            symbol={symbol}
            onSymbolChange={setSymbol}
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
            compact={isMobile}
          />

          <p className="mt-2 hidden text-xs text-[oklch(0.5_0.02_260)] sm:block dark:text-[#999999]">
            Live data streamed from the Deriv WebSocket API. Sign in to place real trades.
          </p>
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden bg-[oklch(0.97_0.003_240)] p-1.5 pb-1.5 sm:p-3 md:overflow-y-auto lg:pb-3 dark:bg-[#0e0e0e]">
          <TradePanel
            market={symbol}
            lastPrice={price}
            onAccumulatorBarriers={handleAccumulatorBarriers}
            onMarketChange={setSymbol}
            onTradeTypeChange={setTradeType}          />
        </aside>
      </div>


      <div className="hidden flex-wrap items-center justify-between gap-2 border-t border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 md:flex dark:border-[#242424] dark:bg-[#151515]">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[oklch(0.45_0.02_260)] sm:gap-3 dark:text-[#999999]">
          <Link
            to="/bot-builder"
            aria-label="Open bot builder"
            title="Bot Builder"
            className="rounded-md p-1.5 transition-colors hover:bg-[#f2f3f4] hover:text-[#333333] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
          >
            <Bot className="size-4" />
          </Link>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
            title={isFullscreen ? "Exit full screen" : "Enter full screen"}
            className="rounded-md p-1.5 transition-colors hover:bg-[#f2f3f4] hover:text-[#333333] dark:hover:bg-[#1f1f1f] dark:hover:text-white"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
        </div>
      </div>
    </TopShell>
  );
}
