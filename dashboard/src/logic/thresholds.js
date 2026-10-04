/**
 * Sensor definitions and default alert thresholds.
 *
 * The ranges are based on typical greenhouse growing conditions for
 * vegetables such as tomatoes, cucumbers and peppers. They can be changed
 * by the user on the Settings page (stored under /settings/thresholds).
 */

export const SENSORS = {
  temperature: { label: 'Temperature', unit: '°C', decimals: 1, icon: '🌡️', color: '#e4572e' },
  humidity: { label: 'Humidity', unit: '%', decimals: 1, icon: '💧', color: '#2e86de' },
  soilMoisture: { label: 'Soil Moisture', unit: '%', decimals: 0, icon: '🌱', color: '#2a9d8f' },
  lightLevel: { label: 'Light Level', unit: '%', decimals: 0, icon: '☀️', color: '#e9b44c' },
  airQuality: { label: 'Air Quality (CO₂ eq.)', unit: 'ppm', decimals: 0, icon: '🌫️', color: '#7b6d8d' },
};

export const SENSOR_KEYS = Object.keys(SENSORS);

/**
 * min / max   -> outside this range a WARNING is raised
 * criticalLow -> at or below this value a CRITICAL alert is raised
 * criticalHigh-> at or above this value a CRITICAL alert is raised
 * (null means "no critical level on this side")
 */
export const DEFAULT_THRESHOLDS = {
  temperature: { min: 15, max: 35, criticalLow: 5, criticalHigh: 40 },
  humidity: { min: 30, max: 80, criticalLow: null, criticalHigh: 90 },
  soilMoisture: { min: 20, max: 70, criticalLow: 10, criticalHigh: null },
  lightLevel: { min: 30, max: 100, criticalLow: 20, criticalHigh: null },
  airQuality: { min: null, max: 1000, criticalLow: null, criticalHigh: 2000 },
};

/** Rules used by the automatic control mode (hysteresis avoids rapid switching). */
export const DEFAULT_AUTOMATION = {
  fan: { onAbove: 30, offBelow: 28, sensor: 'temperature' },
  pump: { onBelow: 30, offAbove: 60, sensor: 'soilMoisture' },
  light: { onBelow: 40, offAbove: 70, sensor: 'lightLevel' },
};

/** Merge user settings with defaults so missing values never break the app. */
export function mergeThresholds(custom) {
  const out = {};
  for (const key of SENSOR_KEYS) {
    out[key] = { ...DEFAULT_THRESHOLDS[key], ...(custom && custom[key] ? custom[key] : {}) };
  }
  return out;
}

export function formatValue(key, value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(SENSORS[key]?.decimals ?? 1);
}
