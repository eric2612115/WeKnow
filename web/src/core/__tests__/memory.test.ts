import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compareToLastTime, earlierJobs, knownPayees, memoryStorage, relevant, sanitize, type JobMemory } from '../memory';

const job = (over: Partial<JobMemory>): JobMemory => ({
  kind: 'job',
  id: 'j1',
  shop: 'Summit Plumbing',
  ref: 'drain-unclog',
  label: 'Kitchen drain clearing',
  amount: 180,
  date: '2026-03-12',
  ...over,
});

describe('household memory', () => {
  it('compares a new price with the last time at the same shop', () => {
    const earlier = earlierJobs([job({})], { ref: 'drain-unclog', label: 'Drain clearing' }, 'SUMMIT PLUMBING');
    expect(compareToLastTime(earlier, 320, 'Summit Plumbing')).toBe(
      'This shop charged $180 for this in March 2026. Now it is $320, $140 more.',
    );
  });

  it('says nothing when there is no earlier job', () => {
    expect(compareToLastTime(earlierJobs([], { ref: 'x', label: 'y' }, null), 100, null)).toBeNull();
  });

  it('keeps only the last four digits of a payee account, whatever was given', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[0-9]{4,16}$/), (digits) => {
        const m = sanitize({ kind: 'payee', id: 'p', name: 'City Power', payTo: `acct ${digits}`, date: '2026-11-16' });
        expect(m.kind === 'payee' && m.payTo).toBe(digits.slice(-4));
      }),
    );
  });

  it('stored payees feed the bill check', async () => {
    const s = memoryStorage();
    await s.put({ kind: 'payee', id: 'p', name: 'City Power', payTo: '0000 1111 4821', date: '2026-11-16' });
    expect(knownPayees(await s.all())).toEqual([{ name: 'City Power', payTo: '4821' }]);
  });

  it('only a few relevant memories go into a prompt', () => {
    const many = Array.from({ length: 50 }, (_, i) => job({ id: `j${i}`, label: i % 2 ? 'Kitchen drain clearing' : 'Brake pads' }));
    const r = relevant(many, 'my kitchen drain is slow', 5);
    expect(r).toHaveLength(5);
    expect(r.every((m) => m.kind === 'job' && m.label.includes('drain'))).toBe(true);
  });

  it('forget everything empties the store', async () => {
    const s = memoryStorage();
    await s.put(job({}));
    await s.clear();
    expect(await s.all()).toEqual([]);
  });
});
