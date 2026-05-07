import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { s as supabase } from "./client-B-NvnhGF.mjs";
import { u as useAuth } from "./use-auth-D880YEmu.mjs";
import { B as Button } from "./button-Cbaj921o.mjs";
import { d as subscribeTicks, b as buildOAuthUrl, S as SYNTHETIC_MARKETS, c as createLucideIcon } from "./createLucideIcon-vFonUMpr.mjs";
import { L as Link } from "./router-C7gTjV3A.mjs";
import { P as Plug } from "./plug-BpEhNZkZ.mjs";
import { A as Activity } from "./activity-CpFBmRcA.mjs";
import { T as TrendingUp } from "./trending-up-3UMWFigR.mjs";
import { B as Bot } from "./bot-QNLsGAV7.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
const __iconNode$2 = [
  ["path", { d: "m7 7 10 10", key: "1fmybs" }],
  ["path", { d: "M17 7v10H7", key: "6fjiku" }]
];
const ArrowDownRight = createLucideIcon("arrow-down-right", __iconNode$2);
const __iconNode$1 = [
  ["path", { d: "M7 7h10v10", key: "1tivn9" }],
  ["path", { d: "M7 17 17 7", key: "1vkiza" }]
];
const ArrowUpRight = createLucideIcon("arrow-up-right", __iconNode$1);
const __iconNode = [
  [
    "path",
    {
      d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1",
      key: "18etb6"
    }
  ],
  ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4", key: "xoc0q4" }]
];
const Wallet = createLucideIcon("wallet", __iconNode);
function StatCard({
  icon: Icon,
  label,
  value,
  accent
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4 text-muted-foreground" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `mt-3 font-mono text-2xl ${accent ?? ""}`, children: value })
  ] });
}
function DashboardHome() {
  const {
    user
  } = useAuth();
  const [hasDeriv, setHasDeriv] = reactExports.useState(null);
  const [trades, setTrades] = reactExports.useState([]);
  const [tick, setTick] = reactExports.useState(null);
  reactExports.useEffect(() => {
    if (!user) return;
    supabase.from("sessions").select("id").eq("user_id", user.id).eq("is_active", true).gt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).limit(1).then(({
      data
    }) => setHasDeriv((data?.length ?? 0) > 0));
    supabase.from("trades").select("*").eq("user_id", user.id).order("created_at", {
      ascending: false
    }).limit(10).then(({
      data
    }) => setTrades(data ?? []));
  }, [user]);
  reactExports.useEffect(() => {
    let off;
    subscribeTicks("R_100", (price) => setTick(price)).then((unsub) => off = unsub);
    return () => off?.();
  }, []);
  const totalPL = trades.reduce((a, t) => a + Number(t.profit_loss ?? 0), 0);
  const wins = trades.filter((t) => t.status === "won").length;
  const losses = trades.filter((t) => t.status === "lost").length;
  const winRate = wins + losses ? Math.round(wins / (wins + losses) * 100) : 0;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Welcome back" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Here's a snapshot of your trading activity." })
    ] }),
    hasDeriv === false && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card flex flex-col items-start gap-4 rounded-xl border-primary/30 p-6 md:flex-row md:items-center md:justify-between", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-medium", children: "Connect your Deriv account" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-muted-foreground", children: "Authorize ArkTrader through Deriv's official OAuth — no passwords stored." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: () => window.location.href = buildOAuthUrl(), children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "mr-1 size-4" }),
        " Connect Deriv"
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: Wallet, label: "Total P&L", value: `${totalPL >= 0 ? "+" : ""}${totalPL.toFixed(2)}`, accent: totalPL >= 0 ? "text-success" : "text-destructive" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: Activity, label: "Trades", value: trades.length }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: TrendingUp, label: "Win rate", value: `${winRate}%` }),
      /* @__PURE__ */ jsxRuntimeExports.jsx(StatCard, { icon: Bot, label: "V100 live", value: tick ? tick.toFixed(2) : "—", accent: "text-primary" })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "grid gap-6 lg:grid-cols-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5 lg:col-span-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 flex items-center justify-between", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-medium", children: "Recent trades" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/dashboard/analytics", className: "text-xs text-primary hover:underline", children: "View all →" })
        ] }),
        trades.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-col items-center justify-center py-10 text-center", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "No trades yet — head to the Trade tab." }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, size: "sm", className: "mt-4", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/dashboard/trade", children: "Start trading" }) })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "divide-y divide-glass-border", children: trades.map((t) => {
          const win = t.status === "won";
          const loss = t.status === "lost";
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center justify-between py-3 text-sm", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
              win ? /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowUpRight, { className: "size-4 text-success" }) : loss ? /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowDownRight, { className: "size-4 text-destructive" }) : /* @__PURE__ */ jsxRuntimeExports.jsx(Activity, { className: "size-4 text-muted-foreground" }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-xs", children: t.symbol }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: t.trade_type })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-right font-mono", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: win ? "text-success" : loss ? "text-destructive" : "", children: [
                Number(t.profit_loss ?? 0) >= 0 ? "+" : "",
                Number(t.profit_loss ?? 0).toFixed(2)
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[10px] text-muted-foreground", children: [
                "stake ",
                Number(t.stake).toFixed(2)
              ] })
            ] })
          ] }, t.id);
        }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-medium", children: "Markets" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-4 space-y-2 text-sm", children: SYNTHETIC_MARKETS.slice(0, 5).map((m) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-center justify-between rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: m.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs", children: m.symbol })
        ] }, m.symbol)) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, variant: "outline", className: "mt-4 w-full glass-card", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/dashboard/trade", children: "Open trade desk" }) })
      ] })
    ] })
  ] });
}
export {
  DashboardHome as component
};
