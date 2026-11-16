// People's names on bills, letters and emails, covered on the device (core/names.ts through core/pii.ts).
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import FIRST from '../firstNames.json';
import { findPII, maskText, piiSpans } from '../pii';
import { buildCloudQuestion, CloudPayloadError } from '../cloudPayload';
import { listedNamesIn } from '../names';

// The Riverbend test bill's own text, exactly as src/pdf.ts takes it out of
// BuildHybridAI-2026/film/props/test-sheets/bill-b-riverbend-changed-account.pdf (fictional names and numbers).
const BILL_B = [
  'Riverbend Electric Co-op  STATEMENT',
  '1400 Millrace Rd, Riverbend, OR 97380  November 12, 2026',
  'Member services (541) 555-0110',
  'ACCOUNT HOLDER  MEMBERSHIP',
  'Theodora Quillfeather  Account: 40-2271-0583',
  '512 Bramble Ct, Riverbend, OR  Service: residential',
  'theodora.q@example.com  Meter 0098-4417',
  'Important: our bank has changed.',
  'Send this payment to our new account number ending 7730. Payments to',
  'the old account ending 4821 will be returned. Pay within 24 hours to',
  'avoid disconnection.',
  'Amount due  Due',
  '$90.75  Within 24 hours',
  'CHARGES THIS PERIOD (OCT 9 – NOV 8)  AMOUNT',
  'Basic service charge  $18.00',
  'Energy charge, 612 kWh at $0.112  $68.54',
  'Grid maintenance fee  $4.21',
  'Total due  $90.75',
  'How to pay',
  'Bank transfer to Riverbend Electric Co-op, bank account ending 7730. Routing',
  'details: call (541) 555-0199.',
  'All names and numbers on this page are fictional test data.',
].join('\n');

describe('the Riverbend bill', () => {
  it('covers the customer’s name though no label sits beside it, and keeps the company and the bill', () => {
    const m = maskText(BILL_B);
    expect(m).not.toMatch(/Theodora|Quillfeather/);
    expect(m).toContain('[name]');
    expect(findPII(m)).toEqual([]);
    for (const kept of ['Riverbend Electric Co-op', 'our bank has changed', '$90.75', 'Total due', 'Basic service charge', 'Member services'])
      expect(m).toContain(kept);
  });

  it('the same in one line, as an email’s covered words are sent', () => {
    expect(maskText(BILL_B.replace(/\s+/g, ' '))).not.toMatch(/Theodora|Quillfeather/);
  });
});

describe('rule 1: a listed given name with a surname', () => {
  const first = fc.constantFrom(...(FIRST as string[]).filter((n) => n.length >= 2));
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const surname = fc
    .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz'.split('')), { minLength: 4, maxLength: 10 })
    .map((a) => cap(a.join('')))
    // Everyday-noun endings after an everyday-word name ("Grant Application") are left alone by design.
    .filter((s) => !/(?:tion|sion|ment|ness|ance|ence|ity|ing|ive|ure|ery|ary|able|ible|ful|less)$/.test(s));
  const around = fc.constantFrom('Please call', 'Statement for', 'Dear', 'From the desk of', 'Prepared by', 'Thank you,', 'Total due $12.40.');

  it('covers generated first + last names, with or without a middle initial, in any case', () => {
    fc.assert(
      fc.property(first, surname, fc.boolean(), fc.boolean(), around, around, (f, l, initial, upper, a, b) => {
        let name = `${cap(f)}${initial ? ' Q.' : ''} ${l}`;
        if (upper) name = name.toUpperCase();
        const masked = maskText(`${a} ${name} ${b}`);
        expect(masked).not.toContain(l);
        expect(masked).not.toContain(upper ? l.toUpperCase() : l);
        expect(findPII(masked)).toEqual([]);
      }),
      { numRuns: 400 },
    );
  });

  it('a given name that is also a word, before a surname ("Bill Hayes", "June Carter")', () => {
    expect(maskText('Bill Hayes, 12 Larch St')).toBe('[name], [street]');
    expect(maskText('Statement for June Carter')).toBe('Statement for [name]');
  });

  it('"Last, First" as a statement prints it', () => {
    expect(maskText('KOWALSKI, PATRICIA  Due 12/05')).toBe('[name]  Due 12/05');
  });

  it('a given name on its own ("Dear Margaret,")', () => {
    expect(maskText('Dear Margaret, your bill is ready.')).toBe('Dear [name], your bill is ready.');
  });

  it('never a business, a heading or an everyday word', () => {
    for (const s of [
      'Austin Energy',
      'Riverbend Electric Co-op',
      'Customer Service',
      'Bill Payment Center',
      'Will you pay it today?',
      'May 12, 2026',
      'Grant Application',
      'Charlotte Water Department',
      'Thank you for your payment.',
    ])
      expect(maskText(s), s).toBe(s);
  });
});

describe('rule 2: a capitalised run printed next to an address, account, phone or email', () => {
  it('covers the run before or after the detail, and on the line above or below it', () => {
    expect(maskText('Wren Ashcombe-Lyle (503) 555-0186')).toBe('[name] [phone]');
    expect(maskText('Call (503) 555-0186  Odalys Fenwright')).toBe('Call [phone]  [name]');
    expect(maskText('Account 3301-4478-1234')).toBe('[account]');
    expect(maskText('Sunrise Gas\nOdalys Fenwright\n12 Larch St')).toBe('Sunrise Gas\n[name]\n[street]');
  });

  it('never the paper’s own header, nor a business line beside a detail', () => {
    expect(maskText('Lakeside Gas & Power\n88 Willow Ln, Lakeside')).toBe('Lakeside Gas & Power\n[street], Lakeside');
    expect(maskText('Customer Service (800) 555-1234')).toBe('Customer Service [phone]');
    expect(maskText('Northfield Water Services\n200 Mill Rd')).toBe('Northfield Water Services\n[street]');
  });
});

describe('the payload guard refuses any listed given name left in the words', () => {
  it('a question still holding a name is not sent', () => {
    expect(() => buildCloudQuestion({ text: 'my plumber Gregory Halvorsen charged me 400' })).toThrow(CloudPayloadError);
    expect(() => buildCloudQuestion({ text: 'ask Margaret about the drain' })).toThrow(CloudPayloadError);
    expect(listedNamesIn('ask Margaret about the drain')).toEqual(['Margaret']);
    expect(buildCloudQuestion({ text: maskText('ask Margaret about the drain') })).toEqual({ text: 'ask [name] about the drain' });
  });

  it('the picture cover finds the same names in the recognizer’s words', () => {
    expect(piiSpans('Theodora Quillfeather  Account: 40-2271-0583').map((s) => s.kind)).toEqual(['name', 'account']);
  });
});
