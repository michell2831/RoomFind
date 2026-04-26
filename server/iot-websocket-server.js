/*
 * IoT WebSocket Server for Room Find App
 * Handles communication with ESP32 devices and forwards events to the web app
 * 
 * Run with: node iot-websocket-server.js
 * Make sure to install dependencies: npm install ws
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ port: 8082 });

// Store connected devices and web clients
const devices = new Map();
const webClients = new Set();

// Device registry
const registeredDevices = new Map();

console.log('🚀 IoT WebSocket Server starting on port 8080...');

// Handle WebSocket connections
wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  let deviceInfo = null;
  
  console.log(`📡 New connection from ${req.socket.remoteAddress}`);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`📨 Received:`, data);

      switch (data.type) {
        case 'device_register':
          handleDeviceRegistration(ws, data, clientId);
          deviceInfo = { deviceId: data.deviceId, deviceType: data.deviceType, roomId: data.roomId };
          break;

        case 'rfid_scan':
          handleRFIDScan(data);
          broadcastToWebClients(data);
          break;

        case 'room_sensor':
          handleRoomSensor(data);
          broadcastToWebClients(data);
          break;

        case 'door_status':
          handleDoorStatus(data);
          broadcastToWebClients(data);
          break;

        case 'ping':
          handlePing(ws, data);
          break;

        case 'pong':
          handlePong(ws, data);
          break;

        default:
          console.log(`❓ Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log(`🔌 Connection closed: ${clientId}`);
    
    if (deviceInfo) {
      devices.delete(clientId);
      registeredDevices.delete(deviceInfo.deviceId);
      console.log(`📱 Device ${deviceInfo.deviceId} disconnected`);
      
      // Notify web clients about device disconnection
      const disconnectMessage = {
        type: 'device_disconnected',
        deviceId: deviceInfo.deviceId,
        timestamp: Date.now()
      };
      broadcastToWebClients(disconnectMessage);
    } else {
      webClients.delete(ws);
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });

  // Add to clients list
  devices.set(clientId, { ws, deviceInfo });
});

function handleDeviceRegistration(ws, data, clientId) {
  const device = {
    id: data.deviceId,
    type: data.deviceType,
    roomId: data.roomId,
    connectedAt: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    status: 'online'
  };

  registeredDevices.set(data.deviceId, device);
  
  console.log(`📱 Device registered: ${data.deviceId} (${data.deviceType}) in room ${data.roomId}`);
  
  // Send registration confirmation
  const response = {
    type: 'registration_confirmed',
    deviceId: data.deviceId,
    timestamp: Date.now()
  };
  
  ws.send(JSON.stringify(response));
  
  // Notify web clients about new device
  const deviceMessage = {
    type: 'device_connected',
    device: device,
    timestamp: Date.now()
  };
  
  broadcastToWebClients(deviceMessage);
}

function handleRFIDScan(data) {
  console.log(`🎫 RFID Scan: ${data.data.card_uid} in room ${data.roomId}`);
  
  // Update device last seen
  if (registeredDevices.has(data.deviceId)) {
    const device = registeredDevices.get(data.deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

function handleRoomSensor(data) {
  console.log(`🌡️  Room Sensor: Room ${data.data.room_id} - Occupancy: ${data.data.occupancy}, Door: ${data.data.door_open}`);
  
  // Update device last seen
  if (registeredDevices.has(data.deviceId)) {
    const device = registeredDevices.get(data.deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

function handleDoorStatus(data) {
  console.log(`🚪 Door Status: Room ${data.room_id} - ${data.status}`);
  
  // Update device last seen
  if (registeredDevices.has(data.deviceId)) {
    const device = registeredDevices.get(data.deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

function handlePing(ws, data) {
  const response = {
    type: 'pong',
    deviceId: data.deviceId,
    timestamp: Date.now()
  };
  
  ws.send(JSON.stringify(response));
}

function handlePong(ws, data) {
  // Update device last seen
  if (registeredDevices.has(data.deviceId)) {
    const device = registeredDevices.get(data.deviceId);
    device.lastSeen = new Date().toISOString();
  }
}

function broadcastToWebClients(message) {
  const messageStr = JSON.stringify(message);
  
  // Send to all connected web clients
  devices.forEach((client) => {
    if (!client.deviceInfo && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(messageStr);
    }
  });
}

function generateClientId() {
  return Math.random().toString(36).substr(2, 9);
}

// Health check for devices
setInterval(() => {
  const now = Date.now();
  
  registeredDevices.forEach((device, deviceId) => {
    const lastSeen = new Date(device.lastSeen).getTime();
    const timeDiff = now - lastSeen;
    
    // Mark device as offline if no response for 2 minutes
    if (timeDiff > 120000 && device.status === 'online') {
      device.status = 'offline';
      console.log(`⚠️  Device ${deviceId} marked as offline`);
      
      const offlineMessage = {
        type: 'device_status_changed',
        deviceId: deviceId,
        status: 'offline',
        timestamp: now
      };
      
      broadcastToWebClients(offlineMessage);
    }
  });
}, 30000); // Check every 30 seconds

// REST API for device status
app.get('/api/devices', (req, res) => {
  const deviceList = Array.from(registeredDevices.values());
  res.json({
    devices: deviceList,
    total: deviceList.length,
    online: deviceList.filter(d => d.status === 'online').length
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    connectedDevices: registeredDevices.size,
    uptime: process.uptime()
  });
});

// Serve static files (for development)
app.use(express.static('public'));

server.listen(8082, () => {
  console.log('IoT WebSocket Server is running on port 8082');
  console.log('Health check: http://localhost:8082/api/health');
  console.log('Device list: http://localhost:8082/api/devices');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  
  wss.clients.forEach((ws) => {
    ws.close();
  });
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
