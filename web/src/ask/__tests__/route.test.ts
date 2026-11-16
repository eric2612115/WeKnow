// @vitest-environment happy-dom
// The hybrid route end to end, with the models stubbed: words this device cannot answer go online by themselves
// (after the one consent), covered; the cloud may only name an index ref, and the answer comes from the pack with a
// "Checked online" receipt that shows the exact words that went. Nothing goes when the review flags the words.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Guide, Pack, PriceItem } from '../../core/packs';

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
    deviceStore: createStore({ online: true, model: 'unavailable', pct: null, almost: false }),
    deviceWord: () => 'computer',
    getReady: async () => true,
    useDevice: () => ({}),
  };
});
vi.mock('../../image', () => ({ shrinkPhoto: async (b: Blob) => b }));
vi.mock('../../config', () => ({ matchesPhrase: () => false }));
vi.mock('../../firebase', () => ({ ensureUser: async () => undefined }));
vi.mock('../../requests', () => ({ requestPrice: async () => false }));

const faucet: Guide = {
  ref: 'diy-faucet-drip',
  name: 'Fix a dripping faucet',
  aliases: [],
  minutes: [20, 60],
  steps: ['Turn off the water.', 'Replace the cartridge.'],
  proRefs: ['plumber'],
  sources: [{ url: 'https://example.org/g' }],
};
const sink: Guide = { ...faucet, ref: 'diy-sink-clog', name: 'Clear a clogged kitchen sink' };
const plumber: PriceItem = { ref: 'plumber', name: 'Plumber service call', aliases: [], unit: 'job', low: 150, typical: 250, high: 400, sources: [{ url: 'https://example.org/p' }] };
const pack: Pack = { id: 'us-home', version: '2026-11-12', region: 'US', currency: 'USD', prices: [plumber], guides: [faucet, sink] };
const sub = (refs: Iterable<string>): Pack => {
  const r = [...refs];
  const guides = pack.guides.filter((g) => r.includes(g.ref));
  const pro = guides.flatMap((g) => g.proRefs ?? []);
  return { ...pack, prices: pack.prices.filter((p) => r.includes(p.ref) || pro.includes(p.ref)), guides };
};
const kb = {
  id: 'us-home',
  version: '2026-11-12',
  region: 'US',
  stats: () => ({ shards: [] }),
  // Plain search on this device finds nothing for these words.
  candidates: async () => [],
  resolve: async (refs: Iterable<string>) => sub(refs),
  index: async () => [
    { ref: faucet.ref, name: faucet.name, kind: 'guide' as const },
    { ref: sink.ref, name: sink.name, kind: 'guide' as const },
    { ref: plumber.ref, name: plumber.name, kind: 'price' as const },
  ],
};
vi.mock('../../engine/knowledge', () => ({ knowledge: async () => kb, appSettings: async () => ({ cloudModel: 'x', urgencyPhrases: [] }) }));

const sent: string[] = [];
let answer: (text: string) => unknown = () => null;
let flagged = false;
vi.mock('../../reader', () => ({
  setCloudModel: () => undefined,
  readPhoto: async () => {
    throw new Error('no picture in these tests');
  },
  chooseForQuestion: async () => ({ ref: null, offered: 0 }),
  chooseFromIndex: async (text: string) => {
    sent.push(text);
    return { raw: answer(text), ms: 321, model: 'gemini-test' };
  },
  reviewOnDevice: async () => flagged,
}));

let web: { answer: unknown; reason?: string } = { answer: null, reason: 'no web sources' };
const searched: string[] = [];
vi.mock('../../webSearch', () => ({
  searchWeb: async (text: string) => {
    searched.push(text);
    return { ...web, sent: text, ms: 654, model: 'gemini-test' };
  },
}));

const C = await import('../conversation');
const F = await import('../flows');
const { getPrefs, setPrefs } = await import('../../store/prefs');
const { deviceStore } = await import('../../engine/device');

beforeEach(() => {
  F.startAgain();
  C.detach();
  sent.length = 0;
  searched.length = 0;
  web = { answer: null, reason: 'no web sources' };
  flagged = false;
  answer = () => null;
  deviceStore.set((s) => ({ ...s, model: 'unavailable', online: true }));
  setPrefs({ offerNotes: true, offeredReady: true, internet: 'auto' });
});

describe('words this device cannot answer', () => {
  it('go online by themselves (When it helps), and the answer is the pack guide, labelled with what went', async () => {
    answer = () => ({ ref: 'diy-faucet-drip', kind: 'guide' });
    F.send('My tap keeps dripping');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I have a guide for this: Fix a dripping faucet.'));
    expect(C.view().sheet).toBeNull();
    expect(sent).toEqual(['My tap keeps dripping']);
    const r = C.view().receipt!;
    expect(r.w).toBe('cloud');
    expect(r.sent).toEqual(['Your words, covered: “My tap keeps dripping”', 'The names of the 3 guides and prices in my books (no personal details)']);
    expect(r.why).toBe('Why the internet: Nothing in the books on this computer clearly matched your words.');
    expect(r.tech.join(' ')).toMatch(/321 ms/);
    expect(C.view().next.map((n) => n.label)).toEqual(['Show me the steps', 'How much would a pro charge?']);
  });

  it('a phone number is covered before anything goes, and the receipt shows [phone]', async () => {
    answer = () => ({ ref: 'diy-sink-clog', kind: 'guide' });
    F.send('My phone number is 555-0134, my sink is clogged');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I have a guide for this: Clear a clogged kitchen sink.'));
    expect(sent).toEqual(['My phone number is [phone], my sink is clogged']);
    const r = C.view().receipt!;
    expect(r.sent[0]).toBe('Your words, covered: “My phone number is [phone], my sink is clogged”');
    expect(r.stayed).toContain('The details I covered: 1 phone number');
  });

  it('a ref that is not in the index is not used; with no sourced web answer it says so honestly', async () => {
    answer = () => ({ ref: 'diy-vacuum-belt', kind: 'guide' });
    F.send('My vacuum won’t pick anything up');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('It’s not in my books yet'));
    expect(sent).toHaveLength(1);
    expect(searched).toEqual(['My vacuum won’t pick anything up']);
    expect(C.view().lines.map((l) => l.text)).toContain('I also searched the web, but I could not find a reliable answer.');
    expect(C.view().receipt?.w).toBe('cloud');
  });

  it('not in the packs: a sourced web answer is shown as not WeKnow’s own guide, with its sources', async () => {
    web = {
      answer: {
        title: 'Vacuum not picking up',
        steps: ['Empty the bin.', 'Check the hose for a clog.'],
        safety: 'Unplug it first.',
        callPro: null,
        sources: [
          { url: 'https://example.org/a', title: 'Vacuum help', fetched: '2026-11-16' },
          { url: 'https://example.org/b', title: 'Fix a vacuum', fetched: '2026-11-16' },
        ],
      },
    };
    F.send('My vacuum won’t pick anything up');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('Vacuum not picking up'));
    expect(C.view().lines.map((l) => l.text)).toEqual([
      'I don’t have this in my guides. From 2 sources on the web:',
      'Empty the bin.',
      'Check the hose for a clog.',
      'Be careful: Unplug it first.',
    ]);
    const r = C.view().receipt!;
    expect(r.w).toBe('cloud');
    expect(r.sent).toContain('A web search for: “My vacuum won’t pick anything up”');
    expect(r.sources.map((x) => x.label)).toEqual(['Looked up online just now: Vacuum help', 'Looked up online just now: Fix a vacuum']);
  });

  it('with a phone number: the index gets the covered words, the web search only the job words', async () => {
    F.send('My phone number is 555-0134, my vacuum won’t pick anything up');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('It’s not in my books yet'));
    expect(sent).toEqual(['My phone number is [phone], my vacuum won’t pick anything up']);
    expect(searched).toEqual(['my vacuum won’t pick anything up']);
    expect(C.view().next).toEqual([]); // no plain-search guesses after the cloud saw the whole index
  });

  it('a price named for a described problem is not used: the web how-to is tried instead', async () => {
    answer = () => ({ ref: 'plumber', kind: 'price' });
    F.send('The pipe under my sink is dripping');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('It’s not in my books yet'));
    expect(sent).toHaveLength(1);
    expect(searched).toEqual(['The pipe under my sink is dripping']);
  });

  it('words with no personal details go without any sheet, even before the one consent', async () => {
    setPrefs({ internet: 'ask-once' });
    answer = () => ({ ref: 'diy-faucet-drip', kind: 'guide' });
    F.send('My tap keeps dripping');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I have a guide for this: Fix a dripping faucet.'));
    expect(sent).toEqual(['My tap keeps dripping']);
    expect(getPrefs().internet).toBe('ask-once'); // the consent is still asked for pictures and personal details
  });

  it('the first time, one consent sheet asks with the covered words; No keeps everything here, from then on', async () => {
    setPrefs({ internet: 'ask-once' });
    F.send('My phone number is 555-0134, my sink is clogged');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    const s = C.view().sheet!;
    expect(s.title).toBe('When this computer can’t answer, may I use the internet?');
    expect([s.yes, s.middle, s.no]).toEqual(['Yes, when it helps', 'Ask me every time', 'No']);
    expect(s.parcel[0]).toBe('“My phone number is [phone], my sink is clogged”');
    C.answerSheet(false);
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I don’t know that one yet'));
    expect(sent).toEqual([]);
    expect(getPrefs().internet).toBe('never');
  });

  it('when the review on this device still sees a personal detail, nothing is sent', async () => {
    deviceStore.set((s) => ({ ...s, model: 'available' }));
    flagged = true;
    answer = () => ({ ref: 'diy-sink-clog', kind: 'guide' });
    F.send('I am Margaret Ellis and my sink is clogged');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I did not send that'));
    expect(sent).toEqual([]);
    expect(C.view().receipt?.sent).toEqual([]);
    expect(C.view().next.map((n) => n.label)).toEqual(['Ask it differently', 'Take a picture']);
  });

  it('“Ask me every time” asks even for plain words', async () => {
    setPrefs({ internet: 'every' });
    F.send('My tap keeps dripping');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    expect(C.view().sheet!.middle).toBeUndefined();
    expect(C.view().sheet!.parcel[0]).toBe('“My tap keeps dripping”');
    C.answerSheet(false);
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I don’t know that one yet'));
    expect(sent).toEqual([]);
    expect(getPrefs().internet).toBe('every');
  });

  it('Never answers from this device only, and says how to change it', async () => {
    setPrefs({ internet: 'never' });
    F.send('My tap keeps dripping');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I don’t know that one yet'));
    expect(sent).toEqual([]);
    expect(C.view().lines.map((l) => l.text)).toContain('You set WeKnow to answer only from this computer. You can change that in Settings.');
  });
});
