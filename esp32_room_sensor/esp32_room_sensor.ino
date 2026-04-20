/*
 * ESP32 Room Sensor for Room Find App
 * Monitors room occupancy, door status, temperature, and humidity
 * 
 * Hardware Requirements:
 * - ESP32 Development Board
 * - PIR Motion Sensor (HC-SR501)
 * - Magnetic Door Sensor
 * - DHT22 Temperature/Humidity Sensor
 * - OLED I2C Display (SSD1306 128x64)
 * - LED for status indication
 * 
 * Wiring:
 * - PIR Sensor OUT -> GPIO 4
 * - Door Sensor -> GPIO 2
 * - DHT22 Data -> GPIO 5
 * - OLED SDA -> GPIO 21
 * - OLED SCL -> GPIO 22
 * - LED -> GPIO 18
 */

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// WebSocket Configuration
const char* WEBSOCKET_SERVER = "192.168.1.100"; // Your computer's IP
const uint16_t WEBSOCKET_PORT = 8080;

// Sensor Configuration
#define PIR_PIN 4
#define DOOR_PIN 2
#define DHT_PIN 5
#define LED_PIN 18

// OLED Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C

// Device Configuration
const String DEVICE_ID = "room_sensor_001";
const String ROOM_ID = "1"; // Room this sensor is installed in

// Sensor timing
const unsigned long MOTION_TIMEOUT = 30000; // 30 seconds of no motion = empty
const unsigned long SENSOR_READ_INTERVAL = 5000; // Read sensors every 5 seconds
const unsigned long DOOR_DEBOUNCE_TIME = 1000; // 1 second debounce for door

DHT dht(DHT_PIN, DHT22);
WebSocketsClient webSocket;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// State variables
bool currentOccupancy = false;
bool currentDoorState = false;
float currentTemperature = 0;
float currentHumidity = 0;
unsigned long lastMotionTime = 0;
unsigned long lastSensorRead = 0;
unsigned long lastDoorChange = 0;
bool lastPIRState = false;
bool lastDoorSensorState = false;

// Connection variables
bool isConnected = false;
unsigned long lastReconnectAttempt = 0;
const unsigned long RECONNECT_INTERVAL = 5000;

// Function prototypes
void connectWiFi();
void connectWebSocket();
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length);
void sendSensorEvent();
void sendDoorStatusEvent(String status);
void updateLED();
void readSensors();
void detectOccupancyChange();

void setup() {
  Serial.begin(115200);
  while (!Serial);
  
  // Initialize pins
  pinMode(PIR_PIN, INPUT);
  pinMode(DOOR_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize DHT sensor
  dht.begin();
  
  // Initialize sensor states
  lastPIRState = digitalRead(PIR_PIN);
  lastDoorSensorState = digitalRead(DOOR_PIN);
  currentDoorState = !lastDoorSensorState; // Door sensors are usually active low
  
  Serial.println("ESP32 Room Sensor Starting...");
  Serial.println("Device ID: " + DEVICE_ID);
  Serial.println("Room ID: " + ROOM_ID);
  
  // Connect to WiFi
  connectWiFi();
  
  // Connect to WebSocket
  connectWebSocket();
  
  // Initial sensor reading
  readSensors();
  
  // Initial status indication
  updateLED();
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
  
  // Read sensors periodically
  if (millis() - lastSensorRead > SENSOR_READ_INTERVAL) {
    readSensors();
    detectOccupancyChange();
    lastSensorRead = millis();
  }
  
  // Check for door status changes (interrupt-like behavior)
  bool currentDoorSensorState = digitalRead(DOOR_PIN);
  if (currentDoorSensorState != lastDoorSensorState && millis() - lastDoorChange > DOOR_DEBOUNCE_TIME) {
    currentDoorState = !currentDoorSensorState; // Invert for normally closed sensor
    lastDoorSensorState = currentDoorSensorState;
    lastDoorChange = millis();
    
    String doorStatus = currentDoorState ? "open" : "closed";
    Serial.println("Door status changed: " + doorStatus);
    sendDoorStatusEvent(doorStatus);
  }
  
  // Update status LED
  updateLED();
}

void connectWiFi() {
  Serial.println("Connecting to WiFi...");
  
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
  } else {
    Serial.println("\nFailed to connect to WiFi");
  }
}

void connectWebSocket() {
  Serial.println("Connecting to WebSocket...");
  
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
      break;
      
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      isConnected = true;
      
      // Send device registration
      DynamicJsonDocument doc(1024);
      doc["type"] = "device_register";
      doc["deviceId"] = DEVICE_ID;
      doc["deviceType"] = "room_sensor";
      doc["roomId"] = ROOM_ID;
      doc["timestamp"] = millis();
      
      String message;
      serializeJson(doc, message);
      webSocket.sendTXT(message);
      break;
      
    case WStype_TEXT:
      Serial.println("WebSocket message received: " + String((char*)payload));
      
      // Handle commands from server
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
        } else if (command == "force_read") {
          // Force immediate sensor reading
          readSensors();
          sendSensorEvent();
        }
      }
      break;
      
    case WStype_BIN:
      Serial.println("Binary data received");
      break;
      
    case WStype_ERROR:
      Serial.println("WebSocket error");
      break;
      
    case WStype_FRAGMENT_TEXT_START:
    case WStype_FRAGMENT_BIN_START:
    case WStype_FRAGMENT:
    case WStype_FRAGMENT_FIN:
      break;
  }
}

void readSensors() {
  // Read PIR motion sensor
  bool pirState = digitalRead(PIR_PIN);
  
  if (pirState == HIGH) {
    lastMotionTime = millis();
  }
  
  // Read DHT sensor
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  // Check if readings are valid
  if (!isnan(humidity) && !isnan(temperature)) {
    currentHumidity = humidity;
    currentTemperature = temperature;
  } else {
    Serial.println("Failed to read from DHT sensor!");
  }
  
  // Update occupancy based on motion timeout
  bool newOccupancy = (millis() - lastMotionTime < MOTION_TIMEOUT);
  
  if (newOccupancy != currentOccupancy) {
    currentOccupancy = newOccupancy;
    Serial.println("Occupancy changed: " + String(currentOccupancy ? "occupied" : "empty"));
    sendSensorEvent();
  }
}

void detectOccupancyChange() {
  // This function can implement more sophisticated occupancy detection
  // For now, it just uses the motion timeout logic from readSensors()
  
  // You could add:
  // - CO2 sensor integration
  // - Sound level detection
  // - Multiple PIR sensors
  // - Machine learning for occupancy patterns
}

void sendSensorEvent() {
  DynamicJsonDocument doc(1024);
  
  doc["type"] = "room_sensor";
  doc["deviceId"] = DEVICE_ID;
  doc["roomId"] = ROOM_ID;
  doc["timestamp"] = millis();
  
  // Sensor data
  JsonObject data = doc.createNestedObject("data");
  data["occupancy"] = currentOccupancy;
  data["door_open"] = currentDoorState;
  data["temperature"] = currentTemperature;
  data["humidity"] = currentHumidity;
  
  String message;
  serializeJson(doc, message);
  
  Serial.println("Sending sensor data: " + message);
  webSocket.sendTXT(message);
}

void sendDoorStatusEvent(String status) {
  DynamicJsonDocument doc(1024);
  
  doc["type"] = "door_status";
  doc["deviceId"] = DEVICE_ID;
  doc["roomId"] = ROOM_ID;
  doc["timestamp"] = millis();
  
  // Door status data
  JsonObject data = doc.createNestedObject("data");
  data["status"] = status;
  data["timestamp"] = millis();
  
  String message;
  serializeJson(doc, message);
  
  Serial.println("Sending door status: " + message);
  webSocket.sendTXT(message);
}

void updateLED() {
  if (isConnected) {
    if (currentOccupancy) {
      // Solid green for occupied
      digitalWrite(LED_PIN, HIGH);
    } else {
      // Slow blink for empty
      static unsigned long lastBlink = 0;
      if (millis() - lastBlink > 2000) {
        digitalWrite(LED_PIN, !digitalRead(LED_PIN));
        lastBlink = millis();
      }
    }
  } else {
    // Fast blink for disconnected
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      lastBlink = millis();
    }
  }
}
