import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { buildOAuthUrl, disconnectAll } from "@/lib/deriv";
import { supabase } from "@/integrations/supabase/client";
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
  LogOut,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ReactNode, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

// Metadata for currencies to match the screenshot's naming and flags
const CURRENCY_META: Record<string, { flag: string; name: string; color?: string }> = {
  USD: { flag: "🇺🇸", name: "US Dollar" },
  EUR: { flag: "🇪🇺", name: "Euro" },
  GBP: { flag: "🇬🇧", name: "Pound Sterling" },
  AUD: { flag: "🇦🇺", name: "Australian Dollar" },
  tUSDT: { flag: "₮", name: "Tether TRC20", color: "text-emerald-500" },
  USDT: { flag: "₮", name: "Tether", color: "text-emerald-500" },
  BTC: { flag: "₿", name: "Bitcoin", color: "text-orange-500" },
  ETH: { flag: "Ξ", name: "Ethereum", color: "text-blue-500" },
  LTC: { flag: "Ł", name: "Litecoin" },
};

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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, accounts, balance, currency, switchAccount } = useDerivBalanceContext();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const activeMeta = currency ? CURRENCY_META[currency] : null;

  const realAccounts = useMemo(() => accounts.filter((a) => !a.is_demo), [accounts]);
  const demoAccounts = useMemo(() => accounts.filter((a) => a.is_demo), [accounts]);

  async function handleLogout() {
    if (user) {
      await supabase.from("sessions").update({ is_active: false }).eq("user_id", user.id);
    }
    disconnectAll();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" } });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[oklch(0.985_0.003_240)] text-[oklch(0.2_0.02_260)]">
      <header className="flex h-14 items-center justify-between border-b border-[oklch(0.92_0.005_240)] bg-white px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 rotate-45 rounded-sm bg-[oklch(0.72_0.17_55)]" />
          <span className="text-lg font-bold tracking-tight text-[oklch(0.72_0.17_55)]">
            ArkTrader Hub
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {user && account && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 rounded-full border border-[oklch(0.92_0.005_240)] bg-white px-3 py-1 text-left transition hover:bg-[oklch(0.97_0.003_240)]">
                  <span className="flex size-6 items-center justify-center rounded-full bg-slate-100 text-xs shadow-inner">
                    {activeMeta?.flag ?? "💰"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-sm font-bold tabular-nums">
                      {(balance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[11px] font-bold text-[oklch(0.4_0.02_260)]">
                      {currency}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-[oklch(0.5_0.02_260)] transition-transform duration-200",
                      dropdownOpen && "rotate-180",
                    )}
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl">
                <Tabs defaultValue={account.is_demo ? "demo" : "real"} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-none border-b h-12 bg-white p-0">
                    <TabsTrigger
                      value="real"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-rose-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Real
                    </TabsTrigger>
                    <TabsTrigger
                      value="demo"
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-rose-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                    >
                      Demo
                    </TabsTrigger>
                  </TabsList>

                  <div className="p-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-tight text-[oklch(0.4_0.02_260)]">
                      <span>Deriv accounts</span>
                      <ChevronUp className="size-3" />
                    </div>

                    <TabsContent value="real" className="mt-0 space-y-1">
                      {realAccounts.length === 0 ? (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                          No real accounts linked.
                        </div>
                      ) : (
                        realAccounts.map((a) => (
                          <AccountItem
                            key={a.account_id}
                            account={a}
                            isActive={account.account_id === a.account_id}
                            onSelect={() => {
                              switchAccount(a.account_id);
                              setDropdownOpen(false);
                            }}
                          />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="demo" className="mt-0 space-y-1">
                      {demoAccounts.map((a) => (
                        <AccountItem
                          key={a.account_id}
                          account={a}
                          isActive={account.account_id === a.account_id}
                          onSelect={() => {
                            switchAccount(a.account_id);
                            setDropdownOpen(false);
                          }}
                        />
                      ))}
                    </TabsContent>
                  </div>
                </Tabs>

                <div className="border-t bg-slate-50/50 p-3">
                  <p className="mb-4 text-center text-[11px] text-[oklch(0.4_0.15_25)]">
                    Looking for CFD accounts?{" "}
                    <a href="#" className="font-bold text-rose-500 hover:underline">
                      Go to Trader's Hub
                    </a>
                  </p>
                  <div className="flex items-center justify-between border-t pt-3">
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold">
                      Manage accounts
                    </Button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-1.5 text-xs font-bold text-[oklch(0.4_0.02_260)] hover:text-rose-500"
                    >
                      Logout <LogOut className="size-3.5" />
                    </button>
                  </div>
                </div>
              </DropdownMenuContent>
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

          {!user && (
            <div className="flex gap-2">
              <Button variant="ghost" asChild className="h-9 px-4 text-sm font-medium">
                <Link to="/auth" search={{ mode: "signin" }}>Log in</Link>
              </Button>
              <Button asChild className="h-9 bg-[oklch(0.55_0.22_265)] px-4 text-sm font-medium text-white shadow-sm">
                <Link to="/auth" search={{ mode: "signup" }}>Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <nav className="border-b border-[oklch(0.92_0.005_240)] bg-white">
        <div className="flex items-center overflow-x-auto px-2">
          {TOP_TABS.map((t) => {
            const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-[oklch(0.7_0.17_150)] text-white"
                    : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
                )}
              >
                <Icon className="size-4" />
                <span className={active ? "uppercase tracking-wide" : ""}>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex flex-1 flex-col">{children}</main>

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

function AccountItem({
  account,
  isActive,
  onSelect,
}: {
  account: any;
  isActive: boolean;
  onSelect: () => void;
}) {
  const meta = CURRENCY_META[account.currency ?? ""] ?? { flag: "💰", name: account.currency };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg p-2.5 transition",
        isActive ? "bg-slate-100" : "hover:bg-slate-50",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-base shadow-sm ring-1 ring-slate-100">
          {meta.flag}
        </span>
        <div className="text-left leading-tight">
          <div className="text-xs font-bold text-[oklch(0.2_0.02_260)]">{meta.name}</div>
          <div className="text-[10px] font-medium text-[oklch(0.5_0.02_260)] uppercase">
            {account.account_id}
          </div>
        </div>
      </div>
      <div className="text-right leading-tight">
        <div className="font-mono text-xs font-bold">
          {Number(account.balance ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        <div className="text-[10px] font-bold text-[oklch(0.4_0.02_260)]">{account.currency}</div>
      </div>
    </button>
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