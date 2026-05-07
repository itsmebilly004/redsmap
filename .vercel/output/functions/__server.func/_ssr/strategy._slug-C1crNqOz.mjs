import { j as jsxRuntimeExports } from "./index.mjs";
import { b as Route$4, L as Link, S as STRATEGIES } from "./router-C7gTjV3A.mjs";
import { T as TopShell } from "./top-shell-BsTluAxh.mjs";
import { c as createLucideIcon } from "./createLucideIcon-vFonUMpr.mjs";
import { T as TriangleAlert } from "./triangle-alert-IVm7n2Tl.mjs";
import { A as ArrowRight } from "./arrow-right-CiCdlwBY.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./dropdown-menu-BB1zg0X4.mjs";
import "./client-B-NvnhGF.mjs";
import "./use-auth-D880YEmu.mjs";
import "./index-BVBDj44R.mjs";
import "./button-Cbaj921o.mjs";
import "./Combination-DLUKXKiD.mjs";
import "./chevron-right-BPoPgQJo.mjs";
import "./plug-BpEhNZkZ.mjs";
import "./bot-QNLsGAV7.mjs";
const __iconNode$2 = [
  ["path", { d: "m12 19-7-7 7-7", key: "1l729n" }],
  ["path", { d: "M19 12H5", key: "x3x0zl" }]
];
const ArrowLeft = createLucideIcon("arrow-left", __iconNode$2);
const __iconNode$1 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
];
const CircleCheck = createLucideIcon("circle-check", __iconNode$1);
const __iconNode = [
  [
    "path",
    {
      d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",
      key: "1gvzjb"
    }
  ],
  ["path", { d: "M9 18h6", key: "x1upvd" }],
  ["path", { d: "M10 22h4", key: "ceow96" }]
];
const Lightbulb = createLucideIcon("lightbulb", __iconNode);
function StrategyDetail() {
  const s = Route$4.useLoaderData();
  const riskColor = s.riskLevel === "Low" ? "bg-emerald-100 text-emerald-700" : s.riskLevel === "Medium" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-4xl px-4 py-10 md:px-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/strategies", className: "inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowLeft, { className: "h-4 w-4" }),
      " Back to strategies"
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "mt-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex flex-wrap items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-3xl font-bold text-slate-900 md:text-4xl", children: s.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: `rounded-full px-3 py-1 text-xs font-semibold ${riskColor}`, children: [
          s.riskLevel,
          " risk"
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-base text-slate-600", children: s.tagline })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-8 rounded-xl bg-white p-6 ring-1 ring-slate-200/70", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-slate-800", children: "Overview" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm leading-relaxed text-slate-600", children: s.overview }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Best for" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-2 flex flex-wrap gap-2", children: s.bestFor.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700", children: b }, b)) })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-xs font-semibold uppercase tracking-wide text-slate-500", children: "Recommended markets" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-2 flex flex-wrap gap-2", children: s.recommendedMarkets.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx("li", { className: "rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700", children: m }, m)) })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-6 rounded-xl bg-white p-6 ring-1 ring-slate-200/70", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-slate-800", children: "Step-by-step execution" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("ol", { className: "mt-4 space-y-4", children: s.steps.map((step, idx) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white", children: idx + 1 }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-sm font-semibold text-slate-800", children: step.title }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-slate-600", children: step.body })
        ] })
      ] }, idx)) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 grid gap-6 md:grid-cols-2", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl bg-white p-6 ring-1 ring-slate-200/70", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "flex items-center gap-2 text-lg font-semibold text-slate-800", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Lightbulb, { className: "h-5 w-5 text-amber-500" }),
          " Tips"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-3 space-y-2", children: s.tips.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2 text-sm text-slate-600", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleCheck, { className: "mt-0.5 h-4 w-4 shrink-0 text-emerald-500" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: t })
        ] }, t)) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "rounded-xl bg-white p-6 ring-1 ring-slate-200/70", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("h2", { className: "flex items-center gap-2 text-lg font-semibold text-slate-800", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "h-5 w-5 text-rose-500" }),
          " Pitfalls to avoid"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("ul", { className: "mt-3 space-y-2", children: s.pitfalls.map((p) => /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex items-start gap-2 text-sm text-slate-600", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(TriangleAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-rose-500" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: p })
        ] }, p)) })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("h3", { className: "text-lg font-semibold", children: "Ready to try this strategy?" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "text-sm text-white/80", children: "Open the bot builder and load the parameters." })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/bot-builder", className: "inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow hover:bg-slate-100", children: [
        "Open Bot Builder ",
        /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "h-4 w-4" })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("section", { className: "mt-10", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-sm font-semibold uppercase tracking-wide text-slate-500", children: "More strategies" }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 flex flex-wrap gap-2", children: STRATEGIES.filter((x) => x.slug !== s.slug).map((other) => /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/strategy/$slug", params: {
        slug: other.slug
      }, className: "rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:border-blue-400 hover:text-blue-600", children: other.name }, other.slug)) })
    ] })
  ] }) });
}
export {
  StrategyDetail as component
};
