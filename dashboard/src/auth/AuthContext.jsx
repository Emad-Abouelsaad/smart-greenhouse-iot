import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ backend, children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  useEffect(() => backend.auth.onAuthStateChanged((u) => setUser(u || null)), [backend]);

  const value = {
    user,
    signIn: (email, password) => backend.auth.signIn(email, password),
    signUp: (data) => backend.auth.signUp(data),
    signOut: () => backend.auth.signOut(),
    resetPassword: (email) => backend.auth.resetPassword(email),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
