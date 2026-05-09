import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell } from "@/components/top-shell";
import {
  TrendingUp,
  Hash,
  CheckSquare,
  ArrowUp,
  ArrowDownUp,
  Target,
  Sparkles,
  Zap,
  ArrowRight,
} from "lucide-react";
import { STRATEGIES } from "@/lib/strategies";

export const Route = createFileRoute("/strategies")({
  head: () => ({
    meta: [
      { title: "Advanced Trading Strategies — ArkTrader Hub" },
      {
        name: "description",
        content:
          "Browse beginner-friendly trading strategies with detailed execution guidelines for Deriv synthetic indices.",
      },
    ],
  }),
  component: Strategies,
});

const ICONS = {
  "over-under": { Icon: TrendingUp, color: "text-blue-600" },
  odd: { Icon: Hash, color: "text-pink-500" },
  even: { Icon: CheckSquare, color: "text-emerald-500" },
  "hit-and-run": { Icon: ArrowUp, color: "text-rose-500" },
  "rise-fall": { Icon: ArrowDownUp, color: "text-indigo-500" },
  matches: { Icon: Target, color: "text-amber-500" },
  "martingale-recovery": { Icon: Sparkles, color: "text-violet-500" },
  scalping: { Icon: Zap, color: "text-orange-500" },
} as const;

function Strategies() {
  return (
    <TopShell>
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
        <header className="text-center">
          <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
            Advanced Trading Strategies
          </h1>
          <p className="mt-2 text-sm text-blue-600">
            Select a trading strategy to view detailed execution guidelines.
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {STRATEGIES.map((s) => {
            const meta = ICONS[s.slug as keyof typeof ICONS] ?? {
              Icon: Target,
              color: "text-slate-500",
            };
            const { Icon, color } = meta;
            return (
              <Link
                key={s.slug}
                to="/strategy/$slug"
                params={{ slug: s.slug }}
                className="group relative flex h-72 flex-col items-center justify-between rounded-xl bg-slate-50 p-6 text-center shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md hover:ring-blue-300"
              >
                <div className="mt-2">
                  <Icon className={`h-12 w-12 ${color}`} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-800">{s.name}</h2>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.tagline}</p>
                </div>
                <span className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition group-hover:border-blue-400 group-hover:text-blue-600">
                  Explore Strategy <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </TopShell>
  );
}
