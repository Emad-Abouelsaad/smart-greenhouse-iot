/**
 * In-memory authentication used in SIMULATION mode.
 * It returns the same error codes as Firebase Authentication, so the
 * Login and Sign-up pages behave exactly as they do in LIVE mode.
 */

export class AuthError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export const DEMO_USER = { email: 'demo@greenhouse.local', password: 'Demo1234', firstName: 'Demo', lastName: 'User' };

export class MemoryAuth {
  constructor() {
    this.users = new Map();
    this.currentUser = null;
    this.listeners = new Set();
    this.users.set(DEMO_USER.email, { ...DEMO_USER });
  }

  _emit() {
    for (const cb of this.listeners) cb(this.currentUser);
  }

  onAuthStateChanged(cb) {
    this.listeners.add(cb);
    cb(this.currentUser);
    return () => this.listeners.delete(cb);
  }

  async signIn(email, password) {
    const key = String(email).trim().toLowerCase();
    const user = this.users.get(key);
    if (!user) throw new AuthError('auth/user-not-found');
    if (user.password !== password) throw new AuthError('auth/wrong-password');
    this.currentUser = { uid: `sim-${key}`, email: key, displayName: `${user.firstName} ${user.lastName}` };
    this._emit();
    return this.currentUser;
  }

  async signUp({ firstName, lastName, email, password }) {
    const key = String(email).trim().toLowerCase();
    if (this.users.has(key)) throw new AuthError('auth/email-already-in-use');
    if (String(password).length < 6) throw new AuthError('auth/weak-password');
    this.users.set(key, { email: key, password, firstName, lastName });
    return { email: key };
  }

  async signOut() {
    this.currentUser = null;
    this._emit();
  }

  async resetPassword(email) {
    const key = String(email).trim().toLowerCase();
    if (!this.users.has(key)) throw new AuthError('auth/user-not-found');
    return true; // in LIVE mode Firebase sends a reset e-mail
  }
}
