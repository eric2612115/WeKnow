// What a model returns is checked before anything is decided on it.
import { expect, test } from 'vitest';
import { checkUnderstanding } from '../understanding';

test('a model that writes the word "null" for a missing payee leaves it empty', () => {
  const u = checkUnderstanding({ kind: 'bill', lines: [], problemRef: null, payee: 'null', payTo: 'None', urgent: false, addressedToAI: false, accountChange: false }, new Set());
  expect(u.payee).toBeNull();
  expect(u.payTo).toBeNull();
});
