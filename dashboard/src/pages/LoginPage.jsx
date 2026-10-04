import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { useBackend } from '../services/useData.js';
import { validateLogin, authErrorMessage, isValidEmail } from '../logic/validation.js';
import { DEMO_USER } from '../services/memoryAuth.js';

export default function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const backend = useBackend();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState(location.state?.registered ? 'Account created successfully. Please log in.' : '');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setInfo('');
    const problem = validateLogin(form);
    if (problem) return setError(problem);
    setBusy(true);
    try {
      await signIn(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(''); setInfo('');
    if (!isValidEmail(form.email)) return setError('Enter your email address first, then click "Forgot password?".');
    try {
      await resetPassword(form.email);
      setInfo('A password reset link has been sent to your email.');
    } catch (err) {
      setError(authErrorMessage(err.code));
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-logo">🌱</div>
        <h1>Welcome to Smart Greenhouse</h1>
        <p className="muted">Log in to monitor and control your greenhouse</p>

        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" value={form.email} onChange={change} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" value={form.password} onChange={change} />

        {error && <div className="form-error" role="alert" data-testid="login-error">{error}</div>}
        {info && <div className="form-info" data-testid="login-info">{info}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} data-testid="login-submit">
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <button type="button" className="link-btn" onClick={reset}>Forgot password?</button>
        <p className="auth-switch">No account yet? <Link to="/signup">Sign up</Link></p>
        {backend.mode === 'simulation' && (
          <p className="demo-hint">Simulation mode – demo account: <code>{DEMO_USER.email}</code> / <code>{DEMO_USER.password}</code></p>
        )}
      </form>
    </div>
  );
}
