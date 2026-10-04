/*
 * Smart Greenhouse System - NodeMCU ESP8266 firmware
 * Author: Emad Abouelsaad (Akademia WSB, Mobile and Cloud Computing)
 *
 * Responsibilities of the node:
 *  1. Read the sensors: DHT11 (temperature, humidity) and, through an
 *     ADS1115 16-bit ADC, the soil moisture sensor, the LDR light sensor and
 *     the MQ-135 air quality sensor (the ESP8266 has only one analog input).
 *  2. Send the readings to Firebase Realtime Database (/esp8266) every 5 s.
 *  3. Execute the commands written by the web dashboard
 *     (/esp8266/<device>/control = "ON" | "OFF") and report the result in
 *     /esp8266/<device>/status.
 *  4. Automatic mode (/settings/autoMode): apply the control rules locally,
 *     so the greenhouse keeps working even when the internet is down.
 *  5. Safety: the pump is never ON for longer than PUMP_MAX_RUN_MS. After a
 *     safety stop, automatic mode cannot restart it for PUMP_LOCKOUT_MS.
 *
 * Database paths are the same as in the dashboard and in the simulator.
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <Wire.h>
#include <DHT.h>
#include <Adafruit_ADS1X15.h>
#include <Firebase_ESP_Client.h>
#include <addons/TokenHelper.h>

#include "config.h"   // Wi-Fi and Firebase credentials (copy config.example.h)

// ---------------- pins (NodeMCU) ----------------
// I2C for the ADS1115: SDA = D2 (GPIO4), SCL = D1 (GPIO5)
#define DHT_PIN      D4
#define DHT_TYPE     DHT11
#define FAN_PIN      D5
#define PUMP_PIN     D6
#define LIGHT_PIN    D7
#define RELAY_ACTIVE LOW          // most relay boards are active LOW

// ADS1115 channels
#define CH_SOIL 0
#define CH_LDR  1
#define CH_MQ135 2

// ---------------- timing ----------------
const unsigned long SEND_INTERVAL_MS     = 5000;   // sensor readings
const unsigned long CONTROL_POLL_MS      = 1000;   // dashboard commands
const unsigned long SETTINGS_POLL_MS     = 10000;  // automatic mode settings
const unsigned long PUMP_MAX_RUN_MS      = 60000;  // safety limit for the pump
const unsigned long PUMP_LOCKOUT_MS      = 600000; // no automatic restart for 10 min after a safety stop

// ---------------- calibration ----------------
// Raw ADS1115 values (gain 1, 0-4.096 V) measured in dry air and in water.
const int16_t SOIL_DRY = 21000;
const int16_t SOIL_WET = 9000;
const int16_t LDR_DARK = 200;
const int16_t LDR_BRIGHT = 25000;
const float   MQ135_PPM_PER_VOLT = 600.0;   // linear approximation, see docs/hardware.md
const float   MQ135_BASE_PPM = 400.0;
const float   MQ135_BASE_VOLT = 0.45;

// ---------------- automation rules (defaults, can be changed from the dashboard) -------
struct Rules {
  float fanOnAbove = 30, fanOffBelow = 28;
  float pumpOnBelow = 30, pumpOffAbove = 60;
  float lightOnBelow = 40, lightOffAbove = 70;
} rules;

// ---------------- globals ----------------
DHT dht(DHT_PIN, DHT_TYPE);
Adafruit_ADS1115 ads;
bool adsReady = false;

FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

struct Readings { float temperature, humidity, soil, light, air; bool valid; } last;

const char *DEVICES[3] = {"fan", "pump", "light"};
const uint8_t DEVICE_PINS[3] = {FAN_PIN, PUMP_PIN, LIGHT_PIN};
bool deviceOn[3] = {false, false, false};
String lastCommand[3] = {"", "", ""};
bool autoMode = false;
unsigned long pumpStartedAt = 0;
unsigned long pumpSafetyStopAt = 0;   // 0 = no safety stop yet
unsigned long lastSend = 0, lastControlPoll = 0, lastSettingsPoll = 0;

// ------------------------------------------------------------------
float mapPercent(int16_t raw, int16_t low, int16_t high) {
  float p = (float)(raw - low) * 100.0f / (float)(high - low);
  return constrain(p, 0.0f, 100.0f);
}

Readings readSensors() {
  Readings r;
  r.temperature = dht.readTemperature();
  r.humidity = dht.readHumidity();
  r.valid = !(isnan(r.temperature) || isnan(r.humidity));
  if (adsReady) {
    r.soil = mapPercent(ads.readADC_SingleEnded(CH_SOIL), SOIL_DRY, SOIL_WET);
    r.light = mapPercent(ads.readADC_SingleEnded(CH_LDR), LDR_DARK, LDR_BRIGHT);
    float volts = ads.computeVolts(ads.readADC_SingleEnded(CH_MQ135));
    r.air = max(350.0f, MQ135_BASE_PPM + (volts - MQ135_BASE_VOLT) * MQ135_PPM_PER_VOLT);
  } else {
    r.soil = r.light = r.air = NAN;
  }
  return r;
}

void setDevice(uint8_t i, bool on) {
  if (deviceOn[i] == on) return;
  deviceOn[i] = on;
  digitalWrite(DEVICE_PINS[i], on ? RELAY_ACTIVE : !RELAY_ACTIVE);
  if (i == 1) pumpStartedAt = on ? millis() : 0;
  Serial.printf("%s turned %s\n", DEVICES[i], on ? "ON" : "OFF");
  if (Firebase.ready()) {
    String path = String("/esp8266/") + DEVICES[i] + "/status";
    Firebase.RTDB.setString(&fbdo, path, on ? "ON" : "OFF");
  }
}

void sendReadings(const Readings &r) {
  FirebaseJson json;
  json.set("temperature", round(r.temperature * 10) / 10.0);
  json.set("humidity", round(r.humidity * 10) / 10.0);
  if (!isnan(r.soil)) json.set("soilMoisture", (int)round(r.soil));
  if (!isnan(r.light)) json.set("lightLevel", (int)round(r.light));
  if (!isnan(r.air)) json.set("airQuality", (int)round(r.air));
  json.set("lastUpdate/.sv", "timestamp");   // server time in milliseconds
  if (Firebase.RTDB.updateNode(&fbdo, "/esp8266", &json)) {
    Serial.printf("Sent: T=%.1f C, H=%.1f %%, Soil=%.0f %%, Light=%.0f %%, Air=%.0f ppm\n",
                  r.temperature, r.humidity, r.soil, r.light, r.air);
  } else {
    Serial.printf("Send failed: %s\n", fbdo.errorReason().c_str());
  }
}

// Reads /esp8266/<device>/control and applies new commands only once.
void pollCommands() {
  if (autoMode) return;                       // manual commands are ignored in automatic mode
  if (!Firebase.RTDB.getJSON(&fbdo, "/esp8266")) return;
  FirebaseJson &json = fbdo.to<FirebaseJson>();
  FirebaseJsonData item;
  for (uint8_t i = 0; i < 3; i++) {
    String cmd = "";
    if (json.get(item, String(DEVICES[i]) + "/control") && item.success) cmd = item.to<String>();
    if (cmd != lastCommand[i]) {
      lastCommand[i] = cmd;                   // empty = command was removed after 30 s
      if (cmd == "ON") setDevice(i, true);
      else if (cmd == "OFF") setDevice(i, false);
    }
  }
}

void readNumber(FirebaseJson &json, const char *path, float &target) {
  FirebaseJsonData d;
  if (json.get(d, path) && d.success) target = d.to<float>();
}

void pollSettings() {
  if (!Firebase.RTDB.getJSON(&fbdo, "/settings")) return;
  FirebaseJson &json = fbdo.to<FirebaseJson>();
  FirebaseJsonData d;
  bool newAuto = json.get(d, "autoMode") && d.success && d.to<bool>();
  if (newAuto != autoMode) {
    autoMode = newAuto;
    Serial.printf("Automatic mode %s\n", autoMode ? "enabled" : "disabled");
  }
  readNumber(json, "automation/fan/onAbove", rules.fanOnAbove);
  readNumber(json, "automation/fan/offBelow", rules.fanOffBelow);
  readNumber(json, "automation/pump/onBelow", rules.pumpOnBelow);
  readNumber(json, "automation/pump/offAbove", rules.pumpOffAbove);
  readNumber(json, "automation/light/onBelow", rules.lightOnBelow);
  readNumber(json, "automation/light/offAbove", rules.lightOffAbove);
}

// True for PUMP_LOCKOUT_MS after a safety stop (the subtraction is safe when millis() rolls over).
bool pumpLocked() {
  return pumpSafetyStopAt != 0 && millis() - pumpSafetyStopAt < PUMP_LOCKOUT_MS;
}

// Same rules as dashboard/src/logic/autoControl.js (hysteresis).
void applyAutomation(const Readings &r) {
  if (!autoMode || !r.valid) return;
  if (r.temperature > rules.fanOnAbove) setDevice(0, true);
  else if (r.temperature < rules.fanOffBelow) setDevice(0, false);
  if (!isnan(r.soil)) {
    // if the soil is still dry after a safety stop (empty tank, broken sensor),
    // do not keep restarting the pump
    if (r.soil < rules.pumpOnBelow && !pumpLocked()) setDevice(1, true);
    else if (r.soil > rules.pumpOffAbove) setDevice(1, false);
  }
  if (!isnan(r.light)) {
    if (r.light < rules.lightOnBelow) setDevice(2, true);
    else if (r.light > rules.lightOffAbove) setDevice(2, false);
  }
}

void checkPumpSafety() {
  if (deviceOn[1] && millis() - pumpStartedAt > PUMP_MAX_RUN_MS) {
    Serial.println("Safety: pump stopped after maximum run time");
    setDevice(1, false);
    pumpSafetyStopAt = millis();
    if (pumpSafetyStopAt == 0) pumpSafetyStopAt = 1;   // 0 means "no safety stop"
    if (Firebase.ready()) Firebase.RTDB.deleteNode(&fbdo, "/esp8266/pump/control");
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.printf("Connecting to Wi-Fi \"%s\"", WIFI_SSID);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\nWi-Fi connected, IP: " + WiFi.localIP().toString()
                                               : String("\nWi-Fi not available, running offline"));
}

void setup() {
  Serial.begin(115200);
  Serial.println("\nSmart Greenhouse node starting...");

  for (uint8_t i = 0; i < 3; i++) {
    pinMode(DEVICE_PINS[i], OUTPUT);
    digitalWrite(DEVICE_PINS[i], !RELAY_ACTIVE);   // all actuators OFF at start
  }
  dht.begin();
  Wire.begin(D2, D1);
  adsReady = ads.begin();
  if (adsReady) ads.setGain(GAIN_ONE);
  else Serial.println("ADS1115 not found - check the I2C wiring");

  connectWiFi();

  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  auth.user.email = DEVICE_EMAIL;          // a dedicated user account for the device
  auth.user.password = DEVICE_PASSWORD;
  config.token_status_callback = tokenStatusCallback;
  Firebase.reconnectNetwork(true);
  fbdo.setBSSLBufferSize(4096, 1024);      // keep memory usage low on the ESP8266
  Firebase.begin(&config, &auth);

  for (uint8_t i = 0; i < 3; i++) {
    if (Firebase.ready()) Firebase.RTDB.setString(&fbdo, String("/esp8266/") + DEVICES[i] + "/status", "OFF");
  }
}

void loop() {
  unsigned long now = millis();

  if (now - lastSend >= SEND_INTERVAL_MS || lastSend == 0) {
    lastSend = now;
    last = readSensors();
    if (!last.valid) Serial.println("Failed to read from the DHT sensor");
    applyAutomation(last);                 // works also without internet
    if (last.valid && Firebase.ready()) sendReadings(last);
  }

  if (Firebase.ready() && now - lastControlPoll >= CONTROL_POLL_MS) {
    lastControlPoll = now;
    pollCommands();
  }

  if (Firebase.ready() && (now - lastSettingsPoll >= SETTINGS_POLL_MS || lastSettingsPoll == 0)) {
    lastSettingsPoll = now;
    pollSettings();
  }

  checkPumpSafety();
  delay(20);
}
