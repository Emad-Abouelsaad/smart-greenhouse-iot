import { useMemo } from 'react';
import { useDbValue } from './useData.js';

/** Returns the stored history as an array sorted by time (oldest first). */
export function useHistory(limit = 500) {
  const raw = useDbValue('history', { limitToLast: limit });
  return useMemo(() => {
    if (!raw) return [];
    return Object.entries(raw)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-limit);
  }, [raw, limit]);
}
