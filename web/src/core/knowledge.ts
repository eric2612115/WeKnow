// The knowledge layer on the device. A question walks the levels and loads only what it needs:
//   open       -> catalog (level 0) + pack root (level 1): which shards hold which words
//   candidates -> the few level-2 shards the root's Bloom filters point at; BM25+ inside each.
//                 A word no shard knows exactly may be a typo or a partial word, so then every shard of
//                 that kind is searched with typo and prefix matching (as one whole-pack index would)
//   resolve    -> the level-3 blocks that hold the items finally chosen, with their sources
// Every file is checked against the hash in its name whenever it is read, from the network or the device.
// Network and storage are injected, so the same code runs in the browser (fetch + Cache Storage),
// in Node scripts (files) and in tests (an in-memory map). No UI, no Firebase.

import { bloomOpen, type Bloom } from './bloom.ts';
import { LEXICON_EN } from './lexicon.ts';
import {
  byteLength,
  hashInName,
  HASH_HEX,
  PACK_SCHEMA,
  sha256Hex,
  type BlockFile,
  type Catalog,
  type CatalogEntry,
  type ItemKind,
  type PackRoot,
  type ProLocation,
  type ShardFile,
  type ShardMeta,
} from './packFormat.ts';
import type { Guide, Pack, PriceItem } from './packs.ts';
import { createIndex, loadIndex, PREFIX_MIN, searchOptions, SEARCH_ENGINE, type IndexDoc, type MiniSearch } from './searchIndex.ts';
import { asText, textPipeline, type Expansion, type Lexicon, type TextPipeline } from './text.ts';

export interface Candidate {
  ref: string;
  name: string;
  score: number;
  kind: ItemKind;
  shard: string; // "learned" for items added on this device or from the shared learned list
  learned?: boolean;
  /** A learned price whose name or alias is this very line (the same line seen again). */
  sameLine?: boolean;
}

/** One line of the whole pack index: what an item is called and what kind it is, without its data. */
export interface IndexEntry {
  ref: string;
  name: string;
  kind: ItemKind;
}

export interface CandidateQuery {
  kind: ItemKind;
  k?: number;
}

export interface LoadRecord {
  path: string;
  level: 0 | 1 | 2 | 3;
  bytes: number;
  from: 'network' | 'cache';
}

export interface KnowledgeStats {
  files: LoadRecord[];
  shards: string[];
  blocks: string[];
  unavailable: string[];
  learned: number;
  /** Queries that searched every shard of their kind because a word was not known exactly. */
  widened: number;
  /** Device copies that failed their hash check and were thrown away. */
  rejectedCopies: number;
}

export interface LearnOptions {
  /** Keep it on this device across sessions (default true). Shared learned items come from the database instead. */
  persist?: boolean;
}

/** What the reader needs from a knowledge pack, whatever its storage. */
export interface Knowledge {
  readonly id: string;
  readonly version: string;
  readonly region: string;
  readonly currency: string;
  candidates(text: string, query: CandidateQuery): Promise<Candidate[]>;
  /** A small Pack holding only these refs (and the pro prices their guides point to). Unknown refs are skipped. */
  resolve(refs: Iterable<string>): Promise<Pack>;
  /** Add a price found by a cloud lookup. Refused unless every source is https. */
  learn(item: PriceItem, options?: LearnOptions): Promise<void>;
  stats(): KnowledgeStats;
  /** Every item's ref, name and kind (the whole pack index). */
  index?(): Promise<IndexEntry[]>;
}

// ---------- shared ranking ----------

export const DEFAULT_K = 5;
const MAX_K = 20;

/** k from a query, whatever the caller passed: a whole number from 1 to 20, default 5. */
const clampK = (k: unknown) => (typeof k === 'number' && Number.isFinite(k) ? Math.min(MAX_K, Math.max(1, Math.floor(k))) : DEFAULT_K);
const isKind = (k: unknown): k is ItemKind => k === 'price' || k === 'guide';
/** Refs from a caller, whatever it passed: strings only, no duplicates. */
function refList(refs: unknown): string[] {
  if (refs === null || refs === undefined || typeof (refs as Iterable<unknown>)[Symbol.iterator] !== 'function') return [];
  return [...new Set([...(refs as Iterable<unknown>)].filter((r): r is string => typeof r === 'string' && r.length > 0))];
}
/** Candidates scoring below this share of the best one are not offered (fewer tokens, less noise). */
export const MIN_RELATIVE_SCORE = 0.2;
/** At most this many level-2 shards per query. */
export const MAX_SHARDS_PER_QUERY = 3;

/** Learned prices offered per question at most; they cover lines the pack did not know. */
export const MAX_LEARNED = 2;
/** A learned price is offered when it matches at least this share of the printed words. */
export const MIN_LEARNED_COVERAGE = 0.5;

/**
 * Best first, without duplicates. A learned price comes first only when it is this very line seen again (its name
 * or an alias is the line's words): it was looked up for exactly that. Any other learned price goes after the
 * pack's own, sourced results, so a price from the web never pushes a pack price aside. (The learned index is tiny,
 * so its BM25 scores cannot be compared with a shard's; word coverage and this rule place it instead.)
 */
function rank(results: Candidate[], k: number, learned: Candidate[] = []): Candidate[] {
  const byScore = (a: Candidate, b: Candidate) => b.score - a.score || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);
  results.sort(byScore);
  const offered = [...learned].sort(byScore).slice(0, Math.min(MAX_LEARNED, k));
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of offered.filter((x) => x.sameLine)) {
    seen.add(r.ref);
    out.push(r);
  }
  const floor = (results[0]?.score ?? 0) * MIN_RELATIVE_SCORE;
  for (const r of results) {
    if (out.length >= k) break;
    if (r.score < floor || seen.has(r.ref)) continue;
    seen.add(r.ref);
    out.push(r);
  }
  for (const r of offered) {
    if (out.length >= k) break;
    if (seen.has(r.ref)) continue;
    seen.add(r.ref);
    out.push(r);
  }
  return out;
}

export class LearnRefusedError extends Error {}

/** The rule from packs.ts `learn`, applied to the layered store: every learned price needs https sources. */
export function assertLearnable(item: PriceItem): void {
  const ok =
    item &&
    typeof item.ref === 'string' &&
    item.ref.startsWith('learned-') &&
    typeof item.name === 'string' &&
    Array.isArray(item.sources) &&
    item.sources.length > 0 &&
    item.sources.every((s) => typeof s?.url === 'string' && /^https:\/\//.test(s.url)) &&
    [item.low, item.typical, item.high].every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0) &&
    item.low <= item.typical &&
    item.typical <= item.high;
  if (!ok) throw new LearnRefusedError(`refused to learn ${String(item?.ref)}: needs a learned- ref, an ordered range and https sources`);
}

class Overlay {
  readonly items = new Map<string, PriceItem>();
  index: MiniSearch<IndexDoc>;
  private pipe: TextPipeline;
  constructor(pipe: TextPipeline) {
    this.pipe = pipe;
    this.index = createIndex(pipe);
  }
  add(item: PriceItem) {
    if (this.items.has(item.ref)) this.index.discard(item.ref);
    this.items.set(item.ref, item);
    this.index.add({ ref: item.ref, name: item.name, aliases: item.aliases ?? [] });
  }
  rebuild(pipe: TextPipeline) {
    const items = [...this.items.values()];
    this.items.clear();
    this.pipe = pipe;
    this.index = createIndex(pipe);
    for (const it of items) this.add(it);
  }
  search(q: Expansion, kind: ItemKind): Candidate[] {
    if (kind !== 'price' || !this.items.size) return [];
    const printed = q.terms.filter((t) => !q.added.has(t));
    if (!printed.length) return [];
    // The same words, whatever their order: "Brake fluid exchange" is the line a price was learned for.
    const words = (terms: string[]) => [...new Set(terms)].sort().join(' ');
    const line = words(printed);
    const same = (ref: string) => {
      const item = this.items.get(ref);
      return !!item && [item.name, ...(item.aliases ?? [])].some((n) => words(this.pipe.terms(n)) === line);
    };
    return this.index
      .search(q.text, searchOptions(q.added))
      .filter((r) => r.queryTerms.filter((t) => printed.includes(t)).length / printed.length >= MIN_LEARNED_COVERAGE)
      .map((r) => ({ ref: r.id, name: r.name as string, score: r.score, kind, shard: 'learned', learned: true, sameLine: same(r.id as string) }));
  }
}

// ---------- the layered store ----------

/** The part of a fetch Response the store uses, so window.fetch fits as is. */
export interface FetchedFile {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}
/** `reload` asks to bypass any HTTP cache (the browser adapter maps it to `cache: 'reload'`). */
export type Fetcher = (url: string, init?: { reload?: boolean }) => Promise<FetchedFile>;

/** Where downloaded pack files are kept on the device (Cache Storage in the browser). */
export interface PackCache {
  get(key: string): Promise<string | undefined>;
  put(key: string, body: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export function memoryCache(): PackCache & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    get: async (k) => map.get(k),
    put: async (k, v) => void map.set(k, v),
    delete: async (k) => void map.delete(k),
    keys: async () => [...map.keys()],
  };
}

export interface OpenOptions {
  /** URL prefix of the packs directory, e.g. "/packs". */
  base: string;
  packId: string;
  fetch: Fetcher;
  cache?: PackCache;
  /** Pin a root path (Remote Config `pack_root`), e.g. for a rollback; otherwise the catalog decides. */
  root?: string;
  maxShards?: number;
}

export class KnowledgeUnavailableError extends Error {}
export class IncompatiblePackError extends Error {}

type FileProblem = 'offline' | 'missing' | 'mismatch' | 'unreadable' | 'unhashed';

class FileError extends Error {
  readonly problem: FileProblem;
  constructor(path: string, problem: FileProblem) {
    super(`${path}: ${problem}`);
    this.problem = problem;
  }
}

/** Learned prices kept on a device at most. */
export const MAX_LEARNED_KEPT = 200;
/** A learned price whose newest source was fetched more than a year ago is no longer used. */
function staleLearned(item: PriceItem, now = new Date()): boolean {
  const newest = item.sources.map((s) => s.fetched).filter((d): d is string => !!d).sort().pop();
  if (!newest) return false;
  const year = new Date(now);
  year.setFullYear(year.getFullYear() - 1);
  return newest < year.toISOString().slice(0, 10);
}

const learnedKey = (base: string, packId: string) => `${base}/${packId}/learned.json`;

/**
 * The newest catalog from the network, else the copy on the device. A catalog from the network is not written to
 * the device here: refresh() keeps it only once its root has loaded, so a catalog whose root never arrived cannot
 * replace the one that works offline.
 */
async function readCatalog(o: OpenOptions): Promise<{ catalog: Catalog; from: 'network' | 'cache'; bytes: number; body?: string }> {
  const url = `${o.base}/catalog.json`;
  const parse = (body: string) => {
    const c = JSON.parse(body) as Catalog;
    if (c?.schema !== PACK_SCHEMA || !Array.isArray(c.packs)) throw new Error('not a pack catalog');
    return c;
  };
  try {
    const res = await o.fetch(url);
    if (res.ok) {
      const body = await res.text();
      const catalog = parse(body); // a hosting fallback page is not a catalog
      return { catalog, from: 'network', bytes: byteLength(body), body };
    }
  } catch {
    /* offline: fall back to the copy on the device */
  }
  const cached = await o.cache?.get(url).catch(() => undefined);
  if (cached === undefined) throw new KnowledgeUnavailableError('the knowledge pack has not been downloaded yet and the device is offline');
  return { catalog: parse(cached), from: 'cache', bytes: byteLength(cached) };
}

export class LayeredKnowledge implements Knowledge {
  private o: OpenOptions;
  private rootPath = '';
  private rootData!: PackRoot;
  private pipe!: TextPipeline;
  private blooms = new Map<string, Bloom>();
  private shards = new Map<string, Promise<MiniSearch<IndexDoc> | undefined>>();
  private kindIndexes = new Map<ItemKind, Promise<MiniSearch<IndexDoc> | undefined>>();
  private blocks = new Map<string, Promise<BlockFile | undefined>>();
  private overlay!: Overlay;
  private records: LoadRecord[] = [];
  private unavailable = new Set<string>();
  private staleSeen = false;
  private widened = 0;
  private rejectedCopies = 0;
  private entries: Promise<IndexEntry[]> | undefined;

  constructor(options: OpenOptions) {
    this.o = options;
  }

  get root(): PackRoot {
    return this.rootData;
  }
  get id() {
    return this.rootData.id;
  }
  get version() {
    return this.rootData.version;
  }
  get region() {
    return this.rootData.region;
  }
  get currency() {
    return this.rootData.currency;
  }

  /** Read the catalog and adopt the newest root. Returns true when the pack version changed. */
  async refresh(): Promise<boolean> {
    const read = await readCatalog(this.o);
    this.records.push({ path: 'catalog.json', level: 0, bytes: read.bytes, from: read.from });
    const url = `${this.o.base}/catalog.json`;
    try {
      const changed = await this.adopt(read.catalog);
      if (read.body !== undefined) await this.o.cache?.put(url, read.body).catch(() => undefined);
      return changed;
    } catch (e) {
      // The new catalog's root could not be loaded (a dropped connection): keep working from the version on the device.
      if (read.from !== 'network' || e instanceof IncompatiblePackError) throw e;
      const kept = await this.o.cache?.get(url).catch(() => undefined);
      if (kept === undefined) throw e;
      let old: Catalog;
      try {
        old = JSON.parse(kept) as Catalog;
      } catch {
        throw e;
      }
      return this.adopt(old);
    }
  }

  /** Adopt the root a catalog names (or the pinned one). Returns true when the pack version changed. */
  private async adopt(catalog: Catalog): Promise<boolean> {
    const entry: CatalogEntry | undefined = catalog.packs.find((p) => p.id === this.o.packId);
    if (!entry) throw new KnowledgeUnavailableError(`no pack ${this.o.packId} in the catalog`);
    // A pinned root (Remote Config) wins while its files are served; if it is gone, follow the catalog.
    // Only content-hashed root names are accepted, so a pinned root is verified like every other file.
    const pinned = this.o.root && hashInName(this.o.root) ? this.o.root : undefined;
    let path = pinned ?? entry.root;
    let root: PackRoot | undefined;
    for (const candidate of [...new Set([path, entry.root])]) {
      if (candidate === this.rootPath) return false;
      try {
        root = await this.file<PackRoot>(candidate, 1);
        path = candidate;
        break;
      } catch (e) {
        if (candidate === entry.root) throw new KnowledgeUnavailableError(`pack root ${candidate} is not available (${(e as Error).message})`);
      }
    }
    if (!root) throw new KnowledgeUnavailableError('no pack root is available');
    if (root.schema !== PACK_SCHEMA) throw new IncompatiblePackError(`pack schema ${root.schema} needs another app version`);
    if (root.engine.search !== SEARCH_ENGINE) throw new IncompatiblePackError(`pack built for ${root.engine.search}, this app has ${SEARCH_ENGINE}`);
    const first = !this.rootPath;
    this.rootPath = path;
    this.rootData = root;
    this.pipe = textPipeline(root.text);
    this.blooms = new Map(root.shards.map((s) => [s.id, bloomOpen(s.bloom)]));
    this.shards.clear();
    this.kindIndexes.clear();
    this.blocks.clear();
    this.unavailable.clear();
    this.entries = undefined;
    if (first) this.overlay = new Overlay(this.pipe);
    else this.overlay.rebuild(this.pipe);
    return !first;
  }

  /** Restore the prices this device learned earlier. */
  async restoreLearned(): Promise<void> {
    const body = await this.o.cache?.get(learnedKey(this.o.base, this.o.packId)).catch(() => undefined);
    if (!body) return;
    try {
      for (const item of JSON.parse(body) as PriceItem[]) {
        try {
          if (staleLearned(item)) continue; // a price looked up more than a year ago is looked up again
          assertLearnable(item);
          this.overlay.add(item);
        } catch {
          /* a stored item that no longer passes the rule is dropped */
        }
      }
    } catch {
      /* unreadable: ignore */
    }
  }

  private async file<T>(path: string, level: LoadRecord['level']): Promise<T> {
    const url = `${this.o.base}/${path.startsWith(`${this.o.packId}/`) ? path : `${this.o.packId}/${path}`}`;
    const expect = hashInName(path);
    if (!expect) throw new FileError(path, 'unhashed');
    const matches = async (body: string) => (await sha256Hex(body)).slice(0, HASH_HEX) === expect;

    // The device copy is checked on every read: an edited or damaged copy is thrown away, never used.
    const cached = await this.o.cache?.get(url).catch(() => undefined);
    if (cached !== undefined) {
      if (await matches(cached)) {
        this.records.push({ path, level, bytes: byteLength(cached), from: 'cache' });
        return JSON.parse(cached) as T;
      }
      this.rejectedCopies++;
      await this.o.cache?.delete(url).catch(() => undefined);
    }

    // From the network; a 404 or a body that does not match its name is asked for once more past any HTTP
    // cache (a hosting fallback page or a stale cached response must not stick).
    let body: string | undefined;
    let problem: FileProblem = 'offline';
    for (const reload of [false, true]) {
      let res: FetchedFile;
      try {
        res = await this.o.fetch(url, reload ? { reload: true } : undefined);
      } catch {
        problem = 'offline';
        break;
      }
      if (!res.ok) {
        problem = res.status === 404 ? 'missing' : 'offline';
        if (res.status !== 404) break;
        continue;
      }
      const text = await res.text().catch(() => '');
      if (await matches(text)) {
        body = text;
        break;
      }
      problem = 'mismatch';
    }
    if (body === undefined) throw new FileError(path, problem);
    let parsed: T;
    try {
      parsed = JSON.parse(body) as T;
    } catch {
      throw new FileError(path, 'unreadable');
    }
    await this.o.cache?.put(url, body).catch(() => undefined);
    this.records.push({ path, level, bytes: byteLength(body), from: 'network' });
    return parsed;
  }

  private note(path: string, e: unknown) {
    this.unavailable.add(path);
    if (e instanceof FileError && (e.problem === 'missing' || e.problem === 'mismatch')) this.staleSeen = true;
  }

  /** The whole-kind fallback index, or undefined when the pack has none or it is not available. */
  private kindIndex(kind: ItemKind): Promise<MiniSearch<IndexDoc> | undefined> {
    const meta = this.rootData.kinds?.find((k) => k.kind === kind);
    if (!meta) return Promise.resolve(undefined);
    let p = this.kindIndexes.get(kind);
    if (!p) {
      p = this.file<ShardFile>(meta.file, 2).then(
        (f) => loadIndex(this.pipe, f.index),
        (e) => {
          this.note(meta.file, e);
          this.kindIndexes.delete(kind);
          return undefined;
        },
      );
      this.kindIndexes.set(kind, p);
    }
    return p;
  }

  private shard(meta: ShardMeta): Promise<MiniSearch<IndexDoc> | undefined> {
    let p = this.shards.get(meta.id);
    if (!p) {
      p = this.file<ShardFile>(meta.file, 2).then(
        (f) => loadIndex(this.pipe, f.index),
        (e) => {
          this.note(meta.file, e);
          this.shards.delete(meta.id);
          return undefined;
        },
      );
      this.shards.set(meta.id, p);
    }
    return p;
  }

  private block(meta: ShardMeta, i: number): Promise<BlockFile | undefined> {
    const b = meta.blocks[i];
    if (!b) return Promise.resolve(undefined);
    let p = this.blocks.get(b.file);
    if (!p) {
      p = this.file<BlockFile>(b.file, 3).catch((e) => {
        this.note(b.file, e);
        this.blocks.delete(b.file);
        return undefined;
      });
      this.blocks.set(b.file, p);
    }
    return p;
  }

  /**
   * Level 1: which shards of a kind could hold these terms, best first. `ambiguous` means more shards scored
   * close to the best than a query may load (a question made only of common words like "replace").
   */
  plan(terms: string[], kind: ItemKind | 'any', added: ReadonlySet<string> = new Set()): { shards: ShardMeta[]; ambiguous: boolean } {
    const shards = this.rootData.shards.filter((s) => kind === 'any' || s.kind === kind);
    const hits = shards.map((s) => ({ s, ts: terms.filter((t) => this.blooms.get(s.id)!.has(t)) }));
    const cf = new Map<string, number>();
    for (const h of hits) for (const t of h.ts) cf.set(t, (cf.get(t) ?? 0) + 1);
    const scored = hits
      .map((h) => ({ s: h.s, score: h.ts.reduce((a, t) => a + Math.log(1 + shards.length / cf.get(t)!) * (added.has(t) ? 0.6 : 1), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || (a.s.id < b.s.id ? -1 : 1));
    if (!scored.length) return { shards: [], ambiguous: false };
    const close = scored.filter((x) => x.score >= scored[0].score * 0.5);
    const max = this.o.maxShards ?? MAX_SHARDS_PER_QUERY;
    return { shards: close.slice(0, max).map((x) => x.s), ambiguous: close.length > max };
  }

  route(terms: string[], kind: ItemKind | 'any', added: ReadonlySet<string> = new Set()): ShardMeta[] {
    return this.plan(terms, kind, added).shards;
  }

  async candidates(text: string, query: CandidateQuery): Promise<Candidate[]> {
    const kind = query?.kind;
    if (!isKind(kind)) return [];
    const k = clampK(query.k);
    const q = this.pipe.expand(asText(text));
    if (!q.terms.length) return [];
    const pool = this.rootData.shards.filter((s) => s.kind === kind);
    const opts = searchOptions(q.added);
    const results: Candidate[] = [];
    const matched = new Set<string>();
    const searchIn = async (shards: ShardMeta[]) => {
      const indexes = await Promise.all(shards.map((s) => this.shard(s)));
      shards.forEach((s, i) => {
        for (const r of indexes[i]?.search(q.text, opts) ?? []) {
          for (const t of r.queryTerms) matched.add(t);
          results.push({ ref: r.id, name: r.name as string, score: r.score, kind: s.kind, shard: s.id });
        }
      });
      return indexes.every((x) => !!x);
    };

    // 1. The shards the root's filters point at, when they narrow the question down to a few.
    // 2. Otherwise, or when a printed word of PREFIX_MIN letters or more matched nothing in those shards (a typo,
    //    the start of a longer word, or a filter's "maybe"), the whole-kind index built at pack time: one index
    //    over every item of the kind, so the ranking is the same as a whole-pack index.
    const plan = this.plan(q.terms, kind, q.added);
    const hasWhole = !!this.rootData.kinds?.some((x) => x.kind === kind);
    const searched = new Set<ShardMeta>();
    let useWhole = plan.ambiguous && hasWhole;
    if (!useWhole) {
      plan.shards.forEach((s) => searched.add(s));
      if (!(await searchIn(plan.shards)) && (await this.recover())) return this.candidates(text, query);
      const missed = plan.ambiguous || q.terms.some((t) => t.length >= PREFIX_MIN && !q.added.has(t) && !matched.has(t));
      if (missed) useWhole = true;
    }
    if (useWhole) {
      this.widened++;
      const whole = hasWhole ? await this.kindIndex(kind) : undefined;
      if (whole) {
        results.length = 0;
        for (const r of whole.search(q.text, opts)) {
          results.push({ ref: r.id, name: r.name as string, score: r.score, kind, shard: (r.s as string) ?? `${kind}.all` });
        }
      } else {
        // No whole-kind index (an older pack, or offline before it was downloaded): search every shard there is.
        const rest = pool.filter((s) => !searched.has(s));
        if (!(await searchIn(rest)) && (await this.recover())) return this.candidates(text, query);
      }
    }
    return rank(results, k, this.overlay.search(q, kind));
  }

  /** After a missing or mismatched file, re-read the catalog once: a newer pack may have replaced this one. */
  private async recover(): Promise<boolean> {
    if (!this.staleSeen) return false;
    this.staleSeen = false;
    try {
      return await this.refresh();
    } catch {
      return false;
    }
  }

  private async locate(ref: string): Promise<{ meta: ShardMeta; b: number; p?: ProLocation[] } | undefined> {
    // A whole-kind index already in memory knows every item of its kind and the shard that holds it.
    for (const p of this.kindIndexes.values()) {
      const ms = await p;
      const stored = ms?.has(ref) ? (ms.getStoredFields(ref) as { b: number; p?: ProLocation[]; s?: string }) : undefined;
      const meta = stored && this.rootData.shards.find((s) => s.id === stored.s);
      if (stored && meta) return { meta, b: stored.b, p: stored.p };
    }
    const known = this.rootData.shards.filter((s) => this.shards.has(s.id));
    const routed = this.rootData.shards.filter((s) => !this.shards.has(s.id) && this.blooms.get(s.id)!.has(`ref:${ref}`));
    for (const meta of [...known, ...routed]) {
      const ms = await this.shard(meta);
      const stored = ms?.has(ref) ? (ms.getStoredFields(ref) as { b: number; p?: ProLocation[] }) : undefined;
      if (stored) return { meta, b: stored.b, p: stored.p };
    }
    return undefined;
  }

  async resolve(refs: Iterable<string>): Promise<Pack> {
    const prices: PriceItem[] = [];
    const guides: Guide[] = [];
    const wanted = refList(refs);
    const found = new Set<string>();
    const pro: ProLocation[] = [];
    const take = async (meta: ShardMeta, b: number, ref: string) => {
      const block = await this.block(meta, b);
      const item = block?.prices.find((x) => x.ref === ref) ?? block?.guides.find((x) => x.ref === ref);
      if (!item || found.has(ref)) return;
      found.add(ref);
      if (meta.kind === 'price') prices.push(item as PriceItem);
      else guides.push(item as Guide);
    };
    await Promise.all(
      wanted.map(async (ref) => {
        const learned = this.overlay.items.get(ref);
        if (learned) {
          found.add(ref);
          prices.push(learned);
          return;
        }
        const at = await this.locate(ref);
        if (!at) return;
        if (at.p) pro.push(...at.p);
        await take(at.meta, at.b, ref);
      }),
    );
    // Guides bring the pro prices they point to; their locations are stored with the guide, so no search.
    await Promise.all(
      pro.map(async ([ref, shardId, b]) => {
        const meta = this.rootData.shards.find((s) => s.id === shardId);
        if (meta && !found.has(ref)) await take(meta, b, ref);
      }),
    );
    if (wanted.some((r) => !found.has(r)) && (await this.recover())) return this.resolve(wanted);
    const order = (a: { ref: string }, b: { ref: string }) => wanted.indexOf(a.ref) - wanted.indexOf(b.ref);
    return {
      id: this.rootData.id,
      version: this.rootData.version,
      region: this.rootData.region,
      currency: this.rootData.currency,
      prices: prices.sort(order),
      guides: guides.sort(order),
    };
  }

  async learn(item: PriceItem, options: LearnOptions = {}): Promise<void> {
    assertLearnable(item);
    this.overlay.add({ ...item, category: 'learned' });
    if (options.persist === false || !this.o.cache) return;
    const key = learnedKey(this.o.base, this.o.packId);
    const mine = await this.o.cache.get(key).catch(() => undefined);
    const list = (mine ? (JSON.parse(mine) as PriceItem[]) : []).filter((x) => x.ref !== item.ref && !staleLearned(x));
    list.push({ ...item, category: 'learned' });
    // The newest are kept; the list on the device never grows without end.
    await this.o.cache.put(key, JSON.stringify(list.slice(-MAX_LEARNED_KEPT)));
  }

  /**
   * The whole pack index: every item's ref, name and kind, read from the whole-kind indexes (or every shard in packs
   * without them), plus the prices learned on this device. Names only: the data blocks are not loaded.
   */
  async index(): Promise<IndexEntry[]> {
    this.entries ??= (async () => {
      const files = this.rootData.kinds?.length
        ? this.rootData.kinds.map((k) => ({ kind: k.kind, file: k.file }))
        : this.rootData.shards.map((s) => ({ kind: s.kind, file: s.file }));
      const loaded = await Promise.all(
        files.map(async (x) => ({
          kind: x.kind,
          f: await this.file<ShardFile>(x.file, 2).catch((e) => {
            this.note(x.file, e);
            return undefined;
          }),
        })),
      );
      const out: IndexEntry[] = [];
      const seen = new Set<string>();
      for (const { kind, f } of loaded) {
        const ix = f?.index as { documentIds?: Record<string, unknown>; storedFields?: Record<string, { name?: unknown }> } | undefined;
        for (const [id, ref] of Object.entries(ix?.documentIds ?? {})) {
          const name = ix?.storedFields?.[id]?.name;
          if (typeof ref !== 'string' || typeof name !== 'string' || seen.has(ref)) continue;
          seen.add(ref);
          out.push({ ref, name, kind });
        }
      }
      if (!out.length) this.entries = undefined; // nothing could be read: try again next time
      return out;
    })();
    const base = await this.entries;
    const learned = [...this.overlay.items.values()].filter((i) => !base.some((b) => b.ref === i.ref)).map((i) => ({ ref: i.ref, name: i.name, kind: 'price' as const }));
    return [...base, ...learned];
  }

  /** Download every shard and fallback index (level 2) and, with `data`, every block (level 3): "keep it all offline". */
  async prefetch(data = false): Promise<number> {
    const before = this.bytesLoaded('network');
    await Promise.all([...this.rootData.shards.map((s) => this.shard(s)), ...(this.rootData.kinds ?? []).map((k) => this.kindIndex(k.kind))]);
    if (data) await Promise.all(this.rootData.shards.flatMap((s) => s.blocks.map((_, i) => this.block(s, i))));
    return this.bytesLoaded('network') - before;
  }

  /**
   * Tidy up after a new version. First the new copy of every file this device held an older copy of is downloaded
   * (only the files that changed), so whatever worked offline before still does. Then old copies are deleted: one
   * that has a new copy on the device, or one the current version no longer has at all. An old copy whose new one
   * could not be fetched yet stays until it can. Returns how many were removed.
   */
  async gc(): Promise<number> {
    if (!this.o.cache) return 0;
    const dir = `${this.o.base}/${this.o.packId}/`;
    const keep = new Set([`${dir}${this.rootPath.replace(`${this.o.packId}/`, '')}`, learnedKey(this.o.base, this.o.packId)]);
    // A file's name without its content hash ("plumbing.price.0"), and how to load the current copy of it.
    const stem = (file: string) => file.replace(new RegExp(`\\.[0-9a-f]{${HASH_HEX}}\\.json$`), '');
    const current = new Map<string, { key: string; load: () => Promise<unknown> }>();
    for (const s of this.rootData.shards) {
      keep.add(dir + s.file);
      current.set(stem(s.file), { key: dir + s.file, load: () => this.shard(s) });
      s.blocks.forEach((b, i) => {
        keep.add(dir + b.file);
        current.set(stem(b.file), { key: dir + b.file, load: () => this.block(s, i) });
      });
    }
    for (const k of this.rootData.kinds ?? []) {
      keep.add(dir + k.file);
      current.set(stem(k.file), { key: dir + k.file, load: () => this.kindIndex(k.kind) });
    }
    const old = (await this.o.cache.keys()).filter((key) => key.startsWith(dir) && !keep.has(key));
    let have = new Set(await this.o.cache.keys());
    const wanted = [...new Set(old.map((key) => current.get(stem(key.slice(dir.length)))).filter((c): c is NonNullable<typeof c> => !!c && !have.has(c.key)))];
    await Promise.all(wanted.map((c) => c.load().catch(() => undefined)));
    have = new Set(await this.o.cache.keys());
    let n = 0;
    for (const key of old) {
      const now = current.get(stem(key.slice(dir.length)));
      if (now && !have.has(now.key)) continue; // its new copy is not here yet
      await this.o.cache.delete(key);
      n++;
    }
    return n;
  }

  bytesLoaded(from?: 'network' | 'cache', level?: LoadRecord['level']): number {
    return this.records.filter((r) => (!from || r.from === from) && (level === undefined || r.level === level)).reduce((n, r) => n + r.bytes, 0);
  }

  stats(): KnowledgeStats {
    return {
      files: [...this.records],
      shards: [
        ...this.rootData.shards.filter((s) => this.shards.has(s.id)).map((s) => s.id),
        ...[...this.kindIndexes.keys()].map((k) => `${k}.all`),
      ],
      blocks: [...this.blocks.keys()],
      unavailable: [...this.unavailable],
      learned: this.overlay.items.size,
      widened: this.widened,
      rejectedCopies: this.rejectedCopies,
    };
  }
}

/** Open a layered pack: reads the catalog and the root only. */
export async function openLayeredKnowledge(options: OpenOptions): Promise<LayeredKnowledge> {
  const kb = new LayeredKnowledge(options);
  await kb.refresh();
  await kb.restoreLearned();
  return kb;
}

// ---------- a whole pack already in memory (the legacy single-file pack, small tests) ----------

class MemoryKnowledge implements Knowledge {
  readonly id: string;
  readonly version: string;
  readonly region: string;
  readonly currency: string;
  private pack: Pack;
  private pipe: TextPipeline;
  private indexes: Record<ItemKind, MiniSearch<IndexDoc>>;
  private overlay: Overlay;

  constructor(pack: Pack, lexicon: Lexicon) {
    this.pack = pack;
    this.id = pack.id;
    this.version = pack.version;
    this.region = pack.region;
    this.currency = pack.currency;
    this.pipe = textPipeline(lexicon);
    const docs = (xs: Array<PriceItem | Guide>) => xs.map((x) => ({ ref: x.ref, name: x.name, aliases: x.aliases ?? [] }));
    this.indexes = { price: createIndex(this.pipe, docs(pack.prices)), guide: createIndex(this.pipe, docs(pack.guides)) };
    this.overlay = new Overlay(this.pipe);
  }

  async candidates(text: string, query: CandidateQuery): Promise<Candidate[]> {
    const kind = query?.kind;
    if (!isKind(kind)) return [];
    const q = this.pipe.expand(asText(text));
    if (!q.terms.length) return [];
    const results: Candidate[] = [];
    for (const r of this.indexes[kind].search(q.text, searchOptions(q.added))) {
      results.push({ ref: r.id, name: r.name as string, score: r.score, kind, shard: 'all' });
    }
    return rank(results, clampK(query.k), this.overlay.search(q, kind));
  }

  async resolve(refs: Iterable<string>): Promise<Pack> {
    const want = refList(refs);
    const guides = want.map((r) => this.pack.guides.find((g) => g.ref === r)).filter((g): g is Guide => !!g);
    const pro = new Set(guides.flatMap((g) => g.proRefs ?? []));
    const prices = [
      ...want.map((r) => this.overlay.items.get(r) ?? this.pack.prices.find((p) => p.ref === r)),
      ...this.pack.prices.filter((p) => pro.has(p.ref) && !want.includes(p.ref)),
    ].filter((p): p is PriceItem => !!p);
    return { id: this.id, version: this.version, region: this.region, currency: this.currency, prices, guides };
  }

  async learn(item: PriceItem): Promise<void> {
    assertLearnable(item);
    this.overlay.add({ ...item, category: 'learned' });
  }

  async index(): Promise<IndexEntry[]> {
    return [
      ...this.pack.guides.map((g) => ({ ref: g.ref, name: g.name, kind: 'guide' as const })),
      ...this.pack.prices.map((p) => ({ ref: p.ref, name: p.name, kind: 'price' as const })),
      ...[...this.overlay.items.values()].map((p) => ({ ref: p.ref, name: p.name, kind: 'price' as const })),
    ];
  }

  stats(): KnowledgeStats {
    return { files: [], shards: ['all'], blocks: [], unavailable: [], learned: this.overlay.items.size, widened: 0, rejectedCopies: 0 };
  }
}

const memo = new WeakMap<Pack, Knowledge>();

/** The same ranking over a pack that is already fully in memory. */
export function knowledgeFromPack(pack: Pack, lexicon: Lexicon = LEXICON_EN): Knowledge {
  let k = memo.get(pack);
  if (!k) {
    k = new MemoryKnowledge(pack, lexicon);
    memo.set(pack, k);
  }
  return k;
}

export function isKnowledge(x: Pack | Knowledge): x is Knowledge {
  return typeof (x as Knowledge).candidates === 'function';
}
