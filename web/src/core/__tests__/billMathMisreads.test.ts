// Three misreads of the plain-code bill rules on clean papers (fictional words written for these tests).
import { expect, test } from 'vitest';
import { billMath, payToEndings } from '../billMath';

test('an account number at the end of a line does not take letters from the next line', () => {
  const lines = ['Please pay to account ending 8578', 'late fees apply after the due date.'];
  expect(payToEndings(lines)).toEqual(['8578']);
});

test('a pay-to account whose number is printed on the next line is still found', () => {
  expect(payToEndings(['Payment account', '3305 7719 4821'])).toEqual(['4821']);
});

test('a discount is part of the sum: subtotal minus discount plus tax is the total', () => {
  const m = billMath(['Subtotal $1,886.80', 'Discount (10%) -$188.68', 'Sales tax $101.89', 'Total $1,800.01']);
  expect(m.checked).toBe(1);
  expect(m.misses).toEqual([]);
});

test('a total that is still wrong after the discount is still caught', () => {
  const m = billMath(['Subtotal $1,886.80', 'Discount -$188.68', 'Sales tax $101.89', 'Total $1,900.01']);
  expect(m.misses.map((x) => x.rule)).toEqual(['tax']);
});

test('the account a new one replaces is not a second customer account', () => {
  const m = billMath([
    'Account: 40-2271-0583',
    'Our bank has changed. Your new account ending 7730 replaces the account ending 4821.',
  ]);
  expect(m.accounts).toEqual(['0583']);
});

test('two different customer account numbers are still both found', () => {
  expect(billMath(['Account: 40-2271-0583', 'Account number 55-1900-2291']).accounts).toEqual(['0583', '2291']);
});

test('the sentence for a wrong total names the discount', async () => {
  const { sumWhy } = await import('../../answer/compose');
  const m = billMath(['Subtotal $1,886.80', 'Discount -$188.68', 'Sales tax $101.89', 'Total $1,900.01']);
  expect(sumWhy(m.misses[0])).toBe('$1,886.80 minus a $188.68 discount, plus $101.89 tax, is $1,800.01, but the total says $1,900.01.');
});
