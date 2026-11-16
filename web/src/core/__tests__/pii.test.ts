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
