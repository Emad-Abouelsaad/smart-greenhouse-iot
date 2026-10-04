import { useEffect, useState } from 'react';
import { useBackend, useDbValue } from '../services/useData.js';
import { SENSORS, SENSOR_KEYS, DEFAULT_AUTOMATION, mergeThresholds } from '../logic/thresholds.js';
import { SCENARIOS } from '../simulation/greenhouseModel.js';

const FIELDS = [
  ['criticalLow', 'Critical low'],
  ['min', 'Min'],
  ['max', 'Max'],
  ['criticalHigh', 'Critical high'],
];

const toNumberOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

export default function SettingsPage() {
  const backend = useBackend();
  const saved = useDbValue('settings/thresholds');
  const savedAutomation = useDbValue('settings/automation');
  const scenario = useDbValue('simulation/scenario');
  const [form, setForm] = useState(mergeThresholds());
  const [automation, setAutomation] = useState(DEFAULT_AUTOMATION);
  const [message, setMessage] = useState('');

  useEffect(() => { if (saved !== undefined) setForm(mergeThresholds(saved || undefined)); }, [saved]);
  useEffect(() => { if (savedAutomation) setAutomation({ ...DEFAULT_AUTOMATION, ...savedAutomation }); }, [savedAutomation]);

  const setField = (sensor, field, value) => setForm({ ...form, [sensor]: { ...form[sensor], [field]: value } });
  const setRule = (dev, field, value) => setAutomation({ ...automation, [dev]: { ...automation[dev], [field]: Number(value) } });

  const save = async (e) => {
    e.preventDefault();
    const clean = {};
    for (const k of SENSOR_KEYS) {
      clean[k] = {};
      for (const [f] of FIELDS) clean[k][f] = toNumberOrNull(form[k][f]);
    }
    await backend.db.set('settings/thresholds', clean);
    await backend.db.set('settings/automation', automation);
    setMessage('Settings saved.');
    setTimeout(() => setMessage(''), 3000);
  };

  const reset = async () => {
    await backend.db.remove('settings/thresholds');
    await backend.db.remove('settings/automation');
    setForm(mergeThresholds());
    setAutomation(DEFAULT_AUTOMATION);
    setMessage('Default settings restored.');
  };

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <form onSubmit={save}>
        <section className="card">
          <h3>Alert thresholds</h3>
          <p className="muted small">Leave a field empty to disable that limit.</p>
          <div className="table-wrap">
            <table className="settings-table" data-testid="threshold-table">
              <thead><tr><th>Sensor</th>{FIELDS.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
              <tbody>
                {SENSOR_KEYS.map((k) => (
                  <tr key={k}>
                    <td>{SENSORS[k].icon} {SENSORS[k].label} ({SENSORS[k].unit})</td>
                    {FIELDS.map(([f]) => (
                      <td key={f}>
                        <input type="number" step="any" value={form[k][f] ?? ''} data-testid={`th-${k}-${f}`}
                          onChange={(e) => setField(k, f, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h3>Automation rules</h3>
          <div className="rules-grid">
            <div><b>🌀 Fan</b><label>ON above (°C)<input type="number" value={automation.fan.onAbove} onChange={(e) => setRule('fan', 'onAbove', e.target.value)} /></label>
              <label>OFF below (°C)<input type="number" value={automation.fan.offBelow} onChange={(e) => setRule('fan', 'offBelow', e.target.value)} /></label></div>
            <div><b>💦 Pump</b><label>ON below (% soil)<input type="number" value={automation.pump.onBelow} onChange={(e) => setRule('pump', 'onBelow', e.target.value)} /></label>
              <label>OFF above (% soil)<input type="number" value={automation.pump.offAbove} onChange={(e) => setRule('pump', 'offAbove', e.target.value)} /></label></div>
            <div><b>💡 Lights</b><label>ON below (% light)<input type="number" value={automation.light.onBelow} onChange={(e) => setRule('light', 'onBelow', e.target.value)} /></label>
              <label>OFF above (% light)<input type="number" value={automation.light.offAbove} onChange={(e) => setRule('light', 'offAbove', e.target.value)} /></label></div>
          </div>
        </section>

        <div className="toolbar">
          <button className="btn btn-primary" type="submit" data-testid="save-settings">Save settings</button>
          <button className="btn btn-outline" type="button" onClick={reset}>Restore defaults</button>
          {message && <span className="form-info inline" data-testid="settings-message">{message}</span>}
        </div>
      </form>

      {backend.mode === 'simulation' && (
        <section className="card sim-card">
          <h3>Simulation scenarios</h3>
          <p className="muted small">
            Used for testing without hardware: the virtual ESP8266 changes the greenhouse conditions to the selected scenario.
          </p>
          <div className="scenario-list">
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <button key={key} type="button" data-testid={`scenario-${key}`}
                className={`btn btn-small ${scenario === key ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => backend.db.set('simulation/scenario', key)}>
                {s.label}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
