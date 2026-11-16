import { describe, expect, it } from 'vitest';
import { aboutPicture, lean, matchStrength, pickLexical, priceAnswer, stem, terms } from '../words';
import type { PriceItem } from '../../core/packs';

// Pack items as they are in public/packs/us-home.json (sources trimmed).
const pads: PriceItem = {
  ref: 'brake-pads',
  category: 'car-service',
  name: 'Replace brake pads (one axle)',
  aliases: ['brake pads', 'brake pad replacement', 'replace brake pads', 'squeaky brakes', 'brakes squeaking', 'front brake pads', 'rear brake pads'],
  unit: 'axle',
  low: 148,
  typical: 271,
  high: 394,
  includes: 'Pads only, parts and labor for one axle (typical = midpoint)',
  sources: [
    { url: 'https://jerry.ai/car-repair/estimates/brake-pads-replacement/', title: 'How Much Does a Brake Pad Replacement Cost? - Jerry', fetched: '2026-11-12' },
    { url: 'https://www.consumeraffairs.com/automotive/cost-to-replace-brake-pads-and-rotors.html', fetched: '2026-11-10' },
  ],
};
const sink = {
  name: 'Clear a clogged or slow kitchen sink',
  aliases: ['kitchen sink clogged', "kitchen sink won't drain", 'kitchen sink draining slowly', 'kitchen drain is blocked'],
};
const odor = { name: 'Get rid of a smelly sink or garbage disposal', aliases: ['garbage disposal smells', 'kitchen sink smells', 'stinky drain'] };
const phrases = (x: { name: string; aliases: string[] }) => [x.name, ...x.aliases];

describe('picture or words', () => {
  it('a question that points at something needs the picture', () => {
    for (const q of [
      'What is this?',
      'How do I fix it?',
      'Is this a fair price?',
      'Should I pay this?',
      'What are these marks on the wall?',
      'Is that too much?',
      'Can you read this bill?',
      'Look at this quote',
      'Is my bill right?',
      'They want $540 for brake pads',
      'Is the price on the picture fair?',
      'Read the paper for me',
      'What’s wrong here?',
    ])
      expect(aboutPicture(q), q).toBe(true);
  });

  it('a question that names the job is answered from words', () => {
    for (const q of [
      'How much does a brake pad replacement cost?',
      'How do I unclog a kitchen sink?',
      'How much does it cost to replace a water heater?',
      'How much is it to replace brake pads',
      'How long does it take to unclog a toilet?',
      'My garbage disposal won’t turn on',
      'What does a plumber charge per hour?',
    ])
      expect(aboutPicture(q), q).toBe(false);
  });

  it('leans to a price or a guide from its words', () => {
    expect(lean('How much does a brake pad replacement cost?')).toBe('price');
    expect(lean('What does a plumber charge per hour?')).toBe('price');
    expect(lean('How much to fix a leaking pipe?')).toBe('price');
    expect(lean('How do I unclog a kitchen sink?')).toBe('guide');
    expect(lean('My toilet keeps running and won’t stop')).toBe('guide');
    expect(lean('garbage disposal stuck')).toBe('guide');
    expect(lean('my kitchen faucet drips')).toBe('guide');
    expect(lean('brake pads')).toBe('both');
  });
});

describe('a confident match', () => {
  it('cuts words to plain stems and drops question and price words', () => {
    expect(stem('clogged')).toBe('clog');
    expect(stem('pads')).toBe('pad');
    expect(stem('brakes')).toBe('brake');
    expect(stem('dishes')).toBe('dish');
    expect(stem('leaking')).toBe('leak');
    expect(stem('unclog')).toBe('clog');
    expect(stem('under')).toBe('under');
    expect(terms('How much does a brake pad replacement cost?')).toEqual(['brake', 'pad']);
    expect(terms("Why won't my kitchen sink drain?")).toEqual(['kitchen', 'sink', 'drain']);
  });

  it('takes an item whose name or an alias shares at least half of its job words with the question', () => {
    expect(matchStrength('How much does a brake pad replacement cost?', phrases(pads))).toBeGreaterThanOrEqual(1);
    expect(matchStrength('How do I unclog a kitchen sink?', phrases(sink))).toBe(1);
    expect(matchStrength('front brakes squeaking', phrases(pads))).toBe(1);
  });

  it('a closer item is a stronger match', () => {
    const q = 'How do I unclog a kitchen sink?';
    expect(matchStrength(q, phrases(odor))).toBeLessThan(matchStrength(q, phrases(sink)));
  });

  it('does not take an item that only shares a word in passing', () => {
    // "kitchen" alone is one word of three in "kitchen sink smells"
    expect(matchStrength('My kitchen faucet drips', phrases(odor))).toBe(0);
    // price and question words never count: "replace" is not a job
    expect(matchStrength('How much to replace a roof?', phrases(pads))).toBe(0);
    expect(matchStrength('What is the capital of Mongolia?', phrases(pads))).toBe(0);
    expect(matchStrength('How much does it cost?', phrases(pads))).toBe(0);
    // one word of a two-word alias is not enough: "slow drain" is not "my laptop is slow"
    expect(matchStrength('My laptop is slow', ['Clear a slow shower or sink drain (hair clog)', 'slow drain'])).toBe(0);
    expect(matchStrength('How do I change a tire?', ['Check and fill car tire pressure', 'tire pressure', 'low tire'])).toBe(0);
  });

  it('picks the leaning kind when it is confident, else the stronger match, else nothing', () => {
    const price = { kind: 'price' as const, ref: 'p', strength: 0.5 };
    const guide = { kind: 'guide' as const, ref: 'g', strength: 1 };
    expect(pickLexical('price', [price, guide])).toBe(price);
    expect(pickLexical('guide', [price, guide])).toBe(guide);
    expect(pickLexical('both', [price, guide])).toBe(guide);
    expect(pickLexical('both', [price, { ...guide, strength: 0.5 }])).toBe(price);
    expect(pickLexical('price', [{ ...price, strength: 0 }, guide])).toBe(guide);
    expect(pickLexical('guide', [{ ...price, strength: 0 }, { ...guide, strength: 0 }])).toBeNull();
    expect(pickLexical('both', [])).toBeNull();
  });
});

describe('the price answer', () => {
  it('says the range, the typical price, what it covers and when it was checked, all from the pack item, never naming the source', () => {
    const a = priceAnswer(pads);
    expect(a.tone).toBe('plain');
    expect(a.head).toBe('This usually costs $148 to $394.');
    expect(a.lines).toEqual([
      'From my price book: Replace brake pads (one axle).',
      'Most people pay about $271, per axle.',
      'That covers pads only, parts and labor for one axle.',
      'The numbers come from the price book, checked November 12, 2026. Sources and details show where.',
    ]);
  });

  it('leaves out what the item does not have, and never shows half cents', () => {
    const a = priceAnswer({ ...pads, unit: 'job', typical: 1000.5, includes: undefined, sources: [{ url: 'https://www.example.org/x' }] });
    expect(a.lines).toEqual(['From my price book: Replace brake pads (one axle).', 'Most people pay about $1,001.', 'The numbers come from the price book. Sources and details show where.']);
    expect(a.lines.join(' ')).not.toContain('example.org');
  });
});

describe('follow-up words', () => {
  it('say what they ask about the topic, when they name nothing themselves', async () => {
    const { followUp } = await import('../words');
    expect(followUp('How much to fix it?')).toBe('cost');
    expect(followUp('How much would a plumber charge?')).toBe('cost');
    expect(followUp('Can I do it myself?')).toBe('fix');
    expect(followUp('How do I fix it?')).toBe('fix');
    expect(followUp('What should I say to the shop?')).toBe('say');
    expect(followUp('Should I pay this?')).toBe('pay');
    expect(followUp('Is that fair?')).toBe('fair');
    expect(followUp('My kitchen sink is clogged')).toBeNull();
  });
});

describe('a new thing is a replacement', () => {
  it('prefers replacing over repairing when the question says new', () => {
    const q = 'What does a new water heater cost?';
    expect(matchStrength(q, ['Replace a water heater'])).toBeGreaterThan(matchStrength(q, ['Repair a water heater']));
  });
});
