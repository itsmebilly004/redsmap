const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089&l=EN&brand=deriv');

ws.on('open', () => {
  ws.send(JSON.stringify({
    proposal: 1,
    amount: 10.97,
    basis: "stake",
    contract_type: "DIGITUNDER",
    currency: "USD",
    symbol: "R_100",
    duration: 1,
    duration_unit: "t",
    barrier: "1",
    req_id: 1
  }));
});

ws.on('message', (data) => {
  console.log("Response:", JSON.parse(data));
  ws.close();
});
