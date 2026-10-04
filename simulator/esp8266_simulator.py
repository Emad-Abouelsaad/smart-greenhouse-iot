#!/usr/bin/env python3
"""
Virtual ESP8266 node for the Smart Greenhouse System.

It behaves like the real firmware (firmware/greenhouse_esp8266):
  * sends sensor readings to Firebase Realtime Database (/esp8266) every few seconds,
  * executes the commands written by the dashboard (/esp8266/<device>/control),
  * reports the actuator status (/esp8266/<device>/status),
  * applies the automatic control rules when /settings/autoMode is true,
  * stops the pump after 60 seconds (safety rule).

It uses the Firebase REST API, so it can be used with a real Firebase project
or with the Firebase Local Emulator Suite. Without --database-url it runs
offline and only prints the readings (useful for testing the model).

Examples:
  python esp8266_simulator.py --offline --steps 10
  python esp8266_simulator.py --database-url https://<project>-default-rtdb.europe-west1.firebasedatabase.app \
      --api-key <WEB_API_KEY> --email device@example.com --password <PASSWORD>
  python esp8266_simulator.py --database-url http://127.0.0.1:9000 --namespace demo-greenhouse --scenario hotDay

Author: Emad Abouelsaad
"""
from __future__ import annotations

import argparse
import csv
import sys
import time

import requests

from greenhouse_model import SCENARIOS, GreenhouseModel, decide_actuators

DEVICES = ("fan", "pump", "light")
PUMP_MAX_RUN_S = 60
PUMP_LOCKOUT_S = 600  # no automatic restart for 10 min after a safety stop


class FirebaseRest:
    """Very small Firebase Realtime Database REST client."""

    def __init__(self, database_url: str, api_key: str | None = None, email: str | None = None,
                 password: str | None = None, namespace: str | None = None, timeout: float = 10):
        self.base = database_url.rstrip("/")
        self.namespace = namespace
        self.timeout = timeout
        self.token = None
        if api_key and email and password:
            self.token = self._sign_in(api_key, email, password)

    @staticmethod
    def _sign_in(api_key: str, email: str, password: str) -> str:
        url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key}"
        resp = requests.post(url, json={"email": email, "password": password, "returnSecureToken": True}, timeout=10)
        resp.raise_for_status()
        return resp.json()["idToken"]

    def _url(self, path: str) -> tuple[str, dict]:
        params = {}
        if self.token:
            params["auth"] = self.token
        if self.namespace:
            params["ns"] = self.namespace
        return f"{self.base}/{path.strip('/')}.json", params

    def get(self, path: str):
        url, params = self._url(path)
        resp = requests.get(url, params=params, timeout=self.timeout)
        resp.raise_for_status()
        return resp.json()

    def patch(self, path: str, data: dict):
        url, params = self._url(path)
        requests.patch(url, params=params, json=data, timeout=self.timeout).raise_for_status()

    def put(self, path: str, value):
        url, params = self._url(path)
        requests.put(url, params=params, json=value, timeout=self.timeout).raise_for_status()

    def delete(self, path: str):
        url, params = self._url(path)
        requests.delete(url, params=params, timeout=self.timeout).raise_for_status()


class VirtualESP8266:
    def __init__(self, model: GreenhouseModel, db: FirebaseRest | None, interval: float, speed: float):
        self.model = model
        self.db = db
        self.interval = interval
        self.speed = speed
        self.last_command = {d: None for d in DEVICES}
        self.pump_started = None
        self.pump_safety_stop = None

    def pump_locked(self) -> bool:
        return self.pump_safety_stop is not None and time.monotonic() - self.pump_safety_stop < PUMP_LOCKOUT_S

    def set_device(self, device: str, state: str) -> None:
        if self.model.actuators[device] == state:
            return
        self.model.set_actuator(device, state)
        self.pump_started = time.monotonic() if (device == "pump" and state == "ON") else (
            None if device == "pump" else self.pump_started)
        print(f"  -> {device} {state}")
        if self.db:
            self.db.put(f"esp8266/{device}/status", state)

    def poll(self) -> None:
        """Read commands and settings from the database."""
        if not self.db:
            return
        settings = self.db.get("settings") or {}
        auto = settings.get("autoMode") is True
        scenario = (self.db.get("simulation/scenario") or None)
        if scenario and scenario != self.model.scenario and scenario in SCENARIOS:
            self.model.apply_scenario(scenario)
            print(f"Scenario: {scenario}")
        if auto:
            nxt = decide_actuators(self.model.readings(), self.model.actuators, settings.get("automation"))
            if nxt["pump"] == "ON" and self.pump_locked():
                nxt["pump"] = "OFF"
            for d in DEVICES:
                self.set_device(d, nxt[d])
            return
        node = self.db.get("esp8266") or {}
        for d in DEVICES:
            cmd = (node.get(d) or {}).get("control")
            if cmd != self.last_command[d]:
                self.last_command[d] = cmd
                if cmd in ("ON", "OFF"):
                    self.set_device(d, cmd)

    def step(self) -> dict:
        readings = self.model.step(self.interval * self.speed / 60)
        if self.pump_started and time.monotonic() - self.pump_started > PUMP_MAX_RUN_S:
            print("Safety: pump stopped after the maximum run time")
            self.set_device("pump", "OFF")
            self.pump_safety_stop = time.monotonic()
            if self.db:
                self.db.delete("esp8266/pump/control")
        if self.db:
            self.db.patch("esp8266", {**readings, "lastUpdate": {".sv": "timestamp"}})
        return readings


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Virtual ESP8266 node for the Smart Greenhouse System")
    ap.add_argument("--database-url", help="Firebase Realtime Database URL (or emulator URL)")
    ap.add_argument("--namespace", help="database namespace (needed for the emulator)")
    ap.add_argument("--api-key")
    ap.add_argument("--email")
    ap.add_argument("--password")
    ap.add_argument("--interval", type=float, default=5.0, help="seconds between readings (default 5)")
    ap.add_argument("--speed", type=float, default=60.0, help="simulated seconds per real second (default 60)")
    ap.add_argument("--start-hour", type=float, default=10.0)
    ap.add_argument("--scenario", choices=sorted(SCENARIOS), default="normal")
    ap.add_argument("--steps", type=int, default=0, help="number of readings (0 = run forever)")
    ap.add_argument("--offline", action="store_true", help="do not connect to Firebase, only print values")
    ap.add_argument("--csv", help="also save the readings to this CSV file")
    args = ap.parse_args(argv)

    db = None
    if not args.offline:
        if not args.database_url:
            ap.error("--database-url is required (or use --offline)")
        db = FirebaseRest(args.database_url, args.api_key, args.email, args.password, args.namespace)

    model = GreenhouseModel(hour=args.start_hour)
    model.apply_scenario(args.scenario)
    node = VirtualESP8266(model, db, args.interval, args.speed)
    writer = None
    if args.csv:
        f = open(args.csv, "w", newline="", encoding="utf-8")
        writer = csv.writer(f)
        writer.writerow(["step", "hour", "temperature", "humidity", "soilMoisture", "lightLevel", "airQuality", "fan", "pump", "light"])

    print(f"Virtual ESP8266 started ({'offline' if db is None else args.database_url})")
    step = 0
    try:
        while args.steps == 0 or step < args.steps:
            node.poll()
            r = node.step()
            step += 1
            a = model.actuators
            print(f"[{step:4d}] {model.hour:05.2f}h  T={r['temperature']:5.1f}C  H={r['humidity']:5.1f}%  "
                  f"Soil={r['soilMoisture']:3d}%  Light={r['lightLevel']:3d}%  Air={r['airQuality']:4d}ppm  "
                  f"fan={a['fan']} pump={a['pump']} light={a['light']}")
            if writer:
                writer.writerow([step, round(model.hour, 2), *r.values(), a["fan"], a["pump"], a["light"]])
            if db is not None or args.steps == 0:
                time.sleep(args.interval)
    except KeyboardInterrupt:
        print("Stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
