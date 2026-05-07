import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/hooks/use-deriv-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYNTHETIC_MARKETS, send, contractTypeFor, type TradeCategory } from "@/lib/deriv";
import { toast } from "sonner";
import { Bot as BotIcon, Play, Square, AlertTriangle, Trash2, Activity } from "lucide-react";

export const Route = createFileRoute("/dashboard/bot")({
  component: BotPage,
});

const STRATEGIES = [
  { value: "rise_fall",       label: "Rise / Fall (trend)" },
  { value: "higher_lower",    label: "Higher / Lower" },
  { value: "touch_no_touch",  label: "Touch / No Touch" },
  { value: "even_odd",        label: "Even / Odd" },
  { value: "over_under",      label: "Over / Under" },
  { value: "matches_differs", label: "Matches / Differs" },
];

function BotPage() {
  const { user } = useAuth();
  const { account, currency } = useDerivBalance();
  const [bots, setBots] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "My Bot",
    strategy: "even_odd",
    market: "R_100",
    stake: 1,
    martingale: false,
    martingale_factor: 2,
    take_profit: 10,
    stop_loss: 10,
    max_trades: 20,
    is_demo: true,
  });
  const [confirmed, setConfirmed] = useState(false);
  // Map of botId → running interval ref
  const loopsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  // Per-bot P&L tracker
  const [botStats, setBotStats] = useState<Record<string, { pl: number; trades: number; stake: number }>>({});

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setBots(data ?? []);
  }

  useEffect(() => {
    load();
    return () => {
      // Stop all running loops on unmount
      loopsRef.current.forEach((id) => clearInterval(id));
    };
  }, [user]);

  async function createBot() {
    if (!user) return;
    if (!confirmed) {
      toast.error("Please confirm you understand the risks before creating a bot.");
      return;
    }
    const { name, ...strategy } = form;
    const { error } = await supabase.from("bots").insert({
      name,
      strategy: strategy as any,
      user_id: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Bot created"); load(); }
  }

  async function runOneTrade(bot: any) {
    if (!account) {
      toast.error("Connect Deriv account first.");
      return;
    }
    const s = bot.strategy as any;
    const strategy = s.strategy as TradeCategory;
    const sides: Record<string, string[]> = {
      even_odd:        ["even", "odd"],
      over_under:      ["over", "under"],
      rise_fall:       ["up", "down"],
      higher_lower:    ["higher", "lower"],
      touch_no_touch:  ["touch", "no_touch"],
      matches_differs: ["matches", "differs"],
    };
    const sidePair = sides[strategy] ?? ["up", "down"];
    const side = sidePair[Math.floor(Math.random() * sidePair.length)];
    const contract_type = contractTypeFor(strategy, side);
    const currentStake = (() => {
      const cur = botStats[bot.id]?.stake ?? s.stake;
      return Number(cur);
    })();

    try {
      await send({ authorize: account.deriv_token });
      const proposal: any = {
        proposal: 1,
        amount: currentStake,
        basis: "stake",
        contract_type,
        currency,
        symbol: s.market,
        duration: 1,
        duration_unit: "t",
      };
      if (["even_odd", "over_under", "matches_differs"].includes(strategy)) {
        proposal.barrier = strategy === "over_under" ? "5" : undefined;
        delete proposal.duration;
        delete proposal.duration_unit;
        proposal.duration = 1;
        proposal.duration_unit = "t";
      }
      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) return;
      const buyResp = await send({ buy: proposalId, price: currentStake });
      const contract = buyResp.buy;
      if (!contract?.contract_id) return;

      // Poll for result
      const pollId = setInterval(async () => {
        try {
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(pollId);
            const profit = Number(c.profit ?? 0);
            const won = profit >= 0;
            setBotStats((prev) => {
              const old = prev[bot.id] ?? { pl: 0, trades: 0, stake: s.stake };
              const nextStake = !won && s.martingale
                ? +(old.stake * (s.martingale_factor ?? 2)).toFixed(2)
                : s.stake;
              return {
                ...prev,
                [bot.id]: { pl: +(old.pl + profit).toFixed(2), trades: old.trades + 1, stake: nextStake },
              };
            });
            await supabase.from("trades").insert({
              user_id: user!.id,
              deriv_contract_id: String(contract.contract_id),
              symbol: s.market,
              trade_type: contract_type,
              stake: currentStake,
              payout: contract.payout,
              profit_loss: profit,
              status: won ? "won" : "lost",
              closed_at: new Date().toISOString(),
            });
          }
        } catch { /* ignore */ }
      }, 1500);
      setTimeout(() => clearInterval(pollId), 60000);
    } catch (e: any) {
      console.error("Bot trade error", e.message);
    }
  }

  async function startBot(bot: any) {
    if (loopsRef.current.has(bot.id)) return;
    await supabase.from("bots").update({ status: "running" }).eq("id", bot.id);
    const s = bot.strategy as any;
    const intervalMs = 4000;
    let tradeCount = 0;
    const runLoop = async () => {
      const stats = botStats[bot.id];
      const pl = stats?.pl ?? 0;
      const trades = stats?.trades ?? 0;
      if (trades >= (s.max_trades ?? 20)) { stopBot(bot.id); return; }
      if (pl >= (s.take_profit ?? Infinity))  { stopBot(bot.id); toast.success(`${bot.name} hit take profit.`); return; }
      if (pl <= -(s.stop_loss ?? Infinity))   { stopBot(bot.id); toast.error(`${bot.name} hit stop loss.`);    return; }
      tradeCount++;
      await runOneTrade(bot);
    };
    const id = setInterval(runLoop, intervalMs);
    loopsRef.current.set(bot.id, id);
    toast.success(`${bot.name} started.`);
    load();
  }

  async function stopBot(botId: string) {
    const id = loopsRef.current.get(botId);
    if (id != null) { clearInterval(id); loopsRef.current.delete(botId); }
    await supabase.from("bots").update({ status: "stopped" }).eq("id", botId);
    toast.success("Bot stopped.");
    load();
  }

  async function deleteBot(id: string) {
    stopBot(id);
    await supabase.from("bots").delete().eq("id", id);
    load();
  }

  async function emergencyStop() {
    if (!user) return;
    loopsRef.current.forEach((id) => clearInterval(id));
    loopsRef.current.clear();
    await supabase.from("bots").update({ status: "stopped" }).eq("user_id", user.id);
    toast.success("Emergency stop — all bots halted.");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bot builder</h1>
          <p className="text-sm text-muted-foreground">Automated strategies with strict risk controls.</p>
        </div>
        <Button variant="destructive" onClick={emergencyStop}>
          <AlertTriangle className="mr-1 size-4" /> Emergency stop all
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Config form */}
        <div className="glass-card space-y-4 rounded-xl p-5">
          <h3 className="text-sm font-medium">New strategy</h3>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Strategy</Label>
              <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: v })}>
                <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STRATEGIES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Market</Label>
              <Select value={form.market} onValueChange={(v) => setForm({ ...form, market: v })}>
                <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SYNTHETIC_MARKETS.map((m) => <SelectItem key={m.symbol} value={m.symbol}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stake ({currency})</Label>
              <Input type="number" min={0.35} step={0.5} value={form.stake}
                onChange={(e) => setForm({ ...form, stake: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max trades</Label>
              <Input type="number" min={1} value={form.max_trades}
                onChange={(e) => setForm({ ...form, max_trades: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Take profit ({currency})</Label>
              <Input type="number" min={0} value={form.take_profit}
                onChange={(e) => setForm({ ...form, take_profit: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop loss ({currency})</Label>
              <Input type="number" min={0} value={form.stop_loss}
                onChange={(e) => setForm({ ...form, stop_loss: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
            <div>
              <Label>Martingale</Label>
              <p className="text-[11px] text-muted-foreground">Doubles stake after a loss. Very risky.</p>
            </div>
            <Switch checked={form.martingale} onCheckedChange={(v) => setForm({ ...form, martingale: v })} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
            <div>
              <Label>Demo account</Label>
              <p className="text-[11px] text-muted-foreground">Strongly recommended for new strategies.</p>
            </div>
            <Switch checked={form.is_demo} onCheckedChange={(v) => setForm({ ...form, is_demo: v })} />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            I understand automated trading carries significant risk and may result in total loss of funds.
          </label>

          <Button onClick={createBot} className="w-full" disabled={!confirmed}>Create bot</Button>
        </div>

        {/* Bot list */}
        <div className="space-y-3">
          {bots.length === 0 ? (
            <div className="glass-card grid place-items-center rounded-xl p-12 text-center">
              <BotIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No bots yet. Create one to get started.</p>
            </div>
          ) : (
            bots.map((b) => {
              const isRunning = b.status === "running" && loopsRef.current.has(b.id);
              const stats = botStats[b.id];
              return (
                <div key={b.id} className="glass-card rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{b.name}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                          isRunning ? "bg-success/20 text-success" : "bg-foreground/5 text-muted-foreground"
                        }`}>{isRunning ? "running" : b.status}</span>
                        <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                          {b.strategy?.is_demo ? "Demo" : "Live"}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {b.strategy?.strategy} · {b.strategy?.market} · stake {b.strategy?.stake} {currency}
                        {" · "} SL {b.strategy?.stop_loss} · TP {b.strategy?.take_profit}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRunning ? (
                        <Button size="sm" variant="outline" onClick={() => stopBot(b.id)}>
                          <Square className="mr-1 size-3" /> Stop
                        </Button>
                      ) : (
                        <Button size="sm" onClick={() => startBot(b)} disabled={!account}>
                          <Play className="mr-1 size-3" /> Start
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => deleteBot(b.id)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  {stats && (
                    <div className="mt-3 flex flex-wrap gap-4 rounded-lg bg-foreground/[0.02] px-3 py-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <Activity className="size-3 text-muted-foreground" />
                        <span className="text-muted-foreground">Trades:</span>
                        <span className="font-mono font-semibold">{stats.trades}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">P&L:</span>
                        <span className={`font-mono font-semibold ${stats.pl >= 0 ? "text-success" : "text-destructive"}`}>
                          {stats.pl >= 0 ? "+" : ""}{stats.pl.toFixed(2)} {currency}
                        </span>
                      </div>
                      {b.strategy?.martingale && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">Next stake:</span>
                          <span className="font-mono font-semibold">{stats.stake.toFixed(2)} {currency}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="glass-card flex items-start gap-3 rounded-xl border-warning/30 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 text-warning" />
        <div className="text-muted-foreground">
          Bots execute live trades via your connected Deriv account. Keep this tab open while bots are running.
          Always test on <span className="text-foreground">Demo</span> before using real funds.
        </div>
      </div>
    </div>
  );
}
