import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate, L as Link } from "../_libs/tanstack__react-router.mjs";
import { B as Button } from "./button-Cz8PAkJh.mjs";
import { e as Route$8, u as useAuth, c as buildOAuthUrl } from "./router-C5J15k2c.mjs";
import "../_libs/sonner.mjs";
import { z as ShieldCheck, d as ArrowRight } from "../_libs/lucide-react.mjs";
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
import "../_libs/radix-ui__react-slot.mjs";
import "../_libs/radix-ui__react-compose-refs.mjs";
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
import "tslib";
import "../_libs/supabase__functions-js.mjs";
import "../_libs/zod.mjs";
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
