// What happens after Ask, for real: hear the question (or take the sample's own question), take a still, route
// (this device when its model is ready, the internet only after a yes), read with reader.readPhoto, then let plain
// code decide (core/verdict.ts). The answer is put on screen as soon as it is decided, and only then read out:
// narration never holds a button. Every number shown or said comes from a pack item; every sentence is in strings.ts.

import type { Reading, Where } from '../reader';
import type { Settings } from '../config';
import type { Candidate, LayeredKnowledge } from '../core/knowledge';
import type { Guide, Pack, PriceItem } from '../core/packs';
import type { JobMemory, PayeeMemory } from '../core/memory';
import { compareToLastTime, earlierJobs, knownPayees } from '../core/memory';
import { isBusy } from './errors';
import { billVerdict, quoteVerdicts } from '../core/verdict';
import { guideByRef, priceByRef, proPrice } from '../core/packs';
import { aboutPicture, followUp, kindOrder, lean, matchStrength, pickLexical, priceAnswer, type ItemKind, type Scored } from './words';
import { maskText } from '../core/pii';
import { buildCloudLookup } from '../core/cloudPayload';
import {
  billAnswer,
  guideSources,
  lineItems,
  listNames,
  minutesText,
  priceSources,
  proLine,
  quoteSummary,
  quoteTitle,
  sayToShop,
  whereRan,
} from '../answer/compose';
import type { LineItem, Receipt, Tone } from '../answer/types';
import { t as tr, money, monthYear, longDate, shortDate } from '../strings';
import { appSettings, knowledge } from '../engine/knowledge';
import { deviceStore, deviceWord, getReady } from '../engine/device';
import { listening, soundEnd, soundStart, wait, sayAloud } from '../engine/speech';
import { permission, torch, type CameraState } from '../engine/camera';
import { addCheck, dataStore, newId, pictureUrl, putMemory, type Check, type CheckKind, type Family } from '../store/data';
import { getPrefs, setPrefs } from '../store/prefs';
import { addToBox, boxText, focusBox, setBox } from './box';
import {
  alive,
  archive,
  ask,
  attach,
  Cancel,
  choice,
  clearLines,
  clearWords,
  current,
  cutNarration,
  detach,
  listenQuestion,
  narrate,
  narrated,
  offerNext,
  postMine,
  patch,
  press,
  resetView,
  run,
  say,
  setErrorHandler,
  setHead,
  setPhase,
  settle,
  started,
  view,
  type Choice,
  type Next,
  type Said,
} from './conversation';

// ---------- what the page provides ----------

export interface Still {
  blob: Blob;
  light?: number;
  fromCamera: boolean;
}
export interface AskUi {
  /** A still from the live camera, as it is now; null when there is none. */
  snap(): Promise<Still | null>;
  cameraState(): CameraState;
  /** Turn the camera on (the browser asks for it the first time). */
  startCamera(): Promise<CameraState>;
  navigate(path: string): void;
  openSamples(): void;
  openReminder(r: { title: string }): void;
}
let ui: AskUi = {
  snap: async () => null,
  cameraState: () => 'idle',
  startCamera: async () => 'none',
  navigate: () => undefined,
  openSamples: () => undefined,
  openReminder: () => undefined,
};
export function setAskUi(next: AskUi) {
  ui = next;
}

const dev = () => deviceWord();
const PAPER = /price|pay|bill|quote|fair|letter|cost|charg|estimate|invoice|owe|statement|fee/i;
/** A reading that has not come back after this long is treated as failed, so Ask never hangs. */
const READ_TIMEOUT = 90_000;

// ---------- errors: never a code, always a way out ----------

setErrorHandler(async (e, t) => {
  console.warn('[WeKnow] ask failed', e);
  if (t !== current()) return;
  patch({ reading: false, offerSamples: true });
  clearLines();
  // A picture that could not be read goes back on the box with its question, so Send tries again.
  const sent = lastSent;
  lastSent = null;
  if (sent) {
    attach(sent.blob, sent.sample, sent.camera);
    if (!boxText().trim()) setBox(sent.question);
  }
  const fromPicture = !!sent && !sent.camera;
  let line: string;
  if (!deviceStore.get().online) {
    setHead('plain', tr('net.none.title'), 'nonet');
    line = tr('net.stopped', { device: dev() });
  } else if (isBusy(e)) {
    setHead('plain', tr('busy.title'));
    line = tr('busy.line');
  } else {
    setHead('plain', tr('read.fail.title'));
    line = fromPicture ? tr('read.fail.picture') : tr('read.fail');
  }
  // Never hold the button: the words are on screen, the voice reads them, and Ask works at once.
  settle();
  void narrate(t, [line]);
});

// ---------- the opening ----------

/** The first greeting. The question box works the whole time: asking cuts the greeting. */
export function greet() {
  void run(async (t) => {
    clearWords();
    patch({ phase: 'ready' });
    void narrate(t, [tr('first.say')]);
  });
}

// ---------- the question box: Send, the camera, the microphone ----------

/** The picture being read, kept until the answer is decided, so a failed reading can put it back on the box. */
let lastSent: { blob: Blob; sample?: string; camera?: boolean; question: string } | null = null;

/** A next-question button: pressing it shows its words as the person's message, then answers them. */
function nextQ(label: string, answer: (t: number) => Promise<void> | void): Next {
  return {
    label,
    act: () =>
      void run(async (t) => {
        postMine(label);
        await answer(t);
      }),
  };
}

/**
 * Send what is in the box. With a picture attached: the picture is read with the words as the question (or "What
 * should I know about this?"). Words alone are answered from the pack, or from the topic of the conversation;
 * never by taking a picture on their own. Words that need a picture ("Is this fair?"), with no picture and nothing
 * talked about yet, ask for one instead. Returns false when nothing was sent, so the words stay in the box.
 */
export function send(text: string): boolean {
  const q = text.trim();
  const pic = view().chosen;
  if (pic) {
    void run((t) => pictureFlow(t, q || tr('box.camera.q'), { blob: pic.blob, sample: pic.sample, camera: pic.camera }, true));
    return true;
  }
  if (!q) return false;
  if (aboutPicture(q) && !topic) {
    void run(async (t) => needPicture(t));
    return false;
  }
  void run((t) => wordsOnly(t, q));
  return true;
}

/**
 * The camera button. The camera is never on by itself: a press opens the camera over the page and turns it on;
 * the camera's own button takes the picture, which closes the camera and attaches the picture to the box (nothing is
 * sent). Without a camera: the ways round it (how to allow it, a picture instead).
 */
export function takePicture() {
  void run(async (t) => {
    const v = view();
    if (!v.viewfinder) {
      patch({ viewfinder: true, still: null, looking: false });
      if (ui.cameraState() !== 'live') {
        const s = await ui.startCamera();
        alive(t);
        if (s !== 'live') {
          patch({ viewfinder: false });
          archive();
          return cameraOff(t);
        }
      }
      return;
    }
    if (ui.cameraState() !== 'live') {
      patch({ viewfinder: false });
      archive();
      return cameraOff(t);
    }
    const still = await ui.snap();
    alive(t);
    if (!still || (still.light !== undefined && still.light < 0.08)) {
      patch({ viewfinder: false });
      archive();
      return still ? tooDark(t) : cameraOff(t);
    }
    attach(still.blob, undefined, true);
  });
}

/** The microphone button: the heard words go into the box, and nothing is sent until Send. */
export function dictate() {
  void run(async (t) => {
    const can = await listening();
    alive(t);
    const back = started() || view().head ? 'settled' : 'ready';
    if (can === 'unavailable') {
      archive();
      setHead('plain', tr('hear.title'), 'mic');
      settle();
      void narrate(t, [tr('mic.none')]);
      focusBox();
      return;
    }
    patch({ phase: 'listening', heard: '', level: 0 });
    soundStart();
    const heard = (await listenQuestion(t)).trim();
    soundEnd();
    patch({ phase: back, heard: '', level: 0 });
    if (heard) {
      addToBox(heard);
      return;
    }
    const denied = (await permission('microphone')) === 'denied';
    alive(t);
    archive();
    setHead('plain', tr('hear.title'), 'mic');
    settle();
    void narrate(t, [denied ? tr('mic.line') : tr('mic.again')]);
  });
}

/** Words that need a picture, with none attached: say so; the words stay in the box. */
function needPicture(t: number) {
  archive();
  setHead('plain', tr('pic.need.title'), 'cam');
  settle();
  void narrate(t, [tr('pic.need.line')]);
}

/** Words alone: a pack item they name, else the topic of the conversation, else likely guides, else "I don't know". */
async function wordsOnly(t: number, question: string) {
  postMine(question);
  patch({ asked: tr('asked', { words: question }) });
  const r = await wordsFlow(t, question);
  alive(t);
  if (r === true) return;
  if (await followTopic(t, question)) return;
  alive(t);
  if (r && r.guides.length) return maybeGuides(t, r.ctx, r.guides);
  if (aboutPicture(question)) return needPicture(t);
  dontKnow(t);
}

interface PictureSrc {
  blob: Blob;
  sample?: string;
  camera?: boolean;
}

/** Read a picture. `post`: the person's message (their words and picture) is put in the conversation first. */
async function pictureFlow(t: number, question: string, pic: PictureSrc, post: boolean) {
  const url = URL.createObjectURL(pic.blob);
  if (post) postMine(question, url);
  patch({ asked: tr('asked', { words: question }) });
  // The picture leaves the box once sent; it shows in the person's message while it is read and after.
  lastSent = { ...pic, question };
  if (view().chosen) detach();
  const still: Still = { blob: pic.blob, fromCamera: !!pic.camera };
  patch({ still: url, looking: true, chip: null });

  const d = deviceStore.get();
  const where: Where = d.model === 'available' ? 'device' : 'cloud';
  let saidCloud = false;
  if (where === 'cloud') {
    if (!d.online) return noInternet(t);
    const p = getPrefs();
    if (!p.consented || p.askEvery) {
      const yes = await ask(
        t,
        {
          kind: 'net',
          title: tr('ask.thing.title'),
          body: tr('ask.thing.body', { device: dev() }),
          picture: url,
          parcel: [`“${question}”`],
          not: [tr('ask.thing.whole'), tr('ask.thing.not')],
          yes: tr('ask.thing.yes'),
          no: tr('ask.thing.no'),
        },
        [tr('ask.thing.say', { device: dev() })],
      );
      if (!yes) return nothingSent(t);
      setPrefs({ consented: true });
    } else saidCloud = true;
  }

  // Start reading at once; what WeKnow is doing is said while it reads, never before.
  const job = (async () => {
    const [kb, settings] = await Promise.all([knowledge(), appSettings()]);
    const reading = await readNow(kb, settings, still.blob, question, where);
    return { kb, settings, reading };
  })();
  job.catch(() => undefined);
  const paper = PAPER.test(question);
  setPhase('looking');
  patch({ reading: paper });
  void narrate(t, [...(saidCloud ? [tr('ask.thing.said')] : []), paper ? tr('look.paper') : tr('look.thing')]);
  const { kb, settings, reading } = await withWaits(t, withTimeout(job, READ_TIMEOUT));
  patch({ reading: false });
  lastSent = null;

  const ctx: Ctx = { t, question, where, reading, kb, settings, picture: still.blob, src: pic };
  const kind = reading.understanding.kind;
  if (kind === 'quote') return quoteFlow(ctx);
  if (kind === 'bill') return billFlow(ctx);
  if (kind === 'problem') return problemFlow(ctx);
  // Not sure what the picture is: ask, with buttons, instead of guessing.
  topic = { kind: 'unknown', c: ctx };
  clearLines();
  setHead('plain', tr('what.title'));
  settle();
  void narrate(t, [tr('what.line')]);
  offerNext([
    nextQ(tr('next.paper'), (t2) => pictureFlow(t2, tr('q.paper'), pic, false)),
    nextQ(tr('next.thing'), (t2) => pictureFlow(t2, tr('q.thing'), pic, false)),
    nextQ(tr('next.else'), (t2) => {
      settle();
      setHead('plain', tr('what.title'));
      void narrate(t2, [tr('what.line'), tr('words.none.more')]);
      patch({ offerSamples: true });
    }),
  ]);
}

// ---------- the topic: what follow-up words are about ----------
// "How much to fix it?" names nothing; it is about the last thing talked about. A new picture is a new topic.

type Topic =
  | { kind: 'price'; c: Ctx; item: PriceItem }
  | { kind: 'guide'; c: Ctx; guide: Guide }
  | { kind: 'quote'; c: Ctx; again: () => void; next: () => Next[]; say?: (t: number) => void; myself: Guide[] }
  | { kind: 'bill'; c: Ctx; again: () => void; next: () => Next[]; whatNow: (t: number) => void }
  | { kind: 'unknown'; c: Ctx };
let topic: Topic | null = null;

/** Start again: the conversation is cleared and nothing is remembered as its topic. */
export function startAgain() {
  topic = null;
  resetView();
}

/** Answer follow-up words from the topic. False when the words do not fit it. */
async function followTopic(t: number, question: string): Promise<boolean> {
  const f = followUp(question);
  const tp = topic;
  if (!tp || !f) return false;
  const c = { ...tp.c, t, question };
  if (tp.kind === 'price') {
    if (f === 'cost' || f === 'fair') {
      await wordsPrice(c, tp.item);
      return true;
    }
    if (f === 'fix') {
      await doItMyself(t, c, [tp.item.ref]);
      return true;
    }
  }
  if (tp.kind === 'guide') {
    if (f === 'cost') {
      await proAnswer(t, c, tp.guide);
      return true;
    }
    if (f === 'fix') {
      await guideFlow(c, tp.guide, -1, guideReceipt(c, tp.guide), proLine(c.reading.pack, tp.guide, proPrice(c.reading.pack, tp.guide)));
      return true;
    }
  }
  if (tp.kind === 'quote') {
    if (f === 'say' && tp.say) {
      tp.say(t);
      return true;
    }
    if (f === 'fix' && tp.myself.length) {
      await chooseGuide(t, c, tp.myself);
      return true;
    }
    if (f === 'fair' || f === 'cost' || f === 'pay') {
      tp.again();
      return true;
    }
  }
  if (tp.kind === 'bill') {
    if (f === 'pay') {
      tp.whatNow(t);
      return true;
    }
    if (f === 'fair' || f === 'cost') {
      tp.again();
      return true;
    }
  }
  return false;
}

interface Ctx {
  t: number;
  question: string;
  where: Where;
  reading: Reading;
  kb: LayeredKnowledge;
  settings: Settings;
  /** The still that was read; none when the question was answered from words alone. */
  picture?: Blob;
  /** Set when the question was answered from words alone: what picked the pack item. */
  words?: { by: 'model' | 'match'; offered: number; ms: number };
  /** The picture as sent, to read it again with a clearer question. */
  src?: PictureSrc;
}

async function readNow(kb: LayeredKnowledge, s: Settings, blob: Blob, question: string, where: Where): Promise<Reading> {
  const [{ readPhoto, setCloudModel }, { shrinkPhoto }] = await Promise.all([import('../reader'), import('../image')]);
  setCloudModel(s.cloudModel);
  const small = await shrinkPhoto(blob);
  return readPhoto(kb, small, question, where);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('reading timed out')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** "Still looking." after 6 seconds, once; "This is taking a while. I am still here." after 15. */
async function withWaits<T>(t: number, p: Promise<T>): Promise<T> {
  let done = false;
  const at = (ms: number, id: Parameters<typeof tr>[0]) =>
    setTimeout(() => {
      if (!done && t === current()) void narrate(t, [tr(id)]).catch(() => undefined);
    }, ms);
  const timers = [at(6000, 'wait.6'), at(15000, 'wait.15')];
  try {
    const v = await p;
    alive(t);
    return v;
  } finally {
    done = true;
    timers.forEach(clearTimeout);
  }
}

// ---------- when the picture cannot be read ----------

async function cameraOff(t: number) {
  setPhase('speaking');
  clearLines();
  setHead('plain', tr('cam.title'), 'camoff');
  const none = ui.cameraState() === 'none';
  await say(t, none ? tr('cam.none') : tr('cam.line'));
  const opts: Choice[] = none ? [{ value: 'pic', label: tr('cam.pic') }] : [{ value: 'how', label: tr('cam.how') }, { value: 'pic', label: tr('cam.pic') }];
  const c = await choice(t, opts, { stack: true });
  if (c === 'pic') {
    settle();
    ui.openSamples();
    return;
  }
  setPhase('speaking');
  clearLines();
  setHead('plain', tr('cam.how.title'));
  await say(t, dev() === 'computer' ? tr('cam.how.computer') : tr('cam.how.phone'));
  settle();
}

async function tooDark(t: number) {
  setPhase('speaking');
  clearLines();
  patch({ dim: true, chip: 'dark' });
  setHead('plain', tr('dark.title'), 'lamp');
  if (dev() !== 'computer' && (await torch(true))) {
    await say(t, tr('dark.phone'));
    await wait(500);
    patch({ dim: false, chip: 'light' });
    setHead('plain', tr('dark.better.title'), 'lamp');
    await say(t, tr('dark.better.line'));
  } else {
    await say(t, tr('dark.computer'));
    patch({ dim: false, chip: null });
  }
  settle();
}

async function noInternet(t: number) {
  setPhase('speaking');
  clearLines();
  setHead('plain', tr('net.none.title'), 'nonet');
  await say(t, tr('net.none.line', { device: dev() }));
  await choice(t, [{ value: 'checks', label: tr('net.none.btn') }], { stack: true, listen: false });
  settle();
  ui.navigate('/checks');
}

async function nothingSent(t: number) {
  setPhase('speaking');
  clearLines();
  patch({ reading: false });
  setHead('plain', tr('ask.none.title'));
  await say(t, tr('ask.none.line', { device: dev() }));
  await say(t, tr('ask.none.again'));
  settle();
}

// ---------- shared pieces of an answer ----------

/** "I worked that out right here", said once ever, after the first answer that stayed on the device. */
function firstTimeHere(where: Where): string[] {
  if (where !== 'device' || getPrefs().toldLocal) return [];
  setPrefs({ toldLocal: true });
  return [deviceStore.get().online ? tr('first.local', { device: dev() }) : tr('first.offline', { device: dev() })];
}

function tech(c: Ctx, extra: string[] = []): string[] {
  if (c.words) return wordsTech(c, extra);
  const r = c.reading;
  const chose = r.retrieval.offered > 0;
  const answered = chose ? 2 : 1;
  let who: string;
  let requests: string;
  if (c.where === 'device') {
    who = `Read by the built-in model on this ${dev()} (Firebase AI Logic, on-device).`;
    requests = 'Requests to the cloud model: 0.';
  } else if (r.fallback) {
    who = `Read in the cloud by ${r.fallback} through Firebase AI Logic, with the same form, because the template model (weknow-read-photo-v1) had used its daily quota.`;
    requests = `Requests answered by the cloud model: ${answered} (reading${chose ? ', choosing' : ''}), on ${r.fallback}. A request the template model turned away for its daily quota is not counted.`;
  } else {
    who = `Read in the cloud through the Firebase AI Logic server prompt template weknow-read-photo-v1${chose ? ', then weknow-choose-v1' : ''}.`;
    requests = `Requests to the cloud model: ${answered}.`;
  }
  return [
    `${who} ${(r.ms / 1000).toFixed(1)} s (reading ${r.steps.read} ms${chose ? `, choosing ${r.steps.choose} ms` : ''}).`,
    requests,
    `Pack ${c.kb.id}, version ${c.kb.version}. Shards loaded: ${r.retrieval.shards.join(', ') || 'none'}; ${r.retrieval.bytes} bytes fetched; ${r.retrieval.offered} options offered${r.retrieval.trimmed ? `, ${r.retrieval.trimmed} trimmed to fit` : ''}.`,
    ...extra,
  ];
}

async function keep(
  c: Ctx,
  o: { kind: CheckKind; family: Family; title: string; tone: Tone; verdict: string; lines: Said[]; items?: LineItem[]; receipt: Receipt; project?: string },
): Promise<Check> {
  let small: Blob | undefined;
  if (c.picture) {
    const { shrinkPhoto } = await import('../image');
    small = await shrinkPhoto(c.picture, 900, 0.8).catch(() => c.picture);
  }
  const said = o.lines.map((x) => (typeof x === 'string' ? { text: x } : x));
  const noteLine = said.findIndex((l) => l.noteTag);
  const check = await addCheck(
    {
      kind: o.kind,
      family: o.family,
      title: o.title,
      tone: o.tone,
      verdict: o.verdict,
      question: c.question,
      lines: said.map((l) => l.text),
      noteLine: noteLine >= 0 ? noteLine : undefined,
      items: o.items,
      receipt: o.receipt,
    },
    small,
    o.project,
  );
  patch({ kept: { checkId: check.id } });
  return check;
}

/** The one-time offer to get ready to work without the internet, after an answer, when Chrome says it can. */
async function offerReady(t: number) {
  const d = deviceStore.get();
  if (d.model !== 'downloadable' || getPrefs().offeredReady) return;
  await narrated();
  alive(t);
  setPrefs({ offeredReady: true });
  const yes = await ask(
    t,
    {
      kind: 'device',
      title: tr('ready.offer.title'),
      body: tr('ready.offer.line'),
      parcel: [],
      not: [tr('ready.offer.fine')],
      yes: tr('ready.offer.yes'),
      no: tr('ready.offer.no'),
      onYesClick: () =>
        void getReady((ok) => {
          const p = view().phase;
          if (ok && (p === 'ready' || p === 'settled')) void sayAloud(tr('ready.done'));
        }),
    },
    [tr('ready.offer.title'), tr('ready.offer.line'), tr('ready.offer.web')],
  );
  settle();
  void narrate(t, [yes ? tr('ready.started') : tr('ready.later')]);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** Today on this device's calendar (not UTC), as YYYY-MM-DD. */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** A shop or payee name as printed, unless the model masked it or it is empty. */
const nameOf = (s: string | null) => (s && s.trim() && !/\[/.test(s) && s.trim().toLowerCase() !== 'none' ? s.trim().slice(0, 80) : null);

/** Ask for prices to be added to the price book, without waiting: a slow or blocked database never holds an answer. */
function fileRequests(names: string[], region: string, onDone: (filed: string[], failed: string[]) => void) {
  void (async () => {
    const filed: string[] = [];
    const failed: string[] = [];
    try {
      const [{ ensureUser }, { requestPrice }] = await Promise.all([import('../firebase'), import('../requests')]);
      await withTimeout(ensureUser(), 15_000);
      await Promise.all(
        names.map(async (n) => {
          const ok = await withTimeout(requestPrice(n, region), 15_000).catch(() => false);
          (ok ? filed : failed).push(n);
        }),
      );
    } catch (e) {
      console.warn('[WeKnow] price request', e);
      failed.push(...names.filter((n) => !filed.includes(n)));
    }
    onDone(filed, failed);
  })();
}

// ---------- a question in words, without a picture ----------
// Plain search finds a few pack items for the question; the built-in model on this device picks one (text only),
// or, without it, plain code takes the top match only when it clearly names the job (ask/words.ts). Nothing here
// goes to the cloud. Every number in the answer comes from the pack item.

interface WordsHit {
  kind: ItemKind;
  ref: string;
  by: 'model' | 'match';
  offered: number;
}

/** What plain search found: the one item the words name (if any), and the likely guides when it is not clear. */
interface WordsLook {
  hit: WordsHit | null;
  guides: Candidate[];
  offered: number;
}

async function lookUpWords(t: number, question: string, kb: LayeredKnowledge): Promise<WordsLook> {
  const l = lean(question);
  const order = kindOrder(l);
  const lists = await Promise.all(order.map((kind) => kb.candidates(question, { kind, k: 4 })));
  alive(t);
  const all = lists.flat();
  // Likely guides to offer when no one item is clear (not for a question about a price).
  const guides = l === 'price' ? [] : (lists[order.indexOf('guide')] ?? []).slice(0, 3);
  if (!all.length) return { hit: null, guides: [], offered: 0 };

  if (deviceStore.get().model === 'available') {
    setPhase('speaking');
    void narrate(t, [tr('words.look')]);
    let r: { ref: string | null; offered: number } | null = null;
    try {
      const { chooseForQuestion } = await import('../reader');
      r = await withTimeout(chooseForQuestion(question, all), 30_000);
    } catch (e) {
      console.warn('[WeKnow] on-device choice failed; using the plain match', e);
    }
    alive(t);
    clearLines();
    if (r) {
      const c = r.ref ? all.find((x) => x.ref === r.ref) : undefined;
      return { hit: c ? { kind: c.kind, ref: c.ref, by: 'model', offered: r.offered } : null, guides, offered: r.offered };
    }
  }

  const tops = lists.map((xs) => xs[0]).filter((c) => !!c);
  const slice = await kb.resolve(tops.map((c) => c.ref));
  alive(t);
  const scored: Scored[] = tops.map((c) => {
    const item = c.kind === 'price' ? priceByRef(slice, c.ref) : guideByRef(slice, c.ref);
    return { kind: c.kind, ref: c.ref, strength: item ? matchStrength(question, [item.name, ...item.aliases]) : 0 };
  });
  const hit = pickLexical(l, scored);
  return { hit: hit ? { kind: hit.kind, ref: hit.ref, by: 'match', offered: tops.length } : null, guides, offered: tops.length };
}

/** A Ctx for an answer from words alone (no picture, nothing sent). */
function wordsCtx(t: number, question: string, kb: LayeredKnowledge, settings: Settings, pack: Pack, w: { kind: ItemKind; ref: string | null; by: 'model' | 'match'; offered: number; ms: number }): Ctx {
  const reading: Reading = {
    understanding: {
      kind: w.kind === 'guide' ? 'problem' : 'unknown',
      lines: [],
      problemRef: w.kind === 'guide' ? w.ref : null,
      payee: null,
      payTo: null,
      urgent: false,
      addressedToAI: false,
      accountChange: false,
    },
    where: 'device',
    ms: w.ms,
    steps: { read: 0, choose: w.ms },
    pack,
    retrieval: { shards: kb.stats().shards, bytes: 0, offered: w.offered, trimmed: 0 },
  };
  return { t, question, where: 'device', reading, kb, settings, words: { by: w.by, offered: w.offered, ms: w.ms } };
}

/** A guide and the prices it points at (for "How much would a pro charge?"). */
async function guidePack(kb: LayeredKnowledge, ref: string): Promise<{ pack: Pack; guide: Guide } | null> {
  const first = await kb.resolve([ref]);
  const guide = guideByRef(first, ref);
  if (!guide) return null;
  const pack = guide.proRefs?.length ? await kb.resolve([ref, ...guide.proRefs]) : first;
  return { pack, guide: guideByRef(pack, ref) ?? guide };
}

/**
 * Answer a question from the pack alone. True when it answered; otherwise what was found to offer instead (likely
 * guides), or false when the lookup itself failed.
 */
async function wordsFlow(t: number, question: string): Promise<true | false | { ctx: Ctx; guides: Candidate[] }> {
  const t0 = performance.now();
  let kb: LayeredKnowledge;
  let settings: Settings;
  let look: WordsLook;
  try {
    [kb, settings] = await Promise.all([knowledge(), appSettings()]);
    alive(t);
    look = await lookUpWords(t, question, kb);
  } catch (e) {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] words lookup failed', e);
    return false;
  }
  alive(t);
  const ms = Math.round(performance.now() - t0);
  const { hit } = look;
  if (!hit) {
    const empty: Pack = { id: kb.id, version: kb.version, region: kb.region, currency: 'USD', prices: [], guides: [] };
    return { ctx: wordsCtx(t, question, kb, settings, empty, { kind: 'guide', ref: null, by: 'match', offered: look.offered, ms }), guides: look.guides };
  }
  patch({ still: null, looking: false, reading: false, chip: null });
  if (hit.kind === 'guide') {
    const gp = await guidePack(kb, hit.ref);
    alive(t);
    if (!gp) return false;
    await guideAnswer(wordsCtx(t, question, kb, settings, gp.pack, { ...hit, ms }), gp.guide);
    return true;
  }
  const pack = await kb.resolve([hit.ref]);
  alive(t);
  const item = priceByRef(pack, hit.ref);
  if (!item) return false;
  await wordsPrice(wordsCtx(t, question, kb, settings, pack, { ...hit, ms }), item);
  return true;
}

/** Guides that point at these prices (a pro price they name): "Can I do it myself?". */
async function guidesFor(kb: LayeredKnowledge, refs: string[], names: string[]): Promise<Guide[]> {
  const found = new Map<string, Guide>();
  for (const name of names.slice(0, 6)) {
    const cands = await kb.candidates(name, { kind: 'guide', k: 4 });
    if (!cands.length) continue;
    const pack = await kb.resolve(cands.map((c) => c.ref));
    for (const g of pack.guides) if (g.steps.length && g.proRefs?.some((r) => refs.includes(r))) found.set(g.ref, g);
  }
  return [...found.values()].slice(0, 3);
}

/** "Can I do it myself?": the guide for these prices, or a choice of them. */
async function doItMyself(t: number, c: Ctx, refs: string[], guides?: Guide[]) {
  const names = c.reading.pack.prices.filter((p) => refs.includes(p.ref)).map((p) => p.name);
  const gs = guides ?? (await guidesFor(c.kb, refs, names));
  alive(t);
  if (!gs.length) {
    setHead('plain', tr('myself.none'));
    settle();
    void narrate(t, [tr('words.price.quote')]);
    return;
  }
  return chooseGuide(t, c, gs);
}

/** One guide: answer it. Several: ask which. */
async function chooseGuide(t: number, c: Ctx, gs: Guide[]) {
  if (gs.length === 1) {
    const gp = await guidePack(c.kb, gs[0].ref);
    alive(t);
    if (gp) return guideAnswer({ ...c, t, reading: { ...c.reading, pack: gp.pack } }, gp.guide);
  }
  return maybeGuides(
    t,
    c,
    gs.map((g) => ({ ref: g.ref, name: g.name, score: 0, kind: 'guide' as const, shard: '' })),
  );
}

/** Not sure which problem it is: up to three likely guides from the pack, and None of these. Never a guess. */
function maybeGuides(t: number, c: Ctx, guides: Candidate[]) {
  setHead('plain', tr('maybe.title'));
  settle();
  void narrate(t, [tr('maybe.line')]);
  offerNext([
    ...guides.slice(0, 3).map((g) =>
      nextQ(g.name, async (t2) => {
        const gp = await guidePack(c.kb, g.ref);
        alive(t2);
        if (!gp) return dontKnow(t2);
        await guideAnswer({ ...c, t: t2, reading: { ...c.reading, pack: gp.pack } }, gp.guide);
      }),
    ),
    nextQ(tr('next.none'), (t2) => {
      setHead('plain', tr('none.title'));
      patch({ offerSamples: true });
      settle();
      void narrate(t2, [tr('words.none.more')]);
    }),
  ]);
}

async function wordsPrice(c: Ctx, item: PriceItem) {
  const { t } = c;
  const a = priceAnswer(item);
  const receipt: Receipt = {
    w: whereRan({ where: 'device', online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed: [tr('where.question'), tr('where.answer.words', { device: dev() })],
    sent: [],
    sources: priceSources([item]),
    tech: tech(c),
  };
  const lines: Said[] = [...a.lines, ...firstTimeHere('device')];
  clearLines();
  setHead(a.tone, a.head);
  patch({ receipt });
  const car = (item.category ?? '').startsWith('car');
  await keep(c, { kind: 'Price', family: 'quote', title: item.name, tone: a.tone, verdict: a.head, lines, receipt, project: car ? tr('project.car') : undefined });
  alive(t);
  topic = { kind: 'price', c, item };
  settle();
  void narrate(t, lines);
  const myself = await guidesFor(c.kb, [item.ref], [item.name]).catch(() => [] as Guide[]);
  alive(t);
  offerNext([
    ...(myself.length ? [nextQ(tr('next.myself'), (t2) => doItMyself(t2, { ...c, t: t2 }, [item.ref], myself))] : []),
    nextQ(tr('next.quote'), (t2) => {
      settle();
      void narrate(t2, [tr('quote.photo')]);
    }),
  ]);
  await offerReady(t);
}

function wordsTech(c: Ctx, extra: string[]): string[] {
  const w = c.words!;
  const by =
    w.by === 'model'
      ? `Picked by the built-in model on this ${dev()} (Firebase AI Logic, on-device, text only) among ${w.offered} pack ${w.offered === 1 ? 'item' : 'items'} found by plain search.`
      : `Picked by plain code on this ${dev()}: the top search match, taken because the question holds the job words of its name or an alias (all of a short one; at least half, and two, of a longer one).`;
  return [
    `Answered from the question alone, without a picture. ${by}`,
    'Requests to the cloud model: 0.',
    `Pack ${c.kb.id}, version ${c.kb.version}. ${w.ms} ms.`,
    ...extra,
  ];
}

/** A question in words that the pack does not know, with no camera to look instead. Never a made-up price. */
function dontKnow(t: number) {
  clearLines();
  setHead('plain', tr('words.none.title'));
  patch({ offerSamples: true, still: null, looking: false });
  settle();
  void narrate(t, [tr('words.none.line'), tr('words.none.more')]);
}

// ---------- a quote ----------

async function quoteFlow(c: Ctx) {
  const { t, reading, kb, where } = c;
  const u = reading.understanding;
  const shop = nameOf(u.payee);
  const items = lineItems(quoteVerdicts(u, reading.pack), u.lines.map((l) => l.label));
  if (!items.length) {
    clearLines();
    setHead('plain', tr('quote.small.title'));
    settle();
    void narrate(t, [tr('quote.small')]);
    return;
  }

  // Lines the pack does not know: only the masked line and the region may leave, and only after a yes.
  const unknown = items
    .filter((i) => i.state === 'pending' && i.label.trim())
    .map((i) => {
      try {
        return { i, payload: buildCloudLookup({ item: i.label.trim().slice(0, 120), region: kb.region }) };
      } catch {
        return null; // personal data or a malformed line: never offered
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const names = unknown.map((x) => x.i.label);
  const parcel = [...unknown.map((x) => tr('ask.item.price', { item: x.payload.item })), tr('ask.item.region', { region: kb.region })];
  const online = deviceStore.get().online;
  const p = getPrefs();
  // On the cloud path the person already said yes to the picture; then WeKnow only says it looks the lines up.
  const lookNow = unknown.length > 0 && online && p.consented && !p.askEvery;

  const summary = quoteSummary(items);
  const pending = items.filter((i) => i.state === 'pending').length;
  const matched = reading.pack.prices.filter((x) => u.lines.some((l) => l.ref === x.ref));

  // One note at most: the same job last time (by pack ref, or the same shop and label).
  const mem = dataStore.get().memory;
  let note: { text: string; when: string } | null = null;
  const order = summary.worst ? [summary.worst, ...items.filter((i) => i !== summary.worst)] : items;
  for (const it of order) {
    if (it.amount === null) continue;
    const earlier = earlierJobs(mem, { ref: u.lines[it.n - 1]?.ref ?? null, label: it.label }, shop);
    const text = compareToLastTime(earlier, it.amount, shop);
    if (text) {
      note = { text, when: monthYear(earlier[0].date) };
      break;
    }
  }

  const receiptFor = (o: { sent: string[]; waiting?: string }): Receipt => {
    const w = whereRan({ where, online, sent: o.sent.length ? unknown.length : 0, pending });
    return {
      w,
      n: w === 'pending' ? pending : unknown.length,
      stayed:
        where === 'device'
          ? [tr('where.picture'), tr('where.covered.quote'), ...(note ? [tr('where.note', { when: note.when })] : []), tr('where.prices', { n: items.length - pending, total: items.length })]
          : [...(note ? [tr('where.note', { when: note.when })] : []), tr('where.prices', { n: items.length - pending, total: items.length })],
      sent: where === 'cloud' ? [tr('where.sent.picture'), tr('where.sent.question', { q: c.question }), ...o.sent] : o.sent,
      sentPicture: where === 'cloud',
      waiting: o.waiting,
      sources: priceSources(matched as PriceItem[]),
      tech: tech(c, o.sent.length ? [`Price requests filed for ${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} (masked item and region only).`] : []),
    };
  };
  let receipt = receiptFor({
    sent: lookNow ? parcel : [],
    waiting: unknown.length && !online ? tr('where.waiting', { names: names.join(', ') }) : lookNow ? tr('where.requested', { names: names.join(', ') }) : undefined,
  });

  // The answer goes on screen at once; it is read out after.
  const lines: Said[] = [...summary.sentences];
  if (note) lines.push({ text: note.text, noteTag: true });
  lines.push(...firstTimeHere(where));
  if (where === 'device') lines.push(tr('quote.stays', { device: dev() }));
  if (unknown.length && !online) lines.push(names.length === 1 ? tr('quote.wait') : tr('quote.wait.n'));
  if (lookNow) lines.push(names.length === 1 ? tr('quote.requested') : tr('quote.requested.n'));
  const verdictLines = [...lines];
  const car = matched.some((x) => (x.category ?? '').startsWith('car'));

  clearLines();
  setHead(summary.verdict.tone, summary.verdict.text);
  patch({ items, receipt });
  await keep(c, {
    kind: 'Quote',
    family: 'quote',
    title: quoteTitle(items, shop),
    tone: summary.verdict.tone,
    verdict: summary.verdict.text,
    lines: verdictLines,
    items,
    receipt,
    project: car ? tr('project.car') : undefined,
  });
  alive(t);
  if (lookNow) {
    fileRequests(names, kb.region, (_filed, failed) => {
      if (!failed.length) return;
      receipt = receiptFor({ sent: parcel, waiting: tr('where.waiting', { names: failed.join(', ') }) });
      if (current() === t) patch({ receipt });
    });
  }

  // The next questions: words for the shop, the lines not checked (and, on this device, the offer to look them up),
  // and a guide when one fits a line.
  const refs = u.lines.map((l) => l.ref).filter((r): r is string => !!r);
  const myself = await guidesFor(kb, refs, matched.map((m) => m.name)).catch(() => [] as Guide[]);
  alive(t);
  let looked = lookNow;
  const unchecked = async (t2: number) => {
    const pend = items.filter((i) => i.state === 'pending').map((i) => i.label);
    setHead('plain', pend.length ? tr('quote.unchecked', { names: listNames(pend) }) : tr('quote.unchecked.none'));
    patch({ receipt, items });
    settle();
    if (unknown.length && online && !looked) {
      // Ask before one line goes over the internet: only the masked line names and the region.
      const yes = await ask(
        t2,
        {
          kind: 'net',
          title: unknown.length === 1 ? tr('ask.item.title') : tr('ask.items.title', { n: unknown.length }),
          body: tr('ask.send'),
          parcel,
          not: [tr('ask.item.not')],
          yes: tr('ask.item.yes'),
          no: tr('ask.item.no'),
        },
        [tr('ask.item.say')],
      );
      looked = true;
      if (yes) {
        setPrefs({ consented: true });
        receipt = receiptFor({ sent: parcel, waiting: tr('where.requested', { names: names.join(', ') }) });
        fileRequests(names, kb.region, () => undefined);
      } else receipt = receiptFor({ sent: [], waiting: tr('where.declined', { names: names.join(', ') }) });
      patch({ receipt });
      void narrate(t2, [yes ? (names.length === 1 ? tr('quote.requested') : tr('quote.requested.n')) : names.length === 1 ? tr('quote.skip') : tr('quote.skip.n')]);
    } else void narrate(t2, []);
    offerNext(quoteNext('unchecked'));
  };
  const say = summary.worst
    ? (t2: number) => {
        setHead('plain', tr('quote.say.title'));
        settle();
        void narrate(t2, [{ text: sayToShop(summary.worst!), kind: 'strong' }]);
        offerNext(quoteNext('say'));
      }
    : undefined;
  const again = () => {
    setHead(summary.verdict.tone, summary.verdict.text);
    patch({ items, receipt });
    settle();
    void narrate(current(), verdictLines);
    offerNext(quoteNext());
  };
  const quoteNext = (skip?: 'say' | 'unchecked' | 'myself'): Next[] => [
    ...(say && skip !== 'say' ? [nextQ(tr('next.say'), say)] : []),
    ...(pending && skip !== 'unchecked' ? [nextQ(tr('next.unchecked'), unchecked)] : []),
    ...(myself.length && skip !== 'myself' ? [nextQ(tr('next.myself.any'), (t2) => chooseGuide(t2, { ...c, t: t2 }, myself))] : []),
  ];
  topic = { kind: 'quote', c, again, next: () => quoteNext(), say, myself };

  void narrate(t, lines);
  setPhase('settled');
  offerNext(quoteNext());
  await narrated();
  alive(t);
  const asked = await rememberShop(t, shop, items, u.lines.map((l) => l.ref));
  settle();
  if (!asked) await offerReady(t);
}

async function rememberShop(t: number, shop: string | null, items: LineItem[], refs: Array<string | null>): Promise<boolean> {
  if (!shop || !getPrefs().offerNotes) return false;
  const date = today();
  const jobs: JobMemory[] = items
    .filter((i) => i.amount !== null && i.amount >= 0)
    .slice(0, 6)
    .map((i) => ({ kind: 'job', id: newId('m'), shop, ref: refs[i.n - 1] ?? null, label: i.label.slice(0, 120), amount: i.amount as number, date }));
  if (!jobs.length) return false;
  const mem = dataStore.get().memory;
  const known = mem.some((m) => m.kind === 'job' && norm(m.shop) === norm(shop));
  if (known) {
    if (mem.some((m) => m.kind === 'job' && norm(m.shop) === norm(shop) && m.date === date)) return false;
    for (const j of jobs) await putMemory(j);
    void narrate(t, [tr('note.added', { device: dev() })]);
    return false;
  }
  const first = !getPrefs().toldNotes;
  const yes = await ask(
    t,
    {
      kind: 'note',
      title: tr('note.ask.shop'),
      body: tr('note.ask.body', { device: dev() }),
      parcel: [shop, ...jobs.map((j) => `${j.label}, ${money(j.amount)}`), longDate(date)],
      not: [tr('note.ask.fine', { device: dev() })],
      yes: tr('note.ask.yes'),
      no: tr('note.ask.no'),
    },
    first ? [tr('note.ask.shop'), tr('note.ask.first', { device: dev() })] : [tr('note.ask.shop')],
  );
  setPrefs({ toldNotes: true });
  if (yes) for (const j of jobs) await putMemory(j);
  void narrate(t, [yes ? tr('note.wrote') : tr('note.declined')]);
  return true;
}

// ---------- a bill or a letter ----------

async function billFlow(c: Ctx) {
  const { t, reading, settings, where } = c;
  const u = reading.understanding;
  const mem = dataStore.get().memory;
  const known = knownPayees(mem);
  const masked = maskText([u.payee ?? '', ...u.lines.map((l) => l.label)].join(' '));
  let v = billVerdict(u, masked, known);
  // Remote Config phrases can only add the urgency warning, never clear one.
  const { matchesPhrase } = await import('../config');
  if (!v.flags.includes('urgency') && matchesPhrase(masked, settings.urgencyPhrases)) v = { safe: false, flags: [...v.flags, 'urgency'] };
  const payee = nameOf(u.payee);
  const ans = billAnswer(v, payee, known, u.payTo);
  const match = known.find((k) => payee && k.name.toLowerCase() === payee.toLowerCase());
  const usedNote = ans.reasons.some((r) => r.fromNote) || (v.safe && !!match);

  const receipt: Receipt = {
    w: whereRan({ where, online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed:
      where === 'device'
        ? [tr('where.picture'), tr('where.covered.letter'), ...(usedNote && match ? [tr('where.note.payee', { digits: match.payTo })] : []), tr('where.rules', { device: dev() })]
        : [...(usedNote && match ? [tr('where.note.payee', { digits: match.payTo })] : []), tr('where.rules', { device: dev() })],
    sent: where === 'cloud' ? [tr('where.sent.picture'), tr('where.sent.question', { q: c.question })] : [],
    sentPicture: where === 'cloud',
    sources: [{ label: tr('where.src.rules', { device: dev() }), date: tr('where.checked', { date: longDate(c.kb.version.slice(0, 10)) }) }],
    tech: tech(c, [`Bill flags: ${v.flags.join(', ') || 'none'}.`]),
  };
  const reasons: Said[] = [...ans.reasons.map((r) => ({ text: r.text, noteTag: !!r.fromNote })), ...(ans.doLine ? [ans.doLine] : [])];
  const lines: Said[] = [...reasons, ...firstTimeHere(where), ...(where === 'device' ? [tr('letter.stays', { device: dev() })] : [])];

  clearLines();
  setHead(ans.verdict.tone, ans.verdict.text);
  patch({ receipt });
  await keep(c, {
    kind: 'Bill',
    family: 'bill',
    title: payee ? `Bill from ${payee}` : tr('kind.Bill'),
    tone: ans.verdict.tone,
    verdict: ans.verdict.text,
    lines,
    receipt,
  });
  alive(t);

  // "Remember this company": only after a bill whose one doubt is that WeKnow has not seen it before.
  const digits = (u.payTo ?? '').replace(/\D/g, '');
  const onlyNew = v.flags.length === 1 && v.flags[0] === 'new-payee';
  let canRemember = !!payee && digits.length >= 4 && onlyNew && getPrefs().offerNotes;
  if (v.safe && match) {
    const old = mem.find((m): m is PayeeMemory => m.kind === 'payee' && m.name === match.name);
    if (old) await putMemory({ ...old, date: today() });
  }
  const tone = ans.verdict.tone;
  const whatNow = (t2: number) => {
    const p = getPrefs();
    setHead('plain', ans.doLine ?? tr('bill.do.ok'));
    patch({ receipt });
    if (tone !== 'ok' && p.trustedName && p.trustedNumber)
      patch({ links: [{ value: 'call', label: tr('letter.call', { name: p.trustedName }), href: `tel:${p.trustedNumber.replace(/[^\d+]/g, '')}`, icon: 'phone' }] });
    settle();
    void narrate(t2, []);
    offerNext(billNext('do'));
  };
  const again = () => {
    setHead(ans.verdict.tone, ans.verdict.text);
    patch({ receipt });
    settle();
    void narrate(current(), reasons);
    offerNext(billNext());
  };
  const billNext = (skip?: 'do' | 'remember' | 'remind'): Next[] => [
    ...(skip !== 'do' ? [nextQ(tr('next.billdo'), whatNow)] : []),
    ...(canRemember && skip !== 'remember'
      ? [
          nextQ(tr('next.remember'), async (t2) => {
            // Pressing it is the yes: the name, the last four digits and the date are kept on this device.
            await putMemory({ kind: 'payee', id: newId('m'), name: payee!, payTo: digits.slice(-4), date: today() });
            setPrefs({ toldNotes: true });
            alive(t2);
            canRemember = false;
            setHead('plain', tr('remember.done', { payee: payee!, device: dev() }));
            settle();
            void narrate(t2, []);
            offerNext(billNext('remember'));
          }),
        ]
      : []),
    ...(tone !== 'stop' && skip !== 'remind'
      ? [
          nextQ(tr('next.remind'), (t2) => {
            ui.openReminder({ title: payee ? tr('remind.default', { payee }) : tr('remind.default.none') });
            settle();
            void narrate(t2, []);
            offerNext(billNext('remind'));
          }),
        ]
      : []),
  ];
  topic = { kind: 'bill', c, again, next: () => billNext(), whatNow };
  settle();
  void narrate(t, lines);
  offerNext(billNext());
  await offerReady(t);
}

// ---------- a household problem ----------

/** "Find a pro nearby": a link that stays under the answer; the search holds the kind of job only. */
async function proLinks(g: Guide) {
  const { proNearbyUrl } = await import('../maps');
  const p = getPrefs();
  const links: Choice[] = [{ value: 'maps', label: tr('pro.find'), href: proNearbyUrl(g.category), icon: 'map', external: true }];
  if (p.trustedName && p.trustedNumber)
    links.push({ value: 'call', label: tr('letter.call', { name: p.trustedName }), href: `tel:${p.trustedNumber.replace(/[^\d+]/g, '')}`, icon: 'phone' });
  patch({ links });
}

async function problemFlow(c: Ctx) {
  const { t, reading } = c;
  const u = reading.understanding;
  const guide = u.problemRef ? guideByRef(reading.pack, u.problemRef) : undefined;
  if (guide) return guideAnswer(c, guide);
  // The reader is not sure which problem it is: offer likely guides from the pack instead of picking one.
  const guides = await c.kb.candidates(c.question, { kind: 'guide', k: 3 }).catch(() => [] as Candidate[]);
  alive(t);
  clearLines();
  if (guides.length) return maybeGuides(t, c, guides);
  setHead('plain', tr('new.title'));
  settle();
  void narrate(t, [tr('new.line'), ...(!deviceStore.get().online ? [tr('new.offline')] : [])]);
}

function guideReceipt(c: Ctx, guide: Guide): Receipt {
  const { where } = c;
  return {
    w: whereRan({ where, online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed: where === 'device' ? [...(c.picture ? [tr('where.picture')] : []), tr('where.question'), tr('where.steps')] : [tr('where.steps')],
    sent: where === 'cloud' ? [tr('where.sent.picture'), tr('where.sent.question', { q: c.question })] : [],
    sentPicture: where === 'cloud',
    sources: guideSources(guide),
    tech: tech(c),
  };
}

/** A problem WeKnow knows: what it is and how long it takes; the steps and the pro price are the next questions. */
async function guideAnswer(c: Ctx, guide: Guide) {
  const { t, reading, where } = c;
  const pro = proPrice(reading.pack, guide);
  const proSentence = proLine(reading.pack, guide, pro);
  const receipt = guideReceipt(c, guide);
  topic = { kind: 'guide', c, guide };
  clearLines();
  patch({ receipt });
  if (!guide.steps.length) {
    // Needs a professional: never offers steps.
    setHead('stop', tr('danger.title'));
    const lines: Said[] = [tr('danger.line', { reason: guide.safety?.[0] ?? guide.name }), ...(proSentence ? [proSentence] : []), ...firstTimeHere(where)];
    await keep(c, { kind: 'Guide', family: 'problem', title: guide.name, tone: 'stop', verdict: tr('danger.title'), lines, receipt });
    await proLinks(guide);
    settle();
    void narrate(t, lines);
    return;
  }
  setHead('plain', tr('fix.what', { guide: guide.name }));
  const lines: Said[] = [tr('fix.time', { minutes: minutesText(guide) }), ...firstTimeHere(where)];
  await keep(c, { kind: 'Guide', family: 'problem', title: guide.name, tone: 'ok', verdict: tr('fix.what', { guide: guide.name }), lines, receipt });
  alive(t);
  settle();
  void narrate(t, lines);
  offerNext(guideNext(c, guide, receipt, proSentence));
  await offerReady(t);
}

function guideNext(c: Ctx, guide: Guide, receipt: Receipt, proSentence: string | null, skip?: 'steps' | 'pro'): Next[] {
  return [
    ...(skip !== 'steps' && guide.steps.length ? [nextQ(tr('next.steps'), (t2) => guideFlow({ ...c, t: t2 }, guide, -1, receipt, proSentence))] : []),
    ...(skip !== 'pro' && proSentence ? [nextQ(tr('next.pro'), (t2) => proAnswer(t2, { ...c, t: t2 }, guide))] : []),
  ];
}

/** "How much would a pro charge?": the pack's pro price for this guide, and where to find one. */
async function proAnswer(t: number, c: Ctx, guide: Guide) {
  const pack = c.reading.pack;
  const sentence = proLine(pack, guide, proPrice(pack, guide));
  setHead('plain', sentence ?? tr('pro.none'));
  patch({ receipt: guideReceipt(c, guide) });
  await proLinks(guide);
  alive(t);
  settle();
  void narrate(t, [tr('guide.pro.quote')]);
  offerNext(guideNext(c, guide, guideReceipt(c, guide), sentence, 'pro'));
}

/**
 * Step by step, as messages: each step is its own message, with Next step, Say it again and Stop under the newest.
 * `from` -1 starts with "Before you start". Each instruction is on screen at once and read out in the background;
 * the buttons (and Space, the arrows and Escape) work at any moment and cut the reading.
 */
async function guideFlow(c: Ctx, g: Guide, from: number, receipt: Receipt, proSentence: string | null): Promise<void> {
  const { t } = c;
  const total = g.steps.length;
  topic = { kind: 'guide', c, guide: g };
  patch({ still: null, looking: false });
  archive();
  setPhase('guide');

  if (from < 0) {
    patch({ steps: { label: tr('guide.before'), n: 0, total } });
    const cautions: Said[] = (g.safety ?? []).slice(0, 2).map((s, i) => ({ text: i === 0 ? tr('guide.caution', { text: s }) : tr('guide.caution.more', { text: s }), kind: 'warn' as const }));
    if (g.stopIf?.length) cautions.push({ text: tr('guide.stopif', { text: g.stopIf.slice(0, 2).join(' Or: ') }), kind: 'warn' });
    const pressed = press(t);
    void narrate(t, cautions.length ? cautions : [tr('fix.time', { minutes: minutesText(g) })]);
    const a = await pressed;
    if (a === 'stop') return guideStop(c, g, 0, receipt, proSentence);
    from = 0;
  }
  let good = false;
  let again = false;
  for (let i = from; i < total; i++) {
    // A new step is a new message; "Say it again" says the same message again.
    if (!again) archive();
    setPhase('guide');
    patch({ steps: { label: tr('guide.step', { n: i + 1, total }), n: i + 1, total } });
    clearLines();
    const pressed = press(t);
    void narrate(t, [...(good ? [{ text: tr('guide.ok'), kind: 'ok' as const }] : []), { text: g.steps[i], kind: 'strong' as const }]);
    const act = await pressed;
    if (act === 'stop') return guideStop(c, g, i, receipt, proSentence);
    good = act === 'next';
    again = act === 'again';
    if (again) i--;
  }
  archive();
  setPhase('speaking');
  setHead('ok', tr('guide.done.title', { total }));
  void narrate(t, [{ text: tr('guide.ok'), kind: 'ok' }, tr('guide.done.ask')]);
  const fixed = await choice(t, [
    { value: 'yes', label: tr('next.fixed') },
    { value: 'no', label: tr('next.broken') },
  ]);
  const tone: Tone = fixed === 'yes' ? 'ok' : 'warn';
  const verdict = fixed === 'yes' ? tr('guide.good.title') : proSentence ?? tr('guide.pro.title');
  const lines: Said[] = fixed === 'yes' ? [tr('guide.good.line')] : [tr('guide.pro.quote')];
  setHead(fixed === 'yes' ? 'plain' : 'warn', verdict);
  patch({ receipt });
  await keep(c, { kind: 'Guide', family: 'problem', title: g.name, tone, verdict, lines, receipt });
  if (tone === 'warn') await proLinks(g);
  settle();
  void narrate(t, lines);
  await offerReady(t);
}

async function guideStop(c: Ctx, g: Guide, i: number, receipt: Receipt, proSentence: string | null): Promise<void> {
  const { t } = c;
  archive();
  setPhase('speaking');
  setHead('plain', tr('guide.stop.title', { n: i + 1 }));
  void narrate(t, [tr('guide.wait')]);
  const go = await choice(t, [
    { value: 'go', label: tr('guide.carry') },
    { value: 'end', label: tr('guide.finish') },
  ]);
  if (go === 'go') return guideFlow(c, g, i, receipt, proSentence);
  const verdict = tr('guide.stop.title', { n: i + 1 });
  await keep(c, { kind: 'Guide', family: 'problem', title: g.name, tone: 'plain', verdict, lines: [], receipt });
  setHead('plain', verdict);
  patch({ receipt });
  settle();
  void narrate(t, []);
  offerNext(guideNext(c, g, receipt, proSentence));
}

// ---------- hear a kept check again (nothing is sent anywhere) ----------

export function replay(check: Check) {
  void run(async (t) => {
    const url = check.pictureId ? await pictureUrl(check.pictureId) : undefined;
    alive(t);
    const sameDay = new Date(check.date).toDateString() === new Date().toDateString();
    // The kept question and picture come back as the person's message, the kept answer under it.
    topic = null;
    postMine(check.question || (sameDay ? tr('asked.earlier') : tr('asked.date', { date: shortDate(check.date) })), url);
    patch({
      still: url ?? null,
      looking: false,
      asked: sameDay ? tr('asked.earlier') : tr('asked.date', { date: shortDate(check.date) }),
      items: check.items ?? null,
      receipt: check.receipt,
      kept: { checkId: check.id },
    });
    setHead(check.tone, check.verdict);
    settle();
    void narrate(t, check.lines.map((text, i) => ({ text, noteTag: i === check.noteLine })));
  });
}

/** Stop the reading-out only (used when the page is left); the answer stays. */
export const stopTalking = cutNarration;
