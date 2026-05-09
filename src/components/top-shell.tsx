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
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { isDerivDemoAccount, type DerivAccount } from "@/hooks/use-deriv-balance";

const CURRENCY_META: Record<string, { country?: string; name: string; symbol?: string }> = {
  AUD: { country: "au", name: "Australian Dollar" },
  BTC: { name: "Bitcoin", symbol: "B" },
  ETH: { name: "Ethereum", symbol: "E" },
  EUR: { country: "eu", name: "Euro" },
  GBP: { country: "gb", name: "British Pound" },
  LTC: { name: "Litecoin", symbol: "L" },
  tUSDT: { name: "Tether TRC20", symbol: "T" },
  USDC: { name: "USD Coin", symbol: "$" },
  USDT: { name: "Tether", symbol: "T" },
  USD: { country: "us", name: "US Dollar" },
};

function currencyMeta(currency?: string | null) {
  return CURRENCY_META[currency ?? ""] ?? { name: currency || "Trading account" };
}

function formatBalance(value?: number | null, currency?: string | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}${currency ? ` ${currency}` : ""}`;
}

function totalAssetsLabel(accounts: DerivAccount[]) {
  const totals = accounts.reduce<Record<string, number>>((acc, account) => {
    const currency = account.currency || "USD";
    acc[currency] = (acc[currency] ?? 0) + Number(account.balance ?? 0);
    return acc;
  }, {});
  const entries = Object.entries(totals);
  if (!entries.length) return "0.00 USD";
  return entries.map(([assetCurrency, amount]) => formatBalance(amount, assetCurrency)).join(" + ");
}

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
  const [activeAccountTab, setActiveAccountTab] = useState<"real" | "demo">("real");

  const realAccounts = useMemo(() => accounts.filter((a) => !isDerivDemoAccount(a)), [accounts]);
  const demoAccounts = useMemo(() => accounts.filter((a) => isDerivDemoAccount(a)), [accounts]);
  const visibleAccounts = activeAccountTab === "real" ? realAccounts : demoAccounts;

  useEffect(() => {
    if (account) {
      setActiveAccountTab(isDerivDemoAccount(account) ? "demo" : "real");
    }
  }, [account]);

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
            <>
              <Button className="hidden h-9 rounded-md bg-[#ff444f] px-5 text-sm font-bold text-white hover:bg-[#eb3e48] sm:inline-flex">
                Deposit
              </Button>
              <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <button className="flex min-w-0 items-center gap-2 rounded-full border border-[#d6d6d6] bg-white px-3 py-1.5 transition hover:bg-[#f2f3f4]">
                    <AccountIcon account={account} size="sm" />
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="text-sm font-bold tabular-nums text-[#333333]">
                        {formatBalance(balance ?? account.balance, "").trim()}
                      </span>
                      <span className="text-[11px] font-bold text-[#646464]">
                        {currency || account.currency}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-4 text-[#999999] transition-transform duration-200",
                        dropdownOpen && "rotate-180",
                      )}
                    />
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-[calc(100vw-24px)] max-w-[380px] overflow-hidden rounded-lg border border-[#d6d6d6] bg-white p-0 shadow-xl"
                >
                  <Tabs
                    value={activeAccountTab}
                    onValueChange={(value) => setActiveAccountTab(value as "real" | "demo")}
                    className="w-full"
                  >
                    <TabsList className="grid h-12 w-full grid-cols-2 rounded-none border-b border-[#eeeeee] bg-white p-0">
                      <TabsTrigger
                        value="real"
                        className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333] data-[state=active]:shadow-none"
                      >
                        Real
                      </TabsTrigger>
                      <TabsTrigger
                        value="demo"
                        className="h-full rounded-none border-b-2 border-transparent text-sm font-bold text-[#646464] shadow-none data-[state=active]:border-[#ff444f] data-[state=active]:bg-transparent data-[state=active]:text-[#333333] data-[state=active]:shadow-none"
                      >
                        Demo
                      </TabsTrigger>
                    </TabsList>

                    <div className="px-4 pb-2 pt-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-bold text-[#333333]">Deriv accounts</span>
                        <ChevronUp className="size-4 text-[#333333]" />
                      </div>

                      <TabsContent value="real" className="mt-0 space-y-1">
                        <AccountList
                          accounts={realAccounts}
                          activeAccountId={account.account_id}
                          emptyText="No real accounts linked."
                          onSelect={(accountId) => {
                            switchAccount(accountId);
                            setDropdownOpen(false);
                          }}
                        />
                      </TabsContent>

                      <TabsContent value="demo" className="mt-0 space-y-1">
                        <AccountList
                          accounts={demoAccounts}
                          activeAccountId={account.account_id}
                          emptyText="No demo accounts linked."
                          onSelect={(accountId) => {
                            switchAccount(accountId);
                            setDropdownOpen(false);
                          }}
                        />
                      </TabsContent>
                    </div>
                  </Tabs>

                  <div className="border-t border-[#eeeeee] bg-white px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-bold text-[#333333]">
                          {totalAssetsLabel(visibleAccounts)}
                        </div>
                        <div className="mt-0.5 text-xs text-[#777777]">
                          Total assets in your Deriv accounts.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#eeeeee] bg-[#f9f9f9] px-4 py-3 text-center">
                    <p className="text-[13px] text-[#333333]">
                      Looking for CFD accounts?{" "}
                      <a href="#" className="font-bold text-[#333333] hover:underline">
                        Go to Trader&apos;s Hub
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
            </>
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

function AccountList({
  accounts,
  activeAccountId,
  emptyText,
  onSelect,
}: {
  accounts: DerivAccount[];
  activeAccountId: string;
  emptyText: string;
  onSelect: (accountId: string) => void;
}) {
  if (!accounts.length) {
    return <div className="py-8 text-center text-xs text-[#999999]">{emptyText}</div>;
  }

  return (
    <>
      {accounts.map((account) => (
        <AccountItem
          key={account.account_id}
          account={account}
          isActive={activeAccountId === account.account_id}
          onSelect={() => onSelect(account.account_id)}
        />
      ))}
    </>
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
  const demo = isDerivDemoAccount(account);
  const meta = currencyMeta(account.currency);

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between rounded-lg p-3 transition-colors",
        isActive ? "bg-[#e6e9e9]" : "bg-transparent hover:bg-[#f2f3f4]",
      )}
    >
      <div className="flex items-center gap-3">
        <AccountIcon account={account} />
        <div className="min-w-0 text-left leading-tight">
          <div className="text-sm font-bold text-[#333333]">{demo ? "Demo" : meta.name}</div>
          <div className="text-[11px] font-medium text-[#999999]">{account.account_id}</div>
        </div>
      </div>
      <div className="shrink-0 pl-3 text-right leading-tight">
        <div className="text-sm font-bold text-[#333333]">
          {formatBalance(account.balance, account.currency)}
        </div>
      </div>
    </button>
  );
}

function AccountIcon({
  account,
  size = "md",
}: {
  account: Pick<
    DerivAccount,
    "account_id" | "loginid" | "currency" | "is_demo" | "is_virtual" | "account_type"
  >;
  size?: "sm" | "md";
}) {
  const demo = isDerivDemoAccount(account);
  const meta = currencyMeta(account.currency);
  const box = size === "sm" ? "size-5" : "size-8";
  const text = size === "sm" ? "text-[10px]" : "text-sm";

  if (demo) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-full bg-[#ff444f] text-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.04)]",
          box,
        )}
        title="Demo account"
      >
        <span className={cn("font-black leading-none", text)}>D</span>
        <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full border border-white bg-[#85acb0]" />
      </div>
    );
  }

  if (meta.country) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#f2f3f4] bg-white",
          box,
        )}
        title={meta.name}
      >
        <img
          src={`https://flagcdn.com/w40/${meta.country}.png`}
          srcSet={`https://flagcdn.com/w80/${meta.country}.png 2x`}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-[#d6d6d6] bg-white text-[#333333]",
        box,
      )}
      title={meta.name}
    >
      <span className={cn("font-bold leading-none", text)}>
        {meta.symbol ?? account.currency?.slice(0, 1) ?? "$"}
      </span>
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
      <p className="mt-2 max-w-2xl text-[#646464]">{subtitle}</p>
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
