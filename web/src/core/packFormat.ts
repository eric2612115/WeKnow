// The on-disk format of a layered knowledge pack. One catalog, then three levels per pack:
//
//   catalog.json                      level 0: which packs exist (region, language), and each one's current root
//   <pack>/root.<hash>.json           level 1: the pack's top index (one Bloom filter per shard: which words
//                                     live where) and top map (shards, their blocks, sizes and hashes)
//   <pack>/s/<shard>.<hash>.json      level 2: one shard's search index (MiniSearch BM25+, built at pack time)
//                                     and its map (ref -> name, and which data block holds the full item)
//   <pack>/d/<shard>.<n>.<hash>.json  level 3: the data itself: prices, guides, steps and their sources
//
// Every file below the catalog is named by the first 16 hex digits of the SHA-256 of its bytes, so it never
// changes once published: browsers and CDNs may keep it forever, and a new pack version downloads only the
// files whose hash changed. Only the catalog is revalidated.

import type { BloomData } from './bloom.ts';
import type { Lexicon } from './text.ts';
import type { Guide, PriceItem, Source } from './packs.ts';

export const PACK_SCHEMA = 1;
export const HASH_HEX = 16;

export type ItemKind = 'price' | 'guide';

export interface CatalogEntry {
  id: string;
  region: string;
  language: string;
  currency: string;
  version: string;
  dataAsOf: string; // the newest "fetched" date among the pack's sources
  root: string; // path relative to the catalog
  bytes: number; // all files of this pack version
  counts: { prices: number; guides: number; shards: number; blocks: number };
}

export interface Catalog {
  schema: number;
  packs: CatalogEntry[];
}

export interface BlockMeta {
  file: string; // relative to the pack directory
  bytes: number;
  count: number;
}

export interface ShardMeta {
  id: string; // e.g. "plumbing.price", or "device.price.2" when a large category is split
  category: string;
  kind: ItemKind;
  count: number;
  file: string;
  bytes: number;
  bloom: BloomData; // every index term of the shard, plus "ref:<ref>" for every item it holds
  blocks: BlockMeta[];
}

export interface PackRoot {
  schema: number;
  id: string;
  version: string;
  dataAsOf: string;
  region: string;
  language: string;
  currency: string;
  origin: string;
  engine: { search: string; serializationVersion: number };
  text: Lexicon;
  counts: { prices: number; guides: number };
  categories: Array<{ id: string; prices: number; guides: number }>;
  shards: ShardMeta[];
}

/** A pro price location stored with a guide: [ref, shard id, block index]. */
export type ProLocation = [string, string, number];

/** What the shard's index stores for each item (the level-2 map). */
export interface ShardStored {
  name: string;
  b: number; // block index within the shard
  p?: ProLocation[]; // guides only: where their pro prices live
}

export interface ShardFile {
  schema: number;
  shard: string;
  kind: ItemKind;
  index: unknown; // MiniSearch#toJSON()
}

export interface BlockFile {
  schema: number;
  shard: string;
  block: number;
  prices: PriceItem[];
  guides: Guide[];
}

/** SHA-256 of a text as lowercase hex (Web Crypto: the same call in browsers, Node and tests). */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** The hash a file name promises, e.g. "s/plumbing.price.0123456789abcdef.json" -> "0123456789abcdef". */
export function hashInName(path: string): string | undefined {
  return new RegExp(`\\.([0-9a-f]{${HASH_HEX}})\\.json$`).exec(path)?.[1];
}

export const byteLength = (text: string) => new TextEncoder().encode(text).length;

export type { Guide, PriceItem, Source };
