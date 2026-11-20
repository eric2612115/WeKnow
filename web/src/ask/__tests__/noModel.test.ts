// @vitest-environment happy-dom
// The wall for a device with no model of its own: the paper is never sent anywhere to be read. A bill gets the basic
// check by plain code on this device (core/basicRead.ts); anything else says what the full check needs. Neither the
// picture, nor a covered copy, nor the paper's words reach a cloud reader, whatever the internet setting is.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pack } from '../../core/packs';

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
    // No built-in model: plain code does the basic check, and nothing is read anywhere else.
    deviceStore: createStore({ online: true, model: 'unavailable', pct: null, almost: false }),
    deviceWord: () => 'computer',
    getReady: async () => true,
    refreshModel: async () => 'unavailable',
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

// The words the text recognizer finds on a picture, on this device.
let ocrText: string[] = [];
let ocrFails = false;
const recognized: Blob[] = [];
vi.mock('../../coverPicture', () => ({
  warmCover: async () => undefined,
  coverPicture: async () => {
    throw new Error('a picture is never covered to be sent');
  },
  readLines: async (picture: Blob) => {
    recognized.push(picture);
    if (ocrFails) throw new Error('reading the words took longer than 8000 ms');
    return ocrText;
  },
}));

// The two cloud readers (a picture, a paper's words): on a device with no model neither may ever be called.
const paperSent: Array<{ where: string }> = [];
vi.mock('../../textReader', async () => {
  const { maskText } = await import('../../core/pii');
  const mailPayload = (t: string) => maskText(t).replace(/\s+/g, ' ').trim().slice(0, 4000);
  return {
    mailPayload,
    readMailText: async (_text: string, where: string) => {
      paperSent.push({ where });
      throw new Error('a paper is never read by a model on a device without one');
    },
  };
});
const sentToCloud: Array<{ where: string }> = [];
vi.mock('../../reader', () => ({
  setCloudModel: () => undefined,
  readPhoto: async (_kb: unknown, _image: Blob, _q: string, where: string) => {
    sentToCloud.push({ where });
    throw new Error('a picture is never read by a model on a device without one');
  },
  chooseForQuestion: async () => ({ ref: null, offered: 0 }),
}));

// The one thing that may go online for a bill, after a yes: who asks to be paid and the names of the charges.
const askedOnline: string[] = [];
vi.mock('../../webSearch', () => ({
  checkBillOnline: async (question: string) => {
    askedOnline.push(question);
    return { check: null, sent: question, ms: 1, model: 'x', tries: 1 };
  },
  searchWeb: async () => ({ answer: null, sent: '', ms: 1, model: 'x', tries: 1 }),
}));

const C = await import('../conversation');
const F = await import('../flows');
const { uiStore } = await import('../../ui/uiStore');
const { setPrefs } = await import('../../store/prefs');

beforeEach(() => {
  F.startAgain();
  C.detach();
  ocrText = [];
  ocrFails = false;
  recognized.length = 0;
  paperSent.length = 0;
  sentToCloud.length = 0;
  askedOnline.length = 0;
  uiStore.set({ drawer: false, sheet: null });
  setPrefs({ offerNotes: true, offeredReady: true, toldBasic: false, internet: 'ask-once' });
});

const SECRETS = ['3301-4478-1234', '3301-4478-5678', 'Pat Kowalski', 'Robin', 'Delacroix', 'pat.k@example.com', '555-0142', '84.20', '312.40'];
/** No reader anywhere else was given the picture or the paper's words; what did go online names nobody. */
const nothingLeft = () => {
  expect(sentToCloud).toEqual([]);
  expect(paperSent).toEqual([]);
  for (const q of askedOnline) for (const secret of SECRETS) expect(q).not.toContain(secret);
};
/** The only sheet a bill may open: the online check of the company, in words, never with the picture. */
const answerBillCheck = async (yes: boolean) => {
  await vi.waitFor(() => expect(C.view().sheet).toBeTruthy());
  const sheet = C.view().sheet!;
  expect(sheet.goes).toBe('words');
  expect(sheet.picture).toBeUndefined();
  for (const secret of SECRETS) expect(JSON.stringify(sheet.parcel)).not.toContain(secret);
  C.answerSheet(yes);
};

const BILL = [
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
];
const QUOTE = ['Tidewell Auto Care', 'ESTIMATE', 'Estimate no. RO-44173', 'Technician #07', 'Front brake pads replacement  PARTS $96.40  LABOR $174.00  $270.40', 'Valid until 12/14/2026'];
const pdf = (lines: string[]) => C.attach(new Blob(['the drawn pages'], { type: 'image/jpeg' }), undefined, false, { text: lines.join('\n'), hasText: true, pages: 1 });

describe('a picture on a device with no model is never sent', () => {
  for (const internet of ['ask-once', 'auto', 'every', 'never'] as const)
    it(`a photo of a bill gets the basic check here, with the internet set to ${internet}`, async () => {
      setPrefs({ internet });
      ocrText = BILL;
      const original = new Blob(['original with names'], { type: 'image/png' });
      C.attach(original, 'bill');
      F.send('Should I pay this?');
      if (internet === 'ask-once' || internet === 'every') await answerBillCheck(internet === 'every');
      await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
      nothingLeft();
      // After a yes (or an earlier one) the company and its charges were asked about online; with No or Never, nothing.
      expect(askedOnline.length).toBe(internet === 'auto' || internet === 'every' ? 1 : 0);
      if (askedOnline.length) expect(askedOnline[0]).toMatch(/^Who asks to be paid: Northfield Water Services/);
      expect(recognized).toEqual([original]); // its words were read on this device, once
      // The same plain rules as every bill, on the paper's own words.
      expect(C.view().head).toMatchObject({ tone: 'stop', text: 'Don’t pay this bill yet.' });
      const said = C.view().lines.map((l) => l.text);
      expect(said[0]).toBe(
        'One. The numbers on this bill don’t add up: the last bill of $84.20, minus $84.20 paid, plus $96.15 in new charges is $96.15, but it asks for $312.40.',
      );
      expect(said).toContain('This was the basic check: accounts, totals and warning words, by plain rules on this computer.');
      const r = C.view().receipt!;
      expect(r.sentPicture).toBeFalsy();
      expect(r.sent).toEqual(askedOnline);
      expect(r.tech.join(' ')).toMatch(/No model read the paper, and nothing was sent to be read/);
    });

  it('a quote says what the full check needs, and nothing is sent', async () => {
    setPrefs({ internet: 'auto' });
    ocrText = QUOTE;
    C.attach(new Blob(['a quote'], { type: 'image/png' }));
    F.send('Is this a fair price?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('A quote needs the full check'));
    nothingLeft();
    expect(C.view().lines.map((l) => l.text)).toContain('Nothing was sent. Your paper stays on this computer.');
    expect(C.view().next.map((n) => n.label)).toEqual(['How to get the full check']);
    C.view().next[0].act?.();
    expect(uiStore.get().sheet).toEqual({ type: 'needmodel' });
  });

  it('when the words cannot be read, nothing is sent either', async () => {
    setPrefs({ internet: 'auto' });
    ocrFails = true;
    C.attach(new Blob(['blurred'], { type: 'image/png' }));
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('This paper needs the full check'));
    nothingLeft();
  });

  it('a picture of a thing, with nothing in the words to look up, is not looked at and not sent', async () => {
    setPrefs({ internet: 'auto' });
    C.attach(new Blob(['a sink'], { type: 'image/png' }));
    F.send('What should I know about this?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('I can’t look at pictures on this computer'));
    nothingLeft();
  });
});

describe('a PDF with real text on a device with no model is never sent', () => {
  it('a bill is checked from its own words, by plain code, on this device', async () => {
    setPrefs({ internet: 'auto' });
    pdf(BILL);
    F.send('Should I pay this?');
    await vi.waitFor(() => expect(C.view().receipt).toBeTruthy());
    nothingLeft();
    expect(recognized).toEqual([]); // a PDF's own text needs no text recognition
    expect(C.view().head).toMatchObject({ tone: 'stop', text: 'Don’t pay this bill yet.' });
    const said = C.view().lines.map((l) => l.text);
    expect(said[1]).toBe('Two. This bill shows two different account numbers (ending 1234 and 5678). Call the company before paying.');
    const r = C.view().receipt!;
    expect(r.stayed[0]).toBe('The PDF');
    expect(r.sentPicture).toBeFalsy();
    expect(r.sent).toEqual(askedOnline);
  });

  it('a quote says what the full check needs, and nothing is sent', async () => {
    setPrefs({ internet: 'auto' });
    pdf(QUOTE);
    F.send('Is this fair?');
    await vi.waitFor(() => expect(C.view().head?.text).toBe('A quote needs the full check'));
    nothingLeft();
  });
});
