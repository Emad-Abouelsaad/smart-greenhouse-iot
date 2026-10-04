import { SENSORS, SENSOR_KEYS, mergeThresholds, formatValue } from './thresholds.js';

/**
 * Evaluates one set of sensor readings against the thresholds and returns
 * a list of alerts. Pure function: easy to unit test and reused by the
 * dashboard and by the simulation.
 *
 * @param {object} readings  e.g. { temperature: 31.2, humidity: 64, ... }
 * @param {object} thresholds optional custom thresholds
 * @returns {Array<{sensor, level, message, value}>}
 */
export function evaluateAlerts(readings, thresholds) {
  const t = mergeThresholds(thresholds);
  const alerts = [];
  if (!readings) return alerts;

  for (const key of SENSOR_KEYS) {
    const value = readings[key];
    if (value === undefined || value === null || Number.isNaN(Number(value))) continue;
    const v = Number(value);
    const r = t[key];
    const { label, unit } = SENSORS[key];
    const shown = `${formatValue(key, v)} ${unit}`;

    if (r.criticalHigh !== null && r.criticalHigh !== undefined && v >= r.criticalHigh) {
      alerts.push({ sensor: key, level: 'critical', value: v, message: `${label} is critically high: ${shown} (limit ${r.criticalHigh} ${unit})` });
    } else if (r.criticalLow !== null && r.criticalLow !== undefined && v <= r.criticalLow) {
      alerts.push({ sensor: key, level: 'critical', value: v, message: `${label} is critically low: ${shown} (limit ${r.criticalLow} ${unit})` });
    } else if (r.max !== null && r.max !== undefined && v > r.max) {
      alerts.push({ sensor: key, level: 'warning', value: v, message: `${label} is above the recommended range: ${shown} (max ${r.max} ${unit})` });
    } else if (r.min !== null && r.min !== undefined && v < r.min) {
      alerts.push({ sensor: key, level: 'warning', value: v, message: `${label} is below the recommended range: ${shown} (min ${r.min} ${unit})` });
    }
  }
  return alerts;
}

/** Status of a single sensor value: 'normal' | 'warning' | 'critical' */
export function sensorStatus(key, value, thresholds) {
  const found = evaluateAlerts({ [key]: value }, thresholds);
  return found.length ? found[0].level : 'normal';
}
