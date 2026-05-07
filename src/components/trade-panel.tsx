import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalance } from "@/contexts/deriv-balance";
import {
  send,
  subscribeProposal,
  TRADE_CATEGORIES,
  SIDES_BY_CATEGORY,
  contractTypeFor,
  buildOAuthUrl,
  type TradeCategory,
} from "@/lib/deriv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { ChevronLeft, ChevronRight, Info, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface TradePanelProps {
  market: string;
  lastPrice?: number | null;
  onAccumulatorBarriers?: (b: { high: number | null; low: number | null }) => void;
  onCategoryChange?: (category: TradeCategory) => void;
}

export function TradePanel({ market, lastPrice, onAccumulatorBarriers, onCategoryChange }: TradePanelProps) {
  const { user } = useAuth();
  const { account, balance, currency: accountCurrency } = useDerivBalance();

  // Derive token and currency directly from the shared context — no separate Supabase query
  const token = account?.deriv_token ?? null;
  const isDemo = account?.is_demo ?? true;
  const currency = accountCurrency; // always matches the active Deriv account

  const [category, setCategory] = useState<TradeCategory>("accumulator");
  const [side, setSide] = useState("buy");
  const [stake, setStake] = useState(10);
  const [payoutMode, setPayoutMode] = useState<"stake" | "payout">("stake");
  const [duration, setDuration] = useState(1);
  const [durationUnit, setDurationUnit] = useState<"t" | "s" | "m">("t");
  const [barrierDigit, setBarrierDigit] = useState(8);
  const [barrierOffset, setBarrierOffset] = useState("+0.10");
  const [growthRate, setGrowthRate] = useState(0.03);
  const [multiplier, setMultiplier] = useState(100);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [payouts, setPayouts] = useState<Record<string, { payout: number; pct: number }>>({});
  const [accuMeta, setAccuMeta] = useState<{
    maxPayout: number | null;
    maxTicks: number | null;
    high: number | null;
    low: number | null;
    tickSize: number | null;
    minStake: number | null;
    maxStake: number | null;
  }>({ maxPayout: null, maxTicks: null, high: null, low: null, tickSize: null, minStake: null, maxStake: null });

  useEffect(() => {
    setSide(SIDES_BY_CATEGORY[category][0].value);
    onCategoryChange?.(category);
  }, [category]);

  const isDigit = ["even_odd", "over_under", "matches_differs"].includes(category);
  const needsDigit = category === "over_under" || category === "matches_differs";
  const needsBarrierOffset = category === "higher_lower" || category === "touch_no_touch";
  const isAccumulator = category === "accumulator";
  const isMultiplier = category === "multiplier";
  const showDuration = !isAccumulator && !isMultiplier;
  const sides = SIDES_BY_CATEGORY[category];
  const catIdx = TRADE_CATEGORIES.findIndex((c) => c.value === category);
  const cycleCategory = useCallback(
    (dir: -1 | 1) => {
      const next = (catIdx + dir + TRADE_CATEGORIES.length) % TRADE_CATEGORIES.length;
      setCategory(TRADE_CATEGORIES[next].value);
    },
    [catIdx],
  );
  const currentCategory = TRADE_CATEGORIES[catIdx];

  // Live proposal pricing (non-accumulator)
  useEffect(() => {
    if (isAccumulator || !token) return;
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
            /* ignore per-side errors */
          }
        }
        if (!cancelled) {
          setPayouts(next);
          setAccuMeta((m) => ({ ...m, high: null, low: null, tickSize: null }));
          onAccumulatorBarriers?.({ high: null, low: null });
        }
      } catch {
        /* ignore */
      }
    };
    const t = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, category, side, stake, duration, durationUnit, barrierDigit, barrierOffset, growthRate, multiplier, market, payoutMode, currency, isAccumulator]);

  // Accumulator: stream live proposal for real-time barriers
  useEffect(() => {
    if (!isAccumulator) {
      onAccumulatorBarriers?.({ high: null, low: null });
      return;
    }
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        if (token) await send({ authorize: token });
        unsub = await subscribeProposal(
          {
            amount: stake,
            basis: payoutMode,
            contract_type: "ACCU",
            currency,
            symbol: market,
            growth_rate: growthRate,
            ...(takeProfitEnabled && takeProfit > 0
              ? { limit_order: { take_profit: takeProfit } }
              : {}),
          },
          (pr) => {
            if (cancelled) return;
            const high = pr.high_barrier != null ? Number(pr.high_barrier) : null;
            const low = pr.low_barrier != null ? Number(pr.low_barrier) : null;
            const tsb = pr.tick_size_barrier != null ? Number(pr.tick_size_barrier) : null;
            const p = Number(pr.payout ?? 0);
            const pct = stake > 0 ? ((p - stake) / stake) * 100 : 0;
            setPayouts((prev) => ({ ...prev, buy: { payout: p, pct } }));
            setAccuMeta({
              maxPayout: Number(pr.maximum_payout ?? 0) || null,
              maxTicks: Number(pr.maximum_ticks ?? 0) || null,
              high,
              low,
              tickSize: tsb,
              minStake: pr.min_stake != null ? Number(pr.min_stake) : null,
              maxStake: pr.max_stake != null ? Number(pr.max_stake) : null,
            });
            if (high != null && low != null) {
              onAccumulatorBarriers?.({ high, low });
            } else if (tsb != null && lastPriceRef.current != null) {
              const px = lastPriceRef.current;
              onAccumulatorBarriers?.({ high: px * (1 + tsb), low: px * (1 - tsb) });
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
    };
  }, [isAccumulator, token, stake, currency, market, growthRate, payoutMode, takeProfitEnabled, takeProfit]);

  const lastPriceRef = useRef<number | null>(null);
  useEffect(() => {
    lastPriceRef.current = lastPrice ?? null;
  }, [lastPrice]);

  async function handleBuy(sideOverride?: string) {
    const activeSide = sideOverride ?? side;
    if (!user) {
      toast.error("Sign in to place trades.");
      return;
    }
    if (!token) {
      toast.message("Connect your Deriv account to trade.");
      window.location.href = buildOAuthUrl();
      return;
    }
    // Balance guard — warn if balance appears insufficient
    if (balance !== null && balance < stake) {
      toast.error(
        `Insufficient balance: ${balance.toFixed(2)} ${currency}. Your stake is ${stake.toFixed(2)} ${currency}.`,
      );
      return;
    }
    setBusy(true);
    try {
      await send({ authorize: token });
      const contract_type = contractTypeFor(category, activeSide);
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
        if (takeProfitEnabled && takeProfit > 0) {
          proposal.limit_order = { take_profit: takeProfit };
        }
      }
      if (isMultiplier) proposal.multiplier = multiplier;

      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) throw new Error("No proposal returned from Deriv");
      const buyResp = await send({ buy: proposalId, price: stake });
      const contract = buyResp.buy;
      toast.success(`Opened contract ${contract.contract_id}`);

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

      // Poll for contract settlement
      const poll = setInterval(async () => {
        try {
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            if (trade?.id) {
              await supabase
                .from("trades")
                .update({
                  profit_loss: profit,
                  status: profit >= 0 ? "won" : "lost",
                  closed_at: new Date().toISOString(),
                })
                .eq("id", trade.id);
            }
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} ${currency}`,
            );
          }
        } catch {
          /* ignore poll errors */
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 120_000);
    } catch (e: any) {
      toast.error(e.message ?? "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  const accentBuy = "bg-[oklch(0.7_0.17_150)] hover:bg-[oklch(0.65_0.17_150)]";
  const sideAccent: Record<string, string> = {
    up: "bg-emerald-500", down: "bg-rose-500",
    higher: "bg-emerald-500", lower: "bg-rose-500",
    over: "bg-emerald-500", under: "bg-rose-500",
    even: "bg-emerald-500", odd: "bg-rose-500",
    touch: "bg-emerald-500", no_touch: "bg-rose-500",
    matches: "bg-emerald-500", differs: "bg-rose-500",
    buy: "bg-emerald-500",
  };

  return (
    <div className="space-y-3">
      {/* Trade type selector */}
      <div className="rounded-xl border-2 border-[oklch(0.7_0.17_150)] bg-white p-3 shadow-sm">
        <div className="text-[11px] text-[oklch(0.45_0.02_260)] underline underline-offset-2 cursor-pointer">
          Learn about this trade type
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button onClick={() => cycleCategory(-1)} className="rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]" aria-label="Previous trade type">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2 px-3 py-1">
            {isAccumulator ? (
              <span className="text-[oklch(0.7_0.17_150)] text-lg">📈</span>
            ) : (
              <span className="text-lg">📊</span>
            )}
            <span className="font-semibold">{currentCategory?.label}</span>
          </div>
          <button onClick={() => cycleCategory(1)} className="rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]" aria-label="Next trade type">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Duration / Ticks */}
      {showDuration && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="text-center text-sm text-[oklch(0.45_0.02_260)]">
            {durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes"}
          </div>
          <Slider className="mt-3" min={1} max={10} step={1} value={[duration]} onValueChange={(v) => setDuration(v[0])} />
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
                    durationUnit === u ? "bg-[oklch(0.7_0.17_150)] text-white" : "bg-[oklch(0.96_0.005_240)] text-[oklch(0.45_0.02_260)]",
                  )}
                >
                  {u === "t" ? "ticks" : u === "s" ? "sec" : "min"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Last Digit Prediction */}
      {needsDigit && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="text-center text-sm">Last Digit Prediction</div>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, d) => (
              <button
                key={d}
                onClick={() => setBarrierDigit(d)}
                className={cn(
                  "rounded-md border py-2 text-sm font-medium transition",
                  barrierDigit === d
                    ? "border-[oklch(0.7_0.17_150)] bg-[oklch(0.7_0.17_150)]/10"
                    : "border-[oklch(0.92_0.005_240)] bg-white text-[oklch(0.45_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barrier offset (Higher/Lower, Touch/No Touch) */}
      {needsBarrierOffset && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="mb-1 text-sm">Barrier (offset from spot)</div>
          <Input value={barrierOffset} onChange={(e) => setBarrierOffset(e.target.value)} />
        </div>
      )}

      {/* Accumulator: Growth rate */}
      {isAccumulator && (
        <div className="rounded-xl bg-white p-3">
          <div className="mb-2 flex items-center justify-center gap-1 text-sm text-[oklch(0.45_0.02_260)]">
            Growth rate <Info className="h-3.5 w-3.5" />
          </div>
          <div className="grid grid-cols-5 gap-2">
            {[0.01, 0.02, 0.03, 0.04, 0.05].map((g) => (
              <button
                key={g}
                onClick={() => setGrowthRate(g)}
                className={cn(
                  "rounded-md py-2 text-sm font-medium transition",
                  growthRate === g
                    ? "bg-[oklch(0.7_0.17_150)]/15 text-[oklch(0.4_0.15_150)] ring-1 ring-[oklch(0.7_0.17_150)]"
                    : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]",
                )}
              >
                {Math.round(g * 100)}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Multiplier selector */}
      {isMultiplier && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="mb-2 text-sm">Multiplier</div>
          <div className="grid grid-cols-4 gap-2">
            {[10, 20, 30, 50, 100, 200, 300, 500].map((m) => (
              <button
                key={m}
                onClick={() => setMultiplier(m)}
                className={cn(
                  "rounded-md border py-1.5 text-sm font-medium transition",
                  multiplier === m
                    ? "border-[oklch(0.7_0.17_150)] bg-[oklch(0.7_0.17_150)]/10"
                    : "border-[oklch(0.92_0.005_240)] bg-white hover:bg-[oklch(0.96_0.005_240)]",
                )}
              >
                ×{m}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stake */}
      <div className="rounded-xl bg-white p-3">
        {!isAccumulator && (
          <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-lg bg-[oklch(0.96_0.005_240)] p-1">
            <button
              onClick={() => setPayoutMode("stake")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition",
                payoutMode === "stake" ? "bg-white shadow" : "text-[oklch(0.45_0.02_260)]",
              )}
            >
              Stake
            </button>
            <button
              onClick={() => setPayoutMode("payout")}
              className={cn(
                "rounded-md py-1.5 text-sm font-medium transition",
                payoutMode === "payout" ? "bg-white shadow" : "text-[oklch(0.45_0.02_260)]",
              )}
            >
              Payout
            </button>
          </div>
        )}
        <div className="text-center text-sm text-[oklch(0.45_0.02_260)]">Stake</div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setStake((s) => Math.max(isAccumulator ? 1 : 0.35, +(s - 1).toFixed(2)))}
            className="rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
            aria-label="Decrease stake"
          >
            <Minus className="h-4 w-4" />
          </button>
          <Input
            type="number"
            min={isAccumulator ? 1 : 0.35}
            step={1}
            value={stake}
            onChange={(e) => setStake(Number(e.target.value))}
            className="text-center font-mono text-base"
          />
          <button
            onClick={() => setStake((s) => +(s + 1).toFixed(2))}
            className="rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
            aria-label="Increase stake"
          >
            <Plus className="h-4 w-4" />
          </button>
          {/* Currency locked to account currency — no manual override */}
          <span className="min-w-[3rem] rounded-md border border-[oklch(0.92_0.005_240)] bg-[oklch(0.97_0.003_240)] px-2 py-2 text-center text-xs font-semibold text-[oklch(0.4_0.02_260)]">
            {currency}
          </span>
        </div>
        {/* Live balance hint */}
        {balance !== null && (
          <p className="mt-1.5 text-center text-[10px] text-[oklch(0.55_0.02_260)]">
            Balance: <span className="font-mono font-medium">{balance.toFixed(2)} {currency}</span>
            {account && (
              <span className="ml-1 rounded bg-[oklch(0.93_0.005_240)] px-1 py-0.5 text-[9px] uppercase tracking-wider">
                {account.is_demo ? "Demo" : "Real"}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Take profit (Accumulator only) */}
      {isAccumulator && (
        <div className="rounded-xl bg-white p-3">
          <label className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={takeProfitEnabled}
                onChange={(e) => setTakeProfitEnabled(e.target.checked)}
                className="size-4 rounded border-[oklch(0.85_0.01_240)]"
              />
              Take profit <Info className="h-3.5 w-3.5 text-[oklch(0.6_0.02_260)]" />
            </span>
          </label>
          {takeProfitEnabled && (
            <div className="mt-2 flex items-center gap-2">
              <button
                onClick={() => setTakeProfit((v) => Math.max(0, +(v - 1).toFixed(2)))}
                className="rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
                aria-label="Decrease take profit"
              >
                <Minus className="h-4 w-4" />
              </button>
              <Input
                type="number"
                min={0}
                step={1}
                value={takeProfit}
                onChange={(e) => setTakeProfit(Number(e.target.value))}
                className="text-center font-mono"
                placeholder={`Amount (${currency})`}
              />
              <button
                onClick={() => setTakeProfit((v) => +(v + 1).toFixed(2))}
                className="rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
                aria-label="Increase take profit"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xs text-[oklch(0.45_0.02_260)]">{currency}</span>
            </div>
          )}
        </div>
      )}

      {/* Accumulator stat rows — Barriers, Max payout, Max ticks */}
      {isAccumulator && (
        <div className="rounded-xl bg-white p-3 text-sm">
          {/* Barriers — most important, shown prominently */}
          {accuMeta.high != null && accuMeta.low != null ? (
            <div className="mb-2 rounded-lg border border-[oklch(0.7_0.17_150)]/30 bg-[oklch(0.97_0.01_150)] p-2">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.5_0.15_150)]">
                Barriers (current tick)
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-emerald-700">
                  <span className="inline-block h-0.5 w-3 rounded bg-emerald-500" />
                  High
                </span>
                <span className="font-mono text-sm font-semibold text-emerald-700">{accuMeta.high.toFixed(4)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-red-600">
                  <span className="inline-block h-0.5 w-3 rounded bg-red-500" />
                  Low
                </span>
                <span className="font-mono text-sm font-semibold text-red-600">{accuMeta.low.toFixed(4)}</span>
              </div>
              <div className="mt-1 text-[10px] text-[oklch(0.5_0.02_260)]">
                Price must stay within these levels each tick
              </div>
            </div>
          ) : (
            <div className="mb-2 rounded-lg border border-[oklch(0.92_0.005_240)] bg-[oklch(0.97_0.003_240)] p-2 text-[11px] text-[oklch(0.55_0.02_260)]">
              Barriers will appear once connected to Deriv
            </div>
          )}
          <div className="flex items-center justify-between py-1">
            <span className="text-[oklch(0.4_0.02_260)]">Max. payout</span>
            <span className="font-medium underline decoration-dotted">
              {accuMeta.maxPayout != null ? `${accuMeta.maxPayout.toFixed(2)} ${currency}` : `6,000.00 ${currency}`}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[oklch(0.4_0.02_260)]">Max. ticks</span>
            <span className="font-medium underline decoration-dotted">
              {accuMeta.maxTicks ?? 85} ticks
            </span>
          </div>
          {accuMeta.tickSize != null && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[oklch(0.4_0.02_260)]">Tick size barrier</span>
              <span className="font-medium">±{accuMeta.tickSize.toFixed(5)}</span>
            </div>
          )}
          {(accuMeta.minStake != null || accuMeta.maxStake != null) && (
            <div className="flex items-center justify-between py-1">
              <span className="text-[oklch(0.4_0.02_260)]">Stake range</span>
              <span className="font-medium">
                {(accuMeta.minStake ?? 1).toFixed(2)} – {(accuMeta.maxStake ?? 2000).toFixed(2)} {currency}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Side cards (non-accumulator) */}
      {!isAccumulator && (
        <div className="space-y-2">
          {sides.map((s) => {
            const live = payouts[s.value];
            const isSelected = side === s.value;
            return (
              <button
                key={s.value}
                onClick={() => {
                  setSide(s.value);
                  if (!user) {
                    toast.error("Sign in to place trades.");
                    return;
                  }
                  if (!token) {
                    toast.message("Connect your Deriv account to trade.");
                    window.location.href = buildOAuthUrl();
                    return;
                  }
                  if (!busy) void handleBuy(s.value);
                }}
                disabled={busy}
                className={cn(
                  "w-full overflow-hidden rounded-xl text-left transition disabled:opacity-60",
                  isSelected ? "ring-2 ring-[oklch(0.55_0.22_265)]/60" : "opacity-90 hover:opacity-100",
                )}
              >
                <div className="flex items-center justify-between bg-[oklch(0.96_0.005_240)] px-3 py-1.5 text-xs text-[oklch(0.45_0.02_260)]">
                  <span>Payout {live ? live.payout.toFixed(2) : "—"} {currency}</span>
                </div>
                <div className={cn("flex items-center justify-between px-4 py-3 text-white", sideAccent[s.value] ?? "bg-muted")}>
                  <span className="font-semibold">
                    {busy && side === s.value ? "Submitting…" : s.label}
                  </span>
                  <span className="font-mono text-sm">{live ? `${live.pct.toFixed(2)}%` : ""}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Buy button (Accumulator / Multiplier) */}
      {(isAccumulator || isMultiplier) && (
        <Button
          onClick={() => {
            if (!user) {
              toast.error("Sign in to place trades.");
              return;
            }
            if (!token) {
              window.location.href = buildOAuthUrl();
              return;
            }
            void handleBuy();
          }}
          disabled={busy}
          className={cn(
            "h-12 w-full rounded-xl text-base font-semibold text-white",
            isAccumulator ? accentBuy : "",
          )}
        >
          {busy
            ? "Submitting…"
            : token
              ? `Buy ${sides.find((s) => s.value === side)?.label ?? ""} (${isDemo ? "Demo" : "Live"})`
              : "Sign in & connect Deriv to trade"}
        </Button>
      )}

      <p className="text-[11px] text-[oklch(0.5_0.02_260)]">
        Last price: <span className="font-mono">{lastPrice?.toFixed(4) ?? "—"}</span>. You can lose money rapidly.
      </p>
    </div>
  );
}
