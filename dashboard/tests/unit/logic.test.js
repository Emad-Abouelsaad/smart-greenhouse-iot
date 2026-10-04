import { describe, it, expect } from 'vitest';
import { evaluateAlerts, sensorStatus } from '../../src/logic/alerts.js';
import { decideActuators } from '../../src/logic/autoControl.js';
import { toCSV } from '../../src/logic/csv.js';
import { validateLogin, validateSignup, authErrorMessage } from '../../src/logic/validation.js';

describe('Alert thresholds', () => {
  it('reports no alerts for normal conditions', () => {
    expect(evaluateAlerts({ temperature: 24, humidity: 60, soilMoisture: 45, lightLevel: 70, airQuality: 600 })).toEqual([]);
  });
  it('raises a warning when temperature is above the maximum', () => {
    const a = evaluateAlerts({ temperature: 36 });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ sensor: 'temperature', level: 'warning' });
  });
  it('raises a critical alert at the critical temperature', () => {
    expect(evaluateAlerts({ temperature: 40 })[0].level).toBe('critical');
  });
  it('raises a warning for low temperature and critical for frost risk', () => {
    expect(sensorStatus('temperature', 12)).toBe('warning');
    expect(sensorStatus('temperature', 4)).toBe('critical');
  });
  it('detects dry and over-watered soil', () => {
    expect(sensorStatus('soilMoisture', 15)).toBe('warning');
    expect(sensorStatus('soilMoisture', 8)).toBe('critical');
    expect(sensorStatus('soilMoisture', 75)).toBe('warning');
  });
  it('detects low light', () => {
    expect(sensorStatus('lightLevel', 25)).toBe('warning');
    expect(sensorStatus('lightLevel', 10)).toBe('critical');
  });
  it('detects poor air quality', () => {
    expect(sensorStatus('airQuality', 1200)).toBe('warning');
    expect(sensorStatus('airQuality', 2500)).toBe('critical');
  });
  it('uses custom thresholds from the settings', () => {
    expect(sensorStatus('temperature', 31, { temperature: { max: 30 } })).toBe('warning');
  });
  it('ignores missing or invalid values', () => {
    expect(evaluateAlerts({ temperature: null, humidity: 'abc' })).toEqual([]);
  });
});

describe('Automatic control rules (hysteresis)', () => {
  const off = { fan: 'OFF', pump: 'OFF', light: 'OFF' };
  it('turns the fan on above 30 °C and keeps it on until below 28 °C', () => {
    expect(decideActuators({ temperature: 31 }, off).fan).toBe('ON');
    expect(decideActuators({ temperature: 29 }, { ...off, fan: 'ON' }).fan).toBe('ON');
    expect(decideActuators({ temperature: 27.5 }, { ...off, fan: 'ON' }).fan).toBe('OFF');
  });
  it('turns the pump on when soil is dry and off when moist', () => {
    expect(decideActuators({ soilMoisture: 25 }, off).pump).toBe('ON');
    expect(decideActuators({ soilMoisture: 61 }, { ...off, pump: 'ON' }).pump).toBe('OFF');
  });
  it('turns the lights on when light is low', () => {
    expect(decideActuators({ lightLevel: 35 }, off).light).toBe('ON');
    expect(decideActuators({ lightLevel: 75 }, { ...off, light: 'ON' }).light).toBe('OFF');
  });
});

describe('CSV export', () => {
  it('creates a header and one line per record', () => {
    const csv = toCSV([{ timestamp: Date.UTC(2026, 9, 4, 10, 0, 0), temperature: 24.5, humidity: 60 }]);
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Temperature (°C)');
    expect(lines[1]).toContain('2026-10-04T10:00:00.000Z,24.5,60');
  });
});

describe('Form validation', () => {
  it('requires email and password on login', () => {
    expect(validateLogin({ email: '', password: '' })).toMatch(/enter your email/);
    expect(validateLogin({ email: 'a@b.com', password: 'x' })).toBeNull();
  });
  it('requires all sign-up fields and matching passwords', () => {
    const ok = { firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'secret1', confirmPassword: 'secret1' };
    expect(validateSignup(ok)).toBeNull();
    expect(validateSignup({ ...ok, lastName: '' })).toMatch(/fill out all fields/);
    expect(validateSignup({ ...ok, confirmPassword: 'other' })).toMatch(/do not match/);
    expect(validateSignup({ ...ok, password: '123', confirmPassword: '123' })).toMatch(/at least 6/);
  });
  it('maps Firebase error codes to messages', () => {
    expect(authErrorMessage('auth/user-not-found')).toMatch(/No account/);
    expect(authErrorMessage('auth/wrong-password')).toMatch(/password is incorrect/);
  });
});
