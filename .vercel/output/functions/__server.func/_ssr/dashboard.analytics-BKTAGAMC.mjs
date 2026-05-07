import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { u as useAuth, a as supabase } from "./router-C5J15k2c.mjs";
import "../_libs/sonner.mjs";
import { R as ResponsiveContainer, A as AreaChart, C as CartesianGrid, X as XAxis, Y as YAxis, T as Tooltip, a as Area } from "../_libs/recharts.mjs";
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
import "../_libs/clsx.mjs";
import "../_libs/lodash.mjs";
import "../_libs/tiny-invariant.mjs";
import "../_libs/react-is.mjs";
import "../_libs/d3-shape.mjs";
import "../_libs/d3-path.mjs";
import "../_libs/react-smooth.mjs";
import "../_libs/prop-types.mjs";
import "../_libs/fast-equals.mjs";
import "../_libs/victory-vendor.mjs";
import "../_libs/d3-scale.mjs";
import "../_libs/internmap.mjs";
import "../_libs/d3-array.mjs";
import "../_libs/d3-time-format.mjs";
import "../_libs/d3-time.mjs";
import "../_libs/d3-interpolate.mjs";
import "../_libs/d3-color.mjs";
import "../_libs/d3-format.mjs";
import "../_libs/recharts-scale.mjs";
import "../_libs/decimal.js-light.mjs";
import "../_libs/eventemitter3.mjs";
function AnalyticsPage() {
  const {
    user
  } = useAuth();
  const [trades, setTrades] = reactExports.useState([]);
  reactExports.useEffect(() => {
    if (!user) return;
    supabase.from("trades").select("*").eq("user_id", user.id).order("created_at", {
      ascending: true
    }).then(({
      data
    }) => setTrades(data ?? []));
  }, [user]);
  const stats = reactExports.useMemo(() => {
    const wins = trades.filter((t) => t.status === "won").length;
    const losses = trades.filter((t) => t.status === "lost").length;
    const total = trades.length;
    const totalStake = trades.reduce((a, t) => a + Number(t.stake ?? 0), 0);
    const profit = trades.reduce((a, t) => a + Number(t.profit_loss ?? 0), 0);
    const roi = totalStake ? profit / totalStake * 100 : 0;
    let cum = 0;
    const equity = trades.map((t) => {
      cum += Number(t.profit_loss ?? 0);
      return {
        x: new Date(t.created_at).toLocaleString(),
        y: Number(cum.toFixed(2))
      };
    });
    return {
      wins,
      losses,
      total,
      profit,
      roi,
      winRate: wins + losses ? wins / (wins + losses) * 100 : 0,
      equity
    };
  }, [trades]);
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "space-y-6", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: "Analytics" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-muted-foreground", children: "Performance across all your trades." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4", children: [{
      label: "Total trades",
      value: stats.total
    }, {
      label: "Wins / Losses",
      value: `${stats.wins} / ${stats.losses}`
    }, {
      label: "Win rate",
      value: `${stats.winRate.toFixed(1)}%`
    }, {
      label: "ROI",
      value: `${stats.roi.toFixed(2)}%`,
      accent: stats.roi >= 0 ? "text-success" : "text-destructive"
    }].map((s) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: s.label }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: `mt-3 font-mono text-2xl ${s.accent ?? ""}`, children: s.value })
    ] }, s.label)) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-sm font-medium", children: "Equity curve" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "h-72 w-full", children: stats.equity.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid h-full place-items-center text-sm text-muted-foreground", children: "No data yet." }) : /* @__PURE__ */ jsxRuntimeExports.jsx(ResponsiveContainer, { width: "100%", height: "100%", children: /* @__PURE__ */ jsxRuntimeExports.jsxs(AreaChart, { data: stats.equity, children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("defs", { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("linearGradient", { id: "g", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "0%", stopColor: "oklch(0.78 0.16 230)", stopOpacity: 0.4 }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("stop", { offset: "100%", stopColor: "oklch(0.78 0.16 230)", stopOpacity: 0 })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(CartesianGrid, { stroke: "oklch(1 0 0 / 0.05)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(XAxis, { dataKey: "x", hide: true }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(YAxis, { tick: {
          fill: "oklch(0.65 0.02 240)",
          fontSize: 10
        }, width: 50 }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Tooltip, { contentStyle: {
          background: "oklch(0.18 0.02 260)",
          border: "1px solid oklch(1 0 0 / 0.1)",
          borderRadius: 8
        }, formatter: (v) => [`${Number(v).toFixed(2)}`, "Equity"] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Area, { type: "monotone", dataKey: "y", stroke: "oklch(0.78 0.16 230)", fill: "url(#g)", strokeWidth: 1.5 })
      ] }) }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-xl p-5", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "mb-4 text-sm font-medium", children: "Trade history" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("table", { className: "w-full text-sm", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("thead", { className: "text-xs uppercase tracking-wider text-muted-foreground", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-glass-border", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-left", children: "Time" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-left", children: "Market" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-left", children: "Type" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-right", children: "Stake" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-right", children: "P&L" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("th", { className: "py-2 text-right", children: "Result" })
        ] }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("tbody", { children: trades.length === 0 ? /* @__PURE__ */ jsxRuntimeExports.jsx("tr", { children: /* @__PURE__ */ jsxRuntimeExports.jsx("td", { colSpan: 6, className: "py-8 text-center text-muted-foreground", children: "No trades yet." }) }) : [...trades].reverse().map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs("tr", { className: "border-b border-glass-border/50", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 font-mono text-xs text-muted-foreground", children: new Date(t.created_at).toLocaleString() }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 font-mono text-xs", children: t.symbol }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 font-mono text-xs", children: t.trade_type }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 text-right font-mono", children: Number(t.stake).toFixed(2) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("td", { className: `py-2 text-right font-mono ${Number(t.profit_loss) >= 0 ? "text-success" : "text-destructive"}`, children: [
            Number(t.profit_loss ?? 0) >= 0 ? "+" : "",
            Number(t.profit_loss ?? 0).toFixed(2)
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("td", { className: "py-2 text-right", children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${t.status === "won" ? "bg-success/20 text-success" : t.status === "lost" ? "bg-destructive/20 text-destructive" : "bg-foreground/5 text-muted-foreground"}`, children: t.status }) })
        ] }, t.id)) })
      ] }) })
    ] })
  ] });
}
export {
  AnalyticsPage as component
};
