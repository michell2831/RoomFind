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
 * - MFRC522 SDA -> GPIO 5
 * - MFRC522 SCK -> GPIO 18
 * - MFRC522 MOSI -> GPIO 23
 * - MFRC522 MISO -> GPIO 19
 * - MFRC522 RST -> GPIO 22
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
#include <Adafruit_SSD1306.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// WebSocket Configuration
const char* WEBSOCKET_SERVER = "192.168.1.100"; // Your computer's IP
const uint16_t WEBSOCKET_PORT = 8082;

// RFID Configuration
#define RST_PIN 22
#define SS_PIN 5
#define LED_PIN 2
#define BUZZER_PIN 4

// OLED Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// Device Configuration
const String DEVICE_ID = "rfid_reader_001";
const String ROOM_ID = "1"; // Room this reader is installed in

MFRC522 mfrc522(SS_PIN, RST_PIN);
WebSocketsClient webSocket;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Variables
unsigned long lastCardTime = 0;
const unsigned long CARD_READ_DELAY = 3000; // 3 seconds between reads
bool isConnected = false;
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 5000;

// Function prototypes
void connectWiFi();
void connectWebSocket();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void sendRFIDEvent(String cardUid, String action);
void indicateSuccess();
void indicateError();
void indicateProcessing();
void initDisplay();
void updateDisplay(String status, String message = "");
void showCardScanned(String cardUid);

void setup() {
  Serial.begin(115200);
  while (!Serial);
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  // Initialize OLED display
  initDisplay();
  
  // Initialize RFID reader
  SPI.begin();
  mfrc522.PCD_Init();
  mfrc522.PCD_DumpVersionToSerial();
  
  Serial.println("ESP32 RFID Reader Starting...");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("Room ID: " + ROOM_ID);
  
  updateDisplay("STARTING", "Initializing...");
  
  // Connect to WiFi
  connectWiFi();
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Initial status indication
  indicateSuccess();
}

void loop() {
  // Handle WebSocket connection
  webSocket.loop();
  
  // Reconnect WiFi if needed
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      connectWiFi();
      lastReconnectAttempt = millis();
    }
  }
  
  // Reconnect WebSocket if needed
  if (!isConnected && WiFi.status() == WL_CONNECTED) {
    if (millis() - lastReconnectAttempt > RECONNECT_INTERVAL) {
      connectWebSocket();
      lastReconnectAttempt = millis();
    }
  }
  
  // Check for RFID cards
  if (mfrc522.PICC_IsNewCardPresent() && mfrc522.PICC_ReadCardSerial()) {
    // Prevent multiple reads of the same card
    if (millis() - lastCardTime > CARD_READ_DELAY) {
      String cardUid = "";
      
      // Read card UID
      for (byte i = 0; i < mfrc522.uid.size; i++) {
        cardUid += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
        cardUid += String(mfrc522.uid.uidByte[i], HEX);
      }
      cardUid.toUpperCase();
      
      Serial.println("Card detected: " + cardUid);
      indicateProcessing();
      
      // Show card on OLED display
      showCardScanned(cardUid);
      
      // Send RFID scan event
      sendRFIDEvent(cardUid, "check_in");
      
      lastCardTime = millis();
      indicateSuccess();
    }
    
    // Halt PICC
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
  }
  
  // Status LED blink when connected
  if (isConnected) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 2000) {
      digitalWrite(LED_PIN, HIGH);
      delay(100);
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
    Serial.println("\nWiFi connected!");
    Serial.println("IP address: " + WiFi.localIP().toString());
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
      indicateError();
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      isConnected = true;
      updateDisplay("READY", "Scan card");
      
      // Send device registration
      {
        DynamicJsonDocument doc(1024);
        doc["type"] = "device_register";
        doc["deviceId"] = DEVICE_ID;
        doc["deviceType"] = "rfid_reader";
        doc["roomId"] = ROOM_ID;
        doc["timestamp"] = millis();
        
        String message;
        serializeJson(doc, message);
        webSocket.sendTXT(message);
      }
      
      indicateSuccess();
      break;
      
    case WStype_TEXT:
      Serial.println("WebSocket message received: " + String((char*)payload));
      
      // Handle commands from server
      {
        DynamicJsonDocument doc(512);
        DeserializationError error = deserializeJson(doc, payload);
        
        if (!error) {
          String command = doc["command"];
          
          if (command == "ping") {
            // Respond to ping
            DynamicJsonDocument response(256);
            response["type"] = "pong";
            response["deviceId"] = DEVICE_ID;
            response["timestamp"] = millis();
            
            String responseStr;
            serializeJson(response, responseStr);
            webSocket.sendTXT(responseStr);
          }
        }
      }
      break;
      
    case WStype_BIN:
      Serial.println("Binary data received");
      break;
      
    case WStype_ERROR:
      Serial.println("WebSocket error");
      indicateError();
      break;
      
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
  }
}

void sendRFIDEvent(String cardUid, String action) {
  DynamicJsonDocument doc(1024);
  
  doc["type"] = "rfid_scan";
  doc["deviceId"] = DEVICE_ID;
  doc["roomId"] = ROOM_ID;
  doc["timestamp"] = millis();
  
  // RFID scan data
  JsonObject data = doc.createNestedObject("data");
  data["card_uid"] = cardUid;
  data["action"] = action;
  
  String message;
  serializeJson(doc, message);
  
  Serial.println("Sending: " + message);
  webSocket.sendTXT(message);
}

void indicateSuccess() {
  // Green LED flash and success tone
  digitalWrite(LED_PIN, HIGH);
  tone(BUZZER_PIN, 1000, 100);
  delay(100);
  tone(BUZZER_PIN, 1500, 100);
  delay(100);
  digitalWrite(LED_PIN, LOW);
}

void indicateError() {
  // Red LED flash and error tone
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 500, 200);
    delay(200);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}

void indicateProcessing() {
  // Fast blink and processing tone
  for (int i = 0; i < 2; i++) {
    digitalWrite(LED_PIN, HIGH);
    tone(BUZZER_PIN, 800, 50);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    delay(50);
  }
}

// OLED Display Functions
void initDisplay() {
  Wire.begin(21, 22); // SDA=GPIO21, SCL=GPIO22
  
  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("SSD1306 allocation failed"));
    for(;;); // Don't proceed, loop forever
  }
  
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("Room Find RFID");
  display.println("Reader v1.0");
  display.display();
  delay(2000);
}

void updateDisplay(String status, String message) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Header
  display.setCursor(0,0);
  display.println("Room Find RFID");
  display.drawLine(0, 12, 127, 12, SSD1306_WHITE);
  
  // Status
  display.setCursor(0, 16);
  display.println("Status: " + status);
  
  // Connection indicator
  display.setCursor(0, 28);
  if (isConnected) {
    display.println("Server: Connected");
  } else {
    display.println("Server: Disconnected");
  }
  
  // Room info
  display.setCursor(0, 40);
  display.println("Room: " + ROOM_ID);
  
  // Message
  if (message.length() > 0) {
    display.setCursor(0, 52);
    display.println(message);
  }
  
  display.display();
}

void showCardScanned(String cardUid) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  // Header
  display.setCursor(0,0);
  display.println("CARD SCANNED!");
  display.drawLine(0, 12, 127, 12, SSD1306_WHITE);
  
  // Card UID (show last 8 characters)
  display.setCursor(0, 16);
  display.println("Card ID:");
  display.setCursor(0, 26);
  display.setTextSize(2);
  String shortUid = cardUid.substring(cardUid.length() - 8);
  display.println(shortUid);
  
  display.setTextSize(1);
  display.setCursor(0, 46);
  display.println("Processing...");
  
  display.display();
  
  // Show for 3 seconds then return to normal display
  delay(3000);
  updateDisplay("READY", "Scan card");
}
