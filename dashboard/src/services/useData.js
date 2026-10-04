import { createContext, useContext, useEffect, useState } from 'react';

export const BackendContext = createContext(null);
export const useBackend = () => useContext(BackendContext);

/** Subscribes to a database path and returns its current value (live). */
export function useDbValue(path, options) {
  const backend = useBackend();
  const [value, setValue] = useState(undefined);
  useEffect(() => backend.db.onValue(path, setValue, options), [backend, path]);
  return value;
}

/** Returns true while the app is connected to the database. */
export function useConnection() {
  const backend = useBackend();
  const [connected, setConnected] = useState(false);
  useEffect(() => backend.db.onConnectionChange(setConnected), [backend]);
  return connected;
}
