// Answering from words alone, without a picture. Plain code, no model, no network:
//   aboutPicture  - is this question about something in front of the camera ("is this fair?", "what is that?")
//   lean          - which kind of pack item to try first: a price ("how much...") or a guide ("how do I fix...")
//   matchStrength - is a pack item's name or one of its aliases clearly what the question names
//   pickLexical   - which of the top candidates to answer with, or none
//   priceAnswer   - the price answer, every number from the pack item
// The flow that uses these is ask/flows.ts (wordsFlow).

import type { PriceItem } from '../core/packs';
import type { Tone } from '../answer/types';
import { t, money, longDate } from '../strings';

export type Lean = 'price' | 'guide' | 'both';
export type ItemKind = 'price' | 'guide';

const tidy = (s: string) => s.replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();

// "it" in "how much does it cost" or "how long does it take" points at nothing; those are not about a picture.
const EMPTY_IT = /\b(?:does|do|did|would|will|should|could|can|might|is|was)\s+it\s+(?:cost|costs|take|takes|run|be|to)\b/gi;
// Words that point at the thing in the window, or at a paper.
const POINTING = /\b(?:this|these|that|those|it|here|picture|photo|pic|paper|camera|fair)\b/i;
const MY_PAPER = /\b(?:my|the|our)\s+(?:bill|quote|letter|invoice|estimate|receipt|statement)\b/i;
const AMOUNT = /\$\s?\d/;

/** True when the question is about something to look at: a picture is needed. */
export function aboutPicture(question: string): boolean {
  const q = tidy(question).replace(EMPTY_IT, ' ');
  return POINTING.test(q) || MY_PAPER.test(q) || AMOUNT.test(q);
}

const PRICE_CUE = /\b(?:how much|cost|costs|costing|price|prices|pricing|charge|charges|pay for|paying for|expensive|cheap)\b/i;
const GUIDE_CUE =
  /\b(?:how (?:do|can|should|would) (?:i|you|we)|how to|fix|fixing|clog|clogs|clogged|unclog|leak|leaks|leaking|leaky|won't|wont|broken|broke|stuck|jammed|not working|doesn't work|does not work|drip|drips|dripping|keeps|smells?|smelly|noisy|noise|squeak\w*)\b/i;

/** Which kind of pack item to try first. A price word wins: "how much to fix a leak" is a price question. */
export function lean(question: string): Lean {
  const q = tidy(question);
  if (PRICE_CUE.test(q)) return 'price';
  if (GUIDE_CUE.test(q)) return 'guide';
  return 'both';
}

// Words that say nothing about which job it is: question words, price words, and generic job verbs.
const STOP = new Set(
  (
    'a an and or the of to for in on at by with from about into over under up out off as is are was were be been ' +
    'i me my we our you your it its this that these those there here what which who why when where how ' +
    'do does did done can could would should will shall may might must have has had get gets got need needs want ' +
    'much many some any one two per each every typical typically usual usually average normal around about roughly ' +
    'cost costs price prices pricing charge charges pay paying paid fee fees dollar dollars money cheap expensive ' +
    'fix fixing repair repairs replace replacing replacement install installing installation new service job work ' +
    'help please tell know way best good make ok okay just really thing things someone pro professional ' +
    'wont dont doesnt cant isnt aint'
  ).split(' '),
);

/** A word cut to a plain stem, so "unclog" and "clogged" meet "clog", and "pads" meets "pad". */
export function stem(w: string): string {
  let s = w.toLowerCase();
  // "unclog" -> "clog", "unplug" -> "plug": the job is the same word
  if (s.startsWith('un') && s.length >= 6) s = s.slice(2);
  if (s.length > 4 && s.endsWith('ies')) s = `${s.slice(0, -3)}y`;
  else if (s.length > 5 && s.endsWith('ing')) s = s.slice(0, -3);
  else if (s.length > 4 && s.endsWith('ed')) s = s.slice(0, -2);
  else if (s.length > 4 && /(?:sh|ch|x|ss)es$/.test(s)) s = s.slice(0, -2);
  else if (s.length > 3 && s.endsWith('s') && !s.endsWith('ss')) s = s.slice(0, -1);
  // "clogg" -> "clog", "runn" -> "run"
  if (s.length > 3 && /([bdgmnprt])\1$/.test(s)) s = s.slice(0, -1);
  return s;
}

/** The words of a phrase that name the job: lower case, stemmed, without question and price words. */
export function terms(s: string): string[] {
  const out: string[] = [];
  for (const raw of tidy(s).toLowerCase().replace(/'/g, '').split(/[^a-z0-9]+/)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    const w = stem(raw);
    if (w.length < 2 || STOP.has(w)) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

/**
 * How clearly the question names this item, from 0 to 1. Each phrase (the item's name and each alias) counts only
 * when the question holds enough of its job words: every word of a one- or two-word phrase ("brake pads"), else at
 * least half of them and at least two. The strength is the best share. 0 means no confident match.
 */
export function matchStrength(question: string, phrases: string[]): number {
  const asked = new Set(terms(question));
  let best = 0;
  for (const p of phrases) {
    const want = terms(p);
    if (!want.length) continue;
    const shared = want.filter((w) => asked.has(w)).length;
    const need = want.length <= 2 ? want.length : Math.max(2, Math.ceil(want.length / 2));
    if (shared >= need) best = Math.max(best, shared / want.length);
  }
  return best;
}

export interface Scored {
  kind: ItemKind;
  ref: string;
  /** matchStrength of the item against the question. */
  strength: number;
}

/**
 * Pick one of the top lexical candidates (one per kind), or null. Only a confident match counts. The kind the
 * question leans to wins when it is confident; otherwise the stronger match; a tie goes to the lean order
 * (price before guide when the question leans neither way).
 */
export function pickLexical(l: Lean, scored: Scored[]): Scored | null {
  const ok = scored.filter((s) => s.strength > 0);
  if (!ok.length) return null;
  if (l !== 'both') {
    const first = ok.find((s) => s.kind === l);
    if (first) return first;
  }
  const order: ItemKind[] = l === 'guide' ? ['guide', 'price'] : ['price', 'guide'];
  return [...ok].sort((a, b) => b.strength - a.strength || order.indexOf(a.kind) - order.indexOf(b.kind))[0];
}

/** Kinds in the order to offer them. */
export function kindOrder(l: Lean): ItemKind[] {
  return l === 'guide' ? ['guide', 'price'] : ['price', 'guide'];
}

// ---------- the price answer ----------

export interface PriceAnswer {
  tone: Tone;
  head: string;
  lines: string[];
}

const whole = (n: number) => money(Math.round(n));
const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** "Pads only, parts and labor for one axle (typical = midpoint)" -> "pads only, parts and labor for one axle" */
const includesText = (s: string) =>
  lower(s.replace(/\s*\((?:typical|midpoint)[^)]*\)/gi, '').replace(/[\s.;,]+$/, '').trim());
/** The usual price of one pack item, said plainly: range, typical, what it covers, where the numbers come from. */
export function priceAnswer(item: PriceItem): PriceAnswer {
  const lines = [t('words.price.what', { name: item.name })];
  const unit = item.unit && !/^(job|each|visit|item|device)$/i.test(item.unit) ? item.unit : '';
  lines.push(unit ? t('words.price.typical.unit', { typical: whole(item.typical), unit }) : t('words.price.typical', { typical: whole(item.typical) }));
  if (item.includes?.trim()) lines.push(t('words.price.includes', { includes: includesText(item.includes) }));
  // Said and shown without the source's own name (it may be a brand); the sources sheet lists every source in full.
  const fetched = item.sources.map((s) => s.fetched).filter((x): x is string => !!x).sort().pop();
  lines.push(fetched ? t('words.price.source', { date: longDate(fetched) }) : t('words.price.source.nodate'));
  return { tone: 'plain', head: t('words.price.head', { low: whole(item.low), high: whole(item.high) }), lines };
}

/** What follow-up words ask about the topic of the conversation, when they name nothing themselves. */
export type FollowUp = 'say' | 'pay' | 'cost' | 'fix' | 'fair';

export function followUp(question: string): FollowUp | null {
  const s = question.toLowerCase();
  if (/\b(say|tell|ask)\b.*\b(shop|mechanic|garage|them|him|her|plumber|electrician)\b/.test(s)) return 'say';
  if (/\bshould i pay\b|\bpay (it|this|that)\b|\bscam\b|\bsafe\b|\bwhat (should|do|can) i do\b/.test(s)) return 'pay';
  if (/\bhow much\b|\bcosts?\b|\bprice|\bcharges?\b|\bexpensive\b|\bcheap\b|\b(a|the) pro\b|\bprofessional\b/.test(s)) return 'cost';
  if (/\bfix\b|\bfix it\b|\brepair\b|\bmyself\b|\bdo it\b|\bsteps?\b|\bhow do i\b|\bhow to\b/.test(s)) return 'fix';
  if (/\bfair\b|\bnormal\b|\btoo (much|high)\b|\bover ?charg|\brip ?off\b|\bok(ay)?\b/.test(s)) return 'fair';
  return null;
}
