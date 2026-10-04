import { SENSORS, formatValue } from '../logic/thresholds.js';
import { sensorStatus } from '../logic/alerts.js';

const STATUS_TEXT = { normal: 'Normal', warning: 'Warning', critical: 'Critical' };

export default function SensorCard({ sensor, value, thresholds }) {
  const meta = SENSORS[sensor];
  const status = value === undefined || value === null ? 'unknown' : sensorStatus(sensor, value, thresholds);
  return (
    <div className={`card sensor-card status-${status}`} data-testid={`card-${sensor}`}>
      <div className="sensor-head">
        <span className="sensor-icon">{meta.icon}</span>
        <span className="sensor-label">{meta.label}</span>
      </div>
      <div className="sensor-value">
        <span data-testid={`value-${sensor}`}>{formatValue(sensor, value)}</span>
        <span className="sensor-unit">{meta.unit}</span>
      </div>
      <div className={`sensor-status badge-${status}`} data-testid={`status-${sensor}`}>
        {STATUS_TEXT[status] || 'No data'}
      </div>
    </div>
  );
}
