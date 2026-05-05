import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TopShell } from "@/components/top-shell";
import { subscribeTicks, SYNTHETIC_MARKETS } from "@/lib/deriv";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

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
  const TABS = [
    "Dcircles",
    "Signals",
    "Analysis Tool",
    "DP Tools",
    "Smart Analysis",
    "All Analysis",
    "Tick Analyser",
    "Xenon AI",
  ] as const;
  type Tab = (typeof TABS)[number];

  const [tab, setTab] = useState<Tab>("Dcircles");
  const [mode, setMode] = useState<"wide_eye" | "launch_ai">("launch_ai");
  const [symbol, setSymbol] = useState("1HZ10V");
  const [window, setWindow] = useState<number>(1000);
  const [windowInput, setWindowInput] = useState<string>("1000");
  const [ticks, setTicks] = useState<number[]>([]); // raw prices (most recent last)
  const [last, setLast] = useState<number | null>(null);

  useEffect(() => {
    let off: (() => void) | undefined;
    setTicks([]);
    subscribeTicks(symbol, (price) => {
      setLast(price);
      setTicks((prev) => {
        const next = [...prev, price];
        if (next.length > 5000) next.splice(0, next.length - 5000);
        return next;
      });
    }).then((u) => (off = u));
    return () => off?.();
  }, [symbol]);

  // Derive last-digit distribution within configured ticks window
  const slice = useMemo(() => ticks.slice(-window), [ticks, window]);
  const digits = useMemo(
    () => slice.map((p) => Number(p.toFixed(2).slice(-1))),
    [slice],
  );
  const counts = useMemo(
    () => Array.from({ length: 10 }, (_, i) => digits.filter((d) => d === i).length),
    [digits],
  );
  const total = Math.max(digits.length, 1);
  const pcts = counts.map((c) => (c / total) * 100);
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  const currentDigit = digits.length ? digits[digits.length - 1] : null;

  const marketName =
    SYNTHETIC_MARKETS.find((m) => m.symbol === symbol)?.name ?? symbol;

  // Color rotation for the digit circles to match the screenshot vibe.
  const digitColors = [
    "border-slate-300 text-slate-700",
    "border-orange-400 bg-orange-400 text-white",
    "border-rose-500 bg-rose-500 text-white",
    "border-slate-300 text-slate-700",
    "border-emerald-500 bg-emerald-500 text-white",
    "border-sky-500 bg-sky-500 text-white",
    "border-orange-400 bg-orange-400 text-white",
    "border-slate-300 text-slate-700",
    "border-slate-300 text-slate-700",
    "border-slate-300 text-slate-700",
  ];

  return (
    <TopShell>
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md border px-4 py-2 text-xs font-semibold transition",
                tab === t
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Dcircles" && (
          <div className="mt-6">
            {/* Mode pills */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMode("wide_eye")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold text-white shadow",
                  mode === "wide_eye"
                    ? "bg-gradient-to-r from-rose-400 to-amber-400"
                    : "bg-gradient-to-r from-rose-300/70 to-amber-300/70",
                )}
              >
                Wide Eye
              </button>
              <button
                onClick={() => setMode("launch_ai")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold text-white shadow",
                  mode === "launch_ai"
                    ? "bg-gradient-to-r from-sky-500 to-blue-600"
                    : "bg-gradient-to-r from-sky-400/70 to-blue-500/70",
                )}
              >
                Launch AI
              </button>
              <button
                title="Choose a mode and market, then watch the live last-digit distribution."
                className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50"
              >
                <Info className="h-4 w-4" />
              </button>
            </div>

            {/* Market */}
            <div className="mt-6">
              <label className="block text-sm font-semibold text-slate-800">Select Market:</label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="mt-2 h-11 w-full max-w-3xl rounded-md border-slate-300 bg-white text-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNTHETIC_MARKETS.map((m) => (
                    <SelectItem key={m.symbol} value={m.symbol}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Live price strip */}
            <div className="mt-3 max-w-3xl rounded-md bg-slate-100/70 px-5 py-5">
              <div className="font-mono text-3xl font-semibold text-slate-800">
                {last !== null ? last.toFixed(2) : "—"}
              </div>
            </div>

            {/* Ticks window */}
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <label className="text-sm font-semibold text-slate-800">Ticks window:</label>
              <Input
                type="number"
                min={50}
                max={5000}
                value={windowInput}
                onChange={(e) => {
                  setWindowInput(e.target.value);
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  if (n >= 50 && n <= 5000) setWindow(Math.floor(n));
                }}
                className="h-9 w-32 text-center"
              />
              <span className="text-xs text-slate-500">(50–5000)</span>
              <span className="ml-auto text-xs text-slate-500">
                Samples: {digits.length}
              </span>
            </div>

            {/* Distribution */}
            <div className="mt-4">
              <div className="text-sm font-semibold text-slate-800">
                Last {window} ticks digit distribution
              </div>

              <div className="mt-6 grid grid-cols-5 gap-y-8 sm:grid-cols-10">
                {counts.map((_c, i) => {
                  const pct = pcts[i];
                  const isMax = pct === maxPct && total > 1;
                  const isMin = pct === minPct && total > 1;
                  const isCurrent = currentDigit === i;
                  return (
                    <div key={i} className="relative flex flex-col items-center">
                      {isCurrent && (
                        <div className="absolute -top-6 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white shadow">
                          ▾
                        </div>
                      )}
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold transition",
                          digitColors[i],
                          isCurrent && "ring-4 ring-blue-200",
                        )}
                      >
                        {i}
                      </div>
                      <div className="mt-2 text-xs font-medium text-slate-600">
                        {pct.toFixed(1)}%
                      </div>
                      {isMax && (
                        <div className="mt-1 text-[10px] font-semibold text-blue-600">
                          most frequency
                        </div>
                      )}
                      {isMin && !isMax && (
                        <div className="mt-1 text-[10px] font-semibold text-slate-500">
                          least frequency
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {currentDigit !== null && (
                <div className="mt-4 text-xs text-slate-500">
                  current digit: <span className="font-semibold text-slate-700">{currentDigit}</span> · market: {marketName}
                </div>
              )}
            </div>
          </div>
        )}

        {tab !== "Dcircles" && (
          <div className="mt-10 rounded-md border border-dashed border-slate-300 bg-white p-12 text-center">
            <h2 className="text-lg font-semibold text-slate-800">{tab}</h2>
            <p className="mt-2 text-sm text-slate-500">
              {tab} module is coming soon. Switch back to <span className="font-semibold">Dcircles</span> to see the live last-digit distribution.
            </p>
          </div>
        )}
      </div>
    </TopShell>
  );
}
