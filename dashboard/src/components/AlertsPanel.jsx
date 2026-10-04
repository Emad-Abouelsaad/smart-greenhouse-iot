const ICON = { warning: '⚠️', critical: '🚨' };

export default function AlertsPanel({ alerts }) {
  const list = alerts || [];
  return (
    <section className="card alerts" data-testid="alerts-panel">
      <h3>Alerts</h3>
      {list.length === 0 ? (
        <p className="muted" data-testid="no-alerts">✅ All conditions are within the recommended ranges.</p>
      ) : (
        <ul className="alert-list">
          {list.map((a, i) => (
            <li key={`${a.sensor}-${i}`} className={`alert-item alert-${a.level}`} data-testid={`alert-${a.sensor}`}>
              <span className="alert-icon">{ICON[a.level]}</span>
              <span className="alert-text">{a.message}</span>
              <span className="alert-level">{a.level}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
