/*
 * ESP32 RFID Card Reader for Room Find App
 * Connects to WebSocket server and sends RFID scan events
 * 
 * Hardware Requirements:
 * - ESP32 Development Board
 * - MFRC522 RFID Reader Module
 * - OLED I2C Display (SSD1306 128x64)
 * - LED for status indication
 * - Buzzer for audio feedback
 * 
 * Wiring:
 * - Power: 3.3V to MFRC522 (3.3V) and OLED (VCC)
 * - Ground: GND to MFRC522 (GND), OLED (GND), LED (GND), Buzzer (GND)
 * - MFRC522 SDA -> GPIO 5
 * - MFRC522 SCK -> GPIO 18
 * - MFRC522 MOSI -> GPIO 23
 * - MFRC522 MISO -> GPIO 19
 * - MFRC522 RST -> GPIO 15
 * - OLED SDA -> GPIO 21
 * - OLED SCL -> GPIO 22
 * - LED -> GPIO 2
 * - Buzzer -> GPIO 4
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SH110X.h>  // 1.3" OLED uses SH1106 chip, NOT SSD1306
#include "secrets.h"          // ⚠️  WiFi & server credentials — DO NOT commit this file!

// WiFi Configuration (values from secrets.h)
const char* WIFI_SSID     = SECRET_WIFI_SSID;
const char* WIFI_PASSWORD = SECRET_WIFI_PASSWORD;

// WebSocket Configuration (values from secrets.h)
const char* WEBSOCKET_SERVER = SECRET_WS_SERVER;
const uint16_t WEBSOCKET_PORT = SECRET_WS_PORT;

// RFID Configuration
#define RST_PIN 15
#define SS_PIN 5
#define LED_PIN 2
#define BUZZER_PIN 4
#define LOCK_PIN 16 // Relay/lock control pin

// OLED Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// Device Configuration (values from secrets.h)
const String DEVICE_ID = SECRET_DEVICE_ID;
const String ROOM_ID   = SECRET_ROOM_ID;

MFRC522 mfrc522(SS_PIN, RST_PIN);
WebSocketsClient webSocket;
Adafruit_SH1106G display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET); // SH1106 driver

unsigned long lastScanTime = 0;          // millis() timestamp of last accepted scan
const unsigned long SCAN_COOLDOWN = 2000; // 2-second non-blocking cooldown between scans
bool isConnected = false;
bool displayOk = false;  // set true when OLED init succeeds
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 5000;

// Occupied state variables
bool isOccupied = false;
String currentProfessor = "";
String currentSchStart = "";
String currentSchEnd = "";

void connectWiFi();
void connectWebSocket();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void sendRFIDEvent(String cardUid, String action);
void simulateScan(String cardUid);
void handleSerialInput();
void indicateSuccess();
void indicateError();
void indicateProcessing();
void initDisplay();
void updateDisplay(String status, String message = "");
void showCardScanned(String cardUid);
void showGranted(String userName, String start, String end);
void showDenied(String reason);
void showCheckedOut(String userName);
void showTimeoutAlert(String message);
void showOccupiedScreen(String userName, String start, String end);
void resetStandbyScreen();

// ── Buzzer helpers (Standard Arduino tone — works best on ESP32 3.0+) ─────────
void buzzerOn(uint32_t freq = 2000) {
  tone(BUZZER_PIN, freq);
}

void buzzerOff() {
  noTone(BUZZER_PIN);
  digitalWrite(BUZZER_PIN, LOW);
}


void setup() {
  Serial.begin(115200);
  while (!Serial);

  pinMode(LED_PIN, OUTPUT);
  // BUZZER: configure as output; LEDC init happens in buzzerOn()
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(LOCK_PIN, OUTPUT);
  digitalWrite(LOCK_PIN, LOW);
  Serial.println("[BUZZ] Buzzer on GPIO " + String(BUZZER_PIN));

  initDisplay();

  SPI.begin();
  mfrc522.PCD_Init();
  mfrc522.PCD_DumpVersionToSerial();

  Serial.println("ESP32 RFID Reader Starting...");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("Room ID: " + ROOM_ID);

  updateDisplay("STARTING", "Initializing...");

  connectWiFi();
  connectWebSocket();

  indicateSuccess();
}

void loop() {
  webSocket.loop();
  handleSerialInput(); // ← Serial Monitor test mode

  // ── WiFi watchdog ──────────────────────────────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      connectWiFi();
      lastReconnectAttempt = millis();
    }
  }

  if (!isConnected && WiFi.status() == WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      connectWebSocket();
      lastReconnectAttempt = millis();
    }
  }

  // ── Heartbeat ────────────────────────────────────────────────────
  static unsigned long lastHeartbeat = 0;
  if (millis() - lastHeartbeat > 3000) {
    Serial.println("[RFID] READY - Waiting for card... (WS:" + String(isConnected ? "ON" : "OFF") + ")");
    lastHeartbeat = millis();
  }

  // ── RFID scan gate: millis()-based 2-second cooldown (NO delay()) ──────
  if ((millis() - lastScanTime) >= SCAN_COOLDOWN) {

    if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {

      // ── Build uppercase hex UID ────────────────────────────────
      char uidBuf[32] = {0};
      char hexBuf[3];
      for (byte i = 0; i < mfrc522.uid.size; i++) {
        sprintf(hexBuf, "%02X", mfrc522.uid.uidByte[i]);
        strcat(uidBuf, hexBuf);
      }
      String cardUid = String(uidBuf);

      Serial.println("\n========================================");
      Serial.println("[RFID] Card UID: " + cardUid);

      // ── 1. Non-blocking 150ms beep — returns instantly, no freezing ──
      tone(BUZZER_PIN, 2500, 150);

      // ── 2. Send event to server ────────────────────────────────
      Serial.println("[RFID] Sending to server...");
      sendRFIDEvent(cardUid, "check_in");
      webSocket.loop(); // flush TX buffer immediately

      // ── 3. Update cooldown timestamp BEFORE any further processing ──
      lastScanTime = millis();

      // ── 4. CRITICAL: release MFRC522 IMMEDIATELY after reading ──────
      //    Without these two lines the chip stays locked and the
      //    next scan will never be detected.
      mfrc522.PICC_HaltA();
      mfrc522.PCD_StopCrypto1();

      // ── 5. Optional visual feedback (non-critical) ─────────────────
      indicateProcessing();

      Serial.println("[RFID] Done. Next scan allowed in " + String(SCAN_COOLDOWN) + "ms.");
      Serial.println("========================================\n");
    }
  }

  // ── Status LED heartbeat when connected ──────────────────────────
  if (isConnected) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 2000) {
      digitalWrite(LED_PIN, HIGH);
      delay(50);
      digitalWrite(LED_PIN, LOW);
      lastBlink = millis();
    }
  }
}


void connectWiFi() {
  Serial.println("Connecting to WiFi...");
  updateDisplay("WIFI", "Connecting...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected! IP: " + WiFi.localIP().toString());
    updateDisplay("WIFI OK", WiFi.localIP().toString());
    indicateSuccess();
  } else {
    Serial.println("\nFailed to connect to WiFi");
    updateDisplay("WIFI ERR", "Connection failed");
    indicateError();
  }
}

void connectWebSocket() {
  Serial.println("Connecting to WebSocket...");
  updateDisplay("WS", "Connecting...");

  webSocket.begin(WEBSOCKET_SERVER, WEBSOCKET_PORT, "/");
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
  webSocket.enableHeartbeat(30000, 5000, 2);
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      isConnected = false;
      updateDisplay("WS ERR", "Disconnected");
      break;

    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      isConnected = true;
      updateDisplay("REG", "Registering...");
      {
        DynamicJsonDocument doc(256);
        doc["type"]       = "device_register";
        doc["deviceId"]   = DEVICE_ID;
        doc["deviceType"] = "rfid_reader";
        doc["roomId"]     = ROOM_ID;
        doc["timestamp"]  = millis();
        String message;
        serializeJson(doc, message);
        webSocket.sendTXT(message);
      }
      break;

    case WStype_TEXT: {
      Serial.println("Message: " + String((char*)payload));

      DynamicJsonDocument doc(512);
      DeserializationError error = deserializeJson(doc, payload);
      if (error) break;

      String msgType = doc["type"] | "";
      String command = doc["command"] | "";

      // ── Heartbeat ───────────────────────────────────────────────────────
      if (command == "ping") {
        DynamicJsonDocument pong(128);
        pong["type"]      = "pong";
        pong["deviceId"]  = DEVICE_ID;
        pong["timestamp"] = millis();
        String out;
        serializeJson(pong, out);
        webSocket.sendTXT(out);
      }

      // ── Registration ────────────────────────────────────────────────────
      else if (msgType == "registration_confirmed") {
        Serial.println("Registration confirmed");
        resetStandbyScreen();
        indicateSuccess();
      }
      else if (msgType == "registration_failed") {
        String reason = doc["reason"] | "Unknown";
        Serial.println("Registration failed: " + reason);
        updateDisplay("REG ERR", reason);
        indicateError();
      }

      // ── Access Response (schedule validation result) ─────────────────────
      else if (msgType == "access_response") {
        String status    = doc["status"]        | "";
        String message   = doc["message"]       | "";
        String userName  = doc["userName"]      | "";
        String schStart  = doc["scheduleStart"] | "";
        String schEnd    = doc["scheduleEnd"]   | "";
        String action    = doc["action"]        | "";

        if (status == "SUCCESS") {
          indicateSuccess();
          if (action == "check_out" || message == "Checked Out Successfully") {
            showCheckedOut(userName);
            // Clear occupancy state
            isOccupied = false;
            currentProfessor = "";
            currentSchStart = "";
            currentSchEnd = "";
          } else {
            showGranted(userName, schStart, schEnd);
            // Save occupancy state
            isOccupied = true;
            currentProfessor = userName;
            currentSchStart = schStart;
            currentSchEnd = schEnd;
          }
          // Non-blocking 3.5s display — keep WS alive so next scan works
          for (int t = 0; t < 350; t++) { webSocket.loop(); delay(10); }
          resetStandbyScreen();

        } else {
          indicateError();
          showDenied("Access Denied: Invalid Time");
          // Non-blocking 3s display — keep WS alive so next scan works
          for (int t = 0; t < 300; t++) { webSocket.loop(); delay(10); }
          resetStandbyScreen();
        }
      }
      else if (msgType == "unknown_card" || msgType == "card_not_found") {
        Serial.println("UNKNOWN CARD detected by server");
        indicateError();
        showDenied("Card Not Registered");
        // Non-blocking 3s display
        for (int t = 0; t < 300; t++) { webSocket.loop(); delay(10); }
        resetStandbyScreen();
      }
      else if (msgType == "auto_timeout") {
        String message = doc["message"] | "Schedule Ended";
        Serial.println("AUTO TIMEOUT received from server: " + message);
        
        // Clear occupancy state
        isOccupied = false;
        currentProfessor = "";
        currentSchStart = "";
        currentSchEnd = "";
        
        // 1. OLED Alert Screen
        showTimeoutAlert(message);
        
        // 2. Auditory and LED Alarm: 5 rapid beeps & blinks
        for (int i = 0; i < 5; i++) {
          tone(BUZZER_PIN, 1500, 150); // 1.5kHz tone for 150ms
          digitalWrite(LED_PIN, HIGH);
          delay(200);
          digitalWrite(LED_PIN, LOW);
          delay(100);
        }
        
        // 3. Keep display active for another 3.5 seconds while keeping WebSocket active
        for (int t = 0; t < 350; t++) {
          webSocket.loop();
          delay(10);
        }
        
        // 4. Return to normal standby screen
        resetStandbyScreen();
      }

      break;
    }

    case WStype_ERROR:
      Serial.println("WebSocket error");
      indicateError();
      break;

    default:
      break;
  }
}

void sendRFIDEvent(String cardUid, String action) {
  DynamicJsonDocument doc(256);
  doc["type"]      = "rfid_scan";
  doc["deviceId"]  = DEVICE_ID;
  doc["roomId"]    = ROOM_ID;
  doc["room_id"]   = ROOM_ID;
  doc["card_id"]   = cardUid;
  doc["timestamp"] = millis();
  JsonObject data  = doc.createNestedObject("data");
  data["card_id"]  = cardUid;
  data["room_id"]  = ROOM_ID;
  data["action"]   = action;
  String message;
  serializeJson(doc, message);
  Serial.println("RFID DEBUG -> UID: " + cardUid + ", action: " + action + ", wsConnected: " + String(isConnected ? "true" : "false"));
  Serial.println("Sending: " + message);
  webSocket.sendTXT(message);
}

// ── Serial Monitor Test Mode ─────────────────────────────────────────────────
// Type a card UID (e.g. A1B2C3D4) and press Enter to simulate a scan.
// Commands:
//   <any hex string>  → simulate that UID being scanned
//   scan              → simulate scan with default test UID "TESTCARD01"
//   status            → print WiFi + WebSocket connection info

void simulateScan(String cardUid) {
  cardUid.trim();
  cardUid.toUpperCase();
  if (cardUid.length() == 0) return;

  Serial.println("[SERIAL TEST] Simulating scan for UID: " + cardUid);

  // Non-blocking 150ms beep — same as hardware scan
  tone(BUZZER_PIN, 2500, 150);

  showCardScanned(cardUid);
  sendRFIDEvent(cardUid, "check_in");
  webSocket.loop();
  lastScanTime = millis(); // use renamed variable
}

void handleSerialInput() {
  if (!Serial.available()) return;

  String input = Serial.readStringUntil('\n');
  input.trim();
  if (input.length() == 0) return;

  Serial.println("[SERIAL] Received: \"" + input + "\"");

  // ── help ───────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("help")) {
    Serial.println("\n=== AVAILABLE COMMANDS ===");
    Serial.println("  help    - Show this list");
    Serial.println("  status  - Show WiFi + WebSocket connection info");
    Serial.println("  test    - Run MFRC522 reader hardware self-test");
    Serial.println("  led     - Blink LED 5 times (test GPIO " + String(LED_PIN) + ")");
    Serial.println("  buzzer  - Beep buzzer 3 times (test GPIO " + String(BUZZER_PIN) + ")");
    Serial.println("  siren   - Play long siren sound (2 seconds)");
    Serial.println("  display - Test OLED display (retries init if failed)");
    Serial.println("  scan    - Simulate scan with test UID 'TESTCARD01'");
    Serial.println("  <UID>   - Simulate scanning that card UID (e.g. A1B2C3D4)");
    Serial.println("==========================\n");
    return;
  }

  // ── status ───────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("status")) {
    Serial.println("\n--- STATUS ---");
    Serial.println("WiFi:      " + String(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected"));
    if (WiFi.status() == WL_CONNECTED) Serial.println("IP:        " + WiFi.localIP().toString());
    Serial.println("WebSocket: " + String(isConnected ? "Connected" : "Disconnected"));
    Serial.println("Server:    " + String(WEBSOCKET_SERVER) + ":" + String(WEBSOCKET_PORT));
    Serial.println("--------------\n");
    return;
  }

  // ── test (MFRC522 hardware self-test) ───────────────────────────────────
  if (input.equalsIgnoreCase("test")) {
    Serial.println("\n=== MFRC522 HARDWARE SELF-TEST ===");

    // 1) Read firmware version register
    byte version = mfrc522.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.print("Firmware Version Register: 0x");
    if (version < 0x10) Serial.print("0");
    Serial.println(version, HEX);

    if (version == 0x00 || version == 0xFF) {
      Serial.println("*** HARDWARE PROBLEM DETECTED! ***");
      Serial.println("Result: 0x00 or 0xFF means SPI is NOT working.");
      Serial.println("Causes:");
      Serial.println("  - MFRC522 not powered (check 3.3V pin)");
      Serial.println("  - SPI wiring wrong (check MOSI/MISO/SCK/SDA/RST)");
      Serial.println("  - Module dead / burned out");
      Serial.println("Wiring expected:");
      Serial.println("  SDA  -> GPIO 5");
      Serial.println("  SCK  -> GPIO 18");
      Serial.println("  MOSI -> GPIO 23");
      Serial.println("  MISO -> GPIO 19");
      Serial.println("  RST  -> GPIO 15");
      Serial.println("  3.3V -> 3.3V (NOT 5V!)");
    } else if (version == 0x91) {
      Serial.println("Chip identified: MFRC522 v1.0 - OK");
    } else if (version == 0x92) {
      Serial.println("Chip identified: MFRC522 v2.0 - OK");
    } else {
      Serial.println("Unknown version (0x" + String(version, HEX) + ") - may still work");
    }

    // 2) Run built-in self-test
    if (version != 0x00 && version != 0xFF) {
      Serial.println("\nRunning PCD self-test...");
      bool selfTestOk = mfrc522.PCD_PerformSelfTest();
      Serial.println("Self-test result: " + String(selfTestOk ? "PASSED" : "FAILED"));

      // Re-init after self-test (it resets the chip)
      mfrc522.PCD_Init();

      if (!selfTestOk) {
        Serial.println("Self-test FAILED: The chip may be damaged.");
      } else {
        Serial.println("Reader is healthy! If cards are not detected,");
        Serial.println("check that the antenna is not obstructed.");
      }
    }

    Serial.println("=================================\n");
    return;
  }

  // ── led ────────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("led")) {
    Serial.println("[LED TEST] Blinking LED 5 times on GPIO " + String(LED_PIN));
    for (int i = 0; i < 5; i++) {
      digitalWrite(LED_PIN, HIGH);
      delay(300);
      digitalWrite(LED_PIN, LOW);
      delay(300);
    }
    Serial.println("[LED TEST] Done. Did you see 5 blinks?");
    return;
  }

  // ── buzzer ───────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("buzzer")) {
    Serial.println("[BUZZER TEST] Testing on GPIO " + String(BUZZER_PIN) + " using LEDC PWM");
    uint32_t freqs[] = { 500, 1000, 2000, 3000 };
    String names[] = { "500Hz (low)", "1kHz (mid)", "2kHz (high)", "3kHz (very high)" };
    for (int f = 0; f < 4; f++) {
      Serial.println("  Beeping at " + names[f] + "...");
      buzzerOn(freqs[f]);
      delay(400);
      buzzerOff();
      delay(200);
    }
    Serial.println("[BUZZER TEST] Done. Did you hear any of the 4 beeps?");
    Serial.println("  If YES: buzzer is passive (PWM) and working!");
    Serial.println("  If NO:  check wiring on GPIO " + String(BUZZER_PIN) + " and GND.");
    return;
  }

  // ── siren ──────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("siren")) {
    Serial.println("[SIREN TEST] Playing 2-second siren...");
    for (int i = 0; i < 2; i++) {
      for (int f = 500; f < 3000; f += 50) { buzzerOn(f); delay(10); }
      for (int f = 3000; f > 500; f -= 50) { buzzerOn(f); delay(10); }
    }
    buzzerOff();
    Serial.println("[SIREN TEST] Done.");
    return;
  }

  // ── display ───────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("display")) {
    Serial.println("[DISPLAY TEST] displayOk = " + String(displayOk ? "true" : "false"));
    if (!displayOk) {
      Serial.println("[DISPLAY TEST] Retrying display init...");
      initDisplay();
      Serial.println("[DISPLAY TEST] After retry, displayOk = " + String(displayOk ? "true" : "false"));
    } else {
      Serial.println("[DISPLAY TEST] Showing test pattern...");
      display.clearDisplay();
      display.fillRect(0, 0, 128, 8, SH110X_WHITE);
      display.setTextColor(SH110X_BLACK);
      display.setCursor(2, 0);
      display.print("DISPLAY OK!");
      display.setTextColor(SH110X_WHITE);
      display.setCursor(0, 16);
      display.println("Room Find RFID");
      display.setCursor(0, 28);
      display.println("Test pattern");
      display.display();
      delay(2000);
      resetStandbyScreen();
      Serial.println("[DISPLAY TEST] Done.");
    }
    return;
  }

  // ── scan ────────────────────────────────────────────────────────────────
  if (input.equalsIgnoreCase("scan")) {
    simulateScan("TESTCARD01");
    return;
  }

  // Treat any other input as a card UID to simulate
  simulateScan(input);
}

// ── Feedback ──────────────────────────────────────────────────────────────────

void indicateSuccess() {
  // Non-blocking success beep — 2kHz 150ms, returns instantly
  tone(BUZZER_PIN, 2000, 150);
  // LED + lock on while keeping WS alive (~2 seconds)
  digitalWrite(LED_PIN, HIGH);
  digitalWrite(LOCK_PIN, HIGH);
  for (int t = 0; t < 200; t++) { webSocket.loop(); delay(10); } // 2000ms
  digitalWrite(LOCK_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  Serial.println("SUCCESS feedback (beep)");
}


void indicateError() {
  // Two short beeps at 1000Hz = DENIED (500Hz is often inaudible on passive buzzers)
  tone(BUZZER_PIN, 1000, 200); // beep 1 — 200ms
  delay(200);                  // wait for beep 1 to finish
  delay(150);                  // 150ms gap between beeps
  tone(BUZZER_PIN, 1000, 200); // beep 2 — 200ms
  delay(200);                  // wait for beep 2 to finish
  // Blink LED 3 times
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    for (int t = 0; t < 20; t++) { webSocket.loop(); delay(10); }
    digitalWrite(LED_PIN, LOW);
    for (int t = 0; t < 10; t++) { webSocket.loop(); delay(10); }
  }
  Serial.println("ERROR feedback (beep)");
}


void indicateProcessing() {
  // 3 rapid mid-tone blinks (No buzzer)
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    webSocket.loop(); delay(75);
    digitalWrite(LED_PIN, LOW);
    webSocket.loop(); delay(75);
  }
}

// ── Display ───────────────────────────────────────────────────────────────────

void initDisplay() {
  Wire.begin(21, 22);

  // I2C address auto-detect: try 0x3C first, then 0x3D
  uint8_t addrsToTry[] = { 0x3C, 0x3D };
  uint8_t foundAddr = 0;
  for (uint8_t a : addrsToTry) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      foundAddr = a;
      Serial.println("[DISPLAY] Found I2C device at 0x" + String(a, HEX));
      break;
    }
  }

  if (foundAddr == 0) {
    Serial.println("[DISPLAY] WARNING: No I2C device found on 0x3C or 0x3D.");
    Serial.println("[DISPLAY] Check SDA->GPIO21, SCL->GPIO22, and 3.3V power.");
    Serial.println("[DISPLAY] Continuing without display.");
    displayOk = false;
    return;
  }

  // SH1106 begin — address + reset
  if (!display.begin(foundAddr, true)) {
    Serial.println("[DISPLAY] SH1106 allocation failed at 0x" + String(foundAddr, HEX));
    Serial.println("[DISPLAY] Continuing without display.");
    displayOk = false;
    return;
  }

  // Wipe RAM noise immediately
  display.clearDisplay();
  display.display();

  displayOk = true;
  Serial.println("[DISPLAY] OK at address 0x" + String(foundAddr, HEX));
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SH110X_WHITE);
  display.setCursor(0, 0);
  display.println("Room Find RFID");
  display.println("Reader v1.0");
  display.display();
  delay(2000);
}

void updateDisplay(String status, String message) {
  if (!displayOk) return;  // skip if display not initialized
  display.clearDisplay();
  
  // High-contrast header block
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(1);
  display.setCursor(16, 4);
  display.println("ROOM FIND RFID");
  
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println("Status: " + status);
  display.setCursor(0, 32);
  display.println(isConnected ? "Server: Connected" : "Server: Disconnected");
  display.setCursor(0, 44);
  display.println("Room: " + ROOM_ID);
  if (message.length() > 0) {
    display.setCursor(0, 54);
    display.println(message);
  }
  display.display();
}

void showCardScanned(String cardUid) {
  if (!displayOk) return;
  display.clearDisplay();
  
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(1);
  display.setCursor(26, 4);
  display.println("CARD SCANNED");
  
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 22);
  display.println("Card ID:");
  display.setCursor(0, 32);
  display.setTextSize(2);
  display.println(cardUid.substring(cardUid.length() - 8));
  
  display.setTextSize(1);
  display.setCursor(0, 52);
  display.println("Processing...");
  display.display();
  
  // Keep WebSocket alive during display pause
  for (int t = 0; t < 150; t++) { webSocket.loop(); delay(10); } // 1500ms
}

void showGranted(String userName, String start, String end) {
  if (!displayOk) return;
  display.clearDisplay();
  
  // High-contrast header block for WELCOME
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(2);
  display.setCursor(24, 1);
  display.println("WELCOME");
  
  // Reset text color and size
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  
  // Professor Name
  display.setCursor(0, 22);
  display.print("Prof: ");
  if (userName.length() <= 15) {
    display.println(userName);
  } else {
    display.println(userName.substring(0, 15));
  }
  
  // Status message
  display.setCursor(0, 36);
  display.println("Access Granted!");
  
  // Time Slot
  display.setCursor(0, 50);
  display.print("Time: ");
  if (start.length() > 0 && end.length() > 0) {
    display.print(start.substring(0, 5));
    display.print(" - ");
    display.println(end.substring(0, 5));
  } else {
    display.println("Ongoing Class");
  }
  
  display.display();
}

void showCheckedOut(String userName) {
  if (!displayOk) return;
  display.clearDisplay();
  
  // High-contrast header block for GOOD BYE
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(2);
  display.setCursor(12, 1);
  display.println("GOOD BYE!");
  
  // Reset text color and size
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  
  // Professor details
  display.setCursor(0, 24);
  if (userName.length() > 0) {
    if (userName.length() <= 21) {
      display.println(userName);
    } else {
      display.println(userName.substring(0, 21));
    }
  } else {
    display.println("Faculty Member");
  }
  
  display.setCursor(0, 38);
  display.println("Checked Out OK");
  
  display.setCursor(0, 52);
  display.println("Have a nice day!");
  
  display.display();
}

void showDenied(String reason) {
  if (!displayOk) return;
  display.clearDisplay();
  
  // High-contrast header block for DENIED
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(2);
  display.setCursor(28, 1);
  display.println("DENIED");
  
  // Reset text color and size
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  
  display.setCursor(0, 24);
  display.println("Access Denied!");
  
  display.setCursor(0, 38);
  // Word-wrap across 2 lines (21 chars each)
  if (reason.length() <= 21) {
    display.println(reason);
  } else {
    display.println(reason.substring(0, 21));
    display.setCursor(0, 48);
    display.println(reason.substring(21, 42));
  }
  
  display.display();
}

void showTimeoutAlert(String message) {
  if (!displayOk) return;
  display.clearDisplay();
  
  // High-contrast header block for TIME'S UP
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(2);
  display.setCursor(10, 1);
  display.println("TIME'S UP!");
  
  // Reset text color and size
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  
  display.setCursor(0, 24);
  display.println("SESSION EXPIRED");
  
  display.setCursor(0, 38);
  display.println("Please check-out");
  
  display.setCursor(0, 52);
  if (message.length() <= 21) {
    display.println(message);
  } else {
    display.println(message.substring(0, 21));
  }
  
  display.display();
}

void showOccupiedScreen(String userName, String start, String end) {
  if (!displayOk) return;
  display.clearDisplay();
  
  // High-contrast header block for OCCUPIED
  display.fillRect(0, 0, 128, 16, SH110X_WHITE);
  display.setTextColor(SH110X_BLACK);
  display.setTextSize(1);
  display.setCursor(24, 4);
  display.println("ROOM OCCUPIED");
  
  // Reset text color and size
  display.setTextColor(SH110X_WHITE);
  display.setTextSize(1);
  
  // Professor details
  display.setCursor(0, 22);
  display.println("Professor:");
  display.setCursor(0, 32);
  if (userName.length() <= 21) {
    display.println(userName);
  } else {
    display.println(userName.substring(0, 21));
  }
  
  // Time Slot details
  display.setCursor(0, 46);
  display.println("Time Slot:");
  display.setCursor(0, 56);
  if (start.length() > 0 && end.length() > 0) {
    display.print(start.substring(0, 5));
    display.print(" - ");
    display.println(end.substring(0, 5));
  } else {
    display.println("Ongoing Class");
  }
  
  display.display();
}

void resetStandbyScreen() {
  if (isOccupied) {
    showOccupiedScreen(currentProfessor, currentSchStart, currentSchEnd);
  } else {
    updateDisplay("READY", "Scan card");
  }
}
