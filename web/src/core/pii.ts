// Personal data that must never leave the device.
// Masking runs before anything is offered to the cloud; `findPII` is the guard the cloud payload builder uses.

export type PIIKind = 'email' | 'phone' | 'card' | 'account' | 'ssn' | 'plate' | 'vin' | 'street';

const PATTERNS: Array<[PIIKind, RegExp]> = [
  ['email', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['ssn', /\b\d{3}-\d{2}-\d{4}\b/g],
  ['card', /\b(?:\d[ -]?){13,19}\b/g],
  ['vin', /\b[A-HJ-NPR-Z0-9]{17}\b/g],
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

export interface PIIHit {
  kind: PIIKind;
  text: string;
}

export function findPII(text: string): PIIHit[] {
  const hits: PIIHit[] = [];
  for (const [kind, re] of PATTERNS) {
    for (const m of text.matchAll(re)) hits.push({ kind, text: m[0] });
  }
  return hits;
}

/** Replace every personal-data match with a fixed token such as [phone]. */
export function maskText(text: string): string {
  let out = text;
  for (const [kind, re] of PATTERNS) out = out.replace(re, `[${kind}]`);
  return out;
}
