import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useDbValue } from '../services/useData.js';
import { SENSORS, SENSOR_KEYS, formatValue } from '../logic/thresholds.js';

export default function HomePage() {
  const { user } = useAuth();
  const live = useDbValue('esp8266');
  const alerts = useDbValue('alerts/active');
  const firstName = (user?.displayName || '').split(' ')[0];

  return (
    <div className="home">
      <section className="hero card">
        <div>
          <h1>Welcome{firstName ? `, ${firstName}` : ''} 👋</h1>
          <p>
            The Smart Greenhouse System monitors temperature, humidity, soil moisture, light and air quality
            in real time and lets you control the fan, the water pump and the grow lights from anywhere.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary" to="/dashboard">Open dashboard</Link>
            <Link className="btn btn-outline" to="/control">Control devices</Link>
          </div>
        </div>
        <div className={`hero-status ${alerts?.length ? 'has-alerts' : ''}`} data-testid="home-status">
          {alerts?.length ? `⚠️ ${alerts.length} active alert(s)` : '✅ Greenhouse conditions are normal'}
        </div>
      </section>

      <h2>Current conditions</h2>
      <div className="summary-grid">
        {SENSOR_KEYS.map((k) => (
          <div key={k} className="card summary-item">
            <span>{SENSORS[k].icon} {SENSORS[k].label}</span>
            <strong>{formatValue(k, live?.[k])} {SENSORS[k].unit}</strong>
          </div>
        ))}
      </div>

      <h2>Quick access</h2>
      <div className="quick-grid">
        <Link to="/dashboard" className="card quick"><b>📊 Real-time dashboard</b><span>Live readings, chart and alerts</span></Link>
        <Link to="/control" className="card quick"><b>🎛️ Control panel</b><span>Fan, pump and lights, automatic mode</span></Link>
        <Link to="/history" className="card quick"><b>🗂️ Data history</b><span>Previous readings and CSV export</span></Link>
        <Link to="/settings" className="card quick"><b>⚙️ Settings</b><span>Alert thresholds and automation rules</span></Link>
      </div>
    </div>
  );
}
