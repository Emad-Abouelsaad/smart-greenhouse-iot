# Testing

The system was tested at four levels. Because the hardware is not installed in a real greenhouse, the sensors are
replaced by the **virtual ESP8266** and the **greenhouse model** (simulation mode). The software that runs in the
browser, the database logic, the alert rules and the control logic are the same in simulation and live mode.

| Level | Tool | What is tested | Tests | Result |
|---|---|---|---|---|
| Unit and integration | Vitest | alert thresholds, automation rules, CSV export, form validation, database adapter, authentication, greenhouse model, virtual ESP8266, cloud logic | 29 | ✅ all passed |
| Unit | node:test | Cloud Functions alert rules | 3 | ✅ all passed |
| Unit | pytest | Python greenhouse model, automation rules, simulator CSV output | 6 | ✅ all passed |
| End-to-end | Playwright (Chromium) | complete user scenarios TC-01 … TC-13 on the production build | 26 | ✅ all passed |
| Build | Arduino CLI (ESP8266 core 3.1.2) | firmware compiles for NodeMCU 1.0 | 1 | ✅ compiled |

Last run: 4 October 2026.

## End-to-end test cases

| ID | Test case | Steps | Result |
|---|---|---|---|
| TC-01 | Login | open login page; correct email + password → home page; wrong email → "no account" message with reset option; wrong password → "password is incorrect" message; wrong email + wrong password → account not available; empty fields → validation message | Pass (6/6) |
| TC-02 | Sign up | enter first name, last name, email, password; correct confirm password → account created, login page opens; wrong confirm password → error and the field is cleared; new account can log in; already registered email → error | Pass (5/5) |
| TC-03 | Real-time monitoring | all five values are shown; "last update" changes automatically; chart is displayed | Pass |
| TC-04 | Soil moisture | normal → "Normal"; over-watered → warning; dry soil → alert, pump can be switched on | Pass (3/3) |
| TC-05 | Temperature & humidity | normal → "Normal"; hot day → alert, fan can be switched on; cold night → low temperature alert, fan stays off | Pass (3/3) |
| TC-06 | Light level | sufficient light → "Normal"; low light → alert, LED lights can be switched on | Pass (2/2) |
| TC-07 | Air quality | poor ventilation → alert; after switching on the fan the value returns to "Normal" | Pass |
| TC-08 | Manual control | fan, pump and lights switch ON and OFF and the status is confirmed by the device | Pass |
| TC-09 | Automatic mode | with automatic mode ON and high temperature the fan switches on by itself; manual buttons are disabled | Pass |
| TC-10 | History & export | readings are stored; CSV file is downloaded with header and data rows | Pass |
| TC-11 | Settings | changed temperature threshold is saved and used for the alerts | Pass |
| TC-12 | Access control | protected pages redirect to login; logout works | Pass |
| TC-13 | Responsive design | dashboard on a 390 × 844 px screen (smartphone) without horizontal scrolling | Pass |

## Hardware test plan (for a future installation)

These tests need the physical components and are planned for the installation phase:

| ID | Test | Expected result |
|---|---|---|
| HW-01 | Compare DHT11 readings with a reference thermometer/hygrometer | difference ≤ 2 °C and ≤ 5 % RH |
| HW-02 | Soil sensor in dry soil, moist soil and water | readings close to 0 %, 40–60 %, 100 % after calibration |
| HW-03 | Cover / light the LDR | light level follows the change within 5 s |
| HW-04 | Relay switching from the dashboard | actuator switches within 2 s, status confirmed |
| HW-05 | Pump safety | pump stops after 60 s even if the command is still ON |
| HW-06 | Wi-Fi loss | automatic mode keeps working offline; data is sent again after reconnection |
| HW-07 | 72-hour run | no restarts, no missing data longer than 1 minute |

## How to run the tests

```bash
cd dashboard && npm test && npx playwright test
cd functions && npm test
cd simulator && pytest -q
```
