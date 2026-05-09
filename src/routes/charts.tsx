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
    const compute = () => setChartHeight(Math.max(400, window.innerHeight - 160));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return (
    <TopShell>
      <div className="bg-white p-3">
        <DerivChart symbol={symbol} onSymbolChange={setSymbol} height={chartHeight} />
      </div>
    </TopShell>
  );
}
