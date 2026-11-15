// The layered knowledge pack in the browser: static files from Hosting, kept on the device in Cache Storage,
// plus learned prices shared through Firestore (read-only to clients, offline-cached).
// Usage: const kb = await openBrowserKnowledge(); readPhoto(kb, photo, question, where)

import { memoryCache, openLayeredKnowledge, type Knowledge, type LayeredKnowledge, type PackCache } from './core/knowledge';
import type { PriceItem } from './core/packs';

export const PACK_CACHE = 'weknow-packs-v1';
const HASHED = /\.[0-9a-f]{16}\.json$/;

/** Cache Storage, keyed by URL path. A service worker added later can read the same cache. */
export function cacheStoragePackCache(name = PACK_CACHE): PackCache | undefined {
  if (typeof caches === 'undefined') return undefined;
  const open = () => caches.open(name);
  return {
    async get(key) {
      const hit = await (await open()).match(key);
      return hit ? hit.text() : undefined;
    },
    async put(key, body) {
      await (await open()).put(key, new Response(body, { headers: { 'content-type': 'application/json' } }));
    },
    async delete(key) {
      await (await open()).delete(key);
    },
    async keys() {
      return (await (await open()).keys()).map((r) => new URL(r.url).pathname);
    },
  };
}

export interface BrowserKnowledgeOptions {
  packId?: string;
  base?: string;
  /** Remote Config `pack_root`: pin a root (rollback); empty follows the catalog. */
  root?: string;
  /** Read shared learned prices from Firestore (packs/{packId}.learned). Default true. */
  shared?: boolean;
}

export async function openBrowserKnowledge(options: BrowserKnowledgeOptions = {}): Promise<LayeredKnowledge> {
  const kb = await openLayeredKnowledge({
    base: options.base ?? '/packs',
    packId: options.packId ?? 'us-home',
    root: options.root || undefined,
    // Hashed files never change, so the HTTP cache may answer without asking; the catalog is always revalidated.
    // After a 404 or a hash mismatch the loader asks again with `reload`, which skips the HTTP cache.
    fetch: (url, init) => fetch(url, { cache: init?.reload ? 'reload' : HASHED.test(url) ? 'force-cache' : 'no-cache' }),
    cache: cacheStoragePackCache() ?? memoryCache(),
  });
  // Ask the browser not to evict the pack under storage pressure (best effort, no prompt in most browsers).
  void navigator.storage?.persist?.().catch(() => false);
  void kb.gc().catch(() => 0);
  if (options.shared !== false) void loadSharedLearned(kb).catch(() => undefined);
  return kb;
}

/**
 * Learned prices that a maintainer reviewed and published (scripts/seed-learned.mjs) live in one Firestore
 * document per pack, so a session costs one read and works offline from Firestore's cache.
 */
async function loadSharedLearned(kb: Knowledge): Promise<number> {
  const [{ doc, getDoc }, { db, ensureUser }] = await Promise.all([import('firebase/firestore'), import('./firebase')]);
  await ensureUser();
  const snap = await getDoc(doc(db, 'packs', kb.id));
  const learned = snap.get('learned') as unknown;
  let n = 0;
  if (Array.isArray(learned)) {
    for (const item of learned as PriceItem[]) {
      try {
        await kb.learn(item, { persist: false });
        n++;
      } catch {
        /* an item without https sources is refused, as on every path */
      }
    }
  }
  return n;
}
