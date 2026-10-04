/**
 * Firebase Authentication adapter (LIVE mode).
 */
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, sendPasswordResetEmail,
} from 'firebase/auth';

export class FirebaseAuth {
  constructor(app) {
    this.auth = getAuth(app);
  }

  onAuthStateChanged(cb) {
    return onAuthStateChanged(this.auth, cb);
  }

  async signIn(email, password) {
    const cred = await signInWithEmailAndPassword(this.auth, email.trim(), password);
    return cred.user;
  }

  async signUp({ firstName, lastName, email, password }) {
    const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
    await updateProfile(cred.user, { displayName: `${firstName} ${lastName}` });
    // After registration the user is sent to the login page to sign in.
    await signOut(this.auth);
    return cred.user;
  }

  signOut() {
    return signOut(this.auth);
  }

  resetPassword(email) {
    return sendPasswordResetEmail(this.auth, email.trim());
  }
}
