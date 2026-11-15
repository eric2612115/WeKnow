// IndexedDB, promised. Everything here stays on this device: checks, projects, pictures and household notes.
// Nothing in this file talks to the network, and no other module copies these stores anywhere.

const DB_NAME = 'weknow';
const VERSION = 1;
export const STORES = ['checks', 'projects', 'pictures', 'memory'] as const;
export type StoreName = (typeof STORES)[number];

let opening: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function open(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbAll<T>(store: StoreName): Promise<T[]> {
  const db = await open();
  return done(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function idbGet<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await open();
  return done(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function idbPut<T extends { id: string }>(store: StoreName, value: T): Promise<void> {
  const db = await open();
  await done(db.transaction(store, 'readwrite').objectStore(store).put(value));
}

export async function idbDelete(store: StoreName, id: string): Promise<void> {
  const db = await open();
  await done(db.transaction(store, 'readwrite').objectStore(store).delete(id));
}

export async function idbClear(store: StoreName): Promise<void> {
  const db = await open();
  await done(db.transaction(store, 'readwrite').objectStore(store).clear());
}
