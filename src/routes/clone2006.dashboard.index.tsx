import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Activity, ArrowDownRight, ArrowUpRight, Bot, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  buildOAuthUrl,
  redirectToDerivOAuth,
  sanitizeDerivOAuthUrl,
  SYNTHETIC_MARKETS,
} from "@/lib/deriv";
import { Link } from "@tanstack/react-router";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export const Route = createFileRoute("/clone2006/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { user } = useAuth();
  const [hasDeriv, setHasDeriv] = useState<boolean | null>(null);
  const [trades, setTrades] = useState<Tables<"trades">[]>([]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let cancelled = false;
    supabase
      .from("sessions")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .then(({ data, error }) => {
        if (!cancelled && !error) setHasDeriv((data?.length ?? 0) > 0);
      });
    const loadTrades = () =>
      supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5)
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error) {
            console.error("[Dashboard] Failed to load trades", error);
            return;
          }
          setTrades(data ?? []);
        });
    void loadTrades();
    const channel = supabase
      .channel(`dashboard-trades-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trades", filter: `user_id=eq.${userId}` },
        () => {
          void loadTrades();
        },
      )
      .subscribe();
    // Fallback: refresh whenever the tab regains focus or becomes visible,
    // so the user always sees the latest trades after navigating in from
    // the trade desk / bot builder even if the realtime stream missed an
    // event (e.g. flaky WebSocket, table newly added to the publication).
    const refresh = () => {
      if (document.visibilityState === "visible") void loadTrades();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const connectDeriv = async () => {
    try {
      const url = await buildOAuthUrl({ returnTo: "/dashboard" });
      console.log("Deriv OAuth URL:", sanitizeDerivOAuthUrl(url));
      redirectToDerivOAuth(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not start Deriv OAuth.";
      console.error("[Deriv OAuth] Dashboard connect failed", error);
      toast.error(message);
    }
  };

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Here's a snapshot of your trading activity.</p>
      </div>

      {hasDeriv === false && (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-card/80 p-6 text-card-foreground shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="font-medium text-foreground">Connect your Deriv account</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Authorize ArkTrader through Deriv's official OAuth — no passwords stored.
            </p>
          </div>
          <Button
            onClick={connectDeriv}
            className="w-full shrink-0 bg-[oklch(0.7_0.17_150)] text-white hover:bg-[oklch(0.65_0.17_150)] sm:w-auto"
          >
            <Plug className="mr-1 size-4" /> Connect Deriv
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent trades */}
        <div className="min-w-0 rounded-xl border border-border bg-card/80 p-4 text-card-foreground shadow-sm backdrop-blur-sm sm:p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Recent trades</h3>
            <Link to="/clone2006/dashboard/analytics" className="text-xs text-primary hover:underline">
              View all →
            </Link>
          </div>
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No trades yet — head to the Trade desk.
              </p>
              <Button
                asChild
                size="sm"
                className="mt-4 bg-[oklch(0.7_0.17_150)] text-white hover:bg-[oklch(0.65_0.17_150)]"
              >
                <Link to="/clone2006">Start trading</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {trades.map((t) => {
                const win = t.status === "won";
                const loss = t.status === "lost";
                const stake = Number(t.stake ?? 0);
                const payout = Number(t.payout ?? 0);
                const storedPL = Number(t.profit_loss ?? 0);
                // Trust the stored profit_loss when present. Otherwise derive it
                // from Deriv's payout - stake (the canonical P&L formula): a win
                // returns stake + winnings, a loss returns 0, so subtracting the
                // stake always yields the actual net result of the trade.
                const pl = storedPL !== 0 ? storedPL : win || loss ? payout - stake : 0;
                return (
                  <li
                    key={t.id}
                    className="flex min-w-0 items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {win ? (
                        <ArrowUpRight className="size-4 text-success" />
                      ) : loss ? (
                        <ArrowDownRight className="size-4 text-destructive" />
                      ) : (
                        <Activity className="size-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs text-foreground">{t.symbol}</div>
                        <div className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t.trade_type}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono">
                      <div
                        className={
                          pl > 0
                            ? "text-success"
                            : pl < 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }
                      >
                        {pl >= 0 ? "+" : ""}
                        {pl.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        stake {stake.toFixed(2)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Markets quick-launch */}
        <div className="min-w-0 rounded-xl border border-border bg-card/80 p-4 text-card-foreground shadow-sm backdrop-blur-sm sm:p-5">
          <h3 className="text-sm font-medium text-foreground">Markets</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {SYNTHETIC_MARKETS.slice(0, 5).map((m) => (
              <li
                key={m.symbol}
                className="flex items-center justify-between rounded-lg border border-border bg-background/70 px-3 py-2"
              >
                <span className="min-w-0 truncate text-muted-foreground">{m.name}</span>
                <span className="font-mono text-xs text-foreground">{m.symbol}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-4 w-full">
            <Link to="/clone2006">Open trade desk</Link>
          </Button>

          <Button
            asChild
            className="mt-2 w-full bg-[oklch(0.7_0.17_150)] text-white hover:bg-[oklch(0.65_0.17_150)]"
          >
            <Link to="/clone2006/bot-builder">
              <Bot className="mr-1.5 size-4" /> Launch bot builder
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
