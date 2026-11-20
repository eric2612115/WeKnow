// @vitest-environment happy-dom
// An explanation in another language is written from WeKnow's answer alone: it may not bring a number of its own.
import { expect, test, vi } from 'vitest';

vi.mock('../firebase', () => ({ ai: {}, CLOUD_MODEL: 'test', LIVE_MODEL: 'test' }));
import { explainFacts, keepsNumbers } from '../explain';

test('an explanation with only the answer’s numbers is kept; one with a new number is not', () => {
  const facts = explainFacts({ verdict: 'Don’t pay this bill yet.', sentences: ['It asks you to pay a new one ending 7730.', 'You paid them at one ending 4821 before.', 'Amount due: $89.00.'] });
  expect(facts).not.toMatch(/7730|4821/); // account endings are left out of what a model is given
  expect(keepsNumbers(facts, 'No pague todavía. Pide pagar a una cuenta nueva. Son $89.00.')).toBe(true);
  expect(keepsNumbers(facts, 'Pague $98.00.')).toBe(false);
  expect(keepsNumbers(facts, 'Pague $89.00 a la cuenta 7730.')).toBe(false);
  expect(keepsNumbers(facts, '1. No pague. 2. Llame a la empresa.')).toBe(true); // its own small counts
});

test('the answer is covered again before it may go', () => {
  expect(explainFacts({ verdict: 'Check first', sentences: ['Call 555-0134 or write to pat.k@example.com'] })).not.toMatch(/555-0134|pat\.k/);
});
