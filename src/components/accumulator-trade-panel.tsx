import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Info, Minus, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { isDemoAccount } from "@/lib/deriv-account";
import {
  buildOAuthUrl,
  getTradingSocketAccountId,
  onStatus,
  redirectToDerivOAuth,
  setAuthenticatedAccount,
} from "@/lib/deriv";
import { SYNTHETIC_MARKETS } from "@/lib/deriv";
import { supabase } from "@/integrations/supabase/client";
import {
  ACCUMULATOR_GROWTH_RATES,
  EMPTY_ACCUMULATOR_CONTRACT,
  buildAccumulatorProposalPayload,
  normalizeAccumulatorContract,
  type AccumulatorContractState,
} from "@/lib/accumulator-engine";
import {
  buyProposal,
  requestProposal,
  sellContract,
  subscribeOpenContract,
} from "@/lib/deriv-trading-service";
import { cn } from "@/lib/utils";

type BarrierUpdate = {
  entry: number | null;
  high: number | null;
  low: number | null;
  breached?: boolean;
};

type Props = {
  lastPrice?: number | null;
  market: string;
  onBarriers?: (barriers: BarrierUpdate) => void;
  onMarketChange?: (market: string) => void;
};

export function AccumulatorTradePanel({ lastPrice, market, onBarriers, onMarketChange }: Props) {
  const { user } = useAuth();
  const { account, balance: accountBalance, currency } = useDerivBalanceContext();
  const token = account?.deriv_token ?? null;
  const tradeCurrency = currency || account?.currency || "";
  const accountLoginId = account?.loginid || account?.account_id || "";
  const selectedAccountIsDemo = account ? isDemoAccount(account) : false;

  const [stake, setStake] = useState(10);
  const [growthRate, setGrowthRate] = useState<number>(0.03);
  const [takeProfitEnabled, setTakeProfitEnabled] = useState(false);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<AccumulatorContractState>(EMPTY_ACCUMULATOR_CONTRACT);
  const unsubscribeRef = useRef<null | (() => Promise<void>)>(null);
  const activeAccountIdRef = useRef<string | null>(null);
  const buyInFlightRef = useRef(false);
  const closedRef = useRef(false);
  const tradeIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      void unsubscribeRef.current?.();
    };
  }, []);

  useEffect(() => {
    const off = onStatus((socketStatus) => {
      if (socketStatus !== "disconnected") return;
      void cleanupSubscription();
      setState((current) =>
        current.status === "active"
          ? {
              ...current,
              status: "error",
              error: "Deriv WebSocket disconnected. Please reconnect before trading again.",
              isValidToSell: false,
            }
          : current,
      );
    });
    return off;
  }, []);

  useEffect(() => {
    onBarriers?.({
      entry: state.entrySpot,
      high: state.upperBarrier,
      low: state.lowerBarrier,
      breached: state.barrierBreached,
    });
  }, [onBarriers, state.barrierBreached, state.entrySpot, state.lowerBarrier, state.upperBarrier]);

  useEffect(() => {
    if (!state.contractId || state.status !== "active") return;
    const currentSocketAccount = getTradingSocketAccountId();
    const selectedAccountId = account?.account_id ?? null;
    const activeAccountId = activeAccountIdRef.current;
    if (
      (currentSocketAccount && selectedAccountId && currentSocketAccount !== selectedAccountId) ||
      (activeAccountId && selectedAccountId && activeAccountId !== selectedAccountId)
    ) {
      setState((current) => ({
        ...current,
        status: "error",
        error: "Deriv WebSocket account changed. Reconnect the selected account.",
      }));
      void cleanupSubscription();
    }
  }, [account?.account_id, state.contractId, state.status]);

  async function cleanupSubscription() {
    const unsubscribe = unsubscribeRef.current;
    unsubscribeRef.current = null;
    if (unsubscribe) await unsubscribe();
  }

  function validateAccount() {
    if (!user) throw new Error("Sign in to place trades.");
    if (!token || !account) throw new Error("Connect and select your Deriv account first.");
    if (!tradeCurrency) throw new Error("Selected account currency is missing.");
    if (!Number.isFinite(stake) || stake <= 0) throw new Error("Enter a valid stake.");
    if (accountBalance !== null && accountBalance < stake) {
      throw new Error(
        `Insufficient balance: ${accountBalance.toFixed(2)} ${tradeCurrency} available.`,
      );
    }
    if (account.normalizedType !== "demo" && account.normalizedType !== "real") {
      throw new Error("Selected Deriv account type could not be verified from its prefix.");
    }
    if (selectedAccountIsDemo !== Boolean(account.is_demo)) {
      console.info("[Accumulator] Account classification corrected", {
        account_id: account.account_id,
        loginid: account.loginid,
        detected_prefix: account.detected_prefix,
        normalizedType: account.normalizedType,
        final_tab_placement: account.final_tab_placement,
        stored_is_demo: account.is_demo,
        normalized_is_demo: selectedAccountIsDemo,
      });
    }
  }

  async function markTradeClosed(nextState: AccumulatorContractState) {
    const currentTradeId = tradeIdRef.current;
    if (!currentTradeId || closedRef.current) return;
    if (nextState.status !== "sold" && nextState.status !== "lost") return;
    closedRef.current = true;
    const profit = Number(nextState.currentProfit ?? 0);
    const { error } = await supabase
      .from("trades")
      .update({
        profit_loss: profit,
        status: profit >= 0 && nextState.status === "sold" ? "won" : "lost",
        closed_at: new Date().toISOString(),
      })
      .eq("id", currentTradeId);
    if (error) console.error("[Accumulator] Could not update closed trade", error);
  }

  async function startAccumulator() {
    if (buyInFlightRef.current || busy || state.status === "active") return;
    buyInFlightRef.current = true;
    setBusy(true);
    setState({ ...EMPTY_ACCUMULATOR_CONTRACT, status: "proposing" });
    closedRef.current = false;
    try {
      validateAccount();
      if (!account || !token) throw new Error("Connect and select your Deriv account first.");
      setAuthenticatedAccount(token, account.account_id, isDemoAccount(account));
      await cleanupSubscription();

      const payload = buildAccumulatorProposalPayload({
        currency: tradeCurrency,
        growthRate,
        market,
        stake,
        takeProfit: takeProfitEnabled ? takeProfit : null,
      });
      const proposalResponse = await requestProposal(payload);
      const proposalId = String(proposalResponse.proposal?.id ?? "");
      const askPrice = Number(proposalResponse.proposal?.ask_price ?? stake);
      setState((current) => ({ ...current, proposalId }));

      const buyResponse = await buyProposal(proposalId, askPrice);
      const contract = buyResponse.buy ?? {};
      const contractId = String(contract.contract_id ?? "");
      console.info("[Accumulator] contract_id", contractId);
      activeAccountIdRef.current = account.account_id;

      const { data: trade, error: tradeInsertError } = await supabase
        .from("trades")
        .insert({
          user_id: user!.id,
          deriv_contract_id: contractId,
          symbol: market,
          trade_type: payload.contract_type,
          stake,
          payout: Number(contract.payout ?? askPrice),
          status: "open",
        })
        .select()
        .single();
      if (tradeInsertError) {
        console.error("[Accumulator] Could not save trade history", tradeInsertError);
        toast.error("Trade placed, but history could not be saved.");
      }
      tradeIdRef.current = trade?.id ?? null;

      setState((current) => ({
        ...current,
        contractId,
        buyPrice: Number(contract.buy_price ?? askPrice),
        currentPayout: Number(contract.payout ?? askPrice),
        currentProfit: 0,
        status: "active",
      }));

      unsubscribeRef.current = await subscribeOpenContract(contractId, (openContract) => {
        setState((current) => {
          const next = normalizeAccumulatorContract(openContract, current);
          console.info("[Accumulator] proposal_open_contract update", {
            contractId: next.contractId,
            currentSpot: next.currentSpot,
            entrySpot: next.entrySpot,
            upperBarrier: next.upperBarrier,
            lowerBarrier: next.lowerBarrier,
            payout: next.currentPayout,
            profit: next.currentProfit,
            sellPrice: next.sellPrice,
            isValidToSell: next.isValidToSell,
            status: next.status,
            barrierSource: next.barrierSource,
          });
          if (next.status === "lost" || next.status === "sold") {
            void cleanupSubscription();
            void markTradeClosed(next);
            if (next.status === "lost") {
              toast.error("Accumulator ended: barrier breached.");
            }
          }
          return next;
        });
      });
      toast.success(`Bought accumulator ${contractId}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Accumulator trade failed.";
      console.error("[Accumulator] Trade failed", error);
      setState((current) => ({ ...current, status: "error", error: message }));
      toast.error(message);
    } finally {
      setBusy(false);
      buyInFlightRef.current = false;
    }
  }

  async function handleSell() {
    if (busy) return;
    if (!state.contractId) {
      toast.error("No active accumulator contract.");
      return;
    }
    if (!state.isValidToSell || state.sellPrice == null) {
      toast.error("No sell price available yet.");
      return;
    }
    setBusy(true);
    try {
      const response = await sellContract(state.contractId, state.sellPrice);
      const sold = response.sell ?? {};
      const profit = Number(sold.profit ?? state.currentProfit ?? 0);
      const next: AccumulatorContractState = {
        ...state,
        currentProfit: profit,
        sellPrice: Number(sold.sold_for ?? sold.sell_price ?? state.sellPrice),
        status: "sold",
        isValidToSell: false,
      };
      setState(next);
      await cleanupSubscription();
      await markTradeClosed(next);
      toast[profit >= 0 ? "success" : "error"](
        `Accumulator sold ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} ${tradeCurrency}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not sell accumulator.";
      setState((current) => ({ ...current, status: "error", error: message }));
      console.error("[Accumulator] Sell failed", error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const canSell = state.status === "active" && state.isValidToSell && state.sellPrice != null;
  const insideRange =
    state.currentSpot != null &&
    state.upperBarrier != null &&
    state.lowerBarrier != null &&
    state.currentSpot < state.upperBarrier &&
    state.currentSpot > state.lowerBarrier;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-3">
        <div className="mb-2 text-center text-sm font-medium text-[#555555]">Market</div>
        <Select value={market} onValueChange={onMarketChange}>
          <SelectTrigger className="h-10 rounded-md border-[#d6d6d6] bg-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SYNTHETIC_MARKETS.map((item) => (
              <SelectItem key={item.symbol} value={item.symbol}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl bg-white p-3">
        <div className="mb-2 flex items-center justify-center gap-1 text-sm text-[#646464]">
          Growth rate <Info className="h-3.5 w-3.5" />
        </div>
        <div className="grid grid-cols-5 gap-2">
          {ACCUMULATOR_GROWTH_RATES.map((rate) => (
            <button
              key={rate}
              onClick={() => setGrowthRate(rate)}
              disabled={state.status === "active"}
              className={cn(
                "rounded-md py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                growthRate === rate
                  ? "bg-[#e5f7f6] text-[#147a78] ring-1 ring-[#4bb4b3]"
                  : "text-[#333333] hover:bg-[#f2f3f4]",
              )}
            >
              {Math.round(rate * 100)}%
            </button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-[#777777]">
          Higher growth tightens barriers and increases risk.
        </p>
      </div>

      <div className="rounded-xl bg-white p-3">
        <div className="text-center text-sm text-[#646464]">Stake</div>
        <div className="mt-2 flex min-w-0 items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => setStake((value) => Math.max(1, +(value - 1).toFixed(2)))}
            disabled={state.status === "active"}
            className="shrink-0 rounded-md bg-[#f2f3f4] p-2 hover:bg-[#e6e9e9] disabled:opacity-60"
            aria-label="Decrease stake"
          >
            <Minus className="h-4 w-4" />
          </button>
          <Input
            type="number"
            min={1}
            step={1}
            value={stake}
            disabled={state.status === "active"}
            onChange={(event) => setStake(Number(event.target.value))}
            className="min-w-0 text-center font-mono text-base"
          />
          <button
            onClick={() => setStake((value) => +(value + 1).toFixed(2))}
            disabled={state.status === "active"}
            className="shrink-0 rounded-md bg-[#f2f3f4] p-2 hover:bg-[#e6e9e9] disabled:opacity-60"
            aria-label="Increase stake"
          >
            <Plus className="h-4 w-4" />
          </button>
          <span className="w-10 shrink-0 truncate text-center text-xs font-medium text-[#646464] sm:w-14">
            {tradeCurrency}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-white p-3">
        <label className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={takeProfitEnabled}
              disabled={state.status === "active"}
              onChange={(event) => setTakeProfitEnabled(event.target.checked)}
              className="size-4 rounded border-[#d6d6d6]"
            />
            Take profit <Info className="h-3.5 w-3.5 text-[#777777]" />
          </span>
        </label>
        {takeProfitEnabled && (
          <Input
            type="number"
            min={0}
            step={1}
            value={takeProfit}
            disabled={state.status === "active"}
            onChange={(event) => setTakeProfit(Number(event.target.value))}
            className="mt-2 text-center font-mono"
            placeholder={`Amount (${tradeCurrency})`}
          />
        )}
      </div>

      <div className="rounded-xl border border-[#d8edf7] bg-[#f7fcff] p-3 text-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs">
          <span className="font-semibold text-[#147a78]">Accumulator status</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-bold uppercase",
              state.status === "active" && "bg-[#e5f7f6] text-[#147a78]",
              state.status === "sold" && "bg-[#edf7ed] text-[#0b8f62]",
              state.status === "lost" && "bg-[#fff1f2] text-[#cc2f39]",
              state.status === "error" && "bg-[#fff1f2] text-[#cc2f39]",
              (state.status === "idle" || state.status === "proposing") &&
                "bg-[#f2f3f4] text-[#646464]",
            )}
          >
            {state.status}
          </span>
        </div>

        <MetricGrid
          currency={tradeCurrency}
          rows={[
            ["Account", accountLoginId || "-"],
            ["Current price", numberLabel(state.currentSpot ?? lastPrice)],
            ["Entry price", numberLabel(state.entrySpot)],
            ["Upper barrier", numberLabel(state.upperBarrier)],
            ["Lower barrier", numberLabel(state.lowerBarrier)],
            ["Buy price", moneyLabel(state.buyPrice, tradeCurrency)],
            ["Live payout", moneyLabel(state.currentPayout, tradeCurrency)],
            ["Profit/Loss", moneyLabel(state.currentProfit, tradeCurrency, true)],
            ["Sell price", moneyLabel(state.sellPrice, tradeCurrency)],
            ["Ticks", state.tickCount != null ? String(state.tickCount) : "-"],
          ]}
        />

        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-md border p-2 text-xs",
            state.barrierBreached
              ? "border-[#ffd1d4] bg-[#fff7f7] text-[#cc2f39]"
              : insideRange
                ? "border-[#cce9e7] bg-white text-[#147a78]"
                : "border-[#eeeeee] bg-white text-[#646464]",
          )}
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {state.barrierBreached
              ? "Barrier breached. The contract is closed."
              : insideRange
                ? `Price is inside the barrier range. Barrier data source: ${state.barrierSource}.`
                : "Barrier range will appear after Deriv returns contract updates."}
          </span>
        </div>

        {state.error && <div className="mt-2 text-xs font-medium text-[#cc2f39]">{state.error}</div>}
      </div>

      <Button
        onClick={() => {
          if (!token) {
            buildOAuthUrl({ returnTo: "/" })
              .then((url) => {
                console.log("Deriv OAuth URL:", url);
                redirectToDerivOAuth(url);
              })
              .catch((error) => {
                const message =
                  error instanceof Error ? error.message : "Could not start Deriv OAuth.";
                console.error("[Deriv OAuth] Accumulator connect failed", error);
                toast.error(message);
              });
            return;
          }
          if (state.status === "active") void handleSell();
          else void startAccumulator();
        }}
        disabled={busy || (state.status === "active" && !canSell)}
        className={cn(
          "h-12 w-full rounded-xl text-base font-semibold text-white",
          state.status === "active" ? "bg-[#ff444f] hover:bg-[#eb3e48]" : "bg-[#4bb4b3] hover:bg-[#399998]",
        )}
      >
        {busy
          ? state.status === "active"
            ? "Selling..."
            : "Buying..."
          : state.status === "active"
            ? canSell
              ? `Sell ${moneyLabel(state.sellPrice, tradeCurrency)}`
              : "Waiting for sell price"
            : token
              ? `Buy accumulator (${selectedAccountIsDemo ? "Demo" : "Live"})`
              : "Sign in & connect Deriv to trade"}
      </Button>
    </div>
  );
}

function MetricGrid({ rows }: { currency: string; rows: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-md bg-white p-2">
          <div className="text-[10px] font-bold uppercase text-[#999999]">{label}</div>
          <div className="mt-0.5 truncate font-mono text-xs font-bold text-[#333333]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function numberLabel(value?: number | null) {
  return value != null && Number.isFinite(value) ? value.toFixed(4) : "-";
}

function moneyLabel(value?: number | null, currency?: string, signed = false) {
  if (value == null || !Number.isFinite(value)) return "-";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}
