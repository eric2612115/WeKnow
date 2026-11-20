// The search engine inside each shard: MiniSearch (MIT, zero dependencies, ~6 KB gzipped), BM25+ ranking.
// The builder creates and serialises each shard's index; the device loads it with MiniSearch.loadJSON,
// so the phone never tokenises or stems the pack itself. Both sides call `indexOptions` with the same
// pipeline, which is what keeps a serialised index readable.

import MiniSearch, { type AsPlainObject, type Options, type SearchOptions } from 'minisearch';
import type { TextPipeline } from './text.ts';

/** Pinned with the exact dependency version in web/package.json; packs record it in their root. */
export const SEARCH_ENGINE = 'minisearch@7.2.0';

export interface IndexDoc {
  ref: string;
  name: string;
  aliases: string[];
  b?: number;
  p?: Array<[string, string, number]>;
  s?: string;
}

export function indexOptions(pipe: TextPipeline): Options<IndexDoc> {
  return {
    idField: 'ref',
    fields: ['name', 'aliases'],
    storeFields: ['name', 'b', 'p', 's'],
    tokenize: (text) => pipe.tokenize(text),
    processTerm: (term) => pipe.processTerm(term),
    // MiniSearch reads stored fields through this too, so only the indexed alias list is joined into text.
    extractField: (doc, field) => {
      const v = (doc as unknown as Record<string, unknown>)[field];
      return field === 'aliases' && Array.isArray(v) ? v.join(' ') : (v as string);
    },
    autoVacuum: false,
  };
}

/** Words this long also match longer words that start with them ("refrig" -> refrigerator). */
export const PREFIX_MIN = 4;
/** Words this long tolerate one typo in five letters ("thermsotat"). */
export const FUZZY_MIN = 6;

/** How a query is ranked. Names count double; synonym-only terms count 0.6; prefix and typo matches as above. */
export function searchOptions(added: ReadonlySet<string>): SearchOptions {
  return {
    boost: { name: 2 },
    boostTerm: (term) => (added.has(term) ? 0.6 : 1),
    // Terms are stemmed before they are compared, and a stem is short: "altenrator" becomes "altenr", two edits
    // from "altern". So the edits allowed are counted, not a share of the length: two from six letters, one at five.
    fuzzy: (term) => (term.length >= FUZZY_MIN ? 2 : term.length >= FUZZY_MIN - 1 ? 1 : false),
    prefix: (term) => term.length >= PREFIX_MIN,
    combineWith: 'OR',
  };
}

export function createIndex(pipe: TextPipeline, docs: IndexDoc[] = []): MiniSearch<IndexDoc> {
  const ms = new MiniSearch<IndexDoc>(indexOptions(pipe));
  ms.addAll(docs);
  return ms;
}

/** Load a shard index that the builder serialised with `toJSON()` (already parsed from the shard file). */
export function loadIndex(pipe: TextPipeline, js: unknown): MiniSearch<IndexDoc> {
  const plain = js as AsPlainObject;
  if (!plain || typeof plain !== 'object' || typeof plain.serializationVersion !== 'number') {
    throw new Error('not a serialised search index');
  }
  return MiniSearch.loadJS<IndexDoc>(plain, indexOptions(pipe));
}

export { MiniSearch };
