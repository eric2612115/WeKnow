// Test helpers: the shipped pack files as an in-memory "server", and a fetch that logs what was asked for.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { memoryCache, openLayeredKnowledge, type Fetcher, type LayeredKnowledge, type PackCache } from '../knowledge';
import type { Guide, Pack, PriceItem } from '../packs';
import { buildLayeredPack, catalogJson, type BuildLimits } from '../packBuild';
import { US_HOME, type PackSpec } from '../packSpecs';

export const WEB = fileURLToPath(new URL('../../../', import.meta.url));
export const PACKS_DIR = join(WEB, 'public/packs');

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(WEB, path), 'utf8')) as T;

/** The single-file pack the builder wrote next to the layered one: the same items, used as ground truth. */
export const shippedPack = (): Pack => readJson<Pack>('public/packs/us-home.json');

/** Every file under web/public/packs, keyed by URL ("/packs/..."). */
export function shippedFiles(): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.set(`/packs/${relative(PACKS_DIR, p)}`, readFileSync(p, 'utf8'));
    }
  };
  walk(PACKS_DIR);
  return out;
}

/** Build a pack in memory and serve it like Hosting would: { "/packs/catalog.json": ..., "/packs/us-home/...": ... }. */
export async function servedBuild(
  prices: PriceItem[],
  guides: Guide[],
  spec: PackSpec = US_HOME,
  limits?: BuildLimits,
): Promise<{ files: Map<string, string>; rootUrl: string }> {
  const built = await buildLayeredPack(spec, prices, guides, limits);
  const files = new Map<string, string>([['/packs/catalog.json', catalogJson([built.entry])]]);
  for (const [path, body] of built.files) files.set(`/packs/${path}`, body);
  return { files, rootUrl: `/packs/${built.entry.root}` };
}

export interface Server {
  files: Map<string, string>;
  log: string[];
  online: boolean;
  fetch: Fetcher;
}

export function server(files: Map<string, string>): Server {
  const s: Server = {
    files,
    log: [],
    online: true,
    fetch: async (url) => {
      if (!s.online) throw new TypeError('Failed to fetch');
      s.log.push(url);
      const body = s.files.get(url);
      return body === undefined
        ? { ok: false, status: 404, text: async () => 'not found' }
        : { ok: true, status: 200, text: async () => body };
    },
  };
  return s;
}

export function open(s: Server, cache: PackCache = memoryCache(), root?: string): Promise<LayeredKnowledge> {
  return openLayeredKnowledge({ base: '/packs', packId: 'us-home', fetch: s.fetch, cache, root });
}

export const level = (url: string): 0 | 1 | 2 | 3 =>
  url.endsWith('/catalog.json') ? 0 : url.includes('/root.') ? 1 : url.includes('/s/') ? 2 : 3;

export interface Labelled {
  text: string;
  refs: string[];
}
export const handLabels = () => readJson<{ labels: Labelled[] }>('fixtures/knowledge/labels.json').labels;
export const handQuestions = () => readJson<{ questions: Labelled[] }>('fixtures/knowledge/questions.json').questions;

interface TruthQuote {
  kind: 'quote' | 'bill';
  lines?: Array<{ label: string; ref: string | null }>;
}
export const truthLines = () =>
  readJson<TruthQuote[]>('fixtures/eval/truth.json')
    .filter((t) => t.kind === 'quote')
    .flatMap((t) => t.lines ?? []);
export const truthQuotes = () =>
  readJson<TruthQuote[]>('fixtures/eval/truth.json')
    .filter((t) => t.kind === 'quote')
    .map((t) => t.lines ?? []);
