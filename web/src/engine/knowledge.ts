// The layered knowledge pack (knowledgeBrowser.ts) and the Remote Config settings, opened once and shared.
// Settings come from Remote Config with built-in defaults; a slow or missing network never blocks an answer.

import type { LayeredKnowledge } from '../core/knowledge';
import type { Settings } from '../config';

const DEFAULTS: Settings = {
  cloudModel: 'gemini-3.5-flash-lite',
  packUrl: '/packs/us-home.json',
  packId: 'us-home',
  packRoot: '',
  lookupEnabled: false,
  urgencyPhrases: [],
};

let settingsP: Promise<Settings> | null = null;
let kbP: Promise<LayeredKnowledge> | null = null;

/** Remote Config settings, or the defaults after four seconds without an answer. */
export function appSettings(): Promise<Settings> {
  settingsP ??= Promise.race([
    import('../config').then((m) => m.settings()),
    new Promise<Settings>((r) => setTimeout(() => r(DEFAULTS), 4000)),
  ]).catch(() => DEFAULTS);
  return settingsP;
}

export function knowledge(): Promise<LayeredKnowledge> {
  kbP ??= (async () => {
    const s = await appSettings();
    const { openBrowserKnowledge } = await import('../knowledgeBrowser');
    return openBrowserKnowledge({ packId: s.packId, root: s.packRoot });
  })().catch((e) => {
    kbP = null; // try again next time
    throw e;
  });
  return kbP;
}
