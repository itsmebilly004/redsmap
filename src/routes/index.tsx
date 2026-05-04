import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Bot, LineChart, ShieldCheck, ArrowRight, Activity } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-40 -left-20 size-[600px] rounded-full bg-primary/10 blur-[140px]" />
          <div className="absolute -bottom-40 -right-20 size-[600px] rounded-full bg-indigo-500/10 blur-[140px]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-12 lg:py-32">
          <div className="lg:col-span-7">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 animate-pulse rounded-full bg-primary" />
              Connected to Deriv L1 Liquidity
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Trade Smarter with <span className="text-primary">Automation</span>
            </h1>
            <p className="mt-8 max-w-xl text-pretty text-lg text-muted-foreground">
              Orchestrate complex strategies on synthetic indices. A unified terminal for your Deriv
              account — designed for absolute precision and built-in risk control.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button asChild size="lg" className="h-12 px-7 text-base shadow-[0_0_30px_-5px_oklch(0.78_0.16_230_/_0.5)]">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base glass-card">
                <Link to="/auth" search={{ mode: "signin" }}>Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sign in or sign up redirects you to Deriv's official OAuth. We never see your password.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="glass-card glow-primary rounded-2xl p-6">
              <div className="mb-6 flex items-center justify-between border-b border-glass-border pb-4">
                <div>
                  <div className="text-sm font-medium">Volatility 100 Index</div>
                  <div className="font-mono text-[11px] text-muted-foreground">Real-time stream</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg text-success">1,248.62</div>
                  <div className="font-mono text-xs text-success/80">+2.41%</div>
                </div>
              </div>
              <div className="flex h-32 items-end gap-1.5">
                {[60, 40, 80, 50, 90, 30, 70, 55, 75, 45, 85, 65].map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${i === 4 ? "bg-primary/30 border-t-2 border-primary" : "bg-foreground/5"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Risk/Reward", value: "1:2.4" },
                  { label: "Exposure", value: "$4,200", accent: true },
                  { label: "Latency", value: "14ms" },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                    <div className={`mt-1 font-mono text-sm ${s.accent ? "text-primary" : ""}`}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-y border-glass-border bg-foreground/[0.01]">
        <div className="mx-auto grid max-w-7xl divide-glass-border md:grid-cols-3 md:divide-x">
          {[
            {
              icon: Bot,
              tag: "01 — Execution",
              title: "Auto Trading",
              text: "Deploy strategies that react to market shifts faster than manual execution. Low-latency engine built for the Deriv API.",
            },
            {
              icon: LineChart,
              tag: "02 — Intelligence",
              title: "Real-time Analytics",
              text: "Live equity curves, win rate, and P&L breakdowns. Visualize every decision your bot makes with raw precision.",
            },
            {
              icon: ShieldCheck,
              tag: "03 — Safety",
              title: "Risk Control",
              text: "Multi-layer safeguards — daily loss limits, max stake, consecutive-loss cutoffs, and an emergency stop.",
            },
          ].map((f) => (
            <div key={f.title} className="p-10">
              <f.icon className="mb-6 size-6 text-primary" />
              <div className="font-mono text-[11px] uppercase tracking-widest text-primary">{f.tag}</div>
              <h3 className="mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-7xl px-6 py-24">
        <div className="mb-12 max-w-2xl">
          <div className="font-mono text-xs uppercase tracking-widest text-primary">How it works</div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">From sign-up to first trade in three steps.</h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { step: "01", title: "Click Sign up", text: "We hand you off to Deriv to register or log in on their official site." },
            { step: "02", title: "Authorize ArkTrader", text: "Deriv sends back a trading token. We never see your Deriv password." },
            { step: "03", title: "Trade or automate", text: "Place Rise/Fall, digits, accumulators, multipliers — or run a bot. Demo by default." },
          ].map((s) => (
            <div key={s.step} className="glass-card rounded-xl p-6">
              <div className="font-mono text-2xl text-primary">{s.step}</div>
              <h3 className="mt-3 text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Disclaimer */}
      <section id="disclaimer" className="mx-auto max-w-7xl px-6 pb-24">
        <div className="glass-card flex flex-col items-start gap-4 rounded-xl border-warning/30 p-6 md:flex-row md:items-center">
          <Activity className="size-6 text-warning" />
          <div className="flex-1">
            <div className="font-medium">Risk disclaimer</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Trading involves substantial risk. You can lose money rapidly with leveraged products and
              automated strategies. ArkTrader Hub does not guarantee profit. Always start in demo mode
              and only trade with capital you can afford to lose.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
