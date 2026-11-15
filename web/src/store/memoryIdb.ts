// Household memory kept in IndexedDB on this device. It never syncs: there is no account copy, no Firestore
// collection and no network call anywhere in this path. Every record is sanitized (core/memory.ts) before it is
// written, so a payee keeps only the last four digits whatever was passed in.

import { memoryStorage, sanitize, type Memory, type MemoryStorage } from '../core/memory';
import { idbAll, idbAvailable, idbClear, idbDelete, idbPut } from './idb';

export function idbMemoryStorage(): MemoryStorage {
  if (!idbAvailable()) return memoryStorage();
  return {
    all: () => idbAll<Memory>('memory'),
    put: async (m) => idbPut('memory', sanitize(m)),
    remove: (id) => idbDelete('memory', id),
    clear: () => idbClear('memory'),
  };
}
