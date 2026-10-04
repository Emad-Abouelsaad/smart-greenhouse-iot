/**
 * Simple physical model of a small greenhouse.
 *
 * It produces realistic sensor values (temperature, humidity, soil moisture,
 * light and air quality) that follow a day/night cycle and react to the
 * actuators: the fan cools the air and removes CO2, the pump wets the soil
 * and the LED lights add light. It replaces the physical sensors so the
 * system can be tested without hardware.
 *
 * Time is "simulated time": with speed = 60, one real second equals one
 * simulated minute, so a whole day can be observed in 24 real minutes.
 * The same model is implemented in Python in /simulator.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const SCENARIOS = {
  normal: { label: 'Normal day', apply: () => ({}) },
  hotDay: { label: 'Hot day (high temperature)', apply: () => ({ tempOffset: 14, temperature: 37 }) },
  coldNight: { label: 'Cold night (low temperature)', apply: () => ({ tempOffset: -14, temperature: 9, hour: 2 }) },
  drySoil: { label: 'Dry soil', apply: () => ({ soilMoisture: 14 }) },
  wetSoil: { label: 'Over-watered soil', apply: () => ({ soilMoisture: 82 }) },
  lowLight: { label: 'Low light (cloudy / evening)', apply: () => ({ cloud: 0.15, hour: 18.5 }) },
  poorAir: { label: 'Poor ventilation (high CO₂)', apply: () => ({ airQuality: 1650 }) },
};

export class GreenhouseModel {
  constructor({ startHour = 10, seed = 1 } = {}) {
    this.hour = startHour;           // simulated hour of day (0-24)
    this.tempOffset = 0;              // scenario offset for outside temperature
    this.cloud = 1;                   // 1 = clear sky, 0 = very cloudy
    this.rand = mulberry32(seed);
    this.actuators = { fan: 'OFF', pump: 'OFF', light: 'OFF' };
    this.state = { temperature: 24, humidity: 62, soilMoisture: 48, lightLevel: 70, airQuality: 520 };
  }

  setActuator(name, value) {
    this.actuators[name] = value === 'ON' ? 'ON' : 'OFF';
  }

  applyScenario(name) {
    const sc = SCENARIOS[name] || SCENARIOS.normal;
    const p = sc.apply();
    this.tempOffset = p.tempOffset ?? 0;
    this.cloud = p.cloud ?? 1;
    if (p.hour !== undefined) this.hour = p.hour;
    for (const k of Object.keys(this.state)) if (p[k] !== undefined) this.state[k] = p[k];
    this.scenario = name;
  }

  outsideTemperature() {
    return 14 + 8 * Math.sin((2 * Math.PI * (this.hour - 9)) / 24) + this.tempOffset;
  }

  sunlight() {
    if (this.hour < 6 || this.hour > 20) return 0;
    return Math.max(0, Math.sin((Math.PI * (this.hour - 6)) / 14)) * this.cloud;
  }

  /** Advance the model by dtMinutes of simulated time. */
  step(dtMinutes = 1) {
    const s = this.state;
    const fan = this.actuators.fan === 'ON';
    const pump = this.actuators.pump === 'ON';
    const led = this.actuators.light === 'ON';
    const sun = this.sunlight();
    const k = (rate) => 1 - Math.exp(-rate * dtMinutes); // smooth approach factor
    const noise = (a) => (this.rand() - 0.5) * a;

    this.hour = (this.hour + dtMinutes / 60) % 24;

    // temperature: outside temperature + solar gain (greenhouse effect) - fan cooling
    const targetT = this.outsideTemperature() + 12 * sun - (fan ? 7 : 0);
    s.temperature += (targetT - s.temperature) * k(0.05) + noise(0.2);

    // humidity: falls when air is warmer, fan removes moisture, irrigation adds some
    const targetH = 88 - 1.5 * (s.temperature - 15) - (fan ? 12 : 0) + (pump ? 6 : 0);
    s.humidity += (clamp(targetH, 20, 98) - s.humidity) * k(0.06) + noise(0.6);

    // soil moisture: evaporation (more with sun), pump irrigation
    s.soilMoisture += (-(0.03 + 0.03 * sun) + (pump ? 1.6 : 0)) * dtMinutes + noise(0.15);

    // light: sunlight through the roof + LED grow lights
    const targetL = 100 * sun + (led ? 45 : 0);
    s.lightLevel += (clamp(targetL, 0, 100) - s.lightLevel) * k(0.5) + noise(1.0);

    // air quality (CO2 equivalent ppm): plants absorb CO2 in daylight,
    // CO2 accumulates at night in a closed greenhouse, the fan brings fresh air
    const targetC = fan ? 430 : sun > 0.2 ? 380 + 320 * (1 - sun) : 950;
    s.airQuality += (targetC - s.airQuality) * k(fan ? 0.12 : 0.02) + noise(6);

    s.humidity = clamp(s.humidity, 0, 100);
    s.soilMoisture = clamp(s.soilMoisture, 0, 100);
    s.lightLevel = clamp(s.lightLevel, 0, 100);
    s.airQuality = clamp(s.airQuality, 350, 5000);
    return this.readings();
  }

  readings() {
    const s = this.state;
    return {
      temperature: round(s.temperature, 1),
      humidity: round(s.humidity, 1),
      soilMoisture: round(s.soilMoisture, 0),
      lightLevel: round(s.lightLevel, 0),
      airQuality: round(s.airQuality, 0),
    };
  }
}

function round(v, d) {
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

// small deterministic random generator (repeatable simulations)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
