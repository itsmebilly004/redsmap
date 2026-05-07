import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { d as useNavigate, e as useRouterState, L as Link } from "../_libs/tanstack__react-router.mjs";
import { B as Button, c as cn } from "./button-Cz8PAkJh.mjs";
import { u as useAuth, d as useDerivBalance, e as buildOAuthUrl } from "./router-R6L_Ezj3.mjs";
import { R as Root2, T as Trigger, P as Portal2, C as Content2, I as Item2, S as Separator2, a as SubTrigger2, b as SubContent2, c as CheckboxItem2, d as ItemIndicator2, e as RadioItem2, L as Label2 } from "../_libs/radix-ui__react-dropdown-menu.mjs";
import { C as ChevronDown, _ as Plug, $ as LogOut, a0 as LogIn, B as Bot, h as ChartLine, a1 as ChartColumn, a2 as Cpu, a3 as Microscope, T as Target, a4 as Users, K as ChartCandlestick, S as Sparkles, y as ChevronRight, t as Check, a5 as Circle } from "../_libs/lucide-react.mjs";
const DropdownMenu = Root2;
const DropdownMenuTrigger = Trigger;
const DropdownMenuSubTrigger = reactExports.forwardRef(({ className, inset, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  SubTrigger2,
  {
    ref,
    className: cn(
      "flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    ),
    ...props,
    children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronRight, { className: "ml-auto" })
    ]
  }
));
DropdownMenuSubTrigger.displayName = SubTrigger2.displayName;
const DropdownMenuSubContent = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  SubContent2,
  {
    ref,
    className: cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
      className
    ),
    ...props
  }
));
DropdownMenuSubContent.displayName = SubContent2.displayName;
const DropdownMenuContent = reactExports.forwardRef(({ className, sideOffset = 4, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(Portal2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(
  Content2,
  {
    ref,
    sideOffset,
    className: cn(
      "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-(--radix-dropdown-menu-content-transform-origin)",
      className
    ),
    ...props
  }
) }));
DropdownMenuContent.displayName = Content2.displayName;
const DropdownMenuItem = reactExports.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Item2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    ),
    ...props
  }
));
DropdownMenuItem.displayName = Item2.displayName;
const DropdownMenuCheckboxItem = reactExports.forwardRef(({ className, children, checked, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  CheckboxItem2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    checked,
    ...props,
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicator2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Check, { className: "h-4 w-4" }) }) }),
      children
    ]
  }
));
DropdownMenuCheckboxItem.displayName = CheckboxItem2.displayName;
const DropdownMenuRadioItem = reactExports.forwardRef(({ className, children, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
  RadioItem2,
  {
    ref,
    className: cn(
      "relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    ),
    ...props,
    children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute left-2 flex h-3.5 w-3.5 items-center justify-center", children: /* @__PURE__ */ jsxRuntimeExports.jsx(ItemIndicator2, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Circle, { className: "h-2 w-2 fill-current" }) }) }),
      children
    ]
  }
));
DropdownMenuRadioItem.displayName = RadioItem2.displayName;
const DropdownMenuLabel = reactExports.forwardRef(({ className, inset, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Label2,
  {
    ref,
    className: cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className),
    ...props
  }
));
DropdownMenuLabel.displayName = Label2.displayName;
const DropdownMenuSeparator = reactExports.forwardRef(({ className, ...props }, ref) => /* @__PURE__ */ jsxRuntimeExports.jsx(
  Separator2,
  {
    ref,
    className: cn("-mx-1 my-1 h-px bg-muted", className),
    ...props
  }
));
DropdownMenuSeparator.displayName = Separator2.displayName;
const CURRENCY_FLAG = {
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  CHF: "🇨🇭",
  JPY: "🇯🇵",
  NZD: "🇳🇿",
  SGD: "🇸🇬",
  // tUSDT and crypto currencies get the US flag on real accounts
  tUSDT: "🇺🇸",
  BTC: "🇺🇸",
  ETH: "🇺🇸",
  LTC: "🇺🇸",
  USDC: "🇺🇸"
};
function getAccountFlag(isDemo, currency) {
  if (isDemo) return "🎮";
  return CURRENCY_FLAG[currency] ?? "🇺🇸";
}
const TOP_TABS = [
  { to: "/bot-builder", label: "Bot Builder", icon: Bot },
  { to: "/", label: "Manual Traders", icon: ChartLine },
  { to: "/charts", label: "Charts", icon: ChartColumn },
  { to: "/trading-bots", label: "Trading Bots", icon: Cpu },
  { to: "/analysis", label: "Analysis Tool", icon: Microscope },
  { to: "/strategies", label: "Strategies", icon: Target },
  { to: "/copy-trading", label: "Copy Trading", icon: Users },
  { to: "/tradingview", label: "TradingView", icon: ChartCandlestick }
];
function TopShell({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { account, accounts, balance, currency, switchAccount, logout } = useDerivBalance();
  async function handleLogout() {
    await logout();
    navigate({ to: "/" });
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "min-h-dvh bg-[oklch(0.985_0.003_240)] text-[oklch(0.2_0.02_260)]", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs("header", { className: "flex h-14 items-center justify-between gap-2 border-b border-[oklch(0.92_0.005_240)] bg-white px-3 md:px-6", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/", className: "flex shrink-0 items-center gap-2", children: [
        /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "size-5 rotate-45 rounded-sm bg-[oklch(0.72_0.17_55)] md:size-6" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden text-base font-bold tracking-tight text-[oklch(0.72_0.17_55)] sm:block md:text-lg", children: "ArkTrader Hub" }),
        /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base font-bold tracking-tight text-[oklch(0.72_0.17_55)] sm:hidden", children: "ArkTrader" })
      ] }),
      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-1.5 md:gap-2", children: [
        user && account && /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenu, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuTrigger, { asChild: true, children: /* @__PURE__ */ jsxRuntimeExports.jsxs("button", { className: "flex items-center gap-1.5 rounded-md border border-[oklch(0.92_0.005_240)] bg-white px-2 py-1.5 text-left transition hover:bg-[oklch(0.97_0.003_240)] md:gap-2 md:px-3", children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base leading-none", children: getAccountFlag(account.is_demo, currency) }),
            /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "leading-tight", children: [
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "hidden text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)] sm:block", children: [
                account.is_demo ? "Demo" : "Real",
                " ",
                currency
              ] }),
              /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "font-mono text-xs font-semibold tabular-nums sm:text-sm", children: [
                (balance ?? 0).toLocaleString(void 0, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }),
                " ",
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline", children: currency })
              ] })
            ] }),
            /* @__PURE__ */ jsxRuntimeExports.jsx(ChevronDown, { className: "size-3.5 text-[oklch(0.5_0.02_260)]" })
          ] }) }),
          /* @__PURE__ */ jsxRuntimeExports.jsxs(DropdownMenuContent, { align: "end", className: "w-64", children: [
            accounts.map((a) => /* @__PURE__ */ jsxRuntimeExports.jsxs(
              DropdownMenuItem,
              {
                onClick: () => switchAccount(a.account_id),
                className: "flex items-center justify-between gap-2",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-base", children: getAccountFlag(a.is_demo, a.currency) }),
                    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "leading-tight", children: [
                      /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "text-[9px] uppercase tracking-wider text-[oklch(0.5_0.02_260)]", children: [
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
                ]
              },
              a.account_id
            )),
            /* @__PURE__ */ jsxRuntimeExports.jsx(DropdownMenuSeparator, {}),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              DropdownMenuItem,
              {
                onClick: () => window.location.href = buildOAuthUrl(),
                className: "gap-2 text-[oklch(0.5_0.02_260)]",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "size-3.5" }),
                  "Add / reconnect account"
                ]
              }
            ),
            /* @__PURE__ */ jsxRuntimeExports.jsxs(
              DropdownMenuItem,
              {
                onClick: handleLogout,
                className: "gap-2 text-red-600 focus:text-red-600",
                children: [
                  /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-3.5" }),
                  "Disconnect & sign out"
                ]
              }
            )
          ] })
        ] }),
        user && !account && /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "flex items-center gap-2", children: [
          /* @__PURE__ */ jsxRuntimeExports.jsxs(
            Button,
            {
              onClick: () => window.location.href = buildOAuthUrl(),
              size: "sm",
              className: "h-8 rounded-md bg-[oklch(0.72_0.17_55)] px-2 text-xs text-white hover:bg-[oklch(0.65_0.17_55)] md:h-9 md:px-4 md:text-sm",
              children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(Plug, { className: "mr-1 size-3.5" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline", children: "Connect Deriv" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sm:hidden", children: "Connect" })
              ]
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              onClick: handleLogout,
              size: "sm",
              variant: "ghost",
              className: "h-8 rounded-md px-2 text-xs text-[oklch(0.5_0.02_260)] md:h-9 md:px-3",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(LogOut, { className: "size-3.5" })
            }
          )
        ] }),
        !user && /* @__PURE__ */ jsxRuntimeExports.jsxs(jsxRuntimeExports.Fragment, { children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              asChild: true,
              size: "sm",
              className: "h-8 rounded-md bg-[oklch(0.55_0.22_265)] px-2 text-xs font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)] md:h-9 md:px-5 md:text-sm",
              children: /* @__PURE__ */ jsxRuntimeExports.jsxs(Link, { to: "/auth", search: { mode: "signin" }, children: [
                /* @__PURE__ */ jsxRuntimeExports.jsx(LogIn, { className: "mr-1 size-3.5 sm:hidden" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "hidden sm:inline", children: "Log in" }),
                /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "sm:hidden", children: "Login" })
              ] })
            }
          ),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            Button,
            {
              asChild: true,
              size: "sm",
              className: "hidden h-9 rounded-md bg-[oklch(0.55_0.22_265)] px-5 text-sm font-medium text-white shadow-sm hover:bg-[oklch(0.5_0.22_265)] sm:flex",
              children: /* @__PURE__ */ jsxRuntimeExports.jsx(Link, { to: "/auth", search: { mode: "signup" }, children: "Sign up" })
            }
          )
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("nav", { className: "border-b border-[oklch(0.92_0.005_240)] bg-white", children: /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex items-center overflow-x-auto px-2 scrollbar-none", children: TOP_TABS.map((t) => {
      const active = t.to === "/" ? pathname === "/" : pathname.startsWith(t.to);
      const Icon = t.icon;
      return /* @__PURE__ */ jsxRuntimeExports.jsxs(
        Link,
        {
          to: t.to,
          className: [
            "flex shrink-0 items-center gap-1.5 px-3 py-3 text-xs font-medium transition-colors md:gap-2 md:px-4 md:text-sm",
            active ? "bg-[oklch(0.7_0.17_150)] text-white" : "text-[oklch(0.3_0.02_260)] hover:bg-[oklch(0.96_0.005_240)]"
          ].join(" "),
          children: [
            /* @__PURE__ */ jsxRuntimeExports.jsx(Icon, { className: "size-3.5 md:size-4" }),
            /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: active ? "uppercase tracking-wide" : "", children: t.label })
          ]
        },
        t.to
      );
    }) }) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("main", { children }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        "aria-label": "AI assistant",
        className: "fixed bottom-6 right-4 z-50 flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.55_0.22_300)] to-[oklch(0.4_0.2_280)] text-white shadow-[0_10px_30px_-5px_oklch(0.4_0.2_280_/_0.6)] transition-transform hover:scale-105 md:right-6 md:size-14",
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx(Sparkles, { className: "size-4 md:size-5" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-[oklch(0.7_0.17_150)] md:size-3" }),
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "absolute -bottom-1 text-[9px] font-bold md:text-[10px]", children: "AI" })
        ]
      }
    )
  ] });
}
function PageHero({
  title,
  subtitle,
  children
}) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold tracking-tight md:text-4xl", children: title }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 max-w-2xl text-sm text-[oklch(0.45_0.02_260)] md:text-base", children: subtitle }),
    children && /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6 md:mt-8", children })
  ] });
}
export {
  DropdownMenu as D,
  PageHero as P,
  TopShell as T,
  DropdownMenuTrigger as a,
  DropdownMenuContent as b,
  DropdownMenuItem as c
};
