import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  send,
  subscribeProposal,
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
  const [category, setCategory] = useState<TradeCategory>("over_under");
  const [side, setSide] = useState("over");
  const [stake, setStake] = useState(0.6);
  const [payoutMode, setPayoutMode] = useState<"stake" | "payout">("stake");
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState<"t" | "s" | "m">("t");
  const [barrierDigit, setBarrierDigit] = useState(8);
  const [barrierOffset, setBarrierOffset] = useState("+0.10");
  const [growthRate, setGrowthRate] = useState(0.03);
  const [multiplier, setMultiplier] = useState(100);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [currency, setCurrency] = useState("USD");
  const [busy, setBusy] = useState(false);
  const [payouts, setPayouts] = useState<Record<string, { payout: number; pct: number }>>({});
  const [highBarrier, setHighBarrier] = useState<number | null>(null);
  const [lowBarrier, setLowBarrier] = useState<number | null>(null);
  const [chartHeight, setChartHeight] = useState(460);
  const lastPriceRef = useRef<number | null>(null);
  const handlePrice = useCallback((p: number) => {
    setLastPrice(p);
    lastPriceRef.current = p;
  }, []);

  // SSR-safe responsive chart height
  useEffect(() => {
    setChartHeight(window.innerWidth < 768 ? 260 : 460);
  }, []);

  // Reset side when category changes
  useEffect(() => {
    setSide(SIDES_BY_CATEGORY[category][0].value);
  }, [category]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("sessions")
      .select("deriv_token, is_demo, currency")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("is_demo", { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setToken(data.deriv_token);
          setIsDemo(data.is_demo);
          setCurrency(data.currency ?? "USD");
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
        currency,
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
          deriv_contract_id: String(contract.contract_id),
          symbol: market,
          trade_type: contract_type,
          stake,
          payout: contract.payout,
          status: "open",
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
              .update({ profit_loss: profit, status: profit >= 0 ? "won" : "lost", closed_at: new Date().toISOString() })
              .eq("id", trade!.id);
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} ${currency}`,
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

  // Index for prev/next arrows on category pill
  const catIdx = TRADE_CATEGORIES.findIndex((c) => c.value === category);
  const cycleCategory = (dir: -1 | 1) => {
    const next = (catIdx + dir + TRADE_CATEGORIES.length) % TRADE_CATEGORIES.length;
    setCategory(TRADE_CATEGORIES[next].value);
  };

  const currentCategory = TRADE_CATEGORIES[catIdx];

  // Live proposal pricing for non-accumulator trade types
  useEffect(() => {
    if (!token || isAccumulator) return;
    let cancelled = false;
    const run = async () => {
      try {
        await send({ authorize: token });
        const next: Record<string, { payout: number; pct: number }> = {};
        for (const s of sides) {
          const ct = contractTypeFor(category, s.value);
          const proposal: any = {
            proposal: 1,
            amount: stake,
            basis: payoutMode,
            contract_type: ct,
            currency,
            symbol: market,
          };
          if (showDuration) {
            proposal.duration = duration;
            proposal.duration_unit = isDigit ? "t" : durationUnit;
          }
          if (needsDigit) proposal.barrier = String(barrierDigit);
          if (needsBarrierOffset) proposal.barrier = barrierOffset;
          if (isMultiplier) proposal.multiplier = multiplier;
          try {
            const r = await send(proposal);
            const p = Number(r.proposal?.payout ?? 0);
            const pct = stake > 0 ? ((p - stake) / stake) * 100 : 0;
            next[s.value] = { payout: p, pct };
          } catch {
            /* ignore individual side errors */
          }
        }
        if (!cancelled) setPayouts(next);
      } catch {
        /* ignore */
      }
    };
    const t = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, category, side, stake, duration, durationUnit, barrierDigit, barrierOffset, multiplier, market, payoutMode, currency, isAccumulator]);

  // Accumulator: subscribe to the live proposal stream for real-time barrier updates
  useEffect(() => {
    if (!isAccumulator || !token) {
      setHighBarrier(null);
      setLowBarrier(null);
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        await send({ authorize: token });
        unsub = await subscribeProposal(
          {
            amount: stake,
            basis: "stake",
            contract_type: "ACCU",
            currency,
            symbol: market,
            growth_rate: growthRate,
          },
          (pr) => {
            if (cancelled) return;
            const high = pr.high_barrier != null ? Number(pr.high_barrier) : null;
            const low = pr.low_barrier != null ? Number(pr.low_barrier) : null;
            const tsb = pr.tick_size_barrier != null ? Number(pr.tick_size_barrier) : null;
            const p = Number(pr.payout ?? 0);
            const pct = stake > 0 ? ((p - stake) / stake) * 100 : 0;
            setPayouts((prev) => ({ ...prev, buy: { payout: p, pct } }));
            if (high != null && low != null) {
              setHighBarrier(high);
              setLowBarrier(low);
            } else if (tsb != null && lastPriceRef.current != null) {
              const px = lastPriceRef.current;
              setHighBarrier(px * (1 + tsb));
              setLowBarrier(px * (1 - tsb));
            }
          },
        );
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
      setHighBarrier(null);
      setLowBarrier(null);
    };
  }, [isAccumulator, token, stake, currency, market, growthRate]);

  const sideAccent: Record<string, string> = {
    up: "bg-emerald-500", down: "bg-rose-500",
    higher: "bg-emerald-500", lower: "bg-rose-500",
    over: "bg-emerald-500", under: "bg-rose-500",
    even: "bg-emerald-500", odd: "bg-rose-500",
    touch: "bg-emerald-500", no_touch: "bg-rose-500",
    matches: "bg-emerald-500", differs: "bg-rose-500",
    buy: "bg-emerald-500",
  };

  const tickMax = isDigit ? 10 : 10;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="glass-card rounded-xl p-3">
        <DerivChart
          symbol={market}
          onSymbolChange={setMarket}
          onPrice={handlePrice}
          height={chartHeight}
          highBarrier={highBarrier}
          lowBarrier={lowBarrier}
          isAccumulator={isAccumulator}
        />
      </div>

      <div className="space-y-3">
        {/* Trade type pill */}
        <div className="glass-card rounded-xl p-3">
          <div className="text-[11px] text-muted-foreground underline underline-offset-2">Learn about this trade type</div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={() => cycleCategory(-1)} className="rounded-md p-1 hover:bg-muted/40" aria-label="Previous trade type">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-1 items-center justify-center gap-2 rounded-md bg-muted/40 px-3 py-2">
              <TrendingUp className="h-4 w-4 text-rose-400" />
              <TrendingDown className="h-4 w-4 text-rose-400" />
              <span className="font-medium">{currentCategory?.label}</span>
            </div>
            <button onClick={() => cycleCategory(1)} className="rounded-md p-1 hover:bg-muted/40" aria-label="Next trade type">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Duration / Ticks */}
        {showDuration && (
          <div className="glass-card rounded-xl p-4">
            <div className="text-center text-sm text-muted-foreground">
              {durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes"}
            </div>
            <Slider
              className="mt-3"
              min={1}
              max={tickMax}
              step={1}
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
            />
            <div className="mt-2 text-center font-semibold">
              {duration} {durationUnit === "t" ? `Tick${duration > 1 ? "s" : ""}` : durationUnit}
            </div>
            {!isDigit && (
              <div className="mt-2 flex justify-center gap-1">
                {(["t", "s", "m"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => setDurationUnit(u)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px]",
                      durationUnit === u ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground",
                    )}
                  >
                    {u === "t" ? "ticks" : u === "s" ? "sec" : "min"}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Last digit prediction */}
        {needsDigit && (
          <div className="glass-card rounded-xl p-4">
            <div className="text-center text-sm">Last Digit Prediction</div>
            <div className="mt-3 grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }).map((_, d) => (
                <button
                  key={d}
                  onClick={() => setBarrierDigit(d)}
                  className={cn(
                    "rounded-md border py-2 text-sm font-medium transition",
                    barrierDigit === d
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {needsBarrierOffset && (
          <div className="glass-card rounded-xl p-4">
            <div className="mb-1 text-sm">Barrier (offset from spot)</div>
            <Input value={barrierOffset} onChange={(e) => setBarrierOffset(e.target.value)} />
          </div>
        )}

        {isAccumulator && (
          <div className="glass-card rounded-xl p-4">
            <div className="mb-2 text-sm">Growth rate</div>
            <div className="grid grid-cols-5 gap-2">
              {[0.01, 0.02, 0.03, 0.04, 0.05].map((g) => (
                <button
                  key={g}
                  onClick={() => setGrowthRate(g)}
                  className={cn(
                    "rounded-md py-2 text-sm font-medium transition",
                    growthRate === g
                      ? "bg-primary/15 text-primary ring-1 ring-primary"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                  )}
                >
                  {Math.round(g * 100)}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Accumulator live barrier display — mirrors Deriv's proposal summary */}
        {isAccumulator && (highBarrier != null || lowBarrier != null) && (
          <div className="glass-card rounded-xl p-4 text-sm">
            {highBarrier != null && lowBarrier != null && (
              <div className="flex items-center justify-between py-1">
                <span className="text-muted-foreground">Barriers</span>
                <span className="font-mono text-xs">
                  {lowBarrier.toFixed(4)} / {highBarrier.toFixed(4)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-1 text-xs text-muted-foreground">
              <span>Win condition</span>
              <span>Price stays within barriers each tick</span>
            </div>
            <div className="flex items-center justify-between py-1 text-xs text-muted-foreground">
              <span>Loss condition</span>
              <span>Price exits barrier zone</span>
            </div>
          </div>
        )}

        {isMultiplier && (
          <div className="glass-card rounded-xl p-4">
            <div className="mb-2 text-sm">Multiplier</div>
            <Select value={String(multiplier)} onValueChange={(v) => setMultiplier(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 50, 100, 200, 300, 500].map((m) => (
                  <SelectItem key={m} value={String(m)}>×{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stake / Payout */}
        <div className="glass-card overflow-hidden rounded-xl p-3">
          <div className="grid grid-cols-2 overflow-hidden rounded-lg bg-muted/30 p-1">
            <button
              onClick={() => setPayoutMode("stake")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition",
                payoutMode === "stake" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Stake
            </button>
            <button
              onClick={() => setPayoutMode("payout")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition",
                payoutMode === "payout" ? "bg-background shadow" : "text-muted-foreground",
              )}
            >
              Payout
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setStake((s) => Math.max(0.35, +(s - 0.5).toFixed(2)))}
              className="rounded-md bg-muted/50 p-2 hover:bg-muted"
              aria-label="Decrease stake"
            >
              <Minus className="h-4 w-4" />
            </button>
            <Input
              type="number"
              min={0.35}
              step={0.5}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              className="text-right font-mono text-base"
            />
            <span className="text-xs text-muted-foreground">{currency}</span>
            <button
              onClick={() => setStake((s) => +(s + 0.5).toFixed(2))}
              className="rounded-md bg-muted/50 p-2 hover:bg-muted"
              aria-label="Increase stake"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Side / payout cards */}
        <div className="space-y-2">
          {sides.map((s) => {
            const live = payouts[s.value];
            const isSelected = side === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setSide(s.value)}
                className={cn(
                  "w-full overflow-hidden rounded-xl text-left transition",
                  isSelected ? "ring-2 ring-primary/60" : "opacity-90 hover:opacity-100",
                )}
              >
                <div className="flex items-center justify-between bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>Payout {live ? live.payout.toFixed(2) : "—"} {currency}</span>
                </div>
                <div className={cn("flex items-center justify-between px-4 py-3 text-white", sideAccent[s.value] ?? "bg-muted")}>
                  <span className="font-semibold">{s.label}</span>
                  <span className="font-mono text-sm">{live ? `${live.pct.toFixed(2)}%` : ""}</span>
                </div>
              </button>
            );
          })}
        </div>

        <Button onClick={handleBuy} disabled={busy || !token} className="w-full">
          {busy ? "Submitting…" : token ? `Buy ${sides.find((s) => s.value === side)?.label} (${isDemo ? "Demo" : "Live"})` : "Connect Deriv to trade"}
        </Button>

        <p className="text-[11px] text-muted-foreground">
          Last price: <span className="font-mono text-foreground">{lastPrice?.toFixed(4) ?? "—"}</span>. Trades execute on the Deriv account selected in your dashboard. You can lose money rapidly.
        </p>
      </div>
    </div>
  );
}
