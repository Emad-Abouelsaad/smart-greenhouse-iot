import { useState } from 'react';
import { useBackend, useDbValue } from '../services/useData.js';
import { sendCommand } from '../services/controls.js';
import { DEFAULT_AUTOMATION } from '../logic/thresholds.js';

const DEVICES = [
  { key: 'fan', label: 'Ventilation Fan', icon: '🌀', help: 'Cools the air and lowers humidity and CO₂.' },
  { key: 'pump', label: 'Water Pump', icon: '💦', help: 'Irrigates the soil (stops automatically after 60 s).' },
  { key: 'light', label: 'LED Grow Lights', icon: '💡', help: 'Adds light when natural light is low.' },
];

export default function ControlPage() {
  const backend = useBackend();
  const esp = useDbValue('esp8266');
  const autoMode = useDbValue('settings/autoMode');
  const automation = useDbValue('settings/automation') || DEFAULT_AUTOMATION;
  const [pending, setPending] = useState({});
  const [error, setError] = useState('');

  const toggle = async (device) => {
    setError('');
    const current = esp?.[device]?.status === 'ON' ? 'ON' : 'OFF';
    const next = current === 'ON' ? 'OFF' : 'ON';
    setPending({ ...pending, [device]: next });
    try {
      await sendCommand(backend.db, device, next);
    } catch (err) {
      setError(`Could not send the command to the ${device}: ${err.message}`);
    } finally {
      setTimeout(() => setPending((p) => ({ ...p, [device]: undefined })), 1500);
    }
  };

  const setAuto = (value) => backend.db.set('settings/autoMode', value);

  return (
    <div>
      <h1 className="page-title">Control Panel</h1>

      <section className="card auto-card">
        <div>
          <h3>Automatic mode</h3>
          <p className="muted">
            When enabled, the controller switches the devices automatically: fan ON above {automation.fan.onAbove} °C
            (OFF below {automation.fan.offBelow} °C), pump ON below {automation.pump.onBelow} % soil moisture
            (OFF above {automation.pump.offAbove} %), lights ON below {automation.light.onBelow} % light
            (OFF above {automation.light.offAbove} %).
          </p>
        </div>
        <label className="switch" data-testid="auto-switch">
          <input type="checkbox" checked={autoMode === true} onChange={(e) => setAuto(e.target.checked)} />
          <span className="slider" />
          <span className="switch-label">{autoMode ? 'ON' : 'OFF'}</span>
        </label>
      </section>

      {error && <div className="form-error">{error}</div>}

      <div className="device-grid">
        {DEVICES.map((d) => {
          const status = esp?.[d.key]?.status === 'ON' ? 'ON' : 'OFF';
          const waiting = pending[d.key] && pending[d.key] !== status;
          return (
            <section key={d.key} className={`card device-card ${status === 'ON' ? 'device-on' : ''}`} data-testid={`device-${d.key}`}>
              <div className="device-icon">{d.icon}</div>
              <h3>{d.label}</h3>
              <p className="muted small">{d.help}</p>
              <div className="device-status">
                Status: <strong data-testid={`device-status-${d.key}`}>{status}</strong>
                {waiting && <span className="muted small"> (sending…)</span>}
              </div>
              <button
                className={`btn ${status === 'ON' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => toggle(d.key)}
                disabled={autoMode === true}
                data-testid={`toggle-${d.key}`}
                title={autoMode ? 'Disable automatic mode to control the devices manually' : ''}
              >
                {status === 'ON' ? 'Turn OFF' : 'Turn ON'}
              </button>
            </section>
          );
        })}
      </div>
      {autoMode === true && <p className="muted small">Manual control is disabled while automatic mode is ON.</p>}
    </div>
  );
}
