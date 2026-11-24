// With the paper's own words at hand, a warning the model raises needs a cue printed on the paper, so the same
// bill gets the same warnings run after run. Without the words, the model's flag counts as it is.
import { expect, test } from 'vitest';
import { billVerdict } from '../verdict';

const base = { kind: 'bill' as const, lines: [], problemRef: null, payee: 'Riverbend Electric Co-op', payTo: '4821', urgent: true, addressedToAI: false, accountChange: true };
const known = [{ name: 'Riverbend Electric Co-op', payTo: '4821' }];
const normal = 'Riverbend Electric Co-op Electric statement. Amount due $89.00. Due date Dec 01, 2026. Previous balance $84.00, payments received $84.00, new charges $89.00. Pay by mail, online or bank transfer to payment account ending 4821, as on your earlier bills. Questions? Call member services.';

test('a normal bill: the model’s "urgent" and "account changed" do not count without a printed cue', () => {
  expect(billVerdict(base, normal, known as never).flags).toEqual([]);
});

test('printed pressure and a printed bank change still raise both warnings', () => {
  const pushy = `${normal} Important: our bank has changed. Avoid disconnection: pay within 24 hours.`;
  expect(billVerdict(base, pushy, known as never).flags).toEqual(expect.arrayContaining(['urgency', 'account-change-notice']));
});

test('without the paper’s words, the model’s flags count as they are', () => {
  expect(billVerdict(base, 'Riverbend Electric Co-op', known as never).flags).toEqual(expect.arrayContaining(['urgency', 'account-change-notice']));
});
