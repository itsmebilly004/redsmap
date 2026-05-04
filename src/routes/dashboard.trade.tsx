import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { send, subscribeTicks, SYNTHETIC_MARKETS } from "@/lib/deriv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/trade")({
  component: TradePage,
});

type TradeType = "CALL" | "PUT" | "DIGITEVEN" | "DIGITODD" | "DIGITOVER" | "DIGITUNDER";

function TradePage() {
  const { user } = useAuth();
  const [market, setMarket] = useState("R_100");
  const [tradeType, setTradeType] = useState<TradeType>("CALL");
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(5);
  const [barrier, setBarrier] = useState(5);
  const [series, setSeries] = useState<{ t: number; price: number }[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const lastPrice = series.at(-1)?.price;

  useEffect(() => {
    if (!user) return;
    supabase
      .from("deriv_accounts")
      .select("api_token, is_demo")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("is_demo", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setToken(data.api_token);
          setIsDemo(data.is_demo);
        }
      });
  }, [user]);

  useEffect(() => {
    setSeries([]);
    let off: (() => void) | undefined;
    subscribeTicks(market, (price, t) => {
      setSeries((s) => {
        const next = [...s, { t, price }];
        return next.length > 120 ? next.slice(-120) : next;
      });
    }).then((unsub) => (off = unsub));
    return () => off?.();
  }, [market]);

  const isDigit = tradeType.startsWith("DIGIT");
  const needsBarrier = tradeType === "DIGITOVER" || tradeType === "DIGITUNDER";

  async function handleBuy() {
    if (!user) return;
    if (!token) {
      toast.error("Connect your Deriv account first.");
      return;
    }
    setBusy(true);
    try {
      await send({ authorize: token });
      const proposal: any = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type: tradeType,
        currency: "USD",
        duration,
        duration_unit: isDigit ? "t" : "t",
        symbol: market,
      };
      if (needsBarrier) proposal.barrier = String(barrier);
      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      const buyResp = await send({ buy: proposalId, price: stake });
      const contract = buyResp.buy;
      toast.success(`Bought contract ${contract.contract_id}`);

      // Insert open trade record
      const { data: trade } = await supabase
        .from("trades")
        .insert({
          user_id: user.id,
          contract_id: String(contract.contract_id),
          market,
          trade_type: tradeType,
          stake,
          payout: contract.payout,
          result: "open",
          is_demo: isDemo,
        })
        .select()
        .single();

      // Poll for outcome
      const poll = setInterval(async () => {
        try {
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            await supabase
              .from("trades")
              .update({
                profit,
                result: profit >= 0 ? "win" : "loss",
              })
              .eq("id", trade!.id);
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} USD`,
            );
          }
        } catch (e) {
          /* ignore */
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 60000);
    } catch (e: any) {
      toast.error(e.message ?? "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const chartData = useMemo(() => series.map((s) => ({ x: s.t, y: s.price })), [series]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="glass-card rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Select value={market} onValueChange={setMarket}>
              <SelectTrigger className="w-56 glass-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SYNTHETIC_MARKETS.map((m) => (
                  <SelectItem key={m.symbol} value={m.symbol}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last price</div>
            <div className="font-mono text-2xl text-primary">{lastPrice?.toFixed(4) ?? "—"}</div>
          </div>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="x" hide />
              <YAxis domain={["auto", "auto"]} tick={{ fill: "oklch(0.65 0.02 240)", fontSize: 10 }} width={60} />
              <Tooltip
                contentStyle={{ background: "oklch(0.18 0.02 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }}
                labelFormatter={() => ""}
                formatter={(v: any) => [Number(v).toFixed(4), "Price"]}
              />
              <Line type="monotone" dataKey="y" stroke="oklch(0.78 0.16 230)" strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card space-y-4 rounded-xl p-5">
        <h3 className="text-sm font-medium">Place trade</h3>

        <div className="space-y-1.5">
          <Label>Trade type</Label>
          <Select value={tradeType} onValueChange={(v) => setTradeType(v as TradeType)}>
            <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="CALL">Rise</SelectItem>
              <SelectItem value="PUT">Fall</SelectItem>
              <SelectItem value="DIGITEVEN">Digit Even</SelectItem>
              <SelectItem value="DIGITODD">Digit Odd</SelectItem>
              <SelectItem value="DIGITOVER">Digit Over</SelectItem>
              <SelectItem value="DIGITUNDER">Digit Under</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Stake (USD)</Label>
            <Input type="number" min={0.35} step={0.5} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (ticks)</Label>
            <Input type="number" min={1} max={10} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </div>
        </div>

        {needsBarrier && (
          <div className="space-y-1.5">
            <Label>Barrier digit (0-9)</Label>
            <Input type="number" min={0} max={9} value={barrier} onChange={(e) => setBarrier(Number(e.target.value))} />
          </div>
        )}

        <Button onClick={handleBuy} disabled={busy || !token} className="w-full">
          {busy ? "Submitting…" : token ? `Buy (${isDemo ? "Demo" : "Live"})` : "Connect Deriv to trade"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          Trades execute against the Deriv account selected in your dashboard. You can lose money.
        </p>
      </div>
    </div>
  );
}
