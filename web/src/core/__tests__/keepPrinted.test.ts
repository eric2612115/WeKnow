// A quote amount a model copied is kept only when the paper's own words print it.
import { expect, test } from 'vitest';
import { keepPrinted } from '../billMath';

const words = ['Brake pads (front)   $160.00', 'Brake fluid flush 89', 'Shop supplies $1,2O0.50', 'Call 555-0134'];

test('an amount printed on the paper is kept', () => {
  const lines = [
    { label: 'Brake pads', amount: 160 },
    { label: 'Fluid flush', amount: 89 },
    { label: 'Supplies', amount: 1200.5 },
    { label: 'No price read', amount: null },
  ];
  expect(keepPrinted(lines, words)).toEqual(lines);
});

test('an amount that is not printed is dropped, so the line is never judged', () => {
  const out = keepPrinted(
    [
      { label: 'Brake pads', amount: 16 }, // "16" is inside "160" but is not what is printed
      { label: 'Fluid flush', amount: 98 },
    ],
    words,
  );
  expect(out.map((l) => l.amount)).toEqual([null, null]);
});

test('a quote line takes the total printed on its own row, not a column or the next row', async () => {
  const { amountsFromRows } = await import('../billMath');
  const words = [
    '1 Check engine light diagnostic (scan and test)  1  —  1  $145.00  $145.00',
    '2 Front brake pads replacement (one axle)  1  $96.40 1.2  $174.00  $270.40',
    '3 Brake fluid flush  1  $21.00 0.8  $116.00  $137.00',
    '9 Hazardous waste / environmental fee  1  —  —  —  $6.50',
  ];
  const out = amountsFromRows(
    [
      { label: 'Front brake pads replacement (one axle)', amount: 174 },
      { label: 'Brake fluid flush', amount: 116 },
      { label: 'Hazardous waste/ environmental fee', amount: 114.5 },
      { label: 'Something not on the page', amount: 50 },
    ],
    words,
  );
  expect(out.map((l) => l.amount)).toEqual([270.4, 137, 6.5, 50]);
});

test('a quote line takes its name as printed on its row, without the row number or quantity columns', async () => {
  const { linesFromRows } = await import('../billMath');
  const words = ['2 Front brake pads replacement (one axle)  1  $96.40 1.2  $174.00  $270.40', '9 Hazardous waste / environmental fee 1 — — — $6.50'];
  const out = linesFromRows([{ label: 'BRAKE BRAKE REPLACEMENT (ONE AXLE)', amount: 174 }, { label: '9 Hazardous waste/ environmental fee', amount: 114.5 }], words);
  expect(out).toEqual([
    { label: 'Front brake pads replacement (one axle)', amount: 270.4 },
    { label: 'Hazardous waste / environmental fee', amount: 6.5 },
  ]);
});
