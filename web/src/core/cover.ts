// Which parts of a picture to cover before it may be sent: plain code over the words a text recognizer found on
// this device. The rules are the personal-data rules in pii.ts, run over each run of words, plus one rule a
// pattern cannot see: a name printed on the line under its label ("CUSTOMER" above "Wendell Farthingale").
// The result is rectangles in picture pixels; drawing them is the caller's job (cover.ts next to the app).

import { LOOKS_LIKE_NAME, NAME_LABEL_ONLY, piiSpans, type PIIKind } from './pii';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface OcrSymbol {
  text: string;
  bbox: Box;
}
export interface OcrWord {
  text: string;
  bbox: Box;
  symbols?: OcrSymbol[];
}
export interface OcrLine {
  words: OcrWord[];
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** One personal detail and the rectangles that cover it (a phone over two words is one detail, two rectangles). */
export interface CoveredDetail {
  kind: PIIKind;
  rects: Rect[];
}

/** A run of words on one line with no wide gap: one cell of a table or one column of a form. */
interface Run {
  words: OcrWord[];
  text: string;
  starts: number[];
  box: Box;
  h: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};
const toRect = (b: Box): Rect => ({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 });
const union = (bs: Box[]): Box => ({
  x0: Math.min(...bs.map((b) => b.x0)),
  y0: Math.min(...bs.map((b) => b.y0)),
  x1: Math.max(...bs.map((b) => b.x1)),
  y1: Math.max(...bs.map((b) => b.y1)),
});

function runsOf(lines: OcrLine[]): Run[] {
  const out: Run[] = [];
  for (const line of lines) {
    const words = line.words.filter((w) => w.text.trim()).sort((a, b) => a.bbox.x0 - b.bbox.x0);
    if (!words.length) continue;
    const h = median(words.map((w) => w.bbox.y1 - w.bbox.y0)) || 1;
    let cur: OcrWord[] = [];
    const flush = () => {
      if (!cur.length) return;
      const starts: number[] = [];
      let text = '';
      for (const w of cur) {
        const word = w.text.trim();
        // Recognizers split an email at its @ ("w.farthingale @example.com"): put it back together.
        if (text && !text.endsWith('@') && !word.startsWith('@')) text += ' ';
        starts.push(text.length);
        text += word;
      }
      out.push({ words: cur, text, starts, box: union(cur.map((w) => w.bbox)), h });
      cur = [];
    };
    for (const w of words) {
      const prev = cur[cur.length - 1];
      if (prev && w.bbox.x0 - prev.bbox.x1 > 1.6 * h) flush();
      cur.push(w);
    }
    flush();
  }
  return out;
}

/** The part of one word between characters [a, b): its symbols' boxes when the recognizer gave them, else a share of its width. */
function partOf(w: OcrWord, a: number, b: number): Box {
  const text = w.text.trim();
  // What would stay readable is only punctuation ("Way," or "(503"): cover the whole word.
  if (!/[A-Za-z0-9]/.test(text.slice(0, a))) a = 0;
  if (!/[A-Za-z0-9]/.test(text.slice(b))) b = text.length;
  if (a <= 0 && b >= text.length) return w.bbox;
  const syms = w.symbols?.filter((s) => s.text.trim());
  if (syms && syms.length === text.length) {
    // Character boxes from a line recognizer can be narrow: cover up to where the first readable character starts.
    const x0 = a <= 0 ? w.bbox.x0 : Math.min(syms[a].bbox.x0, syms[a - 1].bbox.x1);
    const x1 = b >= text.length ? w.bbox.x1 : Math.max(syms[b].bbox.x0, syms[b - 1].bbox.x1);
    return { x0, y0: w.bbox.y0, x1, y1: w.bbox.y1 };
  }
  const per = (w.bbox.x1 - w.bbox.x0) / Math.max(1, text.length);
  return { x0: w.bbox.x0 + per * a, y0: w.bbox.y0, x1: w.bbox.x0 + per * b, y1: w.bbox.y1 };
}

/** The boxes covering characters [a, b) of a run. */
function boxesFor(run: Run, a: number, b: number): Box[] {
  const out: Box[] = [];
  run.words.forEach((w, i) => {
    const ws = run.starts[i];
    const we = ws + w.text.trim().length;
    const s = Math.max(a, ws);
    const e = Math.min(b, we);
    if (s < e) out.push(partOf(w, s - ws, e - ws));
  });
  return out;
}

const LABEL_PREFIX: Partial<Record<PIIKind, RegExp>> = {
  account: /^(?:acct|account|routing|aba|iban|a\/c)\b[#:\s.-]*/i,
  plate: /^(?:plate|lic(?:ense)?\.?\s*(?:no|#)?)\b[#:\s.-]*/i,
};

/**
 * The characters of a span to cover. The printed label stays readable ("Account:", "Plate:"). An account number keeps
 * its last four digits, the same fingerprint the iPhone keeps ("account ending 0583") and the bill rules use to tell
 * a changed account: a number of eight or more digits is covered up to them, one of five to seven is covered whole,
 * and "account number ending 7730" (only the last four printed) stays as it is. Everything else is covered.
 */
function coverRange(kind: PIIKind, text: string, start: number, end: number): [number, number] | null {
  let a = start;
  const label = LABEL_PREFIX[kind]?.exec(text.slice(start, end));
  if (label) a += label[0].length;
  let b = end;
  if (kind === 'account') {
    const digits: number[] = [];
    for (let i = a; i < end; i++) if (/\d/.test(text[i])) digits.push(i);
    if (digits.length <= 4) return null;
    // Words before the number ("number ending") are not the number.
    const floor = a;
    a = digits[0];
    while (a > floor && /\S/.test(text[a - 1])) a--;
    if (digits.length >= 8) b = digits[digits.length - 4];
  }
  return a < b ? [a, b] : null;
}

/** A name on the line under a name label, in the label's column. */
function namesUnderLabels(runs: Run[], pageWidth: number): CoveredDetail[] {
  const out: CoveredDetail[] = [];
  for (const label of runs) {
    if (!NAME_LABEL_ONLY.test(label.text.trim())) continue;
    const h = label.box.y1 - label.box.y0 || label.h;
    const tol = Math.max(0.05 * pageWidth, 2 * h);
    const below = runs
      .filter(
        (r) =>
          r !== label &&
          r.box.y0 >= label.box.y1 - 0.3 * h &&
          r.box.y0 - label.box.y1 < 2.5 * Math.max(h, r.h) &&
          Math.abs(r.box.x0 - label.box.x0) < tol,
      )
      .sort((p, q) => p.box.y0 - q.box.y0)[0];
    if (!below) continue;
    // The longest run of two to four leading words that looks like a name.
    for (let n = Math.min(4, below.words.length); n >= 2; n--) {
      const words = below.words.slice(0, n);
      const text = words.map((w) => w.text.trim()).join(' ');
      if (LOOKS_LIKE_NAME.test(text) && !/\d/.test(text)) {
        out.push({ kind: 'name', rects: words.map((w) => toRect(w.bbox)) });
        break;
      }
    }
  }
  return out;
}

export interface CoverOptions {
  /** Width of the picture the boxes are in, for the label-column tolerance. */
  width: number;
  /** Multiply every box by this (recognised on a larger copy, drawn on the picture that is sent). */
  scale?: number;
  /** Extra cover around each box, as a share of its height. */
  pad?: number;
}

/** Every personal detail on the picture, with the rectangles that cover it, in picture pixels (scaled and padded). */
export function coverDetails(lines: OcrLine[], o: CoverOptions): CoveredDetail[] {
  const runs = runsOf(lines);
  const details: CoveredDetail[] = [];
  for (const run of runs) {
    for (const span of piiSpans(run.text)) {
      const range = coverRange(span.kind, run.text, span.start, span.end);
      if (!range) continue;
      const boxes = boxesFor(run, range[0], range[1]);
      if (boxes.length) details.push({ kind: span.kind, rects: boxes.map(toRect) });
    }
  }
  details.push(...namesUnderLabels(runs, o.width));
  const k = o.scale ?? 1;
  const pad = o.pad ?? 0.2;
  return details.map((d) => ({
    kind: d.kind,
    rects: d.rects.map((r) => {
      // Half as much at the sides, so a kept last four stays readable next to the bar.
      const py = pad > 0 ? Math.max(2, r.h * pad) : 0;
      const px = py / 2;
      return { x: (r.x - px) * k, y: (r.y - py) * k, w: (r.w + 2 * px) * k, h: (r.h + 2 * py) * k };
    }),
  }));
}

/** How many details of each kind were covered. */
export function coveredCounts(details: CoveredDetail[]): Partial<Record<PIIKind, number>> {
  const out: Partial<Record<PIIKind, number>> = {};
  for (const d of details) out[d.kind] = (out[d.kind] ?? 0) + 1;
  return out;
}
