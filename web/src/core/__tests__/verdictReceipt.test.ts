import { describe, expect, it } from 'vitest';
import { billVerdict } from '../verdict';
import type { Understanding } from '../understanding';

const u = (over: Partial<Understanding>): Understanding => ({ kind: 'bill', lines: [], problemRef: null, payee: null, payTo: null, urgent: false, addressedToAI: false, accountChange: false, ...over });

// The printed words of a restaurant check: no account to pay, no time pressure.
const check = `Table 12  Guests 2  2026/11/25 19:42
Braised pork rice  1  $120
Hot and sour soup  1  $90
Sweet potato fries  1  $85
Subtotal  $734   Service charge 10%  $73   Total  $807
Thank you for dining with us. Scan the QR code to order again.`.repeat(2);

describe('a restaurant check', () => {
  it('raises no "rushes you" when only the model says so, and no new company when nothing asks for a transfer', () => {
    const v = billVerdict(u({ payee: 'Golden Bowl', urgent: true }), check, []);
    expect(v.flags).not.toContain('urgency');
    expect(v.flags).not.toContain('new-payee');
    expect(v.safe).toBe(true);
  });

  it('still warns when the paper asks for a transfer to a company never paid, or prints the pressure itself', () => {
    const transfer = `${check} Please transfer to account 4410 2278 6092 at Thistlewick Savings Bank.`;
    expect(billVerdict(u({ payee: 'Golden Bowl' }), transfer, []).flags).toContain('new-payee');
    const rushed = `${check} Final notice: pay within 24 hours.`;
    expect(billVerdict(u({ payee: 'Golden Bowl', urgent: true }), rushed, []).flags).toContain('urgency');
  });
});
