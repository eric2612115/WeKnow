// Firestore security rules, tested against the emulator (runs in CI: npm run test:rules).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'weknow-rules-test',
    firestore: { rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8') },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const valid = (uid: string) => ({ item: 'Brake fluid flush', region: 'US-CA', uid, createdAt: serverTimestamp() });

describe('requests', () => {
  it('a signed-in user may create a masked line item with a region', async () => {
    const db = env.authenticatedContext('u1').firestore();
    await assertSucceeds(addDoc(collection(db, 'requests'), valid('u1')));
  });
  it('signed-out users may not write', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(addDoc(collection(db, 'requests'), valid('u1')));
  });
  it('extra fields, long digit runs, @ signs, other uids and bad regions are refused', async () => {
    const db = env.authenticatedContext('u1').firestore();
    await assertFails(addDoc(collection(db, 'requests'), { ...valid('u1'), name: 'Margaret' }));
    await assertFails(addDoc(collection(db, 'requests'), { ...valid('u1'), item: 'acct 12345678 flush' }));
    await assertFails(addDoc(collection(db, 'requests'), { ...valid('u1'), item: 'mail me at a@b.co' }));
    await assertFails(addDoc(collection(db, 'requests'), valid('u2')));
    await assertFails(addDoc(collection(db, 'requests'), { ...valid('u1'), region: 'California' }));
    await assertFails(addDoc(collection(db, 'requests'), { ...valid('u1'), item: 'x'.repeat(121) }));
  });
  it('nobody may read, change or delete requests', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'requests/r1'), { item: 'x', region: 'US' }));
    const db = env.authenticatedContext('u1').firestore();
    await assertFails(getDoc(doc(db, 'requests/r1')));
    await assertFails(getDocs(collection(db, 'requests')));
    await assertFails(setDoc(doc(db, 'requests/r1'), { item: 'y', region: 'US' }));
  });
});

describe('packs', () => {
  it('signed-in users may read packs; nobody may write them', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'packs/us-home'), { version: '1' }));
    const db = env.authenticatedContext('u1').firestore();
    await assertSucceeds(getDoc(doc(db, 'packs/us-home')));
    await assertFails(setDoc(doc(db, 'packs/us-home'), { version: '2' }));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'packs/us-home')));
  });
  it('everything else is closed', async () => {
    const db = env.authenticatedContext('u1').firestore();
    await assertFails(setDoc(doc(db, 'users/u1'), { a: 1 }));
    await assertFails(getDoc(doc(db, 'users/u1')));
  });
});
