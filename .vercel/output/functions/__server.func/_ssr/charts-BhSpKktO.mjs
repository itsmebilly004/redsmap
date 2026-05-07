import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { T as TopShell } from "./top-shell-wcTYXcDY.mjs";
import { D as DerivChart } from "./deriv-chart-CjYdz1ci.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./router-BtJUm4Bw.mjs";
import "./log-out-B9xrl086.mjs";
import "./createLucideIcon-PCEr6oYE.mjs";
import "./button-DWMTRLlu.mjs";
import "./clsx-DgYk2OaC.mjs";
import "./dropdown-menu-CBcnGRmr.mjs";
import "./index-CBd3c19k.mjs";
import "./Combination-CoYZo-CM.mjs";
import "./plug-CcVKMJ69.mjs";
import "./bot-_2XUzhkh.mjs";
import "./chart-line-BNKJexn0.mjs";
import "./select-CECXa8zf.mjs";
import "./index-GFW5LlN8.mjs";
function ChartsPage() {
  const [symbol, setSymbol] = reactExports.useState("R_100");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-7xl px-4 py-6 md:px-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mb-4 text-2xl font-bold", children: "Live Charts" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DerivChart, { symbol, onSymbolChange: setSymbol, height: 560 })
  ] }) });
}
export {
  ChartsPage as component
};
