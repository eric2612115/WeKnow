// Payees the person has confirmed before. Kept only on this device (localStorage); never synced or sent.

import type { KnownPayee } from './core/verdict';

const KEY = 'weknow.payees.v1';

export function loadPayees(): KnownPayee[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw)
      ? raw.filter((p): p is KnownPayee => typeof p?.name === 'string' && typeof p?.payTo === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Save a payee only after the person confirmed it (for example after calling the number they already had). */
export function confirmPayee(p: KnownPayee) {
  const rest = loadPayees().filter((k) => k.name.toLowerCase() !== p.name.toLowerCase());
  try {
    localStorage.setItem(KEY, JSON.stringify([...rest, { name: p.name.slice(0, 80), payTo: p.payTo.slice(-4) }]));
  } catch {
    /* storage unavailable: nothing remembered */
  }
}
