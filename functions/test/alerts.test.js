const test = require('node:test');
const assert = require('node:assert');
const { evaluateAlerts } = require('../alerts');

test('no alerts for normal readings', () => {
  assert.deepStrictEqual(evaluateAlerts({ temperature: 24, humidity: 60, soilMoisture: 45, lightLevel: 70, airQuality: 600 }), []);
});
test('critical temperature', () => {
  assert.strictEqual(evaluateAlerts({ temperature: 41 })[0].level, 'critical');
});
test('custom thresholds are used', () => {
  assert.strictEqual(evaluateAlerts({ soilMoisture: 25 }, { soilMoisture: { min: 30 } })[0].level, 'warning');
});
