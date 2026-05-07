import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  TrendingUp,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  Plug,
  CircleDot,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/contexts/deriv-balance";
import { Button } from "@/components/ui/button";
import { buildOAuthUrl } from "@/lib/deriv";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const CURRENCY_FLAG: Record<string, string> = {
  USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧", AUD: "🇦🇺",
  CAD: "🇨🇦", CHF: "🇨🇭", JPY: "🇯🇵", NZD: "🇳🇿",
  tUSDT: "🇺🇸", BTC: "🇺🇸", ETH: "🇺🇸",
};

const items = [
  { to: "/dashboard/trade", label: "Trade", icon: TrendingUp },
  { to: "/dashboard/bot", label: "Bot", icon: Bot },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { account, accounts, balance, currency, switchAccount, logout } = useDerivBalance();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [user, loading, navigate]);

  async function handleLogout() {
    await logout();
    navigate({ to: "/" });
  }

  function connectDeriv() {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    window.location.href = buildOAuthUrl();
  }

  if (loading || !user) return null;

  const flag = account ? (CURRENCY_FLAG[currency] ?? (account.is_demo ? "🎮" : "🇺🇸")) : null;

  return (
    <div className="dark flex min-h-dvh">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-glass-border bg-sidebar/70 backdrop-blur-xl md:flex">
        <Link to="/" className="flex h-16 items-center gap-2.5 border-b border-glass-border px-5">
          <div className="size-6 rotate-45 rounded-sm bg-primary" />
          <span className="font-semibold tracking-tight">ArkTrader</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                }`}
              >
                <Icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-glass-border p-3">
          <Link
            to="/"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 mb-1"
          >
            ← Manual Traders
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-glass-border bg-background/60 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3 text-sm">
            <CircleDot
              className={`size-3.5 ${account ? "text-success" : "text-muted-foreground"}`}
            />
            <span className="text-muted-foreground">
              {account ? (
                <>
                  {flag && <span className="mr-1">{flag}</span>}
                  <span className="font-mono text-foreground">{account.account_id}</span>
                  <span className="ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                    {account.is_demo ? "Demo" : "Live"}
                  </span>
                </>
              ) : (
                "No Deriv account connected"
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {account ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-left transition hover:bg-foreground/[0.05]">
                    {flag && <span className="text-base">{flag}</span>}
                    <div className="leading-tight">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {account.is_demo ? "Demo" : "Real"} {currency}
                      </div>
                      <div className="font-mono text-sm font-semibold text-foreground tabular-nums">
                        {(balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                      </div>
                    </div>
                    <ChevronDown className="size-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {accounts.map((a) => (
                    <DropdownMenuItem
                      key={a.account_id}
                      onClick={() => switchAccount(a.account_id)}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {CURRENCY_FLAG[a.currency] ?? (a.is_demo ? "🎮" : "🇺🇸")}
                        </span>
                        <div className="leading-tight">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
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
                  <DropdownMenuItem onClick={connectDeriv} className="gap-2 text-muted-foreground">
                    <Plug className="size-3.5" /> Add / reconnect account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="gap-2 text-red-600 focus:text-red-600">
                    <LogOut className="size-3.5" /> Disconnect &amp; sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={connectDeriv} size="sm">
                <Plug className="mr-1 size-4" /> Connect Deriv
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-8 pb-24 md:px-8 md:pb-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="sticky bottom-0 z-20 grid grid-cols-4 border-t border-glass-border bg-background/80 backdrop-blur md:hidden">
          {items.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
