import { describe, expect, it } from 'vitest';
import { findPII, maskText } from '../pii';

describe('account numbers after a labelled colon', () => {
  it('covers the digits, not only the label ("Account number: 3301-4478-1234", as a PDF prints it)', () => {
    for (const line of ['Account number: 3301-4478-1234', 'Account No. 3301 4478 1234', 'Acct #: 33014478', 'Account ID: AB-3301-4478']) {
      const masked = maskText(line);
      expect(masked).not.toMatch(/3301|4478/);
      expect(findPII(masked)).toEqual([]);
    }
  });

  it('still covers the forms it covered before', () => {
    expect(maskText('Account: 40-2271-0583')).toBe('[account]');
    expect(maskText('Account # 4021998877')).toBe('[account]');
  });
});

it('the other ways an address is written are covered: a PO box, a unit, more street words', () => {
  expect(maskText('PO Box 4471, Salem, OR 97301')).toBe('[street], Salem, OR 97301'); // the town and its ZIP are a region
  expect(maskText('P.O. Box 12')).toBe('[street]');
  for (const text of ['1418 Oak Hollow, Apt 4B', '22 Maple Circle', '9 Sunset Highway unit 3']) {
    const out = maskText(text);
    expect([text, /\d/.test(out.replace(/\[[a-z ]+\]/g, ''))]).toEqual([text, false]);
  }
  // A job's own words are left alone.
  expect(maskText('Replace unit heater and circle saw blade')).toBe('Replace unit heater and circle saw blade');
});
