import { describe, expect, it } from 'vitest';
import { billAnswer, knownSentences, lineItems, listNames, quoteSummary, sayToShop, tagText, whereRan } from '../compose';
import { billVerdict, priceVerdict, type LineVerdict } from '../../core/verdict';
import type { PriceItem } from '../../core/packs';
import type { Understanding } from '../../core/understanding';

const pads: PriceItem = { ref: 'brake-pads', name: 'Replace brake pads (one axle)', aliases: [], unit: 'axle', low: 148, typical: 271, high: 394, sources: [{ url: 'https://example.org/a' }] };
const cabin: PriceItem = { ref: 'cabin-air-filter', name: 'Replace the cabin air filter', aliases: [], unit: 'job', low: 40, typical: 135.5, high: 231, sources: [{ url: 'https://example.org/b' }] };

// The brake quote fixture as the cloud model read it on 2026-11-16 (two lines matched, three not in the pack).
const verdicts: LineVerdict[] = [
  priceVerdict(540, pads),
  { kind: 'unknown', label: 'Front brake rotors resurface', amount: 180 },
  { kind: 'unknown', label: 'Brake fluid flush', amount: 160 },
  priceVerdict(95, cabin),
  { kind: 'unknown', label: 'Shop supplies', amount: 45 },
];
const labels = ['Rear brake pads replacement (parts + labor)', 'Front brake rotors resurface', 'Brake fluid flush', 'Cabin air filter', 'Shop supplies'];

describe('quote answers', () => {
  const items = lineItems(verdicts, labels);

  it('keeps the printed label and the pack verdict for every line', () => {
    expect(items.map((i) => i.state)).toEqual(['high', 'pending', 'pending', 'fair', 'pending']);
    expect(items[0]).toMatchObject({ n: 1, label: labels[0], amount: 540, over: 146, typical: 271 });
  });

  it('says what it knows and what it does not, in words', () => {
    expect(knownSentences(items)).toEqual([
      'I know two lines.',
      'Three I do not: front brake rotors resurface, brake fluid flush and shop supplies.',
    ]);
    expect(knownSentences(items.slice(0, 1))).toEqual(['I know this line.']);
    expect(knownSentences([items[0], items[3]])).toEqual(['I know all two lines.']);
  });

  it('every number in the summary comes from the pack item or the paper', () => {
    const s = quoteSummary(items);
    expect(s.verdict).toEqual({ tone: 'warn', text: 'One line is high' });
    expect(s.sentences).toEqual([
      'Line 1, rear brake pads replacement (parts + labor), is $146 high.',
      'Most shops charge about $271. One line looks fair. Three are not checked.',
    ]);
    expect(sayToShop(s.worst!)).toBe('“Could you go over the rear brake pads replacement (parts + labor) with me? Other shops charge about $271.”');
  });

  it('nothing high is fair; nothing known cannot be judged; nothing read asks to come closer', () => {
    expect(quoteSummary(items.filter((i) => i.state !== 'high')).verdict.tone).toBe('ok');
    expect(quoteSummary(items.filter((i) => i.state === 'pending')).verdict).toEqual({ tone: 'plain', text: 'I can’t check these prices yet' });
    expect(quoteSummary([]).sentences).toEqual(['I can’t read the small words. Move closer to the top half.']);
  });

  it('joins names the way people say them', () => {
    expect(listNames(['A'])).toBe('a');
    expect(listNames(['A', 'B', 'C'])).toBe('a, b and c');
  });
});

describe('bill answers', () => {
  const u = (o: Partial<Understanding>): Understanding => ({
    kind: 'bill',
    lines: [],
    problemRef: null,
    payee: 'Riverbend Electric Co-op',
    payTo: '9917',
    urgent: false,
    addressedToAI: false,
    ...o,
  });

  it('a changed account after a note is a stop, said from the note', () => {
    const known = [{ name: 'Riverbend Electric Co-op', payTo: '4821' }];
    const a = billAnswer(billVerdict(u({}), '', known), 'Riverbend Electric Co-op', known);
    expect(a.verdict).toEqual({ tone: 'stop', text: 'Don’t pay this yet' });
    expect(a.reasons[0]).toEqual({ text: 'One. The account is new. You paid them at one ending 4821 before.', fromNote: true });
    expect(a.doLine).toBe('Call the company first. Use the number on an older bill.');
  });

  it('hidden words aimed at a reader make it a stop, and come first', () => {
    const a = billAnswer(billVerdict(u({ addressedToAI: true }), '', []), 'Riverbend Electric Co-op', []);
    expect(a.verdict.tone).toBe('stop');
    expect(a.reasons.map((r) => r.text)).toEqual([
      'One. It has hidden words that try to tell a reader it is safe.',
      'Two. I have no note of paying Riverbend Electric Co-op before.',
    ]);
  });

  it('a new payee alone is "check this first"; a known payee and account is normal', () => {
    expect(billAnswer(billVerdict(u({}), '', []), 'Riverbend Electric Co-op', []).verdict.tone).toBe('warn');
    const known = [{ name: 'Riverbend Electric Co-op', payTo: '9917' }];
    expect(billAnswer(billVerdict(u({}), '', known), 'Riverbend Electric Co-op', known).verdict).toEqual({ tone: 'ok', text: 'This looks normal' });
  });
});

describe('where it ran', () => {
  it('names the device, never a model', () => {
    expect(whereRan({ where: 'cloud', online: true, sent: 0, pending: 0 })).toBe('cloud');
    expect(whereRan({ where: 'device', online: true, sent: 1, pending: 0 })).toBe('mixed');
    expect(whereRan({ where: 'device', online: true, sent: 3, pending: 3 })).toBe('pending');
    expect(whereRan({ where: 'device', online: false, sent: 0, pending: 0 })).toBe('offline');
    expect(tagText({ w: 'local', n: 0 }, 'phone')).toBe('On this phone');
    expect(tagText({ w: 'pending', n: 3 }, 'phone')).toBe('3 items not checked');
    expect(tagText({ w: 'mixed', n: 1 }, 'computer')).toBe('Used the internet for 1 item');
  });
});
