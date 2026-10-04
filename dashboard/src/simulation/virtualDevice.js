/**
 * Virtual ESP8266 node.
 *
 * Behaves like the real firmware in /firmware: every few seconds it sends
 * the sensor readings to the database path /esp8266, it listens to the
 * control commands written by the dashboard (/esp8266/<device>/control),
 * switches the actuators, reports their status (/esp8266/<device>/status)
 * and, when automatic mode is enabled, applies the automation rules locally.
 */
import { GreenhouseModel } from './greenhouseModel.js';
import { decideActuators } from '../logic/autoControl.js';

export const DEVICES = ['fan', 'pump', 'light'];
export const PUMP_MAX_RUN_MS = 60_000; // safety: the pump never runs longer than 60 s
export const PUMP_LOCKOUT_MS = 10 * 60_000; // no automatic restart for 10 min after a safety stop

export class VirtualDevice {
  constructor(db, { intervalMs = 5000, speed = 60, startHour = 10, now = () => Date.now() } = {}) {
    this.db = db;
    this.intervalMs = intervalMs;
    this.speed = speed; // simulated seconds per real second
    this.now = now;
    this.model = new GreenhouseModel({ startHour });
    this.autoMode = false;
    this.automation = undefined;
    this.pumpStartedAt = null;
    this.pumpSafetyStopAt = null;
    this.unsubs = [];
    this.timer = null;
  }

  start() {
    for (const d of DEVICES) {
      this.unsubs.push(this.db.onValue(`esp8266/${d}/control`, (cmd) => {
        if (cmd === 'ON' || cmd === 'OFF') this.setActuator(d, cmd);
      }));
    }
    this.unsubs.push(this.db.onValue('settings/autoMode', (v) => { this.autoMode = v === true; }));
    this.unsubs.push(this.db.onValue('settings/automation', (v) => { this.automation = v || undefined; }));
    this.unsubs.push(this.db.onValue('simulation/scenario', (name) => {
      if (name && name !== this.model.scenario) {
        this.model.applyScenario(name);
        this.publish();
      }
    }));
    for (const d of DEVICES) this.db.set(`esp8266/${d}/status`, 'OFF');
    this.publish();
    this.timer = setInterval(() => this.tick(), this.intervalMs);
  }

  stop() {
    clearInterval(this.timer);
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  setActuator(device, state) {
    if (this.model.actuators[device] === state) return;
    this.model.setActuator(device, state);
    if (device === 'pump') this.pumpStartedAt = state === 'ON' ? this.now() : null;
    this.db.set(`esp8266/${device}/status`, state);
  }

  tick() {
    const simMinutes = (this.intervalMs / 1000) * this.speed / 60;
    this.model.step(simMinutes);

    if (this.autoMode) {
      const next = decideActuators(this.model.readings(), this.model.actuators, this.automation);
      // after a safety stop the automatic mode must not keep restarting the pump
      if (next.pump === 'ON' && this.pumpLocked()) next.pump = 'OFF';
      for (const d of DEVICES) this.setActuator(d, next[d]);
    }
    // safety rule (also in the firmware): stop the pump after the maximum run time
    if (this.pumpStartedAt !== null && this.now() - this.pumpStartedAt > PUMP_MAX_RUN_MS) {
      this.setActuator('pump', 'OFF');
      this.pumpSafetyStopAt = this.now();
      this.db.remove('esp8266/pump/control');
    }
    this.publish();
  }

  pumpLocked() {
    return this.pumpSafetyStopAt !== null && this.now() - this.pumpSafetyStopAt < PUMP_LOCKOUT_MS;
  }

  publish() {
    const r = this.model.readings();
    return this.db.update('esp8266', { ...r, lastUpdate: this.now() });
  }
}
