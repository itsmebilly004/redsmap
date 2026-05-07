import { j as jsxRuntimeExports } from "../_libs/react.mjs";
import { L as Link } from "../_libs/tanstack__react-router.mjs";
import { T as TopShell, P as PageHero } from "./top-shell-BKTx3Pm8.mjs";
import { B as Button } from "./button-Cz8PAkJh.mjs";
import { u as useAuth } from "./router-R6L_Ezj3.mjs";
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
import "../_libs/lucide-react.mjs";
import "../_libs/class-variance-authority.mjs";
import "../_libs/clsx.mjs";
import "../_libs/tailwind-merge.mjs";
import "../_libs/supabase__supabase-js.mjs";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
const PRESETS = [{
  name: "Rise Trend Pro",
  strategy: "rise_fall",
  desc: "Follows momentum on Volatility 100 with a 2x martingale."
}, {
  name: "Even Sniper",
  strategy: "even_odd",
  desc: "Statistical edge on Even/Odd ticks, conservative stake."
}, {
  name: "Over 5 Hunter",
  strategy: "over_under",
  desc: "Targets last digit > 5 with strict stop-loss."
}, {
  name: "Accumulator Stack",
  strategy: "accumulator",
  desc: "Compounding accumulators with TP at 25%."
}];
function TradingBots() {
  const {
    user
  } = useAuth();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(PageHero, { title: "Trading Bots", subtitle: "Pre-built bots you can deploy on demo or live in one click.", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "grid gap-4 md:grid-cols-2", children: PRESETS.map((b) => /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "rounded-lg border border-[oklch(0.92_0.005_240)] bg-white p-5 shadow-sm", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "text-base font-semibold", children: b.name }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1 text-sm text-[oklch(0.5_0.02_260)]", children: b.desc }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, size: "sm", className: "mt-4 bg-[oklch(0.55_0.22_265)] text-white", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: user ? "/bot-builder" : "/auth", search: user ? void 0 : {
      mode: "signup"
    }, children: user ? "Deploy" : "Sign up to deploy" }) })
  ] }, b.name)) }) }) });
}
export {
  TradingBots as component
};
