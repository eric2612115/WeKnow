// Build WeKnow's knowledge pack from Fair Quote's US price book and DIY guides plus packs-src/*.json
// (hand-researched prices and guides, each source with a fetched quote).
// Usage: node scripts/build-pack.mjs [fair-quote data dir]   (default: ../fair-quote/product/backend/data)
// Writes:
//   web/public/packs/catalog.json         level 0: which packs exist and each one's current root
//   web/public/packs/us-home/...          levels 1-3 (see web/src/core/packFormat.ts and docs/knowledge-layer.md)
//   web/public/packs/us-home.json         the same items as one file, kept for the current app shell and eval
// Refuses to write anything if an item has no https source, a ref repeats, or a guide points at a missing price.
// The builder logic is plain TypeScript in web/src/core (Node runs it with built-in type stripping).

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildLayeredPack, catalogJson, PackValidationError } from '../web/src/core/packBuild.ts';
import { US_HOME } from '../web/src/core/packSpecs.ts';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const data = process.argv[2] ?? join(root, '../fair-quote/product/backend/data');
if (!existsSync(join(data, 'pricebook/us'))) throw new Error(`no Fair Quote price book under ${data}`);

const spec = US_HOME;
const en = (v) => (typeof v === 'string' ? v : v?.en ?? '');
const latin = (a) => /^[\x20-\x7e]+$/.test(a);
const source = (s) => ({ url: s.url, title: s.title, quote: s.quote, fetched: s.fetched_at });

const prices = [];
const guides = [];
for (const cat of spec.categories) {
  const book = JSON.parse(readFileSync(join(data, 'pricebook/us', `${cat}.json`), 'utf8'));
  for (const it of book.items) {
    prices.push({
      ref: it.key,
      category: cat,
      name: en(it.name),
      aliases: (it.aliases ?? []).filter(latin),
      unit: it.unit,
      low: it.low,
      typical: it.typical,
      high: it.high,
      includes: en(it.includes) || undefined,
      sources: (it.sources ?? []).map(source),
    });
  }
  const diyFile = join(data, 'diy/us', `${cat}.json`);
  if (!existsSync(diyFile)) continue;
  for (const g of JSON.parse(readFileSync(diyFile, 'utf8')).guides) {
    guides.push({
      ref: `diy-${g.key}`,
      category: cat,
      name: en(g.name),
      aliases: (g.aliases ?? []).filter(latin),
      minutes: g.minutes,
      difficulty: g.difficulty,
      steps: (g.steps ?? []).map(en),
      safety: (g.safety ?? []).map(en),
      stopIf: (g.stop_if ?? []).map(en),
      proRefs: g.pro_refs ?? [],
      sources: (g.sources ?? []).map(source),
    });
  }
}

// Hand-researched items that Fair Quote did not have, each backed by a fetched quote. Every packs-src/*.json is read
// and may hold "prices" and "guides". A price gets the same shape as a Fair Quote price (known fields only, in the
// same order); a source may say `fetched` or Fair Quote's `fetched_at`. Problems name the file they came from, and
// buildLayeredPack then checks the whole pack (unique refs, https sources, low <= typical <= high, categories).
const fairQuoteRefs = new Set(prices.map((p) => p.ref));
const handRefs = new Map(); // ref -> file that defined it
const srcProblems = [];
const handSource = (s) => ({ url: s?.url, title: s?.title, quote: s?.quote, fetched: s?.fetched ?? s?.fetched_at });
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
for (const f of readdirSync(join(root, 'packs-src')).filter((f) => f.endsWith('.json')).sort()) {
  const extra = JSON.parse(readFileSync(join(root, 'packs-src', f), 'utf8'));
  for (const p of extra.prices ?? []) {
    const where = `packs-src/${f}: price ${String(p?.ref)}`;
    if (fairQuoteRefs.has(p?.ref)) srcProblems.push(`${where}: ref already used by a Fair Quote price`);
    else if (handRefs.has(p?.ref)) srcProblems.push(`${where}: ref already used in packs-src/${handRefs.get(p.ref)}`);
    handRefs.set(p?.ref, f);
    const sources = Array.isArray(p?.sources) ? p.sources.map(handSource) : [];
    sources.forEach((s, i) => {
      for (const field of ['title', 'quote', 'fetched']) if (!isText(s[field])) srcProblems.push(`${where}: source ${i + 1} has no ${field}`);
    });
    prices.push({
      ref: p?.ref,
      category: p?.category,
      name: p?.name,
      aliases: p?.aliases ?? [],
      unit: p?.unit,
      low: p?.low,
      typical: p?.typical,
      high: p?.high,
      includes: p?.includes || undefined,
      sources,
    });
  }
  for (const g of extra.guides ?? []) guides.push({ ...g, aliases: g.aliases ?? [], proRefs: g.proRefs ?? [] });
}
if (srcProblems.length) {
  console.error(`packs-src has ${srcProblems.length} problem(s):\n- ${srcProblems.join('\n- ')}`);
  process.exit(1);
}

let built;
try {
  built = await buildLayeredPack(spec, prices, guides);
} catch (e) {
  if (e instanceof PackValidationError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}

const packsDir = join(root, 'web/public/packs');
mkdirSync(packsDir, { recursive: true });

// The single-file pack (legacy shape), now versioned by its data date so rebuilding unchanged data changes nothing.
const single = { id: spec.id, version: built.root.dataAsOf, region: spec.region, currency: spec.currency, origin: spec.origin, prices, guides };
writeFileSync(join(packsDir, `${spec.id}.json`), JSON.stringify(single, null, 1) + '\n');

rmSync(join(packsDir, spec.id), { recursive: true, force: true });
for (const [path, body] of built.files) {
  mkdirSync(dirname(join(packsDir, path)), { recursive: true });
  writeFileSync(join(packsDir, path), body);
}
writeFileSync(join(packsDir, 'catalog.json'), catalogJson([built.entry]));

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const level = (re) => [...built.files].filter(([p]) => re.test(p));
const sum = (files) => files.reduce((n, [, b]) => n + Buffer.byteLength(b), 0);
const gz = (files) => files.reduce((n, [, b]) => n + gzipSync(b).length, 0);
const rows = [
  ['1 root (index + map)', level(/\/root\./)],
  ['2 shards (index + map)', level(/\/s\//)],
  ['3 data blocks', level(/\/d\//)],
];
console.log(`pack ${spec.id} ${built.root.version}: ${prices.length} prices, ${guides.length} guides, ${built.root.shards.length} shards`);
for (const [name, files] of rows) console.log(`  level ${name.padEnd(24)} ${String(files.length).padStart(3)} files  ${kb(sum(files)).padStart(9)}  gzip ${kb(gz(files))}`);
console.log(`  wrote ${packsDir}/catalog.json, ${spec.id}/, ${spec.id}.json`);
