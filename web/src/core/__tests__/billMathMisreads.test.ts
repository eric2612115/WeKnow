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

test('a row of column headings takes the amounts on the row under it, in order', () => {
  const m = billMath(['PREVIOUS BALANCE  PAYMENTS RECEIVED  NEW CHARGES  AMOUNT DUE', '$84.00  −  $84.00  +  $89.00  =  $89.00']);
  expect(m.amounts).toMatchObject({ previous: 84, paid: 84, charges: 89, due: 89 });
  expect(m.checked).toBe(1);
  expect(m.misses).toEqual([]);
});

test('the same headings over a balance that is off are caught', () => {
  const m = billMath(['PREVIOUS BALANCE  PAYMENTS RECEIVED  NEW CHARGES  AMOUNT DUE', '$84.00  −  $84.00  +  $89.00  =  $189.00']);
  expect(m.misses.map((x) => x.rule)).toEqual(['balance']);
});

test('an old account named across lines ("replaces the" / "account ending 4821") is not the customer’s', () => {
  const m = billMath(['Member account  40-2271-0583', 'New account number — replaces the', 'Service address  512 Bramble Ct', 'account ending 4821. Pay within 24 hours.']);
  expect(m.accounts).toEqual(['0583']);
});

test('a bank name with "Savings" in it does not make the total a discount; "in payment of" is not money paid', () => {
  const m = billMath([
    'In payment of processing fee for release of unclaimed inheritance fund of USD 482,700.00 held on PSRT Clearing',
    'Include non taxable items Subtotal $1,050.00',
    'Remittance instruction Includes tax (2.00%) $21.00',
    'Thistlewick Savings Bank, bank code TWSB-0142 Total $1,091.00',
    'Account number: 4410 2278 6092 Paid $1,091.00',
    'Wire, cashier check or prepaid voucher accepted. Balance due $4,827.00',
  ]);
  expect(m.amounts).toMatchObject({ subtotal: 1050, tax: 21, total: 1091, paid: 1091, due: 4827 });
  expect(m.misses.map((x) => x.rule)).toEqual(['tax', 'paid']);
});
