// Personal data that must never leave the device.
// Masking runs before anything is offered to the cloud; `findPII` is the guard the cloud payload builder uses.
// The iPhone app ports these rules line for line (ios/WeKnow/Core/PII.swift), so both cover the same things.

import { nameSpans, type NameSpan } from './names';

export type PIIKind = 'email' | 'phone' | 'card' | 'account' | 'ssn' | 'plate' | 'vin' | 'street' | 'name';

const PATTERNS: Array<[PIIKind, RegExp]> = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['card', /\b(?:\d[ -]?){13,19}\b/g],
  // Any 17 letters and digits with both in it: text recognition often reads 0 as O, so I, O and Q are allowed.
  ['vin', /\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{17}\b/g],
  // Labelled account / routing / IBAN numbers, and any long digit run.
  // "Account number: 3301-4478-1234": the label's own word ("number", "no.", "#", "ID") is not the number. Without
  // this rule the next one covers "Account number" and leaves the digits after the colon (seen on a PDF's text).
  ['account', /\b(?:acct|account|routing|aba|iban|a\/c)\.?\s*(?:(?:number|num|nr|no|id)\b\.?|#)[#:\s.-]*(?=[A-Z -]*\d)[A-Z0-9][A-Z0-9 -]{3,}/gi],
  // A heading such as "ACCOUNT HOLDER" or "Account summary" is not a number (the rule above covers "Account number: …").
  [
    'account',
    /\b(?:acct|account|routing|aba|iban|a\/c)\b[#:\s.-]*(?!(?:holders?|members?(?:hip)?|services?|summary|information|info|details?|number|no|type|status|name|balance|activity|overview|settings|statement|history|charges|total)\b)[A-Z0-9][A-Z0-9 -]{5,}/gi,
  ],
  ['account', /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g],
  ['account', /\b\d{8,}\b/g],
  // A ZIP+4 narrows an address to a few homes; a five-digit ZIP alone (a region) stays.
  ['street', /\b\d{5}-\d{4}\b/g],
  ['phone', /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g],
  // A local number without its area code, as people type it ("555-0134"): three digits, a separator, four.
  ['phone', /(?<![\d-])\b\d{3}[\s.-]\d{4}\b(?![\d-])/g],
  // Numbers that point at one household even though they are not an account: a meter, an invoice, a statement,
  // a reference, a policy or an order number (labelled), and any code with seven or more digits in it — but not a
  // date or a money amount. Covered as account-like numbers.
  ['account', /\b(?:meter|invoice|inv|statement|reference|ref|e-?receipt|receipt|order|policy|claim|premise|service id|confirmation|ticket|case|file)\b\.?\s*(?:no\.?|number|num|#|id)?[#:\s.-]*(?=[A-Z0-9-]*\d{3})[A-Z0-9][A-Z0-9-]{4,}/gi],
  ['account', /\b(?!\d{4}-\d{2}-\d{2}\b)(?!(?:1-)?\d{3}-\d{3}-\d{4}\b)(?!\d{3}-\d{4}\b)(?!\d{5}-\d{4}\b)(?=(?:[A-Z-]*\d){7})[A-Z0-9][A-Z0-9-]{6,}\b/gi],
  ['plate', /\b(?:plate|lic(?:ense)?\.?\s*(?:no|#)?)\b[#:\s.-]*[A-Z0-9-]{4,8}\b/gi],
  [
    'street',
    /\b\d{1,6}\s+(?:[A-Z][a-z]+\s){0,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Ter|Terrace)\b\.?/g,
  ],
  // The same street in capitals, as an envelope window prints it: "512 BRAMBLE CT".
  ['street', /\b\d{1,6}\s+(?:[A-Z]+\s){1,3}(?:ST|STREET|AVE|AVENUE|RD|ROAD|BLVD|DR|DRIVE|LN|LANE|CT|COURT|WAY|PL|PLACE|TER)\b\.?/g],
  // A phone number already half hidden on the paper, "555-***-0134": the rest is still covered.
  ['phone', /\b\d{3}[\s.-]?\*{2,4}[\s.-]?\d{4}\b/g],
];

/** A name after a title or a greeting: "Mr. Alaric Venn-Hollis", "To: Theodora Quillfeather" (as PII.swift). */
// One space between the words of a name: two or more spaces are a column gap, and the next column is something else.
const TITLED_NAME = /(?:\b(?:Mr|Mrs|Ms|Miss|Mx|Dr)\.?\s+|^(?:[Tt]o|TO|[Dd]ear|DEAR|[Aa]ttn|ATTN)\s*[:,]\s*)([A-Z][A-Za-z'’.-]+(?: [A-Z][A-Za-z'’-]+){0,3})/gm;
/** A signature on a line of its own: an initial and a family name, "A. Venn-Hollis", "#07 D. Marrow". */
const SIGNATURE = /^[ \t]*(?:#?\d+[ \t]+)?([A-Z]\.[ \t]?[A-Z][a-z'’]+(?:-[A-Z][a-z'’]+)?)[ \t]*$/gm;

/** Labels that put a person's name after them ("Customer: Margaret Ellis") or on the next line down ("CUSTOMER"). */
const NAME_LABELS = [
  'customer name|customer|account holder|account name|holder|cardholder|policyholder|name|bill to|billed to|sold to|ship to',
  'attn|attention|client|owner|homeowner|insured|patient|member|tenant|resident|landlord|guarantor|beneficiary|recipient',
  'prepared for|prepared by|approved by|accepted by|signed by|service advisor|advisor|technician|tech|electrician|plumber',
  'mechanic|installer|inspector|contractor|estimator|salesperson|sales rep|representative|agent|driver|contact',
].join('|');
/** A label and the words after it on the same line; the words are checked for a capitalised name separately. */
const LABEL_THEN = new RegExp(`\\b(?:${NAME_LABELS})\\s*[:#]\\s*`, 'gi');
/** Two to four capitalised words, the way a name is printed (also all capitals). */
export const LOOKS_LIKE_NAME = /^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$/;
// An optional staff number first, as a technician line prints it ("Technician #07 D. Marrow").
const NAME_AFTER_LABEL = /^(?:\d+[ \t]+)?[A-Z][A-Za-z'’.-]+(?:[ \t]+[A-Z][A-Za-z'’.-]+){0,3}/;
/** A whole piece of text that is only a name label ("CUSTOMER", "Bill to:", "Account holder"). */
export const NAME_LABEL_ONLY = new RegExp(`^(?:${NAME_LABELS})\\s*:?$`, 'i');

/** A personal detail found in a text, with where it is: [start, end) in UTF-16 code units. */
export interface PIISpan {
  kind: PIIKind;
  start: number;
  end: number;
  text: string;
}

/** Labels strong enough that a name may follow without a colon ("Customer Theodora Quillfeather" in a table). */
const LABEL_SPACE = /\b(?:customer name|customer|account holder|cardholder|policyholder|bill to|billed to|sold to|ship to|insured|homeowner|tenant|resident|patient)\s+(?=[A-Z][A-Za-z'’.-]+[ \t]+[A-Z])/g;
const TWO_WORDS = /^[A-Z][A-Za-z'’.-]+(?:[ \t]+[A-Z][A-Za-z'’.-]+){1,3}/;

function labelledNames(text: string): PIISpan[] {
  const out: PIISpan[] = [];
  for (const m of text.matchAll(LABEL_THEN)) {
    const at = (m.index ?? 0) + m[0].length;
    const name = NAME_AFTER_LABEL.exec(text.slice(at));
    if (name) out.push({ kind: 'name', start: at, end: at + name[0].length, text: name[0] });
  }
  for (const m of text.matchAll(LABEL_SPACE)) {
    const at = (m.index ?? 0) + m[0].length;
    const name = TWO_WORDS.exec(text.slice(at));
    if (name && !out.some((o) => o.start === at)) out.push({ kind: 'name', start: at, end: at + name[0].length, text: name[0] });
  }
  for (const re of [TITLED_NAME, SIGNATURE]) {
    for (const m of text.matchAll(re)) {
      const at = (m.index ?? 0) + m[0].indexOf(m[1]);
      if (!out.some((o) => o.start === at)) out.push({ kind: 'name', start: at, end: at + m[1].length, text: m[1] });
    }
  }
  return out;
}

function allSpans(text: string): PIISpan[] {
  const hits: PIISpan[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      hits.push({ kind, start, end: start + m[0].length, text: m[0] });
    }
  }
  const labelled = labelledNames(text);
  // People's names the patterns cannot see (names.ts): a listed given name with a surname, or a capitalised run
  // printed right next to an address, account, phone or email. One detail is counted once.
  const taken = [...hits, ...labelled];
  const anchors = hits.filter((h) => ANCHOR_KINDS.has(h.kind));
  const names = nameSpans(text, anchors)
    .filter((n, i, all) => !taken.some((h) => overlaps(h, n)) && !all.slice(0, i).some((m) => overlaps(m, n)))
    .map((n) => ({ kind: 'name' as const, start: n.start, end: n.end, text: text.slice(n.start, n.end) }));
  return [...hits, ...labelled, ...names];
}

/** The details a name is printed next to on a bill or a letter. */
const ANCHOR_KINDS = new Set<PIIKind>(['street', 'account', 'phone', 'email', 'card', 'ssn']);
const overlaps = (a: NameSpan, b: NameSpan) => a.start < b.end && b.start < a.end;
const TOKEN = /\[(?:street|account|phone|email|card|ssn|vin|plate|name)\]/g;

export interface PIIHit {
  kind: PIIKind;
  text: string;
}

export function findPII(text: string): PIIHit[] {
  return allSpans(text).map(({ kind, text: s }) => ({ kind, text: s }));
}

/**
 * Every personal detail in `text`, overlapping matches merged into one span; a merged span keeps the kind of the
 * match that starts first. Used to cover the words of a picture before it may be sent.
 */
export function piiSpans(text: string): PIISpan[] {
  const hits = allSpans(text).sort((a, b) => a.start - b.start || b.end - a.end);
  const out: PIISpan[] = [];
  for (const h of hits) {
    const last = out[out.length - 1];
    if (last && h.start < last.end) {
      last.end = Math.max(last.end, h.end);
      last.text = text.slice(last.start, last.end);
    } else out.push({ ...h });
  }
  return out;
}

/** Replace every personal-data match with a fixed token such as [phone]. */
export function maskText(text: string): string {
  let out = text;
  for (const [kind, re] of PATTERNS) out = out.replace(re, `[${kind}]`);
  // Right to left, one cover per stretch of text (the label rules can find the same name twice).
  const labelled = labelledNames(out)
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((n, i, all) => !all.slice(0, i).some((m) => overlaps(m, n)));
  for (const n of labelled.reverse()) out = out.slice(0, n.start) + '[name]' + out.slice(n.end);
  // Then the names beside what is now covered ([account], [street], ...) and the listed given names.
  const tokens = [...out.matchAll(TOKEN)].map((m) => ({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, kind: m[0] }));
  const anchors = tokens.filter((x) => x.kind !== '[name]' && x.kind !== '[vin]' && x.kind !== '[plate]');
  const spans = nameSpans(out, anchors)
    .filter((n) => !tokens.some((x) => overlaps(x, n)))
    .sort((a, b) => a.start - b.start || b.end - a.end)
    .filter((n, i, all) => !all.slice(0, i).some((m) => overlaps(m, n)));
  for (const n of spans.reverse()) out = out.slice(0, n.start) + '[name]' + out.slice(n.end);
  return out;
}
