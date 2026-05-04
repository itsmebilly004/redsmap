import { createFileRoute } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";

export const Route = createFileRoute("/strategies")({
  head: () => ({
    meta: [
      { title: "Strategies — ArkTrader Hub" },
      { name: "description", content: "Proven trading strategies for Deriv synthetic indices." },
    ],
  }),
  component: Strategies,
});

const ITEMS = [
  { name: "Martingale Rise", body: "Double stake after every loss until a win. High risk, fast recovery." },
  { name: "Anti-Martingale", body: "Increase stake after wins, reset after a loss. Smooths drawdowns." },
  { name: "Digit Differs Median", body: "Bet against the most-frequent digit over a rolling window." },
  { name: "Trend-Following EMA", body: "Trade Rise/Fall in the direction of a 20-period EMA." },
  { name: "Accumulator Stair", body: "Stack accumulators with strict take-profit ladders." },
  { name: "Multiplier Breakout", body: "Open multipliers when volatility expands beyond ATR threshold." },
];

function Strategies() {
  return (
    <TopShell>
      <PageHero title="Strategies" subtitle="A library of vetted trading strategies, ready to load into the bot builder.">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((s) => (
            <div key={s.name} className="rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm">
              <div className="text-base font-semibold">{s.name}</div>
              <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">{s.body}</p>
            </div>
          ))}
        </div>
      </PageHero>
    </TopShell>
  );
}
