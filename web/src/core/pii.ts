// Personal data that must never leave the device.
// Masking runs before anything is offered to the cloud; `findPII` is the guard the cloud payload builder uses.
// The iPhone app ports these rules line for line (ios/WeKnow/Core/PII.swift), so both cover the same things.

export type PIIKind = 'email' | 'phone' | 'card' | 'account' | 'ssn' | 'plate' | 'vin' | 'street' | 'name';

const PATTERNS: Array<[PIIKind, RegExp]> = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['card', /\b(?:\d[ -]?){13,19}\b/g],
  // Any 17 letters and digits with both in it: text recognition often reads 0 as O, so I, O and Q are allowed.
  ['vin', /\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{17}\b/g],
  // Labelled account / routing / IBAN numbers, and any long digit run.
  ['account', /\b(?:acct|account|routing|aba|iban|a\/c)\b[#:\s.-]*[A-Z0-9][A-Z0-9 -]{5,}/gi],
  ['account', /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g],
  ['account', /\b\d{8,}\b/g],
  ['phone', /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g],
  ['plate', /\b(?:plate|lic(?:ense)?\.?\s*(?:no|#)?)\b[#:\s.-]*[A-Z0-9-]{4,8}\b/gi],
  [
    'street',
    /\b\d{1,6}\s+(?:[A-Z][a-z]+\s){0,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Ter|Terrace)\b\.?/g,
  ],
];

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
const NAME_AFTER_LABEL = /^[A-Z][A-Za-z'’.-]+(?:[ \t]+[A-Z][A-Za-z'’.-]+){0,3}/;
/** A whole piece of text that is only a name label ("CUSTOMER", "Bill to:", "Account holder"). */
export const NAME_LABEL_ONLY = new RegExp(`^(?:${NAME_LABELS})\\s*:?$`, 'i');

/** A personal detail found in a text, with where it is: [start, end) in UTF-16 code units. */
export interface PIISpan {
  kind: PIIKind;
  start: number;
  end: number;
  text: string;
}

function labelledNames(text: string): PIISpan[] {
  const out: PIISpan[] = [];
  for (const m of text.matchAll(LABEL_THEN)) {
    const at = (m.index ?? 0) + m[0].length;
    const name = NAME_AFTER_LABEL.exec(text.slice(at));
    if (name) out.push({ kind: 'name', start: at, end: at + name[0].length, text: name[0] });
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
  return [...hits, ...labelledNames(text)];
}

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
  for (const n of labelledNames(out).reverse()) out = out.slice(0, n.start) + '[name]' + out.slice(n.end);
  return out;
}
