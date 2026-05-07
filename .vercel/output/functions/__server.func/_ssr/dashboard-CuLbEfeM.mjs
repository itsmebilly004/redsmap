import { r as reactExports, j as jsxRuntimeExports } from "../_libs/react.mjs";
import { d as useNavigate, e as useRouterState, L as Link, O as Outlet } from "../_libs/tanstack__react-router.mjs";
import { u as useAuth, b as useDerivBalance, c as buildOAuthUrl } from "./router-C5J15k2c.mjs";
import { B as Button } from "./button-Cz8PAkJh.mjs";
import { D as DropdownMenu, a as DropdownMenuTrigger, b as DropdownMenuContent, c as DropdownMenuItem, d as DropdownMenuSeparator } from "./dropdown-menu-C9_FfC1I.mjs";
import { t as toast } from "../_libs/sonner.mjs";
import { c as TrendingUp, B as Bot, C as ChartColumn, e as Settings, f as LogOut, g as CircleDot, h as ChevronDown, P as Plug } from "../_libs/lucide-react.mjs";
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
import "../_libs/react-remove-scroll-bar.mjs";
import "../_libs/react-style-singleton.mjs";
import "../_libs/get-nonce.mjs";
import "../_libs/use-sidecar.mjs";
import "../_libs/use-callback-ref.mjs";
const CURRENCY_FLAG = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  JPY: "🇯🇵",
  NZD: "🇳🇿",
  tUSDT: "🇺🇸",
  BTC: "🇺🇸",
  ETH: "🇺🇸"
};
const items = [{
  to: "/dashboard/trade",
  label: "Trade",
  icon: TrendingUp
}, {
  to: "/dashboard/bot",
  label: "Bot",
  icon: Bot
}, {
  to: "/dashboard/analytics",
  label: "Analytics",
  icon: ChartColumn
}, {
  to: "/dashboard/settings",
  label: "Settings",
  icon: Settings
}];
function DashboardLayout() {
  const {
    user,
    loading
  } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (s) => s.location.pathname
  });
  const {
    account,
    accounts,
    balance,
    currency,
    switchAccount,
    logout
  } = useDerivBalance();
  reactExports.useEffect(() => {
    if (!loading && !user) navigate({
      to: "/auth",
      search: {
        mode: "signin"
      }
    });
  }, [user, loading, navigate]);
  async function handleLogout() {
    await logout();
    navigate({
      to: "/"
    });
  }
  function connectDeriv() {
    if (!user) {
      toast.error("Sign in first");
      return;
    }
    window.location.href = buildOAuthUrl();
  }
  if (loading || !user) return null;
  const flag = account ? CURRENCY_FLAG[currency] ?? (account.is_demo ? "🎮" : "🇺🇸") : null;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "dark flex min-h-dvh", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "hidden w-60 shrink-0 flex-col border-r border-glass-border bg-sidebar/70 backdrop-blur-xl md:flex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "flex h-16 items-center gap-2.5 border-b border-glass-border px-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-6 rotate-45 rounded-sm bg-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold tracking-tight", children: "ArkTrader" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "flex-1 space-y-1 p-3", children: items.map((item) => {
        const active = pathname.startsWith(item.to);
        const Icon = item.icon;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: item.to, className: `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }),
          " ",
          item.label
        ] }, item.to);
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "border-t border-glass-border p-3", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/", className: "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 mb-1", children: "← Manual Traders" }),
        /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: handleLogout, className: "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-4" }),
          " Sign out"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-glass-border bg-background/60 px-4 backdrop-blur-xl md:px-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleDot, { className: `size-3.5 ${account ? "text-success" : "text-muted-foreground"}` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: account ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            flag && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "mr-1", children: flag }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-foreground", children: account.account_id }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider", children: account.is_demo ? "Demo" : "Live" })
          ] }) : "No Deriv account connected" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-3", children: account ? /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "flex items-center gap-2 rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-left transition hover:bg-foreground/[0.05]", children: [
            flag && /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base", children: flag }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "leading-tight", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: [
                account.is_demo ? "Demo" : "Real",
                " ",
                currency
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-sm font-semibold text-foreground tabular-nums", children: [
                (balance ?? 0).toLocaleString(void 0, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }),
                " ",
                currency
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-4 text-muted-foreground" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "w-72", children: [
            accounts.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: () => switchAccount(a.account_id), className: "flex items-center justify-between gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base", children: CURRENCY_FLAG[a.currency] ?? (a.is_demo ? "🎮" : "🇺🇸") }),
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "leading-tight", children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: [
                    a.is_demo ? "Demo" : "Real",
                    " ",
                    a.currency
                  ] }),
                  /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-xs", children: a.account_id })
                ] })
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("span", { className: "font-mono text-xs tabular-nums", children: [
                Number(a.balance ?? 0).toFixed(2),
                " ",
                a.currency
              ] })
            ] }, a.account_id)),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: connectDeriv, className: "gap-2 text-muted-foreground", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "size-3.5" }),
              " Add / reconnect account"
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: handleLogout, className: "gap-2 text-red-600 focus:text-red-600", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-3.5" }),
              " Disconnect & sign out"
            ] })
          ] })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: connectDeriv, size: "sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "mr-1 size-4" }),
          " Connect Deriv"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "flex-1 px-4 py-8 pb-24 md:px-8 md:pb-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "sticky bottom-0 z-20 grid grid-cols-4 border-t border-glass-border bg-background/80 backdrop-blur md:hidden", children: items.map((item) => {
        const active = pathname.startsWith(item.to);
        const Icon = item.icon;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: item.to, className: `flex flex-col items-center gap-0.5 py-2 text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }),
          " ",
          item.label
        ] }, item.to);
      }) })
    ] })
  ] });
}
export {
  DashboardLayout as component
};
