# Room Find IoT Hardware Setup

This directory contains firmware and configuration for ESP32 IoT devices that integrate with the Room Find app.

## Hardware Components

### 1. RFID Card Reader
- **ESP32 Development Board**
- **MFRC522 RFID Reader Module**
- **OLED I2C Display** (SSD1306 128x64)
- **LED** (GPIO 2) - Status indication
- **Buzzer** (GPIO 4) - Audio feedback

#### Wiring:
```
MFRC522    ESP32
SDA    ->   GPIO 5
SCK    ->   GPIO 18
MOSI   ->   GPIO 23
MISO   ->   GPIO 19
RST    ->   GPIO 22
GND    ->   GND
3.3V   ->   3.3V

OLED       ESP32
SDA    ->   GPIO 21
SCL    ->   GPIO 22
GND    ->   GND
VCC    ->   3.3V

LED        ESP32
Anode  ->   GPIO 2
Cathode ->   GND

Buzzer     ESP32
+      ->   GPIO 4
-      ->   GND
```

#### Installation:
1. Open `esp32_rfid_reader/esp32_rfid_reader.ino` in Arduino IDE
2. Update WiFi credentials and server IP
3. Upload to ESP32
4. Device will auto-connect to WebSocket server

---

## Server Setup

### Prerequisites:
- Node.js installed on your computer
- WiFi network accessible to ESP32 devices

### Installation:
1. Navigate to `server/` directory
2. Run: `npm install`
3. Start server: `npm start`

### Server Endpoints:
- **WebSocket**: `ws://localhost:8080`
- **Device Status**: `http://localhost:8080/api/devices`
- **Health Check**: `http://localhost:8080/api/health`

---

## Configuration

### ESP32 Firmware Configuration:
Update these variables in each `.ino` file:

```cpp
// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// WebSocket Configuration
const char* WEBSOCKET_SERVER = "192.168.1.100"; // Your computer's IP
const uint16_t WEBSOCKET_PORT = 8080;

// Device Configuration
const String DEVICE_ID = "rfid_reader_001"; // Unique device ID
const String ROOM_ID = "1"; // Room this device is installed in
```

### Web App Configuration:
Update `.env` file:
```
VITE_IOT_WS_URL=ws://localhost:8080
```

---

## Device Registration

Devices automatically register when they connect:
1. Power on ESP32 device
2. Device connects to WiFi
3. Device connects to WebSocket server
4. Device sends registration message
5. Server confirms registration
6. Device appears in IoT dashboard

---

## Testing

### 1. Start Server:
```bash
cd server
npm install
npm start
```

### 2. Start Web App:
```bash
npm run dev
```

### 3. Power On Devices:
- Connect ESP32 devices to power
- Check serial monitor for connection status
- Verify devices appear in IoT dashboard

### 4. Test Functionality:
- **RFID**: Scan RFID card near reader to check in / check out
- Check web app for real-time updates

---

## Troubleshooting

### Common Issues:

1. **Device won't connect to WiFi**
   - Check WiFi credentials
   - Verify network range
   - Check serial monitor output

2. **WebSocket connection fails**
   - Verify server is running
   - Check IP address configuration
   - Ensure firewall allows port 8080

3. **RFID reader not working**
   - Check wiring connections
   - Verify 3.3V power supply
   - Check MFRC522 module compatibility



Enable serial monitor (115200 baud) to see:
- WiFi connection status
- WebSocket connection events
- Device registration messages
- Error messages

---

## Advanced Features

### Multiple Device Support:
- Each device needs unique `DEVICE_ID`
- Configure different `ROOM_ID` for each room
- Server handles multiple simultaneous connections

### Custom Sensors:
- Add new sensor types in firmware
- Extend server message handling
- Update web app event processing

### Security:
- Implement device authentication
- Add message encryption
- Set up access control lists

---

## Data Flow

```
ESP32 Device → WebSocket Server → Web App
     ↓              ↓                ↓
  Sensor Data    Device Registry   Real-time Updates
  Events         Health Checks     UI Updates
```
