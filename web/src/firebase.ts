// One place that wires Firebase: app, App Check, anonymous auth, Firestore with an offline cache, AI Logic.

import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, signInAnonymously, onAuthStateChanged, type User } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAI, GoogleAIBackend } from 'firebase/ai';

const env = import.meta.env;

export const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// Local development can use an App Check debug token: set VITE_APPCHECK_DEBUG=true and register the printed token.
if (env.VITE_APPCHECK_DEBUG === 'true') {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});

export const auth = getAuth(app);

/** Everyone starts anonymous; no account is needed to use WeKnow. */
export function ensureUser(): Promise<User> {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, (user) => {
      if (user) {
        stop();
        resolve(user);
      }
    });
    signInAnonymously(auth).catch((e) => {
      stop();
      reject(e);
    });
  });
}

// Knowledge packs and learned items stay readable offline through Firestore's local cache.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const ai = getAI(app, { backend: new GoogleAIBackend() });

/** Cloud models that run on the Gemini Developer API without billing (Firebase docs, 2026-11-16). */
export const CLOUD_MODEL = env.VITE_CLOUD_MODEL || 'gemini-3.5-flash-lite';
export const LIVE_MODEL = env.VITE_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
