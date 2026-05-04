import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SYNTHETIC_MARKETS } from "@/lib/deriv";
import { toast } from "sonner";
import { Bot as BotIcon, Play, Square, AlertTriangle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/dashboard/bot")({
  component: BotPage,
});

const STRATEGIES = [
  { value: "rise_fall", label: "Rise / Fall (trend)" },
  { value: "higher_lower", label: "Higher / Lower" },
  { value: "touch_no_touch", label: "Touch / No Touch" },
  { value: "even_odd", label: "Even / Odd" },
  { value: "over_under", label: "Over / Under" },
  { value: "matches_differs", label: "Matches / Differs" },
  { value: "accumulator", label: "Accumulators" },
  { value: "multiplier", label: "Multipliers" },
];

function BotPage() {
  const { user } = useAuth();
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
  }, [user]);

  async function createBot() {
    if (!user) return;
    if (!confirmed) {
      toast.error("Please confirm you understand the risks before creating a bot.");
      return;
    }
    const { error } = await supabase.from("bots").insert({ ...form, user_id: user.id });
    if (error) toast.error(error.message);
    else {
      toast.success("Bot created");
      load();
    }
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("bots").update({ status }).eq("id", id);
    toast.success(status === "running" ? "Bot started" : "Bot stopped");
    load();
  }

  async function deleteBot(id: string) {
    await supabase.from("bots").delete().eq("id", id);
    load();
  }

  async function emergencyStop() {
    if (!user) return;
    await supabase.from("bots").update({ status: "stopped" }).eq("user_id", user.id);
    toast.success("Emergency stop — all bots halted.");
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bot builder</h1>
          <p className="text-sm text-muted-foreground">Configure semi-automated strategies with strict risk controls.</p>
        </div>
        <Button variant="destructive" onClick={emergencyStop}>
          <AlertTriangle className="mr-1 size-4" /> Emergency stop all
        </Button>
      </div>

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
              <Label>Stake</Label>
              <Input type="number" min={0.35} step={0.5} value={form.stake} onChange={(e) => setForm({ ...form, stake: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Max trades</Label>
              <Input type="number" min={1} value={form.max_trades} onChange={(e) => setForm({ ...form, max_trades: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Take profit</Label>
              <Input type="number" min={0} value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop loss</Label>
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

          <div className="flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3">
            <div>
              <Label>Demo account</Label>
              <p className="text-[11px] text-muted-foreground">Highly recommended for new strategies.</p>
            </div>
            <Switch checked={form.is_demo} onCheckedChange={(v) => setForm({ ...form, is_demo: v })} />
          </div>

          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
            I understand automated trading carries significant risk and may result in loss of all funds.
          </label>

          <Button onClick={createBot} className="w-full" disabled={!confirmed}>Create bot</Button>
        </div>

        <div className="space-y-3">
          {bots.length === 0 ? (
            <div className="glass-card grid place-items-center rounded-xl p-12 text-center">
              <BotIcon className="size-8 text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">No bots yet. Create one to get started.</p>
            </div>
          ) : (
            bots.map((b) => (
              <div key={b.id} className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{b.name}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                      b.status === "running" ? "bg-success/20 text-success" : "bg-foreground/5 text-muted-foreground"
                    }`}>{b.status}</span>
                    <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                      {b.is_demo ? "Demo" : "Live"}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-xs text-muted-foreground">
                    {b.strategy} • {b.market} • stake {b.stake} • SL {b.stop_loss} • TP {b.take_profit}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.status === "running" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "stopped")}>
                      <Square className="mr-1 size-3" /> Stop
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => setStatus(b.id, "running")}>
                      <Play className="mr-1 size-3" /> Start
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => deleteBot(b.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="glass-card flex items-start gap-3 rounded-xl border-warning/30 p-4 text-sm">
        <AlertTriangle className="mt-0.5 size-4 text-warning" />
        <div className="text-muted-foreground">
          Bot execution is currently in <span className="text-foreground">supervised preview</span>: strategies are stored and tracked,
          but live trade placement runs from this browser session. Keep the tab open while a bot is running, and always use demo first.
        </div>
      </div>
    </div>
  );
}
