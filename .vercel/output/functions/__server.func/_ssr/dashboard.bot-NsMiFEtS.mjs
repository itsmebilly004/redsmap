import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { s as supabase } from "./client-B-NvnhGF.mjs";
import { u as useAuth } from "./use-auth-D880YEmu.mjs";
import { B as Button } from "./button-Cbaj921o.mjs";
import { I as Input } from "./input-DJsVq6jX.mjs";
import { L as Label, S as Switch, T as Trash2 } from "./switch-CcXNwQWm.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-CKUaG5Lz.mjs";
import { S as SYNTHETIC_MARKETS } from "./createLucideIcon-vFonUMpr.mjs";
import { t as toast } from "./router-C7gTjV3A.mjs";
import { T as TriangleAlert } from "./triangle-alert-IVm7n2Tl.mjs";
import { B as Bot } from "./bot-QNLsGAV7.mjs";
import { S as Square, P as Play } from "./square-Dy8VLOso.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-BVBDj44R.mjs";
import "./index-BYfsBK2p.mjs";
import "./Combination-DLUKXKiD.mjs";
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
function BotPage() {
  const {
    user
  } = useAuth();
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
    max_trades: 20,
    is_demo: true
  });
  const [confirmed, setConfirmed] = reactExports.useState(false);
  async function load() {
    if (!user) return;
    const {
      data
    } = await supabase.from("bots").select("*").eq("user_id", user.id).order("created_at", {
      ascending: false
    });
    setBots(data ?? []);
  }
  reactExports.useEffect(() => {
    load();
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
      strategy,
      user_id: user.id
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Bot created");
      load();
    }
  }
  async function setStatus(id, status) {
    await supabase.from("bots").update({
      status
    }).eq("id", id);
    toast.success(status === "running" ? "Bot started" : "Bot stopped");
    load();
  }
  async function deleteBot(id) {
    await supabase.from("bots").delete().eq("id", id);
    load();
  }
  async function emergencyStop() {
    if (!user) return;
    await supabase.from("bots").update({
      status: "stopped"
    }).eq("user_id", user.id);
    toast.success("Emergency stop — all bots halted.");
    load();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Bot builder" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Configure semi-automated strategies with strict risk controls." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { variant: "destructive", onClick: emergencyStop, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mr-1 size-4" }),
        " Emergency stop all"
      ] })
    ] }),
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
              /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: SYNTHETIC_MARKETS.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: m.symbol, children: m.name }, m.symbol)) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid grid-cols-2 gap-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Stake" }),
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
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Take profit" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 0, value: form.take_profit, onChange: (e) => setForm({
              ...form,
              take_profit: Number(e.target.value)
            }) })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-1.5", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Stop loss" }),
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
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] p-3", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Label, { children: "Demo account" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-[11px] text-muted-foreground", children: "Highly recommended for new strategies." })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Switch, { checked: form.is_demo, onCheckedChange: (v) => setForm({
            ...form,
            is_demo: v
          }) })
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
      ] }) : bots.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex flex-wrap items-center justify-between gap-3 rounded-xl p-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-w-0", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-medium", children: b.name }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${b.status === "running" ? "bg-success/20 text-success" : "bg-foreground/5 text-muted-foreground"}`, children: b.status }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider", children: b.is_demo ? "Demo" : "Live" })
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-1 font-mono text-xs text-muted-foreground", children: [
            b.strategy,
            " • ",
            b.market,
            " • stake ",
            b.stake,
            " • SL ",
            b.stop_loss,
            " • TP ",
            b.take_profit
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          b.status === "running" ? /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", variant: "outline", onClick: () => setStatus(b.id, "stopped"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Square, { className: "mr-1 size-3" }),
            " Stop"
          ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { size: "sm", onClick: () => setStatus(b.id, "running"), children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Play, { className: "mr-1 size-3" }),
            " Start"
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { size: "icon", variant: "ghost", onClick: () => deleteBot(b.id), children: /* @__PURE__ */ jsxRuntimeExports.jsx(Trash2, { className: "size-4" }) })
        ] })
      ] }, b.id)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex items-start gap-3 rounded-xl border-warning/30 p-4 text-sm", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mt-0.5 size-4 text-warning" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-muted-foreground", children: [
        "Bot execution is currently in ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: "supervised preview" }),
        ": strategies are stored and tracked, but live trade placement runs from this browser session. Keep the tab open while a bot is running, and always use demo first."
      ] })
    ] })
  ] });
}
export {
  BotPage as component
};
