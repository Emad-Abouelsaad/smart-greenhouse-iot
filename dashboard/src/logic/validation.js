/** Form validation used by the Login and Sign-up pages. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function validateLogin({ email, password }) {
  if (!email || !password) return 'Please enter your email and password.';
  if (!isValidEmail(email)) return 'Please enter a valid email address.';
  return null;
}

export function validateSignup({ firstName, lastName, email, password, confirmPassword }) {
  if (!firstName || !lastName || !email || !password || !confirmPassword) {
    return 'Please fill out all fields.';
  }
  if (!isValidEmail(email)) return 'Please enter a valid email address.';
  if (password.length < 6) return 'Password must be at least 6 characters long.';
  if (password !== confirmPassword) return 'Passwords do not match. Please enter the same password again.';
  return null;
}

/** Maps Firebase Authentication error codes to friendly messages. */
export function authErrorMessage(code) {
  switch (code) {
    case 'auth/user-not-found':
      return 'No account was found with this email. Check the email or reset it, or create a new account.';
    case 'auth/wrong-password':
      return 'The password is incorrect. Try again or reset your password.';
    case 'auth/invalid-credential':
      return 'The email or password is incorrect. Please correct them or reset your password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
