/**
 * Application configuration.
 *
 * DATA MODE
 *  - "simulation" (default): virtual ESP8266 + in-memory database and auth.
 *    No hardware and no Firebase project are needed.
 *  - "firebase": connects to a real Firebase project (Realtime Database +
 *    Authentication). The values come from the .env file (see .env.example).
 */
const env = import.meta.env;

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

const hasFirebase = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

export const DATA_MODE = env.VITE_DATA_MODE === 'firebase' && hasFirebase ? 'firebase' : 'simulation';

const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');

/** How often the (virtual) ESP8266 sends readings, in milliseconds. */
export const SEND_INTERVAL_MS = Number(params.get('interval')) || Number(env.VITE_SEND_INTERVAL_MS) || 5000;

/** Simulated seconds per real second (60 = one simulated minute per second). */
export const SIMULATION_SPEED = Number(params.get('speed')) || 60;

/** Control commands are removed from the database after this delay. */
export const COMMAND_TTL_MS = 30_000;

/** Number of points shown in the live chart. */
export const CHART_POINTS = 30;
