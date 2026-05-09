import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { subscribeTicks } from "@/lib/deriv";
import { cn } from "@/lib/utils";

const DIGIT_COLORS = [
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

export function SignalsPanel({ compact = false, symbol }: { compact?: boolean; symbol: string }) {
  const [ticks, setTicks] = useState<number[]>([]);

  useEffect(() => {
    let off: (() => void) | undefined;
    setTicks([]);
    subscribeTicks(symbol, (price) => {
      setTicks((prev) => {
        const next = [...prev, price];
        if (next.length > 1000) next.splice(0, next.length - 1000);
        return next;
      });
    }).then((unsub) => {
      off = unsub;
    });
    return () => off?.();
  }, [symbol]);

  const digits = useMemo(() => ticks.map((price) => Number(price.toFixed(2).slice(-1))), [ticks]);
  const recentDigits = digits.slice(-10);
  const counts = useMemo(
    () => Array.from({ length: 10 }, (_, digit) => digits.filter((d) => d === digit).length),
    [digits],
  );
  const total = Math.max(digits.length, 1);
  const pcts = counts.map((count) => (count / total) * 100);
  const maxPct = Math.max(...pcts);
  const currentDigit = digits.length ? digits[digits.length - 1] : null;
  const evenCount = recentDigits.filter((digit) => digit % 2 === 0).length;
  const oddCount = recentDigits.length - evenCount;
  const overCount = recentDigits.filter((digit) => digit > 4).length;
  const underCount = recentDigits.length - overCount;
  const lastDigit = recentDigits.length ? recentDigits[recentDigits.length - 1] : null;
  const consecutiveSame = (() => {
    let count = 0;
    for (let i = recentDigits.length - 1; i >= 0; i--) {
      if (recentDigits[i] === lastDigit) count++;
      else break;
    }
    return count;
  })();

  return (
    <section className="border-t border-[#e5e5e5] bg-white px-3 py-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-bold text-[#333333]">Signals</div>
          <div className="text-[11px] text-[#777777]">Live digit observations from the current market</div>
        </div>
        <div className="flex items-center gap-2 rounded bg-[#f2f3f4] px-3 py-1.5">
          <span className="text-[10px] font-bold uppercase text-[#777777]">Current digit</span>
          <span className="font-mono text-lg font-bold text-[#ff444f]">{currentDigit ?? "-"}</span>
        </div>
      </div>

      <div className={cn("grid gap-3", compact ? "lg:grid-cols-[1.2fr_1fr]" : "lg:grid-cols-[1fr_1fr]")}>
        <div className="rounded border border-[#e5e5e5] bg-[#fafafa] p-3">
          <div className="grid grid-cols-10 gap-1.5">
            {counts.map((count, digit) => {
              const isCurrent = currentDigit === digit;
              const isHot = pcts[digit] === maxPct && total > 1;
              return (
                <div key={digit} className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-full border-2 text-sm font-bold",
                      DIGIT_COLORS[digit],
                      isCurrent && "ring-2 ring-[#ff444f]/40",
                    )}
                  >
                    {digit}
                  </div>
                  <div className="mt-1 font-mono text-[10px] font-bold text-[#555555]">{count}</div>
                  <div className={cn("text-[9px]", isHot ? "font-bold text-[#ff444f]" : "text-[#999999]")}>
                    {pcts[digit].toFixed(1)}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SignalCard
            title="Even / Odd"
            label={evenCount >= oddCount ? "Even suggested" : "Odd suggested"}
            confidence={confidence(evenCount, oddCount)}
            tone={evenCount >= oddCount ? "green" : "slate"}
            detail={`Even ${evenCount} | Odd ${oddCount}`}
          />
          <SignalCard
            title="Over / Under 4"
            label={overCount >= underCount ? "Over 4 suggested" : "Under 4 suggested"}
            confidence={confidence(overCount, underCount)}
            tone={overCount >= underCount ? "blue" : "orange"}
            detail={`Over ${overCount} | Under ${underCount}`}
          />
          <SignalCard
            title="Streak"
            label={consecutiveSame >= 3 ? `Streak of ${consecutiveSame}` : "No streak"}
            confidence={consecutiveSame >= 3 ? Math.min(95, consecutiveSame * 20) : 0}
            tone={consecutiveSame >= 3 ? "rose" : "slate"}
            detail={`Digit ${lastDigit ?? "-"} repeated ${consecutiveSame}x`}
          />
          <SignalCard
            title="Hot Digit"
            label={`Digit ${pcts.indexOf(maxPct)} is hot`}
            confidence={Math.round(maxPct)}
            tone="amber"
            detail={`${maxPct.toFixed(1)}% in last ${digits.length} ticks`}
          />
        </div>
      </div>

      <div className="mt-2 text-[10px] text-[#777777]">
        <Info className="mr-1 inline size-3" />
        Signals are statistical observations only, not financial advice.
      </div>
    </section>
  );
}

function confidence(a: number, b: number) {
  const total = Math.max(a + b, 1);
  return Math.round((Math.max(a, b) / total) * 100);
}

function SignalCard({
  confidence,
  detail,
  label,
  title,
  tone,
}: {
  confidence: number;
  detail: string;
  label: string;
  title: string;
  tone: "green" | "blue" | "orange" | "rose" | "slate" | "amber";
}) {
  const toneClass = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    blue: "border-sky-200 bg-sky-50 text-sky-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    rose: "border-rose-200 bg-rose-50 text-rose-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };
  const barClass = {
    green: "bg-emerald-400",
    blue: "bg-sky-400",
    orange: "bg-orange-400",
    rose: "bg-rose-400",
    slate: "bg-slate-400",
    amber: "bg-amber-400",
  };

  return (
    <div className={cn("rounded border p-3", toneClass[tone])}>
      <div className="text-[9px] font-bold uppercase opacity-70">{title}</div>
      <div className="mt-1 text-xs font-bold">{label}</div>
      <div className="mt-2 h-1.5 rounded-full bg-current/10">
        <div className={cn("h-1.5 rounded-full", barClass[tone])} style={{ width: `${confidence}%` }} />
      </div>
      <div className="mt-1 text-[10px] font-semibold">{confidence}% confidence</div>
      <div className="mt-1 text-[10px] opacity-70">{detail}</div>
    </div>
  );
}
