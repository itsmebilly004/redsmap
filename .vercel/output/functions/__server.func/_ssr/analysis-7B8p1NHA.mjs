import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { T as TopShell } from "./top-shell-DmjSNnOs.mjs";
import { f as subscribeTicks, g as SYNTHETIC_MARKETS } from "./router-C5J15k2c.mjs";
import { S as Select, a as SelectTrigger, b as SelectValue, c as SelectContent, d as SelectItem } from "./select-BhjPe795.mjs";
import { I as Input } from "./input-DVeAuAgX.mjs";
import { c as cn } from "./button-Cz8PAkJh.mjs";
import "../_libs/sonner.mjs";
import { I as Info } from "../_libs/lucide-react.mjs";
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
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
import "../_libs/radix-ui__react-select.mjs";
import "../_libs/radix-ui__number.mjs";
import "../_libs/radix-ui__react-use-previous.mjs";
import "../_libs/@radix-ui/react-visually-hidden+[...].mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
function Analysis() {
  const TABS = ["Dcircles", "Signals", "Analysis Tool", "DP Tools", "Smart Analysis", "All Analysis", "Tick Analyser", "Xenon AI"];
  const [tab, setTab] = reactExports.useState("Dcircles");
  const [mode, setMode] = reactExports.useState("launch_ai");
  const [symbol, setSymbol] = reactExports.useState("1HZ10V");
  const [window, setWindow] = reactExports.useState(1e3);
  const [windowInput, setWindowInput] = reactExports.useState("1000");
  const [ticks, setTicks] = reactExports.useState([]);
  const [last, setLast] = reactExports.useState(null);
  reactExports.useEffect(() => {
    let off;
    setTicks([]);
    subscribeTicks(symbol, (price) => {
      setLast(price);
      setTicks((prev) => {
        const next = [...prev, price];
        if (next.length > 5e3) next.splice(0, next.length - 5e3);
        return next;
      });
    }).then((u) => off = u);
    return () => off?.();
  }, [symbol]);
  const slice = reactExports.useMemo(() => ticks.slice(-window), [ticks, window]);
  const digits = reactExports.useMemo(() => slice.map((p) => Number(p.toFixed(2).slice(-1))), [slice]);
  const counts = reactExports.useMemo(() => Array.from({
    length: 10
  }, (_, i) => digits.filter((d) => d === i).length), [digits]);
  const total = Math.max(digits.length, 1);
  const pcts = counts.map((c) => c / total * 100);
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  const currentDigit = digits.length ? digits[digits.length - 1] : null;
  const marketName = SYNTHETIC_MARKETS.find((m) => m.symbol === symbol)?.name ?? symbol;
  const digitColors = ["border-slate-300 text-slate-700", "border-orange-400 bg-orange-400 text-white", "border-rose-500 bg-rose-500 text-white", "border-slate-300 text-slate-700", "border-emerald-500 bg-emerald-500 text-white", "border-sky-500 bg-sky-500 text-white", "border-orange-400 bg-orange-400 text-white", "border-slate-300 text-slate-700", "border-slate-300 text-slate-700", "border-slate-300 text-slate-700"];
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-6xl px-4 py-6 md:px-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex flex-wrap gap-2", children: TABS.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setTab(t), className: cn("rounded-md border px-4 py-2 text-xs font-semibold transition", tab === t ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"), children: t }, t)) }),
    tab === "Dcircles" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setMode("wide_eye"), className: cn("rounded-full px-5 py-2 text-sm font-semibold text-white shadow", mode === "wide_eye" ? "bg-gradient-to-r from-rose-400 to-amber-400" : "bg-gradient-to-r from-rose-300/70 to-amber-300/70"), children: "Wide Eye" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { onClick: () => setMode("launch_ai"), className: cn("rounded-full px-5 py-2 text-sm font-semibold text-white shadow", mode === "launch_ai" ? "bg-gradient-to-r from-sky-500 to-blue-600" : "bg-gradient-to-r from-sky-400/70 to-blue-500/70"), children: "Launch AI" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("button", { title: "Choose a mode and market, then watch the live last-digit distribution.", className: "flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Info, { className: "h-4 w-4" }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "block text-sm font-semibold text-slate-800", children: "Select Market:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Select, { value: symbol, onValueChange: setSymbol, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectTrigger, { className: "mt-2 h-11 w-full max-w-3xl rounded-md border-slate-300 bg-white text-slate-800", children: /* @__PURE__ */ jsxRuntimeExports.jsx(SelectValue, {}) }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(SelectContent, { children: SYNTHETIC_MARKETS.map((m) => /* @__PURE__ */ jsxRuntimeExports.jsx(SelectItem, { value: m.symbol, children: m.name }, m.symbol)) })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 max-w-3xl rounded-md bg-slate-100/70 px-5 py-5", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-3xl font-semibold text-slate-800", children: last !== null ? last.toFixed(2) : "—" }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex flex-wrap items-center gap-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("label", { className: "text-sm font-semibold text-slate-800", children: "Ticks window:" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx(Input, { type: "number", min: 50, max: 5e3, value: windowInput, onChange: (e) => {
          setWindowInput(e.target.value);
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          if (n >= 50 && n <= 5e3) setWindow(Math.floor(n));
        }, className: "h-9 w-32 text-center" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-xs text-slate-500", children: "(50–5000)" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "ml-auto text-xs text-slate-500", children: [
          "Samples: ",
          digits.length
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-sm font-semibold text-slate-800", children: [
          "Last ",
          window,
          " ticks digit distribution"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 grid grid-cols-5 gap-y-8 sm:grid-cols-10", children: counts.map((_c, i) => {
          const pct = pcts[i];
          const isMax = pct === maxPct && total > 1;
          const isMin = pct === minPct && total > 1;
          const isCurrent = currentDigit === i;
          return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative flex flex-col items-center", children: [
            isCurrent && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute -top-6 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white shadow", children: "▾" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: cn("flex h-12 w-12 items-center justify-center rounded-full border-2 text-lg font-bold transition", digitColors[i], isCurrent && "ring-4 ring-blue-200"), children: i }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-2 text-xs font-medium text-slate-600", children: [
              pct.toFixed(1),
              "%"
            ] }),
            isMax && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px] font-semibold text-blue-600", children: "most frequency" }),
            isMin && !isMax && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-1 text-[10px] font-semibold text-slate-500", children: "least frequency" })
          ] }, i);
        }) }),
        currentDigit !== null && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-4 text-xs text-slate-500", children: [
          "current digit: ",
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold text-slate-700", children: currentDigit }),
          " · market: ",
          marketName
        ] })
      ] })
    ] }),
    tab !== "Dcircles" && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-10 rounded-md border border-dashed border-slate-300 bg-white p-12 text-center", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "text-lg font-semibold text-slate-800", children: tab }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-2 text-sm text-slate-500", children: [
        tab,
        " module is coming soon. Switch back to ",
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold", children: "Dcircles" }),
        " to see the live last-digit distribution."
      ] })
    ] })
  ] }) });
}
export {
  Analysis as component
};
