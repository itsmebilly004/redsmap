// src/lib/deriv.ts

const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID;
const DERIV_CLIENT_ID = import.meta.env.VITE_DERIV_CLIENT_ID ?? DERIV_APP_ID;
const DERIV_REDIRECT_URI =
  import.meta.env.VITE_DERIV_REDIRECT_URI ?? "https://www.arktradershub.com/deriv-callback";
const PUBLIC_WS_URL = "wss://ws.derivws.com/websockets/v3?app_id=1089";

export const DERIV_APP_ID_VALUE = DERIV_APP_ID;
export const DERIV_CLIENT_ID_VALUE = DERIV_CLIENT_ID;
export const DERIV_REDIRECT_URI_VALUE = DERIV_REDIRECT_URI;

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

type DerivRecord = Record<string, unknown>;
type DerivError = { message?: string };
type DerivMessage = DerivRecord & {
  req_id?: number;
  msg_type?: string;
  error?: DerivError;
  tick?: { symbol?: string; quote?: string | number; epoch?: string | number };
  balance?: {
    balance?: string | number;
    currency?: string;
    loginid?: string;
  };
  proposal?: DerivRecord;
  buy?: DerivRecord;
  sell?: DerivRecord;
  proposal_open_contract?: DerivRecord & { is_sold?: boolean };
  candles?: Array<{
    epoch?: string | number;
    open?: string | number;
    high?: string | number;
    low?: string | number;
    close?: string | number;
  }>;
  history?: {
    prices?: Array<string | number>;
    times?: Array<string | number>;
  };
  active_symbols?: Array<{
    symbol?: string;
    display_name?: string;
    market?: string;
  }>;
};
export type DerivBalance = { balance: number; currency: string; loginid: string };
export type ActiveSymbol = { symbol: string; display_name: string; market: string };

type Listener = (msg: DerivMessage) => void;
type StatusListener = (s: ConnectionStatus) => void;

// Singleton state
let socket: WebSocket | null = null;
const listeners = new Set<Listener>();
const statusListeners = new Set<StatusListener>();
let status: ConnectionStatus = "disconnected";
let reqId = 1;
let connecting: Promise<WebSocket> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let wsUrl: string | null = null;

const isBrowser = typeof window !== "undefined";

// Active subscriptions to replay after a reconnect.
type Sub = { send: DerivRecord; key: string };
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

export function setWsUrl(url: string) {
  if (wsUrl === url) return;
  wsUrl = url;
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
  }
  connecting = null;
}

function startKeepalive() {
  stopKeepalive();
  if (!isBrowser) return;
  pingTimer = setInterval(() => {
    if (socket?.readyState === 1) {
      // 1 = OPEN
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
  if (!isBrowser) {
    return new Promise((_, reject) => reject(new Error("WebSocket unavailable on server")));
  }
  if (!wsUrl) {
    return Promise.reject(new Error("Authenticated Deriv WebSocket URL has not been set."));
  }
  const authenticatedWsUrl = wsUrl;
  if (socket && socket.readyState === 1) return Promise.resolve(socket);
  if (connecting) return connecting;

  setStatus(reconnectAttempts > 0 ? "reconnecting" : "connecting");
  connecting = new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(authenticatedWsUrl);
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
            /* ignore */
          }
        }
        resolve(ws);
      };
      ws.onclose = () => {
        socket = null;
        connecting = null;
        stopKeepalive();
        setStatus("disconnected");
        const delay = Math.min(10000, 500 * Math.pow(2, reconnectAttempts));
        reconnectAttempts++;
        setTimeout(() => {
          if (activeSubs.size > 0 || statusListeners.size > 0) connect().catch(() => {});
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
      ws.onerror = () => {};
    } catch (e) {
      reject(e);
    }
  });
  return connecting;
}

export function onMessage(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function send(payload: DerivRecord): Promise<DerivMessage> {
  if (!isBrowser) return {};
  const ws = await connect();
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      off();
      reject(new Error("Deriv request timed out"));
    }, 15000);
    const off = onMessage((msg) => {
      if (msg.req_id === id) {
        clearTimeout(timeoutId);
        off();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg);
      }
    });
    ws.send(JSON.stringify({ ...payload, req_id: id }));
  });
}

export async function subscribeTicks(
  symbol: string,
  onTick: (price: number, time: number) => void,
) {
  if (!isBrowser) return () => {};
  const ws = await connectPublic();
  const sub = { send: { ticks: symbol, subscribe: 1 } };
  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
        onTick(Number(msg.tick.quote), Number(msg.tick.epoch));
      }
    } catch {
      /* ignore */
    }
  };
  ws.send(JSON.stringify(sub.send));
  return () => {
    try {
      if (ws.readyState === 1) ws.send(JSON.stringify({ forget_all: "ticks" }));
      ws.close();
    } catch {
      /* ignore */
    }
  };
}

export async function subscribeBalance(token: string, onBalance: (b: DerivBalance) => void) {
  if (!isBrowser) return () => {};
  await connect();
  const key = `balance:${token.slice(-6)}`;
  const sub = { send: { balance: 1, subscribe: 1 }, key };
  activeSubs.set(key, sub);
  const off = onMessage((msg) => {
    if (msg.msg_type === "balance" && msg.balance) {
      onBalance({
        balance: Number(msg.balance.balance),
        currency: String(msg.balance.currency ?? ""),
        loginid: String(msg.balance.loginid ?? ""),
      });
    }
  });
  if (socket?.readyState === 1) socket.send(JSON.stringify(sub.send));
  return () => {
    off();
    activeSubs.delete(key);
    if (socket?.readyState === 1) socket.send(JSON.stringify({ forget_all: "balance" }));
  };
}

export type Candle = { time: number; open: number; high: number; low: number; close: number };
export type TickPoint = { time: number; value: number };

export async function fetchCandles(
  symbol: string,
  granularity: number,
  count = 500,
): Promise<Candle[]> {
  if (!isBrowser) return [];
  const res = await publicSend({
    ticks_history: symbol,
    style: "candles",
    granularity,
    count,
    end: "latest",
    adjust_start_time: 1,
  });
  return (res?.candles ?? []).map((c) => ({
    time: Number(c.epoch),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
  }));
}

export async function fetchTicks(symbol: string, count = 500): Promise<TickPoint[]> {
  if (!isBrowser) return [];
  const res = await publicSend({
    ticks_history: symbol,
    style: "ticks",
    count,
    end: "latest",
    adjust_start_time: 1,
  });
  const prices = res?.history?.prices ?? [];
  const times = res?.history?.times ?? [];
  return prices
    .map((price, index: number) => ({
      time: Number(times[index]),
      value: Number(price),
    }))
    .filter((point: TickPoint) => Number.isFinite(point.time) && Number.isFinite(point.value));
}

export async function getActiveSymbols(): Promise<ActiveSymbol[]> {
  if (!isBrowser) return [];
  if (symbolsCache) return symbolsCache;
  const res = await publicSend({ active_symbols: "brief", product_type: "basic" });
  symbolsCache = (res?.active_symbols ?? []).map((s) => ({
    symbol: String(s.symbol ?? ""),
    display_name: String(s.display_name ?? ""),
    market: String(s.market ?? ""),
  }));
  return symbolsCache!;
}

let symbolsCache: ActiveSymbol[] | null = null;

export function disconnectAll(): void {
  if (!isBrowser) return;
  activeSubs.clear();
  stopKeepalive();
  if (socket) {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
    socket = null;
  }
  connecting = null;
  setStatus("disconnected");
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  arr.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  return crypto.subtle.digest("SHA-256", data);
}

export async function buildOAuthUrl(
  options: { mode?: "signin" | "signup"; returnTo?: string } = {},
) {
  if (!isBrowser) return "";
  if (!DERIV_CLIENT_ID) throw new Error("Missing required OAuth parameter: client_id");
  if (!DERIV_REDIRECT_URI) throw new Error("Missing required OAuth parameter: redirect_uri");

  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const codeChallenge = base64UrlEncode(await sha256(codeVerifier));
  const state = crypto.randomUUID();

  sessionStorage.setItem("deriv_code_verifier", codeVerifier);
  sessionStorage.setItem("deriv_oauth_state", state);
  sessionStorage.setItem(
    "deriv_oauth_return_to",
    options.returnTo ??
      (options.mode === "signup" ? "/dashboard" : window.location.pathname || "/dashboard"),
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_CLIENT_ID,
    redirect_uri: DERIV_REDIRECT_URI,
    scope: "trade account_manage",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  // Deriv only documents `prompt=registration` for sign-up. Login must use
  // the standard authorization request so Deriv can show either login or the
  // account-access consent screen for users who already have an active session.
  const prompt = options.mode === "signup" ? "registration" : undefined;
  if (prompt) params.set("prompt", prompt);

  const requiredParams = [
    "response_type",
    "client_id",
    "redirect_uri",
    "scope",
    "state",
    "code_challenge",
    "code_challenge_method",
  ];
  const missingParam = requiredParams.find((param) => !params.get(param));
  if (missingParam) {
    throw new Error(`Missing required OAuth parameter: ${missingParam}`);
  }
  if (DERIV_APP_ID && DERIV_APP_ID !== DERIV_CLIENT_ID) {
    params.set("app_id", DERIV_APP_ID);
  }
  const url = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
  console.log("Deriv OAuth diagnostics", {
    finalOAuthUrl: url,
    client_id: DERIV_CLIENT_ID,
    redirect_uri: DERIV_REDIRECT_URI,
    scope: "trade account_manage",
    prompt: prompt ?? "standard-login",
    stateExists: Boolean(state),
    codeChallengeExists: Boolean(codeChallenge),
    codeVerifierStored: sessionStorage.getItem("deriv_code_verifier") === codeVerifier,
    stateStored: sessionStorage.getItem("deriv_oauth_state") === state,
  });
  return url;
}

export async function getAuthenticatedWsUrl(
  accessToken: string,
  accountId: string,
): Promise<string> {
  const response = await fetch(
    `https://api.derivws.com/trading/v1/options/accounts/${accountId}/otp`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Deriv-App-ID": DERIV_CLIENT_ID,
      },
    },
  );
  const otpData = await response.json();
  if (!response.ok) {
    throw new Error(
      otpData?.message ??
        otpData?.error?.message ??
        "Failed to get authenticated Deriv WebSocket URL",
    );
  }
  const url = otpData?.data?.url;
  if (!url) throw new Error("Deriv OTP response did not include a WebSocket URL");
  return url;
}

function connectPublic(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    try {
      const ws = new WebSocket(PUBLIC_WS_URL);
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error("Could not connect to Deriv public WebSocket"));
    } catch (e) {
      reject(e);
    }
  });
}

async function publicSend(payload: DerivRecord): Promise<DerivMessage> {
  const ws = await connectPublic();
  const id = reqId++;
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error("Deriv public request timed out"));
    }, 15000);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.req_id === id) {
          clearTimeout(timeoutId);
          try {
            ws.close();
          } catch {
            /* ignore */
          }
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg);
        }
      } catch {
        /* ignore */
      }
    };
    ws.onerror = () => {
      clearTimeout(timeoutId);
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      reject(new Error("Deriv public request failed"));
    };
    ws.send(JSON.stringify({ ...payload, req_id: id }));
  });
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
  {
    value: "rise_fall",
    label: "Rise / Fall",
    description: "Predict if the market goes up or down.",
  },
  { value: "higher_lower", label: "Higher / Lower", description: "Predict vs. a barrier price." },
  {
    value: "touch_no_touch",
    label: "Touch / No Touch",
    description: "Will the price touch a barrier?",
  },
  {
    value: "even_odd",
    label: "Even / Odd",
    description: "Last digit of the exit spot is even or odd.",
  },
  {
    value: "over_under",
    label: "Over / Under",
    description: "Last digit over/under a chosen number.",
  },
  {
    value: "matches_differs",
    label: "Matches / Differs",
    description: "Last digit matches your prediction.",
  },
  {
    value: "accumulator",
    label: "Accumulators",
    description: "Compound profit while price stays in range.",
  },
  {
    value: "multiplier",
    label: "Multipliers",
    description: "Amplify profit and loss with a multiplier.",
  },
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
