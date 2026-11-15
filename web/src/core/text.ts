// The text pipeline shared by the pack builder (scripts/build-pack.mjs) and the device.
// Builder and device must cut words the same way, or the router and the index stop agreeing,
// so both import this one file. Stemming comes from @orama/stemmers (Snowball/Porter ports, Apache-2.0).
// Relative imports in core files that the builder loads use explicit `.ts` extensions so Node can run them.

import { stemmer as porterEnglish } from '@orama/stemmers/english';

/** Language data for one pack: which stemmer, which words to ignore, which words mean the same thing. */
export interface Lexicon {
  language: string; // BCP 47, e.g. "en"
  stemmer: 'porter-en' | 'none';
  /** Raw rewrites applied before cutting words, e.g. ["a/c", "ac"]. Whole-word matches only. */
  rewrite: Array<[string, string]>;
  /** Words that carry no meaning on a quote line or a question (checked before stemming). */
  stop: string[];
  /** Groups of words or phrases that mean the same thing. Expanded at query time, never at index time. */
  synonyms: string[][];
}

const STEMMERS: Record<Lexicon['stemmer'], (w: string) => string> = {
  'porter-en': porterEnglish,
  none: (w) => w,
};

export interface Expansion {
  /** The query text plus synonym phrases, ready for the search index. */
  text: string;
  /** All processed terms of the query and its synonyms, without duplicates. */
  terms: string[];
  /** Processed terms that came only from synonyms; they count for less than the words that were printed. */
  added: Set<string>;
}

export interface TextPipeline {
  readonly lexicon: Lexicon;
  /** Normalised words, before stop words and stemming. */
  tokenize(text: string): string[];
  /** One word to its index term, or null when it carries no meaning. */
  processTerm(word: string): string | null;
  /** tokenize + processTerm, in order, duplicates kept. */
  terms(text: string): string[];
  /** The query with its synonyms. */
  expand(text: string): Expansion;
}

/** Anything to query text: null and undefined become empty, never the word "undefined". */
export const asText = (v: unknown): string => (v === null || v === undefined ? '' : typeof v === 'string' ? v : String(v));

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function textPipeline(lexicon: Lexicon): TextPipeline {
  const stem = STEMMERS[lexicon.stemmer];
  if (!stem) throw new Error(`unknown stemmer ${lexicon.stemmer}`);
  const stop = new Set(lexicon.stop);
  const rewrites = lexicon.rewrite.map(
    ([from, to]) => [new RegExp(`(^|[^\\p{L}\\p{N}])${escape(from.toLowerCase())}(?=$|[^\\p{L}\\p{N}])`, 'gu'), ` ${to} `] as const,
  );

  const tokenize = (text: string): string[] => {
    let t = asText(text).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
    for (const [re, to] of rewrites) t = t.replace(re, `$1${to}`);
    t = t.replace(/([\p{L}\p{N}])\+/gu, '$1 plus ').replace(/['’]/g, '');
    return t.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  };

  const processTerm = (word: string): string | null => {
    const w = word.toLowerCase();
    if (stop.has(w)) return null;
    if (/\d/.test(w)) return w; // model numbers ("16", "s26") are kept exactly
    if (w.length < 2) return null;
    return stem(w);
  };

  const terms = (text: string): string[] =>
    tokenize(text)
      .map(processTerm)
      .filter((t): t is string => !!t);

  // Each synonym phrase as a sequence of processed terms, computed once.
  const groups = lexicon.synonyms.map((g) => g.map((phrase) => ({ phrase, seq: terms(phrase) })).filter((m) => m.seq.length));

  const contains = (hay: string[], seq: string[]) => {
    outer: for (let i = 0; i + seq.length <= hay.length; i++) {
      for (let j = 0; j < seq.length; j++) if (hay[i + j] !== seq[j]) continue outer;
      return true;
    }
    return false;
  };

  const expand = (input: string): Expansion => {
    const text = asText(input);
    const base = terms(text);
    const have = new Set(base);
    const phrases: string[] = [];
    const added = new Set<string>();
    for (const g of groups) {
      if (!g.some((m) => contains(base, m.seq))) continue;
      for (const m of g) {
        if (contains(base, m.seq)) continue;
        phrases.push(m.phrase);
        for (const t of m.seq) if (!have.has(t)) added.add(t);
      }
    }
    return {
      text: phrases.length ? `${text} ${phrases.join(' ')}` : text,
      terms: [...new Set([...base, ...added])],
      added,
    };
  };

  return { lexicon, tokenize, processTerm, terms, expand };
}
