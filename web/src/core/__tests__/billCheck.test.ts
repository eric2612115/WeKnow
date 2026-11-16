// The words a suspicious bill sends to the web: the company and the charge names, never a person or a number.
import { expect, test } from 'vitest';
import { billQuestion, parseOnlineCheck } from '../billCheck';

const scam = [
  'In payment of processing fee for release of unclaimed inheritance fund of USD 482,700.00 held on PSRT Clearing on behalf name Theodora Quillfeather,',
  'To: Theodora Quillfeather   Mr. Alaric Venn-Hollis, Director of Remittance',
  'Tel. 555-***-0134',
  'Government processing fee (Federal Release Stamp)   $350.00',
  'Anti-money-laundering clearance certificate   $185.00',
  'Identification card fee   $240.00',
  'Account number: 4410 2278 6092',
  'Includes tax (2.00%)   $21.00',
  'Balance due   $4,827.00',
];

test('builds the question from the company and charge names only', () => {
  const q = billQuestion('Palisade Sovereign Reserve Trust', scam)!;
  expect(q).toContain('Who asks to be paid: Palisade Sovereign Reserve Trust');
  expect(q).toContain('Government processing fee (Federal Release Stamp)');
  expect(q).not.toMatch(/Theodora|Quillfeather|Alaric|Venn|0134|4410|6092|\d{3}/);
  expect(q.length).toBeLessThanOrEqual(300);
});

test('a person named as the payee is never sent', () => {
  const q = billQuestion('Theodora Quillfeather', scam, new Set(['theodora', 'quillfeather']));
  expect(q ?? '').not.toMatch(/Theodora|Quillfeather/);
});

test('a finding counts only with web sources', () => {
  const text = 'It is a scam. {"finding": "known-scam-pattern", "points": ["Real agencies never ask for $350 to release money."]}';
  expect(parseOnlineCheck(text, [])).toBeNull();
  const r = parseOnlineCheck(text, [{ url: 'https://consumer.ftc.gov/x', title: 'FTC' }] as never)!;
  expect(r.finding).toBe('known-scam-pattern');
  expect(r.points[0]).not.toContain('$350');
  expect(parseOnlineCheck('{"finding": "safe"}', [{ url: 'https://x.gov' }] as never)).toBeNull();
});
