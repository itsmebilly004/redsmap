const WebSocket = require('ws');

const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1098');

ws.on('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ 
    active_symbols: 'brief', product_type: 'basic',
    req_id: 1 
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString().substring(0, 100));
  ws.close();
});
