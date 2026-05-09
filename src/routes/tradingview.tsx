import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";

export const Route = createFileRoute("/tradingview")({
  head: () => ({
    meta: [
      { title: "TradingView — ArkTrader Hub" },
      {
        name: "description",
        content: "Pro-grade TradingView-style charts powered by live Deriv ticks.",
      },
    ],
  }),
  component: TradingViewPage,
});

function TradingViewPage() {
  const [symbol, setSymbol] = useState("R_100");
  return (
    <TopShell>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <h1 className="mb-4 text-2xl font-bold">TradingView</h1>
        <DerivChart symbol={symbol} onSymbolChange={setSymbol} height={620} />
      </div>
    </TopShell>
  );
}
