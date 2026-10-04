import { SENSORS, SENSOR_KEYS } from './thresholds.js';

/**
 * Converts history records into CSV text (Excel compatible).
 * @param {Array<{timestamp:number}>} rows
 */
export function toCSV(rows) {
  const header = ['Timestamp', ...SENSOR_KEYS.map((k) => `${SENSORS[k].label} (${SENSORS[k].unit})`)];
  const lines = [header.map(escapeCell).join(',')];
  for (const row of rows || []) {
    const ts = row.timestamp ? new Date(row.timestamp).toISOString() : '';
    const cells = [ts, ...SENSOR_KEYS.map((k) => (row[k] === undefined || row[k] === null ? '' : Number(row[k])))];
    lines.push(cells.map(escapeCell).join(','));
  }
  return lines.join('\n') + '\n';
}

function escapeCell(v) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCSV(rows, filename) {
  const blob = new Blob([toCSV(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `greenhouse_data_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
