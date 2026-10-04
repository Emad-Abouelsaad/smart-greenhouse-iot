/**
 * Cloud Functions for Firebase - Smart Greenhouse System
 * Author: Emad Abouelsaad
 *
 * onReading     : runs every time the ESP8266 updates /esp8266/lastUpdate.
 *                 Stores the reading in /history and updates /alerts.
 * cleanHistory  : runs every day and deletes history older than 30 days.
 */
const { onValueWritten } = require('firebase-functions/v2/database');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { SENSORS, evaluateAlerts } = require('./alerts');

admin.initializeApp();
const REGION = 'europe-west1';
const HISTORY_DAYS = 30;

exports.onReading = onValueWritten({ ref: '/esp8266/lastUpdate', region: REGION }, async (event) => {
  const ts = event.data.after.val();
  if (!ts) return;
  const db = admin.database();
  const [readingSnap, thresholdsSnap, activeSnap] = await Promise.all([
    db.ref('esp8266').get(),
    db.ref('settings/thresholds').get(),
    db.ref('alerts/active').get(),
  ]);
  const reading = readingSnap.val() || {};

  // 1) store the reading in the history
  const record = { timestamp: ts };
  for (const key of Object.keys(SENSORS)) if (reading[key] !== undefined) record[key] = reading[key];
  await db.ref('history').push(record);

  // 2) evaluate alerts; write to the log only when an alert starts
  const alerts = evaluateAlerts(record, thresholdsSnap.val() || {});
  const before = new Set((activeSnap.val() || []).map((a) => `${a.sensor}:${a.level}`));
  const updates = { 'alerts/active': alerts.length ? alerts.map((a) => ({ ...a, timestamp: ts })) : null };
  for (const a of alerts) {
    if (!before.has(`${a.sensor}:${a.level}`)) updates[`alerts/log/${db.ref().push().key}`] = { ...a, timestamp: ts };
  }
  await db.ref().update(updates);
  if (alerts.length) logger.info('Active alerts', alerts.map((a) => a.message));
});

exports.cleanHistory = onSchedule({ schedule: 'every day 03:00', timeZone: 'Europe/Warsaw', region: REGION }, async () => {
  const limit = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
  const old = await admin.database().ref('history').orderByChild('timestamp').endAt(limit).get();
  const updates = {};
  old.forEach((child) => { updates[child.key] = null; });
  if (Object.keys(updates).length) await admin.database().ref('history').update(updates);
  logger.info(`Removed ${Object.keys(updates).length} old history records`);
});
