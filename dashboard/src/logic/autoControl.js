import { DEFAULT_AUTOMATION } from './thresholds.js';

/**
 * Automatic control rules with hysteresis.
 *
 * The same rules are implemented in the ESP8266 firmware (edge control), so
 * the greenhouse keeps working even if the internet connection is lost.
 * This JavaScript version is used by the simulation and by the unit tests.
 *
 * @param {object} readings current sensor values
 * @param {object} states   current actuator states { fan: 'ON'|'OFF', ... }
 * @param {object} rules    optional custom rules
 * @returns {object} the actuator states that should be applied
 */
export function decideActuators(readings, states, rules = DEFAULT_AUTOMATION) {
  const r = { ...DEFAULT_AUTOMATION, ...rules };
  const next = { fan: 'OFF', pump: 'OFF', light: 'OFF', ...states };
  if (!readings) return next;

  const t = Number(readings.temperature);
  if (!Number.isNaN(t)) {
    if (t > r.fan.onAbove) next.fan = 'ON';
    else if (t < r.fan.offBelow) next.fan = 'OFF';
  }

  const s = Number(readings.soilMoisture);
  if (!Number.isNaN(s)) {
    if (s < r.pump.onBelow) next.pump = 'ON';
    else if (s > r.pump.offAbove) next.pump = 'OFF';
  }

  const l = Number(readings.lightLevel);
  if (!Number.isNaN(l)) {
    if (l < r.light.onBelow) next.light = 'ON';
    else if (l > r.light.offAbove) next.light = 'OFF';
  }
  return next;
}
