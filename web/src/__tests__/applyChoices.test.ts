// What plain code matched stays matched, whatever a small model answers about lines it was not asked.
import { expect, test, vi } from 'vitest';

vi.mock('../firebase', () => ({ ai: {}, CLOUD_MODEL: 'test', LIVE_MODEL: 'test' }));
import { applyChoices } from '../reader';

test('a choice for a line the model was not asked about is ignored', () => {
  const chosen = new Map<number, string | null>([[1, 'brake-pads'], [2, 'brake-fluid-flush']]);
  const askable = [{ i: 9, options: [{ ref: 'fuel-system-cleaning' }] }];
  applyChoices(askable, [{ i: 1, ref: null }, { i: 2, ref: null }, { i: 9, ref: 'fuel-system-cleaning' }, { i: 9, ref: null }], chosen);
  expect([...chosen.entries()]).toEqual([[1, 'brake-pads'], [2, 'brake-fluid-flush'], [9, 'fuel-system-cleaning']]);
});

test('a ref that was not offered for that line counts as none', () => {
  const chosen = new Map<number, string | null>();
  applyChoices([{ i: 0, options: [{ ref: 'a' }] }], [{ i: 0, ref: 'b' }], chosen);
  expect(chosen.get(0)).toBeNull();
});
