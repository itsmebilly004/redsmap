import { K as reactExports, j as jsxRuntimeExports } from "./index.mjs";
import { a as Route$8, u as useNavigate, L as Link } from "./router-C7gTjV3A.mjs";
import { B as Button } from "./button-Cbaj921o.mjs";
import { u as useAuth } from "./use-auth-D880YEmu.mjs";
import { c as createLucideIcon, b as buildOAuthUrl } from "./createLucideIcon-vFonUMpr.mjs";
import { A as ArrowRight } from "./arrow-right-CiCdlwBY.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./client-B-NvnhGF.mjs";
const __iconNode = [
  [
    "path",
    {
      d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",
      key: "oel41y"
    }
  ],
  ["path", { d: "m9 12 2 2 4-4", key: "dzmm74" }]
];
const ShieldCheck = createLucideIcon("shield-check", __iconNode);
function AuthPage() {
  const {
    mode
  } = Route$8.useSearch();
  const navigate = useNavigate();
  const {
    user,
    loading
  } = useAuth();
  const [busy, setBusy] = reactExports.useState(false);
  reactExports.useEffect(() => {
    if (!loading && user) navigate({
      to: "/dashboard"
    });
  }, [user, loading, navigate]);
  const isSignup = mode === "signup";
  function handleDeriv() {
    setBusy(true);
    window.location.href = buildOAuthUrl();
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative grid min-h-dvh place-items-center px-4 py-12", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "pointer-events-none absolute inset-0", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "absolute -top-20 left-1/2 size-[500px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative w-full max-w-md", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "mb-8 flex items-center justify-center gap-2.5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-7 rotate-45 rounded-sm bg-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-lg font-semibold tracking-tight", children: "ArkTrader Hub" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "glass-card rounded-2xl p-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(ShieldCheck, { className: "size-3.5" }),
          " Official Deriv OAuth"
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-semibold tracking-tight", children: isSignup ? "Create your account" : "Welcome back" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-1.5 text-sm text-muted-foreground", children: isSignup ? "You'll be redirected to Deriv to register, then sent straight back to your dashboard." : "Continue with the Deriv account you already use to trade — no passwords stored here." }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: handleDeriv, size: "lg", disabled: busy, className: "mt-6 h-12 w-full text-base shadow-[0_0_30px_-5px_oklch(0.78_0.16_230_/_0.5)]", children: [
          busy ? "Redirecting…" : isSignup ? "Sign up with Deriv" : "Sign in with Deriv",
          /* @__PURE__ */ jsxRuntimeExports.jsx(ArrowRight, { className: "ml-1 size-4" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("ul", { className: "mt-6 space-y-2 text-sm text-muted-foreground", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-1 size-1 shrink-0 rounded-full bg-primary" }),
            "You authenticate on ",
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-foreground", children: "deriv.com" }),
            " directly."
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-1 size-1 shrink-0 rounded-full bg-primary" }),
            "ArkTrader receives a trading token only — never your password."
          ] }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs("li", { className: "flex gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mt-1 size-1 shrink-0 rounded-full bg-primary" }),
            "Demo and live accounts both supported. Demo is selected by default."
          ] })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("p", { className: "mt-6 text-center text-sm text-muted-foreground", children: [
          isSignup ? "Already have a Deriv account?" : "New to Deriv?",
          " ",
          /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/auth", search: {
            mode: isSignup ? "signin" : "signup"
          }, className: "text-primary hover:underline", children: isSignup ? "Sign in" : "Sign up" })
        ] })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-6 text-center text-xs text-muted-foreground", children: "By continuing you agree to trade at your own risk. ArkTrader Hub is an independent third-party interface for the Deriv API." })
    ] })
  ] });
}
export {
  AuthPage as component
};
