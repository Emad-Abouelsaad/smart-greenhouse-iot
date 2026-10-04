/**
 * Creates the data and authentication services for the selected mode.
 * The rest of the application only uses `backend.db` and `backend.auth`.
 */
import { DATA_MODE, firebaseConfig, SEND_INTERVAL_MS, SIMULATION_SPEED } from '../config.js';
import { MemoryDatabase } from './memoryDatabase.js';
import { MemoryAuth } from './memoryAuth.js';
import { VirtualDevice } from '../simulation/virtualDevice.js';
import { CloudLogic } from '../simulation/cloudLogic.js';

async function createBackend() {
  if (DATA_MODE === 'firebase') {
    const { initializeApp } = await import('firebase/app');
    const { FirebaseDatabase } = await import('./firebaseDatabase.js');
    const { FirebaseAuth } = await import('./firebaseAuth.js');
    const app = initializeApp(firebaseConfig);
    return { mode: 'firebase', db: new FirebaseDatabase(app), auth: new FirebaseAuth(app) };
  }

  const db = new MemoryDatabase({ settings: { autoMode: false } });
  const auth = new MemoryAuth();
  const cloud = new CloudLogic(db);
  const device = new VirtualDevice(db, { intervalMs: SEND_INTERVAL_MS, speed: SIMULATION_SPEED });
  cloud.start();
  device.start();
  // useful for debugging in the browser console
  if (typeof window !== 'undefined') window.__greenhouse = { db, auth, device, cloud };
  return { mode: 'simulation', db, auth, device, cloud };
}

export const backendPromise = createBackend();
