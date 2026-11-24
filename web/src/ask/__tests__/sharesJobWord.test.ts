// A small model picks from what it is offered even when nothing fits: only items sharing a job word are offered.
import { expect, test } from 'vitest';
import { sharesJobWord } from '../words';

test('an item with none of the question’s job words is not offered', () => {
  expect(sharesJobWord("My vacuum won't pick anything up", ['Top up windshield washer fluid', 'washer fluid'])).toBe(false);
  expect(sharesJobWord("My vacuum won't pick anything up", ['Unclog a toilet with a plunger'])).toBe(false);
  expect(sharesJobWord("My vacuum won't pick anything up", ["Phone won't charge"])).toBe(false);
  expect(sharesJobWord("My vacuum won't pick anything up", ['Furnace tune-up'])).toBe(false);
});

test('items that do fit are still offered, a misspelling included', () => {
  expect(sharesJobWord('My kitchen sink is clogged', ['Clear a clogged or slow kitchen sink'])).toBe(true);
  expect(sharesJobWord('My toilet keeps running', ['Fix a running toilet: replace the flapper'])).toBe(true);
  expect(sharesJobWord('How much are brake pads?', ['Replace brake pads (one axle)'])).toBe(true);
  expect(sharesJobWord('how much is an altenrator replacement', ['Replace an alternator'])).toBe(true);
  expect(sharesJobWord('My brakes squeak', ['Replace brake pads (one axle)', 'squeaky brakes'])).toBe(true);
});
