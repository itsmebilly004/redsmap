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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type ReactNode, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { DerivAccount } from "@/hooks/use-deriv-balance";

// Metadata with specific image URLs to match the screenshot logos
const CURRENCY_META: Record<string, { img: string; name: string }> = {
  USD: {
    img: "https://upload.wikimedia.org/wikipedia/commons/a/a4/Flag_of_the_United_States.svg",
    name: "US Dollar",
  },
  tUSDT: {
    img: "https://static.cdnlogo.com/logos/t/58/tether.svg",
    name: "Tether TRC20",
  },
  USDT: {
    img: "https://static.cdnlogo.com/logos/t/58/tether.svg",
    name: "Tether",
  },
  BTC: {
    img: "https://upload.wikimedia.org/wikipedia/commons/4/46/Bitcoin.svg",
    name: "Bitcoin",
  },
  ETH: {
    img: "https://upload.wikimedia.org/wikipedia/commons/0/05/Ethereum_logo_2014.svg",
    name: "Ethereum",
  },
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

  async function handleConnectDeriv() {
    const url = await buildOAuthUrl({ returnTo: "/dashboard/settings" });
    console.log("Deriv OAuth URL:", url);
    window.location.href = url;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#f2f3f4] text-[#333333]">
      <header className="flex h-14 items-center justify-between border-b border-[#e5e5e5] bg-white px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 rotate-45 rounded-sm bg-[#ff444f]" />
          <span className="text-lg font-bold tracking-tight text-[#333333]">ArkTrader Hub</span>
        </Link>

        <div className="flex items-center gap-4">
          {user && account && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-1 transition hover:bg-[#f2f3f4]">
                  <div className="flex size-5 items-center justify-center overflow-hidden rounded-full border border-slate-100 bg-white">
                    {activeMeta?.img ? (
                      <img src={activeMeta.img} alt="" className="h-full w-full object-cover" />
                    ) : (
                      "💰"
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tabular-nums">
                      {(balance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[11px] font-bold text-[#646464]">{currency}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-[#999999] transition-transform duration-200",
                      dropdownOpen && "rotate-180",
                    )}
                  />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[320px] p-0 shadow-xl border-[#e5e5e5]">
                <Tabs defaultValue={account.is_demo ? "demo" : "real"} className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2 bg-white p-0">
                    <TabsTrigger
                      value="real"
                      className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333]"
                    >
                      Real
                    </TabsTrigger>
                    <TabsTrigger
                      value="demo"
                      className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333]"
                    >
                      Demo
                    </TabsTrigger>
                  </TabsList>

                  <div className="px-4 pt-4 pb-2">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-[#333333]">Deriv accounts</span>
                      <ChevronUp className="size-4 text-[#333333]" />
                    </div>

                    <TabsContent value="real" className="mt-0 space-y-1">
                      {realAccounts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#999999]">
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

                <div className="mt-2 border-t border-[#f2f3f4] bg-[#f9f9f9] py-3 text-center">
                  <p className="text-[13px] text-[#333333]">
                    Looking for CFD accounts?{" "}
                    <a href="#" className="font-bold text-[#333333] hover:underline">
                      Go to Trader's Hub
                    </a>
                  </p>
                </div>

                <div className="flex items-center justify-between bg-white px-4 py-3">
                  <Button
                    variant="outline"
                    className="h-9 rounded-md border-[#999999] px-4 text-sm font-bold text-[#333333] hover:bg-[#f2f3f4]"
                  >
                    Manage accounts
                  </Button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-[#333333] hover:text-[#ff444f]"
                  >
                    Logout <LogOut className="size-4" />
                  </button>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user && !account && (
            <Button
              onClick={handleConnectDeriv}
              className="h-9 rounded-md bg-[#ff444f] px-4 text-white hover:bg-[#eb3e48]"
            >
              <Plug className="mr-1 size-4" /> Connect Deriv
            </Button>
          )}

          {!user && (
            <div className="flex gap-2">
              <Button variant="ghost" asChild className="h-9 px-4 text-sm font-medium">
                <Link to="/auth" search={{ mode: "signin" }}>
                  Log in
                </Link>
              </Button>
              <Button
                asChild
                className="h-9 bg-[#3e3e3e] px-4 text-sm font-medium text-white shadow-sm"
              >
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </div>
          )}
        </div>
      </header>

      <nav className="border-b border-[#e5e5e5] bg-white">
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
                  active ? "bg-[#4bb4b3] text-white" : "text-[#333333] hover:bg-[#f2f3f4]",
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
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[#8e44ad] to-[#2c3e50] text-white shadow-lg transition-transform hover:scale-105"
      >
        <Sparkles className="size-5" />
        <span className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#4bb4b3]" />
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
  account: DerivAccount;
  isActive: boolean;
  onSelect: () => void;
}) {
  const meta = CURRENCY_META[account.currency ?? ""] ?? { img: "", name: account.currency };

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg p-3 transition-colors",
        isActive ? "bg-[#e6e9e9]" : "bg-transparent hover:bg-[#f2f3f4]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center overflow-hidden rounded-full border border-[#f2f3f4] bg-white">
          {meta.img ? <img src={meta.img} alt="" className="h-full w-full object-cover" /> : "💰"}
        </div>
        <div className="text-left leading-tight">
          <div className="text-sm font-bold text-[#333333]">{meta.name}</div>
          <div className="text-[11px] font-medium text-[#999999]">{account.account_id}</div>
        </div>
      </div>
      <div className="text-right leading-tight">
        <div className="text-sm font-bold text-[#333333]">
          {Number(account.balance ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {account.currency}
        </div>
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
      <p className="mt-2 max-w-2xl text-[#646464]">{subtitle}</p>
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
