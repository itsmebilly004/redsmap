// src/routes/trading-bots.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Zap, Target, ShieldCheck, Cpu, BrainCircuit, Flame } from "lucide-react";

export const Route = createFileRoute("/trading-bots")({
  head: () => ({
    meta: [
      { title: "Trading Bot Presets — ArkTrader Hub" },
      {
        name: "description",
        content: "Launch professional-grade Deriv trading bot presets instantly.",
      },
    ],
  }),
  component: TradingBots,
});

export const BOT_PRESETS = [
  {
    id: "nova-v6",
    name: "Nova Digit Harvester V6",
    icon: Cpu,
    desc: "Professional AI robot. Uses adaptive Over/Under logic with a 1.95x recovery multiplier. Optimized for 1-second indices.",
    market: "1HZ100V",
    tradeType: "over_under",
    contractType: "under",
    stake: 1.0,
    tp: 100.0,
    sl: 10.0,
    martingale: 1.95,
  },
  {
    id: "mega-mind",
    name: "Mega Mind V1 👻",
    icon: BrainCircuit,
    desc: "Uses a specific prediction sequence (0, 1, 2, 0) to scalp Digit Over contracts. Features a 2x Martingale strategy.",
    market: "1HZ10V",
    tradeType: "over_under",
    contractType: "over",
    stake: 5.97,
    tp: 500.0,
    sl: 100.0,
    martingale: 2.0,
  },
  {
    id: "osam-hnr",
    name: "Osam HnR (Hit & Run)",
    icon: Flame,
    desc: "High-velocity Digit Odd sniper. Simple, aggressive, and designed for quick sessions on Volatility 100.",
    market: "R_100",
    tradeType: "even_odd",
    contractType: "odd",
    stake: 1.0,
    tp: 10.0,
    sl: 5.0,
    martingale: 2.0,
  },
  {
    id: "candle-mine",
    name: "Candle Mine V2",
    icon: Zap,
    desc: "Digit Diff specialist. Targets high win-rate 'Differs' contracts with an 11x Martingale for rapid recovery.",
    market: "R_100",
    tradeType: "matches_differs",
    contractType: "differs",
    stake: 110.0,
    tp: 9999.0,
    sl: 9999.0,
    martingale: 11.0,
  },
  {
    id: "dec-entry",
    name: "DEC Entry Point",
    icon: Target,
    desc: "Strategy based on specific entry points. Only buys Digit Over when the last digit trend aligns with the trigger.",
    market: "1HZ10V",
    tradeType: "over_under",
    contractType: "over",
    stake: 1.0,
    tp: 2.0,
    sl: 2.0,
    martingale: 2.0,
  },
];

function TradingBots() {
  const { user } = useAuth();
  return (
    <TopShell>
      <PageHero
        title="Trading Bot Presets"
        subtitle="Deployment-ready bot configurations from your library. Load them into the builder to start trading."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {BOT_PRESETS.map((b) => (
            <div
              key={b.id}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-card p-6 shadow-xl transition-all hover:border-primary/50"
            >
              <div className="flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                  <b.icon className="size-6" />
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold tracking-tight">{b.name}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-3">
                    {b.desc}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.market}
                    </span>
                    <span className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.tradeType.replace("_", " ")}
                    </span>
                  </div>

                  <div className="mt-6">
                    <Button asChild size="lg" className="w-full rounded-xl font-bold shadow-glow">
                      <Link to="/bot-builder" search={{ preset: b.id }}>
                        {user ? "Deploy Bot" : "Sign in to deploy"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </PageHero>
    </TopShell>
  );
}
