import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { DerivChart } from "@/components/deriv-chart";

export const Route = createFileRoute("/charts")({
  head: () => ({
    meta: [
      { title: "Live Charts — ArkTrader Hub" },
      {
        name: "description",
        content: "Real-time candlestick charts for all Deriv synthetic indices and forex pairs.",
      },
    ],
  }),
  component: ChartsPage,
});

function ChartsPage() {
  const [symbol, setSymbol] = useState("R_100");
  const [chartHeight, setChartHeight] = useState(600);

  useEffect(() => {
    const compute = () => {
      const narrow = window.innerWidth < 640;
      setChartHeight(Math.max(narrow ? 300 : 400, window.innerHeight - (narrow ? 220 : 160)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return (
    <TopShell>
      <div className="min-w-0 bg-white p-2 sm:p-3">
        <DerivChart symbol={symbol} onSymbolChange={setSymbol} height={chartHeight} />
      </div>
    </TopShell>
  );
}
