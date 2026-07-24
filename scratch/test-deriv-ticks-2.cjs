const WebSocket = require("ws");

let ws = new WebSocket("wss://ws.binaryws.com/websockets/v3?app_id=133647");
ws.onopen = () => {
  console.log("Connected");
  ws.send(JSON.stringify({ ticks: "R_100", subscribe: 1, req_id: 999 }));
};
ws.onmessage = (msg) => {
  console.log("Message:", msg.data);
  process.exit(0);
};
