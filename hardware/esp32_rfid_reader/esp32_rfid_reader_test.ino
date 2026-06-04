/*
 * ESP32 + MFRC522 RFID Hardware Test
 *
 * Purpose:
 * - Verify RFID reader wiring/power/card compatibility
 * - Print card UID to Serial Monitor
 * - No WiFi / WebSocket / OLED dependencies
 *
 * Wiring (must match):
 *   MFRC522 SDA(SS) -> GPIO 5
 *   MFRC522 SCK     -> GPIO 18
 *   MFRC522 MOSI    -> GPIO 23
 *   MFRC522 MISO    -> GPIO 19
 *   MFRC522 RST     -> GPIO 15
 *   MFRC522 3.3V    -> 3.3V
 *   MFRC522 GND     -> GND
 *
 * Notes:
 * - RC522 reads 13.56MHz cards/tags (MIFARE/NFC), not 125kHz cards.
 * - Serial Monitor baud: 115200
 */

#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN 5
#define RST_PIN 15

MFRC522 mfrc522(SS_PIN, RST_PIN);

unsigned long lastHealthPrint = 0;
const unsigned long HEALTH_PRINT_INTERVAL_MS = 2000;

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    // Wait for Serial (useful for some boards/USB bridges)
  }

  Serial.println();
  Serial.println("=== ESP32 RFID Test Start ===");
  Serial.println("Initializing SPI + MFRC522...");

  SPI.begin();              // SCK=18, MISO=19, MOSI=23, SS handled by library
  mfrc522.PCD_Init();       // Init MFRC522
  delay(100);

  byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
  Serial.print("RC522 VersionReg: 0x");
  Serial.println(version, HEX);

  if (version == 0x00 || version == 0xFF) {
    Serial.println("ERROR: RC522 not responding. Check 3.3V power and SPI wiring.");
  } else {
    Serial.println("RC522 detected. Tap a card/tag now...");
  }
}

void loop() {
  // Periodic health check so you can confirm reader remains alive
  if (millis() - lastHealthPrint >= HEALTH_PRINT_INTERVAL_MS) {
    lastHealthPrint = millis();
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    Serial.print("[health] RC522 VersionReg: 0x");
    Serial.println(version, HEX);
  }

  // Detect new card presence
  if (!mfrc522.PICC_IsNewCardPresent()) {
    delay(20);
    return;
  }

  // Read card UID
  if (!mfrc522.PICC_ReadCardSerial()) {
    Serial.println("Card detected but UID read failed.");
    delay(200);
    return;
  }

  // Print UID in uppercase hex (same style as your app sketch)
  String cardUid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) cardUid += "0";
    cardUid += String(mfrc522.uid.uidByte[i], HEX);
  }
  cardUid.toUpperCase();

  Serial.print("CARD UID: ");
  Serial.println(cardUid);
  Serial.print("UID length (bytes): ");
  Serial.println(mfrc522.uid.size);
  Serial.println("------------------------------");

  // Halt current card communication
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  // Small debounce to avoid repeated rapid prints
  delay(1000);
}

