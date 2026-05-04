import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/trading-bots")({
  head: () => ({
    meta: [
      { title: "Trading Bots — ArkTrader Hub" },
      { name: "description", content: "Browse and launch ready-made Deriv trading bots." },
    ],
  }),
  component: TradingBots,
});

const PRESETS = [
  { name: "Rise Trend Pro", strategy: "rise_fall", desc: "Follows momentum on Volatility 100 with a 2x martingale." },
  { name: "Even Sniper", strategy: "even_odd", desc: "Statistical edge on Even/Odd ticks, conservative stake." },
  { name: "Over 5 Hunter", strategy: "over_under", desc: "Targets last digit > 5 with strict stop-loss." },
  { name: "Accumulator Stack", strategy: "accumulator", desc: "Compounding accumulators with TP at 25%." },
];

function TradingBots() {
  const { user } = useAuth();
  return (
    <TopShell>
      <PageHero title="Trading Bots" subtitle="Pre-built bots you can deploy on demo or live in one click.">
        <div className="grid gap-4 md:grid-cols-2">
          {PRESETS.map((b) => (
            <div key={b.name} className="rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm">
              <div className="text-base font-semibold">{b.name}</div>
              <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">{b.desc}</p>
              <Button asChild size="sm" className="mt-4 bg-[oklch(0.55_0.22_265)] text-white">
                <Link to={user ? "/dashboard/bot" : "/auth"} search={user ? undefined : { mode: "signup" }}>
                  {user ? "Deploy" : "Sign up to deploy"}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </PageHero>
    </TopShell>
  );
}
