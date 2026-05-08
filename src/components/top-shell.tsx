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

const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  USD: { flag: "🇺🇸", name: "US Dollar" },
  EUR: { flag: "🇪🇺", name: "Euro" },
  GBP: { flag: "🇬🇧", name: "Pound Sterling" },
  AUD: { flag: "🇦🇺", name: "Australian Dollar" },
  tUSDT: { flag: "₮", name: "Tether TRC20" },
  USDT: { flag: "₮", name: "Tether" },
  BTC: { flag: "₿", name: "Bitcoin" },
  ETH: { flag: "Ξ", name: "Ethereum" },
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
    <div className="flex min-h-dvh flex-col bg-[#f2f3f4] text-[#333333]">
      <header className="flex h-12 items-center justify-between border-b border-[#e5e5e5] bg-[#0e0e10] px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-5 rotate-45 rounded-sm bg-[#ff444f]" />
          <span className="text-base font-bold tracking-tight text-white">ArkTrader Hub</span>
        </Link>

        <div className="flex items-center gap-4">
          {user && account && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 text-white transition hover:opacity-80 focus:outline-none">
                  <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-white text-[10px]">
                    {CURRENCY_META[currency]?.flag ?? "💰"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm font-bold tracking-tight">
                      {(balance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[13px] font-semibold uppercase">{currency}</span>
                  </div>
                  <ChevronDown className={cn("size-4 transition-transform", dropdownOpen && "rotate-180")} />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[320px] rounded-lg border-none bg-white p-0 shadow-[0_8px_24px_rgba(0,0,0,0.15)] overflow-hidden">
                <Tabs defaultValue={account.is_demo ? "demo" : "real"} className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2 bg-white p-0 rounded-none border-b border-[#f2f3f4]">
                    <TabsTrigger
                      value="real"
                      className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#999] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333] shadow-none"
                    >
                      Real
                    </TabsTrigger>
                    <TabsTrigger
                      value="demo"
                      className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#999] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333] shadow-none"
                    >
                      Demo
                    </TabsTrigger>
                  </TabsList>

                  <div className="px-4 pt-4 pb-2">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-bold text-[#333]">Deriv accounts</span>
                      <ChevronUp className="size-4 text-[#333]" />
                    </div>

                    <TabsContent value="real" className="mt-0 space-y-1">
                      {realAccounts.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground">No real accounts linked.</div>
                      ) : (
                        realAccounts.map((a) => (
                          <AccountRow
                            key={a.account_id}
                            account={a}
                            activeId={account.account_id}
                            onClick={() => {
                              switchAccount(a.account_id);
                              setDropdownOpen(false);
                            }}
                          />
                        ))
                      )}
                    </TabsContent>

                    <TabsContent value="demo" className="mt-0 space-y-1">
                      {demoAccounts.map((a) => (
                        <AccountRow
                          key={a.account_id}
                          account={a}
                          activeId={account.account_id}
                          onClick={() => {
                            switchAccount(a.account_id);
                            setDropdownOpen(false);
                          }}
                        />
                      ))}
                    </TabsContent>
                  </div>
                </Tabs>

                <div className="mt-2 border-t border-[#f2f3f4] bg-white px-4 py-4">
                  <p className="mb-4 text-center text-[13px] leading-relaxed text-[#333]">
                    Looking for CFD accounts?{" "}
                    <a href="#" className="font-bold text-[#ff444f] hover:underline">
                      Go to Trader's Hub
                    </a>
                  </p>
                  <div className="flex items-center justify-between border-t border-[#f2f3f4] pt-4">
                    <button className="h-9 rounded border border-[#d6dadb] bg-white px-4 text-[13px] font-bold text-[#333] transition hover:bg-[#f2f3f4]">
                      Manage accounts
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-[13px] font-bold text-[#333] transition hover:text-[#ff444f]"
                    >
                      <span>Logout</span>
                      <LogOut className="size-4" />
                    </button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user && !account && (
            <Button
              onClick={() => (window.location.href = buildOAuthUrl())}
              className="h-8 rounded bg-[#ff444f] px-4 text-xs font-bold text-white hover:bg-[#eb3e48]"
            >
              <Plug className="mr-1.5 size-3.5" /> Connect Deriv
            </Button>
          )}

          <Button className="h-8 rounded bg-[#ff444f] px-5 text-xs font-bold text-white hover:bg-[#eb3e48]">
            Deposit
          </Button>
        </div>
      </header>

      <nav className="border-b border-[#e5e5e5] bg-[#0e0e10]">
        <div className="flex items-center overflow-x-auto px-2">
          {TOP_TABS.map((t) => {
            const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex shrink-0 items-center gap-2 px-4 py-3 text-xs font-bold transition-colors",
                  active ? "text-white" : "text-[#999999] hover:text-white",
                )}
              >
                <Icon className="size-4" />
                <span className="uppercase tracking-wide">{t.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

function AccountRow({ account, activeId, onClick }: { account: any; activeId: string; onClick: () => void }) {
  const isActive = account.account_id === activeId;
  const meta = CURRENCY_META[account.currency ?? ""] ?? { flag: "💰", name: account.currency };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between rounded px-3 py-2 transition text-left",
        isActive ? "bg-[#d6dadb]" : "hover:bg-[#f2f3f4]",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-white text-base shadow-sm ring-1 ring-[#f2f3f4]">
          {meta.flag}
        </span>
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-[#333] leading-none">{meta.name}</span>
          <span className="mt-1 text-[11px] font-semibold uppercase text-[#999] leading-none">
            {account.account_id}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono text-sm font-bold text-[#333] leading-none">
          {Number(account.balance ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase text-[#333] leading-none">
          {account.currency}
        </span>
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