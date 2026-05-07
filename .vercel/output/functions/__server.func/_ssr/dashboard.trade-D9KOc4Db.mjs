import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { s as supabase } from "./client-B-NvnhGF.mjs";
import { u as useAuth } from "./use-auth-D880YEmu.mjs";
import { e as SIDES_BY_CATEGORY, T as TRADE_CATEGORIES, s as send, f as subscribeProposal, a as contractTypeFor } from "./createLucideIcon-vFonUMpr.mjs";
import { D as DerivChart } from "./deriv-chart-BzKdFw24.mjs";
import { c as cn, B as Button } from "./button-Cbaj921o.mjs";
import { I as Input } from "./input-DJsVq6jX.mjs";
import { C as ChevronLeft, T as TrendingDown, S as Slider, M as Minus, P as Plus } from "./slider-CjHijQv6.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-CKUaG5Lz.mjs";
import { t as toast } from "./router-C7gTjV3A.mjs";
import { T as TrendingUp } from "./trending-up-3UMWFigR.mjs";
import { C as ChevronRight } from "./chevron-right-BPoPgQJo.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-BVBDj44R.mjs";
import "./Combination-DLUKXKiD.mjs";
import "./index-BYfsBK2p.mjs";
function TradePage() {
  const {
    user
  } = useAuth();
  const [market, setMarket] = reactExports.useState("R_100");
  const [category, setCategory] = reactExports.useState("over_under");
  const [side, setSide] = reactExports.useState("over");
  const [stake, setStake] = reactExports.useState(0.6);
  const [payoutMode, setPayoutMode] = reactExports.useState("stake");
  const [duration, setDuration] = reactExports.useState(1);
  const [durationUnit, setDurationUnit] = reactExports.useState("t");
  const [barrierDigit, setBarrierDigit] = reactExports.useState(8);
  const [barrierOffset, setBarrierOffset] = reactExports.useState("+0.10");
  const [growthRate, setGrowthRate] = reactExports.useState(0.03);
  const [multiplier, setMultiplier] = reactExports.useState(100);
  const [lastPrice, setLastPrice] = reactExports.useState(null);
  const [token, setToken] = reactExports.useState(null);
  const [isDemo, setIsDemo] = reactExports.useState(true);
  const [currency, setCurrency] = reactExports.useState("USD");
  const [busy, setBusy] = reactExports.useState(false);
  const [payouts, setPayouts] = reactExports.useState({});
  const [highBarrier, setHighBarrier] = reactExports.useState(null);
  const [lowBarrier, setLowBarrier] = reactExports.useState(null);
  const [chartHeight, setChartHeight] = reactExports.useState(460);
  const lastPriceRef = reactExports.useRef(null);
  const handlePrice = reactExports.useCallback((p) => {
    setLastPrice(p);
    lastPriceRef.current = p;
  }, []);
  reactExports.useEffect(() => {
    setChartHeight(window.innerWidth < 768 ? 260 : 460);
  }, []);
  reactExports.useEffect(() => {
    setSide(SIDES_BY_CATEGORY[category][0].value);
  }, [category]);
  reactExports.useEffect(() => {
    if (!user) return;
    supabase.from("sessions").select("deriv_token, is_demo, currency").eq("user_id", user.id).eq("is_active", true).gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).order("is_demo", {
      ascending: true
    }).limit(1).maybeSingle().then(({
      data
    }) => {
      if (data) {
        setToken(data.deriv_token);
        setIsDemo(data.is_demo);
        setCurrency(data.currency ?? "USD");
      }
    });
  }, [user]);
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
      await send({
        authorize: token
      });
      const contract_type = contractTypeFor(category, side);
      const proposal = {
        proposal: 1,
        amount: stake,
        basis: "stake",
        contract_type,
        currency,
        symbol: market
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
      const buyResp = await send({
        buy: proposalId,
        price: stake
      });
      const contract = buyResp.buy;
      toast.success(`Bought contract ${contract.contract_id}`);
      const {
        data: trade
      } = await supabase.from("trades").insert({
        user_id: user.id,
        deriv_contract_id: String(contract.contract_id),
        symbol: market,
        trade_type: contract_type,
        stake,
        payout: contract.payout,
        status: "open"
      }).select().single();
      const poll = setInterval(async () => {
        try {
          const res = await send({
            proposal_open_contract: 1,
            contract_id: contract.contract_id
          });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            await supabase.from("trades").update({
              profit_loss: profit,
              status: profit >= 0 ? "won" : "lost",
              closed_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", trade.id);
            toast[profit >= 0 ? "success" : "error"](`${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} ${currency}`);
          }
        } catch {
        }
      }, 1500);
      setTimeout(() => clearInterval(poll), 12e4);
    } catch (e) {
      toast.error(e.message ?? "Trade failed");
    } finally {
      setBusy(false);
    }
  }
  const sides = SIDES_BY_CATEGORY[category];
  const catIdx = TRADE_CATEGORIES.findIndex((c) => c.value === category);
  const cycleCategory = (dir) => {
    const next = (catIdx + dir + TRADE_CATEGORIES.length) % TRADE_CATEGORIES.length;
    setCategory(TRADE_CATEGORIES[next].value);
  };
  const currentCategory = TRADE_CATEGORIES[catIdx];
  reactExports.useEffect(() => {
    if (!token || isAccumulator) return;
    let cancelled = false;
    const run = async () => {
      try {
        await send({
          authorize: token
        });
        const next = {};
        for (const s of sides) {
          const ct = contractTypeFor(category, s.value);
          const proposal = {
            proposal: 1,
            amount: stake,
            basis: payoutMode,
            contract_type: ct,
            currency,
            symbol: market
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
            const pct = stake > 0 ? (p - stake) / stake * 100 : 0;
            next[s.value] = {
              payout: p,
              pct
            };
          } catch {
          }
        }
        if (!cancelled) setPayouts(next);
      } catch {
      }
    };
    const t = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, category, side, stake, duration, durationUnit, barrierDigit, barrierOffset, multiplier, market, payoutMode, currency, isAccumulator]);
  reactExports.useEffect(() => {
    if (!isAccumulator || !token) {
      setHighBarrier(null);
      setLowBarrier(null);
      return;
    }
    let cancelled = false;
    let unsub;
    (async () => {
      try {
        await send({
          authorize: token
        });
        unsub = await subscribeProposal({
          amount: stake,
          basis: "stake",
          contract_type: "ACCU",
          currency,
          symbol: market,
          growth_rate: growthRate
        }, (pr) => {
          if (cancelled) return;
          const high = pr.high_barrier != null ? Number(pr.high_barrier) : null;
          const low = pr.low_barrier != null ? Number(pr.low_barrier) : null;
          const tsb = pr.tick_size_barrier != null ? Number(pr.tick_size_barrier) : null;
          const p = Number(pr.payout ?? 0);
          const pct = stake > 0 ? (p - stake) / stake * 100 : 0;
          setPayouts((prev) => ({
            ...prev,
            buy: {
              payout: p,
              pct
            }
          }));
          if (high != null && low != null) {
            setHighBarrier(high);
            setLowBarrier(low);
          } else if (tsb != null && lastPriceRef.current != null) {
            const px = lastPriceRef.current;
            setHighBarrier(px * (1 + tsb));
            setLowBarrier(px * (1 - tsb));
          }
        });
      } catch {
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
      setHighBarrier(null);
      setLowBarrier(null);
    };
  }, [isAccumulator, token, stake, currency, market, growthRate]);
  const sideAccent = {
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
    buy: "bg-emerald-500"
  };
  const tickMax = isDigit ? 10 : 10;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 lg:grid-cols-[1fr_360px]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glass-card rounded-xl p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsx(DerivChart, { symbol: market, onSymbolChange: setMarket, onPrice: handlePrice, height: chartHeight, highBarrier, lowBarrier, isAccumulator }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] text-muted-foreground underline underline-offset-2", children: "Learn about this trade type" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => cycleCategory(-1), className: "rounded-md p-1 hover:bg-muted/40", "aria-label": "Previous trade type", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 items-center justify-center gap-2 rounded-md bg-muted/40 px-3 py-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingUp, { className: "h-4 w-4 text-rose-400" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(TrendingDown, { className: "h-4 w-4 text-rose-400" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: currentCategory?.label })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => cycleCategory(1), className: "rounded-md p-1 hover:bg-muted/40", "aria-label": "Next trade type", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" }) })
        ] })
      ] }),
      showDuration && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-sm text-muted-foreground", children: durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Slider, { className: "mt-3", min: 1, max: tickMax, step: 1, value: [duration], onValueChange: (v) => setDuration(v[0]) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-center font-semibold", children: [
          duration,
          " ",
          durationUnit === "t" ? `Tick${duration > 1 ? "s" : ""}` : durationUnit
        ] }),
        !isDigit && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 flex justify-center gap-1", children: ["t", "s", "m"].map((u) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setDurationUnit(u), className: cn("rounded px-2 py-0.5 text-[11px]", durationUnit === u ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground"), children: u === "t" ? "ticks" : u === "s" ? "sec" : "min" }, u)) })
      ] }),
      needsDigit && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-sm", children: "Last Digit Prediction" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 grid grid-cols-5 gap-2", children: Array.from({
          length: 10
        }).map((_, d) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setBarrierDigit(d), className: cn("rounded-md border py-2 text-sm font-medium transition", barrierDigit === d ? "border-primary bg-primary/15 text-foreground" : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"), children: d }, d)) })
      ] }),
      needsBarrierOffset && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 text-sm", children: "Barrier (offset from spot)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: barrierOffset, onChange: (e) => setBarrierOffset(e.target.value) })
      ] }),
      isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 text-sm", children: "Growth rate" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-5 gap-2", children: [0.01, 0.02, 0.03, 0.04, 0.05].map((g) => /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: () => setGrowthRate(g), className: cn("rounded-md py-2 text-sm font-medium transition", growthRate === g ? "bg-primary/15 text-primary ring-1 ring-primary" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"), children: [
          Math.round(g * 100),
          "%"
        ] }, g)) })
      ] }),
      isAccumulator && (highBarrier != null || lowBarrier != null) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4 text-sm", children: [
        highBarrier != null && lowBarrier != null && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: "Barriers" }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-xs", children: [
            lowBarrier.toFixed(4),
            " / ",
            highBarrier.toFixed(4)
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Win condition" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Price stays within barriers each tick" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Loss condition" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "Price exits barrier zone" })
        ] })
      ] }),
      isMultiplier && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 text-sm", children: "Multiplier" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: String(multiplier), onValueChange: (v) => setMultiplier(Number(v)), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: [10, 20, 30, 50, 100, 200, 300, 500].map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs(SelectItem, { value: String(m), children: [
            "×",
            m
          ] }, m)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card overflow-hidden rounded-xl p-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 overflow-hidden rounded-lg bg-muted/30 p-1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setPayoutMode("stake"), className: cn("rounded-md py-1.5 text-sm font-medium transition", payoutMode === "stake" ? "bg-background shadow" : "text-muted-foreground"), children: "Stake" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setPayoutMode("payout"), className: cn("rounded-md py-1.5 text-sm font-medium transition", payoutMode === "payout" ? "bg-background shadow" : "text-muted-foreground"), children: "Payout" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-3 flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setStake((s) => Math.max(0.35, +(s - 0.5).toFixed(2))), className: "rounded-md bg-muted/50 p-2 hover:bg-muted", "aria-label": "Decrease stake", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Minus, { className: "h-4 w-4" }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 0.35, step: 0.5, value: stake, onChange: (e) => setStake(Number(e.target.value)), className: "text-right font-mono text-base" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-muted-foreground", children: currency }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setStake((s) => +(s + 0.5).toFixed(2)), className: "rounded-md bg-muted/50 p-2 hover:bg-muted", "aria-label": "Increase stake", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "h-4 w-4" }) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: sides.map((s) => {
        const live = payouts[s.value];
        const isSelected = side === s.value;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: () => setSide(s.value), className: cn("w-full overflow-hidden rounded-xl text-left transition", isSelected ? "ring-2 ring-primary/60" : "opacity-90 hover:opacity-100"), children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-between bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
            "Payout ",
            live ? live.payout.toFixed(2) : "—",
            " ",
            currency
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn("flex items-center justify-between px-4 py-3 text-white", sideAccent[s.value] ?? "bg-muted"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: s.label }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-sm", children: live ? `${live.pct.toFixed(2)}%` : "" })
          ] })
        ] }, s.value);
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: handleBuy, disabled: busy || !token, className: "w-full", children: busy ? "Submitting…" : token ? `Buy ${sides.find((s) => s.value === side)?.label} (${isDemo ? "Demo" : "Live"})` : "Connect Deriv to trade" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-muted-foreground", children: [
        "Last price: ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-foreground", children: lastPrice?.toFixed(4) ?? "—" }),
        ". Trades execute on the Deriv account selected in your dashboard. You can lose money rapidly."
      ] })
    ] })
  ] });
}
export {
  TradePage as component
};
