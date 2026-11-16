// A web answer for a problem the packs do not cover: kept only with https sources, never with prices.
import { describe, expect, it } from 'vitest';
import { parseWebAnswer, webSources, withoutPrices } from '../webAnswer';

const src = [{ url: 'https://example.org/vacuum', title: 'Vacuum help', fetched: '2026-11-16' }];
const text = `Most loss of suction comes from a full bin or a clog.
{"title": "Vacuum has no suction", "steps": ["Empty the bin", "Check the hose for a clog, a new hose costs about $25", "Clean the filter ($10 to $20 to replace)"], "safety": "Unplug it before you open it.", "callPro": null}`;

describe('parseWebAnswer', () => {
  it('reads the last JSON line: title, plain steps without money amounts, safety', () => {
    const r = parseWebAnswer(text, src);
    expect(r.answer).toEqual({
      title: 'Vacuum has no suction',
      steps: ['Empty the bin.', 'Check the hose for a clog, a new hose.', 'Clean the filter.'],
      safety: 'Unplug it before you open it.',
      callPro: null,
      sources: src,
    });
    expect(JSON.stringify(r.answer)).not.toMatch(/\$\s?\d/);
  });

  it('no sources: not shown', () => {
    expect(parseWebAnswer(text, [])).toEqual({ answer: null, reason: 'no web sources' });
    expect(parseWebAnswer(text, [{ url: 'http://example.org/plain' }])).toEqual({ answer: null, reason: 'no web sources' });
  });

  it('no JSON, {"none": true}, unreadable JSON or no steps: not shown', () => {
    expect(parseWebAnswer('I could not find anything.', src).answer).toBeNull();
    expect(parseWebAnswer('Nothing found. {"none": true}', src)).toEqual({ answer: null, reason: 'none in sources' });
    expect(parseWebAnswer('{"title": "x", "steps": [', src).answer).toBeNull();
    expect(parseWebAnswer('{"title": "x", "steps": []}', src)).toEqual({ answer: null, reason: 'no steps' });
  });

  it('at most six steps', () => {
    const many = JSON.stringify({ title: 't', steps: Array.from({ length: 9 }, (_, i) => `Step ${i + 1}`) });
    expect(parseWebAnswer(many, src).answer?.steps).toHaveLength(6);
  });
});

describe('webSources and withoutPrices', () => {
  it('keeps https pages once each', () => {
    const s = webSources([{ web: { uri: 'https://a.org/x', title: 'A' } }, { web: { uri: 'https://a.org/x' } }, { web: { uri: 'http://b.org' } }, {}], '2026-11-16');
    expect(s).toEqual([{ url: 'https://a.org/x', title: 'A', fetched: '2026-11-16' }]);
  });
  it('removes money amounts and ranges', () => {
    expect(withoutPrices('A pro charges $150-$300 for this.')).toBe('A pro charges for this.');
    expect(withoutPrices('Replace the belt (about $12).')).toBe('Replace the belt.');
  });
});
