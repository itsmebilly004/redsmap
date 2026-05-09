import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  const [chartHeight, setChartHeight] = useState(620);

  useEffect(() => {
    const compute = () => {
      const narrow = window.innerWidth < 640;
      setChartHeight(Math.max(narrow ? 320 : 460, window.innerHeight - (narrow ? 260 : 240)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return (
    <TopShell>
      <div className="mx-auto w-full max-w-7xl min-w-0 px-3 py-4 sm:px-4 sm:py-6 md:px-8">
        <h1 className="mb-4 text-xl font-bold sm:text-2xl">TradingView</h1>
        <DerivChart symbol={symbol} onSymbolChange={setSymbol} height={chartHeight} />
      </div>
    </TopShell>
  );
}
