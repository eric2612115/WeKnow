import { describe, expect, it } from 'vitest';
import { hasRealText, isPdf, linesOf, type TextPiece } from '../pdf';
import { billMath } from '../core/billMath';

// Text pieces as pdf.js gives them for the Riverbend test bill (positions from the real file: x, baseline y, size).
const at = (str: string, x: number, y: number, size: number, width = str.length * size * 0.5): TextPiece => ({ str, transform: [size, 0, 0, size, x, y], width, height: size });
const riverbend: TextPiece[] = [
  at('Riverbend Electric Co-op', 40, 731, 24),
  at('STATEMENT', 455, 734, 16),
  at('ACCOUNT HOLDER', 40, 649, 10),
  at('MEMBERSHIP', 317, 649, 10),
  at('Theodora Quillfeather', 40, 632, 13),
  at('Account: 40-2271-0583', 317, 632, 13),
  at('Amount due', 57, 407, 15),
  at('Due', 529, 402, 15),
  at('$90.75', 57, 383, 24),
  at(' ', 140, 383, 24),
  at('Within 24 hours', 430, 386, 15),
  at('Basic service charge', 44, 299, 16),
  at('$18.00', 519, 299, 16),
  at('Total due', 44, 185, 17),
  at('$90.75', 509, 185, 17),
];

describe('a PDF’s own text, back into printed lines', () => {
  it('puts pieces on one baseline into one line, left to right, columns apart', () => {
    expect(linesOf(riverbend)).toEqual([
      'Riverbend Electric Co-op  STATEMENT',
      'ACCOUNT HOLDER  MEMBERSHIP',
      'Theodora Quillfeather  Account: 40-2271-0583',
      'Amount due  Due',
      '$90.75  Within 24 hours',
      'Basic service charge  $18.00',
      'Total due  $90.75',
    ]);
  });

  it('feeds the bill checks: one account number, nothing to add up', () => {
    const m = billMath(linesOf(riverbend));
    expect(m.amounts).toEqual({ due: 90.75 });
    expect(m.accounts).toEqual(['0583']);
    expect(m.misses).toEqual([]);
  });

  it('joins pieces of one word without a space, and words with one', () => {
    expect(linesOf([at('Pay', 10, 100, 10, 15), at('ment', 25, 100, 10, 20), at('due', 48, 100, 10, 15)])).toEqual(['Payment due']);
  });

  it('a scan has no real text; a bill does', () => {
    expect(hasRealText('')).toBe(false);
    expect(hasRealText(' 1 . \n -- ')).toBe(false);
    expect(hasRealText(linesOf(riverbend).join('\n'))).toBe(true);
  });

  it('knows a PDF by its type, or by its name when the type is missing', () => {
    expect(isPdf({ type: 'application/pdf', name: 'bill' })).toBe(true);
    expect(isPdf({ type: '', name: 'Bill.PDF' })).toBe(true);
    expect(isPdf({ type: 'image/png', name: 'x.pdf' })).toBe(false);
  });
});
