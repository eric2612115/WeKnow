// The one internet choice replaced two yes/no answers; saved prefs from before map onto it.
import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, migratePrefs } from '../prefs';

describe('migratePrefs', () => {
  it('a yes without "ask every time" becomes When it helps', () => {
    expect(migratePrefs({ consented: true, askEvery: false } as never).internet).toBe('auto');
  });
  it('"ask every time" stays Ask me every time, with or without a yes', () => {
    expect(migratePrefs({ consented: true, askEvery: true } as never).internet).toBe('every');
    expect(migratePrefs({ consented: false, askEvery: true } as never).internet).toBe('every');
  });
  it('nothing answered yet asks once', () => {
    expect(migratePrefs({ consented: false, askEvery: false } as never).internet).toBe('ask-once');
    expect(migratePrefs({}).internet).toBe('ask-once');
  });
  it('a saved choice wins, the old fields are dropped, and other prefs are kept', () => {
    const p = migratePrefs({ internet: 'never', consented: true, voice: false } as never);
    expect(p.internet).toBe('never');
    expect(p.voice).toBe(false);
    expect('consented' in p).toBe(false);
    expect({ ...p, voice: true }).toEqual({ ...DEFAULT_PREFS, internet: 'never' });
  });
  it('an unknown saved value asks once', () => {
    expect(migratePrefs({ internet: 'sometimes' } as never).internet).toBe('ask-once');
  });
});
