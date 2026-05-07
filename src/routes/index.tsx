import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";
import { TradePanel } from "@/components/trade-panel";
import type { TradeCategory } from "@/lib/deriv";
import { Shield, Sun, HelpCircle, Settings, Globe, Bot, Crosshair, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArkTrader Hub — Real-time Deriv Trading Platform" },
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
  const [barriers, setBarriers] = useState<{ high: number | null; low: number | null }>({
    high: null,
    low: null,
  });
  const [tradeCategory, setTradeCategory] = useState<TradeCategory>("accumulator");
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("acct1") && params.get("token1")) {
      navigate({ to: "/deriv-callback", search: Object.fromEntries(params.entries()) });
      return;
    }
    if (params.get("error")) {
      navigate({ to: "/auth", search: { mode: "signin" } });
    }
  }, [navigate]);

  const isAccumulator = tradeCategory === "accumulator";

  return (
    <TopShell>
      {/* Main trading area — stacks on mobile, side-by-side on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Chart section */}
        <section className="relative border-b border-[oklch(0.92_0.005_240)] bg-white p-3 lg:border-b-0 lg:border-r lg:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Manual Trader</div>
              <div className="font-mono text-[11px] text-[oklch(0.55_0.02_260)]">
                {price !== null ? price.toFixed(4) : "—"}
              </div>
            </div>
          </div>

          <DerivChart
            symbol={symbol}
            onSymbolChange={setSymbol}
            onPrice={setPrice}
            height={window.innerWidth < 1024 ? 280 : 460}
            highBarrier={barriers.high}
            lowBarrier={barriers.low}
            isAccumulator={isAccumulator}
          />

          <p className="mt-2 text-xs text-[oklch(0.5_0.02_260)]">
            Live data streamed from the Deriv WebSocket API. Sign in to place real trades.
          </p>
        </section>

        {/* Trade panel — scrollable on mobile */}
        <aside className="flex flex-col bg-[oklch(0.97_0.003_240)] p-3 lg:overflow-y-auto">
          <TradePanel
            market={symbol}
            lastPrice={price}
            onAccumulatorBarriers={setBarriers}
            onCategoryChange={setTradeCategory}
          />
        </aside>
      </div>

      {/* Status bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 md:px-4 md:py-3">
        <span className="rounded-md bg-[oklch(0.92_0.13_95)] px-3 py-1 text-xs font-semibold text-[oklch(0.3_0.1_80)] md:px-4 md:py-1.5 md:text-sm">
          Risk Disclaimer — Trading involves significant risk of loss.
        </span>
        <div className="flex items-center gap-2 font-mono text-xs text-[oklch(0.45_0.02_260)] md:gap-3">
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
