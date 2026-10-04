/**
 * In-memory implementation of the small part of the Firebase Realtime
 * Database API that the dashboard uses (onValue, set, update, remove, push).
 *
 * It is used in SIMULATION mode, so the whole system (virtual ESP8266,
 * cloud logic and dashboard) can run in the browser without hardware and
 * without a Firebase project. The dashboard code is identical in both modes.
 */

const clone = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const split = (path) => String(path || '').split('/').filter(Boolean);

let pushCounter = 0;
export function generatePushKey(now = Date.now()) {
  pushCounter = (pushCounter + 1) % 100000;
  return `-${now.toString(36).padStart(9, '0')}${pushCounter.toString(36).padStart(4, '0')}`;
}

export class MemoryDatabase {
  constructor(initial = {}) {
    this.root = clone(initial) || {};
    this.listeners = new Set();
  }

  get(path) {
    let node = this.root;
    for (const part of split(path)) {
      if (node === null || typeof node !== 'object' || !(part in node)) return null;
      node = node[part];
    }
    return clone(node);
  }

  _write(path, value) {
    const parts = split(path);
    if (parts.length === 0) {
      this.root = value === null ? {} : clone(value);
      return;
    }
    let node = this.root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (node[parts[i]] === null || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    const last = parts[parts.length - 1];
    if (value === null || value === undefined) delete node[last];
    else node[last] = clone(value);
    this._prune(parts);
  }

  // remove empty parent objects, like Firebase does
  _prune(parts) {
    for (let len = parts.length - 1; len > 0; len--) {
      const parentPath = parts.slice(0, len);
      const v = this.get(parentPath.join('/'));
      if (v && typeof v === 'object' && Object.keys(v).length === 0) {
        let node = this.root;
        for (let i = 0; i < parentPath.length - 1; i++) node = node[parentPath[i]];
        delete node[parentPath[parentPath.length - 1]];
      } else break;
    }
  }

  _notify(changedPath) {
    const changed = split(changedPath).join('/');
    for (const l of [...this.listeners]) {
      const p = l.path;
      const related = p === '' || changed === '' || changed === p || changed.startsWith(p + '/') || p.startsWith(changed + '/');
      if (related) l.cb(this.get(p));
    }
  }

  async set(path, value) {
    this._write(path, value);
    this._notify(path);
  }

  async update(path, values) {
    for (const [k, v] of Object.entries(values || {})) this._write(`${path}/${k}`, v);
    this._notify(path);
  }

  async remove(path) {
    this._write(path, null);
    this._notify(path);
  }

  async push(path, value) {
    const key = generatePushKey();
    await this.set(`${path}/${key}`, value);
    return key;
  }

  onValue(path, cb) {
    const listener = { path: split(path).join('/'), cb };
    this.listeners.add(listener);
    cb(this.get(listener.path));
    return () => this.listeners.delete(listener);
  }

  onConnectionChange(cb) {
    cb(true);
    return () => {};
  }
}
