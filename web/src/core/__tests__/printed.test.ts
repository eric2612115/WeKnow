// Rules added after photographing the printed test sheets (fictional data): titles, greetings, signatures,
// a street in capitals and a phone number already half hidden on the paper.
import { expect, test } from 'vitest';
import { maskText } from '../pii';

test('covers names, signatures and addresses the printed sheets showed', () => {
  const lines = [
    'To: Theodora Quillfeather',
    'Mr. Alaric Venn-Hollis, Director of Remittance',
    'Tel. 555-***-0134',
    'A. Venn-Hollis',
    'Technician #07 D. Marrow',
    '#07 D. Marrow',
    '512 BRAMBLE CT',
    'Payee: Riverbend Electric Co-op.',
    'Includes tax (2.00%)',
  ];
  const m = maskText(lines.join('\n'));
  expect(m).not.toMatch(/Theodora|Quillfeather|Alaric|Venn|Hollis|0134|Marrow|BRAMBLE/);
  expect(m).toContain('Payee: Riverbend Electric Co-op.');
  expect(m).toContain('Includes tax (2.00%)');
});
