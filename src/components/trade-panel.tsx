import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccumulatorTradePanel } from "@/components/accumulator-trade-panel";
import {
  DigitSelector,
  ProposalButton,
  ProposalSummary,
  StakePayoutToggle,
  TickDurationSelector,
  TradeTypeCard,
} from "@/components/trade-option-components";
import { useAuth } from "@/hooks/use-auth";
import { useDerivBalanceContext } from "@/context/deriv-balance-context";
import { isDemoAccount } from "@/lib/deriv-account";
import {
  SYNTHETIC_MARKETS,
  buildOAuthUrl,
  getDerivTradingErrorMessage,
  getTradingSocketAccountId,
  prepareDerivTradingSession,
  redirectToDerivOAuth,
  type TradeCategory,
  type TradingAdapter,
} from "@/lib/deriv";
import { normalizeOpenContract, EMPTY_CONTRACT_STATE, type ActiveContractState } from "@/lib/contract-state";
import { buildStandardProposalPayload, type ProposalInput } from "@/lib/trade-proposal-builder";
import { isDigitTrade, tradeTypeConfig, TRADE_TYPE_CONFIGS, type TradeSide } from "@/lib/trade-types";
import { buyProposal, requestProposal, sellContract, subscribeOpenContract } from "@/lib/deriv-trading-service";
import { supabase } from "@/integrations/supabase/client";

type ChartOverlay = {
  entry: number | null;
  high: number | null;
  low: number | null;
  breached?: boolean;
};

type ProposalQuote = {
  askPrice: number | null;
  error: string | null;
  id: string | null;
  payout: number | null;
  pct: number | null;
};

interface TradePanelProps {
  market: string;
  lastPrice?: number | null;
  onAccumulatorBarriers?: (b: ChartOverlay) => void;
  onMarketChange?: (market: string) => void;
  onTradeTypeChange?: (tradeType: TradeCategory) => void;
}

const EMPTY_QUOTE: ProposalQuote = {
  askPrice: null,
  error: null,
  id: null,
  payout: null,
  pct: null,
};

export function TradePanel({
  market,
  lastPrice,
  onAccumulatorBarriers,
  onMarketChange,
  onTradeTypeChange,
}: TradePanelProps) {
  const { user } = useAuth();
  const { account, balance: accountBalance, currency } = useDerivBalanceContext();
  const token = account?.deriv_token ?? null;
  const tradeCurrency = currency || account?.currency || "";
  const accountLoginId = account?.loginid || account?.account_id || "";

  const [selectedTradeType, setSelectedTradeType] = useState<TradeCategory>("accumulator");
  const [selectedSide, setSelectedSide] = useState("buy");
  const [stake, setStake] = useState(10);
  const [payoutMode, setPayoutMode] = useState<"stake" | "payout">("stake");
  const [duration, setDuration] = useState(5);
  const [durationUnit, setDurationUnit] = useState<"t" | "s" | "m">("t");
  const [barrier, setBarrier] = useState("+0.10");
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [multiplier, setMultiplier] = useState(100);
  const [takeProfit, setTakeProfit] = useState<number>(0);
  const [stopLoss, setStopLoss] = useState<number>(0);
  const [quotes, setQuotes] = useState<Record<string, ProposalQuote>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeContract, setActiveContract] = useState<ActiveContractState>(EMPTY_CONTRACT_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const unsubscribeRef = useRef<null | (() => Promise<void>)>(null);
  const buyInFlightRef = useRef(false);
  const tradeIdRef = useRef<string | null>(null);
  const activeAccountIdRef = useRef<string | null>(null);
  const closedRef = useRef(false);

  const config = tradeTypeConfig(selectedTradeType);
  const currentDigit =
    lastPrice != null && Number.isFinite(lastPrice) ? Number(lastPrice.toFixed(2).slice(-1)) : null;

  useEffect(() => {
    setSelectedSide(tradeTypeConfig(selectedTradeType).sides[0]?.value ?? "up");
    setActiveContract(EMPTY_CONTRACT_STATE);
    setErrorMessage(null);
    onTradeTypeChange?.(selectedTradeType);
  }, [onTradeTypeChange, selectedTradeType]);

  useEffect(() => {
    return () => {
      void cleanupSubscription();
    };
  }, []);

  useEffect(() => {
    if (selectedTradeType === "accumulator") return;
    if (activeContract.status === "active") {
      onAccumulatorBarriers?.({
        entry: activeContract.entrySpot,
        high: config.needsBarrier ? barrierLineFromInput(barrier, activeContract.entrySpot ?? lastPrice) : null,
        low: null,
        breached: activeContract.status === "lost",
      });
      return;
    }
    onAccumulatorBarriers?.({
      entry: null,
      high: config.needsBarrier ? barrierLineFromInput(barrier, lastPrice) : null,
      low: null,
      breached: false,
    });
  }, [
    activeContract.entrySpot,
    activeContract.status,
    barrier,
    config.needsBarrier,
    lastPrice,
    onAccumulatorBarriers,
    selectedTradeType,
  ]);

  useEffect(() => {
    if (selectedTradeType === "accumulator") {
      setQuotes({});
      return;
    }
    if (!token || !account || !tradeCurrency) {
      setQuotes({});
      return;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setQuotesLoading(true);
      const next: Record<string, ProposalQuote> = {};
      try {
        const tradingSession = await prepareDerivTradingSession(account, {
          context: "proposal-quotes",
        });
        console.info("[Deriv Trade] Proposal trading session prepared", {
          selectedAccountId: account.account_id,
          selectedLoginId: account.loginid,
          normalizedType: account.normalizedType,
          sessionAccountId: tradingSession.sessionAccountId,
          tokenExists: Boolean(tradingSession.token),
          tokenExpiry: tradingSession.expiresAt,
          tokenSource: tradingSession.tokenSource,
          adapter: tradingSession.adapter,
        });
        await Promise.all(
          config.sides.map(async (side) => {
            try {
              const payload = buildPayload(side.value, payoutMode, tradingSession.adapter);
              const response = await requestProposal(payload, {
                adapter: tradingSession.adapter,
                selectedAccountId: account.account_id,
                selectedAccountType: account.normalizedType,
                contractType: payload.contract_type,
              });
              const proposal = response.proposal ?? {};
              const payout = numberFrom(proposal.payout);
              const askPrice = numberFrom(proposal.ask_price) ?? stake;
              next[side.value] = {
                askPrice,
                error: null,
                id: String(proposal.id ?? ""),
                payout,
                pct: payout != null && askPrice > 0 ? ((payout - askPrice) / askPrice) * 100 : null,
              };
            } catch (error) {
              next[side.value] = {
                ...EMPTY_QUOTE,
                error: getDerivTradingErrorMessage(error) || "Proposal unavailable",
              };
            }
          }),
        );
      } catch (error) {
        const message = getDerivTradingErrorMessage(error);
        for (const side of config.sides) {
          next[side.value] = {
            ...EMPTY_QUOTE,
            error: message || "Proposal unavailable",
          };
        }
      }
      if (!cancelled) {
        setQuotes(next);
        setQuotesLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    account?.account_id,
    barrier,
    config.sides,
    duration,
    durationUnit,
    market,
    multiplier,
    payoutMode,
    selectedDigit,
    selectedTradeType,
    stake,
    stopLoss,
    takeProfit,
    token,
    tradeCurrency,
  ]);

  useEffect(() => {
    const selectedAccountId = account?.account_id ?? null;
    if (
      activeContract.status === "active" &&
      activeAccountIdRef.current &&
      selectedAccountId &&
      activeAccountIdRef.current !== selectedAccountId
    ) {
      setActiveContract((current) => ({
        ...current,
        error: "Selected Deriv account changed. Reconnect before trading again.",
        isValidToSell: false,
        status: "error",
      }));
      void cleanupSubscription();
    }
  }, [account?.account_id, activeContract.status]);

  function buildPayload(
    side: string,
    basis: "stake" | "payout" = "stake",
    adapter: TradingAdapter = "legacyTradingAdapter",
  ) {
    const input: ProposalInput = {
      barrier,
      currency: tradeCurrency,
      duration,
      durationUnit,
      market,
      multiplier,
      payoutMode: basis,
      selectedDigit,
      side,
      stake,
      stopLoss,
      takeProfit,
      tradeType: selectedTradeType,
    };
    return buildStandardProposalPayload(input, adapter);
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
    const selectedAccountIsDemo = isDemoAccount(account);
    if (selectedAccountIsDemo !== Boolean(account.is_demo)) {
      console.info("[Deriv Trade] Account classification corrected", {
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

  async function cleanupSubscription() {
    const unsubscribe = unsubscribeRef.current;
    unsubscribeRef.current = null;
    if (unsubscribe) await unsubscribe();
  }

  async function markTradeClosed(nextState: ActiveContractState) {
    const tradeId = tradeIdRef.current;
    if (!tradeId || closedRef.current) return;
    if (!["sold", "won", "lost"].includes(nextState.status)) return;
    closedRef.current = true;
    const profit = Number(nextState.currentProfit ?? 0);
    const { error } = await supabase
      .from("trades")
      .update({
        profit_loss: profit,
        status: profit >= 0 && nextState.status !== "lost" ? "won" : "lost",
        closed_at: new Date().toISOString(),
      })
      .eq("id", tradeId);
    if (error) console.error("[Deriv Trade] Could not update closed trade", error);
  }

  async function handleBuy(side: TradeSide) {
    if (buyInFlightRef.current || busy) return;
    if (!token) {
      try {
        const url = await buildOAuthUrl({ returnTo: "/" });
        console.log("Deriv OAuth URL:", url);
        redirectToDerivOAuth(url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not start Deriv OAuth.";
        console.error("[Deriv OAuth] Trade connect failed", error);
        setErrorMessage(message);
        toast.error(message);
      }
      return;
    }
    buyInFlightRef.current = true;
    setBusy(true);
    setErrorMessage(null);
    setSelectedSide(side.value);
    setActiveContract({ ...EMPTY_CONTRACT_STATE, status: "buying" });
    closedRef.current = false;
    try {
      validateAccount();
      if (!account || !token || !user) throw new Error("Connect and select your Deriv account first.");
      const tradingSession = await prepareDerivTradingSession(account, {
        context: "standard-buy",
      });
      console.info("[Deriv Trade] Trading session prepared", {
        selectedAccountId: account.account_id,
        selectedLoginId: account.loginid,
        normalizedType: account.normalizedType,
        sessionAccountId: tradingSession.sessionAccountId,
        tokenExists: Boolean(tradingSession.token),
        tokenExpiry: tradingSession.expiresAt,
        tokenSource: tradingSession.tokenSource,
        adapter: tradingSession.adapter,
      });
      await cleanupSubscription();

      const quote = quotes[side.value];
      let proposalId = quote?.id;
      let askPrice = quote?.askPrice ?? stake;
      const fallbackPayload = buildPayload(side.value, "stake", tradingSession.adapter);
      if (!proposalId) {
        const proposalResponse = await requestProposal(fallbackPayload, {
          adapter: tradingSession.adapter,
          selectedAccountId: account.account_id,
          selectedAccountType: account.normalizedType,
          contractType: fallbackPayload.contract_type,
        });
        const proposal = proposalResponse.proposal ?? {};
        proposalId = String(proposal.id ?? "");
        askPrice = numberFrom(proposal.ask_price) ?? stake;
      }
      if (!proposalId) throw new Error("No proposal id available.");

      const buyResponse = await buyProposal(proposalId, askPrice, {
        adapter: tradingSession.adapter,
        selectedAccountId: account.account_id,
        selectedAccountType: account.normalizedType,
        contractType: fallbackPayload.contract_type,
      });
      const buy = buyResponse.buy ?? {};
      const contractId = String(buy.contract_id ?? "");
      const contractType = String(buy.contract_type ?? fallbackPayload.contract_type);
      const { data: trade, error: insertError } = await supabase
        .from("trades")
        .insert({
          user_id: user.id,
          deriv_contract_id: contractId,
          symbol: market,
          trade_type: contractType,
          stake,
          payout: Number(buy.payout ?? quote?.payout ?? 0),
          status: "open",
        })
        .select()
        .single();
      if (insertError) {
        console.error("[Deriv Trade] Could not save trade", insertError);
        toast.error("Trade placed, but history could not be saved.");
      }
      tradeIdRef.current = trade?.id ?? null;
      activeAccountIdRef.current = account.account_id;
      setActiveContract({
        ...EMPTY_CONTRACT_STATE,
        buyPrice: numberFrom(buy.buy_price) ?? askPrice,
        contractId,
        payout: numberFrom(buy.payout) ?? quote?.payout ?? null,
        status: "active",
      });
      unsubscribeRef.current = await subscribeOpenContract(contractId, (openContract) => {
        setActiveContract((current) => {
          const next = normalizeOpenContract(openContract, current);
          console.info("[Deriv Trade] proposal_open_contract update", {
            contractId: next.contractId,
            currentSpot: next.currentSpot,
            entrySpot: next.entrySpot,
            payout: next.payout,
            profit: next.currentProfit,
            sellPrice: next.sellPrice,
            isValidToSell: next.isValidToSell,
            status: next.status,
            websocketAccountId: getTradingSocketAccountId(),
          });
          if (["sold", "won", "lost"].includes(next.status)) {
            void cleanupSubscription();
            void markTradeClosed(next);
          }
          return next;
        });
      });
      toast.success(`Bought ${side.label}`);
    } catch (error) {
      const message = getDerivTradingErrorMessage(error);
      console.error("[Deriv Trade] Buy failed", error);
      setErrorMessage(message);
      setActiveContract((current) => ({ ...current, error: message, status: "error" }));
      toast.error(message);
    } finally {
      buyInFlightRef.current = false;
      setBusy(false);
    }
  }

  async function handleSell() {
    if (!activeContract.contractId || !activeContract.isValidToSell || activeContract.sellPrice == null) {
      toast.error("No sell price available for this contract.");
      return;
    }
    setBusy(true);
    try {
      if (account) {
        await prepareDerivTradingSession(account, { context: "standard-sell" });
      }
      const response = await sellContract(activeContract.contractId, activeContract.sellPrice);
      const sold = response.sell ?? {};
      const profit = numberFrom(sold.profit) ?? activeContract.currentProfit ?? 0;
      const next: ActiveContractState = {
        ...activeContract,
        currentProfit: profit,
        isValidToSell: false,
        sellPrice: numberFrom(sold.sold_for, sold.sell_price) ?? activeContract.sellPrice,
        status: profit >= 0 ? "won" : "lost",
      };
      setActiveContract(next);
      await cleanupSubscription();
      await markTradeClosed(next);
      toast[profit >= 0 ? "success" : "error"](
        `Closed ${profit >= 0 ? "+" : ""}${profit.toFixed(2)} ${tradeCurrency}`,
      );
    } catch (error) {
      const message = getDerivTradingErrorMessage(error);
      setErrorMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const activeQuote = quotes[selectedSide];
  const tradeIndex = TRADE_TYPE_CONFIGS.findIndex((item) => item.category === selectedTradeType);
  const nextTradeType = useCallback(
    (direction: -1 | 1) => {
      const next =
        (tradeIndex + direction + TRADE_TYPE_CONFIGS.length) % TRADE_TYPE_CONFIGS.length;
      setSelectedTradeType(TRADE_TYPE_CONFIGS[next].category);
    },
    [tradeIndex],
  );

  const activeRows = useMemo(
    () => [
      ["Status", activeContract.status],
      ["Contract", activeContract.contractId],
      ["Entry", numberLabel(activeContract.entrySpot)],
      ["Current", numberLabel(activeContract.currentSpot ?? lastPrice)],
      ["Buy price", moneyLabel(activeContract.buyPrice, tradeCurrency)],
      ["Payout", moneyLabel(activeContract.payout, tradeCurrency)],
      ["P/L", moneyLabel(activeContract.currentProfit, tradeCurrency, true)],
      ["Sell price", moneyLabel(activeContract.sellPrice, tradeCurrency)],
    ],
    [activeContract, lastPrice, tradeCurrency],
  );

  if (selectedTradeType === "accumulator") {
    return (
      <div className="min-w-0 space-y-3">
        <TradeTypeCard
          config={config}
          onNext={() => nextTradeType(1)}
          onPrevious={() => nextTradeType(-1)}
        />
        <AccumulatorTradePanel
          lastPrice={lastPrice}
          market={market}
          onBarriers={onAccumulatorBarriers}
          onMarketChange={onMarketChange}
        />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-3">
      <TradeTypeCard
        config={config}
        onNext={() => nextTradeType(1)}
        onPrevious={() => nextTradeType(-1)}
      />

      <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
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

      {config.needsDuration && (
        <TickDurationSelector
          duration={duration}
          durationUnit={durationUnit}
          onDurationChange={setDuration}
          onUnitChange={setDurationUnit}
          showUnits={!isDigitTrade(selectedTradeType)}
        />
      )}

      {config.needsDigit && (
        <DigitSelector
          currentDigit={currentDigit}
          mode={config.digitMode === "prediction" ? "prediction" : "barrier"}
          selectedDigit={selectedDigit}
          onDigitChange={setSelectedDigit}
        />
      )}

      {config.needsBarrier && (
        <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
          <div className="mb-2 text-sm font-bold text-[#333333]">Barrier</div>
          <Input
            value={barrier}
            onChange={(event) => setBarrier(event.target.value)}
            className="h-10 rounded-md border-[#d6d6d6] text-center font-mono"
            placeholder="+0.10"
          />
          <div className="mt-2 text-xs text-[#777777]">
            Distance from barrier: {distanceFromBarrierLabel(lastPrice, barrier)}
          </div>
        </div>
      )}

      {config.supportsMultiplier && (
        <div className="rounded-lg border border-[#e6e6e6] bg-white p-3 shadow-sm">
          <div className="mb-2 text-sm font-bold text-[#333333]">Multiplier</div>
          <Select value={String(multiplier)} onValueChange={(value) => setMultiplier(Number(value))}>
            <SelectTrigger className="h-10 rounded-md border-[#d6d6d6]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 30, 50, 100, 200, 300, 500].map((item) => (
                <SelectItem key={item} value={String(item)}>
                  x{item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Input
              type="number"
              min={0}
              value={takeProfit}
              onChange={(event) => setTakeProfit(Number(event.target.value))}
              className="h-9 text-center font-mono"
              placeholder="Take profit"
            />
            <Input
              type="number"
              min={0}
              value={stopLoss}
              onChange={(event) => setStopLoss(Number(event.target.value))}
              className="h-9 text-center font-mono"
              placeholder="Stop loss"
            />
          </div>
        </div>
      )}

      <StakePayoutToggle
        currency={tradeCurrency}
        mode={payoutMode}
        onModeChange={setPayoutMode}
        onStakeChange={setStake}
        stake={stake}
      />

      <div className="space-y-2">
        {config.sides.map((side) => {
          const quote = quotes[side.value] ?? EMPTY_QUOTE;
          return (
            <ProposalButton
              key={side.value}
              disabled={busy || quotesLoading || Boolean(quote.error)}
              label={side.label}
              loading={quotesLoading}
              onClick={() => void handleBuy(side)}
              payout={moneyLabel(quote.payout, tradeCurrency)}
              pct={quote.pct != null ? `${quote.pct.toFixed(2)}%` : undefined}
              tone={side.tone}
            />
          );
        })}
      </div>

      {(activeContract.contractId || activeContract.status === "error") && (
        <ProposalSummary rows={activeRows} />
      )}

      {activeContract.status === "active" && (
        <Button
          onClick={() => void handleSell()}
          disabled={busy || !activeContract.isValidToSell}
          className="h-11 w-full rounded-lg bg-[#ff444f] text-sm font-bold text-white hover:bg-[#eb3e48]"
        >
          <X className="mr-2 size-4" />
          {activeContract.isValidToSell
            ? `Close ${moneyLabel(activeContract.sellPrice, tradeCurrency)}`
            : "Waiting for sell price"}
        </Button>
      )}

      {(errorMessage || activeContract.error || activeQuote?.error) && (
        <div className="rounded-lg border border-[#ffd1d4] bg-[#fff7f7] p-3 text-xs font-medium text-[#cc2f39]">
          {errorMessage || activeContract.error || activeQuote?.error}
        </div>
      )}

      <p className="text-[11px] text-[#777777]">
        Last price: <span className="font-mono">{lastPrice?.toFixed(4) ?? "-"}</span>. You can lose
        money rapidly.
      </p>
    </div>
  );
}

function numberFrom(...values: unknown[]) {
  for (const value of values) {
    if (value == null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function numberLabel(value?: number | null) {
  return value != null && Number.isFinite(value) ? value.toFixed(4) : "-";
}

function moneyLabel(value?: number | null, currency?: string, signed = false) {
  if (value == null || !Number.isFinite(value)) return "-";
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}${currency ? ` ${currency}` : ""}`;
}

function barrierLineFromInput(barrier: string, spot?: number | null) {
  const value = Number(barrier);
  if (!Number.isFinite(value)) return null;
  if ((barrier.startsWith("+") || barrier.startsWith("-")) && spot != null) {
    return spot + value;
  }
  return value;
}

function distanceFromBarrierLabel(spot: number | null | undefined, barrier: string) {
  const line = barrierLineFromInput(barrier, spot);
  if (spot == null || line == null) return "-";
  return Math.abs(spot - line).toFixed(4);
}
