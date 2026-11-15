// The choose prompt (stage C) must fit the model that reads it: Chrome's Gemini Nano (~9k tokens of context)
// or Apple's on-device model (4,096 tokens). Tokens are counted pessimistically (every digit and symbol is a
// token, the rest 2.5 characters per token), readings are capped at 30 lines of 120 characters, and stage B
// trims the candidate lists until the prompt fits. These tests hold it to that, including the worst case.

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { BUDGETS, capLines, chooseTokens, estimateTokens, fitChoices, MAX_LABEL_CHARS, MAX_LINES, type ChoiceItem } from '../budget';
import { open, server, shippedFiles, shippedPack, truthQuotes } from './fixtures';

const files = shippedFiles();
const pack = shippedPack();
const longest = [...pack.prices].sort((a, b) => b.ref.length + b.name.length - a.ref.length - a.name.length).slice(0, 5);
const label = {
  letters: 'X'.repeat(120),
  shop: 'FRT BRAKE PADS & ROTORS R&R - LABOR 2.5 HRS @ $145/HR, PARTS #BP-4471-A (OEM), SHOP SUPPLIES 8%, DISPOSAL FEE / TAX',
  digits: '1234567890'.repeat(12),
};

describe('counting tokens pessimistically', () => {
  it('every digit and every symbol is a token; letters count one per 2.5 characters', () => {
    expect(estimateTokens('2026-11-16')).toBe(10);
    expect(estimateTokens('brake')).toBe(2);
    expect(estimateTokens('iphone-16-pro-max-battery-apple')).toBe(2 + 5 + Math.ceil(24 / 2.5)); // 2 digits, 5 hyphens, 24 letters
    expect(estimateTokens('漢字')).toBe(2);
  });

  it('is never more optimistic than 3 characters per token (property)', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 400, unit: 'grapheme' }), (s) => {
        expect(estimateTokens(s)).toBeGreaterThanOrEqual(Math.ceil([...s].length / 3));
      }),
      { numRuns: 500 },
    );
  });
});

describe('caps on a reading', () => {
  it('a reading keeps at most 30 lines of at most 120 characters, whatever the model returned', () => {
    const lines = Array.from({ length: 45 }, (_, i) => ({ label: i % 3 ? 'Y'.repeat(300) : (i as unknown as string), amount: i }));
    const capped = capLines(lines);
    expect(capped).toHaveLength(MAX_LINES);
    expect(capped.every((l) => typeof l.label === 'string' && l.label.length <= MAX_LABEL_CHARS)).toBe(true);
    expect(capped[0]).toEqual({ label: '0', amount: 0 });
    expect(capLines(undefined as unknown as [])).toEqual([]);
  });

  it('the choose step never sees more than 30 lines or a label over 120 characters', () => {
    const items: ChoiceItem[] = Array.from({ length: 60 }, (_, i) => ({ i, text: 'Z'.repeat(500), options: [longest[0]] }));
    const fit = fitChoices(items, BUDGETS.cloud);
    expect(fit.items).toHaveLength(MAX_LINES);
    expect(fit.dropped).toBe(30);
    expect(fit.items.every((it) => it.text.length <= MAX_LABEL_CHARS)).toBe(true);
  });
});

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

  for (const [what, text] of Object.entries(label)) {
    it(`the worst case (30 lines of 120 ${what} characters, the 5 longest names each) fits Nano and Apple, every line kept with its best option`, () => {
      const items: ChoiceItem[] = Array.from({ length: 30 }, (_, i) => ({ i, text, options: longest }));
      expect(chooseTokens(items)).toBeGreaterThan(BUDGETS.nano.chooseInputTokens); // it really is too big untrimmed
      for (const budget of [BUDGETS.nano, BUDGETS.apple]) {
        const fit = fitChoices(items, budget);
        expect(fit.tokens).toBeLessThanOrEqual(budget.chooseInputTokens);
        expect(fit.dropped).toBe(0);
        expect(fit.items).toHaveLength(30);
        expect(fit.items.every((it) => it.options[0].ref === longest[0].ref)).toBe(true);
      }
    });
  }

  it('fitting never exceeds the budget and only shortens lists and labels from the end (property)', () => {
    const option = fc.record({ ref: fc.stringMatching(/^[a-z0-9-]{3,40}$/), name: fc.string({ maxLength: 80 }) });
    const item = fc.record({ text: fc.string({ maxLength: 200 }), options: fc.array(option, { minLength: 1, maxLength: 5 }) });
    fc.assert(
      fc.property(fc.array(item, { maxLength: 60 }), fc.constantFrom(BUDGETS.nano, BUDGETS.apple), (raw, budget) => {
        const items = raw.map((r, i) => ({ ...r, i }));
        const fit = fitChoices(items, budget);
        expect(fit.items.length).toBeLessThanOrEqual(MAX_LINES);
        expect(fit.tokens <= budget.chooseInputTokens || fit.items.length === 0).toBe(true);
        fit.items.forEach((it, j) => {
          expect(it.i).toBe(items[j].i);
          expect(items[j].text.startsWith(it.text)).toBe(true);
          expect(it.options).toEqual(items[j].options.slice(0, it.options.length));
          expect(it.options.length).toBeGreaterThan(0);
        });
      }),
      { numRuns: 300 },
    );
  });
});
