import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Bot, Play, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/bot-builder")({
  head: () => ({
    meta: [
      { title: "Bot Builder — ArkTrader Hub" },
      { name: "description", content: "Build automated Deriv trading bots with martingale, take-profit, and stop-loss controls." },
    ],
  }),
  component: BotBuilder,
});

function BotBuilder() {
  const { user } = useAuth();
  return (
    <TopShell>
      <PageHero
        title="Bot Builder"
        subtitle="Design and run automated strategies on synthetic indices. Sign in to save and launch your bots."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Bot, title: "No-code strategies", body: "Pick from Rise/Fall, Even/Odd, Over/Under, Accumulators and more." },
            { icon: Play, title: "Demo first", body: "Test every bot on a Deriv demo account before going live." },
            { icon: ShieldAlert, title: "Risk controls", body: "Set daily loss limits, max stake, and consecutive-loss guards." },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm">
              <c.icon className="mb-3 size-6 text-[oklch(0.55_0.22_265)]" />
              <div className="text-base font-semibold">{c.title}</div>
              <p className="mt-1 text-sm text-[oklch(0.5_0.02_260)]">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8">
          {user ? (
            <Button asChild className="bg-[oklch(0.55_0.22_265)] text-white hover:bg-[oklch(0.5_0.22_265)]">
              <Link to="/dashboard/bot">Open Bot Builder</Link>
            </Button>
          ) : (
            <Button asChild className="bg-[oklch(0.55_0.22_265)] text-white hover:bg-[oklch(0.5_0.22_265)]">
              <Link to="/auth" search={{ mode: "signup" }}>Sign up to build a bot</Link>
            </Button>
          )}
        </div>
      </PageHero>
    </TopShell>
  );
}
