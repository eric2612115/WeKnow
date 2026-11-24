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

test('names read off a photo lose the row number and the table marks; a note with a measure is not a row', async () => {
  const { linesFromRows } = await import('../billMath');
  const words = [
    'rear 6 mm; rotors within spec (lateral run-out 0.03 mm) but lightly scored; brake fluid 3.1% moisture',
    '1 | Check engine light diagnostic (scan and test) 1 —| 1 $145.00 $145.00',
    '3 | Brake fluid flush 1 $21.00 | 08 $116.00 $137.00',
    '8 | Shop supplies 1 —- = — $24.50',
    '9 | Hazardous waste / environmental fee 1 —-| - — $6.50',
  ];
  const out = linesFromRows(
    [
      { label: 'Check engine light diagnostic', amount: 145 },
      { label: 'Brake fluid flush', amount: 116 },
      { label: 'Shop supplies', amount: null },
      { label: 'Hazardous waste environmental fee', amount: 114.5 },
    ],
    words,
  );
  expect(out).toEqual([
    { label: 'Check engine light diagnostic (scan and test)', amount: 145 },
    { label: 'Brake fluid flush', amount: 137 },
    { label: 'Shop supplies', amount: 24.5 },
    { label: 'Hazardous waste / environmental fee', amount: 6.5 },
  ]);
});

test('a quote that numbers its lines gives them by plain code, in order, from the text recognizer’s own lines', async () => {
  const { numberedRows } = await import('../billMath');
  // The recognizer's lines of docs/test-sheets/quote-1-auto-one-high.png (Chrome, 2026-11-24), with the rows around them.
  const words = [
    '61 Larkspur Ln Color: silver - Odometer in: 48,210 mi Payment: card on file 0142',
    'rear 6 mm; rotors within spec (lateral run-out 0.03 mm) but lightly scored; drive belt cracked and glazed',
    '# DESCRIPTION / PART NO. QTY PARTS HRS LABOR AMOUNT',
    '1 | Check engine light diagnostic (scan and test) 1 —| 1 $145.00 $145.00',
    'Code P0171 - smoke test intake',
    '2 | Front brake pads replacement (one axle) 1 $96.40 | 1.2 $174.00 $270.40',
    'P/N TW-BP-44710 ceramic pad set + hardware',
    '3 | Brake fluid flush 1 $21.00 | 08 $116.00 $137.00',
    '4 | Serpentine belt replacement 1 $80.50 | 2.1 $304.50 $385.00',
    '5 | Engine air filter replacement 1 $39.00 | 0.2 $29.00 $68.00',
    '6 | Wiper blades, pair 1 $46.00 | — — $46.00',
    '7 | Tire rotation 1 —| 02 $29.00 $29.00',
    '8 | Shop supplies 1 —- = — $24.50',
    'Cleaners, rags, hardware',
    '9 | Hazardous waste / environmental fee 1 —-| - — $6.50',
    '10 | Fuel induction cleaning service 1 $42.00 0.5 $72.50 $114.50',
    'NOTES Parts and materials $324.90',
  ];
  expect(numberedRows(words)).toEqual([
    { label: 'Check engine light diagnostic (scan and test)', amount: 145 },
    { label: 'Front brake pads replacement (one axle)', amount: 270.4 },
    { label: 'Brake fluid flush', amount: 137 },
    { label: 'Serpentine belt replacement', amount: 385 },
    { label: 'Engine air filter replacement', amount: 68 },
    { label: 'Wiper blades, pair', amount: 46 },
    { label: 'Tire rotation', amount: 29 },
    { label: 'Shop supplies', amount: 24.5 },
    { label: 'Hazardous waste / environmental fee', amount: 6.5 },
    { label: 'Fuel induction cleaning service', amount: 114.5 },
  ]);
  expect(numberedRows(['Subtotal $10.00', 'Total $12.00'])).toBeNull();
});
