import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  Plug,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { buildOAuthUrl } from "@/lib/deriv";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/dashboard/trade", label: "Trade", icon: TrendingUp },
  { to: "/dashboard/bot", label: "Bot", icon: Bot },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [account, setAccount] = useState<{
    deriv_account_id: string;
    balance: number | null;
    currency: string | null;
    is_demo: boolean;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("deriv_accounts")
      .select("deriv_account_id, balance, currency, is_demo")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_demo", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setAccount(data as any));
  }, [user, pathname]);

  async function logout() {
    await supabase.auth.signOut();
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

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-glass-border bg-sidebar/70 backdrop-blur-xl md:flex">
        <Link to="/" className="flex h-16 items-center gap-2.5 border-b border-glass-border px-5">
          <div className="size-6 rotate-45 rounded-sm bg-primary" />
          <span className="font-semibold tracking-tight">ArkTrader</span>
        </Link>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
          <button
            onClick={logout}
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
                  <span className="font-mono text-foreground">{account.deriv_account_id}</span>
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
              <div className="rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</div>
                <div className="font-mono text-sm text-foreground">
                  {Number(account.balance ?? 0).toFixed(2)} {account.currency}
                </div>
              </div>
            ) : (
              <Button onClick={connectDeriv} size="sm">
                <Plug className="mr-1 size-4" /> Connect Deriv
              </Button>
            )}
          </div>
        </header>

        <main className="flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t border-glass-border bg-background/80 backdrop-blur md:hidden">
          {items.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
