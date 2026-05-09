import { createFileRoute, Link } from "@tanstack/react-router";
import { TopShell, PageHero } from "@/components/top-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy Trading — ArkTrader Hub" },
      { name: "description", content: "Mirror top Deriv traders automatically." },
    ],
  }),
  component: CopyTrading,
});

const TRADERS = [
  { name: "AlphaQuant", roi: "+182%", followers: 1240 },
  { name: "VolMaster", roi: "+97%", followers: 856 },
  { name: "DigitWizard", roi: "+64%", followers: 523 },
];

function CopyTrading() {
  return (
    <TopShell>
      <PageHero
        title="Copy Trading"
        subtitle="Follow top traders and automatically mirror their trades on your Deriv account."
      >
        <div className="grid gap-4 md:grid-cols-3">
          {TRADERS.map((t) => (
            <div
              key={t.name}
              className="rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_265)] to-[oklch(0.4_0.2_280)]" />
                <div>
                  <div className="text-base font-semibold">{t.name}</div>
                  <div className="text-xs text-[oklch(0.5_0.02_260)]">{t.followers} followers</div>
                </div>
              </div>
              <div className="mt-3 text-2xl font-bold text-[oklch(0.55_0.18_150)]">{t.roi}</div>
              <div className="text-xs text-[oklch(0.5_0.02_260)]">12-month ROI</div>
              <Button
                asChild
                size="sm"
                className="mt-4 w-full bg-[oklch(0.55_0.22_265)] text-white"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Copy
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </PageHero>
    </TopShell>
  );
}
