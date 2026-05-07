import { j as jsxRuntimeExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { T as TopShell, P as PageHero } from "./top-shell-BKTx3Pm8.mjs";
import { B as Button } from "./button-Cz8PAkJh.mjs";
import "../_libs/sonner.mjs";
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
import "./router-R6L_Ezj3.mjs";
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
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
import "../_libs/lucide-react.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
const TRADERS = [{
  name: "AlphaQuant",
  roi: "+182%",
  followers: 1240
}, {
  name: "VolMaster",
  roi: "+97%",
  followers: 856
}, {
  name: "DigitWizard",
  roi: "+64%",
  followers: 523
}];
function CopyTrading() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(PageHero, { title: "Copy Trading", subtitle: "Follow top traders and automatically mirror their trades on your Deriv account.", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 md:grid-cols-3", children: TRADERS.map((t) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-10 rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_265)] to-[oklch(0.4_0.2_280)]" }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-base font-semibold", children: t.name }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-xs text-[oklch(0.5_0.02_260)]", children: [
          t.followers,
          " followers"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-3 text-2xl font-bold text-[oklch(0.55_0.18_150)]", children: t.roi }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-xs text-[oklch(0.5_0.02_260)]", children: "12-month ROI" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, size: "sm", className: "mt-4 w-full bg-[oklch(0.55_0.22_265)] text-white", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/auth", search: {
      mode: "signup"
    }, children: "Copy" }) })
  ] }, t.name)) }) }) });
}
export {
  CopyTrading as component
};
