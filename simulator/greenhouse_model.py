"""
Greenhouse model - Python version.

The same physical model as dashboard/src/simulation/greenhouseModel.js.
It produces realistic sensor values that follow a day/night cycle and
react to the actuators (fan, pump, LED lights).

Author: Emad Abouelsaad
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field

SCENARIOS = {
    "normal": {},
    "hotDay": {"temp_offset": 14, "temperature": 37},
    "coldNight": {"temp_offset": -14, "temperature": 9, "hour": 2},
    "drySoil": {"soilMoisture": 14},
    "wetSoil": {"soilMoisture": 82},
    "lowLight": {"cloud": 0.15, "hour": 18.5},
    "poorAir": {"airQuality": 1650},
}


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


@dataclass
class GreenhouseModel:
    hour: float = 10.0          # simulated hour of the day (0-24)
    temp_offset: float = 0.0    # scenario offset of the outside temperature
    cloud: float = 1.0          # 1 = clear sky, 0 = very cloudy
    seed: int = 1
    actuators: dict = field(default_factory=lambda: {"fan": "OFF", "pump": "OFF", "light": "OFF"})
    state: dict = field(default_factory=lambda: {
        "temperature": 24.0, "humidity": 62.0, "soilMoisture": 48.0, "lightLevel": 70.0, "airQuality": 520.0,
    })

    def __post_init__(self) -> None:
        self.rand = random.Random(self.seed)
        self.scenario = "normal"

    def set_actuator(self, name: str, value: str) -> None:
        self.actuators[name] = "ON" if value == "ON" else "OFF"

    def apply_scenario(self, name: str) -> None:
        params = SCENARIOS.get(name, {})
        self.temp_offset = params.get("temp_offset", 0)
        self.cloud = params.get("cloud", 1)
        self.hour = params.get("hour", self.hour)
        for key in self.state:
            if key in params:
                self.state[key] = params[key]
        self.scenario = name

    def outside_temperature(self) -> float:
        return 14 + 8 * math.sin(2 * math.pi * (self.hour - 9) / 24) + self.temp_offset

    def sunlight(self) -> float:
        if self.hour < 6 or self.hour > 20:
            return 0.0
        return max(0.0, math.sin(math.pi * (self.hour - 6) / 14)) * self.cloud

    def step(self, dt_minutes: float = 1.0) -> dict:
        s = self.state
        fan = self.actuators["fan"] == "ON"
        pump = self.actuators["pump"] == "ON"
        led = self.actuators["light"] == "ON"
        sun = self.sunlight()

        def k(rate: float) -> float:
            return 1 - math.exp(-rate * dt_minutes)

        def noise(a: float) -> float:
            return (self.rand.random() - 0.5) * a

        self.hour = (self.hour + dt_minutes / 60) % 24

        target_t = self.outside_temperature() + 12 * sun - (7 if fan else 0)
        s["temperature"] += (target_t - s["temperature"]) * k(0.05) + noise(0.2)

        target_h = 88 - 1.5 * (s["temperature"] - 15) - (12 if fan else 0) + (6 if pump else 0)
        s["humidity"] += (clamp(target_h, 20, 98) - s["humidity"]) * k(0.06) + noise(0.6)

        s["soilMoisture"] += (-(0.03 + 0.03 * sun) + (1.6 if pump else 0)) * dt_minutes + noise(0.15)

        target_l = 100 * sun + (45 if led else 0)
        s["lightLevel"] += (clamp(target_l, 0, 100) - s["lightLevel"]) * k(0.5) + noise(1.0)

        if fan:
            target_c = 430
        elif sun > 0.2:
            target_c = 380 + 320 * (1 - sun)
        else:
            target_c = 950
        s["airQuality"] += (target_c - s["airQuality"]) * k(0.12 if fan else 0.02) + noise(6)

        s["humidity"] = clamp(s["humidity"], 0, 100)
        s["soilMoisture"] = clamp(s["soilMoisture"], 0, 100)
        s["lightLevel"] = clamp(s["lightLevel"], 0, 100)
        s["airQuality"] = clamp(s["airQuality"], 350, 5000)
        return self.readings()

    def readings(self) -> dict:
        s = self.state
        return {
            "temperature": round(s["temperature"], 1),
            "humidity": round(s["humidity"], 1),
            "soilMoisture": round(s["soilMoisture"]),
            "lightLevel": round(s["lightLevel"]),
            "airQuality": round(s["airQuality"]),
        }


def decide_actuators(readings: dict, states: dict, rules: dict | None = None) -> dict:
    """Automatic control rules with hysteresis (same as the firmware)."""
    r = {
        "fan": {"onAbove": 30, "offBelow": 28},
        "pump": {"onBelow": 30, "offAbove": 60},
        "light": {"onBelow": 40, "offAbove": 70},
    }
    if rules:
        for dev, values in rules.items():
            r[dev] = {**r.get(dev, {}), **values}
    nxt = {"fan": "OFF", "pump": "OFF", "light": "OFF", **states}
    t, soil, light = readings.get("temperature"), readings.get("soilMoisture"), readings.get("lightLevel")
    if t is not None:
        if t > r["fan"]["onAbove"]:
            nxt["fan"] = "ON"
        elif t < r["fan"]["offBelow"]:
            nxt["fan"] = "OFF"
    if soil is not None:
        if soil < r["pump"]["onBelow"]:
            nxt["pump"] = "ON"
        elif soil > r["pump"]["offAbove"]:
            nxt["pump"] = "OFF"
    if light is not None:
        if light < r["light"]["onBelow"]:
            nxt["light"] = "ON"
        elif light > r["light"]["offAbove"]:
            nxt["light"] = "OFF"
    return nxt
