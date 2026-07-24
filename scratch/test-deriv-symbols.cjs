const WebSocket = require("ws");

let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=133647");
ws.onopen = () => {
  ws.send(JSON.stringify({ ticks_history: "1HZ100V", end: "latest", count: 10, style: "ticks", req_id: 1 }));
};
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.error) console.error(data.error);
  else console.log("History:", data.history?.prices?.length);
  process.exit(0);
};
