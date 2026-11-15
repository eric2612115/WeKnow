// The choose prompt (stage C) must fit the model that reads it: Chrome's Gemini Nano (~9k tokens of context)
// or Apple's on-device model (4,096 tokens). Stage B trims candidate lists to fit; these tests hold it to that.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BUDGETS, chooseTokens, fitChoices, type ChoiceItem } from '../budget';
import { open, server, shippedFiles, shippedPack, truthQuotes } from './fixtures';

const files = shippedFiles();
const pack = shippedPack();

describe('prompt budgets', () => {
  it('every labelled eval quote fits both on-device budgets with five candidates per line, no trimming', async () => {
    const kb = await open(server(files));
    let worst = 0;
    for (const lines of truthQuotes()) {
      const items: ChoiceItem[] = [];
      for (const [i, l] of lines.entries()) items.push({ i, text: l.label, options: await kb.candidates(l.label, { kind: 'price', k: 5 }) });
      worst = Math.max(worst, chooseTokens(items));
      expect(fitChoices(items, BUDGETS.apple).trimmed).toBe(0);
    }
    expect(worst).toBeLessThanOrEqual(BUDGETS.apple.chooseInputTokens);
  });

  it('the worst case (30 long lines, the longest names) is trimmed to fit, keeping every line and its best option', () => {
    const longest = [...pack.prices].sort((a, b) => b.ref.length + b.name.length - a.ref.length - a.name.length).slice(0, 5);
    const items: ChoiceItem[] = Array.from({ length: 30 }, (_, i) => ({ i, text: 'X'.repeat(120), options: longest }));
    for (const budget of [BUDGETS.nano, BUDGETS.apple]) {
      const fit = fitChoices(items, budget);
      expect(fit.tokens).toBeLessThanOrEqual(budget.chooseInputTokens);
      expect(fit.dropped).toBe(0);
      expect(fit.items.every((it) => it.options[0].ref === longest[0].ref)).toBe(true);
    }
  });

  it('fitting never exceeds the budget and only removes options from the end of a list (property)', () => {
    const option = fc.record({ ref: fc.stringMatching(/^[a-z]{3,30}$/), name: fc.string({ maxLength: 80 }) });
    const item = fc.record({ text: fc.string({ maxLength: 120 }), options: fc.array(option, { minLength: 1, maxLength: 5 }) });
    fc.assert(
      fc.property(fc.array(item, { maxLength: 40 }), fc.constantFrom(BUDGETS.nano, BUDGETS.apple), (raw, budget) => {
        const items = raw.map((r, i) => ({ ...r, i }));
        const fit = fitChoices(items, budget);
        expect(fit.tokens <= budget.chooseInputTokens || fit.items.length === 0).toBe(true);
        fit.items.forEach((it, j) => {
          expect(it.i).toBe(items[j].i);
          expect(it.options).toEqual(items[j].options.slice(0, it.options.length));
          expect(it.options.length).toBeGreaterThan(0);
        });
      }),
      { numRuns: 300 },
    );
  });
});
