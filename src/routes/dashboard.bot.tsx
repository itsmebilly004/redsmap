import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/contexts/deriv-balance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  send,
  contractTypeFor,
  SYNTHETIC_MARKETS,
  getActiveSymbols,
  type TradeCategory,
} from "@/lib/deriv";
import { toast } from "sonner";
import { Bot as BotIcon, Play, Square, AlertTriangle, Trash2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/dashboard/bot")({
  component: BotPage,
});

const STRATEGIES: { value: TradeCategory; label: string }[] = [
  { value: "rise_fall", label: "Rise / Fall (trend)" },
  { value: "higher_lower", label: "Higher / Lower" },
  { value: "touch_no_touch", label: "Touch / No Touch" },
  { value: "even_odd", label: "Even / Odd" },
  { value: "over_under", label: "Over / Under" },
  { value: "matches_differs", label: "Matches / Differs" },
  { value: "accumulator", label: "Accumulators" },
  { value: "multiplier", label: "Multipliers" },
];

// Returns the default side for each strategy
function defaultSide(strategy: TradeCategory): string {
  const map: Partial<Record<TradeCategory, string>> = {
    rise_fall: "up",
    higher_lower: "higher",
    touch_no_touch: "touch",
    even_odd: "even",
    over_under: "over",
    matches_differs: "matches",
    accumulator: "buy",
    multiplier: "up",
  };
  return map[strategy] ?? "up";
}

function BotPage() {
  const { user } = useAuth();
  const { account, currency } = useDerivBalance();

  const token = account?.deriv_token ?? null;
  const isDemo = account?.is_demo ?? true;

  const [bots, setBots] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "My Bot",
    strategy: "even_odd" as TradeCategory,
    market: "R_100",
    stake: 1,
    martingale: false,
    martingale_factor: 2,
    take_profit: 10,
    stop_loss: 10,
    max_trades: 20,
  });
  const [confirmed, setConfirmed] = useState(false);
  const [allSymbols, setAllSymbols] = useState<{ symbol: string; display_name: string; market: string }[]>([]);
  // Ref map of running bot loops  — key: bot.id → cleanup function
  const runningBots = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    getActiveSymbols()
      .then((list) => { if (list?.length) setAllSymbols(list); })
      .catch(() => {});
  }, []);

  async function loadBots() {
    if (!user) return;
    const { data } = await supabase
      .from("bots")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setBots(data ?? []);
  }

  useEffect(() => {
    loadBots();
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
      strategy: { ...strategy, currency } as any,
      user_id: user.id,
      status: "idle",
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bot created");
      loadBots();
    }
  }

  async function startBot(bot: any) {
    if (!token) {
      toast.error("Connect your Deriv account before running a bot.");
      return;
    }
    await supabase.from("bots").update({ status: "running" }).eq("id", bot.id);
    toast.success(`Bot "${bot.name}" started`);
    loadBots();

    const s = bot.strategy ?? {};
    const strategy = s.strategy ?? "even_odd";
    const market = s.market ?? "R_100";
    let currentStake = Number(s.stake ?? 1);
    const maxTrades = Number(s.max_trades ?? 20);
    const takeProfit = Number(s.take_profit ?? 10);
    const stopLoss = Number(s.stop_loss ?? 10);
    const martingale = Boolean(s.martingale);
    const martingaleFactor = Number(s.martingale_factor ?? 2);
    const side = defaultSide(strategy as TradeCategory);
    const tradeCurrency = s.currency ?? currency;

    let totalPL = 0;
    let tradeCount = 0;
    let running = true;

    const cleanup = () => { running = false; };
    runningBots.current.set(bot.id, cleanup);

    while (running && tradeCount < maxTrades) {
      if (totalPL >= takeProfit) {
        toast.success(`Bot "${bot.name}" hit take-profit (${totalPL.toFixed(2)} ${tradeCurrency})`);
        break;
      }
      if (totalPL <= -stopLoss) {
        toast.error(`Bot "${bot.name}" hit stop-loss (${totalPL.toFixed(2)} ${tradeCurrency})`);
        break;
      }
      try {
        await send({ authorize: token });
        const contractType = contractTypeFor(strategy as TradeCategory, side);
        const proposal: any = {
          proposal: 1,
          amount: currentStake,
          basis: "stake",
          contract_type: contractType,
          currency: tradeCurrency,
          symbol: market,
        };
        const isDigit = ["even_odd", "over_under", "matches_differs"].includes(strategy);
        if (isDigit) {
          proposal.duration = 1;
          proposal.duration_unit = "t";
        } else if (!["accumulator", "multiplier"].includes(strategy)) {
          proposal.duration = 5;
          proposal.duration_unit = "t";
        }
        if (strategy === "over_under") proposal.barrier = "5";
        if (strategy === "matches_differs") proposal.barrier = "5";
        if (strategy === "accumulator") proposal.growth_rate = 0.03;
        if (strategy === "multiplier") proposal.multiplier = 100;

        const propResp = await send(proposal);
        const proposalId = propResp.proposal?.id;
        if (!proposalId) throw new Error("No proposal returned");
        const buyResp = await send({ buy: proposalId, price: currentStake });
        const contract = buyResp.buy;
        tradeCount++;

        await supabase.from("trades").insert({
          user_id: user!.id,
          deriv_contract_id: String(contract.contract_id),
          symbol: market,
          trade_type: contractType,
          stake: currentStake,
          payout: contract.payout,
          status: "open",
        });

        // Wait for contract to settle
        let settled = false;
        let profit = 0;
        for (let tries = 0; tries < 40 && !settled; tries++) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!running) break;
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            settled = true;
            profit = Number(c.profit ?? 0);
            totalPL += profit;
            await supabase.from("trades").update({
              profit_loss: profit,
              status: profit >= 0 ? "won" : "lost",
              closed_at: new Date().toISOString(),
            }).eq("deriv_contract_id", String(contract.contract_id)).eq("user_id", user!.id);

            if (martingale && profit < 0) {
              currentStake = +(currentStake * martingaleFactor).toFixed(2);
            } else {
              currentStake = Number(s.stake ?? 1);
            }
          }
        }
        if (!settled || !running) break;
      } catch (e: any) {
        toast.error(`Bot error: ${e.message}`);
        break;
      }
    }

    runningBots.current.delete(bot.id);
    await supabase.from("bots").update({ status: "stopped" }).eq("id", bot.id);
    toast.success(`Bot "${bot.name}" finished (${tradeCount} trades, P&L: ${totalPL.toFixed(2)} ${tradeCurrency})`);
    loadBots();
  }

  async function stopBot(id: string) {
    const cleanup = runningBots.current.get(id);
    if (cleanup) cleanup();
    runningBots.current.delete(id);
    await supabase.from("bots").update({ status: "stopped" }).eq("id", id);
    toast.success("Bot stopped");
    loadBots();
  }

  async function deleteBot(id: string) {
    stopBot(id);
    await supabase.from("bots").delete().eq("id", id);
    loadBots();
  }

  async function emergencyStop() {
    if (!user) return;
    runningBots.current.forEach((cleanup) => cleanup());
    runningBots.current.clear();
    await supabase.from("bots").update({ status: "stopped" }).eq("user_id", user.id);
    toast.success("Emergency stop — all bots halted.");
    loadBots();
  }

  const symbolOptions = allSymbols.length > 0
    ? allSymbols.filter((s) => s.market === "synthetic_index")
    : SYNTHETIC_MARKETS.map((m) => ({ symbol: m.symbol, display_name: m.name, market: "synthetic_index" }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bot builder</h1>
          <p className="text-sm text-muted-foreground">
            Configure automated strategies.
            {account && (
              <span className="ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                {account.is_demo ? "🎮 Demo" : "🇺🇸 Real"} · {currency}
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadBots}>
            <RefreshCw className="mr-1 size-4" /> Refresh
          </Button>
          <Button variant="destructive" onClick={emergencyStop}>
            <AlertTriangle className="mr-1 size-4" /> Emergency stop all
          </Button>
        </div>
      </div>

      {!token && (
        <div className="glass-card rounded-xl border-warning/30 p-4 text-sm text-warning">
          ⚠️ Connect your Deriv account to run bots. Bots can only execute trades with a live Deriv connection.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        <div className="glass-card space-y-4 rounded-xl p-5">
          <h3 className="text-sm font-medium">New strategy</h3>

          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Strategy</Label>
              <Select value={form.strategy} onValueChange={(v) => setForm({ ...form, strategy: v as TradeCategory })}>
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
                  {symbolOptions.map((m) => <SelectItem key={m.symbol} value={m.symbol}>{m.display_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stake ({currency})</Label>
              <Input type="number" min={0.35} step={0.5} value={form.stake} onChange={(e) => setForm({ ...form, stake: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max trades</Label>
              <Input type="number" min={1} value={form.max_trades} onChange={(e) => setForm({ ...form, max_trades: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Take profit ({currency})</Label>
              <Input type="number" min={0} value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop loss ({currency})</Label>
              <Input type="number" min={0} value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: Number(e.target.value) })} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
            <div>
              <Label>Martingale</Label>
              <p className="text-[11px] text-muted-foreground">Doubles stake after a loss. Risky.</p>
            </div>
            <Switch checked={form.martingale} onCheckedChange={(v) => setForm({ ...form, martingale: v })} />
          </div>

          <div className="rounded-lg border border-glass-border bg-foreground/[0.02] p-3 text-[11px] text-muted-foreground">
            Bot will run on{" "}
            <span className="font-medium text-foreground">
              {isDemo ? "🎮 Demo" : "🇺🇸 Real"} {currency}
            </span>{" "}
            (your current active account). Switch accounts from the header to change.
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            I understand automated trading carries significant risk and may result in loss of all funds.
          </label>

          <Button onClick={createBot} className="w-full" disabled={!confirmed}>
            Create bot
          </Button>
        </div>

        <div className="space-y-3">
          {bots.length === 0 ? (
            <div className="glass-card grid place-items-center rounded-xl p-12 text-center">
              <BotIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No bots yet. Create one to get started.</p>
            </div>
          ) : (
            bots.map((b) => {
              const s = b.strategy ?? {};
              return (
                <div key={b.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{b.name}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                        b.status === "running" ? "bg-success/20 text-success" : "bg-foreground/5 text-muted-foreground"
                      }`}>{b.status}</span>
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {s.strategy} · {s.market} · stake {s.stake} {s.currency ?? currency} · SL {s.stop_loss} · TP {s.take_profit}
                      {s.martingale && " · martingale"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {b.status === "running" ? (
                      <Button size="sm" variant="outline" onClick={() => stopBot(b.id)}>
                        <Square className="mr-1 size-3" /> Stop
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => startBot(b)} disabled={!token}>
                        <Play className="mr-1 size-3" /> Start
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => deleteBot(b.id)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="glass-card flex items-start gap-3 rounded-xl border-warning/30 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 text-warning" />
        <div className="text-muted-foreground">
          Bots run directly in this browser session. Keep the tab open while a bot is active.
          Always test with a <strong className="text-foreground">Demo account</strong> before using real funds.
        </div>
      </div>
    </div>
  );
}
