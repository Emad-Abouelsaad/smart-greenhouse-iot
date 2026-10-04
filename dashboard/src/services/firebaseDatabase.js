/**
 * Firebase Realtime Database adapter (LIVE mode).
 * Exposes the same small API as MemoryDatabase so the rest of the
 * application does not need to know which mode is active.
 */
import {
  getDatabase, ref, onValue as fbOnValue, set as fbSet, update as fbUpdate,
  remove as fbRemove, push as fbPush, query, limitToLast,
} from 'firebase/database';

export class FirebaseDatabase {
  constructor(app) {
    this.db = getDatabase(app);
  }

  onValue(path, cb, options = {}) {
    const base = ref(this.db, path);
    const target = options.limitToLast ? query(base, limitToLast(options.limitToLast)) : base;
    return fbOnValue(target, (snap) => cb(snap.val()), (err) => {
      console.error(`Database read failed for ${path}:`, err);
      cb(null);
    });
  }

  set(path, value) {
    return fbSet(ref(this.db, path), value);
  }

  update(path, values) {
    return fbUpdate(ref(this.db, path), values);
  }

  remove(path) {
    return fbRemove(ref(this.db, path));
  }

  async push(path, value) {
    const r = await fbPush(ref(this.db, path), value);
    return r.key;
  }

  onConnectionChange(cb) {
    return fbOnValue(ref(this.db, '.info/connected'), (snap) => cb(snap.val() === true));
  }
}
