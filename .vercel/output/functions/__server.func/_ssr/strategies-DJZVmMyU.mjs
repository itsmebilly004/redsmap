import { j as jsxRuntimeExports } from "./index.mjs";
import { S as STRATEGIES, L as Link } from "./router-BtJUm4Bw.mjs";
import { T as TopShell, S as Sparkles, a as Target } from "./top-shell-wcTYXcDY.mjs";
import { c as createLucideIcon } from "./createLucideIcon-PCEr6oYE.mjs";
import { T as TrendingUp } from "./trending-up-DUm9FSh0.mjs";
import { A as ArrowRight } from "./arrow-right-DXkfsmIA.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./log-out-B9xrl086.mjs";
import "./button-DWMTRLlu.mjs";
import "./clsx-DgYk2OaC.mjs";
import "./dropdown-menu-CBcnGRmr.mjs";
import "./index-CBd3c19k.mjs";
import "./Combination-CoYZo-CM.mjs";
import "./plug-CcVKMJ69.mjs";
import "./bot-_2XUzhkh.mjs";
import "./chart-line-BNKJexn0.mjs";
const __iconNode$4 = [
  ["path", { d: "m3 16 4 4 4-4", key: "1co6wj" }],
  ["path", { d: "M7 20V4", key: "1yoxec" }],
  ["path", { d: "m21 8-4-4-4 4", key: "1c9v7m" }],
  ["path", { d: "M17 4v16", key: "7dpous" }]
];
const ArrowDownUp = createLucideIcon("arrow-down-up", __iconNode$4);
const __iconNode$3 = [
  ["path", { d: "m5 12 7-7 7 7", key: "hav0vg" }],
  ["path", { d: "M12 19V5", key: "x0mq9r" }]
];
const ArrowUp = createLucideIcon("arrow-up", __iconNode$3);
const __iconNode$2 = [
  ["line", { x1: "4", x2: "20", y1: "9", y2: "9", key: "4lhtct" }],
  ["line", { x1: "4", x2: "20", y1: "15", y2: "15", key: "vyu0kd" }],
  ["line", { x1: "10", x2: "8", y1: "3", y2: "21", key: "1ggp8o" }],
  ["line", { x1: "16", x2: "14", y1: "3", y2: "21", key: "weycgp" }]
];
const Hash = createLucideIcon("hash", __iconNode$2);
const __iconNode$1 = [
  [
    "path",
    { d: "M21 10.656V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.344", key: "2acyp4" }
  ],
  ["path", { d: "m9 11 3 3L22 4", key: "1pflzl" }]
];
const SquareCheckBig = createLucideIcon("square-check-big", __iconNode$1);
const __iconNode = [
  [
    "path",
    {
      d: "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",
      key: "1xq2db"
    }
  ]
];
const Zap = createLucideIcon("zap", __iconNode);
const ICONS = {
  "over-under": {
    Icon: TrendingUp,
    color: "text-blue-600"
  },
  odd: {
    Icon: Hash,
    color: "text-pink-500"
  },
  even: {
    Icon: SquareCheckBig,
    color: "text-emerald-500"
  },
  "hit-and-run": {
    Icon: ArrowUp,
    color: "text-rose-500"
  },
  "rise-fall": {
    Icon: ArrowDownUp,
    color: "text-indigo-500"
  },
  matches: {
    Icon: Target,
    color: "text-amber-500"
  },
  "martingale-recovery": {
    Icon: Sparkles,
    color: "text-violet-500"
  },
  scalping: {
    Icon: Zap,
    color: "text-orange-500"
  }
};
function Strategies() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-7xl px-4 py-10 md:px-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "text-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-bold text-slate-900 md:text-4xl", children: "Advanced Trading Strategies" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-blue-600", children: "Select a trading strategy to view detailed execution guidelines." })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4", children: STRATEGIES.map((s) => {
      const meta = ICONS[s.slug] ?? {
        Icon: Target,
        color: "text-slate-500"
      };
      const {
        Icon,
        color
      } = meta;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/strategy/$slug", params: {
        slug: s.slug
      }, className: "group relative flex h-72 flex-col items-center justify-between rounded-xl bg-slate-50 p-6 text-center shadow-sm ring-1 ring-slate-200/70 transition hover:shadow-md hover:ring-blue-300", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-2", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: `h-12 w-12 ${color}`, strokeWidth: 2.5 }) }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-bold text-slate-800", children: s.name }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-xs leading-relaxed text-slate-500", children: s.tagline })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition group-hover:border-blue-400 group-hover:text-blue-600", children: [
          "Explore Strategy ",
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-3.5 w-3.5" })
        ] })
      ] }, s.slug);
    }) })
  ] }) });
}
export {
  Strategies as component
};
