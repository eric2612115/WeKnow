// Runtime settings pushed through Remote Config, with safe built-in defaults when offline.

import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { app } from './firebase';

export interface Settings {
  cloudModel: string;
  packUrl: string;
  lookupEnabled: boolean;
  urgencyPhrases: string[];
}

const DEFAULTS: Settings = {
  cloudModel: 'gemini-3.5-flash-lite',
  packUrl: '/packs/us-home.json',
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
