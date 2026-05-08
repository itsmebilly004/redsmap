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
      <header className="flex h-14 items-center justify-between border-b border-[#e5e5e5] bg-[#0e0e10] px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-5 rotate-45 rounded-sm bg-[#ff444f]" />
          <span className="text-base font-bold tracking-tight text-white">ArkTrader Hub</span>
        </Link>

        <div className="flex items-center gap-4">
          {user && account && (
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <button className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[#333] transition hover:bg-slate-50 focus:outline-none shadow-sm">
                  <span className="flex size-5 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[10px]">
                    {CURRENCY_META[currency]?.flag ?? "💰"}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-sm font-bold tracking-tight">
                      {(balance ?? 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-[12px] font-bold uppercase">{currency}</span>
                  </div>
                  <ChevronDown className={cn("size-4 transition-transform text-[#666]", dropdownOpen && "rotate-180")} />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-[340px] rounded-xl border-none bg-[#15171a] p-0 shadow-2xl overflow-hidden">
                <Tabs defaultValue={account.is_demo ? "demo" : "real"} className="w-full">
                  <TabsList className="grid h-12 w-full grid-cols-2 bg-white p-0 rounded-none border-b border-slate-100">
                    <TabsTrigger
                      value="real"
                      className="h-full rounded-none border-b-2 border-transparent text-[13px] font-bold text-[#999] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333] shadow-none"
                    >
                      Real
                    </TabsTrigger>
                    <TabsTrigger
                      value="demo"
                      className="h-full rounded-none border-b-2 border-transparent text-[13px] font-bold text-[#999] data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333] shadow-none"
                    >
                      Demo
                    </TabsTrigger>
                  </TabsList>

                  <div className="px-3 pt-4 pb-3">
                    <div className="mb-3 flex items-center justify-between px-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#9ea3a8]">Deriv accounts</span>
                      <ChevronUp className="size-3.5 text-[#9ea3a8]" />
                    </div>

                    <TabsContent value="real" className="mt-0 space-y-2">
                      {realAccounts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-slate-500">No real accounts linked.</div>
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

                    <TabsContent value="demo" className="mt-0 space-y-2">
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

                <div className="border-t border-[#2a2e33] bg-[#3e4247] px-4 py-5">
                  <p className="mb-5 text-center text-[13px] font-medium leading-relaxed text-white">
                    Looking for CFD accounts?{" "}
                    <a href="#" className="font-bold text-[#ff444f] hover:underline">
                      Go to Trader's Hub
                    </a>
                  </p>
                  <div className="flex items-center justify-between border-t border-white/10 pt-4">
                    <button className="h-9 rounded-lg bg-[#0e0e10] px-5 text-[13px] font-bold text-white transition hover:bg-black">
                      Manage accounts
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-[13px] font-bold text-[#9ea3a8] transition hover:text-white"
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
              className="h-9 rounded-lg bg-[#ff444f] px-4 text-xs font-bold text-white hover:bg-[#eb3e48]"
            >
              <Plug className="mr-1.5 size-3.5" /> Connect Deriv
            </Button>
          )}

          <Button className="h-9 rounded-lg bg-[#ff444f] px-6 text-sm font-bold text-white hover:bg-[#eb3e48] shadow-lg shadow-red-500/20">
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
        "flex w-full items-center justify-between rounded-xl px-4 py-3 transition text-left",
        isActive ? "bg-white" : "hover:bg-white/5",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-slate-50 text-lg shadow-inner ring-1 ring-slate-100">
          {meta.flag}
        </span>
        <div className="flex flex-col">
          <span className={cn("text-[14px] font-bold leading-none", isActive ? "text-[#0e0e10]" : "text-white")}>
            {meta.name}
          </span>
          <span className={cn("mt-1.5 text-[11px] font-bold uppercase leading-none", isActive ? "text-[#666]" : "text-[#9ea3a8]")}>
            {account.account_id}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className={cn("font-mono text-[15px] font-bold leading-none tracking-tight", isActive ? "text-[#0e0e10]" : "text-white")}>
          {Number(account.balance ?? 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className={cn("mt-1.5 text-[11px] font-bold uppercase leading-none", isActive ? "text-[#666]" : "text-[#9ea3a8]")}>
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