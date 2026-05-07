import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { u as useAuth, b as useDerivBalance, k as getActiveSymbols, g as SYNTHETIC_MARKETS, a as supabase, s as send, d as contractTypeFor } from "./router-C5J15k2c.mjs";
import { B as Button } from "./button-Cz8PAkJh.mjs";
import { I as Input } from "./input-DVeAuAgX.mjs";
import { L as Label, S as Switch } from "./switch-CLSBWA_a.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BhjPe795.mjs";
import { t as toast } from "../_libs/sonner.mjs";
import { a6 as RefreshCw, Y as TriangleAlert, B as Bot, q as Square, r as Play, a5 as Trash2 } from "../_libs/lucide-react.mjs";
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
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "tslib";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "../_libs/radix-ui__react-label.mjs";
import "../_libs/radix-ui__react-primitive.mjs";
import "../_libs/radix-ui__react-switch.mjs";
import "../_libs/radix-ui__primitive.mjs";
import "../_libs/radix-ui__react-context.mjs";
import "../_libs/@radix-ui/react-use-controllable-state+[...].mjs";
import "../_libs/@radix-ui/react-use-layout-effect+[...].mjs";
import "../_libs/radix-ui__react-use-previous.mjs";
import "../_libs/radix-ui__react-use-size.mjs";
import "../_libs/radix-ui__react-select.mjs";
import "../_libs/radix-ui__number.mjs";
import "../_libs/radix-ui__react-collection.mjs";
import "../_libs/radix-ui__react-direction.mjs";
import "../_libs/@radix-ui/react-dismissable-layer+[...].mjs";
import "../_libs/@radix-ui/react-use-callback-ref+[...].mjs";
import "../_libs/@radix-ui/react-use-escape-keydown+[...].mjs";
import "../_libs/radix-ui__react-focus-guards.mjs";
import "../_libs/radix-ui__react-focus-scope.mjs";
import "../_libs/radix-ui__react-id.mjs";
import "../_libs/radix-ui__react-popper.mjs";
import "../_libs/floating-ui__react-dom.mjs";
import "../_libs/floating-ui__dom.mjs";
import "../_libs/floating-ui__core.mjs";
import "../_libs/floating-ui__utils.mjs";
import "../_libs/radix-ui__react-arrow.mjs";
import "../_libs/radix-ui__react-portal.mjs";
import "../_libs/@radix-ui/react-visually-hidden+[...].mjs";
import "../_libs/aria-hidden.mjs";
import "../_libs/react-remove-scroll.mjs";
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
const STRATEGIES = [{
  value: "rise_fall",
  label: "Rise / Fall (trend)"
}, {
  value: "higher_lower",
  label: "Higher / Lower"
}, {
  value: "touch_no_touch",
  label: "Touch / No Touch"
}, {
  value: "even_odd",
  label: "Even / Odd"
}, {
  value: "over_under",
  label: "Over / Under"
}, {
  value: "matches_differs",
  label: "Matches / Differs"
}, {
  value: "accumulator",
  label: "Accumulators"
}, {
  value: "multiplier",
  label: "Multipliers"
}];
function defaultSide(strategy) {
  const map = {
    rise_fall: "up",
    higher_lower: "higher",
    touch_no_touch: "touch",
    even_odd: "even",
    over_under: "over",
    matches_differs: "matches",
    accumulator: "buy",
    multiplier: "up"
  };
  return map[strategy] ?? "up";
}
function BotPage() {
  const {
    user
  } = useAuth();
  const {
    account,
    currency
  } = useDerivBalance();
  const token = account?.deriv_token ?? null;
  const isDemo = account?.is_demo ?? true;
  const [bots, setBots] = reactExports.useState([]);
  const [form, setForm] = reactExports.useState({
    name: "My Bot",
    strategy: "even_odd",
    market: "R_100",
    stake: 1,
    martingale: false,
    martingale_factor: 2,
    take_profit: 10,
    stop_loss: 10,
    max_trades: 20
  });
  const [confirmed, setConfirmed] = reactExports.useState(false);
  const [allSymbols, setAllSymbols] = reactExports.useState([]);
  const runningBots = reactExports.useRef(/* @__PURE__ */ new Map());
  reactExports.useEffect(() => {
    getActiveSymbols().then((list) => {
      if (list?.length) setAllSymbols(list);
    }).catch(() => {
    });
  }, []);
  async function loadBots() {
    if (!user) return;
    const {
      data
    } = await supabase.from("bots").select("*").eq("user_id", user.id).order("created_at", {
      ascending: false
    });
    setBots(data ?? []);
  }
  reactExports.useEffect(() => {
    loadBots();
  }, [user]);
  async function createBot() {
    if (!user) return;
    if (!confirmed) {
      toast.error("Please confirm you understand the risks before creating a bot.");
      return;
    }
    const {
      name,
      ...strategy
    } = form;
    const {
      error
    } = await supabase.from("bots").insert({
      name,
      strategy: {
        ...strategy,
        currency
      },
      user_id: user.id,
      status: "idle"
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bot created");
      loadBots();
    }
  }
  async function startBot(bot) {
    if (!token) {
      toast.error("Connect your Deriv account before running a bot.");
      return;
    }
    await supabase.from("bots").update({
      status: "running"
    }).eq("id", bot.id);
    toast.success(`Bot "${bot.name}" started`);
    loadBots();
    const s = bot.strategy ?? {};
    const strategy = s.strategy ?? "even_odd";
    const market = s.market ?? "R_100";
    let currentStake = Number(s.stake ?? 1);
    const maxTrades = Number(s.max_trades ?? 20);
    const takeProfit = Number(s.take_profit ?? 10);
    const stopLoss = Number(s.stop_loss ?? 10);
    const martingale = Boolean(s.martingale);
    const martingaleFactor = Number(s.martingale_factor ?? 2);
    const side = defaultSide(strategy);
    const tradeCurrency = s.currency ?? currency;
    let totalPL = 0;
    let tradeCount = 0;
    let running = true;
    const cleanup = () => {
      running = false;
    };
    runningBots.current.set(bot.id, cleanup);
    while (running && tradeCount < maxTrades) {
      if (totalPL >= takeProfit) {
        toast.success(`Bot "${bot.name}" hit take-profit (${totalPL.toFixed(2)} ${tradeCurrency})`);
        break;
      }
      if (totalPL <= -stopLoss) {
        toast.error(`Bot "${bot.name}" hit stop-loss (${totalPL.toFixed(2)} ${tradeCurrency})`);
        break;
      }
      try {
        await send({
          authorize: token
        });
        const contractType = contractTypeFor(strategy, side);
        const proposal = {
          proposal: 1,
          amount: currentStake,
          basis: "stake",
          contract_type: contractType,
          currency: tradeCurrency,
          symbol: market
        };
        const isDigit = ["even_odd", "over_under", "matches_differs"].includes(strategy);
        if (isDigit) {
          proposal.duration = 1;
          proposal.duration_unit = "t";
        } else if (!["accumulator", "multiplier"].includes(strategy)) {
          proposal.duration = 5;
          proposal.duration_unit = "t";
        }
        if (strategy === "over_under") proposal.barrier = "5";
        if (strategy === "matches_differs") proposal.barrier = "5";
        if (strategy === "accumulator") proposal.growth_rate = 0.03;
        if (strategy === "multiplier") proposal.multiplier = 100;
        const propResp = await send(proposal);
        const proposalId = propResp.proposal?.id;
        if (!proposalId) throw new Error("No proposal returned");
        const buyResp = await send({
          buy: proposalId,
          price: currentStake
        });
        const contract = buyResp.buy;
        tradeCount++;
        await supabase.from("trades").insert({
          user_id: user.id,
          deriv_contract_id: String(contract.contract_id),
          symbol: market,
          trade_type: contractType,
          stake: currentStake,
          payout: contract.payout,
          status: "open"
        });
        let settled = false;
        let profit = 0;
        for (let tries = 0; tries < 40 && !settled; tries++) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!running) break;
          const res = await send({
            proposal_open_contract: 1,
            contract_id: contract.contract_id
          });
          const c = res.proposal_open_contract;
          if (c?.is_sold) {
            settled = true;
            profit = Number(c.profit ?? 0);
            totalPL += profit;
            await supabase.from("trades").update({
              profit_loss: profit,
              status: profit >= 0 ? "won" : "lost",
              closed_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("deriv_contract_id", String(contract.contract_id)).eq("user_id", user.id);
            if (martingale && profit < 0) {
              currentStake = +(currentStake * martingaleFactor).toFixed(2);
            } else {
              currentStake = Number(s.stake ?? 1);
            }
          }
        }
        if (!settled || !running) break;
      } catch (e) {
        toast.error(`Bot error: ${e.message}`);
        break;
      }
    }
    runningBots.current.delete(bot.id);
    await supabase.from("bots").update({
      status: "stopped"
    }).eq("id", bot.id);
    toast.success(`Bot "${bot.name}" finished (${tradeCount} trades, P&L: ${totalPL.toFixed(2)} ${tradeCurrency})`);
    loadBots();
  }
  async function stopBot(id) {
    const cleanup = runningBots.current.get(id);
    if (cleanup) cleanup();
    runningBots.current.delete(id);
    await supabase.from("bots").update({
      status: "stopped"
    }).eq("id", id);
    toast.success("Bot stopped");
    loadBots();
  }
  async function deleteBot(id) {
    stopBot(id);
    await supabase.from("bots").delete().eq("id", id);
    loadBots();
  }
  async function emergencyStop() {
    if (!user) return;
    runningBots.current.forEach((cleanup) => cleanup());
    runningBots.current.clear();
    await supabase.from("bots").update({
      status: "stopped"
    }).eq("user_id", user.id);
    toast.success("Emergency stop — all bots halted.");
    loadBots();
  }
  const symbolOptions = allSymbols.length > 0 ? allSymbols.filter((s) => s.market === "synthetic_index") : SYNTHETIC_MARKETS.map((m) => ({
    symbol: m.symbol,
    display_name: m.name,
    market: "synthetic_index"
  }));
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Bot builder" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "text-sm text-muted-foreground", children: [
          "Configure automated strategies.",
          account && /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider", children: [
            account.is_demo ? "🎮 Demo" : "🇺🇸 Real",
            " · ",
            currency
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "outline", size: "sm", onClick: loadBots, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(RefreshCw, { className: "mr-1 size-4" }),
          " Refresh"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "destructive", onClick: emergencyStop, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mr-1 size-4" }),
          " Emergency stop all"
        ] })
      ] })
    ] }),
    !token && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "glass-card rounded-xl border-warning/30 p-4 text-sm text-warning", children: "⚠️ Connect your Deriv account to run bots. Bots can only execute trades with a live Deriv connection." }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-[420px_1fr]", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card space-y-4 rounded-xl p-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-medium", children: "New strategy" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Name" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { value: form.name, onChange: (e) => setForm({
            ...form,
            name: e.target.value
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Strategy" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: form.strategy, onValueChange: (v) => setForm({
              ...form,
              strategy: v
            }), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "glass-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: STRATEGIES.map((s) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: s.value, children: s.label }, s.value)) })
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Market" }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: form.market, onValueChange: (v) => setForm({
              ...form,
              market: v
            }), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "glass-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: symbolOptions.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: m.symbol, children: m.display_name }, m.symbol)) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { children: [
              "Stake (",
              currency,
              ")"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 0.35, step: 0.5, value: form.stake, onChange: (e) => setForm({
              ...form,
              stake: Number(e.target.value)
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Max trades" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 1, value: form.max_trades, onChange: (e) => setForm({
              ...form,
              max_trades: Number(e.target.value)
            }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { children: [
              "Take profit (",
              currency,
              ")"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 0, value: form.take_profit, onChange: (e) => setForm({
              ...form,
              take_profit: Number(e.target.value)
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs(Label, { children: [
              "Stop loss (",
              currency,
              ")"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 0, value: form.stop_loss, onChange: (e) => setForm({
              ...form,
              stop_loss: Number(e.target.value)
            }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Martingale" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "Doubles stake after a loss. Risky." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, { checked: form.martingale, onCheckedChange: (v) => setForm({
            ...form,
            martingale: v
          }) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border border-glass-border bg-foreground/[0.02] p-3 text-[11px] text-muted-foreground", children: [
          "Bot will run on",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-medium text-foreground", children: [
            isDemo ? "🎮 Demo" : "🇺🇸 Real",
            " ",
            currency
          ] }),
          " ",
          "(your current active account). Switch accounts from the header to change."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("label", { className: "flex items-start gap-2 text-xs text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("input", { type: "checkbox", checked: confirmed, onChange: (e) => setConfirmed(e.target.checked), className: "mt-0.5" }),
          "I understand automated trading carries significant risk and may result in loss of all funds."
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { onClick: createBot, className: "w-full", disabled: !confirmed, children: "Create bot" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "space-y-3", children: bots.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card grid place-items-center rounded-xl p-12 text-center", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Bot, { className: "size-8 text-muted-foreground" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-3 text-sm text-muted-foreground", children: "No bots yet. Create one to get started." })
      ] }) : bots.map((b) => {
        const s = b.strategy ?? {};
        return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: b.name }),
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${b.status === "running" ? "bg-success/20 text-success" : "bg-foreground/5 text-muted-foreground"}`, children: b.status })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 font-mono text-xs text-muted-foreground", children: [
              s.strategy,
              " · ",
              s.market,
              " · stake ",
              s.stake,
              " ",
              s.currency ?? currency,
              " · SL ",
              s.stop_loss,
              " · TP ",
              s.take_profit,
              s.martingale && " · martingale"
            ] })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            b.status === "running" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "outline", onClick: () => stopBot(b.id), children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Square, { className: "mr-1 size-3" }),
              " Stop"
            ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", onClick: () => startBot(b), disabled: !token, children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Play, { className: "mr-1 size-3" }),
              " Start"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", onClick: () => deleteBot(b.id), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }) })
          ] })
        ] }, b.id);
      }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex items-start gap-3 rounded-xl border-warning/30 p-4 text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mt-0.5 size-4 text-warning" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-muted-foreground", children: [
        "Bots run directly in this browser session. Keep the tab open while a bot is active. Always test with a ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("strong", { className: "text-foreground", children: "Demo account" }),
        " before using real funds."
      ] })
    ] })
  ] });
}
export {
  BotPage as component
};
