import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBackend, useConnection, useDbValue } from '../services/useData.js';

export default function Layout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const backend = useBackend();
  const connected = useConnection();
  const lastUpdate = useDbValue('esp8266/lastUpdate');

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="navbar">
        <NavLink to="/" className="brand">
          <span className="brand-icon">🌱</span> Smart Greenhouse
        </NavLink>
        <nav className="nav-links">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/control">Control Panel</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="nav-user">
          <span className="user-name" title={user?.email}>{user?.displayName || user?.email}</span>
          <button className="btn btn-outline btn-small" onClick={logout}>Log out</button>
        </div>
      </header>

      <div className="status-bar" data-testid="status-bar">
        <span className={`dot ${connected ? 'dot-on' : 'dot-off'}`} />
        <span>{connected ? 'Connected' : 'Disconnected'}</span>
        <span className="sep">|</span>
        <span>Last update: <strong data-testid="last-update">{lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : '--'}</strong></span>
        <span className={`mode-badge mode-${backend.mode}`}>
          {backend.mode === 'simulation' ? 'Simulation mode' : 'Live mode (Firebase)'}
        </span>
      </div>

      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">Smart Greenhouse System · Emad Abouelsaad · Akademia WSB</footer>
    </div>
  );
}
