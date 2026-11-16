// @vitest-environment happy-dom
// The wall on the cloud reading path: when this device cannot read pictures by itself, the picture is covered on the
// device first and only the covered copy reaches the cloud reader. The picture as taken never does, with or without
// the asking sheet; when the words cannot be read, nothing is read in the cloud at all.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pack } from '../../core/packs';
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
    // No built-in model: every picture goes the cloud path.
    deviceStore: createStore({ online: true, model: 'unavailable', pct: null, almost: false }),
    deviceWord: () => 'computer',
    getReady: async () => true,
    useDevice: () => ({}),
  };
});
const SMALL = new Blob(['small'], { type: 'image/jpeg' });
vi.mock('../../image', () => ({ shrinkPhoto: async () => SMALL }));
vi.mock('../../config', () => ({ matchesPhrase: () => false }));
vi.mock('../../firebase', () => ({ ensureUser: async () => undefined }));
vi.mock('../../requests', () => ({ requestPrice: async () => false }));

const pack: Pack = { id: 'us-home', version: '2026-11-12', region: 'US', currency: 'USD', prices: [], guides: [] };
const kb = {
  id: 'us-home',
  version: '2026-11-12',
  region: 'US',
  stats: () => ({ shards: [] }),
  candidates: async () => [],
  resolve: async () => pack,
};
vi.mock('../../engine/knowledge', () => ({ knowledge: async () => kb, appSettings: async () => ({ cloudModel: 'x', urgencyPhrases: [] }) }));

const COVERED = new Blob(['covered'], { type: 'image/jpeg' });
let coverFails = false;
const covered: Blob[] = [];
vi.mock('../../coverPicture', () => ({
  warmCover: async () => undefined,
  coverPicture: async (small: Blob) => {
    covered.push(small);
    if (coverFails) throw new Error('reading the words took longer than 8000 ms');
    return { blob: COVERED, url: 'blob:covered', details: [], counts: { name: 2, phone: 1, account: 1 }, words: 40, ms: { load: 1, read: 1, total: 2 } };
  },
}));

const understanding: Understanding = { kind: 'bill', lines: [], problemRef: null, payee: 'Riverbend Electric Co-op', payTo: '7730', urgent: false, addressedToAI: false, accountChange: false };
const sentToCloud: Array<{ image: Blob; where: string }> = [];
vi.mock('../../reader', () => ({
  setCloudModel: () => undefined,
  readPhoto: async (_kb: unknown, image: Blob, _q: string, where: string) => {
    sentToCloud.push({ image, where });
    return { understanding, where, ms: 5, steps: { read: 5, choose: 0 }, pack, retrieval: { shards: [], bytes: 0, offered: 0, trimmed: 0 } };
  },
  chooseForQuestion: async () => ({ ref: null, offered: 0 }),
}));

const C = await import('../conversation');
const F = await import('../flows');
const { setPrefs } = await import('../../store/prefs');

beforeEach(() => {
  F.startAgain();
  C.detach();
  coverFails = false;
  covered.length = 0;
  sentToCloud.length = 0;
  setPrefs({ offerNotes: true, offeredReady: true, consented: false, askEvery: false });
});

describe('the cloud reading path sends only the covered picture', () => {
  it('asks with the covered picture and what was covered, then reads only the covered copy', async () => {
    const original = new Blob(['original with names'], { type: 'image/png' });
    C.attach(original, 'bill');
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    const sheet = C.view().sheet!;
    expect(sheet.picture).toBe('blob:covered');
    expect(sheet.not[0]).toBe('Covered: 2 names, 1 phone number, 1 account number.');
    expect(sheet.not[1]).toBe('Names, numbers, addresses and accounts are covered on this computer before the picture is sent.');
    expect(sentToCloud).toEqual([]); // nothing goes before the yes
    C.answerSheet(true);
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
    expect(sentToCloud.some((s) => s.image === original || s.image === SMALL)).toBe(false);
    expect(covered).toEqual([SMALL]);

    const r = C.view().receipt!;
    expect(r.stayed.slice(0, 2)).toEqual(['The picture as you took it', 'The details I covered: 2 names, 1 phone number, 1 account number']);
    expect(r.sent.slice(0, 1)).toEqual(['This picture, with your personal details covered in black']);
    expect(r).toMatchObject({ sentPicture: true, coveredPicture: 'blob:covered' });
  });

  it('after an earlier yes there is no sheet, and still only the covered copy goes', async () => {
    setPrefs({ consented: true, askEvery: false });
    const original = new Blob(['another original'], { type: 'image/png' });
    C.attach(original);
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
  });

  it('when the words cannot be read in time, nothing is sent and the person is asked again', async () => {
    coverFails = true;
    setPrefs({ consented: true, askEvery: false });
    const original = new Blob(['original'], { type: 'image/png' });
    C.attach(original);
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I could not cover your details'));
    expect(sentToCloud).toEqual([]);
    expect(C.view().sheet).toBeNull();
    expect(C.view().next.map((n) => n.label)).toEqual(['Try again', 'Take a clearer photo']);
    // The picture is back on the box, so Send tries again.
    expect(C.view().chosen?.blob).toBe(original);
  });
});
