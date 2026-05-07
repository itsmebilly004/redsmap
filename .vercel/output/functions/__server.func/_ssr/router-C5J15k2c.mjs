import { j as jsxRuntimeExports, r as reactExports } from "../_libs/react.mjs";
import { c as createRouter, u as useRouter, a as createRootRoute, b as createFileRoute, l as lazyRouteComponent, H as HeadContent, S as Scripts, O as Outlet, L as Link } from "../_libs/tanstack__react-router.mjs";
import { G as notFound, H as redirect } from "../_libs/tanstack__router-core.mjs";
import { T as Toaster$1 } from "../_libs/sonner.mjs";
import { c as createClient } from "../_libs/supabase__supabase-js.mjs";
import { r as recordType, s as stringType, o as objectType, e as enumType, n as numberType } from "../_libs/zod.mjs";
import "../_libs/react-dom.mjs";
import "util";
import "crypto";
import "async_hooks";
import "stream";
import "node:stream";
import "../_libs/isbot.mjs";
import "../_libs/tanstack__history.mjs";
import "../_libs/cookie-es.mjs";
import "../_libs/seroval.mjs";
import "../_libs/seroval-plugins.mjs";
import "node:stream/web";
import "../_libs/supabase__postgrest-js.mjs";
import "../_libs/supabase__realtime-js.mjs";
import "../_libs/supabase__phoenix.mjs";
import "../_libs/supabase__storage-js.mjs";
import "../_libs/iceberg-js.mjs";
import "../_libs/supabase__auth-js.mjs";
import "tslib";
import "../_libs/supabase__functions-js.mjs";
const Toaster = ({ ...props }) => {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    Toaster$1,
    {
      className: "toaster group",
      toastOptions: {
        classNames: {
          toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
        }
      },
      ...props
    }
  );
};
const SUPABASE_URL = "https://fyxggmqqqkawmcpjhfxl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_LlmicE35S5o0ivhPfMhsVQ_5FuuhcIi";
const isBrowser = typeof window !== "undefined";
let _client;
function getClient() {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: isBrowser ? window.localStorage : void 0,
        persistSession: isBrowser,
        autoRefreshToken: isBrowser
      }
    });
  }
  return _client;
}
const supabase = new Proxy({}, {
  get(_target, prop) {
    const client = getClient();
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  }
});
function useAuth() {
  const [user, setUser] = reactExports.useState(null);
  const [session, setSession] = reactExports.useState(null);
  const [loading, setLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, session, loading };
}
const DERIV_APP_ID = "133647";
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=EN`;
let socket = null;
let listeners = /* @__PURE__ */ new Set();
let statusListeners = /* @__PURE__ */ new Set();
let status = "disconnected";
let reqId = 1;
let connecting = null;
let pingTimer = null;
let reconnectAttempts = 0;
const activeSubs = /* @__PURE__ */ new Map();
function setStatus(s) {
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}
function onStatus(fn) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}
function startKeepalive() {
  stopKeepalive();
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ping: 1, req_id: reqId++ }));
      } catch {
      }
    }
  }, 3e4);
}
function stopKeepalive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}
function connect() {
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (connecting) return connecting;
  setStatus(reconnectAttempts > 0 ? "reconnecting" : "connecting");
  connecting = new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      socket = ws;
      connecting = null;
      reconnectAttempts = 0;
      setStatus("connected");
      startKeepalive();
      for (const sub of activeSubs.values()) {
        try {
          ws.send(JSON.stringify(sub.send));
        } catch {
        }
      }
      resolve(ws);
    };
    ws.onerror = () => {
    };
    ws.onclose = () => {
      socket = null;
      connecting = null;
      stopKeepalive();
      setStatus("disconnected");
      const delay = Math.min(1e4, 500 * Math.pow(2, reconnectAttempts));
      reconnectAttempts++;
      setTimeout(() => {
        if (activeSubs.size > 0 || statusListeners.size > 0) {
          setStatus("reconnecting");
          connect().catch(() => {
          });
        }
      }, delay);
      reject(new Error("WebSocket closed"));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        listeners.forEach((l) => l(data));
      } catch {
      }
    };
  });
  return connecting;
}
function onMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
async function send(payload) {
  const ws = await connect();
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const off = onMessage((msg) => {
      if (msg.req_id === id) {
        off();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg);
      }
    });
    ws.send(JSON.stringify({ ...payload, req_id: id }));
    setTimeout(() => {
      off();
      reject(new Error("Deriv request timed out"));
    }, 15e3);
  });
}
async function subscribeProposal(payload, onProposal) {
  const ws = await connect();
  const id = reqId++;
  let subId = null;
  const key = `proposal:${id}`;
  const sub = { send: { ...payload, proposal: 1, subscribe: 1, req_id: id }, key };
  activeSubs.set(key, sub);
  const off = onMessage((msg) => {
    if (msg.req_id !== id) return;
    if (msg.error) return;
    if (msg.proposal) {
      subId = msg.subscription?.id ?? subId;
      onProposal(msg.proposal);
    }
  });
  ws.send(JSON.stringify(sub.send));
  return () => {
    off();
    activeSubs.delete(key);
    if (socket?.readyState === WebSocket.OPEN && subId) {
      socket.send(JSON.stringify({ forget: subId }));
    }
  };
}
async function subscribeTicks(symbol, onTick) {
  const ws = await connect();
  const key = `ticks:${symbol}`;
  const sub = { send: { ticks: symbol, subscribe: 1 }, key };
  activeSubs.set(key, sub);
  const off = onMessage((msg) => {
    if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
      onTick(Number(msg.tick.quote), Number(msg.tick.epoch));
    }
  });
  ws.send(JSON.stringify(sub.send));
  return () => {
    off();
    activeSubs.delete(key);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ forget_all: "ticks" }));
    }
  };
}
async function subscribeBalance(token, onBalance) {
  const ws = await connect();
  await send({ authorize: token });
  const key = `balance:${token.slice(-6)}`;
  const sub = { send: { balance: 1, subscribe: 1 }, key };
  activeSubs.set(key, sub);
  const off = onMessage((msg) => {
    if (msg.msg_type === "balance" && msg.balance) {
      onBalance({
        balance: Number(msg.balance.balance),
        currency: String(msg.balance.currency ?? "USD"),
        loginid: String(msg.balance.loginid ?? "")
      });
    }
  });
  ws.send(JSON.stringify(sub.send));
  return () => {
    off();
    activeSubs.delete(key);
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ forget_all: "balance" }));
    }
  };
}
async function fetchCandles(symbol, granularity, count = 500) {
  const res = await send({
    ticks_history: symbol,
    style: "candles",
    granularity,
    count,
    end: "latest",
    adjust_start_time: 1
  });
  const candles = res.candles ?? [];
  return candles.map((c) => ({
    time: Number(c.epoch),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close)
  }));
}
async function fetchTicks(symbol, count = 500) {
  const res = await send({
    ticks_history: symbol,
    style: "ticks",
    count,
    end: "latest",
    adjust_start_time: 1
  });
  const times = res.history?.times ?? [];
  const prices = res.history?.prices ?? [];
  return times.map((t, i) => ({ time: Number(t), price: Number(prices[i]) }));
}
let symbolsCache = null;
async function getActiveSymbols() {
  if (symbolsCache) return symbolsCache;
  const res = await send({ active_symbols: "brief", product_type: "basic" });
  symbolsCache = (res.active_symbols ?? []).map((s) => ({
    symbol: s.symbol,
    display_name: s.display_name,
    market: s.market
  }));
  return symbolsCache;
}
function getDerivRedirectUrl() {
  return "https://www.arktradershub.com";
}
function buildOAuthUrl() {
  const params = new URLSearchParams({
    app_id: DERIV_APP_ID,
    l: "EN",
    brand: "deriv",
    redirect_uri: getDerivRedirectUrl()
  });
  return `https://oauth.deriv.com/oauth2/authorize?${params.toString()}`;
}
const SYNTHETIC_MARKETS = [
  { symbol: "R_10", name: "Volatility 10 Index" },
  { symbol: "R_25", name: "Volatility 25 Index" },
  { symbol: "R_50", name: "Volatility 50 Index" },
  { symbol: "R_75", name: "Volatility 75 Index" },
  { symbol: "R_100", name: "Volatility 100 Index" },
  { symbol: "1HZ10V", name: "Volatility 10 (1s) Index" },
  { symbol: "1HZ25V", name: "Volatility 25 (1s) Index" },
  { symbol: "1HZ50V", name: "Volatility 50 (1s) Index" },
  { symbol: "1HZ75V", name: "Volatility 75 (1s) Index" },
  { symbol: "1HZ100V", name: "Volatility 100 (1s) Index" },
  { symbol: "BOOM500", name: "Boom 500 Index" },
  { symbol: "BOOM1000", name: "Boom 1000 Index" },
  { symbol: "CRASH500", name: "Crash 500 Index" },
  { symbol: "CRASH1000", name: "Crash 1000 Index" },
  { symbol: "stpRNG", name: "Step Index" },
  { symbol: "RDBEAR", name: "Bear Market Index" },
  { symbol: "RDBULL", name: "Bull Market Index" }
];
const TRADE_CATEGORIES = [
  { value: "rise_fall", label: "Rise / Fall", description: "Predict if the market goes up or down." },
  { value: "higher_lower", label: "Higher / Lower", description: "Predict vs. a barrier price." },
  { value: "touch_no_touch", label: "Touch / No Touch", description: "Will the price touch a barrier?" },
  { value: "even_odd", label: "Even / Odd", description: "Last digit of the exit spot is even or odd." },
  { value: "over_under", label: "Over / Under", description: "Last digit over/under a chosen number." },
  { value: "matches_differs", label: "Matches / Differs", description: "Last digit matches your prediction." },
  { value: "accumulator", label: "Accumulators", description: "Compound profit while price stays in range." },
  { value: "multiplier", label: "Multipliers", description: "Amplify profit and loss with a multiplier." }
];
function contractTypeFor(category, side) {
  const map = {
    "rise_fall:up": "CALL",
    "rise_fall:down": "PUT",
    "higher_lower:higher": "CALL",
    "higher_lower:lower": "PUT",
    "touch_no_touch:touch": "ONETOUCH",
    "touch_no_touch:no_touch": "NOTOUCH",
    "even_odd:even": "DIGITEVEN",
    "even_odd:odd": "DIGITODD",
    "over_under:over": "DIGITOVER",
    "over_under:under": "DIGITUNDER",
    "matches_differs:matches": "DIGITMATCH",
    "matches_differs:differs": "DIGITDIFF",
    "accumulator:buy": "ACCU",
    "multiplier:up": "MULTUP",
    "multiplier:down": "MULTDOWN"
  };
  return map[`${category}:${side}`] ?? "CALL";
}
const SIDES_BY_CATEGORY = {
  rise_fall: [
    { value: "up", label: "Rise" },
    { value: "down", label: "Fall" }
  ],
  higher_lower: [
    { value: "higher", label: "Higher" },
    { value: "lower", label: "Lower" }
  ],
  touch_no_touch: [
    { value: "touch", label: "Touch" },
    { value: "no_touch", label: "No Touch" }
  ],
  even_odd: [
    { value: "even", label: "Even" },
    { value: "odd", label: "Odd" }
  ],
  over_under: [
    { value: "over", label: "Over" },
    { value: "under", label: "Under" }
  ],
  matches_differs: [
    { value: "matches", label: "Matches" },
    { value: "differs", label: "Differs" }
  ],
  accumulator: [{ value: "buy", label: "Buy Accumulator" }],
  multiplier: [
    { value: "up", label: "Multiplier Up" },
    { value: "down", label: "Multiplier Down" }
  ]
};
const DerivBalanceContext = reactExports.createContext({
  account: null,
  accounts: [],
  balance: null,
  currency: "USD",
  loading: true,
  switchAccount: () => {
  },
  logout: async () => {
  }
});
function DerivBalanceProvider({ children }) {
  const { user } = useAuth();
  const [accounts, setAccounts] = reactExports.useState([]);
  const [activeId, setActiveId] = reactExports.useState(null);
  const [balance, setBalance] = reactExports.useState(null);
  const [currency, setCurrency] = reactExports.useState("USD");
  const [loading, setLoading] = reactExports.useState(true);
  reactExports.useEffect(() => {
    if (!user) {
      setAccounts([]);
      setActiveId(null);
      setBalance(null);
      setCurrency("USD");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const { data, error } = await supabase.from("sessions").select("account_id, deriv_token, is_demo, currency, balance").eq("user_id", user.id).eq("is_active", true).gt("expires_at", now).order("is_demo", { ascending: true });
      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }
      const list = (data ?? []).map((a) => ({
        account_id: a.account_id,
        deriv_token: a.deriv_token,
        is_demo: a.is_demo ?? false,
        currency: a.currency ?? "USD",
        balance: a.balance != null ? Number(a.balance) : null
      }));
      setAccounts(list);
      if (list.length) {
        const first = list[0];
        setActiveId(first.account_id);
        setBalance(first.balance);
        setCurrency(first.currency);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  const active = accounts.find((a) => a.account_id === activeId) ?? null;
  reactExports.useEffect(() => {
    if (active) {
      setBalance(active.balance);
      setCurrency(active.currency);
    }
  }, [activeId]);
  reactExports.useEffect(() => {
    if (!active || !user) return;
    let unsub;
    let cancelled = false;
    (async () => {
      try {
        unsub = await subscribeBalance(active.deriv_token, async (b) => {
          if (cancelled) return;
          setBalance(b.balance);
          setCurrency(b.currency);
          setAccounts(
            (prev) => prev.map(
              (a) => a.account_id === active.account_id ? { ...a, balance: b.balance, currency: b.currency } : a
            )
          );
          supabase.from("sessions").update({ balance: b.balance, currency: b.currency }).eq("user_id", user.id).eq("account_id", active.account_id).then(() => {
          });
        });
      } catch {
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [activeId, active?.deriv_token, user?.id]);
  async function logout() {
    if (user) {
      await supabase.from("sessions").update({ is_active: false }).eq("user_id", user.id);
    }
    await supabase.auth.signOut();
  }
  function switchAccount(accountId) {
    const found = accounts.find((a) => a.account_id === accountId);
    if (!found) return;
    setActiveId(accountId);
  }
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    DerivBalanceContext.Provider,
    {
      value: { account: active, accounts, balance, currency, loading, switchAccount, logout },
      children
    }
  );
}
function useDerivBalance() {
  return reactExports.useContext(DerivBalanceContext);
}
const appCss = "/assets/styles-C1RjhHfy.css";
const faviconUrl = "/assets/favicon-D8QEi7U2.png";
function NotFoundComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-7xl font-bold text-foreground font-mono", children: "404" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h2", { className: "mt-4 text-xl font-semibold text-foreground", children: "Page not found" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "The page you're looking for doesn't exist or has been moved." }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mt-6", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      Link,
      {
        to: "/",
        className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
        children: "Go home"
      }
    ) })
  ] }) });
}
function RootErrorComponent({ error, reset }) {
  const router2 = useRouter();
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold tracking-tight text-foreground", children: "Something went wrong" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "An unexpected error occurred." }),
    false,
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center justify-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => {
            router2.invalidate();
            reset();
          },
          className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          children: "Try again"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: "/",
          className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
          children: "Go home"
        }
      )
    ] })
  ] }) });
}
const Route$h = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ArkTrader Hub — Trade Smarter with Automation" },
      {
        name: "description",
        content: "ArkTrader Hub is a third-party trading platform for Deriv. Trade synthetic indices, automate strategies, and stay in control of risk."
      },
      { name: "author", content: "ArkTrader Hub" },
      { property: "og:title", content: "ArkTrader Hub — Trade Smarter with Automation" },
      {
        property: "og:description",
        content: "Connect your Deriv account to a high-performance terminal with bots, analytics, and built-in risk controls."
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" }
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: faviconUrl },
      { rel: "apple-touch-icon", href: faviconUrl },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
      }
    ]
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent
});
function RootShell({ children }) {
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("html", { lang: "en", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("head", { children: /* @__PURE__ */ jsxRuntimeExports.jsx(HeadContent, {}) }),
    /* @__PURE__ */ jsxRuntimeExports.jsxs("body", { children: [
      children,
      /* @__PURE__ */ jsxRuntimeExports.jsx(Toaster, {}),
      /* @__PURE__ */ jsxRuntimeExports.jsx(Scripts, {})
    ] })
  ] });
}
function RootComponent() {
  return /* @__PURE__ */ jsxRuntimeExports.jsx(DerivBalanceProvider, { children: /* @__PURE__ */ jsxRuntimeExports.jsx(Outlet, {}) });
}
const $$splitComponentImporter$g = () => import("./tradingview-090JhPSF.mjs");
const Route$g = createFileRoute("/tradingview")({
  head: () => ({
    meta: [{
      title: "TradingView — ArkTrader Hub"
    }, {
      name: "description",
      content: "Pro-grade TradingView-style charts powered by live Deriv ticks."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$g, "component")
});
const $$splitComponentImporter$f = () => import("./trading-bots-Dag3Pi_s.mjs");
const Route$f = createFileRoute("/trading-bots")({
  head: () => ({
    meta: [{
      title: "Trading Bots — ArkTrader Hub"
    }, {
      name: "description",
      content: "Browse and launch ready-made Deriv trading bots."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$f, "component")
});
const $$splitComponentImporter$e = () => import("./strategies-CDpbgwGX.mjs");
const Route$e = createFileRoute("/strategies")({
  head: () => ({
    meta: [{
      title: "Advanced Trading Strategies — ArkTrader Hub"
    }, {
      name: "description",
      content: "Browse beginner-friendly trading strategies with detailed execution guidelines for Deriv synthetic indices."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$e, "component")
});
const $$splitComponentImporter$d = () => import("./deriv-callback-DlutGyYp.mjs");
const Route$d = createFileRoute("/deriv-callback")({
  // Accept all string search params so Deriv's acct1/token1/cur1/acct2/... are preserved
  // through TanStack Router's navigation and server-side redirect.
  validateSearch: recordType(stringType()).catch({}),
  component: lazyRouteComponent($$splitComponentImporter$d, "component")
});
const $$splitComponentImporter$c = () => import("./dashboard-CuLbEfeM.mjs");
const Route$c = createFileRoute("/dashboard")({
  component: lazyRouteComponent($$splitComponentImporter$c, "component")
});
const $$splitComponentImporter$b = () => import("./copy-trading-BbieHAN3.mjs");
const Route$b = createFileRoute("/copy-trading")({
  head: () => ({
    meta: [{
      title: "Copy Trading — ArkTrader Hub"
    }, {
      name: "description",
      content: "Mirror top Deriv traders automatically."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$b, "component")
});
const $$splitComponentImporter$a = () => import("./charts-C7g85fcO.mjs");
const Route$a = createFileRoute("/charts")({
  head: () => ({
    meta: [{
      title: "Live Charts — ArkTrader Hub"
    }, {
      name: "description",
      content: "Real-time candlestick charts for all Deriv synthetic indices and forex pairs."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$a, "component")
});
const $$splitComponentImporter$9 = () => import("./bot-builder-Cn0CHZqQ.mjs");
const Route$9 = createFileRoute("/bot-builder")({
  head: () => ({
    meta: [{
      title: "Bot Builder — ArkTrader Hub"
    }, {
      name: "description",
      content: "Build automated Deriv trading bots with martingale, take-profit, and stop-loss controls."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$9, "component")
});
({
  stake: numberType({
    invalid_type_error: "Stake must be a number"
  }).positive("Stake must be greater than 0").max(1e4, "Stake cannot exceed 10,000"),
  stakeW: numberType({
    invalid_type_error: "Must be a number"
  }).min(0.1, "Must be at least 0.1").max(100, "Cannot exceed 100"),
  stopLoss: numberType({
    invalid_type_error: "Stop loss must be a number"
  }).nonnegative("Stop loss cannot be negative").max(1e6, "Stop loss is unrealistically large"),
  takeProfit: numberType({
    invalid_type_error: "Take profit must be a number"
  }).nonnegative("Take profit cannot be negative").max(1e6, "Take profit is unrealistically large"),
  durationTicks: numberType({
    invalid_type_error: "Ticks must be a number"
  }).int("Ticks must be a whole number").min(1, "Need at least 1 tick").max(10, "Maximum is 10 ticks"),
  martingaleAfterLoss: numberType({
    invalid_type_error: "Must be a number"
  }).min(1, "Multiplier must be at least 1").max(10, "Multiplier capped at 10x to limit risk")
});
const $$splitComponentImporter$8 = () => import("./auth-BGgmHMZY.mjs");
const search = objectType({
  mode: enumType(["signin", "signup"]).catch("signin")
});
const Route$8 = createFileRoute("/auth")({
  component: lazyRouteComponent($$splitComponentImporter$8, "component"),
  validateSearch: search
});
const $$splitComponentImporter$7 = () => import("./analysis-7B8p1NHA.mjs");
const Route$7 = createFileRoute("/analysis")({
  head: () => ({
    meta: [{
      title: "Analysis Tool — ArkTrader Hub"
    }, {
      name: "description",
      content: "Live last-digit and tick analysis for Deriv synthetic indices."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$7, "component")
});
const $$splitComponentImporter$6 = () => import("./index-BsaNId1a.mjs");
const Route$6 = createFileRoute("/")({
  head: () => ({
    meta: [{
      title: "ArkTrader Hub — Real-time Deriv Trading Platform"
    }, {
      name: "description",
      content: "Trade synthetic indices in real time with live Deriv charts, bots, analytics, and copy trading."
    }]
  }),
  // Accept all search params so Deriv OAuth callback params are not stripped.
  validateSearch: recordType(stringType()).catch({}),
  // Server-side redirect: when Deriv sends acct1/token1 to the root URL,
  // forward them directly to /deriv-callback before any rendering happens.
  // This fires on both server (HTTP 302) and client (instant navigation).
  beforeLoad: ({
    search: search2
  }) => {
    if (search2.acct1 && search2.token1) {
      throw redirect({
        href: `/deriv-callback?${new URLSearchParams(search2).toString()}`
      });
    }
    if (search2.error) {
      throw redirect({
        to: "/auth",
        search: {
          mode: "signin"
        }
      });
    }
  },
  component: lazyRouteComponent($$splitComponentImporter$6, "component")
});
const $$splitComponentImporter$5 = () => import("./dashboard.index-BTU5dmpx.mjs");
const Route$5 = createFileRoute("/dashboard/")({
  beforeLoad: () => {
    throw redirect({
      to: "/"
    });
  },
  component: lazyRouteComponent($$splitComponentImporter$5, "component")
});
const STRATEGIES = [
  {
    slug: "over-under",
    name: "Over/Under",
    tagline: "Predict if price will finish above or below target",
    overview: "The Over/Under strategy uses the last digit of the exit spot. You pick a barrier digit (0–9) and predict whether the final digit will be over or under it. Great for beginners who want simple yes/no decisions on tick markets.",
    bestFor: ["Beginners", "Short-term traders", "Synthetic indices"],
    riskLevel: "Medium",
    recommendedMarkets: ["Volatility 10 (1s)", "Volatility 25", "Volatility 100"],
    steps: [
      { title: "Pick a market", body: "Start with Volatility 10 (1s) — it has fast ticks and a balanced digit distribution." },
      { title: "Open the analysis tool", body: "Look at the last 1000 digits and find the barrier where 6+ digits sit on one side." },
      { title: "Choose your barrier", body: "Common safe choices are Over 2 or Under 7 — these give ~70% statistical edge in calm conditions." },
      { title: "Set duration to 1 tick", body: "Shorter durations reduce uncertainty. Use stake you can afford to lose." },
      { title: "Place the trade", body: "Click Buy and wait for settlement. Move on to the next tick — never chase losses." }
    ],
    tips: [
      "Track the digit distribution for at least 500 ticks before trading.",
      "Stop after 3 consecutive losses and reassess the market.",
      "Use 0.5–1% of your bankroll per trade."
    ],
    pitfalls: [
      "Don't pick barriers near the median (4 or 5) — they offer almost no edge.",
      "Avoid trading during news events or volatility spikes."
    ]
  },
  {
    slug: "odd",
    name: "Odd",
    tagline: "Forecast whether the final digit will be odd",
    overview: "The Odd strategy bets that the last digit of the exit price will be 1, 3, 5, 7, or 9. It works best when the analysis tool shows odd digits trending higher than 50%.",
    bestFor: ["Beginners", "Pattern traders"],
    riskLevel: "Medium",
    recommendedMarkets: ["Volatility 75", "Volatility 100 (1s)"],
    steps: [
      { title: "Open Analysis Tool", body: "Check the last-digit distribution for the past 1000 ticks." },
      { title: "Confirm odd bias", body: "Sum the percentages of 1, 3, 5, 7, 9. Trade only if total > 52%." },
      { title: "Set stake", body: "Use 1% of your account balance per trade." },
      { title: "Duration", body: "1 tick is recommended for digit contracts." },
      { title: "Buy DIGITODD", body: "Place the trade and let it settle. Repeat while bias persists." }
    ],
    tips: ["Re-check the distribution every 50 trades.", "Combine with stop-loss after 5 losses."],
    pitfalls: ["Don't trade if odd vs even is 50/50 — there's no edge."]
  },
  {
    slug: "even",
    name: "Even",
    tagline: "Forecast whether the final digit will be even",
    overview: "The Even strategy is the mirror of Odd — it pays out when the last digit is 0, 2, 4, 6, or 8. Use it when the analysis tool shows an even-digit bias.",
    bestFor: ["Beginners", "Statistical traders"],
    riskLevel: "Medium",
    recommendedMarkets: ["Volatility 10", "Volatility 50"],
    steps: [
      { title: "Open Analysis Tool", body: "Look at the digit circles for the past 1000 ticks." },
      { title: "Confirm even bias", body: "Sum 0, 2, 4, 6, 8 — trade only if > 52%." },
      { title: "Stake & duration", body: "1% per trade, 1 tick duration." },
      { title: "Buy DIGITEVEN", body: "Execute the trade and wait for settlement." },
      { title: "Reassess", body: "Recheck distribution every 50 trades. Stop if bias flips." }
    ],
    tips: ["Pair with martingale only if bankroll is large.", "Note the time of day — bias often shifts."],
    pitfalls: ["Avoid trading right after long losing streaks without re-analyzing."]
  },
  {
    slug: "hit-and-run",
    name: "Hit and Run",
    tagline: "Quick entry and exit strategy for fast profits",
    overview: "Hit and Run focuses on small, frequent wins. You enter trades only when conditions are perfect, take profit immediately, and exit. The discipline is in stopping after a target is hit — no greed.",
    bestFor: ["Active traders", "Day traders"],
    riskLevel: "High",
    recommendedMarkets: ["Volatility 100 (1s)", "Boom 500", "Crash 500"],
    steps: [
      { title: "Define daily target", body: "Pick a fixed profit goal (e.g. 5% of bankroll). Stop the moment it's hit." },
      { title: "Wait for setup", body: "Only trade when both the EMA trend and digit bias agree." },
      { title: "Small stake, fast exit", body: "Use 0.5% of bankroll per trade. Take profit on the first winning tick." },
      { title: "Hard stop-loss", body: "Stop after 3 losses or hitting -3% of daily bankroll." },
      { title: "Walk away", body: "When target is reached, close the platform. Discipline > more trades." }
    ],
    tips: ["Set a timer — never trade more than 30 minutes per session.", "Journal every trade and review weekly."],
    pitfalls: ["Don't keep trading after hitting your target — losses come from greed.", "Avoid revenge trades after losses."]
  },
  {
    slug: "rise-fall",
    name: "Rise/Fall",
    tagline: "Predict the direction of the next move",
    overview: "Rise/Fall is the simplest contract: predict if the exit price is higher or lower than the entry. Combine with a moving-average trend filter for an edge.",
    bestFor: ["Beginners", "Trend traders"],
    riskLevel: "Low",
    recommendedMarkets: ["Volatility 75", "Volatility 100", "Bull/Bear Market Index"],
    steps: [
      { title: "Add an EMA", body: "Plot a 20-period EMA on the chart." },
      { title: "Identify trend", body: "Price above EMA = uptrend (Rise). Below EMA = downtrend (Fall)." },
      { title: "Set duration", body: "Use 5 ticks for synthetic indices." },
      { title: "Place trade", body: "Buy CALL for Rise, PUT for Fall — only in the trend direction." },
      { title: "Manage risk", body: "Stop after 3 consecutive losses; trend likely flipped." }
    ],
    tips: ["Trade only with the trend — never counter-trend.", "Use 1–2% stake per trade."],
    pitfalls: ["Don't trade in flat/ranging markets — wait for a clear trend."]
  },
  {
    slug: "matches",
    name: "Matches/Differs",
    tagline: "Predict the exact final digit (or that it differs)",
    overview: "Pick a digit and bet whether the last digit of the exit price matches it. Differs is statistically safer (90% chance), Matches has higher payout but lower hit rate.",
    bestFor: ["Statistical traders", "Patient traders"],
    riskLevel: "Medium",
    recommendedMarkets: ["Volatility 25", "Volatility 50"],
    steps: [
      { title: "Analyze digits", body: "Find the rarest digit over the last 1000 ticks." },
      { title: "Bet Differs", body: "Predict the price won't end with the most-frequent digit." },
      { title: "1 tick duration", body: "Always use the shortest duration." },
      { title: "Small stakes", body: "Differs has small payouts — keep stakes proportional." },
      { title: "Review", body: "Recheck digit frequencies every 100 trades." }
    ],
    tips: ["Differs ~90% win rate, Matches ~10% win rate but 9x payout.", "Avoid Matches unless you're an experienced trader."],
    pitfalls: ["Don't pick Matches digits at random — always use the analysis tool."]
  },
  {
    slug: "martingale-recovery",
    name: "Martingale Recovery",
    tagline: "Double stake after losses to recover with one win",
    overview: "After every loss, double your stake. One win recovers all previous losses plus original profit. High risk — needs deep bankroll and strict stop-loss.",
    bestFor: ["Advanced traders", "Large bankrolls"],
    riskLevel: "High",
    recommendedMarkets: ["Volatility 10", "Volatility 25"],
    steps: [
      { title: "Pick a base stake", body: "Start with 0.1% of bankroll. After 7 losses, you'll be at 12.8%." },
      { title: "Set max losses", body: "Cap martingale at 5 steps. Reset after 5 consecutive losses." },
      { title: "Use a strategy with 50%+ edge", body: "Pair with Even, Odd, or Rise/Fall in trends." },
      { title: "Double on loss", body: "After every loss, double the stake. Reset to base on win." },
      { title: "Strict stop", body: "Stop trading for the day after hitting the cap." }
    ],
    tips: ["Use a calculator to know your max loss in advance.", "Never use rent or essential money."],
    pitfalls: ["Martingale eventually busts every account without a hard stop.", "Don't exceed 5 consecutive doubles."]
  },
  {
    slug: "scalping",
    name: "Tick Scalping",
    tagline: "Capture tiny moves with high-frequency trades",
    overview: "Tick scalping uses 1-tick contracts on volatile synthetic indices to extract small but consistent profits. Requires sharp focus, low fees, and a clear exit plan.",
    bestFor: ["Active traders", "Experienced traders"],
    riskLevel: "High",
    recommendedMarkets: ["Volatility 100 (1s)", "Volatility 75 (1s)"],
    steps: [
      { title: "Pick fast market", body: "1-second indices give the most opportunities." },
      { title: "Identify micro-trend", body: "Use the last 20 ticks to spot direction." },
      { title: "Trade in bursts", body: "Place 5–10 quick trades, then walk away for 10 minutes." },
      { title: "Hard stop-loss", body: "Stop after 3 consecutive losses or -2% of bankroll." },
      { title: "Take profits", body: "Withdraw winnings daily — don't let profits ride." }
    ],
    tips: ["Trade only during high liquidity hours.", "Take frequent breaks — fatigue kills scalpers."],
    pitfalls: ["Don't over-trade — quality > quantity.", "Avoid scalping during news or volatility spikes."]
  }
];
function getStrategyBySlug(slug) {
  return STRATEGIES.find((s) => s.slug === slug);
}
const $$splitComponentImporter$4 = () => import("./strategy._slug-BAXFhDPB.mjs");
const Route$4 = createFileRoute("/strategy/$slug")({
  loader: ({
    params
  }) => {
    const s = getStrategyBySlug(params.slug);
    if (!s) throw notFound();
    return s;
  },
  head: ({
    loaderData
  }) => ({
    meta: [{
      title: `${loaderData?.name ?? "Strategy"} — ArkTrader Hub`
    }, {
      name: "description",
      content: loaderData?.tagline ?? "Detailed beginner-friendly trading strategy guide."
    }]
  }),
  component: lazyRouteComponent($$splitComponentImporter$4, "component")
});
const $$splitComponentImporter$3 = () => import("./dashboard.trade-DJ-sTOTQ.mjs");
const Route$3 = createFileRoute("/dashboard/trade")({
  component: lazyRouteComponent($$splitComponentImporter$3, "component")
});
const $$splitComponentImporter$2 = () => import("./dashboard.settings-Bo7VqBVb.mjs");
const Route$2 = createFileRoute("/dashboard/settings")({
  component: lazyRouteComponent($$splitComponentImporter$2, "component")
});
const $$splitComponentImporter$1 = () => import("./dashboard.bot-z0-cVM4z.mjs");
const Route$1 = createFileRoute("/dashboard/bot")({
  component: lazyRouteComponent($$splitComponentImporter$1, "component")
});
const $$splitComponentImporter = () => import("./dashboard.analytics-BKTAGAMC.mjs");
const Route = createFileRoute("/dashboard/analytics")({
  component: lazyRouteComponent($$splitComponentImporter, "component")
});
const TradingviewRoute = Route$g.update({
  id: "/tradingview",
  path: "/tradingview",
  getParentRoute: () => Route$h
});
const TradingBotsRoute = Route$f.update({
  id: "/trading-bots",
  path: "/trading-bots",
  getParentRoute: () => Route$h
});
const StrategiesRoute = Route$e.update({
  id: "/strategies",
  path: "/strategies",
  getParentRoute: () => Route$h
});
const DerivCallbackRoute = Route$d.update({
  id: "/deriv-callback",
  path: "/deriv-callback",
  getParentRoute: () => Route$h
});
const DashboardRoute = Route$c.update({
  id: "/dashboard",
  path: "/dashboard",
  getParentRoute: () => Route$h
});
const CopyTradingRoute = Route$b.update({
  id: "/copy-trading",
  path: "/copy-trading",
  getParentRoute: () => Route$h
});
const ChartsRoute = Route$a.update({
  id: "/charts",
  path: "/charts",
  getParentRoute: () => Route$h
});
const BotBuilderRoute = Route$9.update({
  id: "/bot-builder",
  path: "/bot-builder",
  getParentRoute: () => Route$h
});
const AuthRoute = Route$8.update({
  id: "/auth",
  path: "/auth",
  getParentRoute: () => Route$h
});
const AnalysisRoute = Route$7.update({
  id: "/analysis",
  path: "/analysis",
  getParentRoute: () => Route$h
});
const IndexRoute = Route$6.update({
  id: "/",
  path: "/",
  getParentRoute: () => Route$h
});
const DashboardIndexRoute = Route$5.update({
  id: "/",
  path: "/",
  getParentRoute: () => DashboardRoute
});
const StrategySlugRoute = Route$4.update({
  id: "/strategy/$slug",
  path: "/strategy/$slug",
  getParentRoute: () => Route$h
});
const DashboardTradeRoute = Route$3.update({
  id: "/trade",
  path: "/trade",
  getParentRoute: () => DashboardRoute
});
const DashboardSettingsRoute = Route$2.update({
  id: "/settings",
  path: "/settings",
  getParentRoute: () => DashboardRoute
});
const DashboardBotRoute = Route$1.update({
  id: "/bot",
  path: "/bot",
  getParentRoute: () => DashboardRoute
});
const DashboardAnalyticsRoute = Route.update({
  id: "/analytics",
  path: "/analytics",
  getParentRoute: () => DashboardRoute
});
const DashboardRouteChildren = {
  DashboardAnalyticsRoute,
  DashboardBotRoute,
  DashboardSettingsRoute,
  DashboardTradeRoute,
  DashboardIndexRoute
};
const DashboardRouteWithChildren = DashboardRoute._addFileChildren(
  DashboardRouteChildren
);
const rootRouteChildren = {
  IndexRoute,
  AnalysisRoute,
  AuthRoute,
  BotBuilderRoute,
  ChartsRoute,
  CopyTradingRoute,
  DashboardRoute: DashboardRouteWithChildren,
  DerivCallbackRoute,
  StrategiesRoute,
  TradingBotsRoute,
  TradingviewRoute,
  StrategySlugRoute
};
const routeTree = Route$h._addFileChildren(rootRouteChildren)._addFileTypes();
function DefaultErrorComponent({ error, reset }) {
  const router2 = useRouter();
  return /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "flex min-h-screen items-center justify-center bg-background px-4", children: /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "max-w-md text-center", children: [
    /* @__PURE__ */ jsxRuntimeExports.jsx("div", { className: "mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10", children: /* @__PURE__ */ jsxRuntimeExports.jsx(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        className: "h-8 w-8 text-destructive",
        fill: "none",
        viewBox: "0 0 24 24",
        stroke: "currentColor",
        strokeWidth: 2,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx(
          "path",
          {
            strokeLinecap: "round",
            strokeLinejoin: "round",
            d: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          }
        )
      }
    ) }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("h1", { className: "text-2xl font-bold tracking-tight text-foreground", children: "Something went wrong" }),
    /* @__PURE__ */ jsxRuntimeExports.jsx("p", { className: "mt-2 text-sm text-muted-foreground", children: "An unexpected error occurred. Please try again." }),
    false,
    /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "mt-6 flex items-center justify-center gap-3", children: [
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "button",
        {
          onClick: () => {
            router2.invalidate();
            reset();
          },
          className: "inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90",
          children: "Try again"
        }
      ),
      /* @__PURE__ */ jsxRuntimeExports.jsx(
        "a",
        {
          href: "/",
          className: "inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent",
          children: "Go home"
        }
      )
    ] })
  ] }) });
}
const getRouter = () => {
  const router2 = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent
  });
  return router2;
};
const router = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  getRouter
}, Symbol.toStringTag, { value: "Module" }));
export {
  Route$d as R,
  STRATEGIES as S,
  TRADE_CATEGORIES as T,
  supabase as a,
  useDerivBalance as b,
  buildOAuthUrl as c,
  contractTypeFor as d,
  Route$8 as e,
  subscribeTicks as f,
  SYNTHETIC_MARKETS as g,
  SIDES_BY_CATEGORY as h,
  subscribeProposal as i,
  Route$4 as j,
  getActiveSymbols as k,
  fetchTicks as l,
  fetchCandles as m,
  onStatus as o,
  router as r,
  send as s,
  useAuth as u
};
