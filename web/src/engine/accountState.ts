// Who is signed in, loaded after the first screen is up (Firebase is not needed to start).
// WeKnow works the same without an account; signing in upgrades the silent session in place (account.ts).

import type { AccountState, SignInResult } from '../account';
import { createStore, useStore } from '../store/store';

export const accountStore = createStore<AccountState | null>(null);
export const useAccount = () => useStore(accountStore);

let watching = false;
export function watchAccountLater() {
  if (watching) return;
  watching = true;
  void import('../account').then((m) => m.watchAccount((s) => accountStore.set(s))).catch(() => (watching = false));
}

export async function signIn(): Promise<SignInResult> {
  const m = await import('../account');
  return m.signInWithGoogle();
}

export async function signOut(): Promise<void> {
  const m = await import('../account');
  await m.signOut();
}

export function firstName(a: AccountState | null): string | null {
  if (!a?.signedIn) return null;
  return (a.name ?? a.email ?? '').split(/[\s@]/)[0] || null;
}
