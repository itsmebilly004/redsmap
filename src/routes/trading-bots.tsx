// src/routes/trading-bots.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { markDeployedBotPresetId } from "@/lib/bot-preset-storage";
import { Zap, Target, ShieldCheck, Cpu, BrainCircuit, Flame, Radar } from "lucide-react";

export const Route = createFileRoute("/trading-bots")({
  head: () => ({
    meta: [
      { title: "Trading Bot Presets - ArkTrader Hub" },
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
    name: "ArkTraders Nova UnderPulse",
    icon: Cpu,
    desc: "Adaptive Under bot from the Nova Harvester asset. Built for fast 1-second index sessions with controlled recovery.",
    market: "1HZ100V",
    tradeType: "over_under",
    contractType: "under",
    stake: 1.0,
    tp: 100.0,
    sl: 10.0,
    martingale: 1.95,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 5,
    maxRuns: 50,
  },
  {
    id: "mega-mind",
    name: "ArkTraders MegaMind Overdrive",
    icon: BrainCircuit,
    desc: "Digit Over scalper inspired by the Mega Mind sequence. Uses measured recovery and fast tick execution.",
    market: "1HZ10V",
    tradeType: "over_under",
    contractType: "over",
    stake: 5.97,
    tp: 500.0,
    sl: 100.0,
    martingale: 2.0,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 3,
    maxRuns: 50,
  },
  {
    id: "osam-hnr",
    name: "ArkTraders HitRun Phantom",
    icon: Flame,
    desc: "High-velocity Digit Odd sniper from the Osam HnR asset. Designed for short, decisive Volatility 100 bursts.",
    market: "R_100",
    tradeType: "even_odd",
    contractType: "odd",
    stake: 1.0,
    tp: 10.0,
    sl: 5.0,
    martingale: 2.0,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 5,
    maxRuns: 25,
  },
  {
    id: "candle-mine",
    name: "ArkTraders CandleVault Diff",
    icon: Zap,
    desc: "Digit Diff specialist from Candle Mine. Targets differs contracts with aggressive recovery controls.",
    market: "R_100",
    tradeType: "matches_differs",
    contractType: "differs",
    stake: 110.0,
    tp: 9999.0,
    sl: 9999.0,
    martingale: 11.0,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 5,
    maxRuns: 25,
  },
  {
    id: "dec-entry",
    name: "ArkTraders DEC Entry Sniper",
    icon: Target,
    desc: "Entry-point driven Digit Over setup. Built for traders who want precise trigger-based execution.",
    market: "1HZ10V",
    tradeType: "over_under",
    contractType: "over",
    stake: 1.0,
    tp: 2.0,
    sl: 2.0,
    martingale: 2.0,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 7,
    maxRuns: 25,
  },
  {
    id: "osam-autobot",
    name: "ArkTraders Osam AutoPilot",
    icon: ShieldCheck,
    desc: "Auto Bot by Osam, adapted from the Osam asset into a deployable ArkTrader preset for disciplined Digit Odd sessions.",
    market: "R_100",
    tradeType: "even_odd",
    contractType: "odd",
    stake: 1.0,
    tp: 15.0,
    sl: 5.0,
    martingale: 2.0,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 5,
    maxRuns: 35,
  },
  {
    id: "under-pro-bot",
    name: "ArkTraders UnderPro Sentinel",
    icon: Radar,
    desc: "Under-Pro bot adapted from the Under-focused asset logic. Tuned for Digit Under entries on Volatility 100 (1s).",
    market: "1HZ100V",
    tradeType: "over_under",
    contractType: "under",
    stake: 1.0,
    tp: 100.0,
    sl: 10.0,
    martingale: 1.95,
    duration: 1,
    durationUnit: "t",
    predictionDigit: 9,
    maxRuns: 50,
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
        <div className="grid gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
          {BOT_PRESETS.map((b) => (
            <div
              key={b.id}
              className="group relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-card p-4 shadow-xl transition-all hover:border-primary/50 sm:p-6"
            >
              <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  <b.icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-bold tracking-tight">{b.name}</div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {b.desc}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.market}
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.tradeType.replace("_", " ")}
                    </span>
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {b.contractType}
                    </span>
                  </div>

                  <div className="mt-6">
                    <Button asChild size="lg" className="w-full rounded-xl font-bold shadow-glow">
                      {user ? (
                        <Link
                          to="/bot-builder"
                          search={{ preset: b.id }}
                          onClick={() => markDeployedBotPresetId(user.id, b.id)}
                        >
                          Deploy Bot
                        </Link>
                      ) : (
                        <Link to="/auth" search={{ mode: "signin" }}>
                          Sign in to deploy
                        </Link>
                      )}
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
