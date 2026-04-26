# 🚀 Room Find IoT Setup - Step by Step Guide

## 📋 What You'll Need

### Hardware:
- ESP32 Development Board (x2 for RFID + Room Sensor)
- MFRC522 RFID Reader Module
- PIR Motion Sensor (HC-SR501)
- Magnetic Door Sensor
- DHT22 Temperature/Humidity Sensor
- LED and Buzzer
- Jumper wires and breadboard
- USB cable for programming

### Software:
- Arduino IDE (on your computer)
- Room Find app (already set up)

---

## 🎯 STEP 1: Install Arduino IDE

### 1.1 Download Arduino IDE
1. Go to [https://www.arduino.cc/en/software](https://www.arduino.cc/en/software)
2. Download **Windows Win 10 and later** version
3. Run the installer
4. Follow installation prompts (click "Next" through all)
5. Launch Arduino IDE when complete

### 1.2 Install ESP32 Board Support
1. Open Arduino IDE
2. Click **File → Preferences**
3. In "Additional Board Manager URLs", add this URL:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Click **OK**
5. Go to **Tools → Board → Boards Manager**
6. Search "**ESP32**"
7. Install "**ESP32 by Espressif Systems**"
8. Wait for installation to complete

---

## 📚 STEP 2: Install Required Libraries

### 2.1 Open Library Manager
1. In Arduino IDE, click **Tools → Manage Libraries**
2. Wait for Library Manager to load

### 2.2 Install These Libraries:
1. **MFRC522** (for RFID reader)
   - Search: "MFRC522"
   - Install by "GitHubCommunity"
   
2. **DHT sensor library** (for temperature/humidity)
   - Search: "DHT sensor library"
   - Install by "Adafruit"
   
3. **ArduinoJson** (for WebSocket communication)
   - Search: "ArduinoJson"
   - Install by "Benoit Blanchon"
   
4. **WebSockets** (for WiFi communication)
   - Search: "WebSockets"
   - Install by "Markus Sattler"
   
5. **Adafruit SSD1306** (for OLED display)
   - Search: "Adafruit SSD1306"
   - Install by "Adafruit"
   
6. **Adafruit GFX Library** (for OLED graphics)
   - Search: "Adafruit GFX Library"
   - Install by "Adafruit"

---

## 🔌 STEP 3: Hardware Setup

### 3.1 RFID Reader Wiring
Connect MFRC522, OLED, LED, and Buzzer to ESP32:

```
MFRC522 Pin    ESP32 Pin
SDA          -> GPIO 5
SCK          -> GPIO 18
MOSI         -> GPIO 23
MISO         -> GPIO 19
RST          -> GPIO 22
GND          -> GND
3.3V         -> 3.3V

OLED Display:
SDA          -> GPIO 21
SCL          -> GPIO 22
GND          -> GND
VCC          -> 3.3V

LED:
Anode (+)    -> GPIO 2
Cathode (-)  -> GND

Buzzer:
+            -> GPIO 4
-            -> GND
```

### 3.2 Room Sensor Wiring
Connect sensors to ESP32:

```
PIR Sensor:
OUT          → GPIO 4
GND          → GND
VCC          → 5V

Door Sensor:
Signal       → GPIO 2
GND          → GND

DHT22:
Data         → GPIO 5
GND          → GND
VCC          → 3.3V

LED:
Anode (+)    → GPIO 18
Cathode (-)  → GND
```

---

## 💻 STEP 4: Configure Firmware

### 4.1 Open RFID Reader Firmware
1. Open Arduino IDE
2. Click **File → Open**
3. Navigate to: `hardware/esp32_rfid_reader/esp32_rfid_reader.ino`
4. Update these lines:

```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* WEBSOCKET_SERVER = "192.168.1.100"; // Your computer's IP
const String DEVICE_ID = "rfid_reader_001";
const String ROOM_ID = "1";
```

### 4.2 Open Room Sensor Firmware
1. Click **File → Open**
2. Navigate to: `hardware/esp32_room_sensor/esp32_room_sensor.ino`
3. Update the same configuration lines

---

## ⬆️ STEP 5: Upload Firmware to ESP32

### 5.1 Prepare ESP32
1. Connect ESP32 to computer via USB
2. In Arduino IDE, select board: **Tools → Board → ESP32 Arduino → ESP32 Dev Module**
3. Select port: **Tools → Port** (should show COM port)

### 5.2 Upload RFID Reader Firmware
1. Open the RFID firmware file
2. Click **Upload button** (→ arrow in top-left)
3. Wait for "Done uploading" message
4. Test by opening Serial Monitor (**Tools → Serial Monitor**, set to 115200 baud)

### 5.3 Upload Room Sensor Firmware
1. Open the room sensor firmware file
2. Connect second ESP32 to computer
3. Click **Upload button**
4. Test with Serial Monitor

---

## 🌐 STEP 6: Start IoT Server

### 6.1 Install Server Dependencies
1. Open Command Prompt or PowerShell
2. Navigate to server folder:
   ```cmd
   cd "C:\Users\Paula\Desktop\Room Find app\server"
   ```
3. Install dependencies:
   ```cmd
   npm install
   ```

### 6.2 Start WebSocket Server
1. In same command window, run:
   ```cmd
   npm start
   ```
2. You should see: "🚀 IoT WebSocket Server starting on port 8080"
3. Leave this window open

---

## 🖥️ STEP 7: Test Complete System

### 7.1 Start Room Find App
1. Open new command window
2. Navigate to app folder:
   ```cmd
   cd "C:\Users\Paula\Desktop\Room Find app"
   ```
3. Start development server:
   ```cmd
   npm run dev
   ```
4. Open browser to: `http://localhost:5178`

### 7.2 Login and Test
1. Login with admin credentials: `admin@university.edu` / `admin123`
2. Go to **IoT Dashboard** (in sidebar)
3. You should see devices connecting

### 7.3 Test RFID Reader
1. Hold RFID card near MFRC522 reader
2. LED should flash and buzzer beep
3. Check IoT dashboard for new access log
4. Check Rooms page for status change

### 7.4 Test Room Sensor
1. Wave hand in front of PIR sensor
2. Open/close door sensor
3. Check IoT dashboard for sensor data
4. Check Rooms page for occupancy updates

---

## 🔧 STEP 8: Troubleshooting

### Common Issues & Solutions:

**❌ "ESP32 not connecting to WiFi"**
- Check WiFi name and password
- Ensure ESP32 is within WiFi range
- Restart ESP32 (press reset button)

**❌ "Upload failed" in Arduino IDE**
- Check USB connection
- Try different USB port
- Press and hold ESP32 boot button during upload

**❌ "No devices showing in dashboard"**
- Check if WebSocket server is running
- Verify IP address in ESP32 code
- Check firewall settings (port 8080)

**❌ "RFID reader not working"**
- Check MFRC522 wiring
- Ensure 3.3V power supply
- Try different RFID card

**❌ "Sensor readings wrong"**
- Check sensor wiring
- Calibrate PIR sensitivity
- Replace DHT22 if readings are invalid

---

## ✅ Success Checklist

When everything is working, you should have:

- [ ] Arduino IDE installed with ESP32 support
- [ ] All required libraries installed
- [ ] ESP32 devices programmed and connected
- [ ] WebSocket server running on port 8080
- [ ] Room Find app running in browser
- [ ] Devices showing in IoT dashboard
- [ ] RFID scans creating access logs
- [ ] Room sensors updating occupancy status
- [ ] Real-time updates working in web app

---

## 📞 Need Help?

If you get stuck at any step:
1. Check the Serial Monitor for error messages
2. Verify all wiring connections
3. Ensure server is running before powering ESP32
4. Check browser console for web app errors

**Your Room Find IoT system is now ready!** 🎉
