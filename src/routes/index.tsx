import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";
import { Shield, Sun, HelpCircle, Settings, Globe, Bot, Crosshair, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ArkTrader Hub — Real-time Deriv Trading Platform" },
      { name: "description", content: "Trade synthetic indices in real time with live Deriv charts, bots, analytics, and copy trading." },
    ],
  }),
  component: Index,
});

function Index() {
  const [symbol, setSymbol] = useState("R_100");
  const [price, setPrice] = useState<number | null>(null);

  return (
    <TopShell>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
        <section className="relative border-r border-[oklch(0.92_0.005_240)] bg-white p-4">
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
            height={460}
          />

          <p className="mt-3 text-xs text-[oklch(0.5_0.02_260)]">
            Live data streamed from the Deriv WebSocket API. Sign in to place
            real trades.
          </p>
        </section>

        <aside className="hidden flex-col gap-3 bg-[oklch(0.97_0.003_240)] p-4 lg:flex">
          {[
            { title: "Quick Trade", body: "Sign in to place Rise/Fall, Even/Odd, Over/Under and Accumulator trades." },
            { title: "Bot Builder", body: "Build no-code strategies with martingale and risk controls." },
            { title: "Analysis", body: "Digit stats and trend insights powered by live ticks." },
            { title: "Copy Trading", body: "Mirror top traders directly via your Deriv account." },
          ].map((c) => (
            <div key={c.title} className="rounded-md border border-[oklch(0.92_0.005_240)] bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold">{c.title}</div>
              <div className="mt-1 text-xs text-[oklch(0.5_0.02_260)]">{c.body}</div>
            </div>
          ))}
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
