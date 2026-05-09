import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Bot,
  BarChart3,
  Settings,
  LogOut,
  CircleDot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { TopShell } from "@/components/top-shell";
import { disconnectAll } from "@/lib/deriv";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
});

const items = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/", label: "Trade", icon: TrendingUp, exact: true },
  { to: "/bot-builder", label: "Bot", icon: Bot, exact: true },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
];

function DashboardLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account } = useDerivBalanceContext();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [user, loading, navigate]);

  async function logout() {
    if (user) {
      await supabase.from("sessions").update({ is_active: false }).eq("user_id", user.id);
    }
    disconnectAll();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" } });
  }

  if (loading || !user) return null;

  return (
    <TopShell>
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-[oklch(0.92_0.005_240)] bg-white/70 backdrop-blur-xl md:flex">
          {/* Connected account badge */}
          {account && (
            <div className="border-b border-[oklch(0.92_0.005_240)] px-4 py-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <CircleDot className="size-3 shrink-0 text-[oklch(0.7_0.17_150)]" />
                <span className="truncate font-mono text-xs text-[oklch(0.3_0.02_260)]">
                  {account.account_id}
                </span>
                <span
                  className={[
                    "shrink-0 rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                    account.is_demo
                      ? "bg-[oklch(0.96_0.005_240)] text-[oklch(0.5_0.02_260)]"
                      : "bg-[oklch(0.93_0.06_150)] text-[oklch(0.35_0.12_150)]",
                  ].join(" ")}
                >
                  {account.is_demo ? "Demo" : "Live"}
                </span>
              </div>
            </div>
          )}

          <nav className="flex-1 space-y-0.5 p-3">
            {items.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[oklch(0.7_0.17_150)] text-white shadow-sm"
                      : "text-[oklch(0.35_0.02_260)] hover:bg-[oklch(0.96_0.005_240)] hover:text-[oklch(0.2_0.02_260)]",
                  ].join(" ")}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[oklch(0.92_0.005_240)] p-3">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-[oklch(0.5_0.02_260)] transition-colors hover:bg-[oklch(0.96_0.005_240)]"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex min-w-0 flex-1 flex-col bg-[oklch(0.985_0.003_240)]">
          <main className="flex-1 px-4 py-6 pb-20 md:px-8 md:pb-8">
            <Outlet />
          </main>

          {/* Mobile bottom nav */}
          <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t border-[oklch(0.92_0.005_240)] bg-white/90 backdrop-blur md:hidden">
            {items.map((item) => {
              const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={[
                    "flex flex-col items-center gap-0.5 py-2 text-[10px]",
                    active ? "text-[oklch(0.7_0.17_150)]" : "text-[oklch(0.5_0.02_260)]",
                  ].join(" ")}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </TopShell>
  );
}
