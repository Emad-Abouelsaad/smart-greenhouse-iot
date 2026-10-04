/**
 * Browser version of the Cloud Functions in /functions.
 *
 * In LIVE mode, Cloud Functions for Firebase store every new reading in
 * /history and write alerts to /alerts. In SIMULATION mode this module does
 * the same work inside the browser, so the dashboard behaves the same way.
 */
import { evaluateAlerts } from '../logic/alerts.js';
import { SENSOR_KEYS } from '../logic/thresholds.js';

export const HISTORY_LIMIT = 500;

export class CloudLogic {
  constructor(db, { now = () => Date.now() } = {}) {
    this.db = db;
    this.now = now;
    this.thresholds = undefined;
    this.lastProcessed = null;
    this.activeKeys = new Set();
    this.unsubs = [];
  }

  start() {
    this.unsubs.push(this.db.onValue('settings/thresholds', (t) => { this.thresholds = t || undefined; }));
    this.unsubs.push(this.db.onValue('esp8266/lastUpdate', (ts) => {
      if (ts && ts !== this.lastProcessed) {
        this.lastProcessed = ts;
        this.process(this.db.get('esp8266'));
      }
    }));
  }

  stop() {
    this.unsubs.forEach((u) => u());
  }

  async process(data) {
    if (!data) return;
    const record = { timestamp: data.lastUpdate || this.now() };
    for (const k of SENSOR_KEYS) if (data[k] !== undefined) record[k] = data[k];
    await this.db.push('history', record);
    this.trimHistory();

    const alerts = evaluateAlerts(record, this.thresholds);
    await this.db.set('alerts/active', alerts.length ? alerts.map((a) => ({ ...a, timestamp: record.timestamp })) : null);
    // write to the alert log only when an alert starts (not on every reading)
    const keys = new Set(alerts.map((a) => `${a.sensor}:${a.level}`));
    for (const a of alerts) {
      const key = `${a.sensor}:${a.level}`;
      if (!this.activeKeys.has(key)) await this.db.push('alerts/log', { ...a, timestamp: record.timestamp });
    }
    this.activeKeys = keys;
  }

  trimHistory() {
    const h = this.db.get('history');
    if (!h) return;
    const keys = Object.keys(h).sort();
    if (keys.length > HISTORY_LIMIT) {
      for (const k of keys.slice(0, keys.length - HISTORY_LIMIT)) this.db.remove(`history/${k}`);
    }
  }
}
