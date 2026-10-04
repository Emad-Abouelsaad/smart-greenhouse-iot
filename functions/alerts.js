/**
 * Alert rules used by the Cloud Functions.
 * Same thresholds as dashboard/src/logic/thresholds.js.
 */
const SENSORS = {
  temperature: { label: 'Temperature', unit: '°C' },
  humidity: { label: 'Humidity', unit: '%' },
  soilMoisture: { label: 'Soil Moisture', unit: '%' },
  lightLevel: { label: 'Light Level', unit: '%' },
  airQuality: { label: 'Air Quality (CO2 eq.)', unit: 'ppm' },
};

const DEFAULT_THRESHOLDS = {
  temperature: { min: 15, max: 35, criticalLow: 5, criticalHigh: 40 },
  humidity: { min: 30, max: 80, criticalLow: null, criticalHigh: 90 },
  soilMoisture: { min: 20, max: 70, criticalLow: 10, criticalHigh: null },
  lightLevel: { min: 30, max: 100, criticalLow: 20, criticalHigh: null },
  airQuality: { min: null, max: 1000, criticalLow: null, criticalHigh: 2000 },
};

const has = (v) => v !== null && v !== undefined;

function evaluateAlerts(readings, custom = {}) {
  const alerts = [];
  for (const key of Object.keys(SENSORS)) {
    const v = Number(readings?.[key]);
    if (!has(readings?.[key]) || Number.isNaN(v)) continue;
    const t = { ...DEFAULT_THRESHOLDS[key], ...(custom?.[key] || {}) };
    const { label, unit } = SENSORS[key];
    if (has(t.criticalHigh) && v >= t.criticalHigh) alerts.push({ sensor: key, level: 'critical', value: v, message: `${label} is critically high: ${v} ${unit}` });
    else if (has(t.criticalLow) && v <= t.criticalLow) alerts.push({ sensor: key, level: 'critical', value: v, message: `${label} is critically low: ${v} ${unit}` });
    else if (has(t.max) && v > t.max) alerts.push({ sensor: key, level: 'warning', value: v, message: `${label} is above the recommended range: ${v} ${unit}` });
    else if (has(t.min) && v < t.min) alerts.push({ sensor: key, level: 'warning', value: v, message: `${label} is below the recommended range: ${v} ${unit}` });
  }
  return alerts;
}

module.exports = { SENSORS, DEFAULT_THRESHOLDS, evaluateAlerts };
