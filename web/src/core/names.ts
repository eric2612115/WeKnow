// Finding people's names in words, on this device, with no model (used by pii.ts, so every path benefits: a PDF's
// text, the text recognizer's words on a picture, an email, a typed question). Three plain rules:
//  1. A common US given name followed by a capitalised surname ("Pat Kowalski", "Pat J. Kowalski", "KOWALSKI, PAT"),
//     or a common given name on its own ("Dear Margaret"). The list is the top 2,000 given names in the Social
//     Security Administration's national baby-name counts, 1930-2016 (firstNames.json, scripts/build-first-names.mjs).
//  2. Two or three capitalised words right next to an address, account, phone or email (same line, or alone on the
//     line just above or below one): how a customer block is printed ("Theodora Quillfeather  Account: 40-2271-0583").
//  3. Words that make a run a business, a place or a heading ("Electric", "Co-op", "Services", "Statement") are never
//     a name, and the first line of a paper (the company's own header) is never taken for one by rule 2.
// Covering a word that was not a name costs little; leaving a name uncovered is the failure this file exists for.

import FIRST_LIST from './firstNames.json';

const FIRST = new Set<string>(FIRST_LIST as string[]);

/** Given names that are also everyday words or places: a name only with a surname after them, never on their own. */
const WORDLIKE = new Set(
  `will may june april august mark bill grant chase rose hope joy faith dawn summer autumn art dale glen page ray guy
  jack frank gene major king prince royal hunter mason carter parker cooper porter tanner taylor baker miles reed wade
  lane cash don max love star angel crystal amber ruby pearl jade sage river ocean stone brook sandy sunny misty rusty
  dusty christian justice precious unique legend nova harmony destiny trinity serenity genesis heaven penny ginger
  candy honey holly ivy daisy lily violet iris willow hazel olive laurel heather cliff rich sonny terry jean early young
  dallas austin houston phoenix denver jordan israel india china georgia carolina virginia kansas dakota montana nevada
  sierra savannah brooklyn london paris memphis tennessee alabama arizona camden easton marion warren clay forest
  sterling august son mercedes lexus kia toyota tesla mac van ford lincoln dodge`.split(/\s+/),
);

/** Words that make a run of capitalised words a business, a place, a heading or a sentence, never a person. */
const NOT_A_NAME = new Set(
  `the a an and or of for to in on at by with from as is are was be been will can may must should please thank thanks
  dear hello hi your you our we us my me i it this that these those here there all any new old due now today soon
  pay paid payment payments amount amounts total subtotal balance previous current charges charge fee fees tax taxes
  credit debit bill billing billed invoice statement account accounts acct number no customer customers member members
  membership holder service services summary details detail notice important date period meter usage plan rate rates
  return remit remittance mail phone call tel fax email web online website page street st avenue ave road rd drive dr
  lane ln court ct way place pl boulevard blvd suite ste box po apt unit floor north south east west january february
  march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec
  monday tuesday wednesday thursday friday saturday sunday co co-op coop cooperative company companies inc llc ltd llp
  corp corporation group partners associates bank banking union financial federal national american united first
  general mutual trust savings loan loans mortgage capital insurance energy electric electricity power gas water light
  utilities utility waste sewer trash recycling mobile wireless communications cable internet broadband telecom fiber
  network medical health healthcare clinic hospital dental pharmacy labs lab laboratory center centre department dept
  city county state district authority board office store shop market supply home homes realty properties property
  management apartments auto motors care repair repairs plumbing heating cooling air hvac roofing construction
  contractors solar propane oil fuel security systems solutions technologies school college university academy church
  club fitness valley hill hills park springs heights plaza lake creek bay beach village town township metro regional
  community public card visa mastercard express gold platinum rewards points residential commercial business personal
  stub coupon copy keep detach portion receipt reference ref order quote estimate job work labor parts total amount
  contact support help desk team staff manager director president department secretary treasurer collections
  collection agency legal law attorney attorneys court notice final past overdue late reminder action required
  immediately urgent warning alert security fraud verify verification update updated change changed transfer wire
  routing iban swift direct deposit autopay automatic check checks money order cash`.split(/\s+/),
);

const lower = (w: string) => w.toLowerCase().replace(/[.’']+$/g, '');
const isCap = (w: string) => /^[A-Z]/.test(w);
const isInitial = (w: string) => /^[A-Z]\.?$/.test(w);
const nameWord = (w: string) => isCap(w) && w.replace(/[^A-Za-z]/g, '').length >= 2 && !NOT_A_NAME.has(lower(w)) && !/\d/.test(w);
const firstName = (w: string) => isCap(w) && FIRST.has(lower(w)) && !NOT_A_NAME.has(lower(w));
/** A given name that is also an everyday word ("Bill", "June", "Grant"): a name only before a real surname. */
const wordlike = (w: string) => WORDLIKE.has(lower(w)) || NOT_A_NAME.has(lower(w));
/** Endings of everyday nouns and verbs that are rarely surnames ("Grant Application", "Will Pending"). */
const WORD_ENDING = /(?:tion|sion|ment|ness|ance|ence|ity|ing|ive|ure|ery|ary|able|ible|ful|less)$/i;

export interface NameSpan {
  start: number;
  end: number;
}

interface Word {
  w: string;
  start: number;
  end: number;
}

const WORD = /[A-Za-z][A-Za-z'’]*(?:-[A-Za-z][A-Za-z'’]*)*\.?/g;
const words = (text: string): Word[] => [...text.matchAll(WORD)].map((m) => ({ w: m[0], start: m.index ?? 0, end: (m.index ?? 0) + m[0].length }));
/** Only spaces or tabs (no line break, no punctuation) between two words. */
const spaced = (text: string, a: Word, b: Word) => /^[ \t]+$/.test(text.slice(a.end, b.start));

/** Rule 1: a given name from the list, with a surname (or on its own when it is not also an everyday word). */
function listedNames(text: string, ws: Word[]): NameSpan[] {
  const out: NameSpan[] = [];
  for (let i = 0; i < ws.length; i++) {
    const a = ws[i];
    // "KOWALSKI, PAT" / "Kowalski, Pat"
    const b = ws[i + 1];
    if (b && nameWord(a.w) && !FIRST.has(lower(a.w)) && /^,[ \t]*$/.test(text.slice(a.end, b.start)) && firstName(b.w) && !WORDLIKE.has(lower(b.w))) {
      out.push({ start: a.start, end: b.end });
      i++;
      continue;
    }
    if (!isCap(a.w) || !FIRST.has(lower(a.w))) continue;
    let j = i + 1;
    if (ws[j] && isInitial(ws[j].w) && spaced(text, ws[j - 1], ws[j])) j++;
    const last = ws[j];
    if (last && spaced(text, ws[j - 1], last) && nameWord(last.w) && !isInitial(last.w) && !(wordlike(a.w) && WORD_ENDING.test(last.w))) {
      out.push({ start: a.start, end: last.end });
      i = j;
      continue;
    }
    if (!firstName(a.w)) continue;
    // On its own ("Dear Margaret,"): not an everyday word, not before a business word ("Austin Energy").
    const next = ws[i + 1];
    const beforeBusiness = !!next && spaced(text, a, next) && NOT_A_NAME.has(lower(next.w)) && isCap(next.w);
    if (!WORDLIKE.has(lower(a.w)) && a.w.replace(/\W/g, '').length >= 3 && !beforeBusiness) out.push({ start: a.start, end: a.end });
  }
  return out;
}

/** Two or three capitalised name-like words in a row, as [start, end) runs, longest first from each position. */
function capRuns(text: string, ws: Word[]): Array<NameSpan & { n: number }> {
  const out: Array<NameSpan & { n: number }> = [];
  for (let i = 0; i < ws.length; i++) {
    if (!nameWord(ws[i].w)) continue;
    let j = i;
    while (j + 1 < ws.length && j - i < 2 && nameWord(ws[j + 1].w) && /^[ \t]{1,2}$/.test(text.slice(ws[j].end, ws[j + 1].start))) j++;
    if (j > i) out.push({ start: ws[i].start, end: ws[j].end, n: j - i + 1 });
  }
  return out;
}

/** Rule 2: a capitalised run right next to an address, account, phone or email, or alone on the line by one. */
function besideDetails(text: string, ws: Word[], anchors: NameSpan[]): NameSpan[] {
  if (!anchors.length) return [];
  const out: NameSpan[] = [];
  const runs = capRuns(text, ws);
  // Only spaces or punctuation between, or the detail's own label ("Theodora Quillfeather Account: [card]").
  const gapOk = (s: string) =>
    /^[ \t,:;]{0,3}(?:(?:account|acct|a\/c|phone|tel|telephone|mobile|cell|email|e-mail|address)\b\.?[ \t]*(?:number|no\.?|#)?[ \t]*[:#]?[ \t]*)?$/i.test(s);
  for (const r of runs) {
    if (anchors.some((a) => (a.start >= r.end && gapOk(text.slice(r.end, a.start))) || (a.end <= r.start && gapOk(text.slice(a.end, r.start))))) out.push(r);
  }
  // Alone on its line (or alone in its column), with a detail on the line just above or below.
  const lines: Array<{ start: number; end: number }> = [];
  let at = 0;
  for (const l of text.split('\n')) {
    lines.push({ start: at, end: at + l.length });
    at += l.length + 1;
  }
  const header = lines.findIndex((l) => text.slice(l.start, l.end).trim());
  const hasAnchor = (k: number) => k >= 0 && k < lines.length && anchors.some((a) => a.start < lines[k].end && a.end > lines[k].start);
  lines.forEach((l, k) => {
    if (k === header && lines.length > 1) return;
    if (!hasAnchor(k - 1) && !hasAnchor(k + 1)) return;
    const line = text.slice(l.start, l.end);
    let col = 0;
    for (const part of line.split(/(\s{2,}|\t)/)) {
      const s = l.start + col + (part.length - part.trimStart().length);
      const e = l.start + col + part.trimEnd().length;
      col += part.length;
      if (!part.trim()) continue;
      const run = runs.find((r) => r.start === s && r.end === e);
      if (run) out.push({ start: s, end: e });
    }
  });
  return out;
}

/** Every name the rules find in `text`. `anchors`: where addresses, accounts, phones and emails are (found or covered). */
export function nameSpans(text: string, anchors: NameSpan[]): NameSpan[] {
  const ws = words(text);
  return [...listedNames(text, ws), ...besideDetails(text, ws, anchors)];
}

/** Given names from the list still in `text` (for the payload guard). */
export function listedNamesIn(text: string): string[] {
  return listedNames(text, words(text)).map((s) => text.slice(s.start, s.end));
}
