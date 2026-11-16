import { describe, expect, it } from 'vitest';
import { coverPaperText } from '../paperText';
import { findPII } from '../pii';

// The Riverbend test bill's own text, as src/pdf.ts puts it back into lines (fictional names and numbers).
const RIVERBEND = [
  'Riverbend Electric Co-op  STATEMENT',
  '1400 Millrace Rd, Riverbend, OR 97380  November 12, 2026',
  'Member services (541) 555-0110',
  'ACCOUNT HOLDER  MEMBERSHIP',
  'Theodora Quillfeather  Account: 40-2271-0583',
  '512 Bramble Ct, Riverbend, OR  Service: residential',
  'theodora.q@example.com  Meter 0098-4417',
  'Important: our bank has changed.',
  'Amount due  Due',
  '$90.75  Within 24 hours',
  'Total due  $90.75',
].join('\n');

describe('covering a paper’s words', () => {
  it('covers a name printed under its label, as well as every pattern', () => {
    const c = coverPaperText(RIVERBEND);
    for (const secret of ['Theodora', 'Quillfeather', '40-2271-0583', 'theodora.q@example.com', '555-0110', '1400 Millrace Rd', '512 Bramble Ct']) expect(c.text).not.toContain(secret);
    expect(c.text).toContain('[name]');
    expect(findPII(c.text)).toEqual([]);
    expect(c.counts.name).toBe(1);
    // What a bill is judged on stays: the company, the amounts, the notice.
    expect(c.text).toContain('Riverbend Electric Co-op');
    expect(c.text).toContain('$90.75');
    expect(c.text).toContain('our bank has changed');
  });

  it('a name under a label on its own line, and in the label’s column', () => {
    expect(coverPaperText('CUSTOMER\nWendell Farthingale\nTotal $10.00').text).toBe('CUSTOMER\n[name]\nTotal $10.00');
    expect(coverPaperText('Invoice  Bill to\nApril 2026  Pat Kowalski').text).toBe('Invoice  Bill to\nApril 2026  [name]');
  });

  it('leaves lines with no label above alone', () => {
    expect(coverPaperText('Riverbend Electric Co-op\nNorthfield Water Services').text).toBe('Riverbend Electric Co-op\nNorthfield Water Services');
  });
});
