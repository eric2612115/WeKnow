// After a new deploy, a tab opened earlier still points at the old build's chunk names, which no longer exist.
// The fix is to load the page again once; a guard stops a reload loop if the network itself is down.

const KEY = 'weknow-stale-reload';
const WINDOW_MS = 15_000;

export function isStaleChunk(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}

/** Reloads once per 15 s. Returns true when a reload was started. */
export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload once; the next failure shows the error screen.
  }
  window.location.reload();
  return true;
}

/** Wraps a lazy import: on a stale chunk, reload instead of failing. */
export async function loadFresh<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (e) {
    if (isStaleChunk(e) && reloadForNewBuild()) return new Promise<T>(() => undefined);
    throw e;
  }
}

/** Covers every other dynamic import (reader, explain, ...) through Vite's own preload event. */
export function watchStaleBuild(): void {
  window.addEventListener('vite:preloadError', (event) => {
    if (reloadForNewBuild()) event.preventDefault();
  });
}
