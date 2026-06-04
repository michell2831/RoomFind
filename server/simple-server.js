const WebSocket = require('ws');

console.log('Starting simple WebSocket server on port 8090...');

const wss = new WebSocket.Server({ port: 8090 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);
      
      // Echo back to client
      ws.send(JSON.stringify({
        type: 'echo',
        received: data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('Client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log('WebSocket server running on ws://localhost:8090');
