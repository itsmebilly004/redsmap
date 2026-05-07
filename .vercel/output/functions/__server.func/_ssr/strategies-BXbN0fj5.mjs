import { j as jsxRuntimeExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { T as TopShell } from "./top-shell-BKTx3Pm8.mjs";
import { S as STRATEGIES } from "./router-R6L_Ezj3.mjs";
import "../_libs/sonner.mjs";
import { Z as Zap, S as Sparkles, T as Target, A as ArrowDownUp, a as ArrowUp, b as SquareCheckBig, H as Hash, c as TrendingUp, d as ArrowRight } from "../_libs/lucide-react.mjs";
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
import "./button-Cz8PAkJh.mjs";
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "../_libs/radix-ui__react-dropdown-menu.mjs";
import "../_libs/radix-ui__primitive.mjs";
import "../_libs/radix-ui__react-context.mjs";
import "../_libs/@radix-ui/react-use-controllable-state+[...].mjs";
import "../_libs/@radix-ui/react-use-layout-effect+[...].mjs";
import "../_libs/radix-ui__react-primitive.mjs";
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
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
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
