// A how-to answer from the web, for a problem the packs do not cover. Plain code only: the cloud call lives in
// webSearch.ts. An answer is kept only when it came with https web sources from Google Search grounding; prices are
// never shown from it (every number WeKnow shows comes from a pack with a source), so any money amount is removed.

import type { Source } from './packs';

export interface WebAnswer {
  title: string;
  /** At most six short plain steps, without money amounts. */
  steps: string[];
  safety: string | null;
  callPro: string | null;
  /** The https pages Google Search grounding returned. Never empty. */
  sources: Source[];
}

export type WebParse = { answer: WebAnswer } | { answer: null; reason: 'no answer' | 'unreadable answer' | 'no steps' | 'no web sources' | 'none in sources' };

const MAX_STEPS = 6;

// "$120", "$1,250.50", "$80 to $150", "$80-$150", "$80 – 150"
const AMOUNT = String.raw`\$\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:-|–|to)\s?\$?\s?\d[\d,]*(?:\.\d+)?)?`;
/** An amount with the words that lead into it: "costs about $25", "for $10 to $20". */
const PRICED = new RegExp(String.raw`(?:\b(?:costs?|costing|runs?|is|are|for|at)\s+)?(?:\b(?:about|around|roughly|approximately|approx\.?|only|under|over|less than|more than|up to)\s+)?~?` + AMOUNT, 'gi');
/** A bracketed aside that holds an amount: "(about $12)", "($10 to $20 to replace)". */
const PRICED_ASIDE = new RegExp(String.raw`\s*\([^()]*` + AMOUNT + String.raw`[^()]*\)`, 'gi');

/** A sentence without money amounts or the words left dangling around them. */
export function withoutPrices(s: string): string {
  return s
    .replace(PRICED_ASIDE, '')
    .replace(PRICED, '')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?=[,.;:])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const plain = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const s = withoutPrices(v.replace(/\s+/g, ' ').trim()).slice(0, max).trim();
  return s && !/^(none|null|n\/a)$/i.test(s) ? s : null;
};

/** The last JSON object in the model's text: the summary line it was asked to end with. */
function lastJson(text: string): Record<string, unknown> | 'unreadable' | null {
  const end = text.lastIndexOf('}');
  if (end < 0) return null;
  for (let i = text.lastIndexOf('{', end); i >= 0; i = text.lastIndexOf('{', i - 1)) {
    try {
      const v = JSON.parse(text.slice(i, end + 1)) as unknown;
      if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* not this brace: try an earlier one */
    }
    if (i === 0) break;
  }
  return 'unreadable';
}

/** The https sources of a grounded answer, each page once. */
export function webSources(chunks: ReadonlyArray<{ web?: { uri?: string; title?: string } }>, today = new Date().toISOString().slice(0, 10)): Source[] {
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const c of chunks) {
    const uri = c.web?.uri;
    if (!uri || !uri.startsWith('https://') || seen.has(uri)) continue;
    seen.add(uri);
    out.push({ url: uri, title: c.web?.title, fetched: today });
  }
  return out.slice(0, 5);
}

/** The model's grounded text and its sources, as an answer WeKnow may show, or why not. */
export function parseWebAnswer(text: string, sources: Source[]): WebParse {
  const json = lastJson(text);
  if (!json) return { answer: null, reason: 'no answer' };
  if (json === 'unreadable') return { answer: null, reason: 'unreadable answer' };
  if (json.none) return { answer: null, reason: 'none in sources' };
  const steps = (Array.isArray(json.steps) ? json.steps : [])
    .map((s) => plain(s, 220))
    .filter((s): s is string => !!s)
    .slice(0, MAX_STEPS)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
  if (!steps.length) return { answer: null, reason: 'no steps' };
  const https = sources.filter((s) => s.url.startsWith('https://'));
  if (!https.length) return { answer: null, reason: 'no web sources' };
  return {
    answer: {
      // A heading starts with a capital, whatever case the model wrote it in ("vacuum not picking up").
      title: capitalFirst(plain(json.title, 80)) ?? 'What to try',
      steps,
      safety: plain(json.safety, 220),
      callPro: plain(json.callPro, 220),
      sources: https,
    },
  };
}

const capitalFirst = (s: string | undefined | null): string | undefined => (s ? s.charAt(0).toUpperCase() + s.slice(1) : undefined);
