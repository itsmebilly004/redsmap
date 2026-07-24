const ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1098');

ws.addEventListener('open', () => {
  console.log('Connected');
  ws.send(JSON.stringify({ ticks: 'R_100', subscribe: 1 }));
});

ws.addEventListener('message', (event) => {
  console.log('Received:', event.data);
  ws.close();
});

ws.addEventListener('error', (err) => {
  console.error('Error:', err);
});
