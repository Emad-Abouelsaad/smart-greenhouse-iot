import { useMemo, useState } from 'react';
import { useHistory } from '../services/useHistory.js';
import { useDbValue } from '../services/useData.js';
import { SENSORS, SENSOR_KEYS, formatValue } from '../logic/thresholds.js';
import { downloadCSV } from '../logic/csv.js';
import SensorChart from '../components/SensorChart.jsx';

const RANGES = [
  { key: 'all', label: 'All data' },
  { key: '15', label: 'Last 15 minutes' },
  { key: '60', label: 'Last hour' },
];

export default function HistoryPage() {
  const rows = useHistory(500);
  const log = useDbValue('alerts/log');
  const [range, setRange] = useState('all');

  const filtered = useMemo(() => {
    if (range === 'all') return rows;
    const from = Date.now() - Number(range) * 60_000;
    return rows.filter((r) => r.timestamp >= from);
  }, [rows, range]);

  const alertLog = useMemo(() => Object.values(log || {}).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20), [log]);
  const latestFirst = [...filtered].reverse().slice(0, 50);

  return (
    <div>
      <h1 className="page-title">Data History</h1>
      <div className="toolbar">
        <select value={range} onChange={(e) => setRange(e.target.value)} data-testid="range-select">
          {RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <span className="muted">{filtered.length} records</span>
        <button className="btn btn-primary" onClick={() => downloadCSV(filtered)} disabled={!filtered.length} data-testid="export-csv">
          ⬇ Export CSV
        </button>
      </div>

      <section className="card"><SensorChart rows={filtered} height={300} /></section>

      <div className="history-grid">
        <section className="card table-card">
          <h3>Latest records</h3>
          <div className="table-wrap">
            <table data-testid="history-table">
              <thead>
                <tr><th>Time</th>{SENSOR_KEYS.map((k) => <th key={k}>{SENSORS[k].label} ({SENSORS[k].unit})</th>)}</tr>
              </thead>
              <tbody>
                {latestFirst.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                    {SENSOR_KEYS.map((k) => <td key={k}>{formatValue(k, r[k])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h3>Alert log</h3>
          {alertLog.length === 0 ? <p className="muted">No alerts recorded.</p> : (
            <ul className="log-list">
              {alertLog.map((a, i) => (
                <li key={i} className={`log-${a.level}`}>
                  <span className="muted small">{new Date(a.timestamp).toLocaleTimeString()}</span> {a.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
