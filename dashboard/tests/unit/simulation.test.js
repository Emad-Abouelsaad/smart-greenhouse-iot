import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryDatabase } from '../../src/services/memoryDatabase.js';
import { MemoryAuth, DEMO_USER } from '../../src/services/memoryAuth.js';
import { GreenhouseModel } from '../../src/simulation/greenhouseModel.js';
import { VirtualDevice, PUMP_MAX_RUN_MS } from '../../src/simulation/virtualDevice.js';
import { CloudLogic } from '../../src/simulation/cloudLogic.js';
import { sendCommand } from '../../src/services/controls.js';

afterEach(() => vi.useRealTimers());

describe('In-memory realtime database', () => {
  it('notifies listeners of a path and its parents', async () => {
    const db = new MemoryDatabase();
    const seen = [];
    db.onValue('esp8266', (v) => seen.push(v));
    await db.set('esp8266/temperature', 25);
    expect(seen.at(-1)).toEqual({ temperature: 25 });
  });
  it('removes values and empty parents', async () => {
    const db = new MemoryDatabase({ esp8266: { fan: { control: 'ON' } } });
    await db.remove('esp8266/fan/control');
    expect(db.get('esp8266')).toBeNull();
  });
  it('push() creates ordered keys', async () => {
    const db = new MemoryDatabase();
    const k1 = await db.push('history', { a: 1 });
    const k2 = await db.push('history', { a: 2 });
    expect(k1 < k2).toBe(true);
  });
});

describe('Simulated authentication', () => {
  it('signs in the demo user and rejects wrong credentials', async () => {
    const auth = new MemoryAuth();
    await expect(auth.signIn('nobody@x.com', 'abc123')).rejects.toMatchObject({ code: 'auth/user-not-found' });
    await expect(auth.signIn(DEMO_USER.email, 'wrong')).rejects.toMatchObject({ code: 'auth/wrong-password' });
    const u = await auth.signIn(DEMO_USER.email, DEMO_USER.password);
    expect(u.email).toBe(DEMO_USER.email);
  });
  it('does not allow two accounts with the same email', async () => {
    const auth = new MemoryAuth();
    await auth.signUp({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'secret1' });
    await expect(auth.signUp({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'secret1' }))
      .rejects.toMatchObject({ code: 'auth/email-already-in-use' });
  });
});

describe('Greenhouse model', () => {
  it('fan lowers temperature compared to no fan', () => {
    const a = new GreenhouseModel({ startHour: 13 });
    const b = new GreenhouseModel({ startHour: 13 });
    b.setActuator('fan', 'ON');
    for (let i = 0; i < 60; i++) { a.step(1); b.step(1); }
    expect(b.state.temperature).toBeLessThan(a.state.temperature - 3);
  });
  it('pump increases soil moisture', () => {
    const m = new GreenhouseModel();
    const before = m.state.soilMoisture;
    m.setActuator('pump', 'ON');
    for (let i = 0; i < 10; i++) m.step(1);
    expect(m.state.soilMoisture).toBeGreaterThan(before + 10);
  });
  it('light level is zero at night without LEDs and increases with LEDs', () => {
    const m = new GreenhouseModel({ startHour: 23 });
    for (let i = 0; i < 20; i++) m.step(1);
    expect(m.state.lightLevel).toBeLessThan(5);
    m.setActuator('light', 'ON');
    for (let i = 0; i < 20; i++) m.step(1);
    expect(m.state.lightLevel).toBeGreaterThan(35);
  });
  it('keeps all readings inside the physical ranges', () => {
    const m = new GreenhouseModel();
    for (let i = 0; i < 2000; i++) {
      const r = m.step(5);
      expect(r.humidity).toBeGreaterThanOrEqual(0); expect(r.humidity).toBeLessThanOrEqual(100);
      expect(r.soilMoisture).toBeGreaterThanOrEqual(0); expect(r.soilMoisture).toBeLessThanOrEqual(100);
      expect(r.lightLevel).toBeGreaterThanOrEqual(0); expect(r.lightLevel).toBeLessThanOrEqual(100);
    }
  });
});

describe('Virtual ESP8266 + cloud logic', () => {
  it('publishes readings, executes commands and stores history', async () => {
    vi.useFakeTimers();
    const db = new MemoryDatabase();
    const cloud = new CloudLogic(db); cloud.start();
    const dev = new VirtualDevice(db, { intervalMs: 1000 }); dev.start();
    await vi.advanceTimersByTimeAsync(3000);
    expect(typeof db.get('esp8266/temperature')).toBe('number');
    expect(Object.keys(db.get('history')).length).toBeGreaterThanOrEqual(3);

    await sendCommand(db, 'fan', 'ON');
    expect(db.get('esp8266/fan/status')).toBe('ON');
    // the command is removed after 30 s, the device keeps its state
    await vi.advanceTimersByTimeAsync(31_000);
    expect(db.get('esp8266/fan/control')).toBeNull();
    expect(db.get('esp8266/fan/status')).toBe('ON');
    dev.stop(); cloud.stop();
  });
  it('stops the pump after the maximum run time (safety)', async () => {
    vi.useFakeTimers();
    let now = 0;
    const db = new MemoryDatabase();
    const dev = new VirtualDevice(db, { intervalMs: 1000, now: () => now }); dev.start();
    await db.set('esp8266/pump/control', 'ON');
    expect(db.get('esp8266/pump/status')).toBe('ON');
    now = PUMP_MAX_RUN_MS + 1000;
    await vi.advanceTimersByTimeAsync(1000);
    expect(db.get('esp8266/pump/status')).toBe('OFF');
    dev.stop();
  });
  it('applies automatic control when auto mode is on', async () => {
    vi.useFakeTimers();
    const db = new MemoryDatabase({ settings: { autoMode: true } });
    const dev = new VirtualDevice(db, { intervalMs: 1000 }); dev.start();
    await db.set('simulation/scenario', 'hotDay');
    await vi.advanceTimersByTimeAsync(1000);
    expect(db.get('esp8266/fan/status')).toBe('ON');
    dev.stop();
  });
  it('writes an alert when a reading is outside the thresholds', async () => {
    const db = new MemoryDatabase();
    const cloud = new CloudLogic(db); cloud.start();
    await db.update('esp8266', { temperature: 41, humidity: 50, soilMoisture: 40, lightLevel: 70, airQuality: 500, lastUpdate: 1 });
    await new Promise((r) => setTimeout(r, 0));
    expect(db.get('alerts/active')[0]).toMatchObject({ sensor: 'temperature', level: 'critical' });
    expect(Object.keys(db.get('alerts/log'))).toHaveLength(1);
    cloud.stop();
  });
});
