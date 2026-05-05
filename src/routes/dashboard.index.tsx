import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Wallet, TrendingUp, Activity, Bot, ArrowUpRight, ArrowDownRight, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildOAuthUrl, subscribeTicks, SYNTHETIC_MARKETS } from "@/lib/deriv";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

function StatCard({ icon: Icon, label, value, accent }: any) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className={`mt-3 font-mono text-2xl ${accent ?? ""}`}>{value}</div>
    </div>
  );
}

function DashboardHome() {
  const { user } = useAuth();
  const [hasDeriv, setHasDeriv] = useState<boolean | null>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [tick, setTick] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("sessions")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => setHasDeriv((data?.length ?? 0) > 0));
    supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setTrades(data ?? []));
  }, [user]);

  useEffect(() => {
    let off: (() => void) | undefined;
    subscribeTicks("R_100", (price) => setTick(price)).then((unsub) => (off = unsub));
    return () => off?.();
  }, []);

  const totalPL = trades.reduce((a, t) => a + Number(t.profit_loss ?? 0), 0);
  const wins = trades.filter((t) => t.status === "won").length;
  const losses = trades.filter((t) => t.status === "lost").length;
  const winRate = wins + losses ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Here's a snapshot of your trading activity.</p>
      </div>

      {hasDeriv === false && (
        <div className="glass-card flex flex-col items-start gap-4 rounded-xl border-primary/30 p-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-medium">Connect your Deriv account</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Authorize ArkTrader through Deriv's official OAuth — no passwords stored.
            </p>
          </div>
          <Button onClick={() => (window.location.href = buildOAuthUrl())}>
            <Plug className="mr-1 size-4" /> Connect Deriv
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="Total P&L" value={`${totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}`} accent={totalPL >= 0 ? "text-success" : "text-destructive"} />
        <StatCard icon={Activity} label="Trades" value={trades.length} />
        <StatCard icon={TrendingUp} label="Win rate" value={`${winRate}%`} />
        <StatCard icon={Bot} label="V100 live" value={tick ? tick.toFixed(2) : "—"} accent="text-primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-card rounded-xl p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium">Recent trades</h3>
            <Link to="/dashboard/analytics" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          {trades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground">No trades yet — head to the Trade tab.</p>
              <Button asChild size="sm" className="mt-4">
                <Link to="/dashboard/trade">Start trading</Link>
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-glass-border">
              {trades.map((t) => {
                const win = t.status === "won";
                const loss = t.status === "lost";
                return (
                  <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-3">
                      {win ? (
                        <ArrowUpRight className="size-4 text-success" />
                      ) : loss ? (
                        <ArrowDownRight className="size-4 text-destructive" />
                      ) : (
                        <Activity className="size-4 text-muted-foreground" />
                      )}
                      <div>
                        <div className="font-mono text-xs">{t.symbol}</div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {t.trade_type}
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className={win ? "text-success" : loss ? "text-destructive" : ""}>
                        {Number(t.profit_loss ?? 0) >= 0 ? "+" : ""}
                        {Number(t.profit_loss ?? 0).toFixed(2)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">stake {Number(t.stake).toFixed(2)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass-card rounded-xl p-5">
          <h3 className="text-sm font-medium">Markets</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {SYNTHETIC_MARKETS.slice(0, 5).map((m) => (
              <li key={m.symbol} className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-2">
                <span className="text-muted-foreground">{m.name}</span>
                <span className="font-mono text-xs">{m.symbol}</span>
              </li>
            ))}
          </ul>
          <Button asChild variant="outline" className="mt-4 w-full glass-card">
            <Link to="/dashboard/trade">Open trade desk</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
