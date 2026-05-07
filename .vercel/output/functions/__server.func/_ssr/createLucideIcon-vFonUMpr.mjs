import { K as reactExports } from "./index.mjs";
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
const mergeClasses = (...classes) => classes.filter((className, index, array) => {
  return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
const toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
const toCamelCase = (string) => string.replace(
  /^([A-Z])|[\s-_]+(\w)/g,
  (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase()
);
const toPascalCase = (string) => {
  const camelCase = toCamelCase(string);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
var defaultAttributes = {
  xmlns: "http://www.w3.org/2000/svg",
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};
const hasA11yProp = (props) => {
  for (const prop in props) {
    if (prop.startsWith("aria-") || prop === "role" || prop === "title") {
      return true;
    }
  }
  return false;
};
const Icon = reactExports.forwardRef(
  ({
    color = "currentColor",
    size = 24,
    strokeWidth = 2,
    absoluteStrokeWidth,
    className = "",
    children,
    iconNode,
    ...rest
  }, ref) => reactExports.createElement(
    "svg",
    {
      ref,
      ...defaultAttributes,
      width: size,
      height: size,
      stroke: color,
      strokeWidth: absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth,
      className: mergeClasses("lucide", className),
      ...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
      ...rest
    },
    [
      ...iconNode.map(([tag, attrs]) => reactExports.createElement(tag, attrs)),
      ...Array.isArray(children) ? children : [children]
    ]
  )
);
const createLucideIcon = (iconName, iconNode) => {
  const Component = reactExports.forwardRef(
    ({ className, ...props }, ref) => reactExports.createElement(Icon, {
      ref,
      iconNode,
      className: mergeClasses(
        `lucide-${toKebabCase(toPascalCase(iconName))}`,
        `lucide-${iconName}`,
        className
      ),
      ...props
    })
  );
  Component.displayName = toPascalCase(iconName);
  return Component;
};
export {
  SYNTHETIC_MARKETS as S,
  TRADE_CATEGORIES as T,
  contractTypeFor as a,
  buildOAuthUrl as b,
  createLucideIcon as c,
  subscribeTicks as d,
  SIDES_BY_CATEGORY as e,
  subscribeProposal as f,
  subscribeBalance as g,
  getActiveSymbols as h,
  fetchTicks as i,
  fetchCandles as j,
  onStatus as o,
  send as s
};
