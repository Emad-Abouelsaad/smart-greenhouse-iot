# Hardware design

The hardware part of the system is designed around the **NodeMCU ESP8266** development board.
Because the ESP8266 has only one analog input (A0), the three analog sensors are connected through an
**ADS1115** 16-bit analog-to-digital converter on the I²C bus.

## Components (bill of materials)

| # | Component | Purpose | Qty | Approx. price |
|---|---|---|---|---|
| 1 | NodeMCU ESP8266 (ESP-12E) | Microcontroller with Wi-Fi | 1 | 25 PLN |
| 2 | DHT11 | Air temperature and humidity | 1 | 10 PLN |
| 3 | Capacitive soil moisture sensor v1.2 | Soil moisture | 1 | 10 PLN |
| 4 | LDR (GL5528) + 10 kΩ resistor | Light level | 1 | 3 PLN |
| 5 | MQ-135 module | Air quality (CO₂ equivalent) | 1 | 15 PLN |
| 6 | ADS1115 module | 4-channel 16-bit ADC (I²C) | 1 | 20 PLN |
| 7 | 4-channel 5 V relay module (opto-isolated) | Switching the actuators | 1 | 20 PLN |
| 8 | 12 V DC fan | Ventilation | 1 | 20 PLN |
| 9 | 12 V DC submersible pump + tube | Irrigation | 1 | 30 PLN |
| 10 | 12 V LED grow light strip | Supplementary lighting | 1 | 35 PLN |
| 11 | 12 V 3 A power supply + LM2596 step-down (5 V) | Power | 1 | 40 PLN |
| 12 | Breadboard, jumper wires, terminal blocks | Wiring | – | 20 PLN |
| | **Total (laboratory prototype)** | | | **≈ 250 PLN** |

> The prototype only covers one small growing area. A system for a real greenhouse needs the greenhouse
> structure, industrial sensors for several zones, a professional irrigation and ventilation installation and
> a weather-proof electrical cabinet. This cost is far higher and is outside the scope of the thesis, so the
> system is validated with the simulation described in [testing.md](testing.md).

## Wiring

| Component pin | NodeMCU pin | Notes |
|---|---|---|
| DHT11 DATA | D4 (GPIO2) | 10 kΩ pull-up to 3.3 V |
| ADS1115 SDA | D2 (GPIO4) | I²C |
| ADS1115 SCL | D1 (GPIO5) | I²C |
| ADS1115 VDD / GND | 3V3 / GND | |
| Soil sensor AOUT | ADS1115 A0 | |
| LDR divider output | ADS1115 A1 | LDR to 3.3 V, 10 kΩ to GND |
| MQ-135 AOUT | ADS1115 A2 | sensor heater powered from 5 V; output divided to ≤ 3.3 V |
| Relay IN1 (fan) | D5 (GPIO14) | active LOW |
| Relay IN2 (pump) | D6 (GPIO12) | active LOW |
| Relay IN3 (lights) | D7 (GPIO13) | active LOW |
| Relay VCC / GND | 5 V (Vin) / GND | |

```text
              +---------------------+
   DHT11 ---- | D4                  |
              |                D5   | ---- Relay 1 ---- Fan (12 V)
 ADS1115 SDA -| D2  NodeMCU    D6   | ---- Relay 2 ---- Pump (12 V)
 ADS1115 SCL -| D1  ESP8266    D7   | ---- Relay 3 ---- LED lights (12 V)
              |                     |
              | 3V3  GND  Vin(5V)   |
              +---------------------+
 ADS1115: A0 = soil moisture, A1 = LDR, A2 = MQ-135
```

## Calibration

The calibration constants are at the top of `firmware/greenhouse_esp8266/greenhouse_esp8266.ino`:

- **Soil moisture**: read the raw value with the sensor in dry air (`SOIL_DRY`) and in a glass of water (`SOIL_WET`).
- **Light**: raw value in darkness (`LDR_DARK`) and in direct light (`LDR_BRIGHT`).
- **MQ-135**: after 24 h of pre-heating, measure the output voltage in fresh outdoor air (≈ 400 ppm CO₂) and store it in
  `MQ135_BASE_VOLT`. The firmware uses a linear approximation, which is enough to detect poor ventilation; it is not a
  laboratory CO₂ meter.

## Firmware build

- Arduino IDE 2.x or Arduino CLI, board **NodeMCU 1.0 (ESP-12E Module)**, ESP8266 core 3.1.2
- Libraries: *Firebase Arduino Client Library for ESP8266 and ESP32* 4.4.x (Mobizt), *DHT sensor library* (Adafruit),
  *Adafruit ADS1X15*, *Adafruit Unified Sensor*, *Adafruit BusIO*
- Copy `config.example.h` to `config.h` and enter the Wi-Fi and Firebase values.

Build result (Arduino CLI): RAM 38 908 / 80 192 bytes (48 %), flash 518 064 / 1 048 576 bytes (49 %).
