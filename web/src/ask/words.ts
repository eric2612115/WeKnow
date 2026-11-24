// Answering from words alone, without a picture. Plain code, no model, no network:
//   aboutPicture  - is this question about something in front of the camera ("is this fair?", "what is that?")
//   lean          - which kind of pack item to try first: a price ("how much...") or a guide ("how do I fix...")
//   matchStrength - is a pack item's name or one of its aliases clearly what the question names
//   pickLexical   - which of the top candidates to answer with, or none
//   priceAnswer   - the price answer, every number from the pack item
// The flow that uses these is ask/flows.ts (wordsFlow).

import type { PriceItem } from '../core/packs';
import { maskText } from '../core/pii';
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

// "my phone number is 555-0134", "call me at ...", "my email is ...": the detail and the words that introduce it
// name no job ("phone" would otherwise find the guide for a phone that will not charge).
const DETAIL_LEADS: RegExp[] = [
  /\b(?:(?:my|our|the)\s+)?(?:(?:phone|cell|mobile|telephone|home|work|account|card|policy|member)\s+)?(?:number|no\.?|#)\s*(?:is|:)?\s*\[(?:phone|account|card|ssn)\]/gi,
  /\b(?:(?:my|our)\s+)?e-?mail(?:\s+address)?\s*(?:is|:)?\s*\[email\]/gi,
  /\b(?:call|text|reach|ring)\s+(?:me|us)\s+(?:at|on)?\s*\[phone\]/gi,
  /\b(?:i\s+live\s+at|(?:my|our)\s+address\s+is)\s*\[street\]/gi,
  /\b(?:(?:my|our)\s+)?(?:plate|vin)\s*(?:number|no\.?)?\s*(?:is|:)?\s*\[(?:plate|vin)\]/gi,
];

/**
 * The words that name the job, for matching on this device: personal details covered and dropped, with the words
 * that introduce them. Never sent anywhere; the cloud gets the covered words (ask/escalate.ts coverWords).
 */
export function jobWords(question: string): string {
  let q = maskText(question);
  for (const re of DETAIL_LEADS) q = q.replace(re, ' ');
  return q
    .replace(/\[[a-z]+\]/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[\s,.;:]+|(?<=[,.;:])[\s,.;:]+(?=[,.;:])/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const PRICE_CUE = /\b(?:how much|cost|costs|costing|price|prices|pricing|charge|charges|pay for|paying for|expensive|cheap)\b/i;
const GUIDE_CUE =
  /\b(?:how (?:do|can|should|would) (?:i|you|we)|how to|fix|fixing|clog|clogs|clogged|unclog|leak|leaks|leaking|leaky|won't|wont|broken|broke|stuck|jammed|not working|doesn't work|does not work|drip|drips|dripping|keeps|smells?|smelly|noisy|noise|squeak\w*|forever|too long|slow(?:ly)?|stopped|overheat\w*|hums?|humming|rattl\w*|wobbl\w*|tripp\w*|flicker\w*|not (?:heating|cooling|draining|drying|spinning|starting|turning on))\b/i;

/** Which kind of pack item to try first. A price word wins: "how much to fix a leak" is a price question. */
export function lean(question: string): Lean {
  const q = tidy(question);
  if (PRICE_CUE.test(q)) return 'price';
  if (GUIDE_CUE.test(q)) return 'guide';
  return 'both';
}

const REPLACE = /\b(new|install\w*|replac\w*)\b/i;
const REPAIR = /\b(repair\w*|fix\w*|broken|not working)\b/i;

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
  // The job verbs are stop words, but they still break a tie: "a new water heater" means replacing it, "it is
  // broken" means repairing it.
  const verb = (t: string) => (REPLACE.test(t) ? 'replace' : REPAIR.test(t) ? 'repair' : null);
  const wants = verb(question);
  let best = 0;
  for (const p of phrases) {
    const want = terms(p);
    if (!want.length) continue;
    const shared = want.filter((w) => asked.has(w)).length;
    const need = want.length <= 2 ? want.length : Math.max(2, Math.ceil(want.length / 2));
    if (shared >= need) best = Math.max(best, shared / want.length + (wants && verb(p) === wants ? 0.01 : 0));
  }
  return best;
}

/** Two job words are the same, or one is a small misspelling of the other ("altenr" for "altern"). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length < 5 || b.length < 5 || Math.abs(a.length - b.length) > 2) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length] <= 2;
}

/**
 * Whether a pack item has anything to do with the question: at least one of its job words (name or another name) is
 * in the question. A small model offered a list will pick something from it even when nothing fits ("My vacuum
 * won't pick anything up" got "Top up windshield washer fluid", found by "up"): such a pick is not taken.
 */
export function sharesJobWord(question: string, phrases: string[]): boolean {
  const asked = terms(question);
  const named = phrases.flatMap((p) => terms(p));
  return asked.some((a) => named.some((n) => sameWord(a, n)));
}

/** Words that say where on the car or house, not which job. */
const SIDES = new Set(['front', 'rear', 'left', 'right', 'both', 'side', 'driver', 'passenger'].map(stem));

/**
 * The one option plain code is sure a quote line names, or null (same rule as the iPhone's Matcher.sure): one of the
 * option's names (two job words or more, brackets left out) is wholly in the line, and every job word of the line is
 * one the option knows or only says which side. Among such options the longest name wins ("brake pads and rotors"
 * before "brake pads"); a tie is not sure. A sure line is not given to a model, so it comes out the same every time.
 */
export function surePick<T extends { ref: string; name: string; aliases?: string[] }>(line: string, options: T[]): T | null {
  const said = new Set(terms(line));
  let best: T | null = null;
  let bestLen = 0;
  let tie = false;
  for (const o of options) {
    const phrases = [o.name.replace(/\([^)]*\)/g, ' '), ...(o.aliases ?? [])].map((p) => terms(p)).filter((p) => p.length >= 2);
    const known = new Set([o.name, ...(o.aliases ?? [])].flatMap((p) => terms(p)));
    if (![...said].every((w) => known.has(w) || SIDES.has(w))) continue;
    const named = Math.max(0, ...phrases.filter((p) => p.every((w) => said.has(w))).map((p) => p.length));
    if (!named) continue;
    if (named > bestLen) [best, bestLen, tie] = [o, named, false];
    else if (named === bestLen) tie = true;
  }
  return tie ? null : best;
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

/**
 * The stricter pick used when this device has no model to read the words: a candidate counts only when its name or
 * one alias is wholly in the question (every one of its job words, strength 1 or more), and the question leans the
 * same way (a price for "how much", a guide for a problem) or neither. A partial alias or a cross-lean match is not
 * confident: the router then checks online instead of answering the wrong item.
 */
export function pickConfident(l: Lean, scored: Scored[]): Scored | null {
  return pickLexical(
    l,
    scored.filter((s) => s.strength >= 1 && (l === 'both' || s.kind === l)),
  );
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
