import { j as jsxRuntimeExports } from "./index.mjs";
import { L as Link } from "./router-C7gTjV3A.mjs";
import { T as TopShell, P as PageHero } from "./top-shell-BsTluAxh.mjs";
import { B as Button } from "./button-Cbaj921o.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./dropdown-menu-BB1zg0X4.mjs";
import "./client-B-NvnhGF.mjs";
import "./use-auth-D880YEmu.mjs";
import "./createLucideIcon-vFonUMpr.mjs";
import "./index-BVBDj44R.mjs";
import "./Combination-DLUKXKiD.mjs";
import "./chevron-right-BPoPgQJo.mjs";
import "./plug-BpEhNZkZ.mjs";
import "./bot-QNLsGAV7.mjs";
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
