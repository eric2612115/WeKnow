// The five printed test sheets (docs/test-sheets, fictional) as PDFs: the words a model may read are covered, with
// no planted name, street, phone or account left, and the outgoing guard finds nothing (so nothing is refused).
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { linesOf, type TextPiece } from '../../pdf';
import { coverPaperText, flatPayload } from '../paperText';
import { findPII } from '../pii';
import { billMath, payToOf } from '../billMath';

const SHEETS = ['bill-2-electric-normal', 'bill-3-electric-new-account-buried', 'bill-4-water-ai-note', 'bill-7-scam-numbers-dont-add-up', 'quote-1-auto-one-high'];
const PLANTED = /theodora|quill[a-z]*feather|venn|hollis|alaric|farthingale|wendell|corbin|allwright|marrow|bramble|larkspur|555-\*|2048 6650|6650 3168|4410 2278|7KTR582|0TS4E8K21PW300417|theodora\.q|w\.farthingale/i;

async function linesOfPdf(name: string): Promise<string[]> {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(`${__dirname}/../../../../docs/test-sheets/${name}.pdf`)) }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) lines.push(...linesOf((await (await doc.getPage(p)).getTextContent()).items.filter((i) => 'str' in i) as TextPiece[]));
  return lines;
}

test.each(SHEETS)('%s: covered words leave nothing personal', async (name) => {
  const lines = await linesOfPdf(name);
  const payload = flatPayload(coverPaperText(lines.join('\n')).text);
  const m = payload.match(PLANTED);
  expect(m ? payload.slice(Math.max(0, (m.index ?? 0) - 60), (m.index ?? 0) + 40) : null).toBeNull();
  expect(findPII(payload).map((h) => `${h.kind}: ${h.text}`)).toEqual([]);
});

test('the account to pay into is read from the paper, a member number is not it', async () => {
  expect(payToOf(await linesOfPdf('bill-2-electric-normal'))).toBe('4821');
  expect(payToOf(await linesOfPdf('bill-3-electric-new-account-buried'), '4821')).toBe('7730');
  expect(payToOf(await linesOfPdf('bill-4-water-ai-note'))).toBe('3168');
  // "Payment account 2048 6650 3168" is where money goes, not a second customer account.
  expect(billMath(await linesOfPdf('bill-4-water-ai-note')).accounts).toEqual(['3002']);
});
