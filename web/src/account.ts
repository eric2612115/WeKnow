// Accounts: everyone starts anonymous. Signing in with Google upgrades the same account (same uid), so nothing
// done before signing in is lost. Signing out returns to a fresh anonymous session.

import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithPopup,
  signOut as fbSignOut,
  signInAnonymously,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export interface AccountState {
  signedIn: boolean; // signed in with Google (not anonymous)
  name: string | null;
  email: string | null;
  photo: string | null;
  uid: string | null;
}

export function toState(user: User | null): AccountState {
  const google = !!user && !user.isAnonymous;
  return {
    signedIn: google,
    name: google ? user!.displayName : null,
    email: google ? user!.email : null,
    photo: google ? user!.photoURL : null,
    uid: user?.uid ?? null,
  };
}

export function watchAccount(cb: (s: AccountState) => void): () => void {
  return onAuthStateChanged(auth, (u) => cb(toState(u)));
}

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export type SignInResult = 'linked' | 'signed-in' | 'cancelled';

export async function signInWithGoogle(): Promise<SignInResult> {
  const current = auth.currentUser;
  try {
    if (current?.isAnonymous) {
      await linkWithPopup(current, provider);
      return 'linked';
    }
    await signInWithPopup(auth, provider);
    return 'signed-in';
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
      // This Google account already has a WeKnow account: switch to it.
      await signInWithPopup(auth, provider);
      return 'signed-in';
    }
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'cancelled';
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth);
  await signInAnonymously(auth);
}
