// When the pack has no sourced price for a line, ask for it to be added.
// Only the masked line item and the region are stored; the rules refuse anything else.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';
import { buildCloudLookup } from './core/cloudPayload';

export async function requestPrice(itemName: string, region: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  let payload;
  try {
    payload = buildCloudLookup({ item: itemName, region });
  } catch {
    return false; // personal data or a malformed line: never stored
  }
  await addDoc(collection(db, 'requests'), { ...payload, uid: user.uid, createdAt: serverTimestamp() });
  return true;
}

/** Dev-only probe of the security rules, used from the browser console during development. */
export async function probeRules() {
  const fs = await import('firebase/firestore');
  const uid = auth.currentUser?.uid;
  const out: Record<string, string> = {};
  const attempt = (p: Promise<unknown>, good: string, bad: string) =>
    p.then(() => good).catch((e: { code?: string }) => `${bad} (${e.code})`);
  out.validRequest = await attempt(requestPrice('Brake fluid flush', 'US'), 'written', 'refused');
  out.clientBlocksPhone = String(await requestPrice('call 510 555 0198 about flush', 'US'));
  out.rulesBlockDigits = await attempt(
    fs.addDoc(fs.collection(db, 'requests'), { item: 'acct 12345678 flush', region: 'US', uid, createdAt: fs.serverTimestamp() }),
    'WROTE (bad)',
    'refused',
  );
  out.rulesBlockExtraField = await attempt(
    fs.addDoc(fs.collection(db, 'requests'), { item: 'flush', region: 'US', uid, createdAt: fs.serverTimestamp(), name: 'M' }),
    'WROTE (bad)',
    'refused',
  );
  out.readRequests = await attempt(fs.getDocs(fs.collection(db, 'requests')), 'READ (bad)', 'refused');
  out.readPacks = await attempt(fs.getDocs(fs.collection(db, 'packs')), 'read ok', 'refused');
  return out;
}
