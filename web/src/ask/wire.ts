// The live light. Every request that leaves this device says so here, at the moment it goes, with what it carries:
// the exact covered words, or (on a device with no model of its own) the covered paper or picture. The conversation
// shows two lamps from this: this device, or the internet. Nothing here decides anything; it only reports.

import { createStore, useStore } from '../store/store';

/** What is on its way: a covered question in words, the covered words of a paper, or the covered picture. */
export type Going = { what: 'question'; words: string } | { what: 'paper'; chars: number } | { what: 'picture' };

const store = createStore<{ going: Going | null }>({ going: null });
const open: Going[] = [];

/** Call just before a request leaves; call what it returns when the answer is back (or it failed). */
export function goOnline(going: Going): () => void {
  open.push(going);
  store.set({ going });
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const i = open.lastIndexOf(going);
    if (i >= 0) open.splice(i, 1);
    store.set({ going: open[open.length - 1] ?? null });
  };
}

/** Runs one request with the internet lamp lit for exactly as long as it is out. */
export async function online<T>(going: Going, job: () => Promise<T>): Promise<T> {
  const back = goOnline(going);
  try {
    return await job();
  } finally {
    back();
  }
}

export const useWire = () => useStore(store);
export const wireNow = () => store.get().going;
