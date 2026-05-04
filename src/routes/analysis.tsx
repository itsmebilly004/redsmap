import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { subscribeTicks, SYNTHETIC_MARKETS } from "@/lib/deriv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/analysis")({
  head: () => ({
    meta: [
      { title: "Analysis Tool — ArkTrader Hub" },
      { name: "description", content: "Live last-digit and tick analysis for Deriv synthetic indices." },
    ],
  }),
  component: Analysis,
});

function Analysis() {
  const [symbol, setSymbol] = useState("R_100");
  const [digits, setDigits] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    let off: (() => void) | undefined;
    setDigits([]);
    subscribeTicks(symbol, (price) => {
      setLast(price);
      const d = Number(price.toFixed(2).slice(-1));
      setDigits((prev) => [...prev.slice(-499), d]);
    }).then((u) => (off = u));
    return () => off?.();
  }, [symbol]);

  const counts = Array.from({ length: 10 }, (_, i) => digits.filter((d) => d === i).length);
  const total = Math.max(digits.length, 1);

  return (
    <TopShell>
      <div className="mx-auto max-w-5xl px-4 py-8 md:px-8">
        <h1 className="text-2xl font-bold">Analysis Tool</h1>
        <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">Live last-digit distribution from Deriv ticks.</p>

        <div className="mt-6 flex items-center gap-4">
          <Select value={symbol} onValueChange={setSymbol}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SYNTHETIC_MARKETS.map((m) => (
                <SelectItem key={m.symbol} value={m.symbol}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="font-mono text-sm">Last: {last?.toFixed(4) ?? "—"}</div>
          <div className="ml-auto text-xs text-[oklch(0.5_0.02_260)]">Samples: {digits.length}</div>
        </div>

        <div className="mt-6 grid grid-cols-10 gap-2">
          {counts.map((c, i) => {
            const pct = (c / total) * 100;
            return (
              <div key={i} className="flex flex-col items-center">
                <div className="flex h-40 w-full items-end overflow-hidden rounded bg-[oklch(0.95_0.005_240)]">
                  <div
                    className="w-full bg-[oklch(0.55_0.22_265)] transition-all"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 font-mono text-sm font-semibold">{i}</div>
                <div className="text-xs text-[oklch(0.5_0.02_260)]">{pct.toFixed(1)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </TopShell>
  );
}
