// The basic check (core/basicRead.ts): the five printed test sheets, read by plain code alone, with no model. A bill
// is told from a quote, the company that asks for the money is named, and the same plain rules every bill goes
// through raise the right warnings (docs/test-sheets/README.md says what each sheet should get).
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { linesOf, type TextPiece } from '../../pdf';
import { basicBill, basicKind, basicPayee } from '../basicRead';
import { billMath, payToOf } from '../billMath';
import { coverPaperText } from '../paperText';
import { maskText } from '../pii';
import { billVerdict, withBillMath, type BillFlag } from '../verdict';

async function linesOfPdf(name: string): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(`${__dirname}/../../../../docs/test-sheets/${name}.pdf`)) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) lines.push(...linesOf((await (await doc.getPage(p)).getTextContent()).items.filter((i) => 'str' in i) as TextPiece[]));
  return lines;
}

/** What flows.ts does for a bill on a device with no model: the form by plain code, then the plain rules. */
async function basicCheck(name: string, known: Array<{ name: string; payTo: string }> = []): Promise<{ payee: string | null; flags: BillFlag[]; safe: boolean }> {
  const lines = await linesOfPdf(name);
  const u = basicBill(coverPaperText(lines.join('\n')).text.split('\n'), known.map((k) => k.name));
  u.payTo = payToOf(lines, known.find((k) => k.name === u.payee)?.payTo) ?? null;
  const v = withBillMath(billVerdict(u, maskText([u.payee ?? '', ...lines].join(' ')), known), billMath(lines));
  return { payee: u.payee, flags: v.flags, safe: v.safe };
}

test('a bill is told from a quote by its own words', async () => {
  for (const name of ['bill-2-electric-normal', 'bill-3-electric-new-account-buried', 'bill-4-water-ai-note', 'bill-7-scam-numbers-dont-add-up'])
    expect([name, basicKind(await linesOfPdf(name))]).toEqual([name, 'bill']);
  expect(basicKind(await linesOfPdf('quote-1-auto-one-high'))).toBe('quote');
  expect(basicKind(['Hello', 'World'])).toBe('unknown');
});

test('who asks to be paid is the letterhead, never a covered line or a heading', async () => {
  expect(basicPayee(await linesOfPdf('bill-2-electric-normal'))).toBe('Riverbend Electric Co-op');
  expect(basicPayee(await linesOfPdf('bill-7-scam-numbers-dont-add-up'))).toBe('Palisade Sovereign Reserve Trust');
  expect(basicPayee(['INVOICE', '[name]   [street]', 'Acme Water District   Customer service 8 to 5'])).toBe('Acme Water District');
  // A company the person keeps a note of is named as they wrote it.
  expect(basicPayee(['some letterhead art', 'payable to RIVERBEND ELECTRIC CO-OP'], ['Riverbend Electric Co-op'])).toBe('Riverbend Electric Co-op');
});

test('the usual bill, with a note of the company and its account, is safe', async () => {
  const r = await basicCheck('bill-2-electric-normal', [{ name: 'Riverbend Electric Co-op', payTo: '4821' }]);
  expect(r).toEqual({ payee: 'Riverbend Electric Co-op', flags: [], safe: true });
});

test('the buried new account is caught with no model', async () => {
  const r = await basicCheck('bill-3-electric-new-account-buried', [{ name: 'Riverbend Electric Co-op', payTo: '4821' }]);
  expect(r.safe).toBe(false);
  expect(r.flags).toContain('changed-account');
});

test('words aimed at an AI are caught with no model', async () => {
  const r = await basicCheck('bill-4-water-ai-note');
  expect(r.flags).toContain('instruction-to-ai');
});

test('numbers that do not add up are caught with no model', async () => {
  const r = await basicCheck('bill-7-scam-numbers-dont-add-up');
  expect(r.payee).toBe('Palisade Sovereign Reserve Trust');
  expect(r.flags).toEqual(expect.arrayContaining(['new-payee', 'numbers-dont-add-up']));
});
