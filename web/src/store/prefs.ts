// How this person likes WeKnow, and the few yes/no answers it must remember. Kept in localStorage on this device
// only (the yes to using the internet and the person to call are never synced, per the design).

import { createStore, useStore } from './store';

export type Theme = 'light' | 'dark' | 'system';

/**
 * When WeKnow may use the internet. 'ask-once': nothing has been asked yet; the first time this device cannot answer
 * well, one sheet asks. 'auto': when it helps, without asking again (every answer still shows what went). 'every':
 * ask each time. 'never': answer only from this device.
 */
export type Internet = 'ask-once' | 'auto' | 'every' | 'never';
export const INTERNET: readonly Internet[] = ['ask-once', 'auto', 'every', 'never'];

export interface Prefs {
  /** Welcome and Allow are done. */
  started: boolean;
  theme: Theme;
  voice: boolean;
  /** 0 Slower (0.8), 1 Normal, 2 Faster (1.2). */
  rate: 0 | 1 | 2;
  /** 0, 1, 2 = 100%, 115%, 130% of the root size. */
  size: 0 | 1 | 2;
  /** When the internet may be used (see Internet). */
  internet: Internet;
  /** "I worked that out right here" has been said once. */
  toldLocal: boolean;
  /** What the full check needs was shown once (a device with no model of its own). */
  toldBasic: boolean;
  /** The offer to get ready to work without the internet was made (it is made once). */
  offeredReady: boolean;
  /** Offer to remember new things. */
  offerNotes: boolean;
  /** The explanation that notes stay on this device was spoken once. */
  toldNotes: boolean;
  trustedName: string;
  trustedNumber: string;
  /** The project used last, for filing new checks. */
  lastProject: string | null;
  /** The language last chosen for "Explain in my language". */
  explainLang: string;
}

const KEY = 'weknow.prefs.v1';
export const DEFAULT_PREFS: Prefs = {
  started: false,
  theme: 'light',
  voice: true,
  rate: 1,
  size: 0,
  internet: 'ask-once',
  toldLocal: false,
  toldBasic: false,
  offeredReady: false,
  offerNotes: true,
  toldNotes: false,
  trustedName: '',
  trustedNumber: '',
  lastProject: null,
  explainLang: 'es',
};

/** Older saved prefs kept two yes/no answers; they map onto the one choice. */
interface OldPrefs {
  consented?: unknown;
  askEvery?: unknown;
}

/** Saved prefs (possibly from an older version) as today's Prefs. */
export function migratePrefs(raw: Partial<Prefs> & OldPrefs): Prefs {
  const { consented, askEvery, ...rest } = raw;
  let internet: Internet = INTERNET.includes(rest.internet as Internet) ? (rest.internet as Internet) : 'ask-once';
  if (rest.internet === undefined) {
    if (askEvery === true) internet = 'every';
    else if (consented === true) internet = 'auto';
  }
  return { ...DEFAULT_PREFS, ...rest, internet };
}

function load(): Prefs {
  try {
    return migratePrefs(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs> & OldPrefs);
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const prefsStore = createStore<Prefs>(typeof localStorage === 'undefined' ? { ...DEFAULT_PREFS } : load());

prefsStore.subscribe(() => {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefsStore.get()));
  } catch {
    /* storage unavailable: the choice holds for this visit */
  }
});

export const getPrefs = () => prefsStore.get();
export function setPrefs(patch: Partial<Prefs>) {
  prefsStore.set((p) => ({ ...p, ...patch }));
}
export const usePrefs = () => useStore(prefsStore);
export function resetPrefs() {
  prefsStore.set({ ...DEFAULT_PREFS, started: true });
}

export const RATES = [0.8, 1, 1.2] as const;
export const SIZES = [100, 115, 130] as const;

// ---- theme and text size, applied to <html> ----

const dark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;

export function applyLook(p: Prefs = getPrefs()) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const theme = p.theme === 'system' ? (dark() ? 'dark' : 'light') : p.theme;
  html.dataset.theme = theme;
  html.style.fontSize = `${SIZES[p.size]}%`;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0F0E' : '#FFFFFF');
}

export function watchLook() {
  applyLook();
  prefsStore.subscribe(() => applyLook());
  if (typeof matchMedia !== 'undefined') {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getPrefs().theme === 'system') applyLook();
    });
  }
}
