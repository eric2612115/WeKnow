// Two plain-code checks on a bill's own words, on this device, with no model:
//  1. Do the printed numbers add up? (subtotal − discount + tax = total; last bill − payments + new charges = amount due;
//     total − paid = balance due), each checked only when every part of it is printed, within $1.
//  2. Does the bill show two different account numbers for the customer (say, one at the top and another on the
//     payment stub)?
// The words come from the paper itself: a PDF's own text, the text recognizer's lines, or an email's covered words.
// Like every rule on a bill, these can only add a warning; nothing here can clear one.

export type AmountLabel = 'subtotal' | 'discount' | 'tax' | 'total' | 'paid' | 'previous' | 'charges' | 'due' | 'minimum';

/** A relation between printed amounts that did not hold. `expected` is what the parts add up to. */
export type SumMiss =
  | { rule: 'tax'; subtotal: number; discount?: number; tax: number; total: number; expected: number }
  | { rule: 'balance'; previous: number; paid: number; charges: number; due: number; expected: number }
  | { rule: 'paid'; total: number; paid: number; due: number; expected: number };

export interface BillMath {
  /** The first amount printed under each label. Payments are kept as a positive number. */
  amounts: Partial<Record<AmountLabel, number>>;
  /** How many relations had all their parts and were checked. */
  checked: number;
  /** The relations that were off by more than the tolerance. */
  misses: SumMiss[];
  /** The last four digits of every different account number labelled as the customer's, in the order printed. */
  accounts: string[];
}

/** Rounding on a printed bill is never more than this. */
export const TOLERANCE = 1;

// ---------- amounts ----------

/** Text recognition reads 0 as O and 1 as l or I; inside a number these can only be digits. */
const fixDigits = (s: string) => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
const D = '[0-9OoIl]';
/**
 * A money amount: with a dollar sign ("$1,234.5O", "-$84.20", "($84.20)"), or without one but with cents
 * ("84.20"). A bare whole number ("Nov 12", "612 kWh") is never an amount, nor a rate ("$0.112") or a percent.
 */
const AMOUNT = new RegExp(
  String.raw`(\(\s*)?([-−])?(?:\$\s*(${D}{1,3}(?:,\s?${D}{3})+|${D}+)(?:\.(${D}{1,2}))?|\b(\d{1,3}(?:,\d{3})+|\d+)\.(${D}{2}))(?!${D}|\.${D}|\s*%)(\s*\))?(\s*CR\b)?`,
  'g',
);

export interface AmountHit {
  value: number;
  index: number;
  end: number;
}

/** Every money amount on one line, in order. */
export function amountsIn(line: string): AmountHit[] {
  const out: AmountHit[] = [];
  for (const m of line.matchAll(AMOUNT)) {
    const whole = m[3] ?? m[5];
    const cents = m[4] ?? m[6] ?? '';
    if (!whole || !/\d/.test(whole + cents)) continue;
    const n = Number(`${fixDigits(whole).replace(/[,\s]/g, '')}.${(fixDigits(cents) + '00').slice(0, 2)}`);
    if (!Number.isFinite(n)) continue;
    const negative = !!m[2] || (!!m[1] && !!m[7]) || !!m[8];
    out.push({ value: negative ? -n : n, index: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

/**
 * A quote line keeps the amount a model copied only when that same number is printed in the paper's own words
 * (whole numbers compared, so 16 is not found in 160). An amount that is not there is set to null: the line is
 * then never judged, so it can never come out as a fair price.
 */
export function keepPrinted<T extends { amount: number | null }>(lines: T[], words: string[]): T[] {
  const printed = new Set<number>();
  for (const w of words) for (const m of fixDigitsInNumbers(w).matchAll(/\d[\d,]*(?:\.\d+)?/g)) printed.add(Math.round(Number(m[0].replace(/,/g, '')) * 100));
  return lines.map((l) => (l.amount === null || printed.has(Math.round(l.amount * 100)) ? l : { ...l, amount: null }));
}
/**
 * Each quote line's amount from its own printed row: the row whose words best hold the line's name, and on it the
 * last amount (after quantity, parts and labor columns comes the line's total). A small model often copies a
 * column's figure or the next row's; this takes the paper's. A line whose row is not found keeps its amount.
 */
export function amountsFromRows<T extends { label: string; amount: number | null }>(lines: T[], words: string[]): T[] {
  return lines.map((l) => {
    const r = printedRow(l.label, words);
    return r && r.amount >= 1 ? { ...l, amount: r.amount } : l;
  });
}

/**
 * The printed row a quote line came from: its name as printed (before the first amount, without the row number or
 * the quantity columns) and its total (the last amount on the row). Null when no row with an amount holds at least
 * 60% of the line's words.
 */
export function printedRow(label: string, words: string[]): { name: string; amount: number } | null {
  const toks = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];
  const want = [...new Set(toks(label))];
  if (!want.length) return null;
  let best: { w: string; hits: AmountHit[] } | null = null;
  let bestShare = 0;
  for (const w of words) {
    const hits = amountsIn(w);
    if (!hits.length) continue;
    const set = new Set(toks(w));
    const share = want.filter((x) => set.has(x)).length / want.length;
    if (share > bestShare) [best, bestShare] = [{ w, hits }, share];
  }
  if (!best || bestShare < 0.6) return null;
  const name = best.w
    .slice(0, best.hits[0].index)
    .replace(/^\s*#?\d{1,2}[.):]?\s+(?=\p{L})/u, '')
    .split(/\s{2,}/)[0]
    .replace(/(?:\s+[\d.,—–-]+)+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { name, amount: best.hits[best.hits.length - 1].value };
}

/** Quote lines with the name and the total taken from their own printed rows, by plain code. */
export function linesFromRows<T extends { label: string; amount: number | null }>(lines: T[], words: string[]): T[] {
  return lines.map((l) => {
    const r = printedRow(l.label, words);
    if (!r) return l;
    return { ...l, label: r.name.length >= 3 ? r.name : l.label, amount: r.amount >= 1 ? r.amount : l.amount };
  });
}

/** "$1,2O0" read by a text recognizer: O and l between digits are digits. */
const fixDigitsInNumbers = (s: string) => s.replace(/(?<=[\d$,.])[Oo](?=[\d,.]|\b)/g, '0').replace(/(?<=[\d$,.])[Il|](?=[\d,.]|\b)/g, '1');

/** The first money amount in `s`, or undefined (used by tests and for OCR noise checks). */
export function parseAmount(s: string): number | undefined {
  return amountsIn(s)[0]?.value;
}

// Labels, most specific first: "Total amount due" is the amount due, not a total; "Total payments" are payments.
const LABELS: Array<[AmountLabel, RegExp]> = [
  ['minimum', /\bmin(?:imum|\.)?\s*(?:amount|payment|pmt)?\s*due\b/i],
  [
    'due',
    /\b(?:(?:total\s+)?balance\s+due|(?:total\s+)?amount\s+(?:now\s+)?due|total\s+(?:amount\s+)?due|total\s+balance|new\s+balance|please\s+pay(?:\s+this\s+amount)?|amount\s+to\s+pay|pay\s+this\s+amount)\b/i,
  ],
  ['previous', /\b(?:previous|prior|last)\s+(?:statement\s+)?(?:balance|bill(?:\s+amount)?|amount\s+billed)\b|\bbalance\s+(?:forward|brought\s+forward)\b/i],
  [
    'paid',
    /\b(?:total\s+)?payments?(?:\s+received)?(?:\s*[-,]?\s*thank\s+you)?\b|\b(?:amount|deposit)\s+paid\b|\bpaid\b|\bless\s+payments?\b/i,
  ],
  ['charges', /\b(?:total\s+)?(?:new|current)\s+charges\b|\bcharges\s+this\s+period\b/i],
  ['discount', /\b(?:discount|savings|coupon|promo(?:tion)?)\b/i],
  ['subtotal', /\bsub[\s-]?total\b/i],
  ['tax', /\b(?:total\s+)?(?:sales\s+)?tax(?:es)?\b/i],
  ['total', /\b(?:grand\s+)?total\b/i],
];
/** Words that make a "payment" line about something else: when, how or where to pay, not money paid. */
const NOT_PAID = /\bpayments?\s+(?:due|date|stub|coupon|address|options?|methods?|by|to|plan|portal|center|terms)\b|\bminimum\b|\bhow\s+to\s+pay\b|\bunpaid\b|\bpast\s+due\b/i;
/** "Tax" that is not an amount of tax. */
const NOT_TAX = /\btax\s+(?:id|exempt|number|no\b|rate)|\b(?:before|pre-?|excl\.?|incl\.?|including|excluding|plus)\s*tax\b/i;

function labelOf(text: string): AmountLabel | null {
  if (/\bpast\s+due\b/i.test(text)) return null;
  for (const [label, re] of LABELS) {
    if (!re.test(text)) continue;
    if (label === 'paid' && NOT_PAID.test(text)) continue;
    if (label === 'tax' && (NOT_TAX.test(text) || (/\btotal\b/i.test(text) && !/\btotal\s+(?:sales\s+)?tax/i.test(text)))) continue;
    return label;
  }
  return null;
}

/**
 * The labelled amounts on the paper: the first one printed under each label wins. Each amount's label is the words
 * between it and the amount before it on the same line, so two columns on one line ("Previous balance $84.20
 * Payments -$84.20") stay apart. A label with no amount after it takes the amount that starts the next line.
 */
export function findAmounts(lines: string[]): Partial<Record<AmountLabel, number>> {
  const out: Partial<Record<AmountLabel, number>> = {};
  const put = (label: AmountLabel | null, value: number) => {
    if (label && !(label in out)) out[label] = label === 'paid' || label === 'discount' ? Math.abs(value) : value;
  };
  lines.forEach((line, i) => {
    const hits = amountsIn(line);
    // A row of column headings with the amounts on the row under it, in the same order:
    // "PREVIOUS BALANCE  PAYMENTS RECEIVED  NEW CHARGES  AMOUNT DUE" / "$84.00 − $84.00 + $89.00 = $89.00".
    if (!hits.length) {
      const cells = line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
      const labels = cells.map(labelOf);
      const next = lines[i + 1] ?? '';
      const below = amountsIn(next);
      if (cells.length >= 2 && labels.every((l) => l) && below.length === cells.length && !/[a-z]/i.test(next)) {
        labels.forEach((l, k) => put(l, below[k].value));
        return;
      }
    }
    let from = 0;
    for (const h of hits) {
      const words = line.slice(from, h.index);
      if (/[a-z]/i.test(words)) put(labelOf(words), h.value);
      from = h.end;
    }
    const rest = line.slice(from);
    const label = /[a-z]/i.test(rest) ? labelOf(rest) : null;
    if (!label || label in out) return;
    const next = (lines[i + 1] ?? '').trim();
    const first = amountsIn(next)[0];
    if (first && !/[a-z]/i.test(next.slice(0, first.index))) put(label, first.value);
  });
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const off = (a: number, b: number) => Math.abs(a - b) > TOLERANCE + 1e-9;

/** Check every relation whose parts are all printed. */
export function checkSums(a: Partial<Record<AmountLabel, number>>): { checked: number; misses: SumMiss[] } {
  const misses: SumMiss[] = [];
  let checked = 0;
  if (a.subtotal !== undefined && a.tax !== undefined && a.total !== undefined) {
    checked++;
    // A discount printed between them comes off the subtotal ("Discount -$188.68").
    const expected = round2(a.subtotal - (a.discount ?? 0) + a.tax);
    if (off(expected, a.total)) misses.push({ rule: 'tax', subtotal: a.subtotal, ...(a.discount ? { discount: a.discount } : {}), tax: a.tax, total: a.total, expected });
  }
  if (a.previous !== undefined && a.paid !== undefined && a.charges !== undefined && a.due !== undefined) {
    checked++;
    const expected = round2(a.previous - a.paid + a.charges);
    if (off(expected, a.due)) misses.push({ rule: 'balance', previous: a.previous, paid: a.paid, charges: a.charges, due: a.due, expected });
  }
  // An invoice paid in part. On a statement with a last bill, "total" is often the new charges: not checked there.
  if (a.previous === undefined && a.total !== undefined && a.paid !== undefined && a.due !== undefined) {
    checked++;
    const expected = round2(a.total - a.paid);
    if (off(expected, a.due)) misses.push({ rule: 'paid', total: a.total, paid: a.paid, due: a.due, expected });
  }
  return { checked, misses };
}

// ---------- account numbers ----------

/** A customer's account number, labelled: "Account: 40-2271-0583", "Account # 1234 5678", "Customer no. 88123". */
const ACCOUNT = new RegExp(
  String.raw`\b(?:account|acct|a\/c|customer|member(?:ship)?)\.?\s*(?:number|no\.?|num|#|id)?\.?\s*(?:ending(?:\s+in)?\s*)?[:#.]?\s*(${D}[${D.slice(1, -1)}\s-]{2,}${D})`,
  'gi',
);
/** A label alone on its line ("ACCOUNT NUMBER"), its number on the next line. */
const ACCOUNT_ALONE = /^\s*(?:your\s+)?(?:account|acct|customer)\s*(?:number|no\.?|num|#|id)?\s*:?\s*$/i;
/** An account that is not the customer's: where money is sent, or the company's own. */
const PAY_TO = /\b(?:new|old|former|formerly|previous|prior|replac(?:es|ed|ing)|instead\s+of|bank|banking|routing|remit|remittance|send|sent|transfer|deposit|wire|iban|our|their|payment|pay(?:ing)?\s+to|payable\s+to|billing\s+account\s+of)\b[^.]{0,25}$/i;

const lastFourOf = (raw: string): string | null => {
  const digits = fixDigits(raw).replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
};

/** The last four digits of each different customer account number, in the order printed. */
export function findAccounts(lines: string[]): string[] {
  const seen: string[] = [];
  const add = (x: string | null) => {
    if (x && !seen.includes(x)) seen.push(x);
  };
  lines.forEach((line, i) => {
    for (const m of line.matchAll(ACCOUNT)) {
      // A line that starts with it may carry on a line above ("Postal remittance" / "acct 84109804"; "New account
      // number — replaces the" / "account ending 4821"). Two lines up, because a column beside it can come between.
      const CARRY = /\b(?:remittance|remit|deposit|transfer|payment|pay\s+to|payable\s+to|replac(?:es|ed|ing)(?:\s+the)?|instead\s+of(?:\s+the)?|old|former|previous|prior)\s*$/i;
      const carried = (m.index ?? 0) < 2 && (CARRY.test(lines[i - 1] ?? '') || CARRY.test(lines[i - 2] ?? ''));
      // A bare "acct 84109804" in running text (a remittance or lockbox account) is not labelled as the customer's.
      const bare = /^(?:acct|a\/c)\.?\s+[0-9OoIl]/i.test(m[0]);
      if (carried || bare || PAY_TO.test(line.slice(0, m.index ?? 0)) || (m[1].match(/\d/g)?.length ?? 0) < 3) continue;
      add(lastFourOf(m[1]));
    }
    if (ACCOUNT_ALONE.test(line)) {
      const next = /^\s*([0-9OoIl][0-9OoIl\s-]{2,}[0-9OoIl])\b/.exec(lines[i + 1] ?? '');
      if (next) add(lastFourOf(next[1]));
    }
  });
  return seen;
}

/**
 * The accounts the paper asks you to pay into, last four digits, in the order printed ("Payment account 3305 7719
 * 4821", "pay to our new account ending 7730"). A member or customer number is not one of them. Same rule as
 * BillMath.payToEndings on the iPhone.
 */
export function payToEndings(lines: string[]): string[] {
  const out: string[] = [];
  // Lines are joined with a mark that a number never spans, so the digits at the end of one line never take
  // letters that look like digits ("l", "O") from the next. Only a label at the end of a line may take the number
  // that starts the next one ("Payment account" / "3305 7719 4821").
  const text = lines.join(' ¦ ');
  const re = new RegExp(String.raw`\b(?:payment|pay to|pay into|remit to|deposit to|transfer to|new)\s+(?:account\s+)?(?:number\s+)?(?:ending\s+(?:in\s+)?)?[:#]?\s*(?:¦\s*)?(${D}[${D.slice(1, -1)} \t-]{2,}${D})`, 'gi');
  for (const m of text.matchAll(re)) {
    // The digits under a barcode ("payment 45405395604430731313") are one unbroken run longer than any account.
    if (m[1].replace(/\D/g, '').length > 17 && !/[\s-]/.test(m[1].trim())) continue;
    const four = lastFourOf(m[1]);
    if (four && !out.includes(four)) out.push(four);
  }
  return out;
}

/** Which of them the bill means: one other than the account paid last time (the change to see), else the first. */
export function payToOf(lines: string[], lastTime?: string | null): string | null {
  const all = payToEndings(lines);
  return (lastTime ? all.find((x) => x !== lastTime) : undefined) ?? all[0] ?? null;
}

// ---------- both ----------

/**
 * Split a paper's words into lines (PDF text and OCR text keep one printed line per text line). A wide gap stays two
 * spaces: it is where one column ends and the next begins (column headings are read by it).
 */
export const toLines = (text: string | string[]): string[] =>
  (Array.isArray(text) ? text : text.split(/\r?\n/))
    .map((l) => l.replace(/[^\S\n]{2,}/g, '  ').replace(/[^\S\n ]/g, ' ').trim())
    .filter(Boolean);

export function billMath(text: string | string[]): BillMath {
  const lines = toLines(text);
  const amounts = findAmounts(lines);
  const { checked, misses } = checkSums(amounts);
  return { amounts, checked, misses, accounts: findAccounts(lines) };
}
