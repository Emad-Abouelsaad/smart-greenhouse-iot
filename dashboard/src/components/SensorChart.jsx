import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SENSORS } from '../logic/thresholds.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

/** Live line chart of the latest readings stored in /history. */
export default function SensorChart({ rows, height = 320 }) {
  const labels = rows.map((r) => new Date(r.timestamp).toLocaleTimeString());
  const line = (key, axis = 'y') => ({
    label: `${SENSORS[key].label} (${SENSORS[key].unit})`,
    data: rows.map((r) => r[key]),
    borderColor: SENSORS[key].color,
    backgroundColor: SENSORS[key].color + '22',
    tension: 0.35,
    pointRadius: 0,
    borderWidth: 2,
    yAxisID: axis,
  });

  const data = {
    labels,
    datasets: [line('temperature'), line('humidity'), line('soilMoisture'), line('lightLevel'), line('airQuality', 'y2')],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'bottom' }, title: { display: true, text: 'Real-time sensor data trends' } },
    scales: {
      y: { min: 0, max: 100, title: { display: true, text: '°C / %' } },
      y2: { position: 'right', min: 300, suggestedMax: 1500, grid: { drawOnChartArea: false }, title: { display: true, text: 'CO₂ eq. (ppm)' } },
      x: { ticks: { maxTicksLimit: 8 } },
    },
  };
  return (
    <div className="chart-box" style={{ height }} data-testid="sensor-chart">
      <Line data={data} options={options} />
    </div>
  );
}
