// Checking words online: covered first, then the payload guard, then (with a device model) the on-device review.
// If either finds a personal detail, the cloud is never called. The cloud may only name refs from the index.
import { describe, expect, it, vi } from 'vitest';
import { coverWords, escalate, type EscalateDeps } from '../escalate';
import type { IndexEntry } from '../router';

const index: IndexEntry[] = [
  { ref: 'diy-faucet-drip', name: 'Fix a dripping faucet', kind: 'guide' },
  { ref: 'drain-unclog', name: 'Plumber clears a clogged drain', kind: 'price' },
];
const deps = (raw: unknown, review?: (t: string) => Promise<boolean>) => {
  const cloud = vi.fn(async () => ({ raw, ms: 12, model: 'test-model' }));
  const d: EscalateDeps = { index: async () => index, cloud, ...(review ? { review } : {}) };
  return { d, cloud };
};

describe('coverWords', () => {
  it('covers a phone number, including a local one, and counts it', () => {
    const c = coverWords('My phone number is 555-0134, my sink is clogged');
    expect(c.text).toBe('My phone number is [phone], my sink is clogged');
    expect(c.counts).toEqual({ phone: 1 });
  });
});

describe('escalate', () => {
  it('sends only the covered words and accepts a ref from the index', async () => {
    const { d, cloud } = deps({ ref: 'diy-faucet-drip', kind: 'guide' });
    const r = await escalate(coverWords('My tap keeps dripping').text, d);
    expect(cloud).toHaveBeenCalledWith('My tap keeps dripping', index);
    expect(r).toMatchObject({ kind: 'found', entry: index[0], sent: 'My tap keeps dripping', offered: 2, ms: 12 });
  });

  it('a ref the index does not hold is no answer', async () => {
    const { d } = deps({ ref: 'diy-vacuum-belt', kind: 'guide' });
    expect(await escalate('My vacuum won’t pick anything up', d)).toMatchObject({ kind: 'none' });
  });

  it('the guard holds back words that still hold a personal detail: nothing is sent', async () => {
    const { d, cloud } = deps({ ref: 'diy-faucet-drip' });
    const review = vi.fn(async () => false);
    const r = await escalate('Call me at 503-555-0186 about my sink', { ...d, review });
    expect(r).toEqual({ kind: 'blocked', by: 'guard', found: ['phone'] });
    expect(review).not.toHaveBeenCalled();
    expect(cloud).not.toHaveBeenCalled();
  });

  it('the on-device review holds back what the guard missed: nothing is sent', async () => {
    const { d, cloud } = deps({ ref: 'diy-faucet-drip' }, async () => true);
    // Written without capitals, the name rules (core/names.ts) cannot see it; the on-device review is the second look.
    const r = await escalate('i am margaret ellis and my sink is clogged', d);
    expect(r).toEqual({ kind: 'blocked', by: 'review', found: [] });
    expect(cloud).not.toHaveBeenCalled();
  });

  it('a clean review lets the covered words go', async () => {
    const review = vi.fn(async () => false);
    const { d, cloud } = deps({ ref: 'drain-unclog', kind: 'price' }, review);
    const r = await escalate(coverWords('My phone number is 555-0134, my sink is clogged').text, d);
    expect(review).toHaveBeenCalledWith('My phone number is [phone], my sink is clogged');
    expect(cloud).toHaveBeenCalledWith('My phone number is [phone], my sink is clogged', index);
    expect(r).toMatchObject({ kind: 'found', entry: index[1], reviewed: true });
  });

  it('an empty index sends nothing', async () => {
    const cloud = vi.fn();
    expect(await escalate('My tap keeps dripping', { index: async () => [], cloud })).toEqual({ kind: 'no-index' });
    expect(cloud).not.toHaveBeenCalled();
  });
});
