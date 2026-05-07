import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { T as TopShell } from "./top-shell-BsTluAxh.mjs";
import { D as DerivChart } from "./deriv-chart-BzKdFw24.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./router-C7gTjV3A.mjs";
import "./dropdown-menu-BB1zg0X4.mjs";
import "./client-B-NvnhGF.mjs";
import "./use-auth-D880YEmu.mjs";
import "./createLucideIcon-vFonUMpr.mjs";
import "./index-BVBDj44R.mjs";
import "./button-Cbaj921o.mjs";
import "./Combination-DLUKXKiD.mjs";
import "./chevron-right-BPoPgQJo.mjs";
import "./plug-BpEhNZkZ.mjs";
import "./bot-QNLsGAV7.mjs";
import "./select-CKUaG5Lz.mjs";
import "./index-BYfsBK2p.mjs";
function TradingViewPage() {
  const [symbol, setSymbol] = reactExports.useState("R_100");
  return /* @__PURE__ */ jsxRuntimeExports.jsx(TopShell, { children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-7xl px-4 py-6 md:px-8", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "mb-4 text-2xl font-bold", children: "TradingView" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx(DerivChart, { symbol, onSymbolChange: setSymbol, height: 620 })
  ] }) });
}
export {
  TradingViewPage as component
};
