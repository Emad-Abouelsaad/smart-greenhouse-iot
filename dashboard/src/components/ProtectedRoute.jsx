import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

/** Only signed-in users can open the application pages. */
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (user === undefined) return <div className="loading">Loading…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
