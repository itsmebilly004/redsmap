import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { T as TopShell } from "./top-shell-DmjSNnOs.mjs";
import { D as DerivChart } from "./deriv-chart-BFZwtYsG.mjs";
import { u as useAuth, b as useDerivBalance, h as SIDES_BY_CATEGORY, T as TRADE_CATEGORIES, s as send, i as subscribeProposal, c as buildOAuthUrl, d as contractTypeFor, a as supabase } from "./router-C5J15k2c.mjs";
import { c as cn, B as Button } from "./button-Cz8PAkJh.mjs";
import { I as Input } from "./input-DVeAuAgX.mjs";
import { S as Slider } from "./slider-yup_WoLs.mjs";
import { t as toast } from "../_libs/sonner.mjs";
import "../_libs/lightweight-charts.mjs";
import { t as Shield, B as Bot, E as Crosshair, u as Sun, v as CircleQuestionMark, e as Settings, G as Globe, w as Maximize2, J as ChevronLeft, K as ChevronRight, I as Info, N as Minus, O as Plus } from "../_libs/lucide-react.mjs";
import "../_libs/tanstack__react-router.mjs";
import "../_libs/tanstack__router-core.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "node:stream";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "../_libs/isbot.mjs";
import "./dropdown-menu-C9_FfC1I.mjs";
import "../_libs/radix-ui__react-dropdown-menu.mjs";
import "../_libs/radix-ui__primitive.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/radix-ui__react-context.mjs";
import "../_libs/@radix-ui/react-use-controllable-state+[...].mjs";
import "../_libs/@radix-ui/react-use-layout-effect+[...].mjs";
import "../_libs/radix-ui__react-primitive.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-menu.mjs";
import "../_libs/radix-ui__react-collection.mjs";
import "../_libs/radix-ui__react-direction.mjs";
import "../_libs/@radix-ui/react-dismissable-layer+[...].mjs";
import "../_libs/@radix-ui/react-use-callback-ref+[...].mjs";
import "../_libs/@radix-ui/react-use-escape-keydown+[...].mjs";
import "../_libs/radix-ui__react-focus-guards.mjs";
import "../_libs/radix-ui__react-focus-scope.mjs";
import "../_libs/radix-ui__react-popper.mjs";
import "../_libs/floating-ui__react-dom.mjs";
import "../_libs/floating-ui__dom.mjs";
import "../_libs/floating-ui__core.mjs";
import "../_libs/floating-ui__utils.mjs";
import "../_libs/radix-ui__react-arrow.mjs";
import "../_libs/radix-ui__react-use-size.mjs";
import "../_libs/radix-ui__react-portal.mjs";
import "../_libs/radix-ui__react-presence.mjs";
import "../_libs/radix-ui__react-roving-focus.mjs";
import "../_libs/radix-ui__react-id.mjs";
import "../_libs/aria-hidden.mjs";
import "../_libs/react-remove-scroll.mjs";
import "tslib";
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
import "./select-BhjPe795.mjs";
import "../_libs/radix-ui__react-select.mjs";
import "../_libs/radix-ui__number.mjs";
import "../_libs/radix-ui__react-use-previous.mjs";
import "../_libs/@radix-ui/react-visually-hidden+[...].mjs";
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "../_libs/radix-ui__react-slider.mjs";
import "../_libs/fancy-canvas.mjs";
function TradePanel({ market, lastPrice, onAccumulatorBarriers, onCategoryChange }) {
  const { user } = useAuth();
  const { account, balance, currency: accountCurrency } = useDerivBalance();
  const token = account?.deriv_token ?? null;
  const isDemo = account?.is_demo ?? true;
  const currency = accountCurrency;
  const [category, setCategory] = reactExports.useState("accumulator");
  const [side, setSide] = reactExports.useState("buy");
  const [stake, setStake] = reactExports.useState(10);
  const [payoutMode, setPayoutMode] = reactExports.useState("stake");
  const [duration, setDuration] = reactExports.useState(1);
  const [durationUnit, setDurationUnit] = reactExports.useState("t");
  const [barrierDigit, setBarrierDigit] = reactExports.useState(8);
  const [barrierOffset, setBarrierOffset] = reactExports.useState("+0.10");
  const [growthRate, setGrowthRate] = reactExports.useState(0.03);
  const [multiplier, setMultiplier] = reactExports.useState(100);
  const [takeProfitEnabled, setTakeProfitEnabled] = reactExports.useState(false);
  const [takeProfit, setTakeProfit] = reactExports.useState(0);
  const [busy, setBusy] = reactExports.useState(false);
  const [payouts, setPayouts] = reactExports.useState({});
  const [accuMeta, setAccuMeta] = reactExports.useState({ maxPayout: null, maxTicks: null, high: null, low: null, tickSize: null, minStake: null, maxStake: null });
  reactExports.useEffect(() => {
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
  const cycleCategory = reactExports.useCallback(
    (dir) => {
      const next = (catIdx + dir + TRADE_CATEGORIES.length) % TRADE_CATEGORIES.length;
      setCategory(TRADE_CATEGORIES[next].value);
    },
    [catIdx]
  );
  const currentCategory = TRADE_CATEGORIES[catIdx];
  reactExports.useEffect(() => {
    if (isAccumulator || !token) return;
    let cancelled = false;
    const run = async () => {
      try {
        await send({ authorize: token });
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
            next[s.value] = { payout: p, pct };
          } catch {
          }
        }
        if (!cancelled) {
          setPayouts(next);
          setAccuMeta((m) => ({ ...m, high: null, low: null, tickSize: null }));
          onAccumulatorBarriers?.({ high: null, low: null });
        }
      } catch {
      }
    };
    const t = setTimeout(run, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [token, category, side, stake, duration, durationUnit, barrierDigit, barrierOffset, growthRate, multiplier, market, payoutMode, currency, isAccumulator]);
  reactExports.useEffect(() => {
    if (!isAccumulator) {
      onAccumulatorBarriers?.({ high: null, low: null });
      return;
    }
    let cancelled = false;
    let unsub;
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
            ...takeProfitEnabled && takeProfit > 0 ? { limit_order: { take_profit: takeProfit } } : {}
          },
          (pr) => {
            if (cancelled) return;
            const high = pr.high_barrier != null ? Number(pr.high_barrier) : null;
            const low = pr.low_barrier != null ? Number(pr.low_barrier) : null;
            const tsb = pr.tick_size_barrier != null ? Number(pr.tick_size_barrier) : null;
            const p = Number(pr.payout ?? 0);
            const pct = stake > 0 ? (p - stake) / stake * 100 : 0;
            setPayouts((prev) => ({ ...prev, buy: { payout: p, pct } }));
            setAccuMeta({
              maxPayout: Number(pr.maximum_payout ?? 0) || null,
              maxTicks: Number(pr.maximum_ticks ?? 0) || null,
              high,
              low,
              tickSize: tsb,
              minStake: pr.min_stake != null ? Number(pr.min_stake) : null,
              maxStake: pr.max_stake != null ? Number(pr.max_stake) : null
            });
            if (high != null && low != null) {
              onAccumulatorBarriers?.({ high, low });
            } else if (tsb != null && lastPriceRef.current != null) {
              const px = lastPriceRef.current;
              onAccumulatorBarriers?.({ high: px * (1 + tsb), low: px * (1 - tsb) });
            }
          }
        );
      } catch {
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isAccumulator, token, stake, currency, market, growthRate, payoutMode, takeProfitEnabled, takeProfit]);
  const lastPriceRef = reactExports.useRef(null);
  reactExports.useEffect(() => {
    lastPriceRef.current = lastPrice ?? null;
  }, [lastPrice]);
  async function handleBuy(sideOverride) {
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
    if (balance !== null && balance < stake) {
      toast.error(
        `Insufficient balance: ${balance.toFixed(2)} ${currency}. Your stake is ${stake.toFixed(2)} ${currency}.`
      );
      return;
    }
    setBusy(true);
    try {
      await send({ authorize: token });
      const contract_type = contractTypeFor(category, activeSide);
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
      const { data: trade } = await supabase.from("trades").insert({
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
          const res = await send({ proposal_open_contract: 1, contract_id: contract.contract_id });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            clearInterval(poll);
            const profit = Number(c.profit ?? 0);
            if (trade?.id) {
              await supabase.from("trades").update({
                profit_loss: profit,
                status: profit >= 0 ? "won" : "lost",
                closed_at: (/* @__PURE__ */ new Date()).toISOString()
              }).eq("id", trade.id);
            }
            toast[profit >= 0 ? "success" : "error"](
              `${profit >= 0 ? "Won" : "Lost"} ${Math.abs(profit).toFixed(2)} ${currency}`
            );
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
  const accentBuy = "bg-[oklch(0.7_0.17_150)] hover:bg-[oklch(0.65_0.17_150)]";
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-3", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border-2 border-[oklch(0.7_0.17_150)] bg-white p-3 shadow-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[11px] text-[oklch(0.45_0.02_260)] underline underline-offset-2 cursor-pointer", children: "Learn about this trade type" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => cycleCategory(-1), className: "rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]", "aria-label": "Previous trade type", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronLeft, { className: "h-4 w-4" }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-1 items-center justify-center gap-2 px-3 py-1", children: [
          isAccumulator ? /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.7_0.17_150)] text-lg", children: "📈" }) : /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg", children: "📊" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: currentCategory?.label })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => cycleCategory(1), className: "rounded-md p-1 hover:bg-[oklch(0.96_0.005_240)]", "aria-label": "Next trade type", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "h-4 w-4" }) })
      ] })
    ] }),
    showDuration && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-sm text-[oklch(0.45_0.02_260)]", children: durationUnit === "t" ? "Ticks" : durationUnit === "s" ? "Seconds" : "Minutes" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Slider, { className: "mt-3", min: 1, max: 10, step: 1, value: [duration], onValueChange: (v) => setDuration(v[0]) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-center font-semibold", children: [
        duration,
        " ",
        durationUnit === "t" ? `Tick${duration > 1 ? "s" : ""}` : durationUnit
      ] }),
      !isDigit && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2 flex justify-center gap-1", children: ["t", "s", "m"].map((u) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => setDurationUnit(u),
          className: cn(
            "rounded px-2 py-0.5 text-[11px]",
            durationUnit === u ? "bg-[oklch(0.7_0.17_150)] text-white" : "bg-[oklch(0.96_0.005_240)] text-[oklch(0.45_0.02_260)]"
          ),
          children: u === "t" ? "ticks" : u === "s" ? "sec" : "min"
        },
        u
      )) })
    ] }),
    needsDigit && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-sm", children: "Last Digit Prediction" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 grid grid-cols-5 gap-2", children: Array.from({ length: 10 }).map((_, d) => /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => setBarrierDigit(d),
          className: cn(
            "rounded-md border py-2 text-sm font-medium transition",
            barrierDigit === d ? "border-[oklch(0.7_0.17_150)] bg-[oklch(0.7_0.17_150)]/10" : "border-[oklch(0.92_0.005_240)] bg-white text-[oklch(0.45_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]"
          ),
          children: d
        },
        d
      )) })
    ] }),
    needsBarrierOffset && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 text-sm", children: "Barrier (offset from spot)" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: barrierOffset, onChange: (e) => setBarrierOffset(e.target.value) })
    ] }),
    isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-white p-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 flex items-center justify-center gap-1 text-sm text-[oklch(0.45_0.02_260)]", children: [
        "Growth rate ",
        /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-3.5 w-3.5" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-5 gap-2", children: [0.01, 0.02, 0.03, 0.04, 0.05].map((g) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => setGrowthRate(g),
          className: cn(
            "rounded-md py-2 text-sm font-medium transition",
            growthRate === g ? "bg-[oklch(0.7_0.17_150)]/15 text-[oklch(0.4_0.15_150)] ring-1 ring-[oklch(0.7_0.17_150)]" : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]"
          ),
          children: [
            Math.round(g * 100),
            "%"
          ]
        },
        g
      )) })
    ] }),
    isMultiplier && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl border border-[oklch(0.92_0.005_240)] bg-white p-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 text-sm", children: "Multiplier" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid grid-cols-4 gap-2", children: [10, 20, 30, 50, 100, 200, 300, 500].map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => setMultiplier(m),
          className: cn(
            "rounded-md border py-1.5 text-sm font-medium transition",
            multiplier === m ? "border-[oklch(0.7_0.17_150)] bg-[oklch(0.7_0.17_150)]/10" : "border-[oklch(0.92_0.005_240)] bg-white hover:bg-[oklch(0.96_0.005_240)]"
          ),
          children: [
            "×",
            m
          ]
        },
        m
      )) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-white p-3", children: [
      !isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-3 grid grid-cols-2 overflow-hidden rounded-lg bg-[oklch(0.96_0.005_240)] p-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setPayoutMode("stake"),
            className: cn(
              "rounded-md py-1.5 text-sm font-medium transition",
              payoutMode === "stake" ? "bg-white shadow" : "text-[oklch(0.45_0.02_260)]"
            ),
            children: "Stake"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setPayoutMode("payout"),
            className: cn(
              "rounded-md py-1.5 text-sm font-medium transition",
              payoutMode === "payout" ? "bg-white shadow" : "text-[oklch(0.45_0.02_260)]"
            ),
            children: "Payout"
          }
        )
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-center text-sm text-[oklch(0.45_0.02_260)]", children: "Stake" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setStake((s) => Math.max(isAccumulator ? 1 : 0.35, +(s - 1).toFixed(2))),
            className: "rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]",
            "aria-label": "Decrease stake",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Minus, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Input,
          {
            type: "number",
            min: isAccumulator ? 1 : 0.35,
            step: 1,
            value: stake,
            onChange: (e) => setStake(Number(e.target.value)),
            className: "text-center font-mono text-base"
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setStake((s) => +(s + 1).toFixed(2)),
            className: "rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]",
            "aria-label": "Increase stake",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "min-w-[3rem] rounded-md border border-[oklch(0.92_0.005_240)] bg-[oklch(0.97_0.003_240)] px-2 py-2 text-center text-xs font-semibold text-[oklch(0.4_0.02_260)]", children: currency })
      ] }),
      balance !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-1.5 text-center text-[10px] text-[oklch(0.55_0.02_260)]", children: [
        "Balance: ",
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono font-medium", children: [
          balance.toFixed(2),
          " ",
          currency
        ] }),
        account && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-1 rounded bg-[oklch(0.93_0.005_240)] px-1 py-0.5 text-[9px] uppercase tracking-wider", children: account.is_demo ? "Demo" : "Real" })
      ] })
    ] }),
    isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-white p-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "flex items-center justify-between text-sm", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "input",
          {
            type: "checkbox",
            checked: takeProfitEnabled,
            onChange: (e) => setTakeProfitEnabled(e.target.checked),
            className: "size-4 rounded border-[oklch(0.85_0.01_240)]"
          }
        ),
        "Take profit ",
        /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-3.5 w-3.5 text-[oklch(0.6_0.02_260)]" })
      ] }) }),
      takeProfitEnabled && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 flex items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setTakeProfit((v) => Math.max(0, +(v - 1).toFixed(2))),
            className: "rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]",
            "aria-label": "Decrease take profit",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Minus, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          Input,
          {
            type: "number",
            min: 0,
            step: 1,
            value: takeProfit,
            onChange: (e) => setTakeProfit(Number(e.target.value)),
            className: "text-center font-mono",
            placeholder: `Amount (${currency})`
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            onClick: () => setTakeProfit((v) => +(v + 1).toFixed(2)),
            className: "rounded-md bg-[oklch(0.96_0.005_240)] p-2 hover:bg-[oklch(0.92_0.005_240)]",
            "aria-label": "Increase take profit",
            children: /* @__PURE__ */ jsxRuntimeExports.jsx(Plus, { className: "h-4 w-4" })
          }
        ),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "w-12 text-center text-xs text-[oklch(0.45_0.02_260)]", children: currency })
      ] })
    ] }),
    isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-xl bg-white p-3 text-sm", children: [
      accuMeta.high != null && accuMeta.low != null ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-2 rounded-lg border border-[oklch(0.7_0.17_150)]/30 bg-[oklch(0.97_0.01_150)] p-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-1 text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.5_0.15_150)]", children: "Barriers (current tick)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1 text-emerald-700", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block h-0.5 w-3 rounded bg-emerald-500" }),
            "High"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-sm font-semibold text-emerald-700", children: accuMeta.high.toFixed(4) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "flex items-center gap-1 text-red-600", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "inline-block h-0.5 w-3 rounded bg-red-500" }),
            "Low"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-sm font-semibold text-red-600", children: accuMeta.low.toFixed(4) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px] text-[oklch(0.5_0.02_260)]", children: "Price must stay within these levels each tick" })
      ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-2 rounded-lg border border-[oklch(0.92_0.005_240)] bg-[oklch(0.97_0.003_240)] p-2 text-[11px] text-[oklch(0.55_0.02_260)]", children: "Barriers will appear once connected to Deriv" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.4_0.02_260)]", children: "Max. payout" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium underline decoration-dotted", children: accuMeta.maxPayout != null ? `${accuMeta.maxPayout.toFixed(2)} ${currency}` : `6,000.00 ${currency}` })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.4_0.02_260)]", children: "Max. ticks" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium underline decoration-dotted", children: [
          accuMeta.maxTicks ?? 85,
          " ticks"
        ] })
      ] }),
      accuMeta.tickSize != null && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.4_0.02_260)]", children: "Tick size barrier" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium", children: [
          "±",
          accuMeta.tickSize.toFixed(5)
        ] })
      ] }),
      (accuMeta.minStake != null || accuMeta.maxStake != null) && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between py-1", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[oklch(0.4_0.02_260)]", children: "Stake range" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium", children: [
          (accuMeta.minStake ?? 1).toFixed(2),
          " – ",
          (accuMeta.maxStake ?? 2e3).toFixed(2),
          " ",
          currency
        ] })
      ] })
    ] }),
    !isAccumulator && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-2", children: sides.map((s) => {
      const live = payouts[s.value];
      const isSelected = side === s.value;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        "button",
        {
          onClick: () => {
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
          },
          disabled: busy,
          className: cn(
            "w-full overflow-hidden rounded-xl text-left transition disabled:opacity-60",
            isSelected ? "ring-2 ring-[oklch(0.55_0.22_265)]/60" : "opacity-90 hover:opacity-100"
          ),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center justify-between bg-[oklch(0.96_0.005_240)] px-3 py-1.5 text-xs text-[oklch(0.45_0.02_260)]", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { children: [
              "Payout ",
              live ? live.payout.toFixed(2) : "—",
              " ",
              currency
            ] }) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: cn("flex items-center justify-between px-4 py-3 text-white", sideAccent[s.value] ?? "bg-muted"), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: busy && side === s.value ? "Submitting…" : s.label }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-sm", children: live ? `${live.pct.toFixed(2)}%` : "" })
            ] })
          ]
        },
        s.value
      );
    }) }),
    (isAccumulator || isMultiplier) && /* @__PURE__ */ jsxRuntimeExports.jsx(
      Button,
      {
        onClick: () => {
          if (!user) {
            toast.error("Sign in to place trades.");
            return;
          }
          if (!token) {
            window.location.href = buildOAuthUrl();
            return;
          }
          void handleBuy();
        },
        disabled: busy,
        className: cn(
          "h-12 w-full rounded-xl text-base font-semibold text-white",
          isAccumulator ? accentBuy : ""
        ),
        children: busy ? "Submitting…" : token ? `Buy ${sides.find((s) => s.value === side)?.label ?? ""} (${isDemo ? "Demo" : "Live"})` : "Sign in & connect Deriv to trade"
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-[11px] text-[oklch(0.5_0.02_260)]", children: [
      "Last price: ",
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono", children: lastPrice?.toFixed(4) ?? "—" }),
      ". You can lose money rapidly."
    ] })
  ] });
}
function Index() {
  const [symbol, setSymbol] = reactExports.useState("1HZ100V");
  const [price, setPrice] = reactExports.useState(null);
  const [barriers, setBarriers] = reactExports.useState({
    high: null,
    low: null
  });
  const [tradeCategory, setTradeCategory] = reactExports.useState("accumulator");
  const [chartHeight, setChartHeight] = reactExports.useState(460);
  reactExports.useEffect(() => {
    setChartHeight(window.innerWidth < 1024 ? 280 : 460);
  }, []);
  const isAccumulator = tradeCategory === "accumulator";
  return /* @__PURE__ */ jsxRuntimeExports.jsxs(TopShell, { children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-[1fr_360px]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "relative border-b border-[oklch(0.92_0.005_240)] bg-white p-3 lg:border-b-0 lg:border-r lg:p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mb-3 flex items-center justify-between", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-sm font-semibold", children: "Manual Trader" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-[11px] text-[oklch(0.55_0.02_260)]", children: price !== null ? price.toFixed(4) : "—" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(DerivChart, { symbol, onSymbolChange: setSymbol, onPrice: setPrice, height: chartHeight, highBarrier: barriers.high, lowBarrier: barriers.low, isAccumulator }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-xs text-[oklch(0.5_0.02_260)]", children: "Live data streamed from the Deriv WebSocket API. Sign in to place real trades." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("aside", { className: "flex flex-col bg-[oklch(0.97_0.003_240)] p-3 lg:overflow-y-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsx(TradePanel, { market: symbol, lastPrice: price, onAccumulatorBarriers: setBarriers, onCategoryChange: setTradeCategory }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 border-t border-[oklch(0.92_0.005_240)] bg-white px-3 py-2 md:px-4 md:py-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded-md bg-[oklch(0.92_0.13_95)] px-3 py-1 text-xs font-semibold text-[oklch(0.3_0.1_80)] md:px-4 md:py-1.5 md:text-sm", children: "Risk Disclaimer — Trading involves significant risk of loss." }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2 font-mono text-xs text-[oklch(0.45_0.02_260)] md:gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Shield, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Bot, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Crosshair, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Sun, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CircleQuestionMark, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Settings, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Globe, { className: "size-4" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-sans font-medium", children: "EN" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Maximize2, { className: "size-4" })
      ] })
    ] })
  ] });
}
export {
  Index as component
};
