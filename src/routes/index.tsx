import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";
import { TradePanel } from "@/components/trade-panel";
import { SignalsPanel } from "@/components/signals-panel";
import {
  Shield,
  Sun,
  HelpCircle,
  Settings,
  Globe,
  Bot,
  Crosshair,
  Maximize2,
  BarChart2,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const [mobileTab, setMobileTab] = useState<"chart" | "trade">("chart");
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (
      (params.get("code") && params.get("state")) ||
      (params.get("acct1") && params.get("token1"))
    ) {
      window.location.replace(`/deriv-callback${window.location.search}`);
    }
    if (params.get("error")) {
      navigate({ to: "/auth", search: { mode: "signin" } });
    }
  }, [navigate]);

  return (
    <TopShell>
      {/* Mobile tab switcher */}
      <div className="flex border-b border-[oklch(0.92_0.005_240)] bg-white lg:hidden">
        <button
          onClick={() => setMobileTab("chart")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition",
            mobileTab === "chart"
              ? "border-b-2 border-[oklch(0.7_0.17_150)] text-[oklch(0.35_0.15_150)]"
              : "text-[oklch(0.5_0.02_260)]",
          )}
        >
          <BarChart2 className="size-4" /> Chart
        </button>
        <button
          onClick={() => setMobileTab("trade")}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition",
            mobileTab === "trade"
              ? "border-b-2 border-[oklch(0.7_0.17_150)] text-[oklch(0.35_0.15_150)]"
              : "text-[oklch(0.5_0.02_260)]",
          )}
        >
          <TrendingUp className="size-4" /> Trade
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Chart section */}
        <section
          className={cn(
            "relative border-r border-[oklch(0.92_0.005_240)] bg-white p-3",
            mobileTab !== "chart" && "hidden lg:block",
          )}
        >
          <div className="mb-2 flex items-center justify-between">
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
            height={460}
            highBarrier={barriers.high}
            lowBarrier={barriers.low}
          />

          <p className="mt-2 text-xs text-[oklch(0.5_0.02_260)]">
            Live data streamed from the Deriv WebSocket API. Sign in to place real trades.
          </p>

          <SignalsPanel symbol={symbol} compact />
        </section>

        {/* Trade panel */}
        <aside
          className={cn(
            "flex-col gap-3 overflow-y-auto bg-[oklch(0.97_0.003_240)] p-3",
            mobileTab === "trade" ? "flex" : "hidden lg:flex",
          )}
        >
          <TradePanel market={symbol} lastPrice={price} onAccumulatorBarriers={setBarriers} />
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-4 py-3">
        <span className="rounded-md bg-[oklch(0.92_0.13_95)] px-4 py-1.5 text-sm font-semibold text-[oklch(0.3_0.1_80)]">
          Risk Disclaimer — Trading involves significant risk of loss.
        </span>
        <div className="flex items-center gap-3 font-mono text-xs text-[oklch(0.45_0.02_260)]">
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
