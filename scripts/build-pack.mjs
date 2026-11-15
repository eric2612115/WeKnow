// Build WeKnow's first knowledge pack from Fair Quote's US price book and DIY guides.
// Usage: node scripts/build-pack.mjs <fair-quote data dir>
// Output: web/public/packs/us-home.json. Every price and every guide keeps its sources.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const data = process.argv[2];
if (!data) throw new Error('pass the Fair Quote data directory');

const CATEGORIES = ['plumbing', 'appliance', 'electrical', 'home', 'device', 'cleaning', 'car-service', 'car-body', 'locksmith'];
const en = (v) => (typeof v === 'string' ? v : v?.en ?? '');
const latin = (a) => /^[\x20-\x7e]+$/.test(a);
const source = (s) => ({ url: s.url, title: s.title, quote: s.quote, fetched: s.fetched_at });

const prices = [];
const guides = [];
for (const cat of CATEGORIES) {
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
  let diy;
  try {
    diy = JSON.parse(readFileSync(join(data, 'diy/us', `${cat}.json`), 'utf8'));
  } catch {
    continue;
  }
  for (const g of diy.guides) {
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

const refs = new Set();
for (const x of [...prices, ...guides]) {
  if (refs.has(x.ref)) throw new Error(`duplicate ref ${x.ref}`);
  refs.add(x.ref);
  if (!x.sources.length) throw new Error(`${x.ref} has no source`);
}
for (const g of guides) for (const r of g.proRefs) if (!prices.some((p) => p.ref === r)) throw new Error(`${g.ref}: unknown pro ref ${r}`);

const pack = {
  id: 'us-home',
  version: new Date().toISOString().slice(0, 10),
  region: 'US',
  currency: 'USD',
  origin: 'Built from the Fair Quote price book and DIY guides (pre-existing work by the same author, disclosed in README).',
  prices,
  guides,
};
const out = join(root, 'web/public/packs/us-home.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(pack, null, 1) + '\n');
console.log(`wrote ${out}: ${prices.length} prices, ${guides.length} guides`);
