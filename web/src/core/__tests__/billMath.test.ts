import { describe, expect, it } from 'vitest';
import { amountsIn, billMath, findAccounts, findAmounts, parseAmount, endingPrinted, namePrinted, readAmounts } from '../billMath';

describe('amounts as printed', () => {
  it('reads dollar amounts, with cents, commas and signs', () => {
    expect(parseAmount('$90.75')).toBe(90.75);
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('-$84.20')).toBe(-84.2);
    expect(parseAmount('($84.20)')).toBe(-84.2);
    expect(parseAmount('84.20 CR')).toBe(-84.2);
    expect(parseAmount('$120')).toBe(120);
    expect(parseAmount('312.40')).toBe(312.4);
  });

  it('reads OCR noise inside a number as digits', () => {
    expect(parseAmount('$1,234.5O')).toBe(1234.5);
    expect(parseAmount('$I,2O4.l0')).toBe(1204.1);
    expect(parseAmount('$ 96.l5')).toBe(96.15);
  });

  it('never takes a date, a count, a rate, a percent or a phone number for an amount', () => {
    expect(amountsIn('November 12, 2026')).toEqual([]);
    expect(amountsIn('612 kWh at $0.112')).toEqual([]);
    expect(amountsIn('Tax (8.25%)')).toEqual([]);
    expect(amountsIn('Call (541) 555-0199.')).toEqual([]);
    expect(amountsIn('Due $90.75.').map((a) => a.value)).toEqual([90.75]);
  });
});

describe('the numbers add up', () => {
  it('subtotal + tax = total: no warning', () => {
    const m = billMath(['Subtotal $120.00', 'Sales tax (8.25%) $9.90', 'Total $129.90']);
    expect(m.checked).toBe(1);
    expect(m.misses).toEqual([]);
  });

  it('last bill − payments + new charges = amount due, within a dollar of rounding', () => {
    const m = billMath(['Previous balance $84.20', 'Payment received - thank you -$84.20', 'New charges $96.15', 'Amount due $96.80']);
    expect(m.amounts).toMatchObject({ previous: 84.2, paid: 84.2, charges: 96.15, due: 96.8 });
    expect(m.checked).toBe(1);
    expect(m.misses).toEqual([]);
  });

  it('total − paid = balance due', () => {
    expect(billMath(['Total $500.00', 'Amount paid $200.00', 'Balance due $300.00']).misses).toEqual([]);
  });

  it('keeps two columns on one line apart', () => {
    const a = findAmounts(['Previous balance $84.20   Payments -$84.20', 'Current charges $96.15   Total amount due $96.15']);
    expect(a).toEqual({ previous: 84.2, paid: 84.2, charges: 96.15, due: 96.15 });
  });

  it('takes the amount on the next line for a label alone on its line', () => {
    expect(findAmounts(['Amount due Due', '$90.75 Within 24 hours'])).toEqual({ due: 90.75 });
  });
});

describe('the numbers do not add up', () => {
  it('subtotal + tax ≠ total', () => {
    const m = billMath('Subtotal $120.00\nTax $9.90\nTotal $199.90');
    expect(m.misses).toEqual([{ rule: 'tax', subtotal: 120, tax: 9.9, total: 199.9, expected: 129.9 }]);
  });

  it('a statement asking for more than the last bill, payments and new charges make', () => {
    const m = billMath(['Previous balance $84.20', 'Payments received ($84.20)', 'Current charges $96.15', 'Total amount due $312.40', 'Minimum amount due $312.40']);
    expect(m.misses).toEqual([{ rule: 'balance', previous: 84.2, paid: 84.2, charges: 96.15, due: 312.4, expected: 96.15 }]);
    expect(m.amounts.minimum).toBe(312.4);
  });

  it('an invoice whose balance ignores what was paid', () => {
    expect(billMath(['Total $500.00', 'Deposit paid $200.00', 'Balance due $450.00']).misses[0]).toMatchObject({ rule: 'paid', expected: 300 });
  });

  it('with OCR noise in the amounts', () => {
    const m = billMath(['Subtotal $1,234.5O', 'Tax $1O1.84', 'Total $1,5OO.OO']);
    expect(m.amounts).toEqual({ subtotal: 1234.5, tax: 101.84, total: 1500 });
    expect(m.misses[0]).toMatchObject({ rule: 'tax', expected: 1336.34 });
  });

  it('a difference of a dollar or less is rounding, not a warning', () => {
    expect(billMath(['Subtotal $10.00', 'Tax $0.83', 'Total $11.83']).misses).toEqual([]);
    expect(billMath(['Subtotal $10.00', 'Tax $0.83', 'Total $11.84']).misses).toHaveLength(1);
  });
});

describe('partial information: nothing is checked, no warning', () => {
  it('a bill with only charges and a total due', () => {
    const m = billMath(['Basic service charge $18.00', 'Energy charge, 612 kWh at $0.112 $68.54', 'Grid maintenance fee $4.21', 'Total due $90.75']);
    expect(m.checked).toBe(0);
    expect(m.misses).toEqual([]);
  });

  it('a total and tax with no subtotal', () => {
    expect(billMath(['Tax $9.90', 'Total $199.90']).checked).toBe(0);
  });

  it('a payment due date is not a payment', () => {
    const a = findAmounts(['Previous balance $84.20', 'Payment due date Dec 5, 2026', 'Payment due $96.15', 'New charges $96.15', 'Amount due $96.15']);
    expect(a.paid).toBeUndefined();
    expect(billMath(['Previous balance $84.20', 'Payment due by Dec 5', 'New charges $96.15', 'Amount due $96.15']).checked).toBe(0);
  });

  it('"total due" is the amount due, "total payments" are payments, "total tax" is tax', () => {
    expect(findAmounts(['Total due $90.75', 'Total payments $10.00', 'Total tax $1.00', 'Total $5.00'])).toEqual({ due: 90.75, paid: 10, tax: 1, total: 5 });
  });
});

describe('two different account numbers', () => {
  it('the same account at the top and on the stub: one number', () => {
    expect(findAccounts(['Account: 40-2271-0583', 'Please return this part', 'Account number 4022710583'])).toEqual(['0583']);
  });

  it('a different account on the payment stub: two numbers, last four only', () => {
    expect(findAccounts(['Account number: 1100-2299-1234', 'PAYMENT STUB', 'Account # 1100 2299 5678'])).toEqual(['1234', '5678']);
  });

  it('a label on its own line with the number below', () => {
    expect(findAccounts(['ACCOUNT NUMBER', '7781 0042 1234', 'Customer no. 7781-0042-9876'])).toEqual(['1234', '9876']);
  });

  it('where money is sent is not the customer’s account', () => {
    expect(
      findAccounts([
        'Account: 40-2271-0583',
        'Send this payment to our new account number ending 7730. Payments to',
        'the old account ending 4821 will be returned.',
        'Bank transfer to Riverbend Electric Co-op, bank account ending 7730. Routing',
        'Member services (541) 555-0110',
      ]),
    ).toEqual(['0583']);
  });

  it('OCR noise in a repeated number is the same number', () => {
    expect(findAccounts(['Account: 40-2271-O583', 'Account: 40-2271-0583'])).toEqual(['0583']);
  });

  it('a covered number ([account]) is never read', () => {
    expect(findAccounts(['Account [account]', 'Account [account]'])).toEqual([]);
  });
});

describe('one value beside a label is the paper’s; two different values confirm neither', () => {
  it('the same amount due at the top and on the stub is kept', () => {
    expect(readAmounts(['Amount due $89.00', 'Detach and return', 'Amount due $89.00'])).toEqual({ amounts: { due: 89 }, conflicts: [] });
  });

  it('two different amounts due: neither is taken, and no sum is checked with either', () => {
    const lines = ['Previous balance $84.20', 'Payments -$84.20', 'New charges $96.15', 'Amount due $96.15', 'PAYMENT STUB', 'Amount due $312.40'];
    expect(readAmounts(lines).conflicts).toEqual(['due']);
    expect(billMath(lines)).toMatchObject({ checked: 0, misses: [], conflicts: ['due'] });
  });

  it('a label further off on the line only fills an empty label, it never makes a second amount', () => {
    expect(readAmounts(['Amount due: $89.00', 'AMOUNT DUE  3. Retail counter. Cash or debit at participating stores; $1.50 handling'])).toEqual({
      amounts: { due: 89 },
      conflicts: [],
    });
  });
});

describe('what a model gave, held to the paper', () => {
  const paper = ['RIVERBEND ELECTRIC CO-OP', 'Amount due $89.00', 'Payment account 3305 7719 4821'];

  it('a company printed on the paper, in any case, with one misread letter', () => {
    expect(namePrinted('Riverbend Electric Co-op', paper)).toBe(true);
    expect(namePrinted('Riverbend Electric Cooperative', ['Rlverbend Electric Cooperative'])).toBe(true);
  });

  it('a company printed nowhere on the paper is made up', () => {
    expect(namePrinted('Pacific Gas & Electric', paper)).toBe(false);
    expect(namePrinted('Inc.', paper)).toBe(false);
  });

  it('Chinese names are looked for as printed', () => {
    expect(namePrinted('台灣電力公司', ['台灣電力公司 電費通知單'])).toBe(true);
    expect(namePrinted('中華電信', ['台灣電力公司 電費通知單'])).toBe(false);
  });

  it('an account ending printed at the end of a number or after "ending"', () => {
    expect(endingPrinted('4821', paper)).toBe(true);
    expect(endingPrinted('4821', ['Pay to account ending 4821.'])).toBe(true);
    expect(endingPrinted('1234', paper)).toBe(false);
    expect(endingPrinted('7719', paper)).toBe(false);
  });
});

describe('plausibleName', () => {
  it('takes a company name and drops a scrap of the page', async () => {
    const { plausibleName } = await import('../billMath');
    expect(plausibleName('Riverbend Electric Co-op')).toBe(true);
    expect(plausibleName('鼎泰豐')).toBe(true);
    expect(plausibleName('BR3 :   807')).toBe(false);
    expect(plausibleName('A1')).toBe(false);
  });
});
