// How this person likes WeKnow, and the few yes/no answers it must remember. Kept in localStorage on this device
// only (the yes to using the internet and the person to call are never synced, per the design).

import { createStore, useStore } from './store';

export type Theme = 'light' | 'dark' | 'system';

export interface Prefs {
  /** Welcome and Allow are done. */
  started: boolean;
  theme: Theme;
  voice: boolean;
  /** 0 Slower (0.8), 1 Normal, 2 Faster (1.2). */
  rate: 0 | 1 | 2;
  /** 0, 1, 2 = 100%, 115%, 130% of the root size. */
  size: 0 | 1 | 2;
  /** The person said yes to using the internet once. */
  consented: boolean;
  askEvery: boolean;
  /** "I worked that out right here" has been said once. */
  toldLocal: boolean;
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
  consented: false,
  askEvery: false,
  toldLocal: false,
  offeredReady: false,
  offerNotes: true,
  toldNotes: false,
  trustedName: '',
  trustedNumber: '',
  lastProject: null,
  explainLang: 'es',
};

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
    return { ...DEFAULT_PREFS, ...raw };
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
