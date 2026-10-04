import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { validateSignup, authErrorMessage } from '../logic/validation.js';

const EMPTY = { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' };

export default function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const problem = validateSignup(form);
    if (problem) {
      if (problem.startsWith('Passwords do not match')) setForm({ ...form, confirmPassword: '' });
      return setError(problem);
    }
    setBusy(true);
    try {
      await signUp(form);
      navigate('/login', { state: { registered: true } });
    } catch (err) {
      setError(authErrorMessage(err.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-logo">🌱</div>
        <h1>Sign Up to Smart Greenhouse</h1>
        <p className="muted">Create an account to access the monitoring system</p>
        <div className="row-2">
          <div>
            <label htmlFor="firstName">First name</label>
            <input id="firstName" name="firstName" value={form.firstName} onChange={change} />
          </div>
          <div>
            <label htmlFor="lastName">Last name</label>
            <input id="lastName" name="lastName" value={form.lastName} onChange={change} />
          </div>
        </div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" value={form.email} onChange={change} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" value={form.password} onChange={change} />
        <label htmlFor="confirmPassword">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" value={form.confirmPassword} onChange={change} />

        {error && <div className="form-error" role="alert" data-testid="signup-error">{error}</div>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy} data-testid="signup-submit">
          {busy ? 'Creating account…' : 'Sign up'}
        </button>
        <p className="auth-switch">Already have an account? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}
