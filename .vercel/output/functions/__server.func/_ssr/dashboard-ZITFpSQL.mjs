import { K as reactExports, j as jsxRuntimeExports, W as Outlet } from "./index.mjs";
import { u as useNavigate, L as Link, t as toast } from "./router-C7gTjV3A.mjs";
import { u as useRouterState, a as useDerivBalance, C as ChartColumn, D as DropdownMenu, b as DropdownMenuTrigger, c as DropdownMenuContent, d as DropdownMenuItem } from "./dropdown-menu-BB1zg0X4.mjs";
import { s as supabase } from "./client-B-NvnhGF.mjs";
import { u as useAuth } from "./use-auth-D880YEmu.mjs";
import { B as Button } from "./button-Cbaj921o.mjs";
import { c as createLucideIcon, b as buildOAuthUrl } from "./createLucideIcon-vFonUMpr.mjs";
import { T as TrendingUp } from "./trending-up-3UMWFigR.mjs";
import { B as Bot } from "./bot-QNLsGAV7.mjs";
import { S as Settings } from "./settings-PXXlt7g6.mjs";
import { C as ChevronDown } from "./Combination-DLUKXKiD.mjs";
import { P as Plug } from "./plug-BpEhNZkZ.mjs";
import "node:events";
import "node:async_hooks";
import "node:stream/web";
import "node:stream";
import "./index-BVBDj44R.mjs";
import "./chevron-right-BPoPgQJo.mjs";
const __iconNode$2 = [
  ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }],
  ["circle", { cx: "12", cy: "12", r: "1", key: "41hilf" }]
];
const CircleDot = createLucideIcon("circle-dot", __iconNode$2);
const __iconNode$1 = [
  ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1", key: "10lvy0" }],
  ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1", key: "16une8" }],
  ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1", key: "1hutg5" }],
  ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1", key: "ldoo1y" }]
];
const LayoutDashboard = createLucideIcon("layout-dashboard", __iconNode$1);
const __iconNode = [
  ["path", { d: "m16 17 5-5-5-5", key: "1bji2h" }],
  ["path", { d: "M21 12H9", key: "dn1m92" }],
  ["path", { d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", key: "1uf3rs" }]
];
const LogOut = createLucideIcon("log-out", __iconNode);
const items = [{
  to: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
  exact: true
}, {
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
    switchAccount
  } = useDerivBalance();
  reactExports.useEffect(() => {
    if (!loading && !user) navigate({
      to: "/auth",
      search: {
        mode: "signin"
      }
    });
  }, [user, loading, navigate]);
  async function logout() {
    await supabase.auth.signOut();
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
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-h-dvh", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("aside", { className: "hidden w-60 shrink-0 flex-col border-r border-glass-border bg-sidebar/70 backdrop-blur-xl md:flex", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "flex h-16 items-center gap-2.5 border-b border-glass-border px-5", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-6 rotate-45 rounded-sm bg-primary" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-semibold tracking-tight", children: "ArkTrader" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "flex-1 space-y-1 p-3", children: items.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        const Icon = item.icon;
        return /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: item.to, className: `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/50"}`, children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-4" }),
          " ",
          item.label
        ] }, item.to);
      }) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "border-t border-glass-border p-3", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { onClick: logout, className: "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-4" }),
        " Sign out"
      ] }) })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex min-w-0 flex-1 flex-col", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-glass-border bg-background/60 px-4 backdrop-blur-xl md:px-8", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(CircleDot, { className: `size-3.5 ${account ? "text-success" : "text-muted-foreground"}` }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-muted-foreground", children: account ? /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-foreground", children: account.account_id }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "ml-2 rounded bg-foreground/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider", children: account.is_demo ? "Demo" : "Live" })
          ] }) : "No Deriv account connected" })
        ] }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center gap-3", children: account ? /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "flex items-center gap-2 rounded-lg border border-glass-border bg-foreground/[0.02] px-3 py-1.5 text-left transition hover:bg-foreground/[0.05]", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `size-2 rounded-full ${account.is_demo ? "bg-yellow-500" : "bg-emerald-500"}` }),
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
            accounts.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-4 text-muted-foreground" })
          ] }) }),
          accounts.length > 1 && /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuContent, { align: "end", className: "w-64", children: accounts.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuItem, { onClick: () => switchAccount(a.account_id), className: "flex items-center justify-between gap-2", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: `size-2 rounded-full ${a.is_demo ? "bg-yellow-500" : "bg-emerald-500"}` }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "leading-tight", children: [
                /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[10px] uppercase tracking-wider text-muted-foreground", children: [
                  a.is_demo ? "Demo" : "Real",
                  " ",
                  a.currency ?? "USD"
                ] }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "font-mono text-xs", children: a.account_id })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "font-mono text-xs tabular-nums", children: Number(a.balance ?? 0).toFixed(2) })
          ] }, a.account_id)) })
        ] }) : /* @__PURE__ */ jsxRuntimeExports.jsxs(Button, { onClick: connectDeriv, size: "sm", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "mr-1 size-4" }),
          " Connect Deriv"
        ] }) })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("main", { className: "flex-1 px-4 py-8 pb-24 md:px-8 md:pb-8", children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) }),
      /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "sticky bottom-0 z-20 grid grid-cols-5 border-t border-glass-border bg-background/80 backdrop-blur md:hidden", children: items.map((item) => {
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
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
