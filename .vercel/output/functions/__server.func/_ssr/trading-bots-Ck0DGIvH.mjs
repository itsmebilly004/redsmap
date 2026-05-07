import { j as jsxRuntimeExports } from "./index.mjs";
import { u as useAuth, L as Link } from "./router-BtJUm4Bw.mjs";
import { T as TopShell, P as PageHero } from "./top-shell-wcTYXcDY.mjs";
import { B as Button } from "./button-DWMTRLlu.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./log-out-B9xrl086.mjs";
import "./createLucideIcon-PCEr6oYE.mjs";
import "./dropdown-menu-CBcnGRmr.mjs";
import "./index-CBd3c19k.mjs";
import "./Combination-CoYZo-CM.mjs";
import "./plug-CcVKMJ69.mjs";
import "./bot-_2XUzhkh.mjs";
import "./chart-line-BNKJexn0.mjs";
import "./clsx-DgYk2OaC.mjs";
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
    /* @__PURE__ */ jsxRuntimeExports.jsx(Button, { asChild: true, size: "sm", className: "mt-4 bg-[oklch(0.55_0.22_265)] text-white", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: user ? "/dashboard/bot" : "/auth", search: user ? void 0 : {
      mode: "signup"
    }, children: user ? "Deploy" : "Sign up to deploy" }) })
  ] }, b.name)) }) }) });
}
export {
  TradingBots as component
};
