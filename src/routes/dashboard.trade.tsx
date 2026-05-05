import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  send,
  TRADE_CATEGORIES,
  SIDES_BY_CATEGORY,
  contractTypeFor,
  type TradeCategory,
} from "@/lib/deriv";
import { DerivChart } from "@/components/deriv-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Minus, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/trade")({
  component: TradePage,
});

function TradePage() {
  const { user } = useAuth();
  const [market, setMarket] = useState("R_100");
  const [category, setCategory] = useState<TradeCategory>("rise_fall");
  const [side, setSide] = useState("up");
  const [stake, setStake] = useState(1);
  const [duration, setDuration] = useState(5);
  const [durationUnit, setDurationUnit] = useState<"t" | "s" | "m">("t");
  const [barrierDigit, setBarrierDigit] = useState(5);
  const [barrierOffset, setBarrierOffset] = useState("+0.10");
  const [growthRate, setGrowthRate] = useState(0.03); // accumulators
  const [multiplier, setMultiplier] = useState(100); // multipliers
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [busy, setBusy] = useState(false);
  const handlePrice = useCallback((p: number) => setLastPrice(p), []);

  // Reset side when category changes
  useEffect(() => {
    setSide(SIDES_BY_CATEGORY[category][0].value);
  }, [category]);

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

  // chart subscription handled inside <DerivChart />


  const isDigit = ["even_odd", "over_under", "matches_differs"].includes(category);
  const needsDigit = category === "over_under" || category === "matches_differs";
  const needsBarrierOffset = category === "higher_lower" || category === "touch_no_touch";
  const isAccumulator = category === "accumulator";
  const isMultiplier = category === "multiplier";
  const showDuration = !isAccumulator && !isMultiplier;

  async function handleBuy() {
    if (!user) return;
    if (!token) {
      toast.error("Connect your Deriv account first.");
      return;
    }
    setBusy(true);
    try {
      await send({ authorize: token });
      const contract_type = contractTypeFor(category, side);

      const proposal: any = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type,
        currency: "USD",
        symbol: market,
      };

      if (showDuration) {
        proposal.duration = duration;
        proposal.duration_unit = isDigit ? "t" : durationUnit;
      }
      if (needsDigit) proposal.barrier = String(barrierDigit);
      if (needsBarrierOffset) proposal.barrier = barrierOffset;
      if (isAccumulator) {
        proposal.growth_rate = growthRate;
        proposal.basis = "stake";
      }
      if (isMultiplier) {
        proposal.multiplier = multiplier;
        proposal.basis = "stake";
      }

      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) throw new Error("No proposal returned");
      const buyResp = await send({ buy: proposalId, price: stake });
      const contract = buyResp.buy;
      toast.success(`Bought contract ${contract.contract_id}`);

      const { data: trade } = await supabase
        .from("trades")
        .insert({
          user_id: user.id,
          contract_id: String(contract.contract_id),
          market,
          trade_type: contract_type,
          stake,
          payout: contract.payout,
          result: "open",
          is_demo: isDemo,
        })
        .select()
        .single();

      const poll = setInterval(async () => {
        try {
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            await supabase
              .from("trades")
              .update({ profit, result: profit >= 0 ? "win" : "loss" })
              .eq("id", trade!.id);
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} USD`,
            );
          }
        } catch {
          /* ignore */
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 120000);
    } catch (e: any) {
      toast.error(e.message ?? "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const sides = SIDES_BY_CATEGORY[category];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="glass-card rounded-xl p-5">
        <div className="mb-3 flex items-center justify-end">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Last price</div>
            <div className="font-mono text-2xl text-primary">{lastPrice?.toFixed(4) ?? "—"}</div>
          </div>
        </div>
        <DerivChart symbol={market} onSymbolChange={setMarket} onPrice={handlePrice} height={380} />
      </div>

      <div className="glass-card space-y-4 rounded-xl p-5">
        <h3 className="text-sm font-medium">Place trade</h3>

        <div className="space-y-1.5">
          <Label>Trade type</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as TradeCategory)}>
            <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRADE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            {TRADE_CATEGORIES.find((c) => c.value === category)?.description}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {sides.map((s) => (
            <Button
              key={s.value}
              type="button"
              variant={side === s.value ? "default" : "outline"}
              className={side === s.value ? "" : "glass-card"}
              onClick={() => setSide(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Stake (USD)</Label>
            <Input type="number" min={0.35} step={0.5} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
          </div>
          {showDuration && (
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <div className="flex gap-1.5">
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                <Select
                  value={isDigit ? "t" : durationUnit}
                  onValueChange={(v) => setDurationUnit(v as any)}
                  disabled={isDigit}
                >
                  <SelectTrigger className="w-20 glass-card"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="t">ticks</SelectItem>
                    <SelectItem value="s">sec</SelectItem>
                    <SelectItem value="m">min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {needsDigit && (
          <div className="space-y-1.5">
            <Label>Digit (0–9)</Label>
            <Input type="number" min={0} max={9} value={barrierDigit} onChange={(e) => setBarrierDigit(Number(e.target.value))} />
          </div>
        )}

        {needsBarrierOffset && (
          <div className="space-y-1.5">
            <Label>Barrier (offset from spot, e.g. +0.10)</Label>
            <Input value={barrierOffset} onChange={(e) => setBarrierOffset(e.target.value)} />
          </div>
        )}

        {isAccumulator && (
          <div className="space-y-1.5">
            <Label>Growth rate</Label>
            <Select value={String(growthRate)} onValueChange={(v) => setGrowthRate(Number(v))}>
              <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.01">1%</SelectItem>
                <SelectItem value="0.02">2%</SelectItem>
                <SelectItem value="0.03">3%</SelectItem>
                <SelectItem value="0.04">4%</SelectItem>
                <SelectItem value="0.05">5%</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Profit compounds each tick the price stays inside the range.
            </p>
          </div>
        )}

        {isMultiplier && (
          <div className="space-y-1.5">
            <Label>Multiplier</Label>
            <Select value={String(multiplier)} onValueChange={(v) => setMultiplier(Number(v))}>
              <SelectTrigger className="glass-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50, 100, 200, 300, 500].map((m) => (
                  <SelectItem key={m} value={String(m)}>×{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleBuy} disabled={busy || !token} className="w-full">
          {busy ? "Submitting…" : token ? `Buy (${isDemo ? "Demo" : "Live"})` : "Connect Deriv to trade"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          Trades execute against the Deriv account selected in your dashboard. You can lose money rapidly.
        </p>
      </div>
    </div>
  );
}
