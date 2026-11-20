// The basic check: a paper read by plain code alone, for a device that has no model of its own. Nothing here asks
// a model and nothing leaves the device. It says what kind of paper this is and who asks to be paid; the warnings
// themselves (a changed account, pressure, words aimed at an AI, sums that do not hold) are the same plain rules
// every bill goes through (core/verdict.ts, core/billMath.ts). The full check, which also reads the meaning of each
// part and prices each line of a quote, needs a model on the device.

import type { Understanding } from './understanding';

export type BasicKind = 'bill' | 'quote' | 'unknown';

const BILL = /\b(amount due|balance due|total due|payment due|due date|due by|pay by|please pay|statement|invoice|billing period|remit(?:tance)?|past due|account (?:number|no\.?)|autopay)\b/gi;
const QUOTE = /\b(estimate|quotation|quote|proposal|work order|labor|labour|parts|technician|valid (?:until|for))\b/gi;
const QUOTE_HEAD = /\b(estimate|quotation|quote|proposal)\b/i;
const BILL_HEAD = /\b(invoice|statement|bill)\b/i;
/** A line that is only a heading, a page mark or a label: never the name of who asks to be paid. */
const NOT_A_NAME = /^(invoice|statement|estimate|quote|quotation|bill|page|date|customer|account|amount|total|to|from|tel|phone|specimen|important|description)\b/i;

/** The title of a paper or of a box on it ("Electric statement", "Payment stub"), not who sent it. */
const A_HEADING = /\b(statement|invoice|bill|estimate|summary|notice|stub|receipt|details?|charges|service address|period)$/i;

const count = (re: RegExp, text: string) => (text.match(re) ?? []).length;

/** What kind of paper these lines are, by the words printed on them. 'unknown' when the words do not say. */
export function basicKind(lines: readonly string[]): BasicKind {
  const text = lines.join('\n');
  if (text.replace(/\s/g, '').length < 40) return 'unknown';
  const head = lines.slice(0, 12).join('\n');
  const bill = count(BILL, text) + (BILL_HEAD.test(head) ? 2 : 0);
  const quote = count(QUOTE, text) + (QUOTE_HEAD.test(head) ? 3 : 0);
  if (quote >= 3 && quote > bill) return 'quote';
  if (bill >= 2) return 'bill';
  return 'unknown';
}

/** Words a company, a utility or an office has in its name. */
const ORG =
  /\b(co-?op|cooperative|inc|llc|ltd|corp|corporation|company|district|authority|utilit(?:y|ies)|services?|trust|bank|credit union|electric|energy|power|water|gas|telecom|wireless|insurance|clinic|hospital|medical|dental|auto|automotive|care|plumbing|heating|roofing|associates|partners|department|city of|county of|university)\b/i;

/** A printed line, or one column of it, that reads like the name on a letterhead. */
function nameIn(piece: string): string | null {
  if (/\[|@|https?:|www\.|\.(?:com|org|net|gov)\b/i.test(piece)) return null;
  const name = piece.replace(/[^\p{L}\p{N}&'’.,\- ]/gu, ' ').replace(/\s+/g, ' ').trim().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, '');
  const words = name.split(' ').filter(Boolean);
  const letters = name.replace(/[^\p{L}]/gu, '').length;
  if (letters < 4 || name.length > 60 || words.length > 7 || /\d{3,}/.test(name) || NOT_A_NAME.test(name) || A_HEADING.test(name)) return null;
  // A name is written with capitals: most of its words start with one (a sentence of small print does not).
  const capital = words.filter((w) => /^[\p{Lu}\d&]/u.test(w)).length;
  if (!/^[\p{Lu}\d]/u.test(name) || capital * 2 < words.length) return null;
  return name;
}

/**
 * Who asks to be paid. A company the person already keeps a note of, when its name is printed on the paper; else the
 * letterhead: near the top, the first line that reads like a name, one that sounds like a company first. Lines with
 * a covered detail, a web address or small print are never used. `recognized`: the lines were read from a photo.
 */
export function basicPayee(lines: readonly string[], known: readonly string[] = [], recognized = false): string | null {
  const text = lines.join('\n').toLowerCase();
  const kept = known.find((k) => k.trim().length >= 3 && text.includes(k.trim().toLowerCase()));
  if (kept) return kept;
  // Lines with nothing covered in them come first: a line that holds a covered detail is about the customer or an
  // account ("Electric statement   [account]"), and is used only when no clean line reads like a name.
  const top = lines.slice(0, 15);
  const names: string[] = [];
  for (const raw of [...top.filter((l) => !l.includes('[')), ...top.filter((l) => l.includes('['))]) {
    // The letterhead ends where a second column, a tagline or a number starts.
    for (const piece of raw.split(/\s{2,}| [·•|] | - /)) {
      const name = nameIn(piece);
      if (name) names.push(name);
    }
  }
  // Words recognized from a photo come out of order and with stray pieces: only a line that sounds like a company
  // is taken as the name there. A PDF's own text is exact, so its first name-like line is the letterhead.
  return names.find((n) => ORG.test(n)) ?? (recognized ? null : (names[0] ?? null));
}

/**
 * The bill form, filled by plain code: only the kind and who asks to be paid. The three warning fields stay false
 * here because the rules read the paper's own words for them (billVerdict); a model is what would add to them.
 */
export function basicBill(lines: readonly string[], known: readonly string[] = [], recognized = false): Understanding {
  return { kind: 'bill', lines: [], problemRef: null, payee: basicPayee(lines, known, recognized), payTo: null, urgent: false, addressedToAI: false, accountChange: false };
}
