// Publish reviewed learned prices to Firestore, where every app reads them as an overlay on the static pack.
// A learned price is one a cloud lookup found for a line the pack did not know. A maintainer reviews it
// (sources open, range sensible, nothing personal), then publishes it here; the next pack build should
// absorb it into packs-src/ and remove it from this list.
//
// It writes ONE document, packs/{packId}, fields `learned` (the list) and `learnedUpdated`, so each app
// session costs one read and works offline from Firestore's cache. Clients cannot write it (firestore.rules).
//
// Usage:
//   node scripts/seed-learned.mjs learned.json                      dry run (default): validate and print
//   node scripts/seed-learned.mjs learned.json --emulator 127.0.0.1:8080
//   FIRESTORE_TOKEN=$(gcloud auth print-access-token) node scripts/seed-learned.mjs learned.json --live [--project weknow-6092f]
// learned.json is a JSON array of PriceItem objects with "learned-" refs and https sources.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertLearnable } from '../web/src/core/knowledge.ts';
import { findPII } from '../web/src/core/pii.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? true) : undefined;
};
const input = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
if (!input) {
  console.error('usage: node scripts/seed-learned.mjs <learned.json> [--pack us-home] [--emulator host:port | --live [--project id]]');
  process.exit(2);
}
const packId = flag('--pack') ?? 'us-home';
const emulator = flag('--emulator');
const live = args.includes('--live');
const project = flag('--project') ?? JSON.parse(readFileSync(join(root, '.firebaserc'), 'utf8')).projects.default;

// ---- validate ----
const items = JSON.parse(readFileSync(input, 'utf8'));
if (!Array.isArray(items)) throw new Error('learned.json must be a JSON array of price items');
const pack = JSON.parse(readFileSync(join(root, `web/public/packs/${packId}.json`), 'utf8'));
const packRefs = new Set([...pack.prices, ...pack.guides].map((x) => x.ref));
const problems = [];
const seen = new Set();
for (const it of items) {
  try {
    assertLearnable(it);
  } catch (e) {
    problems.push(e.message);
  }
  if (packRefs.has(it.ref)) problems.push(`${it.ref}: already in pack ${packId}`);
  if (seen.has(it.ref)) problems.push(`${it.ref}: listed twice`);
  seen.add(it.ref);
  const text = [it.name, ...(it.aliases ?? [])].join(' | ');
  if (findPII(text).length) problems.push(`${it.ref}: name or aliases look like personal data`);
}
if (problems.length) {
  console.error(`refused, ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

// ---- Firestore REST encoding ----
const value = (v) => {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, value(x)])) } };
};
const learned = items.map((it) => ({ ...it, category: 'learned' }));
const body = { fields: { learned: value(learned), learnedUpdated: value(new Date().toISOString()) } };
const path = `projects/${project}/databases/(default)/documents/packs/${packId}`;
const mask = 'updateMask.fieldPaths=learned&updateMask.fieldPaths=learnedUpdated';

if (!emulator && !live) {
  console.log(`dry run: would write ${learned.length} learned price(s) to ${path}`);
  for (const it of learned) console.log(`  ${it.ref}: ${it.name} ${it.low}-${it.high} (${it.sources.length} source(s))`);
  console.log('pass --emulator host:port to write to a local emulator, or --live with FIRESTORE_TOKEN to publish.');
  process.exit(0);
}

const url = emulator ? `http://${emulator}/v1/${path}?${mask}` : `https://firestore.googleapis.com/v1/${path}?${mask}`;
const token = emulator ? 'owner' : process.env.FIRESTORE_TOKEN;
if (!token) throw new Error('set FIRESTORE_TOKEN (gcloud auth print-access-token) to write to the live project');
const res = await fetch(url, {
  method: 'PATCH',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});
if (!res.ok) throw new Error(`Firestore said ${res.status}: ${await res.text()}`);
console.log(`wrote ${learned.length} learned price(s) to ${emulator ? 'the emulator' : project}: ${path}`);
