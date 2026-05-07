import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/hooks/use-deriv-balance";
import { buildOAuthUrl } from "@/lib/deriv";
import {
  LayoutGrid,
  Bot,
  LineChart as LineChartIcon,
  BarChart3,
  Cpu,
  Microscope,
  Target,
  Users,
  CandlestickChart,
  Sparkles,
  Plug,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

type TabDef = {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
};

export const TOP_TABS: TabDef[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/bot-builder", label: "Bot Builder", icon: Bot },
  { to: "/", label: "Manual Traders", icon: LineChartIcon },
  { to: "/charts", label: "Charts", icon: BarChart3 },
  { to: "/trading-bots", label: "Trading Bots", icon: Cpu },
  { to: "/analysis", label: "Analysis Tool", icon: Microscope },
  { to: "/strategies", label: "Strategies", icon: Target },
  { to: "/copy-trading", label: "Copy Trading", icon: Users },
  { to: "/tradingview", label: "TradingView", icon: CandlestickChart },
];

export function TopShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, accounts, balance, currency, switchAccount } = useDerivBalance();

  return (
    <div className="min-h-dvh bg-[oklch(0.985_0.003_240)] text-[oklch(0.2_0.02_260)]">
      <header className="flex h-14 items-center justify-between border-b border-[oklch(0.92_0.005_240)] bg-white px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 rotate-45 rounded-sm bg-[oklch(0.72_0.17_55)]" />
          <span className="text-lg font-bold tracking-tight text-[oklch(0.72_0.17_55)]">
            ArkTrader Hub
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {user && account && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md border border-[oklch(0.92_0.005_240)] bg-white px-3 py-1.5 text-left transition hover:bg-[oklch(0.97_0.003_240)]">
                  <span className={`size-2 rounded-full ${account.is_demo ? "bg-[oklch(0.78_0.16_85)]" : "bg-[oklch(0.7_0.17_150)]"}`} />
                  <div className="leading-tight">
                    <div className="text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
                      {account.is_demo ? "Demo" : "Real"} {currency}
                    </div>
                    <div className="font-mono text-sm font-semibold tabular-nums">
                      {(balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                    </div>
                  </div>
                  {accounts.length > 1 && <ChevronDown className="size-4 text-[oklch(0.5_0.02_260)]" />}
                </button>
              </DropdownMenuTrigger>
              {accounts.length > 1 && (
                <DropdownMenuContent align="end" className="w-64">
                  {accounts.map((a) => (
                    <DropdownMenuItem
                      key={a.account_id}
                      onClick={() => switchAccount(a.account_id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${a.is_demo ? "bg-[oklch(0.78_0.16_85)]" : "bg-[oklch(0.7_0.17_150)]"}`} />
                        <div className="leading-tight">
                          <div className="text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
                            {a.is_demo ? "Demo" : "Real"} {a.currency ?? "USD"}
                          </div>
                          <div className="font-mono text-xs">{a.account_id}</div>
                        </div>
                      </div>
                      <span className="font-mono text-xs tabular-nums">
                        {Number(a.balance ?? 0).toFixed(2)}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              )}
            </DropdownMenu>
          )}
          {user && !account && (
            <Button
              onClick={() => (window.location.href = buildOAuthUrl())}
              className="h-9 rounded-md bg-[oklch(0.72_0.17_55)] px-4 text-white hover:bg-[oklch(0.65_0.17_55)]"
            >
              <Plug className="mr-1 size-4" /> Connect Deriv
            </Button>
          )}
          {user ? (
            <Button
              asChild
              className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 text-white hover:bg-[oklch(0.5_0.22_265)]"
            >
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)]"
              >
                <Link to="/auth" search={{ mode: "signin" }}>
                  Log in
                </Link>
              </Button>
              <Button
                asChild
                className="h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)]"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <nav className="border-b border-[oklch(0.92_0.005_240)] bg-white">
        <div className="flex items-center overflow-x-auto px-2">
          {TOP_TABS.map((t) => {
            const active =
              t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-[oklch(0.7_0.17_150)] text-white"
                    : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
                ].join(" ")}
              >
                <Icon className="size-4" />
                <span className={active ? "uppercase tracking-wide" : ""}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main>{children}</main>

      <button
        aria-label="AI assistant"
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_300)] to-[oklch(0.4_0.2_280)] text-white shadow-[0_10px_30px_-5px_oklch(0.4_0.2_280_/_0.6)] transition-transform hover:scale-105"
      >
        <Sparkles className="size-5" />
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[oklch(0.7_0.17_150)]" />
        <span className="absolute -bottom-1 text-[10px] font-bold">AI</span>
      </button>
    </div>
  );
}

export function PageHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-[oklch(0.45_0.02_260)]">{subtitle}</p>
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
