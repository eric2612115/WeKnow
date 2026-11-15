// The pack builder: turns sourced prices and guides into the layered files described in packFormat.ts.
// Pure (no file system): scripts/build-pack.mjs does the reading and writing, the tests call it directly.
// Nothing ships unless every item has an https source, every ref is unique and every pro ref resolves.

import { bloomCreate } from './bloom.ts';
import {
  byteLength,
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
import type { PackSpec } from './packSpecs.ts';
import type { Guide, PriceItem } from './packs.ts';
import { createIndex, SEARCH_ENGINE, type IndexDoc } from './searchIndex.ts';
import { textPipeline } from './text.ts';

export interface BuildLimits {
  maxDocsPerShard: number; // a category with more items is split into several shards
  maxBlockBytes: number; // level-3 blocks are packed up to this many bytes of JSON
  bloomFpRate: number;
}

export const DEFAULT_LIMITS: BuildLimits = { maxDocsPerShard: 400, maxBlockBytes: 16 * 1024, bloomFpRate: 0.01 };

export class PackValidationError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`the pack has ${problems.length} problem(s):\n- ${problems.slice(0, 40).join('\n- ')}`);
    this.name = 'PackValidationError';
    this.problems = problems;
  }
}

const REF = /^[a-z0-9][a-z0-9-]{0,79}$/;
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

function sourceProblems(where: string, sources: unknown): string[] {
  if (!Array.isArray(sources) || sources.length === 0) return [`${where}: has no source`];
  const out: string[] = [];
  sources.forEach((s, i) => {
    const url = (s as { url?: unknown } | null)?.url;
    let ok = false;
    try {
      ok = typeof url === 'string' && new URL(url).protocol === 'https:';
    } catch {
      ok = false;
    }
    if (!ok) out.push(`${where}: source ${i + 1} needs an https url`);
  });
  return out;
}

/** Every reason this pack cannot ship. Empty means it can. */
export function validatePack(spec: PackSpec, prices: PriceItem[], guides: Guide[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const cats = new Set(spec.categories);
  const priceRefs = new Set(prices.map((p) => p.ref));
  const common = (x: PriceItem | Guide, kind: ItemKind) => {
    const where = `${kind} ${String(x.ref)}`;
    if (typeof x.ref !== 'string' || !REF.test(x.ref)) problems.push(`${where}: ref must be lowercase letters, digits and dashes`);
    else if (x.ref.startsWith('learned-')) problems.push(`${where}: "learned-" refs are reserved for cloud lookups`);
    if (seen.has(x.ref)) problems.push(`${where}: duplicate ref`);
    seen.add(x.ref);
    if (!x.category || !cats.has(x.category)) problems.push(`${where}: category ${String(x.category)} is not in pack ${spec.id}`);
    if (!isText(x.name)) problems.push(`${where}: no name`);
    if (!Array.isArray(x.aliases) || !x.aliases.every((a) => typeof a === 'string')) problems.push(`${where}: aliases must be text`);
    problems.push(...sourceProblems(where, x.sources));
  };
  for (const p of prices) {
    common(p, 'price');
    if (!isText(p.unit)) problems.push(`price ${p.ref}: no unit`);
    if (![p.low, p.typical, p.high].every(isPositive)) problems.push(`price ${p.ref}: low, typical and high must be positive numbers`);
    else if (!(p.low <= p.typical && p.typical <= p.high)) problems.push(`price ${p.ref}: needs low <= typical <= high`);
  }
  for (const g of guides) {
    common(g, 'guide');
    // A "leave it to a pro" guide may have no steps, but then it must say when to stop or what is unsafe.
    const lists = [g.steps, g.safety ?? [], g.stopIf ?? []];
    if (!lists.every((l) => Array.isArray(l) && l.every(isText))) problems.push(`guide ${g.ref}: steps, safety and stopIf must be text`);
    else if (!lists.some((l) => l.length)) problems.push(`guide ${g.ref}: needs steps, or safety and stop-if advice`);
    const m = g.minutes;
    if (!Array.isArray(m) || m.length !== 2 || !m.every((n) => typeof n === 'number' && n >= 0) || m[0] > m[1]) {
      problems.push(`guide ${g.ref}: minutes must be [low, high]`);
    }
    for (const r of g.proRefs ?? []) if (!priceRefs.has(r)) problems.push(`guide ${g.ref}: pro ref ${r} is not a price in this pack`);
  }
  return problems;
}

export interface BuiltPack {
  /** Path (relative to the packs directory) -> file contents. */
  files: Map<string, string>;
  root: PackRoot;
  entry: CatalogEntry;
}

interface Planned {
  id: string;
  category: string;
  kind: ItemKind;
  items: Array<PriceItem | Guide>;
  blocks: Array<Array<PriceItem | Guide>>;
}

const named = async (dir: string, stem: string, body: string) => `${dir}${stem}.${(await sha256Hex(body)).slice(0, HASH_HEX)}.json`;

export async function buildLayeredPack(
  spec: PackSpec,
  prices: PriceItem[],
  guides: Guide[],
  limits: BuildLimits = DEFAULT_LIMITS,
): Promise<BuiltPack> {
  const problems = validatePack(spec, prices, guides);
  if (problems.length) throw new PackValidationError(problems);
  const pipe = textPipeline(spec.lexicon);
  const byRef = (a: { ref: string }, b: { ref: string }) => (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0);

  // Plan shards: one per category and kind, split when large; blocks packed by size in ref order,
  // so a change to one item rewrites one block and leaves every other file byte-identical.
  const planned: Planned[] = [];
  for (const category of spec.categories) {
    for (const kind of ['price', 'guide'] as const) {
      const items = (kind === 'price' ? prices : guides).filter((x) => x.category === category).sort(byRef);
      if (!items.length) continue;
      const parts = Math.ceil(items.length / limits.maxDocsPerShard);
      for (let part = 0; part < parts; part++) {
        const slice = items.slice(part * limits.maxDocsPerShard, (part + 1) * limits.maxDocsPerShard);
        const blocks: Array<Array<PriceItem | Guide>> = [[]];
        let size = 0;
        for (const it of slice) {
          const n = byteLength(JSON.stringify(it)) + 1;
          if (size + n > limits.maxBlockBytes && blocks[blocks.length - 1].length) {
            blocks.push([]);
            size = 0;
          }
          blocks[blocks.length - 1].push(it);
          size += n;
        }
        planned.push({ id: parts > 1 ? `${category}.${kind}.${part + 1}` : `${category}.${kind}`, category, kind, items: slice, blocks });
      }
    }
  }

  const loc = new Map<string, [string, number]>();
  for (const s of planned) s.blocks.forEach((b, i) => b.forEach((it) => loc.set(it.ref, [s.id, i])));

  const files = new Map<string, string>();
  const dir = `${spec.id}/`;
  const shards: ShardMeta[] = [];
  let serializationVersion = 0;
  for (const s of planned) {
    const blockMetas = [];
    for (const [i, block] of s.blocks.entries()) {
      const file: BlockFile = {
        schema: PACK_SCHEMA,
        shard: s.id,
        block: i,
        prices: s.kind === 'price' ? (block as PriceItem[]) : [],
        guides: s.kind === 'guide' ? (block as Guide[]) : [],
      };
      const body = JSON.stringify(file);
      const path = await named('d/', `${s.id}.${i}`, body);
      files.set(dir + path, body);
      blockMetas.push({ file: path, bytes: byteLength(body), count: block.length });
    }
    const docs: IndexDoc[] = s.items.map((it) => {
      const doc: IndexDoc = { ref: it.ref, name: it.name, aliases: it.aliases, b: loc.get(it.ref)![1] };
      const pro = s.kind === 'guide' ? ((it as Guide).proRefs ?? []) : [];
      if (pro.length) doc.p = pro.map((r): ProLocation => [r, ...loc.get(r)!]);
      return doc;
    });
    const index = createIndex(pipe, docs).toJSON();
    serializationVersion = index.serializationVersion;
    const shardFile: ShardFile = { schema: PACK_SCHEMA, shard: s.id, kind: s.kind, index };
    const body = JSON.stringify(shardFile);
    const path = await named('s/', s.id, body);
    files.set(dir + path, body);
    const words = new Set<string>();
    for (const d of docs) {
      for (const t of pipe.terms(`${d.name} ${d.aliases.join(' ')}`)) words.add(t);
      words.add(`ref:${d.ref}`);
    }
    shards.push({
      id: s.id,
      category: s.category,
      kind: s.kind,
      count: s.items.length,
      file: path,
      bytes: byteLength(body),
      bloom: bloomCreate(words, limits.bloomFpRate),
      blocks: blockMetas,
    });
  }

  const dataAsOf = [...prices, ...guides]
    .flatMap((x) => x.sources.map((s) => s.fetched ?? ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d))
    .sort()
    .pop()
    ?.slice(0, 10) ?? '';
  const draft: PackRoot = {
    schema: PACK_SCHEMA,
    id: spec.id,
    version: '',
    dataAsOf,
    region: spec.region,
    language: spec.language,
    currency: spec.currency,
    origin: spec.origin,
    engine: { search: SEARCH_ENGINE, serializationVersion },
    text: spec.lexicon,
    counts: { prices: prices.length, guides: guides.length },
    categories: spec.categories
      .map((id) => ({
        id,
        prices: prices.filter((p) => p.category === id).length,
        guides: guides.filter((g) => g.category === id).length,
      }))
      .filter((c) => c.prices + c.guides > 0),
    shards,
  };
  const root: PackRoot = { ...draft, version: `${dataAsOf}.${(await sha256Hex(JSON.stringify(draft))).slice(0, 8)}` };
  const rootBody = JSON.stringify(root);
  const rootPath = await named('', 'root', rootBody);
  files.set(dir + rootPath, rootBody);

  let bytes = 0;
  for (const body of files.values()) bytes += byteLength(body);
  const entry: CatalogEntry = {
    id: spec.id,
    region: spec.region,
    language: spec.language,
    currency: spec.currency,
    version: root.version,
    dataAsOf,
    root: dir + rootPath,
    bytes,
    counts: { prices: prices.length, guides: guides.length, shards: shards.length, blocks: shards.reduce((n, s) => n + s.blocks.length, 0) },
  };
  return { files, root, entry };
}

export function catalogJson(entries: CatalogEntry[]): string {
  const catalog: Catalog = { schema: PACK_SCHEMA, packs: [...entries].sort((a, b) => a.id.localeCompare(b.id)) };
  return JSON.stringify(catalog, null, 1) + '\n';
}
