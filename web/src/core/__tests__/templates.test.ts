import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { lastFour, parseChoice, parseLine, withRetry } from '../templateParse';

describe('parsing template output', () => {
  it('splits a line into label and amount', () => {
    expect(parseLine('Brake fluid flush || 160.00')).toEqual({ label: 'Brake fluid flush', amount: 160 });
    expect(parseLine('Labor || $1,240.50')).toEqual({ label: 'Labor', amount: 1240.5 });
    expect(parseLine('No amount here')).toEqual({ label: 'No amount here', amount: null });
    expect(parseLine('Odd || ')).toEqual({ label: 'Odd', amount: null });
  });
  it('reads a choice or none, and rejects anything else', () => {
    expect(parseChoice('0 || brake-pads')).toEqual({ i: 0, ref: 'brake-pads' });
    expect(parseChoice('3 || none')).toEqual({ i: 3, ref: null });
    expect(parseChoice('brake-pads')).toBeNull();
    expect(parseChoice('1 || two words')).toBeNull();
  });
  it('never throws on any text', () => {
    fc.assert(fc.property(fc.string(), (s) => {
      parseLine(s);
      parseChoice(s);
    }));
  });
});

describe('plain-code guards around the cloud', () => {
  it('keeps only the last four digits of an account', () => {
    expect(lastFour('ending in 9917.')).toBe('9917');
    expect(lastFour('1234 5678 9917')).toBe('9917');
    expect(lastFour('[masked]')).toBeNull();
    expect(lastFour(null)).toBeNull();
  });
  it('retries rate limits, not other errors', async () => {
    let n = 0;
    const flaky = () => (++n < 3 ? Promise.reject(new Error('fetch: [429 ] quota')) : Promise.resolve('ok'));
    await expect(withRetry(flaky, [1, 1, 1])).resolves.toBe('ok');
    let m = 0;
    const broken = () => (++m, Promise.reject(new Error('[400 ] bad request')));
    await expect(withRetry(broken, [1, 1, 1])).rejects.toThrow('400');
    expect(m).toBe(1);
  });
});
