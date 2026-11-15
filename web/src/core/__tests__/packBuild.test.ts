// The pack builder: nothing unsourced ships, refs are unique and resolvable, output is reproducible,
// per-file hashes pin down exactly which category changed, and every level stays inside its size budget.

import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildLayeredPack, catalogJson, DEFAULT_LIMITS, PackValidationError, validatePack } from '../packBuild';
import type { Guide, PriceItem } from '../packs';
import { US_HOME } from '../packSpecs';
import { open, server, servedBuild, shippedFiles, shippedPack } from './fixtures';

const pack = shippedPack();

const word = fc.constantFrom('pipe', 'valve', 'roof', 'gutter', 'fan', 'heater', 'lock', 'door', 'tile', 'pump', 'filter', 'drain');
const price = (ref: string, category: string, name: string): PriceItem => ({
  ref,
  category,
  name,
  aliases: [],
  unit: 'job',
  low: 100,
  typical: 150,
  high: 200,
  sources: [{ url: 'https://example.org/cost-guide', fetched: '2026-11-01' }],
});
const guide = (ref: string, category: string, name: string, proRefs: string[]): Guide => ({
  ref,
  category,
  name,
  aliases: [],
  minutes: [10, 30],
  steps: ['Turn off the water.', 'Do the fix.'],
  proRefs,
  sources: [{ url: 'https://example.org/how-to', fetched: '2026-11-01' }],
});

/** A small random but valid pack: unique refs, sourced items, guides pointing at real prices. */
const smallPack = fc
  .uniqueArray(fc.tuple(fc.constantFrom(...US_HOME.categories), word, word), { minLength: 2, maxLength: 40, selector: ([c, a, b]) => `${c}-${a}-${b}` })
  .map((rows) => {
    const prices = rows.map(([c, a, b]) => price(`${c}-${a}-${b}`, c, `Repair the ${a} ${b}`));
    const guides = rows.slice(0, Math.ceil(rows.length / 3)).map(([c, a, b]) => guide(`diy-${c}-${a}-${b}`, c, `Check the ${a} ${b} yourself`, [`${c}-${a}-${b}`]));
    return { prices, guides };
  });

describe('the builder refuses packs that could show an unsourced number', () => {
  const ok = { prices: [price('a-fix', 'plumbing', 'Fix a'), price('b-fix', 'home', 'Fix b')], guides: [guide('diy-a', 'plumbing', 'Do a', ['a-fix'])] };

  it('a valid pack has no problems', () => {
    expect(validatePack(US_HOME, ok.prices, ok.guides)).toEqual([]);
  });

  const breakers: Array<[string, (p: PriceItem[], g: Guide[]) => void, RegExp]> = [
    ['an item with no source', (p) => (p[0].sources = []), /a-fix: has no source/],
    ['a source without https', (p) => (p[0].sources = [{ url: 'http://example.org' }]), /a-fix: source 1 needs an https url/],
    ['a guide with no source', (_, g) => (g[0].sources = []), /diy-a: has no source/],
    ['a duplicate ref', (p) => (p[1].ref = 'a-fix'), /duplicate ref/],
    ['a price and a guide sharing a ref', (_, g) => (g[0].ref = 'a-fix'), /duplicate ref/],
    ['a pro ref that is not a price', (_, g) => (g[0].proRefs = ['nope']), /pro ref nope/],
    ['a range out of order', (p) => (p[0].low = 300), /low <= typical <= high/],
    ['a category outside the pack', (p) => (p[0].category = 'rockets'), /category rockets/],
    ['a reserved learned- ref', (p) => (p[0].ref = 'learned-x'), /reserved/],
  ];
  for (const [what, breakIt, message] of breakers) {
    it(`rejects ${what}`, async () => {
      const prices = structuredClone(ok.prices);
      const guides = structuredClone(ok.guides);
      breakIt(prices, guides);
      expect(validatePack(US_HOME, prices, guides).join('\n')).toMatch(message);
      await expect(buildLayeredPack(US_HOME, prices, guides)).rejects.toBeInstanceOf(PackValidationError);
    });
  }

  it('any item stripped of its sources stops the build (property)', async () => {
    await fc.assert(
      fc.asyncProperty(smallPack, fc.nat(), async ({ prices, guides }, n) => {
        const all = [...prices, ...guides];
        all[n % all.length].sources = [];
        await expect(buildLayeredPack(US_HOME, prices, guides)).rejects.toThrow(/has no source/);
      }),
      { numRuns: 50 },
    );
  });
});

describe('what the builder writes', () => {
  it('random valid packs build, and every ref resolves to the item that went in (property)', async () => {
    await fc.assert(
      fc.asyncProperty(smallPack, async ({ prices, guides }) => {
        const { files } = await servedBuild(prices, guides, US_HOME, { ...DEFAULT_LIMITS, maxDocsPerShard: 3, maxBlockBytes: 600 });
        const kb = await open(server(files));
        for (const it of [...prices, ...guides]) {
          const slice = await kb.resolve([it.ref]);
          expect([...slice.prices, ...slice.guides].find((x) => x.ref === it.ref)).toEqual(it);
        }
      }),
      { numRuns: 30 },
    );
  });

  it('the same input always gives the same bytes', async () => {
    const a = await buildLayeredPack(US_HOME, pack.prices, pack.guides);
    const b = await buildLayeredPack(US_HOME, structuredClone(pack.prices), structuredClone(pack.guides));
    expect([...b.files]).toEqual([...a.files]);
  });

  it('a change to one item changes only its own category files and the root (property)', async () => {
    const base = await buildLayeredPack(US_HOME, pack.prices, pack.guides);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pack.prices), fc.constantFrom('price', 'alias'), async (target, change) => {
        const prices = pack.prices.map((p) =>
          p.ref !== target.ref ? p : change === 'price' ? { ...p, high: p.high + 1 } : { ...p, aliases: [...p.aliases, 'zebra crossing'] },
        );
        const next = await buildLayeredPack(US_HOME, prices, pack.guides);
        const changed = [...next.files.keys()].filter((f) => !base.files.has(f));
        expect(changed.some((f) => f.includes('/root.'))).toBe(true);
        const others = changed.filter((f) => !f.includes('/root.'));
        expect(others.length).toBeGreaterThan(0);
        // Only files of the edited category's price shard; a price edit leaves the shard index untouched.
        expect(others.every((f) => f.includes(`/${target.category}.price.`))).toBe(true);
        if (change === 'price') expect(others.every((f) => f.includes('/d/'))).toBe(true);
      }),
      { numRuns: 25 },
    );
  });

  it('the shipped pack files are exactly what the builder makes from the shipped items', async () => {
    const built = await buildLayeredPack(US_HOME, pack.prices, pack.guides);
    const shipped = shippedFiles();
    for (const [path, body] of built.files) expect(shipped.get(`/packs/${path}`), path).toBe(body);
    const layered = [...shipped.keys()].filter((u) => u.startsWith('/packs/us-home/'));
    expect(layered.length).toBe(built.files.size);
    expect(shipped.get('/packs/catalog.json')).toBe(catalogJson([built.entry]));
  });
});

describe('size budgets', () => {
  it('the root fits in one small first download; shards and blocks stay small', async () => {
    const built = await buildLayeredPack(US_HOME, pack.prices, pack.guides);
    const gz = (s: string) => gzipSync(s).length;
    const root = [...built.files].find(([p]) => p.includes('/root.'))![1];
    expect(gz(root)).toBeLessThanOrEqual(16 * 1024); // the PMTiles rule: the root fits in the first 16 KiB
    for (const [path, body] of built.files) {
      if (path.includes('/s/')) expect(gz(body), path).toBeLessThanOrEqual(64 * 1024);
      if (path.includes('/d/')) {
        const file = JSON.parse(body) as { prices: unknown[]; guides: unknown[] };
        const count = file.prices.length + file.guides.length;
        if (count > 1) expect(body.length, path).toBeLessThanOrEqual(DEFAULT_LIMITS.maxBlockBytes + 200);
      }
    }
  });

  it('a large category is split into several shards, each with its own Bloom filter', async () => {
    const many = Array.from({ length: 30 }, (_, i) => price(`plumbing-item-${i}`, 'plumbing', `Plumbing job number ${i}`));
    const built = await buildLayeredPack(US_HOME, many, [], { ...DEFAULT_LIMITS, maxDocsPerShard: 10 });
    expect(built.root.shards.map((s) => s.id)).toEqual(['plumbing.price.1', 'plumbing.price.2', 'plumbing.price.3']);
  });
});
