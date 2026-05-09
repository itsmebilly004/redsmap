import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import {
  send,
  setAuthenticatedAccount,
  getTradingSocketAccountId,
  TRADE_CATEGORIES,
  SIDES_BY_CATEGORY,
  contractTypeFor,
  buildOAuthUrl,
  type TradeCategory,
} from "@/lib/deriv";
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
import {
  ChevronLeft,
  ChevronRight,
  Info,
  Minus,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type TradeProposalPayload = Record<string, unknown> & {
  proposal: 1;
  amount: number;
  basis: string;
  contract_type: string;
  currency: string;
  underlying_symbol: string;
  duration?: number;
  duration_unit?: "t" | "s" | "m";
  barrier?: string;
  growth_rate?: number;
  multiplier?: number;
  limit_order?: { take_profit: number };
};

interface TradePanelProps {
  market: string;
  lastPrice?: number | null;
  onAccumulatorBarriers?: (b: { high: number | null; low: number | null }) => void;
}

export function TradePanel({ market, lastPrice, onAccumulatorBarriers }: TradePanelProps) {
  const { user } = useAuth();
  const { account, balance: accountBalance, currency } = useDerivBalanceContext();
  const token = account?.deriv_token ?? null;
  const isDemo = account?.is_demo ?? true;
  const tradeCurrency = currency || account?.currency || "";

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
  const [openAccumulator, setOpenAccumulator] = useState<{
    contractId: string;
    tradeId?: string;
    buyPrice: number;
    bidPrice: number | null;
    profit: number | null;
  } | null>(null);
  const [payouts, setPayouts] = useState<Record<string, { payout: number; pct: number }>>({});
  const activePollsRef = useRef<Set<ReturnType<typeof setInterval>>>(new Set());

  useEffect(() => {
    const activePolls = activePollsRef.current;
    return () => {
      activePolls.forEach(clearInterval);
    };
  }, []);

  const [accuMeta, setAccuMeta] = useState<{
    maxPayout: number | null;
    maxTicks: number | null;
    high: number | null;
    low: number | null;
    tickSize: number | null;
    tickFreq: number | null;
    minStake: number | null;
    maxStake: number | null;
  }>({
    maxPayout: null,
    maxTicks: null,
    high: null,
    low: null,
    tickSize: null,
    tickFreq: null,
    minStake: null,
    maxStake: null,
  });

  useEffect(() => {
    setSide(SIDES_BY_CATEGORY[category][0].value);
  }, [category]);

  const isDigit = ["even_odd", "over_under", "matches_differs"].includes(category);
  const needsDigit = category === "over_under" || category === "matches_differs";
  const needsBarrierOffset = category === "higher_lower" || category === "touch_no_touch";
  const isAccumulator = category === "accumulator";
  const isMultiplier = category === "multiplier";
  const showDuration = !isAccumulator && !isMultiplier;
  const sides = SIDES_BY_CATEGORY[category];
  const catIdx = TRADE_CATEGORIES.findIndex((c) => c.value === category);
  const currentDigit =
    lastPrice != null && Number.isFinite(lastPrice) ? Number(lastPrice.toFixed(2).slice(-1)) : null;
  const cycleCategory = useCallback(
    (dir: -1 | 1) => {
      const next = (catIdx + dir + TRADE_CATEGORIES.length) % TRADE_CATEGORIES.length;
      setCategory(TRADE_CATEGORIES[next].value);
    },
    [catIdx],
  );
  const currentCategory = TRADE_CATEGORIES[catIdx];

  useEffect(() => {
    if (!token || !tradeCurrency) {
      setPayouts({});
      return;
    }
    if (account) {
      setAuthenticatedAccount(token, account.account_id, account.is_virtual ?? account.is_demo);
    }

    let cancelled = false;
    const run = async () => {
      try {
        const next: Record<string, { payout: number; pct: number }> = {};
        let accuInfo: typeof accuMeta | null = null;
        for (const s of sides) {
          const ct = contractTypeFor(category, s.value);
          const proposal: TradeProposalPayload = {
            proposal: 1,
            amount: stake,
            basis: payoutMode,
            contract_type: ct,
            currency: tradeCurrency,
            underlying_symbol: market,
          };
          if (showDuration) {
            proposal.duration = duration;
            proposal.duration_unit = isDigit ? "t" : durationUnit;
          }
          if (needsDigit) proposal.barrier = String(barrierDigit);
          if (needsBarrierOffset) proposal.barrier = barrierOffset;
          if (isAccumulator) proposal.growth_rate = growthRate;
          if (isMultiplier) proposal.multiplier = multiplier;
          try {
            const r = await send(proposal);
            const p = Number(r.proposal?.payout ?? 0);
            const pct = stake > 0 ? ((p - stake) / stake) * 100 : 0;
            next[s.value] = { payout: p, pct };
            if (isAccumulator) {
              const pr = r.proposal ?? {};
              const high = pr.high_barrier ?? pr.barrier_spot_distance ?? null;
              const low = pr.low_barrier ?? null;
              accuInfo = {
                maxPayout: Number(pr.maximum_payout ?? 0) || null,
                maxTicks: Number(pr.maximum_ticks ?? 0) || null,
                high: high != null ? Number(high) : null,
                low: low != null ? Number(low) : null,
                tickSize: pr.tick_size_barrier != null ? Number(pr.tick_size_barrier) : null,
                tickFreq: pr.tick_count != null ? Number(pr.tick_count) : null,
                minStake: pr.min_stake != null ? Number(pr.min_stake) : null,
                maxStake: pr.max_stake != null ? Number(pr.max_stake) : null,
              };
            }
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) {
          setPayouts(next);
          if (isAccumulator && accuInfo) {
            setAccuMeta(accuInfo);
          } else if (!isAccumulator) {
            setAccuMeta((m) => ({ ...m, high: null, low: null, tickSize: null }));
            onAccumulatorBarriers?.({ high: null, low: null });
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    token,
    category,
    side,
    stake,
    duration,
    durationUnit,
    barrierDigit,
    barrierOffset,
    growthRate,
    multiplier,
    market,
    payoutMode,
    tradeCurrency,
    account,
  ]);

  // Deriv accumulator barriers are recomputed on every tick from the current
  // spot using `tick_size_barrier` (fractional distance from spot). Mirror that
  // exact logic so the blue guide lines track the price the same way Deriv's
  // own chart does.
  useEffect(() => {
    if (!isAccumulator) return;
    if (lastPrice == null || !Number.isFinite(lastPrice)) {
      onAccumulatorBarriers?.({ high: null, low: null });
      return;
    }
    const tsb = accuMeta.tickSize;
    if (tsb != null && Number.isFinite(tsb) && tsb > 0) {
      const high = lastPrice * (1 + tsb);
      const low = lastPrice * (1 - tsb);
      onAccumulatorBarriers?.({ high, low });
    } else if (growthRate > 0) {
      const estimatedTickSize = Math.max(0.0005, growthRate / 10);
      const high = lastPrice * (1 + estimatedTickSize);
      const low = lastPrice * (1 - estimatedTickSize);
      onAccumulatorBarriers?.({ high, low });
    } else if (accuMeta.high != null && accuMeta.low != null) {
      // Until we receive proposal metadata, fall back to the absolute barriers
      // returned by the most recent proposal.
      onAccumulatorBarriers?.({ high: accuMeta.high, low: accuMeta.low });
    }
  }, [
    isAccumulator,
    lastPrice,
    accuMeta.tickSize,
    accuMeta.high,
    accuMeta.low,
    growthRate,
    onAccumulatorBarriers,
  ]);

  async function handleBuy(sideOverride?: string) {
    const activeSide = sideOverride ?? side;
    if (!user) {
      toast.error("Sign in to place trades.");
      return;
    }
    if (!token) {
      toast.error("Connect your Deriv account first.");
      return;
    }
    if (!account) {
      toast.error("Select a Deriv account first.");
      return;
    }
    if (!tradeCurrency) {
      toast.error("Account currency is missing. Reconnect your Deriv account.");
      return;
    }
    if (!Number.isFinite(stake) || stake <= 0) {
      toast.error("Enter a valid stake.");
      return;
    }
    setAuthenticatedAccount(token, account.account_id, account.is_virtual ?? account.is_demo);
    if (accountBalance !== null && accountBalance < stake) {
      toast.error(
        `Insufficient balance: ${accountBalance.toFixed(2)} ${tradeCurrency} available, need ${stake.toFixed(2)} ${tradeCurrency}.`,
      );
      return;
    }
    setBusy(true);
    try {
      const contract_type = contractTypeFor(category, activeSide);
      const proposal: TradeProposalPayload = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type,
        currency: tradeCurrency,
        underlying_symbol: market,
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
      console.info("[Deriv Trade] Placing trade", {
        selectedAccountId: account.account_id,
        selectedLoginId: account.loginid,
        is_demo: account.is_demo,
        is_virtual: account.is_virtual,
        wsAccountId: getTradingSocketAccountId(),
        finalProposalPayload: proposal,
      });

      const propResp = await send(proposal);
      const proposalId = propResp.proposal?.id;
      if (!proposalId) throw new Error("No proposal returned");
      const buyResp = await send({ buy: proposalId, price: stake });
      const contract = buyResp.buy;
      const contractId = String(contract?.contract_id ?? "");
      if (!contract || !contractId) throw new Error("No contract returned");
      toast.success(`Bought contract ${contractId}`);

      const { data: trade, error: tradeInsertError } = await supabase
        .from("trades")
        .insert({
          user_id: user.id,
          deriv_contract_id: contractId,
          symbol: market,
          trade_type: contract_type,
          stake,
          payout: Number(contract.payout ?? 0),
          status: "open",
        })
        .select()
        .single();
      if (tradeInsertError) {
        console.error("Could not save trade history", tradeInsertError);
        toast.error("Trade placed, but history could not be saved.");
      }

      if (isAccumulator) {
        setOpenAccumulator({
          contractId,
          tradeId: trade?.id,
          buyPrice: Number(contract.buy_price ?? stake),
          bidPrice: null,
          profit: 0,
        });
      }

      const poll = setInterval(async () => {
        try {
          const res = await send({ proposal_open_contract: 1, contract_id: contractId });
          const c = res.proposal_open_contract;
          if (isAccumulator && !c?.is_sold) {
            setOpenAccumulator((current) =>
              current?.contractId === contractId
                ? {
                    ...current,
                    bidPrice: c?.bid_price != null ? Number(c.bid_price) : current.bidPrice,
                    profit: c?.profit != null ? Number(c.profit) : current.profit,
                  }
                : current,
            );
          }
          if (c?.is_sold) {
            clearInterval(poll);
            activePollsRef.current.delete(poll);
            const profit = Number(c.profit ?? 0);
            if (isAccumulator) setOpenAccumulator(null);
            if (trade?.id) {
              const { error: tradeUpdateError } = await supabase
                .from("trades")
                .update({
                  profit_loss: profit,
                  status: profit >= 0 ? "won" : "lost",
                  closed_at: new Date().toISOString(),
                })
                .eq("id", trade.id);
              if (tradeUpdateError) {
                console.error("Could not update closed trade", tradeUpdateError);
              }
            }
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} ${tradeCurrency}`,
            );
          }
        } catch {
          /* ignore */
        }
      }, 1500);
      activePollsRef.current.add(poll);
      setTimeout(() => {
        clearInterval(poll);
        activePollsRef.current.delete(poll);
      }, 120000);
    } catch (e: unknown) {
      console.error("Trade failed", e);
      toast.error(e instanceof Error ? e.message : "Trade failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSellAccumulator() {
    if (!openAccumulator) return;
    setBusy(true);
    try {
      const response = await send({ sell: openAccumulator.contractId, price: 0 });
      const sold = response.sell;
      const profit = Number(sold?.profit ?? openAccumulator.profit ?? 0);
      if (openAccumulator.tradeId) {
        const { error: tradeUpdateError } = await supabase
          .from("trades")
          .update({
            profit_loss: profit,
            status: profit >= 0 ? "won" : "lost",
            closed_at: new Date().toISOString(),
          })
          .eq("id", openAccumulator.tradeId);
        if (tradeUpdateError) {
          console.error("Could not update sold accumulator", tradeUpdateError);
          toast.error("Accumulator sold, but history could not be updated.");
        }
      }
      toast[profit >= 0 ? "success" : "error"](
        `Sold accumulator ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} ${tradeCurrency}`,
      );
      setOpenAccumulator(null);
    } catch (error: unknown) {
      console.error("Could not sell accumulator", error);
      toast.error(error instanceof Error ? error.message : "Could not sell accumulator");
    } finally {
      setBusy(false);
    }
  }

  const accentBuy = "bg-[oklch(0.7_0.17_150)] hover:bg-[oklch(0.65_0.17_150)]";
  const sideAccent: Record<string, string> = {
    up: "bg-emerald-500",
    down: "bg-rose-500",
    higher: "bg-emerald-500",
    lower: "bg-rose-500",
    over: "bg-emerald-500",
    under: "bg-rose-500",
    even: "bg-emerald-500",
    odd: "bg-rose-500",
    touch: "bg-emerald-500",
    no_touch: "bg-rose-500",
    matches: "bg-emerald-500",
    differs: "bg-rose-500",
    buy: "bg-emerald-500",
  };

  return (
    <div className="min-w-0 space-y-3">
      {/* Trade type pill (green border highlight matches Deriv accumulator selector) */}
      <div className="rounded-xl border-2 border-[oklch(0.7_0.17_150)] bg-white p-3 shadow-sm">
        <div className="text-[11px] text-[oklch(0.45_0.02_260)] underline underline-offset-2">
          Learn about this trade type
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => cycleCategory(-1)}
            className="rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]"
            aria-label="Previous trade type"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex flex-1 items-center justify-center gap-2 px-3 py-1">
            {isAccumulator ? (
              <span className="text-[oklch(0.7_0.17_150)]">📈</span>
            ) : (
              <>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </>
            )}
            <span className="font-semibold">{currentCategory?.label}</span>
          </div>
          <button
            onClick={() => cycleCategory(1)}
            className="rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]"
            aria-label="Next trade type"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showDuration && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="text-center text-sm text-[oklch(0.45_0.02_260)]">
            {durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes"}
          </div>
          <Slider
            className="mt-3"
            min={1}
            max={10}
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
                    durationUnit === u
                      ? "bg-[oklch(0.7_0.17_150)] text-white"
                      : "bg-[oklch(0.96_0.005_240)] text-[oklch(0.45_0.02_260)]",
                  )}
                >
                  {u === "t" ? "ticks" : u === "s" ? "sec" : "min"}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isDigit && (
        <DigitWheel
          category={category}
          currentDigit={currentDigit}
          selectedDigit={barrierDigit}
          selectedSide={side}
          onDigitChange={needsDigit ? setBarrierDigit : undefined}
        />
      )}

      {needsBarrierOffset && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="mb-1 text-sm">Barrier (offset from spot)</div>
          <Input value={barrierOffset} onChange={(e) => setBarrierOffset(e.target.value)} />
        </div>
      )}

      {/* Accumulator: Growth rate pills */}
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

      {isMultiplier && (
        <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
          <div className="mb-2 text-sm">Multiplier</div>
          <Select value={String(multiplier)} onValueChange={(v) => setMultiplier(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50, 100, 200, 300, 500].map((m) => (
                <SelectItem key={m} value={String(m)}>
                  ×{m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Stake (with currency selector for accumulator) */}
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
        <div className="mt-2 flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setStake((s) => Math.max(isAccumulator ? 1 : 0.35, +(s - 1).toFixed(2)))}
            className="shrink-0 rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
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
            className="min-w-0 text-center font-mono text-base"
          />
          <button
            onClick={() => setStake((s) => +(s + 1).toFixed(2))}
            className="shrink-0 rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
            aria-label="Increase stake"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="w-10 shrink-0 truncate text-center text-xs font-medium text-[oklch(0.45_0.02_260)] sm:w-14 sm:text-sm">
            {tradeCurrency}
          </span>
        </div>
      </div>

      {/* Take profit (Accumulator only) — Deriv-style stepper */}
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
            <div className="mt-2 flex min-w-0 items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setTakeProfit((v) => Math.max(0, +(v - 1).toFixed(2)))}
                className="shrink-0 rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
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
                className="min-w-0 text-center font-mono"
                placeholder={`Amount (${tradeCurrency})`}
              />
              <button
                onClick={() => setTakeProfit((v) => +(v + 1).toFixed(2))}
                className="shrink-0 rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]"
                aria-label="Increase take profit"
              >
                <Plus className="h-4 w-4" />
              </button>
              <span className="w-10 shrink-0 truncate text-center text-xs text-[oklch(0.45_0.02_260)] sm:w-12">
                {tradeCurrency}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Accumulator stat rows (mirrors Deriv's proposal summary) */}
      {isAccumulator && (
        <div className="rounded-xl border border-[#d8edf7] bg-[#f7fcff] p-3 text-sm">
          <div className="mb-2 flex items-center justify-between rounded-md bg-white px-3 py-2 text-xs">
            <span className="font-semibold text-[#147a78]">Accumulator barrier corridor</span>
            <span className="font-mono text-[#555555]">
              {lastPrice != null ? lastPrice.toFixed(4) : "-"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 py-1">
            <span className="text-[oklch(0.4_0.02_260)]">Max. payout</span>
            <span className="font-medium underline decoration-dotted">
              {accuMeta.maxPayout != null
                ? `${accuMeta.maxPayout.toFixed(2)} ${tradeCurrency}`
                : `6,000.00 ${tradeCurrency}`}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-1 py-1">
            <span className="text-[oklch(0.4_0.02_260)]">Max. ticks</span>
            <span className="font-medium underline decoration-dotted">
              {accuMeta.maxTicks ?? 85} ticks
            </span>
          </div>
          {accuMeta.tickSize != null && (
            <div className="flex flex-wrap items-center justify-between gap-1 py-1">
              <span className="text-[oklch(0.4_0.02_260)]">Tick size barrier</span>
              <span className="font-medium">±{accuMeta.tickSize.toFixed(5)}</span>
            </div>
          )}
          {(accuMeta.minStake != null || accuMeta.maxStake != null) && (
            <div className="flex flex-wrap items-center justify-between gap-1 py-1">
              <span className="text-[oklch(0.4_0.02_260)]">Stake range</span>
              <span className="font-medium">
                {(accuMeta.minStake ?? 1).toFixed(2)} – {(accuMeta.maxStake ?? 2000).toFixed(2)}{" "}
                {tradeCurrency}
              </span>
            </div>
          )}
          {accuMeta.high != null && accuMeta.low != null && (
            <div className="flex flex-wrap items-center justify-between gap-1 py-1">
              <span className="text-[oklch(0.4_0.02_260)]">Barriers</span>
              <span className="font-mono text-xs">
                {accuMeta.low.toFixed(4)} / {accuMeta.high.toFixed(4)}
              </span>
            </div>
          )}
          {openAccumulator && (
            <div className="mt-2 rounded-md border border-[#cce9e7] bg-white p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#147a78]">Open accumulator</span>
                <span
                  className={cn(
                    "font-mono font-bold",
                    (openAccumulator.profit ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600",
                  )}
                >
                  {(openAccumulator.profit ?? 0) >= 0 ? "+" : ""}
                  {(openAccumulator.profit ?? 0).toFixed(2)} {tradeCurrency}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-[#666666]">
                <span>Sell price</span>
                <span className="font-mono">
                  {openAccumulator.bidPrice != null
                    ? `${openAccumulator.bidPrice.toFixed(2)} ${tradeCurrency}`
                    : "Pending"}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Side cards (non-accumulator) — click to execute the trade for that side */}
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
                    buildOAuthUrl({ returnTo: "/" }).then((url) => {
                      console.log("Deriv OAuth URL:", url);
                      window.location.href = url;
                    });
                    return;
                  }
                  if (!busy) void handleBuy(s.value);
                }}
                disabled={busy}
                className={cn(
                  "w-full overflow-hidden rounded-xl text-left transition disabled:opacity-60",
                  isSelected
                    ? "ring-2 ring-[oklch(0.55_0.22_265)]/60"
                    : "opacity-90 hover:opacity-100",
                )}
              >
                <div className="flex items-center justify-between bg-[oklch(0.96_0.005_240)] px-3 py-1.5 text-xs text-[oklch(0.45_0.02_260)]">
                  <span>
                    Payout {live ? live.payout.toFixed(2) : "—"} {tradeCurrency}
                  </span>
                </div>
                <div
                  className={cn(
                    "flex items-center justify-between px-4 py-3 text-white",
                    sideAccent[s.value] ?? "bg-muted",
                  )}
                >
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
            if (isAccumulator && openAccumulator) {
              void handleSellAccumulator();
              return;
            }
            if (!user) {
              toast.error("Sign in to place trades.");
              return;
            }
            if (!token) {
              buildOAuthUrl({ returnTo: "/" }).then((url) => {
                console.log("Deriv OAuth URL:", url);
                window.location.href = url;
              });
              return;
            }
            void handleBuy();
          }}
          disabled={busy}
          className={cn(
            "h-12 w-full rounded-xl text-base font-semibold text-white",
            isAccumulator ? (openAccumulator ? "bg-[#ff444f] hover:bg-[#eb3e48]" : accentBuy) : "",
          )}
        >
          {busy
            ? "Submitting…"
            : openAccumulator
              ? `Sell ${openAccumulator.bidPrice != null ? openAccumulator.bidPrice.toFixed(2) : ""} ${tradeCurrency}`
              : token
                ? `Buy ${sides.find((s) => s.value === side)?.label ?? ""} (${isDemo ? "Demo" : "Live"})`
                : "Sign in & connect Deriv to trade"}
        </Button>
      )}

      <p className="text-[11px] text-[oklch(0.5_0.02_260)]">
        Last price: <span className="font-mono">{lastPrice?.toFixed(4) ?? "—"}</span>. You can lose
        money rapidly.
      </p>
    </div>
  );
}

function DigitWheel({
  category,
  currentDigit,
  onDigitChange,
  selectedDigit,
  selectedSide,
}: {
  category: TradeCategory;
  currentDigit: number | null;
  onDigitChange?: (digit: number) => void;
  selectedDigit: number;
  selectedSide: string;
}) {
  const digits = Array.from({ length: 10 }, (_, digit) => digit);
  const isReadOnly = !onDigitChange;
  const title = category === "even_odd" ? "Last digit" : "Prediction digit";

  return (
    <div className="rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-[oklch(0.5_0.02_260)]">
            {category === "over_under"
              ? `${selectedSide === "over" ? "Over" : "Under"} ${selectedDigit}`
              : category === "matches_differs"
                ? `${selectedSide === "matches" ? "Matches" : "Differs"} ${selectedDigit}`
                : selectedSide === "even"
                  ? "Even digits"
                  : "Odd digits"}
          </div>
        </div>
        <div className="rounded-md bg-[#ff444f] px-2.5 py-1 text-xs font-bold text-white">
          {currentDigit ?? "-"}
        </div>
      </div>

      <div className="relative mx-auto size-56">
        <div className="absolute inset-7 rounded-full border border-[#ececec] bg-[#fafafa]" />
        <div className="absolute left-1/2 top-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#dedede] bg-white shadow-sm">
          <span className="text-[10px] font-bold uppercase text-[#777777]">Spot</span>
          <span className="font-mono text-2xl font-bold text-[#333333]">{currentDigit ?? "-"}</span>
        </div>

        {digits.map((digit, index) => {
          const angle = (index / digits.length) * Math.PI * 2 - Math.PI / 2;
          const radius = 86;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          const selected = !isReadOnly && selectedDigit === digit;
          const live = currentDigit === digit;
          const evenOddMatch =
            category === "even_odd" &&
            ((selectedSide === "even" && digit % 2 === 0) ||
              (selectedSide === "odd" && digit % 2 === 1));
          return (
            <button
              key={digit}
              type="button"
              disabled={isReadOnly}
              onClick={() => onDigitChange?.(digit)}
              className={cn(
                "absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-bold transition",
                selected && "border-[#ff444f] bg-[#ff444f] text-white shadow-md",
                !selected && evenOddMatch && "border-[#4bb4b3] bg-[#e5f7f6] text-[#147a78]",
                !selected && !evenOddMatch && "border-[#dedede] bg-white text-[#555555]",
                live && "ring-2 ring-[#ff444f]/40",
                !isReadOnly && "hover:border-[#ff444f]",
              )}
              style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
              aria-label={`Digit ${digit}`}
            >
              {digit}
            </button>
          );
        })}
      </div>
    </div>
  );
}
