// The router: when what the device produced is good enough, and when WeKnow moves to the cloud by itself, and why.
import { describe, expect, it } from 'vitest';
import { acceptChoice, afterConsent, gate, route, type IndexEntry } from '../router';

describe('route', () => {
  it('words: a device hit stays; anything else escalates as no-match', () => {
    expect(route({ input: 'words', hit: true, found: 3, model: false, words: 2 })).toEqual({ escalate: false, reason: null });
    expect(route({ input: 'words', hit: false, found: 0, model: true, words: 2 })).toEqual({ escalate: true, reason: 'no-match' });
    expect(route({ input: 'words', hit: false, found: 4, model: true, words: 2 })).toEqual({ escalate: true, reason: 'no-match' });
    expect(route({ input: 'words', hit: false, found: 4, model: false, words: 2 })).toEqual({ escalate: true, reason: 'no-match' });
    expect(route({ input: 'words', hit: false, found: 0, model: false, words: 2 })).toEqual({ escalate: true, reason: 'no-match' });
  });

  it('words with nothing to look up never go', () => {
    expect(route({ input: 'words', hit: false, found: 0, model: false, words: 0 }).escalate).toBe(false);
  });

  it('pictures: no model escalates; unknown, no guide and none chosen escalate; quotes and bills stay', () => {
    expect(route({ input: 'picture', ranOn: 'cloud', model: false, kind: 'unknown', words: 3 }).escalate).toBe(false);
    expect(route({ input: 'picture', ranOn: 'device', model: false, words: 3 }).reason).toBe('no-device-model');
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'unknown', words: 3 }).reason).toBe('unknown-picture');
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'problem', offered: 0, chosen: false, words: 3 }).reason).toBe('no-guide');
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'problem', offered: 4, chosen: false, words: 3 }).reason).toBe('none-chosen');
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'problem', offered: 4, chosen: true, words: 3 }).escalate).toBe(false);
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'quote', words: 3 }).escalate).toBe(false);
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'bill', words: 3 }).escalate).toBe(false);
    // "What should I know about this?" holds no job words: there is nothing to send instead of the picture.
    expect(route({ input: 'picture', ranOn: 'device', model: true, kind: 'unknown', words: 0 }).escalate).toBe(false);
  });

  it('quote lines the pack does not know escalate as unknown-price', () => {
    expect(route({ input: 'quote-lines', unknown: 2 })).toEqual({ escalate: true, reason: 'unknown-price' });
    expect(route({ input: 'quote-lines', unknown: 0 }).escalate).toBe(false);
  });
});

describe('gate and consent', () => {
  it('auto goes, ask-once and every ask, never and offline stay', () => {
    expect(gate('auto', true)).toBe('go');
    expect(gate('ask-once', true)).toBe('ask');
    expect(gate('every', true)).toBe('ask');
    expect(gate('never', true)).toBe('stay');
    expect(gate('auto', false)).toBe('stay');
  });

  it('the one consent sheet sets the choice; a per-time sheet does not change it', () => {
    expect(afterConsent('ask-once', 'yes')).toBe('auto');
    expect(afterConsent('ask-once', 'every')).toBe('every');
    expect(afterConsent('ask-once', 'no')).toBe('never');
    expect(afterConsent('every', 'yes')).toBe('every');
    expect(afterConsent('every', 'no')).toBe('every');
  });
});

describe('acceptChoice: the cloud may only name a ref it was offered', () => {
  const index: IndexEntry[] = [
    { ref: 'diy-faucet-drip', name: 'Fix a dripping faucet', kind: 'guide' },
    { ref: 'plumber-service-call', name: 'Plumber service call', kind: 'price' },
  ];
  it('keeps a ref from the index, with the kind from the index', () => {
    expect(acceptChoice({ ref: 'diy-faucet-drip', kind: 'price' }, index)).toEqual(index[0]);
  });
  it('rejects an unknown ref, null, and malformed answers', () => {
    expect(acceptChoice({ ref: 'diy-vacuum-belt', kind: 'guide' }, index)).toBeNull();
    expect(acceptChoice({ ref: null, kind: null }, index)).toBeNull();
    expect(acceptChoice('diy-faucet-drip', index)).toBeNull();
    expect(acceptChoice(null, index)).toBeNull();
    expect(acceptChoice({ ref: 42 }, index)).toBeNull();
  });
});
