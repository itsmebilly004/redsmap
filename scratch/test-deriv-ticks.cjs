const WebSocket = require("ws");

global.WebSocket = WebSocket;

let reqId = 1;
const listeners = new Set();
const PUBLIC_WS_URL = "wss://ws.binaryws.com/websockets/v3?app_id=133647";

let sharedPublicSocket = null;
let sharedPublicPromise = null;

function connectPublic() {
  if (sharedPublicPromise && sharedPublicSocket) {
    if (sharedPublicSocket.readyState === WebSocket.OPEN || sharedPublicSocket.readyState === WebSocket.CONNECTING) {
      return sharedPublicPromise;
    }
  }

  sharedPublicSocket = new WebSocket(PUBLIC_WS_URL);
  sharedPublicPromise = new Promise((resolve, reject) => {
    let handled = false;
    const ws = sharedPublicSocket;
    
    ws.onopen = () => {
      handled = true;
      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          listeners.forEach((l) => l(data));
        } catch (e) {}
      });
      resolve(ws);
    };
    
    ws.onerror = (err) => reject(new Error("Could not connect"));
    ws.onclose = () => reject(new Error("Closed before open"));
  });

  return sharedPublicPromise;
}

function onFallbackMessage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function subscribeTicks(symbol, onTick) {
  const ws = await connectPublic();
  let subId = null;
  let unmounted = false;
  
  const sub = { send: { ticks: symbol, subscribe: 1 } };
  
  const off = onFallbackMessage((msg) => {
    if (msg.msg_type === "tick" && msg.tick?.symbol === symbol) {
      if (msg.subscription?.id && !subId) {
        subId = msg.subscription.id;
      }
      if (!unmounted) {
        onTick(msg.tick.quote, msg.tick.epoch);
      }
    }
  });

  if (ws.readyState === 1) {
    console.log("Sending:", sub.send);
    ws.send(JSON.stringify(sub.send));
  }
  
  return () => {
    unmounted = true;
    off();
  };
}

async function run() {
  console.log("Subscribing to R_100...");
  let count = 0;
  const unsub = await subscribeTicks("R_100", (price, time) => {
    console.log(`Tick received: ${price} at ${time}`);
    count++;
    if (count >= 3) {
      unsub();
      process.exit(0);
    }
  });
}

run();
