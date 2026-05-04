import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";

export const Route = createFileRoute("/charts")({
  head: () => ({
    meta: [
      { title: "Live Charts — ArkTrader Hub" },
      { name: "description", content: "Real-time candlestick charts for all Deriv synthetic indices and forex pairs." },
    ],
  }),
  component: ChartsPage,
});

function ChartsPage() {
  const [symbol, setSymbol] = useState("R_100");
  return (
    <TopShell>
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-8">
        <h1 className="mb-4 text-2xl font-bold">Live Charts</h1>
        <DerivChart symbol={symbol} onSymbolChange={setSymbol} height={560} />
      </div>
    </TopShell>
  );
}
