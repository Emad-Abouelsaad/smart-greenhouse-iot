import { useDbValue } from '../services/useData.js';
import { useHistory } from '../services/useHistory.js';
import { SENSOR_KEYS } from '../logic/thresholds.js';
import { CHART_POINTS } from '../config.js';
import SensorCard from '../components/SensorCard.jsx';
import SensorChart from '../components/SensorChart.jsx';
import AlertsPanel from '../components/AlertsPanel.jsx';

export default function DashboardPage() {
  const live = useDbValue('esp8266');
  const thresholds = useDbValue('settings/thresholds');
  const alerts = useDbValue('alerts/active');
  const history = useHistory(CHART_POINTS);

  return (
    <div>
      <h1 className="page-title">Real-Time Monitoring Dashboard</h1>
      <div className="sensor-grid">
        {SENSOR_KEYS.map((k) => (
          <SensorCard key={k} sensor={k} value={live?.[k]} thresholds={thresholds || undefined} />
        ))}
      </div>
      <div className="dash-grid">
        <section className="card">
          <SensorChart rows={history} />
        </section>
        <AlertsPanel alerts={alerts} />
      </div>
    </div>
  );
}
