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
    return { blob: COVERED, url: 'blob:covered', details: [], counts: { name: 2, phone: 1, account: 1 }, words: 40, text: ocrText, ms: { load: 1, read: 1, total: 2 } };
  },
}));
// The words the recognizer found while covering: they stay here, and the bill checks read them.
let ocrText: string[] = [];

// A PDF with real text: only its covered words may reach the cloud reader (textReader.ts), never its picture.
const paperSent: Array<{ masked: string; where: string; source: string }> = [];
let paperKind: Understanding['kind'] = 'bill';
vi.mock('../../textReader', async () => {
  const { maskText } = await import('../../core/pii');
  const mailPayload = (t: string) => maskText(t).replace(/\s+/g, ' ').trim().slice(0, 4000);
  return {
    mailPayload,
    readMailText: async (text: string, where: string, _m: string, source: string) => {
      paperSent.push({ masked: mailPayload(text), where, source });
      return { understanding: { ...understanding, kind: paperKind, payTo: null }, where, ms: 3, masked: mailPayload(text) };
    },
  };
});

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
const { getPrefs, setPrefs } = await import('../../store/prefs');

beforeEach(() => {
  F.startAgain();
  C.detach();
  coverFails = false;
  covered.length = 0;
  ocrText = [];
  paperSent.length = 0;
  paperKind = 'bill';
  sentToCloud.length = 0;
  setPrefs({ offerNotes: true, offeredReady: true, internet: 'ask-once' });
});

describe('the cloud reading path sends only the covered picture', () => {
  it('asks with the covered picture and what was covered, then reads only the covered copy', async () => {
    const original = new Blob(['original with names'], { type: 'image/png' });
    C.attach(original, 'bill');
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    const sheet = C.view().sheet!;
    expect(sheet.picture).toBe('blob:covered');
    // What was covered is said first, in one line.
    // What was hidden, by kind, and that the covered picture is what goes.
    expect(sheet.hidden).toEqual({ name: 2, phone: 1, account: 1 });
    expect(sheet.goes).toBe('picture');
    expect(sentToCloud).toEqual([]); // nothing goes before the yes
    // The one consent sheet: When it helps / Ask me every time / No.
    expect(sheet.title).toBe('Check this bill online?');
    expect([sheet.yes, sheet.middle, sheet.no]).toEqual(['Yes, check it', 'Ask me every time', 'No']);
    C.answerSheet(true);
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(getPrefs().internet).toBe('auto');
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
    expect(sentToCloud.some((s) => s.image === original || s.image === SMALL)).toBe(false);
    expect(covered).toEqual([SMALL]);

    const r = C.view().receipt!;
    expect(r.stayed.slice(0, 2)).toEqual(['The picture as you took it', 'The details I covered: 2 names, 1 phone number, 1 account number']);
    expect(r.sent.slice(0, 1)).toEqual(['This picture, with your personal details covered in black']);
    expect(r).toMatchObject({ sentPicture: true, coveredPicture: 'blob:covered', w: 'cloud' });
    expect(r.why).toBe('Why the internet: This computer cannot read pictures by itself.');
  });

  it('with Never, nothing is covered or sent, and the way to change it is offered', async () => {
    setPrefs({ internet: 'never' });
    C.attach(new Blob(['original'], { type: 'image/png' }));
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().next.map((n) => n.label)).toEqual(['Open Settings']));
    expect(C.view().sheet).toBeNull();
    expect(covered).toEqual([]);
    expect(sentToCloud).toEqual([]);
  });

  it('“Ask me every time” on the consent sheet sends this time and asks again next time', async () => {
    C.attach(new Blob(['one'], { type: 'image/png' }));
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    C.answerSheet('middle');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(getPrefs().internet).toBe('every');
    expect(sentToCloud).toHaveLength(1);
    C.attach(new Blob(['two'], { type: 'image/png' }));
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    expect(C.view().sheet!.middle).toBeUndefined(); // the per-time sheet: yes or no
    C.answerSheet(false);
    await vi.waitFor(() => expect(C.view().head?.text).toBe('Nothing was sent'));
    expect(sentToCloud).toHaveLength(1);
  });

  it('after an earlier yes there is no sheet, and still only the covered copy goes', async () => {
    setPrefs({ internet: 'auto' });
    const original = new Blob(['another original'], { type: 'image/png' });
    C.attach(original);
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
  });

  it('when the words cannot be read in time, nothing is sent and the person is asked again', async () => {
    coverFails = true;
    setPrefs({ internet: 'auto' });
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

  it('the covered picture’s own words feed the bill checks on this device: numbers that do not add up are a stop', async () => {
    setPrefs({ internet: 'auto' });
    ocrText = ['Subtotal $120.00', 'Tax $9.90', 'Total $199.90'];
    C.attach(new Blob(['a screenshot'], { type: 'image/png' }));
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(C.view().head).toMatchObject({ tone: 'stop' });
    expect(C.view().lines.map((l) => l.text)).toContain('One. The numbers on this bill don’t add up: $120.00 plus $9.90 tax is $129.90, but the total says $199.90.');
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
  });
});

const PDF_TEXT = [
  'Northfield Water Services',
  'Customer: Pat Kowalski',
  'ACCOUNT HOLDER  SERVICE',
  'Robin Delacroix-Hart  Residential',
  'Account number: 3301-4478-1234',
  'pat.k@example.com  (541) 555-0142',
  'Previous balance $84.20',
  'Payment received - thank you -$84.20',
  'Current charges $96.15',
  'Total amount due $312.40',
  'PAYMENT STUB',
  'Account # 3301-4478-5678',
].join('\n');
const pdf = () => C.attach(new Blob(['the drawn pages'], { type: 'image/jpeg' }), undefined, false, { text: PDF_TEXT, hasText: true, pages: 1 });

describe('a PDF with real text on the cloud path sends only its covered words', () => {
  it('asks with the covered words (no picture), reads them, and never the picture', async () => {
    pdf();
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    const sheet = C.view().sheet!;
    expect(sheet.picture).toBeUndefined();
    // The covered words, as the paper's own lines, after one line saying what was covered.
    expect(sheet.hidden).toMatchObject({ name: 2, email: 1, phone: 1 });
    expect(sheet.hidden?.account).toBeGreaterThanOrEqual(2);
    expect(sheet.goes).toBe('words');
    expect(sheet.lines?.slice(0, 3)).toEqual(['Northfield Water Services', 'Customer: [name]', 'ACCOUNT HOLDER · SERVICE']);
    expect(sheet.lines?.[3]).toBe('[name] · Residential');
    const parcel = (sheet.lines ?? []).join('\n');
    expect(parcel).toMatch(/\[account\]/);
    for (const secret of ['3301-4478-1234', 'Pat Kowalski', 'Robin', 'Delacroix', 'pat.k@example.com', '555-0142']) expect(parcel).not.toContain(secret);
    expect(sheet.title).toBe('Check this bill online?');
    expect(paperSent).toEqual([]); // nothing goes before the yes
    C.answerSheet(true);
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(paperSent).toHaveLength(1);
    expect(paperSent[0]).toMatchObject({ where: 'cloud', source: 'paper' });
    for (const secret of ['3301-4478-1234', 'Pat Kowalski', 'Robin', 'Delacroix', 'pat.k@example.com', '555-0142']) expect(paperSent[0].masked).not.toContain(secret);
    // Neither the picture nor its covered copy was read or covered.
    expect(sentToCloud).toEqual([]);
    expect(covered).toEqual([]);

    const r = C.view().receipt!;
    expect(r.sent[0]).toBe(`The words of the PDF, with your personal details covered (${paperSent[0].masked.length} characters)`);
    expect(r.sentPicture).toBeFalsy();
    expect(r.stayed[0]).toBe('The PDF as you gave it');
    expect(r.why).toBe('Why the internet: This computer cannot read papers by itself.');
    // The checks ran on the words as printed, on this device: both warnings, a stop, last four digits only.
    expect(C.view().head).toMatchObject({ tone: 'stop', text: 'Don’t pay this bill yet.' });
    const said = C.view().lines.map((l) => l.text);
    expect(said[0]).toBe(
      'One. The numbers on this bill don’t add up: the last bill of $84.20, minus $84.20 paid, plus $96.15 in new charges is $96.15, but it asks for $312.40.',
    );
    expect(said[1]).toBe('Two. This bill shows two different account numbers (ending 1234 and 5678). Call the company before paying.');
    expect(C.view().next.map((n) => n.label)).toEqual(['Which numbers?', 'Where are the account numbers?', 'What should I do now?']);
  });

  it('with No, nothing is sent', async () => {
    setPrefs({ internet: 'every' });
    pdf();
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
    C.answerSheet(false);
    await vi.waitFor(() => expect(C.view().head?.text).toBe('Nothing was sent'));
    expect(paperSent).toEqual([]);
    expect(sentToCloud).toEqual([]);
  });

  it('a text PDF that is not a bill falls back to the covered picture', async () => {
    setPrefs({ internet: 'auto' });
    paperKind = 'quote';
    pdf();
    F.send('Is this fair?');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    expect(paperSent).toHaveLength(1);
    expect(sentToCloud.map((s) => s.image)).toEqual([COVERED]);
  });
});
