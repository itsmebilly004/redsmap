// Deriv WebSocket helper. Single shared connection per browser tab.
// Uses public demo app_id 1089 by default. Override with VITE_DERIV_APP_ID.
const DERIV_APP_ID = import.meta.env.VITE_DERIV_APP_ID || "1089";
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID}&l=EN`;

export const DERIV_APP_ID_VALUE = DERIV_APP_ID;

type Listener = (msg: any) => void;

let socket: WebSocket | null = null;
let listeners = new Set<Listener>();
let reqId = 1;
let connecting: Promise<WebSocket> | null = null;

function connect(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(socket);
  if (connecting) return connecting;
  connecting = new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      socket = ws;
      connecting = null;
      resolve(ws);
    };
    ws.onerror = (e) => {
      connecting = null;
      reject(e);
    };
    ws.onclose = () => {
      socket = null;
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
  const req_id = id;
  return new Promise((resolve, reject) => {
    const off = onMessage((msg) => {
      if (msg.req_id === req_id) {
        off();
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg);
      }
    });
    ws.send(JSON.stringify({ ...payload, req_id }));
    setTimeout(() => {
      off();
      reject(new Error("Deriv request timed out"));
    }, 15000);
  });
}

export async function subscribeTicks(symbol: string, onTick: (price: number, time: number) => void) {
  const ws = await connect();
  const off = onMessage((msg) => {
    if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
      onTick(Number(msg.tick.quote), Number(msg.tick.epoch));
    }
  });
  ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
  return () => {
    off();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ forget_all: "ticks" }));
    }
  };
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
  { symbol: "1HZ100V", name: "Volatility 100 (1s) Index" },
];
