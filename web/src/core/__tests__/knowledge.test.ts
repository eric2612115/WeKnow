// The layered knowledge pack on the device: loads only the levels a question needs, still finds the right
// items, works offline from what it already has, and picks up a new pack version by downloading only changes.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { knowledgeFromPack, KnowledgeUnavailableError, LearnRefusedError, memoryCache } from '../knowledge';
import type { PriceItem } from '../packs';
import {
  handLabels,
  handQuestions,
  level,
  open,
  server,
  servedBuild,
  shippedFiles,
  shippedPack,
  truthLines,
} from './fixtures';

const files = shippedFiles();
const pack = shippedPack();
const items = [...pack.prices, ...pack.guides];
const kindOf = (ref: string) => (pack.prices.some((p) => p.ref === ref) ? 'price' : 'guide');

describe('a question loads only the levels it needs', () => {
  it('opening reads the catalog (level 0) and the pack root (level 1), nothing else', async () => {
    const s = server(files);
    const kb = await open(s);
    expect(s.log.map(level)).toEqual([0, 1]);
    expect(kb.stats().shards).toEqual([]);
  });

  it('a quote line loads a few price shards (level 2) and no data (level 3)', async () => {
    const s = server(files);
    const kb = await open(s);
    const c = await kb.candidates('Replace brake pads (one axle)', { kind: 'price' });
    expect(c[0].ref).toBe('brake-pads');
    const shards = s.log.filter((u) => level(u) === 2);
    expect(shards.length).toBeGreaterThan(0);
    expect(shards.length).toBeLessThanOrEqual(3);
    expect(shards.every((u) => u.includes('.price.'))).toBe(true);
    expect(s.log.some((u) => level(u) === 3)).toBe(false);
  });

  it('a household problem loads guide shards only', async () => {
    const s = server(files);
    const kb = await open(s);
    const c = await kb.candidates('The toilet keeps running after I flush', { kind: 'guide' });
    expect(c.map((x) => x.ref)).toContain('diy-toilet-flapper');
    expect(s.log.filter((u) => level(u) === 2).every((u) => u.includes('.guide.'))).toBe(true);
  });

  it('resolving a choice loads only the blocks holding it and the pro prices its guide points to', async () => {
    const s = server(files);
    const kb = await open(s);
    await kb.candidates('The toilet keeps running after I flush', { kind: 'guide' });
    s.log.length = 0;
    const slice = await kb.resolve(['diy-toilet-flapper']);
    expect(slice.guides.map((g) => g.ref)).toEqual(['diy-toilet-flapper']);
    expect(slice.prices.map((p) => p.ref)).toEqual(['toilet-repair']);
    expect(s.log.every((u) => level(u) === 3)).toBe(true);
    expect(s.log.length).toBeLessThanOrEqual(2);
    expect(slice.guides[0]).toEqual(pack.guides.find((g) => g.ref === 'diy-toilet-flapper'));
  });

  it('a second question in the same category downloads nothing new', async () => {
    const s = server(files);
    const kb = await open(s);
    await kb.candidates('Unclog a toilet', { kind: 'price' });
    const before = s.log.length;
    await kb.candidates('Replace a faucet', { kind: 'price' });
    expect(s.log.slice(before).filter((u) => u.includes('plumbing.price'))).toEqual([]);
  });
});

describe('every item is reachable', () => {
  it('every ref resolves from a cold start, unchanged, touching few shards', async () => {
    for (const it of items) {
      const s = server(files);
      const kb = await open(s);
      const slice = await kb.resolve([it.ref]);
      const got = [...slice.prices, ...slice.guides].find((x) => x.ref === it.ref);
      expect(got, it.ref).toEqual(it);
      expect(s.log.filter((u) => level(u) === 2).length, it.ref).toBeLessThanOrEqual(3);
    }
  });

  it('every item is in the top 5 for its own name', async () => {
    const kb = await open(server(files));
    const misses: string[] = [];
    for (const it of items) {
      const c = await kb.candidates(it.name, { kind: kindOf(it.ref) });
      if (!c.some((x) => x.ref === it.ref)) misses.push(it.ref);
    }
    expect(misses).toEqual([]);
  });

  it('an item is found by any alias that is its own (property)', async () => {
    const kb = await open(server(files));
    const owners = new Map<string, Set<string>>();
    for (const it of items) for (const a of it.aliases) owners.set(a.toLowerCase(), (owners.get(a.toLowerCase()) ?? new Set()).add(it.ref));
    const pairs = items.flatMap((it) => it.aliases.filter((a) => owners.get(a.toLowerCase())!.size === 1).map((a) => [it.ref, a] as const));
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pairs), async ([ref, alias]) => {
        const c = await kb.candidates(alias, { kind: kindOf(ref) });
        expect(c.map((x) => x.ref)).toContain(ref);
      }),
      { numRuns: 400 },
    );
  });

  it('shop noise around a printed name does not lose the item (property)', async () => {
    const kb = await open(server(files));
    const noise = fc.record({
      upper: fc.boolean(),
      prefix: fc.constantFrom('', '1. ', 'Line 3: ', '* ', '(A) '),
      suffix: fc.constantFrom('', ' - labor', ' parts & labor', ' x2', ' (1 ea)', ' incl. tax', ' $', '.'),
    });
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...pack.prices), noise, async (p, n) => {
        const label = `${n.prefix}${n.upper ? p.name.toUpperCase() : p.name}${n.suffix}`;
        const c = await kb.candidates(label, { kind: 'price' });
        expect(c.map((x) => x.ref)).toContain(p.ref);
      }),
      { numRuns: 400 },
    );
  });
});

describe('recall', () => {
  it('recall@5 on the labelled eval quotes stays 100%', async () => {
    const lines = truthLines().filter((l) => l.ref);
    expect(lines.length).toBeGreaterThan(50);
    const misses: string[] = [];
    for (const l of lines) {
      const kb = await open(server(files));
      const c = await kb.candidates(l.label, { kind: 'price' });
      if (!c.some((x) => x.ref === l.ref)) misses.push(`${l.label} -> ${l.ref}`);
    }
    expect(misses).toEqual([]);
  });

  it('hand-written shop labels and household problems are found (recall@5)', async () => {
    const kb = await open(server(files));
    const misses: string[] = [];
    for (const [set, kind] of [
      [handLabels(), 'price'],
      [handQuestions(), 'guide'],
    ] as const) {
      for (const q of set) {
        const c = await kb.candidates(q.text, { kind });
        if (!c.some((x) => q.refs.includes(x.ref))) misses.push(q.text);
      }
    }
    expect(misses).toEqual([]);
  });

  it('splitting the pack into shards ranks like one index over the whole pack', async () => {
    const kb = await open(server(files));
    const whole = knowledgeFromPack(pack);
    let same = 0;
    let n = 0;
    for (const it of items) {
      for (const q of [it.name, ...it.aliases]) {
        const kind = kindOf(it.ref);
        const [a] = await kb.candidates(q, { kind });
        const [b] = await whole.candidates(q, { kind });
        n++;
        if (a?.ref === b?.ref) same++;
      }
    }
    expect(same / n).toBeGreaterThanOrEqual(0.97);
  });
});

describe('offline', () => {
  it('after one session, the same questions work with no network at all', async () => {
    const s = server(files);
    const cache = memoryCache();
    const kb = await open(s, cache);
    const online = await kb.candidates('Unclog a sink, tub or shower drain', { kind: 'price' });
    const onlineSlice = await kb.resolve([online[0].ref]);

    s.online = false;
    const kb2 = await open(s, cache);
    expect(await kb2.candidates('Unclog a sink, tub or shower drain', { kind: 'price' })).toEqual(online);
    expect(await kb2.resolve([online[0].ref])).toEqual(onlineSlice);
    expect(kb2.stats().files.every((f) => f.from === 'cache')).toBe(true);
  });

  it('a shard that was never downloaded is reported, not fatal', async () => {
    const s = server(files);
    const cache = memoryCache();
    await open(s, cache);
    s.online = false;
    const kb = await open(s, cache);
    const c = await kb.candidates('Replace an alternator', { kind: 'price' });
    expect(c).toEqual([]);
    expect(kb.stats().unavailable.some((p) => p.includes('car-service.price'))).toBe(true);
  });

  it('with nothing on the device and no network, opening says so', async () => {
    const s = server(files);
    s.online = false;
    await expect(open(s)).rejects.toBeInstanceOf(KnowledgeUnavailableError);
  });
});

describe('integrity and versions', () => {
  it('a file whose bytes do not match its hash is refused and never cached', async () => {
    const tampered = new Map(files);
    const shardUrl = [...files.keys()].find((u) => u.includes('/s/plumbing.price.'))!;
    tampered.set(shardUrl, files.get(shardUrl)!.replace('Unclog', 'Unclug'));
    const cache = memoryCache();
    const kb = await open(server(tampered), cache);
    await kb.candidates('Unclog a toilet', { kind: 'price' });
    expect(kb.stats().unavailable).toContain(shardUrl.replace('/packs/us-home/', ''));
    expect(cache.map.has(shardUrl)).toBe(false);
  });

  it('a new version downloads only the files that changed, and old files are cleaned up', async () => {
    const v1 = await servedBuild(pack.prices, pack.guides);
    const changed = pack.prices.map((p) => (p.ref === 'toilet-unclog' ? { ...p, high: p.high + 50 } : p));
    const v2 = await servedBuild(changed, pack.guides);
    const diff = [...v2.files.keys()].filter((u) => !v1.files.has(u));
    expect(diff.map(level).sort()).toEqual([1, 3]); // the root and the one data block holding toilet-unclog

    const s = server(v1.files);
    const cache = memoryCache();
    const kb = await open(s, cache);
    await kb.prefetch(true);
    s.files = v2.files;
    s.log.length = 0;
    expect(await kb.refresh()).toBe(true);
    await kb.prefetch(true);
    expect(s.log.filter((u) => level(u) > 0).sort()).toEqual(diff.sort());
    const slice = await kb.resolve(['toilet-unclog']);
    expect(slice.prices[0].high).toBe(pack.prices.find((p) => p.ref === 'toilet-unclog')!.high + 50);
    expect(await kb.gc()).toBe(2); // the old root and the old block
  });

  it('when a deploy removed the files of the version in use, the next question switches to the new version', async () => {
    const v1 = await servedBuild(pack.prices, pack.guides);
    const changed = pack.prices.map((p) => (p.ref === 'drain-unclog' ? { ...p, aliases: [...p.aliases, 'sink snaked'] } : p));
    const v2 = await servedBuild(changed, pack.guides);
    const s = server(v1.files);
    const kb = await open(s);
    const v1Version = kb.version;
    s.files = v2.files; // the old plumbing shard is gone from the server
    const c = await kb.candidates('sink snaked', { kind: 'price' });
    expect(c[0].ref).toBe('drain-unclog');
    expect(kb.version).not.toBe(v1Version);
  });

  it('a root pinned by Remote Config wins over the catalog', async () => {
    const v1 = await servedBuild(pack.prices, pack.guides);
    const v2 = await servedBuild(
      pack.prices.map((p) => (p.ref === 'oil-change' ? { ...p, low: p.low + 1 } : p)),
      pack.guides,
    );
    const both = new Map([...v1.files, ...v2.files, ['/packs/catalog.json', v2.files.get('/packs/catalog.json')!]]);
    const pinned = v1.rootUrl.replace('/packs/', '');
    const kb = await open(server(both), memoryCache(), pinned);
    const slice = await kb.resolve(['oil-change']);
    expect(slice.prices[0].low).toBe(pack.prices.find((p) => p.ref === 'oil-change')!.low);
  });
});

describe('a pinned root that is no longer served', () => {
  it('falls back to the catalog instead of failing', async () => {
    const kb = await open(server(files), memoryCache(), 'us-home/root.0000000000000000.json');
    expect(kb.version).toBe(JSON.parse(files.get('/packs/catalog.json')!).packs[0].version);
  });
});

describe('learned prices', () => {
  const learned: PriceItem = {
    ref: 'learned-brake-fluid-flush',
    name: 'Brake fluid flush',
    aliases: ['brake fluid exchange'],
    unit: 'job',
    low: 80,
    typical: 120,
    high: 170,
    sources: [{ url: 'https://example.org/brake-fluid-cost', fetched: '2026-11-16' }],
  };

  it('are refused without an https source or a learned- ref', async () => {
    const kb = await open(server(files));
    await expect(kb.learn({ ...learned, sources: [] })).rejects.toBeInstanceOf(LearnRefusedError);
    await expect(kb.learn({ ...learned, sources: [{ url: 'http://example.org/x' }] })).rejects.toBeInstanceOf(LearnRefusedError);
    await expect(kb.learn({ ...learned, ref: 'brake-fluid-flush' })).rejects.toBeInstanceOf(LearnRefusedError);
    await expect(kb.learn({ ...learned, low: 200 })).rejects.toBeInstanceOf(LearnRefusedError);
  });

  it('join the index, resolve without the network, and stay on the device', async () => {
    const s = server(files);
    const cache = memoryCache();
    const kb = await open(s, cache);
    await kb.learn(learned);
    const c = await kb.candidates('Brake fluid exchange', { kind: 'price' });
    expect(c[0]).toMatchObject({ ref: learned.ref, learned: true });
    s.online = false;
    expect((await kb.resolve([learned.ref])).prices[0]).toMatchObject({ ref: learned.ref, sources: learned.sources });
    s.online = true;
    const kb2 = await open(s, cache);
    expect((await kb2.candidates('Brake fluid flush', { kind: 'price' }))[0].ref).toBe(learned.ref);
  });
});
