// A Bloom filter: "is this word in that shard?" with no false negatives and a small, fixed size.
// The pack root keeps one per shard, so the device can tell which shards a question needs before
// downloading any of them (the same trick LSM-tree databases use to skip files that cannot hold a key).
// Kirsch–Mitzenmacher double hashing over two FNV-1a hashes; bits stored as base64.

export interface BloomData {
  m: number; // bits
  k: number; // hash functions
  bits: string; // base64
}

function fnv1a(s: string, seed: number): number {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function positions(item: string, m: number, k: number): number[] {
  const h1 = fnv1a(item, 0x811c9dc5);
  const h2 = fnv1a(item, 0x5bd1e995) | 1;
  const out: number[] = [];
  for (let i = 0; i < k; i++) out.push(((h1 + Math.imul(i, h2)) >>> 0) % m);
  return out;
}

const toBase64 = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

const fromBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Size a filter for `items` at a target false-positive rate (default 1%). */
export function bloomCreate(items: Iterable<string>, fpRate = 0.01): BloomData {
  const set = [...new Set(items)];
  const n = Math.max(1, set.length);
  const m = Math.max(64, Math.ceil((-n * Math.log(fpRate)) / Math.LN2 ** 2 / 8) * 8);
  const k = Math.max(1, Math.round((m / n) * Math.LN2));
  const bytes = new Uint8Array(m / 8);
  for (const it of set) for (const p of positions(it, m, k)) bytes[p >> 3] |= 1 << (p & 7);
  return { m, k, bits: toBase64(bytes) };
}

export interface Bloom {
  has(item: string): boolean;
}

export function bloomOpen(data: BloomData): Bloom {
  const bytes = fromBase64(data.bits);
  if (bytes.length * 8 !== data.m) throw new Error('bloom filter size does not match its bits');
  return {
    has: (item) => positions(item, data.m, data.k).every((p) => (bytes[p >> 3] & (1 << (p & 7))) !== 0),
  };
}
