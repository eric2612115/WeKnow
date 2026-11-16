// Covering a picture before it may be sent: from a stubbed text-recognition result (words with their boxes) to the
// rectangles that are painted black. No recognizer runs here; the words and boxes are hand-written.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { coverDetails, coveredCounts, type Box, type CoveredDetail, type OcrLine, type OcrWord } from '../cover';
import { findPII } from '../pii';

const CH = 10; // width of one character
const H = 20; // height of one line of print

/** One printed line: runs of words starting at the given x positions, on the line whose top is y. */
function line(y: number, ...runs: Array<[x: number, text: string]>): OcrLine {
  const words: OcrWord[] = [];
  for (const [x0, text] of runs) {
    let x = x0;
    for (const w of text.split(' ')) {
      const bbox = { x0: x, y0: y, x1: x + w.length * CH, y1: y + H };
      const symbols = [...w].map((c, i) => ({ text: c, bbox: { x0: x + i * CH, y0: y, x1: x + (i + 1) * CH, y1: y + H } }));
      words.push({ text: w, bbox, symbols });
      x += (w.length + 1) * CH;
    }
  }
  return { words };
}
const words = (lines: OcrLine[]) => lines.flatMap((l) => l.words);
const find = (lines: OcrLine[], text: string) => words(lines).find((w) => w.text === text)!;

/** Is this box wholly under one of the detail's rectangles? */
const coveredBy = (b: Box, ds: CoveredDetail[]) =>
  ds.some((d) => d.rects.some((r) => r.x <= b.x0 && r.y <= b.y0 && r.x + r.w >= b.x1 && r.y + r.h >= b.y1));
const anyOverlap = (b: Box, ds: CoveredDetail[]) =>
  ds.some((d) => d.rects.some((r) => r.x < b.x1 && r.x + r.w > b.x0 && r.y < b.y1 && r.y + r.h > b.y0));
/** The words as they are left readable: every character under a bar becomes a block. */
function visible(lines: OcrLine[], ds: CoveredDetail[]): string {
  return lines
    .map((l) =>
      l.words
        .map((w) => (w.symbols ?? []).map((s) => (coveredBy(s.bbox, ds) ? '█' : s.text)).join(''))
        .join(' '),
    )
    .join('\n');
}

// A quote and a bill laid out like the test sheets: two columns, labels in small capitals above the values.
const quote = [
  line(100, [100, 'Tidewell Auto Care']),
  line(130, [100, '2290 Gristmill Rd, Fernhollow, OR 97399']),
  line(200, [100, 'CUSTOMER'], [450, 'VEHICLE']),
  line(225, [100, 'Wendell Farthingale'], [450, '2019 four-door sedan']),
  line(250, [100, '61 Larkspur Ln, Fernhollow, OR'], [450, 'Plate: 7KTR582']),
  line(275, [100, '(503) 555-0186'], [450, 'VIN OTS4E8K21PW3OO417']),
  line(300, [100, 'w.farthingale@example.com']),
  line(360, [100, 'Front brake pads replacement'], [600, '$494.00']),
  line(400, [100, 'Service advisor: Corbin Allwright']),
];
const bill = [
  line(200, [100, 'ACCOUNT HOLDER'], [450, 'MEMBERSHIP']),
  line(225, [100, 'Theodora Quillfeather'], [450, 'Account: 40-2271-0583']),
  line(250, [100, 'Bill to:'], [450, 'Service: residential']),
  line(275, [100, 'Harold Brooks']),
  line(320, [100, 'Send this payment to our new account number ending 7730.']),
];

describe('covering personal details on a picture', () => {
  it('covers a name printed under its label, and only the name', () => {
    const ds = coverDetails(quote, { width: 860, pad: 0 });
    expect(coveredBy(find(quote, 'Wendell').bbox, ds)).toBe(true);
    expect(coveredBy(find(quote, 'Farthingale').bbox, ds)).toBe(true);
    for (const w of ['CUSTOMER', 'VEHICLE', '2019', 'Tidewell', 'Front', '$494.00']) expect(anyOverlap(find(quote, w).bbox, ds), w).toBe(false);

    const bs = coverDetails(bill, { width: 860, pad: 0 });
    for (const w of ['Theodora', 'Quillfeather', 'Harold', 'Brooks']) expect(coveredBy(find(bill, w).bbox, bs), w).toBe(true);
    for (const w of ['ACCOUNT', 'HOLDER', 'MEMBERSHIP', 'residential']) expect(anyOverlap(find(bill, w).bbox, bs), w).toBe(false);
  });

  it('covers a name after a label on the same line, and leaves the label readable', () => {
    const ds = coverDetails(quote, { width: 860, pad: 0 });
    expect(coveredBy(find(quote, 'Corbin').bbox, ds)).toBe(true);
    expect(coveredBy(find(quote, 'Allwright').bbox, ds)).toBe(true);
    expect(anyOverlap(find(quote, 'advisor:').bbox, ds)).toBe(false);
  });

  it('covers phones, emails, street addresses, plates and a VIN read with O for 0', () => {
    const ds = coverDetails(quote, { width: 860, pad: 0 });
    for (const w of ['(503)', '555-0186', 'w.farthingale@example.com', '61', 'Larkspur', '7KTR582', 'OTS4E8K21PW3OO417', '2290', 'Gristmill'])
      expect(coveredBy(find(quote, w).bbox, ds), w).toBe(true);
    // The labels stay readable, so the reader still knows what the covered thing was.
    for (const w of ['Plate:', 'VIN']) expect(anyOverlap(find(quote, w).bbox, ds), w).toBe(false);
    expect(coveredCounts(ds)).toEqual({ name: 2, street: 2, phone: 1, email: 1, plate: 1, vin: 1 });
  });

  it('covers an account number but keeps its last four digits, as the iPhone does', () => {
    const ds = coverDetails(bill, { width: 860, pad: 0 });
    const v = visible(bill, ds);
    expect(v).toContain('Account: ████████0583');
    // Only the last four printed: kept as it is, like the iPhone's "[account ending 7730]".
    expect(v).toContain('new account number ending 7730.');
    expect(coveredCounts(ds)).toEqual({ name: 2, account: 1 });
  });

  it('scales the rectangles to the picture that is sent and pads them', () => {
    const one = [line(10, [10, 'Call (503) 555-0186'])];
    const [d] = coverDetails(one, { width: 400, scale: 0.5, pad: 0.25 });
    expect(d.kind).toBe('phone');
    // "(503)" starts at x 60, 20 px tall: padded by 5 above and below and 2.5 at the sides, then halved.
    expect(d.rects[0]).toEqual({ x: 28.75, y: 2.5, w: 27.5, h: 15 });
  });

  it('without the symbol boxes, covers a share of the word', () => {
    const one = [line(10, [10, 'Acct 1234567890'])];
    for (const w of one[0].words) delete w.symbols;
    const [d] = coverDetails(one, { width: 400, pad: 0 });
    const num = one[0].words[1].bbox;
    expect(d.rects).toEqual([{ x: num.x0, y: num.y0, w: 6 * CH, h: H }]);
  });

  it('covers a tradesperson named after their role, but not the empty signature line', () => {
    const sig = [line(10, [100, 'Electrician: Marisol Venwick'], [450, 'Customer approval']), line(40, [100, 'Accepted by'])];
    const ds = coverDetails(sig, { width: 860, pad: 0 });
    expect(coveredCounts(ds)).toEqual({ name: 1 });
    expect(coveredBy(find(sig, 'Marisol').bbox, ds)).toBe(true);
    expect(coveredBy(find(sig, 'Venwick').bbox, ds)).toBe(true);
    for (const w of ['Electrician:', 'Customer', 'approval', 'Accepted']) expect(anyOverlap(find(sig, w).bbox, ds), w).toBe(false);
  });

  it('an email the recognizer split at its @ is still covered whole', () => {
    const one = [line(10, [10, '(503) 555-0147 - tidewell.service @example.com'])];
    const ds = coverDetails(one, { width: 860, pad: 0 });
    expect(coveredCounts(ds)).toEqual({ phone: 1, email: 1 });
    expect(coveredBy(find(one, 'tidewell.service').bbox, ds)).toBe(true);
    expect(coveredBy(find(one, '@example.com').bbox, ds)).toBe(true);
  });

  it('nothing to cover: no text, or text without personal details', () => {
    expect(coverDetails([], { width: 860 })).toEqual([]);
    expect(coverDetails([line(10, [10, 'Brake fluid flush $139.00'])], { width: 860 })).toEqual([]);
  });

  it('whatever personal detail is printed, what is left readable has none', () => {
    const digits = (n: number) => fc.array(fc.integer({ min: 0, max: 9 }), { minLength: n, maxLength: n }).map((a) => a.join(''));
    const word = fc.constantFrom('brake', 'pads', 'labor', 'rear', 'rotor', 'drain', 'service', 'fee', 'Total', '$120.00');
    const phrase = fc.array(word, { minLength: 1, maxLength: 4 }).map((w) => w.join(' '));
    const pii = fc.oneof(
      fc.tuple(fc.constantFrom('ann', 'bo.lee', 'x_y'), fc.constantFrom('mail.com', 'shop.us')).map(([a, b]) => `${a}@${b}`),
      fc.tuple(digits(3), digits(3), digits(4)).map(([a, b, c]) => `(${a}) ${b}-${c}`),
      fc.tuple(digits(3), digits(3), digits(4)).map(([a, b, c]) => `${a}-${b}-${c}`),
      fc.tuple(digits(3), digits(2), digits(4)).map(([a, b, c]) => `${a}-${b}-${c}`),
      digits(16).map((d) => d.replace(/(\d{4})(?=\d)/g, '$1 ')),
      digits(10).map((d) => `Account # ${d}`),
      fc.integer({ min: 1, max: 99999 }).map((n) => `${n} Maple Street`),
      fc.constant('VIN 1HGCM82633A004352'),
      fc.constant('VIN 1HGCM82633AOO4352'),
      fc.constant('Plate: 7ABC123'),
      fc.constant('Customer: Margaret Ellis'),
    );
    fc.assert(
      fc.property(phrase, pii, phrase, (a, p, b) => {
        const ls = [line(10, [10, `${a} ${p} ${b}`])];
        const ds = coverDetails(ls, { width: 2000, pad: 0 });
        const left = visible(ls, ds);
        expect(findPII(left)).toEqual([]);
        expect(left.includes(p)).toBe(false);
      }),
      { numRuns: 400 },
    );
  });
});
