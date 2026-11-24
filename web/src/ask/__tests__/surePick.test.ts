// A quote line that names a price-book item in full is matched by plain code, the same every time.
import { expect, test } from 'vitest';
import { surePick } from '../words';

const pads = { ref: 'brake-pads', name: 'Replace brake pads (one axle)', aliases: ['brake pads', 'brake pad replacement', 'front brake pads', 'rear brake pads'] };
const padsRotors = { ref: 'brake-pads-rotors', name: 'Replace brake pads and rotors (one axle)', aliases: ['brake pads and rotors', 'pads and rotors'] };
const shop = { ref: 'shop-supplies-fee', name: 'Shop supplies fee (per repair order)', aliases: ['shop supplies', 'hazardous waste fee', 'environmental fee', 'hazardous waste / environmental fee'] };

test('a line that carries an item’s name in full is that item', () => {
  expect(surePick('Front brake pads replacement (one axle)', [pads, padsRotors])?.ref).toBe('brake-pads');
  expect(surePick('Brake pads and rotors, front', [pads, padsRotors])?.ref).toBe('brake-pads-rotors');
  expect(surePick('Shop supplies', [shop])?.ref).toBe('shop-supplies-fee');
});

test('a line with a word the item does not know is left to the model', () => {
  expect(surePick('Brake pads inspection', [pads, padsRotors])).toBeNull();
  expect(surePick('Brake inspection', [pads, padsRotors])).toBeNull();
});
