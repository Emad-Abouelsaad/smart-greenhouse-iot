"""Unit tests for the Python greenhouse model and control rules."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from greenhouse_model import GreenhouseModel, decide_actuators  # noqa: E402
from esp8266_simulator import main  # noqa: E402


def run(model, minutes):
    for _ in range(minutes):
        model.step(1)


def test_fan_cools_the_greenhouse():
    a, b = GreenhouseModel(hour=13), GreenhouseModel(hour=13)
    b.set_actuator("fan", "ON")
    run(a, 60)
    run(b, 60)
    assert b.state["temperature"] < a.state["temperature"] - 3


def test_pump_wets_the_soil():
    m = GreenhouseModel()
    before = m.state["soilMoisture"]
    m.set_actuator("pump", "ON")
    run(m, 10)
    assert m.state["soilMoisture"] > before + 10


def test_readings_stay_in_range():
    m = GreenhouseModel()
    for _ in range(2000):
        r = m.step(5)
        assert 0 <= r["humidity"] <= 100
        assert 0 <= r["soilMoisture"] <= 100
        assert 0 <= r["lightLevel"] <= 100
        assert r["airQuality"] >= 350


def test_scenarios_change_the_state():
    m = GreenhouseModel()
    m.apply_scenario("drySoil")
    assert m.state["soilMoisture"] == 14
    m.apply_scenario("hotDay")
    assert m.state["temperature"] == 37


def test_automation_rules_with_hysteresis():
    off = {"fan": "OFF", "pump": "OFF", "light": "OFF"}
    assert decide_actuators({"temperature": 31}, off)["fan"] == "ON"
    assert decide_actuators({"temperature": 29}, {**off, "fan": "ON"})["fan"] == "ON"
    assert decide_actuators({"temperature": 27}, {**off, "fan": "ON"})["fan"] == "OFF"
    assert decide_actuators({"soilMoisture": 20}, off)["pump"] == "ON"
    assert decide_actuators({"lightLevel": 30}, off)["light"] == "ON"


def test_offline_run_writes_csv(tmp_path):
    out = tmp_path / "run.csv"
    assert main(["--offline", "--steps", "5", "--csv", str(out)]) == 0
    lines = out.read_text(encoding="utf-8").strip().splitlines()
    assert len(lines) == 6
    assert lines[0].startswith("step,hour,temperature")
