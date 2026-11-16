// @vitest-environment happy-dom
// Ask as one conversation, end to end with the reader stubbed: what a picture answer offers next, how follow-up
// words keep the topic, and that an unclear problem is asked about instead of guessed. Nothing here reads a picture
// with a model; the reading is a hand-written fixture.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Guide, Pack, PriceItem } from '../../core/packs';
import type { Understanding } from '../../core/understanding';

vi.mock('../../engine/speech', () => ({
  sayAloud: () => Promise.resolve(),
  quiet: () => undefined,
  listening: async () => 'device',
  listenForQuestion: async () => ({ stop() {}, done: Promise.resolve('') }),
  matchWord: () => null,
  soundStart: () => undefined,
  soundEnd: () => undefined,
  wait: () => Promise.resolve(),
}));
vi.mock('../../engine/camera', () => ({ permission: async () => 'prompt', torch: async () => false }));
vi.mock('../../engine/device', async () => {
  const { createStore } = await import('../../store/store');
  return {
    deviceStore: createStore({ online: true, model: 'available', pct: null, almost: false }),
    deviceWord: () => 'phone',
    getReady: async () => true,
    useDevice: () => ({}),
  };
});
vi.mock('../../image', () => ({ shrinkPhoto: async (b: Blob) => b }));
// No Firebase here: Remote Config phrases and price requests are not part of what is tested.
vi.mock('../../config', () => ({ matchesPhrase: () => false }));
vi.mock('../../firebase', () => ({ ensureUser: async () => undefined }));
vi.mock('../../requests', () => ({ requestPrice: async () => false }));

const pads: PriceItem = { ref: 'brake-pads', name: 'Replace brake pads (one axle)', aliases: [], unit: 'axle', low: 148, typical: 271, high: 394, sources: [{ url: 'https://example.org/a' }] };
const sink: Guide = {
  ref: 'sink',
  name: 'Clear a clogged or slow kitchen sink',
  aliases: [],
  minutes: [10, 45],
  steps: ['Pour hot water.', 'Use a plunger.'],
  proRefs: ['plumber'],
  sources: [{ url: 'https://example.org/g' }],
};
const plumber: PriceItem = { ref: 'plumber', name: 'Plumber clears a drain', aliases: [], unit: 'job', low: 150, typical: 358, high: 600, sources: [{ url: 'https://example.org/p' }] };
const disposal: Guide = { ...sink, ref: 'disposal', name: 'Reset a stuck garbage disposal' };
const pack: Pack = { id: 'us-home', version: '2026-11-12', region: 'US', currency: 'USD', prices: [pads, plumber], guides: [sink, disposal] };
const sub = (refs: Iterable<string>): Pack => {
  const r = [...refs];
  return { ...pack, prices: pack.prices.filter((p) => r.includes(p.ref)), guides: pack.guides.filter((g) => r.includes(g.ref)) };
};
const kb = {
  id: 'us-home',
  version: '2026-11-12',
  region: 'US',
  stats: () => ({ shards: [] }),
  candidates: async (_text: string, q: { kind: 'price' | 'guide' }) =>
    q.kind === 'guide' ? [sink, disposal].map((g) => ({ ref: g.ref, name: g.name, score: 1, kind: 'guide', shard: 'x' })) : [],
  resolve: async (refs: Iterable<string>) => sub(refs),
};
vi.mock('../../engine/knowledge', () => ({ knowledge: async () => kb, appSettings: async () => ({ cloudModel: 'x', urgencyPhrases: [] }) }));

let understanding: Understanding;
let readingPack: Pack;
vi.mock('../../reader', () => ({
  setCloudModel: () => undefined,
  readPhoto: async () => ({ understanding, where: 'device', ms: 5, steps: { read: 5, choose: 0 }, pack: readingPack, retrieval: { shards: [], bytes: 0, offered: 1, trimmed: 0 } }),
  chooseForQuestion: async () => ({ ref: null, offered: 2 }),
}));

const base: Understanding = { kind: 'unknown', lines: [], problemRef: null, payee: null, payTo: null, urgent: false, addressedToAI: false, accountChange: false };
const C = await import('../conversation');
const F = await import('../flows');
const { setPrefs } = await import('../../store/prefs');

const nextLabels = () => C.view().next.map((n) => n.label);
const press = (label: string) => C.view().next.find((n) => n.label === label)!.act();

beforeEach(() => {
  F.startAgain();
  C.detach();
  // The local route only: what the device does by itself (ask/__tests__/route.test.ts covers the cloud step).
  setPrefs({ offerNotes: true, offeredReady: true, internet: 'never' });
});

describe('a picture answer in the conversation', () => {
  it('a quote: the point first, a Careful tag, the person’s message with the picture, then the next questions', async () => {
    understanding = { ...base, kind: 'quote', payee: null, lines: [{ label: 'Rear brake pads', amount: 540, ref: 'brake-pads' }, { label: 'Shop supplies', amount: 45, ref: null }] };
    readingPack = sub(['brake-pads']);
    C.attach(new Blob(['q'], { type: 'image/png' }), 'quote');
    expect(F.send('')).toBe(true);
    await vi.waitFor(() => expect(nextLabels()).toContain('What should I say to the shop?'));
    expect(nextLabels()).toContain('Which lines did you not check?');
    expect(C.view().head).toEqual({ tone: 'warn', text: 'Line 1 is $146 more than usual.', icon: undefined });
    const me = C.view().history.find((m) => m.who === 'me');
    expect(me).toMatchObject({ who: 'me', text: 'What should I know about this?' });
    expect(me && me.who === 'me' && me.picture).toBeTruthy();
    expect(C.view().chosen).toBeNull();

    // A next question is asked as the person's message, and answered under it.
    press('What should I say to the shop?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('Say this to the shop'));
    expect(C.view().history.at(-1)).toMatchObject({ who: 'me', text: 'What should I say to the shop?' });
    expect(C.view().lines[0].text).toMatch(/Could you go over/);

    // Follow-up words that name nothing are about the quote.
    F.send('Is that fair?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('Line 1 is $146 more than usual.'));
  });

  it('a bill from a company not seen before: Careful, What should I do now, Remember this company', async () => {
    understanding = { ...base, kind: 'bill', payee: 'Riverbend Electric Co-op', payTo: '9917' };
    readingPack = sub([]);
    C.attach(new Blob(['b'], { type: 'image/png' }), 'bill');
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(nextLabels()).toEqual(['What should I do now?', 'Remember this company', 'Remind me to pay it']));
    expect(C.view().head?.tone).toBe('warn');
  });

  it('a picture it cannot place asks what it is, with buttons', async () => {
    understanding = { ...base, kind: 'unknown' };
    readingPack = sub([]);
    C.attach(new Blob(['u'], { type: 'image/png' }));
    F.send('');
    await vi.waitFor(() => expect(nextLabels()).toEqual(['It’s a quote or a bill', 'Something is broken', 'Something else']));
  });

  it('a problem the reader is not sure about offers likely guides and None of these, never a guess', async () => {
    understanding = { ...base, kind: 'problem', problemRef: null };
    readingPack = sub([]);
    C.attach(new Blob(['p'], { type: 'image/png' }));
    F.send('Water under the sink');
    await vi.waitFor(() => expect(nextLabels()).toEqual(['Clear a clogged or slow kitchen sink', 'Reset a stuck garbage disposal', 'None of these']));
    press('Clear a clogged or slow kitchen sink');
    await vi.waitFor(() => expect(nextLabels()).toEqual(['Show me the steps', 'How much would a pro charge?']));
    expect(C.view().head?.text).toBe('I have a guide for this: Clear a clogged or slow kitchen sink.');

    // "How much to fix it?" names nothing: it is about the sink.
    F.send('How much to fix it?');
    await vi.waitFor(() => expect(C.view().head?.text).toMatch(/\$150 to \$600/));

    // The steps are messages; Next step moves on, the earlier step stays in the conversation.
    press('Show me the steps');
    await vi.waitFor(() => expect(C.view().phase).toBe('guide'));
    C.pressGuide('next');
    await vi.waitFor(() => expect(C.view().steps?.n).toBe(1));
    C.pressGuide('next');
    await vi.waitFor(() => expect(C.view().steps?.n).toBe(2));
    expect(C.view().history.some((m) => m.who === 'wk' && m.steps?.n === 1)).toBe(true);
  });
});
