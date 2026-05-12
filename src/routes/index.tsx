import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Crosshair, Globe, HelpCircle, Maximize2, Settings, Shield, Sun } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { DerivChart } from "@/components/deriv-chart";
import { SignalsPanel } from "@/components/signals-panel";
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
  }>({
    entry: null,
    high: null,
    low: null,
  });
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const chartHeight = isMobile ? 260 : 340;

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
      <div className="grid min-h-0 grid-cols-1 lg:h-[calc(100dvh-12rem)] lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
        <section className="relative flex min-h-0 min-w-0 flex-col overflow-y-auto border-b border-[oklch(0.92_0.005_240)] bg-white p-2 sm:p-3 lg:border-b-0 lg:border-r">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Manual Trader</div>
              <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)]">
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
            showDigitStats={isDigitTrade(tradeType)}
          />

          <p className="mt-2 text-xs text-[oklch(0.5_0.02_260)]">
            Live data streamed from the Deriv WebSocket API. Sign in to place real trades.
          </p>

          <SignalsPanel symbol={symbol} compact />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-col gap-2 overflow-y-auto bg-[oklch(0.97_0.003_240)] p-2 pb-24 sm:p-3 lg:pb-3">
          <TradePanel
            market={symbol}
            lastPrice={price}
            onAccumulatorBarriers={setBarriers}
            onMarketChange={setSymbol}
            onTradeTypeChange={setTradeType}
          />
        </aside>
      </div>


      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 sm:gap-3 sm:px-4 sm:py-3">
        <span className="rounded-md bg-[oklch(0.92_0.13_95)] px-2.5 py-1 text-[11px] font-semibold text-[oklch(0.3_0.1_80)] sm:px-4 sm:py-1.5 sm:text-sm">
          Risk Disclaimer - Trading involves significant risk of loss.
        </span>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-[oklch(0.45_0.02_260)] sm:gap-3">
          <Shield className="size-4" />
          <Bot className="size-4" />
          <Crosshair className="size-4" />
          <Sun className="size-4" />
          <HelpCircle className="size-4" />
          <Settings className="size-4" />
          <Globe className="size-4" />
          <span className="font-sans font-medium">EN</span>
          <Maximize2 className="size-4" />
        </div>
      </div>
    </TopShell>
  );
}
