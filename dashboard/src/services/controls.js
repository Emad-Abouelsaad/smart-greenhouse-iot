import { COMMAND_TTL_MS } from '../config.js';

/**
 * Control functions used by the Control Panel.
 *
 * A command ('ON' or 'OFF') is written to /esp8266/<device>/control. The
 * ESP8266 applies it and reports the result in /esp8266/<device>/status.
 * To prevent old commands from being applied again later (for example after
 * the device restarts), every command is removed after COMMAND_TTL_MS.
 */
const pendingRemovals = {};

export async function sendCommand(db, device, state) {
  if (!['fan', 'pump', 'light'].includes(device)) throw new Error(`Unknown device: ${device}`);
  if (state !== 'ON' && state !== 'OFF') throw new Error(`Invalid command: ${state}`);
  const path = `esp8266/${device}/control`;
  await db.set(path, state);
  clearTimeout(pendingRemovals[device]);
  pendingRemovals[device] = setTimeout(() => {
    db.remove(path).catch((err) => console.error(`Could not remove ${device} command:`, err));
  }, COMMAND_TTL_MS);
}

export const controlFan = (db, state) => sendCommand(db, 'fan', state);
export const controlPump = (db, state) => sendCommand(db, 'pump', state);
export const controlLight = (db, state) => sendCommand(db, 'light', state);
