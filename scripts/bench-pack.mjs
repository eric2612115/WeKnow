// Benchmark the layered knowledge pack: bytes loaded per level and time per query, cold and warm.
// Usage: node scripts/bench-pack.mjs [--json out.json]
// Files are served from memory, so the times are the device-side cost (parse, hash check, search),
// not network time. Run `node scripts/build-pack.mjs` first.

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { memoryCache, openLayeredKnowledge } from '../web/src/core/knowledge.ts';
import { BUDGETS, chooseTokens } from '../web/src/core/budget.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const packsDir = join(root, 'web/public/packs');
const files = new Map();
const walk = (d) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else files.set(`/packs/${relative(packsDir, p)}`, readFileSync(p, 'utf8'));
  }
};
walk(packsDir);
const fetch = async (url) => {
  const body = files.get(url);
  return body === undefined ? { ok: false, status: 404, text: async () => '' } : { ok: true, status: 200, text: async () => body };
};
const json = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const truth = json('web/fixtures/eval/truth.json').filter((t) => t.kind === 'quote');
const labels = json('web/fixtures/knowledge/labels.json').labels;
const questions = json('web/fixtures/knowledge/questions.json').questions;

const open = (cache = memoryCache()) => openLayeredKnowledge({ base: '/packs', packId: 'us-home', fetch, cache });
const levelBytes = (kb) => {
  const out = [0, 0, 0, 0];
  for (const f of kb.stats().files) if (f.from === 'network') out[f.level] += f.bytes;
  return out;
};
const gzCache = new Map();
const urlOf = (path) => (path === 'catalog.json' ? '/packs/catalog.json' : path.startsWith('us-home/') ? `/packs/${path}` : `/packs/us-home/${path}`);
/** Bytes on the wire: Hosting serves JSON compressed, so count each loaded file gzipped. */
const wireBytes = (kb) =>
  kb
    .stats()
    .files.filter((f) => f.from === 'network')
    .reduce((n, f) => {
      const url = urlOf(f.path);
      if (!gzCache.has(url)) gzCache.set(url, gzipSync(files.get(url)).length);
      return n + gzCache.get(url);
    }, 0);
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))];
};
const summary = (xs) => ({ median: q(xs, 0.5), p95: q(xs, 0.95), max: Math.max(...xs) });

async function scenario(name, cases, kind) {
  const rows = [];
  for (const c of cases) {
    const t0 = performance.now();
    const kb = await open();
    const tOpen = performance.now();
    const items = [];
    for (const [i, text] of c.texts.entries()) items.push({ i, text, options: await kb.candidates(text, { kind, k: 5 }) });
    const tFind = performance.now();
    await kb.resolve(items.map((it) => it.options[0]?.ref).filter(Boolean));
    const tCold = performance.now();
    // Same questions again on the same store: everything is in memory now.
    const w0 = performance.now();
    for (const text of c.texts) await kb.candidates(text, { kind, k: 5 });
    const warm = performance.now() - w0;
    const [l0, l1, l2, l3] = levelBytes(kb);
    rows.push({
      bytes: l0 + l1 + l2 + l3,
      wire: wireBytes(kb),
      l0,
      l1,
      l2,
      l3,
      shards: kb.stats().shards.length,
      blocks: kb.stats().blocks.length,
      msOpen: tOpen - t0,
      msFind: tFind - tOpen,
      msCold: tCold - t0,
      msWarmPerLine: warm / c.texts.length,
      tokens: chooseTokens(items.filter((it) => it.options.length)),
    });
  }
  const pick = (k) => summary(rows.map((r) => r[k]));
  return { name, cases: rows.length, bytes: pick('bytes'), wire: pick('wire'), l2: pick('l2'), l3: pick('l3'), shards: pick('shards'), blocks: pick('blocks'), msCold: pick('msCold'), msWarmPerLine: pick('msWarmPerLine'), tokens: pick('tokens') };
}

const results = [
  await scenario('quote photo (eval set, all lines)', truth.map((t) => ({ texts: t.lines.map((l) => l.label) })), 'price'),
  await scenario('one shop-printed line', labels.map((l) => ({ texts: [l.text] })), 'price'),
  await scenario('household problem', questions.map((x) => ({ texts: [x.text] })), 'guide'),
];

// Whole-pack reference sizes.
const sizes = (pred) => {
  const fs = [...files].filter(([u]) => pred(u));
  return { files: fs.length, bytes: fs.reduce((n, [, b]) => n + Buffer.byteLength(b), 0), gzip: fs.reduce((n, [, b]) => n + gzipSync(b).length, 0) };
};
const whole = {
  singleFile: sizes((u) => u === '/packs/us-home.json'),
  layeredAll: sizes((u) => u.startsWith('/packs/us-home/')),
  root: sizes((u) => u.includes('/root.')),
  shards: sizes((u) => u.includes('/s/')),
  blocks: sizes((u) => u.includes('/d/')),
};

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const ms = (n) => `${n.toFixed(2)} ms`;
console.log('Whole pack on disk (raw / gzip):');
for (const [k, v] of Object.entries(whole)) console.log(`  ${k.padEnd(11)} ${String(v.files).padStart(3)} files  ${kb(v.bytes).padStart(9)} / ${kb(v.gzip)}`);
console.log('\nPer query, cold start (catalog + root + what the query needs), median / p95 / max:');
for (const r of results) {
  console.log(`  ${r.name} (${r.cases} cases)`);
  console.log(`    bytes loaded   ${kb(r.bytes.median)} / ${kb(r.bytes.p95)} / ${kb(r.bytes.max)}   (level 2: ${kb(r.l2.median)}, level 3: ${kb(r.l3.median)} median)`);
  console.log(`    gzip on wire   ${kb(r.wire.median)} / ${kb(r.wire.p95)} / ${kb(r.wire.max)}`);
  console.log(`    shards, blocks ${r.shards.median} / ${r.shards.max} shards, ${r.blocks.median} / ${r.blocks.max} blocks`);
  console.log(`    time cold      ${ms(r.msCold.median)} / ${ms(r.msCold.p95)} / ${ms(r.msCold.max)}`);
  console.log(`    time warm      ${ms(r.msWarmPerLine.median)} per line (p95 ${ms(r.msWarmPerLine.p95)})`);
  console.log(`    choose prompt  ${r.tokens.median} / ${r.tokens.max} tokens (budgets: Nano ${BUDGETS.nano.chooseInputTokens}, Apple ${BUDGETS.apple.chooseInputTokens})`);
}
const out = process.argv.indexOf('--json');
if (out > 0) writeFileSync(process.argv[out + 1], JSON.stringify({ whole, results }, null, 1) + '\n');
