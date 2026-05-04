// Deriv WebSocket helper with auto-reconnect, keepalive ping, connection
// status notifications, and helpers for active_symbols / ticks_history /
// tick & candle subscriptions.
const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID || "133647";
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=EN`;

export const DERIV_APP_ID_VALUE = DERIV_APP_ID;

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

type Listener = (msg: any) => void;
type StatusListener = (s: ConnectionStatus) => void;

let socket: WebSocket | null = null;
let listeners = new Set<Listener>();
let statusListeners = new Set<StatusListener>();
let status: ConnectionStatus = "disconnected";
let reqId = 1;
let connecting: Promise<WebSocket> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
// Active subscriptions to replay after a reconnect.
type Sub = { send: Record<string, any>; key: string };
const activeSubs = new Map<string, Sub>();

function setStatus(s: ConnectionStatus) {
  if (status === s) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}

export function onStatus(fn: StatusListener) {
  statusListeners.add(fn);
  fn(status);
  return () => statusListeners.delete(fn);
}

export function getStatus() {
  return status;
}

function startKeepalive() {
  stopKeepalive();
  pingTimer = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ping: 1, req_id: reqId++ }));
      } catch {
        /* ignore */
      }
    }
  }, 30000);
}

function stopKeepalive() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function connect(): Promise<WebSocket> {
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
      // Replay subscriptions
      for (const sub of activeSubs.values()) {
        try {
          ws.send(JSON.stringify(sub.send));
        } catch {
          /* ignore */
        }
      }
      resolve(ws);
    };
    ws.onerror = () => {
      // Do not reject here: onclose will trigger reconnect cycle.
    };
    ws.onclose = () => {
      socket = null;
      connecting = null;
      stopKeepalive();
      setStatus("disconnected");
      // Schedule reconnect with backoff (cap 10s).
      const delay = Math.min(10000, 500 * Math.pow(2, reconnectAttempts));
      reconnectAttempts++;
      setTimeout(() => {
        if (activeSubs.size > 0 || statusListeners.size > 0) {
          setStatus("reconnecting");
          connect().catch(() => {});
        }
      }, delay);
      reject(new Error("WebSocket closed"));
    };
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        listeners.forEach((l) => l(data));
      } catch {
        /* ignore */
      }
    };
  });
  return connecting;
}

export function onMessage(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function send(payload: Record<string, any>): Promise<any> {
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
    }, 15000);
  });
}

export async function subscribeTicks(
  symbol: string,
  onTick: (price: number, time: number) => void,
) {
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

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export async function fetchCandles(
  symbol: string,
  granularity: number,
  count = 500,
): Promise<Candle[]> {
  const res = await send({
    ticks_history: symbol,
    style: "candles",
    granularity,
    count,
    end: "latest",
    adjust_start_time: 1,
  });
  const candles = res.candles ?? [];
  return candles.map((c: any) => ({
    time: Number(c.epoch),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

let symbolsCache: { symbol: string; display_name: string; market: string }[] | null = null;
export async function getActiveSymbols() {
  if (symbolsCache) return symbolsCache;
  const res = await send({ active_symbols: "brief", product_type: "basic" });
  symbolsCache = (res.active_symbols ?? []).map((s: any) => ({
    symbol: s.symbol,
    display_name: s.display_name,
    market: s.market,
  }));
  return symbolsCache!;
}

export function buildOAuthUrl() {
  return `https://oauth.deriv.com/oauth2/authorize?app_id=${DERIV_APP_ID}&l=EN&brand=deriv`;
}

export const SYNTHETIC_MARKETS = [
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
  { symbol: "RDBULL", name: "Bull Market Index" },
];

export type TradeCategory =
  | "rise_fall"
  | "higher_lower"
  | "touch_no_touch"
  | "even_odd"
  | "over_under"
  | "matches_differs"
  | "accumulator"
  | "multiplier";

export const TRADE_CATEGORIES: { value: TradeCategory; label: string; description: string }[] = [
  { value: "rise_fall", label: "Rise / Fall", description: "Predict if the market goes up or down." },
  { value: "higher_lower", label: "Higher / Lower", description: "Predict vs. a barrier price." },
  { value: "touch_no_touch", label: "Touch / No Touch", description: "Will the price touch a barrier?" },
  { value: "even_odd", label: "Even / Odd", description: "Last digit of the exit spot is even or odd." },
  { value: "over_under", label: "Over / Under", description: "Last digit over/under a chosen number." },
  { value: "matches_differs", label: "Matches / Differs", description: "Last digit matches your prediction." },
  { value: "accumulator", label: "Accumulators", description: "Compound profit while price stays in range." },
  { value: "multiplier", label: "Multipliers", description: "Amplify profit and loss with a multiplier." },
];

export function contractTypeFor(category: TradeCategory, side: string): string {
  const map: Record<string, string> = {
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
    "multiplier:down": "MULTDOWN",
  };
  return map[`${category}:${side}`] ?? "CALL";
}

export const SIDES_BY_CATEGORY: Record<TradeCategory, { value: string; label: string }[]> = {
  rise_fall: [
    { value: "up", label: "Rise" },
    { value: "down", label: "Fall" },
  ],
  higher_lower: [
    { value: "higher", label: "Higher" },
    { value: "lower", label: "Lower" },
  ],
  touch_no_touch: [
    { value: "touch", label: "Touch" },
    { value: "no_touch", label: "No Touch" },
  ],
  even_odd: [
    { value: "even", label: "Even" },
    { value: "odd", label: "Odd" },
  ],
  over_under: [
    { value: "over", label: "Over" },
    { value: "under", label: "Under" },
  ],
  matches_differs: [
    { value: "matches", label: "Matches" },
    { value: "differs", label: "Differs" },
  ],
  accumulator: [{ value: "buy", label: "Buy Accumulator" }],
  multiplier: [
    { value: "up", label: "Multiplier Up" },
    { value: "down", label: "Multiplier Down" },
  ],
};
