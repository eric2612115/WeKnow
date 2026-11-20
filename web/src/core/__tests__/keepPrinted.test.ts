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
