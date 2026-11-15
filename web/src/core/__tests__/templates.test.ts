import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseChoice, parseLine } from '../templateParse';

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
