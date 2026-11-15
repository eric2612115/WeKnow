// Runtime settings pushed through Remote Config, with safe built-in defaults when offline.

import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { app } from './firebase';

export interface Settings {
  cloudModel: string;
  /** The single-file pack (legacy shape, used by the current app shell and eval). */
  packUrl: string;
  /** The layered pack to open from /packs/catalog.json (see docs/knowledge-layer.md). */
  packId: string;
  /** Pin a layered pack root, e.g. "us-home/root.<hash>.json", to roll back; empty follows the catalog. */
  packRoot: string;
  lookupEnabled: boolean;
  urgencyPhrases: string[];
}

const DEFAULTS: Settings = {
  cloudModel: 'gemini-3.5-flash-lite',
  packUrl: '/packs/us-home.json',
  packId: 'us-home',
  packRoot: '',
  lookupEnabled: false,
  urgencyPhrases: [],
};

let cached: Promise<Settings> | undefined;

export function settings(): Promise<Settings> {
  cached ??= (async () => {
    try {
      const rc = getRemoteConfig(app);
      rc.settings.minimumFetchIntervalMillis = 60 * 60 * 1000;
      rc.defaultConfig = {
        cloud_model: DEFAULTS.cloudModel,
        pack_url: DEFAULTS.packUrl,
        pack_id: DEFAULTS.packId,
        pack_root: DEFAULTS.packRoot,
        lookup_enabled: false,
        urgency_phrases: '[]',
      };
      await fetchAndActivate(rc);
      let phrases: string[] = [];
      try {
        const parsed = JSON.parse(getValue(rc, 'urgency_phrases').asString());
        if (Array.isArray(parsed)) phrases = parsed.filter((p): p is string => typeof p === 'string').slice(0, 100);
      } catch {
        /* keep none */
      }
      return {
        cloudModel: getValue(rc, 'cloud_model').asString() || DEFAULTS.cloudModel,
        packUrl: getValue(rc, 'pack_url').asString() || DEFAULTS.packUrl,
        packId: getValue(rc, 'pack_id').asString() || DEFAULTS.packId,
        packRoot: getValue(rc, 'pack_root').asString(),
        lookupEnabled: getValue(rc, 'lookup_enabled').asBoolean(),
        urgencyPhrases: phrases,
      };
    } catch {
      return DEFAULTS;
    }
  })();
  return cached;
}

/** Extra urgency phrases from Remote Config can only add a warning. */
export function matchesPhrase(text: string, phrases: string[]): boolean {
  const t = text.toLowerCase();
  return phrases.some((p) => p && t.includes(p.toLowerCase()));
}
