// What a typed question is turned into before it may go online (ask/escalate.ts coverWords): the sentence that says
// who the person is, or carries a number of theirs, stays on this device; the question goes.
import { expect, test } from 'vitest';
import { coverWords } from '../escalate';

const goes = (q: string) => coverWords(q).text;

test('a sentence with a personal detail stays here when another sentence holds the question', () => {
  expect(goes('My name is Wendell Farthingale, my phone is (360) 555-0186. How do I get a protein shake stain out of a white shirt?')).toBe(
    'How do I get a protein shake stain out of a white shirt?',
  );
  expect(goes('我叫王小明，住在台北市信義路100號。白色上衣沾到高蛋白染色了要怎麼洗？')).toBe('白色上衣沾到高蛋白染色了要怎麼洗？');
  expect(goes('Call me on 07700 900123. My dishwasher will not drain.')).toBe('My dishwasher will not drain.');
  expect(goes('+886 912 345 678 is my number. How much is a new water heater?')).toBe('How much is a new water heater?');
});

test('in a lone sentence the name and any long number are covered, and it counts as something hidden', () => {
  const one = coverWords("I'm Wei Chen and my dehumidifier is leaking");
  expect(one.text).not.toMatch(/Wei|Chen/);
  expect(one.text).toMatch(/dehumidifier is leaking/);
  expect(Object.keys(one.counts).length).toBeGreaterThan(0); // so the sheet asks first
  const two = coverWords('My name is Lakshmi Venkataraman and my AC drips');
  expect(two.text).not.toMatch(/Lakshmi|Venkataraman/);
  const three = coverWords('SSN 123 45 6789 and my furnace is loud');
  expect(three.text).not.toMatch(/123|6789/);
  expect(Object.keys(three.counts).length).toBeGreaterThan(0);
});

test('a plain question is left as it is', () => {
  const c = coverWords('My tap keeps dripping');
  expect(c).toEqual({ text: 'My tap keeps dripping', counts: {} });
  expect(goes('How much is a brake pad replacement on a 2019 sedan?')).toBe('How much is a brake pad replacement on a 2019 sedan?');
});
