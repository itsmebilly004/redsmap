import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/hooks/use-deriv-balance";
import { buildOAuthUrl } from "@/lib/deriv";
import {
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
  LogIn,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

type TabDef = {
  to: string;
  label: string;
  icon: typeof LineChartIcon;
};

// Currency → flag emoji map for common Deriv currencies
const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  JPY: "🇯🇵",
  NZD: "🇳🇿",
  SGD: "🇸🇬",
  // tUSDT and crypto currencies get the US flag on real accounts
  tUSDT: "🇺🇸",
  BTC: "🇺🇸",
  ETH: "🇺🇸",
  LTC: "🇺🇸",
  USDC: "🇺🇸",
};

function getAccountFlag(isDemo: boolean, currency: string): string {
  if (isDemo) return "🎮";
  return CURRENCY_FLAG[currency] ?? "🇺🇸";
}

export const TOP_TABS: TabDef[] = [
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, accounts, balance, currency, switchAccount, logout } = useDerivBalance();

  async function handleLogout() {
    await logout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-dvh bg-[oklch(0.985_0.003_240)] text-[oklch(0.2_0.02_260)]">
      {/* ── Header ── */}
      <header className="flex h-14 items-center justify-between gap-2 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 md:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="size-5 rotate-45 rounded-sm bg-[oklch(0.72_0.17_55)] md:size-6" />
          <span className="hidden text-base font-bold tracking-tight text-[oklch(0.72_0.17_55)] sm:block md:text-lg">
            ArkTrader Hub
          </span>
          <span className="text-base font-bold tracking-tight text-[oklch(0.72_0.17_55)] sm:hidden">
            ArkTrader
          </span>
        </Link>

        <div className="flex items-center gap-1.5 md:gap-2">
          {/* Balance / account switcher (shown when logged in and has account) */}
          {user && account && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border border-[oklch(0.92_0.005_240)] bg-white px-2 py-1.5 text-left transition hover:bg-[oklch(0.97_0.003_240)] md:gap-2 md:px-3">
                  <span className="text-base leading-none">
                    {getAccountFlag(account.is_demo, currency)}
                  </span>
                  <div className="leading-tight">
                    <div className="hidden text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)] sm:block">
                      {account.is_demo ? "Demo" : "Real"} {currency}
                    </div>
                    <div className="font-mono text-xs font-semibold tabular-nums sm:text-sm">
                      {(balance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      <span className="hidden sm:inline">{currency}</span>
                    </div>
                  </div>
                  <ChevronDown className="size-3.5 text-[oklch(0.5_0.02_260)]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {accounts.map((a) => (
                  <DropdownMenuItem
                    key={a.account_id}
                    onClick={() => switchAccount(a.account_id)}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{getAccountFlag(a.is_demo, a.currency)}</span>
                      <div className="leading-tight">
                        <div className="text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)]">
                          {a.is_demo ? "Demo" : "Real"} {a.currency}
                        </div>
                        <div className="font-mono text-xs">{a.account_id}</div>
                      </div>
                    </div>
                    <span className="font-mono text-xs tabular-nums">
                      {Number(a.balance ?? 0).toFixed(2)} {a.currency}
                    </span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => (window.location.href = buildOAuthUrl())}
                  className="gap-2 text-[oklch(0.5_0.02_260)]"
                >
                  <Plug className="size-3.5" />
                  Add / reconnect account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="gap-2 text-red-600 focus:text-red-600"
                >
                  <LogOut className="size-3.5" />
                  Disconnect &amp; sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Connect Deriv (logged in but no Deriv account linked) */}
          {user && !account && (
            <div className="flex items-center gap-2">
              <Button
                onClick={() => (window.location.href = buildOAuthUrl())}
                size="sm"
                className="h-8 rounded-md bg-[oklch(0.72_0.17_55)] px-2 text-xs text-white hover:bg-[oklch(0.65_0.17_55)] md:h-9 md:px-4 md:text-sm"
              >
                <Plug className="mr-1 size-3.5" />
                <span className="hidden sm:inline">Connect Deriv</span>
                <span className="sm:hidden">Connect</span>
              </Button>
              <Button
                onClick={handleLogout}
                size="sm"
                variant="ghost"
                className="h-8 rounded-md px-2 text-xs text-[oklch(0.5_0.02_260)] md:h-9 md:px-3"
              >
                <LogOut className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Not logged in */}
          {!user && (
            <>
              <Button
                asChild
                size="sm"
                className="h-8 rounded-md bg-[oklch(0.55_0.22_265)] px-2 text-xs font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)] md:h-9 md:px-5 md:text-sm"
              >
                <Link to="/auth" search={{ mode: "signin" }}>
                  <LogIn className="mr-1 size-3.5 sm:hidden" />
                  <span className="hidden sm:inline">Log in</span>
                  <span className="sm:hidden">Login</span>
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="hidden h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 text-sm font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)] sm:flex"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* ── Tab navigation ── */}
      <nav className="border-b border-[oklch(0.92_0.005_240)] bg-white">
        <div className="flex items-center overflow-x-auto px-2 scrollbar-none">
          {TOP_TABS.map((t) => {
            const active =
              t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-sm",
                  active
                    ? "bg-[oklch(0.7_0.17_150)] text-white"
                    : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
                ].join(" ")}
              >
                <Icon className="size-3.5 md:size-4" />
                <span className={active ? "uppercase tracking-wide" : ""}>
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main>{children}</main>

      {/* ── AI assistant FAB ── */}
      <button
        aria-label="AI assistant"
        className="fixed bottom-6 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_300)] to-[oklch(0.4_0.2_280)] text-white shadow-[0_10px_30px_-5px_oklch(0.4_0.2_280_/_0.6)] transition-transform hover:scale-105 md:right-6 md:size-14"
      >
        <Sparkles className="size-4 md:size-5" />
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[oklch(0.7_0.17_150)] md:size-3" />
        <span className="absolute -bottom-1 text-[9px] font-bold md:text-[10px]">AI</span>
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
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <h1 className="text-2xl font-bold tracking-tight md:text-4xl">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-[oklch(0.45_0.02_260)] md:text-base">
        {subtitle}
      </p>
      {children && <div className="mt-6 md:mt-8">{children}</div>}
    </div>
  );
}
