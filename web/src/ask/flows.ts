// What happens after Ask, for real: hear the question (or take the sample's own question), take a still, route
// (this device when its model is ready, the internet only after a yes), read with reader.readPhoto, then let plain
// code decide (core/verdict.ts). The answer is put on screen as soon as it is decided, and only then read out:
// narration never holds a button. Every number shown or said comes from a pack item; every sentence is in strings.ts.

import type { Reading, Where } from '../reader';
import type { Covered } from '../coverPicture';
import type { Settings } from '../config';
import type { Candidate, LayeredKnowledge } from '../core/knowledge';
import type { Guide, Pack, PriceItem } from '../core/packs';
import type { JobMemory, PayeeMemory } from '../core/memory';
import { compareToLastTime, earlierJobs, knownPayees } from '../core/memory';
import { isBusy } from './errors';
import { billVerdict, quoteVerdicts, withBillMath } from '../core/verdict';
import { amountsFromRows, amountsIn, billMath, keepPrinted, payToOf, type BillMath } from '../core/billMath';
import { guideByRef, priceByRef, proPrice } from '../core/packs';
import { aboutPicture, followUp, jobWords, kindOrder, lean, matchStrength, pickConfident, priceAnswer, sharesJobWord, terms, type ItemKind, type Scored } from './words';
import { afterConsent, gate, route, type Reason } from './router';
import { coverWords, escalate } from './escalate';
import type { PIIKind } from '../core/pii';
import type { WebAnswer } from '../core/webAnswer';
import { billQuestion } from '../core/billCheck';
import type { BillCheckResult } from '../webSearch';
import { maskText } from '../core/pii';
import { coverPaperText, flatPayload } from '../core/paperText';
import { openSheet } from '../ui/uiStore';
import { withRetry } from '../core/templateParse';
import { basicBill, basicKind, basicPayee } from '../core/basicRead';
import { buildCloudLookup } from '../core/cloudPayload';
import {
  billAnswer,
  coveredList,
  guideSources,
  lineItems,
  listNames,
  minutesText,
  priceSources,
  proLine,
  quoteSummary,
  quoteTitle,
  sayToShop,
  sumLines,
  whereRan,
} from '../answer/compose';
import type { LineItem, Receipt, Tone } from '../answer/types';
import { t as tr, money, monthYear, longDate, shortDate } from '../strings';
import { appSettings, knowledge } from '../engine/knowledge';
import { deviceStore, deviceWord, getReady, refreshModel } from '../engine/device';
import { listening, soundEnd, soundStart, wait, sayAloud } from '../engine/speech';
import { permission, torch, type CameraState } from '../engine/camera';
import { addCheck, dataStore, newId, pictureUrl, putMemory, type Check, type CheckKind, type Family } from '../store/data';
import { getPrefs, setPrefs } from '../store/prefs';
import { addToBox, boxText, focusBox, setBox } from './box';
import {
  alive,
  archive,
  ask,
  askSheet,
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
  type Paper,
  type Said,
  type SheetRequest,
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
    attach(sent.blob, sent.sample, sent.camera, sent.paper);
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
let lastSent: { blob: Blob; sample?: string; camera?: boolean; paper?: Paper; question: string } | null = null;

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
    void run((t) => pictureFlow(t, q || tr('box.camera.q'), { blob: pic.blob, sample: pic.sample, camera: pic.camera, paper: pic.paper }, true));
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

/** A file that was chosen, pasted or dropped could not be taken: say why, and what works instead. */
export function cannotTake(why: 'type' | 'pdf' | 'locked') {
  void run(async (t) => {
    archive();
    setHead('plain', why === 'type' ? tr('take.type.title') : tr('take.pdf.title'));
    settle();
    void narrate(t, [why === 'type' ? tr('take.type.line') : why === 'locked' ? tr('take.locked.line') : tr('take.pdf.line')]);
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
  // The device could not answer: the router says whether the cloud should try, and why.
  let never = false;
  if (r && !aboutPicture(question)) {
    const rt = route({ input: 'words', hit: false, found: r.found, model: deviceStore.get().model === 'available', words: terms(jobWords(question)).length });
    if (rt.escalate && rt.reason) {
      const out = await escalateFlow(r.ctx, question, rt.reason, 'words');
      alive(t);
      if (out === 'answered') return;
      if (out !== 'stayed') return notInPacks(t, r.ctx, out);
      never = getPrefs().internet === 'never';
    }
  }
  if (r && r.guides.length) return maybeGuides(t, r.ctx, r.guides, never);
  if (aboutPicture(question)) return needPicture(t);
  dontKnow(t, never);
}

interface PictureSrc {
  blob: Blob;
  sample?: string;
  camera?: boolean;
  /** A PDF: its own text, taken out on this device. */
  paper?: Paper;
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

  // A PDF with real text is read from its own words (exact, no text recognition). A bill is answered from them;
  // anything else is read from its picture below, the usual way.
  if (pic.paper?.hasText) {
    const done = await paperFlow(t, question, pic);
    alive(t);
    if (done) return;
  }

  // The model may have finished downloading since the page opened: ask again before deciding.
  if (deviceStore.get().model !== 'available') await refreshModel();
  alive(t);
  const d = deviceStore.get();
  // A device with no model of its own: the paper is never sent anywhere to be read. Plain code does the basic check
  // on this device, and says how to get the full one.
  if (d.model !== 'available') return noModelPicture(t, question, pic);
  const where: Where = 'device';

  // The paper's own words, read on this device alongside the model (a PDF's text, or the text recognizer's lines):
  // plain code takes quote lines and the kind of paper from them.
  const printed: Promise<string[] | null> = pic.paper
    ? Promise.resolve(pic.paper.text.split('\n'))
    : import('../coverPicture').then(({ readLines }) => readLines(still.blob)).catch(() => null);
  // Start reading at once; what WeKnow is doing is said while it reads, never before.
  const job = (async () => {
    const [kb, settings] = await Promise.all([knowledge(), appSettings()]);
    const reading = await readNow(kb, settings, still.blob, question, where, undefined, sideFor(pic), printed);
    return { kb, settings, reading };
  })();
  job.catch(() => undefined);
  const paper = PAPER.test(question);
  setPhase('looking');
  patch({ reading: paper });
  void narrate(t, [paper ? tr('look.paper') : tr('look.thing')]);
  let read: Awaited<typeof job>;
  try {
    read = await withWaits(t, withTimeout(job, READ_TIMEOUT));
  } catch (e) {
    if (e instanceof Cancel) throw e;
    // The model on this device could not read it (an error, a refusal, too slow). The picture still goes nowhere:
    // plain code does the basic check here.
    console.warn('[WeKnow] the model on this device could not read the picture; doing the basic check', e);
    alive(t);
    return noModelPicture(t, question, pic);
  }
  const { kb, settings, reading } = read;
  patch({ reading: false });
  lastSent = null;

  const ctx: Ctx = { t, question, where, reading, kb, settings, picture: still.blob, src: pic, printed: await printed };
  // Plain code has the last word on what kind of paper it is: when the printed words plainly say bill and the model
  // said quote, the words win. Seen on Gemini Nano: an "INVOICE ... Balance due" letter read
  // as a repair quote, so its fees were priced instead of the bill being checked.
  if (where === 'device' && reading.understanding.kind === 'quote') {
    const printed = (await paperWords(ctx)) ?? [];
    alive(t);
    if (reading.understanding.kind === 'quote' && basicKind(printed) === 'bill') {
      const u = reading.understanding;
      reading.understanding = { ...u, kind: 'bill', lines: [], payee: u.payee ?? basicPayee(printed, knownPayees(dataStore.get().memory).map((k) => k.name), true) };
      console.info('[WeKnow] the model read a quote; the printed words say bill');
    }
  }
  const kind = reading.understanding.kind;
  if (kind === 'quote') return quoteFlow(ctx);
  if (kind === 'bill') return billFlow(ctx);

  // Read on this device, but the kind is unknown, or no guide fits: the covered problem words (never the picture)
  // go to the cloud to be placed in the whole pack index.
  let none: Escalated | null = null;
  let never = false;
  const text = `${reading.problem ?? ''} ${question}`.trim();
  const rt = route({
    input: 'picture',
    ranOn: where,
    model: d.model === 'available',
    kind,
    offered: reading.retrieval.offered,
    chosen: !!reading.understanding.problemRef && !!guideByRef(reading.pack, reading.understanding.problemRef),
    words: terms(text).length,
  });
  if (rt.escalate && rt.reason) {
    const out = await escalateFlow(ctx, text, rt.reason, 'picture');
    alive(t);
    if (out === 'answered') return;
    if (out !== 'stayed') none = out;
    else never = getPrefs().internet === 'never';
  }
  if (kind === 'problem') return problemFlow(none ? { ...ctx, escalated: none } : ctx, never);
  // Not sure what the picture is: ask, with buttons, instead of guessing.
  topic = { kind: 'unknown', c: ctx };
  clearLines();
  setHead('plain', none ? tr('route.none.title') : tr('what.title'));
  if (none) patch({ receipt: escReceipt({ ...ctx, escalated: none }, []) });
  settle();
  void narrate(t, [...noneLines(none ?? undefined), tr('what.line'), ...(never ? [tr('route.never', { device: dev() })] : [])]);
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
  /** On the cloud path: the covered copy that was sent, and what was covered on it. */
  covered?: Covered;
  /**
   * The basic check: this device has no model of its own, so the paper's words were checked by plain code alone
   * (core/basicRead.ts). Nothing was sent to be read. `lines` are the words read from a picture on this device.
   */
  basic?: { lines?: string[] };
  /** The paper's printed words once read on this device for the plain-code checks (kept so they are read once). */
  printed?: string[] | null;
  /** On the cloud path: why the cloud read it (the router's reason). */
  cloudWhy?: Reason;
  /** Set when the device could not answer well and the covered words were checked online. */
  escalated?: Escalated;
  /**
   * A PDF read from its own words: the words as printed (they stay on this device), their covered form (all a model
   * ever saw) and what was covered in them.
   */
  paper?: { text: string; masked: string; counts: Partial<Record<PIIKind, number>> };
}

/** A check online of covered words: what went, why, and what came back. */
interface Escalated {
  reason: Reason;
  input: 'words' | 'picture';
  /** The exact words that went. */
  sent: string;
  /** What was covered in them before they went. */
  counts: Partial<Record<PIIKind, number>>;
  /** Index entries offered (every guide and price name). */
  offered: number;
  ms: number;
  model: string;
  reviewed: boolean;
  found: boolean;
  /** Not in the packs: the same covered words were searched on the web (sources: https pages that came back). */
  web?: { sent: string; tries: number; ms: number; sources: number; reason?: string };
}

/**
 * Read a picture. On the cloud path the reader gets the covered copy only, never `blob` (the picture as taken):
 * without a covered copy nothing is read in the cloud.
 */
async function readNow(kb: LayeredKnowledge, s: Settings, blob: Blob, question: string, where: Where, covered?: Covered, maxSide?: number, printed?: Promise<string[] | null>): Promise<Reading> {
  const [{ readPhoto, setCloudModel }, { shrinkPhoto }] = await Promise.all([import('../reader'), import('../image')]);
  setCloudModel(s.cloudModel);
  if (where === 'cloud') {
    if (!covered) throw new Error('the picture was not covered');
    return readPhoto(kb, covered.blob, question, where);
  }
  const small = await shrinkPhoto(blob, maxSide);
  return readPhoto(kb, small, question, where, printed);
}

/** The long side a picture is shrunk to before reading: two PDF pages stacked need more to keep small print. */
const sideFor = (pic: PictureSrc) => (pic.paper ? 2400 : undefined);

/**
 * A PDF with real text: its words are covered on this device (core/pii.ts) and read into the bill form, by this
 * device's model when it has one, otherwise in the cloud after a yes that shows the exact covered words. Only those
 * covered words may go, never the picture. True when it was answered (or stopped); false when it is not a bill, so
 * the caller reads its picture the usual way.
 */
async function paperFlow(t: number, question: string, pic: PictureSrc): Promise<boolean> {
  const paper = pic.paper!;
  if (deviceStore.get().model !== 'available') await refreshModel();
  alive(t);
  const d = deviceStore.get();
  // No model on this device: the PDF's words are checked by plain code here, and go nowhere.
  if (d.model !== 'available') return basicPaper(t, question, pic, paper.text.split('\n'), true);
  const where: Where = 'device';
  const { readMailText } = await import('../textReader');
  alive(t);
  // Covered on this device first, line by line (a name under its label too); only this form is ever read by a model.
  const { text: coveredText, counts } = coverPaperText(paper.text);
  const job = (async () => {
    const [kb, settings] = await Promise.all([knowledge(), appSettings()]);
    const r = await readMailText(coveredText, where, settings.cloudModel, 'paper');
    return { kb, settings, r, pack: await kb.resolve([]) };
  })();
  job.catch(() => undefined);
  setPhase('looking');
  patch({ reading: true });
  void narrate(t, [tr('look.paper')]);
  let read: Awaited<typeof job>;
  try {
    read = await withWaits(t, withTimeout(job, READ_TIMEOUT));
  } catch (e) {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] the model on this device could not read the paper; doing the basic check', e);
    alive(t);
    return basicPaper(t, question, pic, paper.text.split('\n'), true);
  }
  const { kb, settings, r, pack } = read;
  patch({ reading: false });
  if (r.understanding.kind !== 'bill') return false;
  lastSent = null;
  const reading: Reading = {
    understanding: r.understanding,
    where,
    ms: r.ms,
    steps: { read: r.ms, choose: 0 },
    pack,
    retrieval: { shards: [], bytes: 0, offered: 0, trimmed: 0 },
  };
  await billFlow({
    t,
    question,
    where,
    reading,
    kb,
    settings,
    picture: pic.blob,
    src: pic,
    paper: { text: paper.text, masked: r.masked, counts },
  });
  return true;
}

/**
 * The basic check of a paper, on a device with no model of its own: plain code says what kind of paper it is and who
 * asks to be paid (core/basicRead.ts), and a bill then goes through the same plain rules as every bill. The words
 * never leave this device. True when it was answered here.
 */
async function basicPaper(t: number, question: string, pic: PictureSrc, lines: string[], fromPdf: boolean): Promise<boolean> {
  const kind = basicKind(lines);
  if (kind !== 'bill') {
    needModel(t, kind === 'quote' ? 'quote' : 'paper');
    return true;
  }
  setPhase('looking');
  patch({ reading: true });
  void narrate(t, [tr('look.paper')]);
  const [kb, settings] = await Promise.all([knowledge(), appSettings()]);
  alive(t);
  const text = lines.join('\n');
  const { text: coveredText, counts } = coverPaperText(text);
  const understanding = basicBill(coveredText.split('\n'), knownPayees(dataStore.get().memory).map((k) => k.name), !fromPdf);
  patch({ reading: false });
  lastSent = null;
  const reading: Reading = { understanding, where: 'device', ms: 0, steps: { read: 0, choose: 0 }, pack: await kb.resolve([]), retrieval: { shards: [], bytes: 0, offered: 0, trimmed: 0 } };
  alive(t);
  await billFlow({
    t,
    question,
    where: 'device',
    reading,
    kb,
    settings,
    picture: pic.blob,
    src: pic,
    basic: fromPdf ? {} : { lines },
    ...(fromPdf ? { paper: { text, masked: flatPayload(coveredText), counts } } : {}),
  });
  return true;
}

/**
 * A picture on a device with no model of its own. Its words are read here by the text recognizer; a bill gets the
 * basic check. Anything else cannot be looked at here: a question that names the problem is answered from its
 * words, and otherwise WeKnow says what the full check needs. The picture is never sent.
 */
async function noModelPicture(t: number, question: string, pic: PictureSrc) {
  const paper = PAPER.test(question);
  setPhase('looking');
  patch({ reading: paper });
  void narrate(t, [paper ? tr('look.paper') : tr('look.thing')]);
  let lines: string[] | null = null;
  try {
    const { readLines } = await import('../coverPicture');
    lines = await withWaits(t, withTimeout(readLines(pic.blob), READ_TIMEOUT));
  } catch (e) {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] could not read the words on the picture', e);
  }
  alive(t);
  patch({ reading: false });
  lastSent = null;
  const kind = lines ? basicKind(lines) : 'unknown';
  if (lines && kind === 'bill') return void (await basicPaper(t, question, pic, lines, false));
  if (kind === 'quote') return needModel(t, 'quote');
  // A thing, not a paper: the words of the question still find a guide or a price ("Why won't this drain?").
  if (!paper && terms(jobWords(question)).length) {
    const r = await wordsFlow(t, question);
    alive(t);
    if (r === true) return void toldBasic(t);
    if (r && r.guides.length) return maybeGuides(t, r.ctx, r.guides);
  }
  needModel(t, paper ? 'paper' : 'thing');
}

/** Says, once per answer, that this was the basic check, and opens what the full one needs the first time. */
function toldBasic(t: number) {
  alive(t);
  if (getPrefs().toldBasic) return;
  setPrefs({ toldBasic: true });
  openSheet({ type: 'needmodel' });
}

/** This device cannot look at this by itself, and nothing was sent: what it is, and how to get the full check. */
function needModel(t: number, what: 'quote' | 'paper' | 'thing') {
  lastSent = null;
  topic = null;
  patch({ looking: false, reading: false, chip: null });
  clearLines();
  setHead('plain', tr(`need.${what}.title`, { device: dev() }));
  settle();
  void narrate(t, [tr(`need.${what}.line`, { device: dev() }), tr('need.stays', { device: dev() })]);
  offerNext([{ label: tr('need.how'), act: () => openSheet({ type: 'needmodel' }) }]);
  patch({ offerSamples: false });
}

/**
 * The paper's own words, as printed, for the plain-code bill checks (core/billMath.ts): a PDF's text, else the
 * words the text recognizer found while covering the picture, else the picture's words read now on this device.
 * Null when there are none (nothing is checked then). They never leave this device.
 */
async function paperWords(c: Ctx): Promise<string[] | null> {
  if (c.printed !== undefined) return c.printed;
  c.printed = await readPaperWords(c);
  return c.printed;
}

async function readPaperWords(c: Ctx): Promise<string[] | null> {
  if (c.paper) return c.paper.text.split('\n');
  if (c.basic?.lines) return c.basic.lines;
  if (c.covered) return c.covered.text ?? null;
  if (!c.picture) return null;
  try {
    const { readLines } = await import('../coverPicture');
    return await readLines(c.picture);
  } catch (e) {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] could not read the words for the bill checks', e);
    return null;
  }
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

// ---------- the hybrid route: the cloud when this device cannot answer well (design/HYBRID-ROUTING.md) ----------

/**
 * May WeKnow use the internet for this step? 'auto': yes, with no sheet. 'ask-once': the one consent sheet (When it
 * helps / Ask me every time / No), and the answer is kept. 'every': this step's own sheet, yes or no. 'never' or no
 * connection: no. `sheet` is this step's own sheet: what would go is shown on either sheet.
 */
async function mayUseInternet(t: number, sheet: SheetRequest, spoken: string[]): Promise<'go' | 'no' | 'never'> {
  const pref = getPrefs().internet;
  const g = gate(pref, deviceStore.get().online);
  if (g === 'go') return 'go';
  if (g === 'stay') return pref === 'never' ? 'never' : 'no';
  if (pref === 'every') return (await ask(t, sheet, spoken)) ? 'go' : 'no';
  // The one consent. A check sheet keeps its own short title and buttons; what a yes means from now on is said once,
  // quietly, under them, with "Ask me every time" as the quiet third answer.
  const first: SheetRequest = sheet.hidden
    ? { ...sheet, middle: tr('check.every'), note: tr('check.first') }
    : { ...sheet, title: tr('consent.title', { device: dev() }), body: tr('consent.body'), yes: tr('consent.yes'), middle: tr('consent.every'), no: tr('consent.no') };
  const a = await askSheet(t, first, [tr('consent.say', { device: dev() })]);
  const answer = a === 'yes' ? 'yes' : a === 'middle' ? 'every' : 'no';
  setPrefs({ internet: afterConsent(pref, answer) });
  return answer === 'no' ? 'no' : 'go';
}

/** The router's reason, said plainly. */
function whyText(reason: Reason, input: 'words' | 'picture' | 'quote' | 'paper'): string {
  if (reason === 'no-device-model' && input === 'paper') return tr('route.why.no-device-model.paper', { device: dev() });
  if (reason === 'no-device-model' && input !== 'words') return tr('route.why.no-device-model.picture', { device: dev() });
  return tr(`route.why.${reason}`, { device: dev() });
}

/**
 * Check covered words online: cover, guard, review on this device, then the cloud places them in the pack index.
 * 'answered': an answer (or a "not sent") is on screen. 'stayed': nothing was sent (no, never, offline, no index):
 * the caller answers from this device. Otherwise the cloud found nothing: what was sent, for the receipt.
 */
async function escalateFlow(c: Ctx, words: string, reason: Reason, input: 'words' | 'picture'): Promise<'answered' | 'stayed' | Escalated> {
  const { t, kb } = c;
  if (!deviceStore.get().online || getPrefs().internet === 'never') return 'stayed';
  const cov = coverWords(words);
  if (!cov.text) return 'stayed';
  // Words with no personal details in them go without a sheet (the lamp shows them as they go, and the receipt
  // after), unless the person asked to be asked every time; words that had details covered or a sentence kept back,
  // and words read from a picture or a paper, need the consent first.
  const clean = input === 'words' && !Object.keys(cov.counts).length && getPrefs().internet !== 'every';
  const sheet: SheetRequest = {
    kind: 'net',
    title: tr('check.title'),
    hidden: cov.counts,
    goes: input === 'words' ? 'question' : 'words',
    parcel: [`“${cov.text}”`, tr('ask.words.index')],
    not: [],
    yes: tr('check.yes'),
    no: tr('check.no'),
  };
  const go = clean ? 'go' : await mayUseInternet(t, sheet, [tr('ask.words.say', { device: dev() })]);
  alive(t);
  if (go !== 'go') return 'stayed';
  setPhase('looking');
  patch({ reading: false });
  void narrate(t, [tr('route.checking', { device: dev() })]);
  const model = deviceStore.get().model === 'available';
  // A cloud that is down, slow or out of quota must not cost the person what this device already found: the caller
  // then answers from the device.
  const res = await withWaits(
    t,
    withTimeout(
      escalate(cov.text, {
        index: () => (kb.index ? kb.index() : Promise.resolve([])),
        review: model ? async (x) => (await import('../reader')).reviewOnDevice(x) : undefined,
        cloud: async (x, ix) => {
          const r = await import('../reader');
          r.setCloudModel(c.settings.cloudModel);
          return r.chooseFromIndex(x, ix);
        },
      }),
      READ_TIMEOUT,
    ),
  ).catch((e) => {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] the online step failed; answering from this device', e);
    return null;
  });
  alive(t);
  if (!res || res.kind === 'no-index') return 'stayed';
  if (res.kind === 'blocked') {
    notSent(t, res.by, res.found);
    return 'answered';
  }
  const esc: Escalated = { reason, input, sent: res.sent, counts: cov.counts, offered: res.offered, ms: res.ms, model: res.model, reviewed: res.reviewed, found: res.kind === 'found' };
  // The program decides: a problem described in words is answered with a guide, never a price card. A price the
  // cloud names for it is not used (the same cross-lean rule as on this device); the web how-to is tried instead.
  if (res.kind === 'found' && res.entry.kind === 'price' && lean(words) === 'guide') esc.found = false;
  else if (res.kind === 'found') {
    const e = res.entry;
    patch({ still: input === 'words' ? null : view().still, looking: false, reading: false, chip: null });
    if (e.kind === 'guide') {
      const gp = await guidePack(kb, e.ref);
      alive(t);
      if (gp) {
        await guideAnswer({ ...c, reading: { ...c.reading, pack: gp.pack }, escalated: esc }, gp.guide);
        return 'answered';
      }
    } else {
      const pack = await kb.resolve([e.ref]);
      alive(t);
      const item = priceByRef(pack, e.ref);
      if (item) {
        await wordsPrice({ ...c, reading: { ...c.reading, pack }, escalated: esc }, item);
        return 'answered';
      }
    }
    // A ref in the index whose data could not be loaded: said as not found.
    esc.found = false;
  }
  // Not in the packs: the same covered words as a web search, with Google Search grounding. Shown only with sources.
  void narrate(t, [tr('route.web.looking')]);
  let web: Awaited<ReturnType<typeof import('../webSearch').searchWeb>> | null = null;
  // The search gets only the words that name the job: "my phone number is [phone]" is left out too.
  const query = jobWords(esc.sent) || esc.sent;
  try {
    const { searchWeb } = await import('../webSearch');
    web = await withWaits(t, withTimeout(searchWeb(query), READ_TIMEOUT));
  } catch (e) {
    if (e instanceof Cancel) throw e;
    console.warn('[WeKnow] web search failed', e);
  }
  alive(t);
  esc.web = { sent: web?.sent ?? query, tries: web?.tries ?? 1, ms: web?.ms ?? 0, sources: web?.answer?.sources.length ?? 0, reason: web ? web.reason : 'the search failed' };
  if (web?.answer) {
    await webAnswerFlow({ ...c, escalated: esc }, web.answer);
    return 'answered';
  }
  return esc;
}

/** A how-to from the web for a problem the packs do not cover: said as not WeKnow's own guide, with its sources. */
async function webAnswerFlow(c: Ctx, a: WebAnswer) {
  const { t } = c;
  const sources = a.sources.map((src) => ({
    label: tr('where.src.web', { name: src.title ?? new URL(src.url).hostname }),
    date: src.fetched ? tr('where.checked', { date: longDate(src.fetched) }) : '',
    url: src.url,
    title: src.title,
  }));
  const receipt = escReceipt(c, sources);
  const lines: Said[] = [
    a.sources.length === 1 ? tr('web.intro.1') : tr('web.intro', { n: a.sources.length }),
    ...a.steps,
    ...(a.safety ? [{ text: tr('web.safety', { text: a.safety }), kind: 'warn' as const }] : []),
    ...(a.callPro ? [tr('web.pro', { text: a.callPro })] : []),
  ];
  topic = null;
  clearLines();
  setHead('plain', a.title);
  patch({ receipt, looking: false, reading: false, still: c.picture ? view().still : null });
  await keep(c, { kind: 'Guide', family: 'problem', title: a.title, tone: 'plain', verdict: a.title, lines, receipt });
  alive(t);
  settle();
  void narrate(t, lines);
}

/** What WeKnow says when the cloud found nothing either. */
function noneLines(e: Escalated | undefined): string[] {
  if (!e) return [];
  return [e.web ? tr('route.web.none') : tr('route.none')];
}

/**
 * The cloud saw every guide and price name and found nothing: say so plainly. The plain-search guesses on this device
 * are not offered after that.
 */
function notInPacks(t: number, c: Ctx, esc: Escalated) {
  const cc = { ...c, escalated: esc };
  clearLines();
  patch({ receipt: escReceipt(cc, []), still: null, looking: false });
  setHead('plain', tr('route.none.title'));
  patch({ offerSamples: true });
  settle();
  void narrate(t, [...noneLines(esc), tr('words.none.more')]);
}

/** The guard or the on-device review still saw a personal detail: nothing went. Ask again, or show a picture. */
function notSent(t: number, by: 'guard' | 'review', found: PIIKind[]) {
  const counts: Partial<Record<PIIKind, number>> = {};
  for (const k of found) counts[k] = 1;
  const list = coveredList(counts);
  clearLines();
  setHead('plain', tr('route.blocked.title'));
  patch({
    looking: false,
    reading: false,
    receipt: {
      w: whereRan({ where: 'device', online: deviceStore.get().online, sent: 0, pending: 0 }),
      n: 0,
      stayed: [tr('where.question.typed')],
      sent: [],
      sources: [],
      tech: [
        by === 'guard'
          ? `Held back by the payload guard (plain code) on this ${dev()}: a personal pattern${list ? ` (${list})` : ''} was still in the outgoing words. Requests to the cloud model: 0.`
          : `Held back by the built-in model on this ${dev()}, which reviewed the covered words and said they still hold a personal detail. Requests to the cloud model: 0.`,
      ],
    },
  });
  settle();
  void narrate(t, [tr('route.blocked.line', { what: list ? ` (${list})` : '' }), tr('route.blocked.try')]);
  offerNext([
    { label: tr('route.blocked.again'), act: () => focusBox() },
    { label: tr('route.blocked.photo'), act: () => takePicture() },
  ]);
}

/** The receipt of an answer whose words were checked online: what stayed, the exact words that went, and why. */
function escReceipt(c: Ctx, sources: Receipt['sources']): Receipt {
  const e = c.escalated!;
  const list = coveredList(e.counts);
  return {
    w: 'cloud',
    n: 0,
    stayed: [
      ...(c.picture ? [tr('where.picture')] : []),
      tr('where.question.typed'),
      ...(list ? [tr('where.covered.list', { list })] : []),
      ...(e.found ? [tr('where.answer.pack', { device: dev() })] : []),
    ],
    sent: [tr('where.sent.words', { q: e.sent }), tr('where.sent.index', { n: e.offered }), ...(e.web ? [tr('where.sent.web', { q: e.web.sent })] : [])],
    why: tr('where.why', { why: whyText(e.reason, e.input) }),
    sources,
    tech: tech(c),
  };
}

function escTech(c: Ctx): string[] {
  const e = c.escalated!;
  return [
    `Checked online because: ${e.reason}. ${e.model} through Firebase AI Logic (in the cloud only), ${e.ms} ms; requests to the cloud model: ${1 + (e.web?.tries ?? 0)}.`,
    `Sent: the covered words (${e.sent.length} characters) and the pack index (${e.offered} guide and price names). The cloud may only name a ref from that index; ${e.found ? 'it named one, and the answer is that pack item, shown from this device' : 'it named none that is used (none at all, a ref not in the index, or a price for a described problem)'}.`,
    ...(e.web
      ? [
          `Not in the pack, so the job words of the covered question (personal details and their lead-in words left out) were searched on the web with Google Search grounding through Firebase AI Logic (${e.web.tries === 1 ? 'one request' : 'two requests: the first came back without web sources'}): ${e.web.ms} ms, ${e.web.sources} https ${e.web.sources === 1 ? 'source' : 'sources'}${e.web.reason ? ` (not shown: ${e.web.reason})` : ''}. Money amounts in a web answer are removed; prices come only from the pack.`,
        ]
      : []),
    `Before sending: the payload guard (plain code) found no personal pattern in the outgoing words${e.reviewed ? `; the built-in model on this ${dev()} reviewed them and found none` : `; there is no built-in model on this ${dev()} for a second review`}.`,
  ];
}

// ---------- shared pieces of an answer ----------

/** "I worked that out right here", said once ever, after the first answer that stayed on the device. */
function firstTimeHere(where: Where): string[] {
  if (where !== 'device' || getPrefs().toldLocal) return [];
  setPrefs({ toldLocal: true });
  return [deviceStore.get().online ? tr('first.local', { device: dev() }) : tr('first.offline', { device: dev() })];
}

function tech(c: Ctx, extra: string[] = []): string[] {
  if (c.escalated) {
    const read = c.picture ? [`The picture was read by the built-in model on this ${dev()} (Firebase AI Logic, on-device) in ${c.reading.ms} ms; it did not leave.`] : [];
    return [...read, ...escTech(c), `Pack ${c.kb.id}, version ${c.kb.version}.`, ...extra];
  }
  if (c.words) return wordsTech(c, extra);
  if (c.basic)
    return [
      `Basic check: this ${dev()} has no built-in model, so the paper's own words (${c.paper ? "the PDF's text, taken out here with pdf.js" : 'read here by the text recognizer'}) were checked by plain code alone. No model read the paper, and nothing was sent to be read. Requests to the cloud model for the reading: 0.`,
      `Pack ${c.kb.id}, version ${c.kb.version}.`,
      ...extra,
    ];
  if (c.paper)
    return [
      `Read from the PDF's own text, taken out on this ${dev()} with pdf.js (no text recognition needed); personal details covered on this ${dev()} first (${c.paper.masked.length} characters after covering).`,
      c.where === 'device'
        ? `The covered text was read into the bill form by the built-in model on this ${dev()} (Firebase AI Logic, on-device) in ${(c.reading.ms / 1000).toFixed(1)} s. Requests to read it in the cloud: 0.`
        : `The covered text, and only the text, was read into the bill form in the cloud by ${c.settings.cloudModel} through Firebase AI Logic in ${(c.reading.ms / 1000).toFixed(1)} s. Requests to the cloud model: 1.`,
      `Pack ${c.kb.id}, version ${c.kb.version}.`,
      ...extra,
    ];
  const r = c.reading;
  const chose = r.retrieval.offered > 0;
  const answered = chose ? 2 : 1;
  let who: string;
  let requests: string;
  if (c.where === 'device') {
    who = `Read by the built-in model on this ${dev()} (Firebase AI Logic, on-device).`;
    requests = 'Requests to read it in the cloud: 0.';
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

/** On the cloud path, what stayed: the picture as it was taken, and the details covered on it. */
function stayedCovered(c: Ctx): string[] {
  if (c.where === 'cloud' && c.paper) {
    const list = coveredList(c.paper.counts);
    return [tr('where.paper.original'), ...(list ? [tr('where.covered.list', { list })] : [])];
  }
  if (c.where !== 'cloud' || !c.covered) return [];
  const list = coveredList(c.covered.counts);
  return [tr('where.picture.original'), ...(list ? [tr('where.covered.list', { list })] : [])];
}

/** On the cloud path, what went: the covered copy of the picture (shown as it was sent) and the question. */
function sentCovered(c: Ctx, more: string[] = []): Pick<Receipt, 'sent' | 'sentPicture' | 'coveredPicture' | 'why'> {
  if (c.where !== 'cloud') return { sent: more, ...(more.length ? { why: tr('where.why', { why: whyText('unknown-price', 'quote') }) } : {}) };
  // A PDF read from its own words: only the covered words went, never its picture or the question.
  if (c.paper)
    return {
      sent: [tr('where.sent.paper', { n: c.paper.masked.length }), ...more],
      ...(c.cloudWhy ? { why: tr('where.why', { why: whyText(c.cloudWhy, 'paper') }) } : {}),
    };
  return {
    sent: [tr('where.sent.covered'), tr('where.sent.question', { q: c.question }), ...more],
    sentPicture: !!c.covered,
    coveredPicture: c.covered?.url,
    ...(c.cloudWhy ? { why: tr('where.why', { why: whyText(c.cloudWhy, 'picture') }) } : {}),
  };
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
      // The covered copy's URL lasts only as long as this page; a kept check keeps the picture as it was taken.
      receipt: { ...o.receipt, coveredPicture: undefined },
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
  /** Pack items plain search found for the words. */
  found: number;
}

async function lookUpWords(t: number, asked: string, kb: LayeredKnowledge): Promise<WordsLook> {
  // Matched on the job words only: personal details (and "my phone number is") never pick a pack item.
  const question = jobWords(asked) || asked;
  const l = lean(question);
  const order = kindOrder(l);
  const lists = await Promise.all(order.map((kind) => kb.candidates(question, { kind, k: 4 })));
  alive(t);
  const found = lists.flat();
  if (!found.length) return { hit: null, guides: [], offered: 0, found: 0 };
  // Plain search also returns items that share only a small word ("up", "won't"). Only items that share a job word
  // with the question are offered, to the model or as likely guides.
  // (Offline without these blocks the list is not narrowed: never worse than before.)
  const named = await kb.resolve(found.map((c) => c.ref)).catch(() => null);
  alive(t);
  const fits = (c: Candidate) => {
    if (!named) return true;
    const item = c.kind === 'price' ? priceByRef(named, c.ref) : guideByRef(named, c.ref);
    return !item || sharesJobWord(question, [item.name, ...(item.aliases ?? [])]);
  };
  const all = found.filter(fits);
  // Likely guides to offer when no one item is clear (not for a question about a price).
  const guides = l === 'price' ? [] : (lists[order.indexOf('guide')] ?? []).filter(fits).slice(0, 3);
  if (!all.length) return { hit: null, guides: [], offered: 0, found: 0 };

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
      return { hit: c ? { kind: c.kind, ref: c.ref, by: 'model', offered: r.offered } : null, guides, offered: r.offered, found: all.length };
    }
  }

  const tops = lists.map((xs) => xs[0]).filter((c) => !!c);
  const slice = await kb.resolve(tops.map((c) => c.ref));
  alive(t);
  const scored: Scored[] = tops.map((c) => {
    const item = c.kind === 'price' ? priceByRef(slice, c.ref) : guideByRef(slice, c.ref);
    return { kind: c.kind, ref: c.ref, strength: item ? matchStrength(question, [item.name, ...item.aliases]) : 0 };
  });
  const hit = pickConfident(l, scored);
  return { hit: hit ? { kind: hit.kind, ref: hit.ref, by: 'match', offered: tops.length } : null, guides, offered: tops.length, found: all.length };
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
async function wordsFlow(t: number, question: string): Promise<true | false | { ctx: Ctx; guides: Candidate[]; found: number }> {
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
    return { ctx: wordsCtx(t, question, kb, settings, empty, { kind: 'guide', ref: null, by: 'match', offered: look.offered, ms }), guides: look.guides, found: look.found };
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
function maybeGuides(t: number, c: Ctx, guides: Candidate[], never = false) {
  setHead('plain', tr('maybe.title'));
  settle();
  void narrate(t, [tr('maybe.line'), ...(never ? [tr('route.never', { device: dev() })] : [])]);
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
  const receipt: Receipt = c.escalated
    ? escReceipt(c, priceSources([item]))
    : {
        w: whereRan({ where: 'device', online: deviceStore.get().online, sent: 0, pending: 0 }),
        n: 0,
        stayed: [tr('where.question'), tr('where.answer.words', { device: dev() })],
        sent: [],
        sources: priceSources([item]),
        tech: tech(c),
      };
  const lines: Said[] = [...a.lines, ...(c.escalated ? [tr('route.found.price')] : firstTimeHere('device'))];
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
      : `Picked by plain code on this ${dev()}: the top search match, taken because every job word of its name or one alias is in the question, and the question leans to this kind of answer (a price or a guide) or neither.`;
  return [
    `Answered from the question alone, without a picture. ${by}`,
    'Requests to the cloud model: 0.',
    `Pack ${c.kb.id}, version ${c.kb.version}. ${w.ms} ms.`,
    ...extra,
  ];
}

/** A question in words that the pack does not know, with no camera to look instead. Never a made-up price. */
function dontKnow(t: number, never = false) {
  clearLines();
  setHead('plain', tr('words.none.title'));
  patch({ offerSamples: true, still: null, looking: false });
  settle();
  // With no connection, say that the internet is what is missing, and that it can be asked again then.
  const offline = !never && !deviceStore.get().online;
  void narrate(t, [tr('words.none.line'), ...(offline ? [tr('route.offline', { device: dev() })] : [tr('words.none.more')]), ...(never ? [tr('route.never', { device: dev() })] : [])]);
}

// ---------- a quote ----------

/**
 * Look the unknown lines up on the web (Google Search grounding through Firebase AI Logic). Only each masked line
 * name and the region leave the device. A price is used only when it came with https sources; it is then judged by
 * the same plain code as a pack price, and kept on this device so the same line is known next time.
 */
async function lookUpLines(
  unknown: Array<{ i: LineItem; payload: { item: string; region: string } }>,
  kb: LayeredKnowledge,
): Promise<Array<{ i: LineItem; item: PriceItem; ms: number }>> {
  const { lookupPrice } = await import('../lookup');
  const one = async (x: (typeof unknown)[number]) => {
    try {
      // A busy minute at the cloud is waited out once or twice, not answered with "not found".
      const r = await withRetry(() => lookupPrice(x.payload.item, x.payload.region), [3000, 12000]);
      return r.item ? { i: x.i, item: r.item, ms: r.ms } : null;
    } catch (e) {
      console.warn('[WeKnow] price lookup failed', e);
      return null;
    }
  };
  // Three at a time: a long quote does not fire thirty searches at once.
  const found: Array<Awaited<ReturnType<typeof one>>> = [];
  for (let i = 0; i < unknown.length; i += 3) found.push(...(await Promise.all(unknown.slice(i, i + 3).map(one))));
  const ok = found.filter((x): x is NonNullable<typeof x> => !!x);
  for (const f of ok) await kb.learn(f.item).catch(() => undefined);
  return ok;
}

/** Puts looked-up prices on their lines: high when over the found top, otherwise fair (looked up). */
export function applyFound(items: LineItem[], found: Array<{ i: LineItem; item: PriceItem }>): string[] {
  const said: string[] = [];
  for (const f of found) {
    const line = items.find((x) => x.n === f.i.n);
    if (!line) continue;
    line.name = f.item.name;
    line.typical = f.item.typical;
    line.top = f.item.high;
    if (line.amount !== null && line.amount > f.item.high) {
      line.state = 'high';
      line.over = line.amount - f.item.high;
      said.push(tr('quote.found.high', { label: line.label, low: money(f.item.low), high: money(f.item.high), over: money(line.over) }));
    } else if (line.amount !== null && line.amount < f.item.low) {
      // Below the range found online: said as it is, the same way a price-book line below its range is.
      line.state = 'low';
      said.push(tr('quote.found.low', { label: line.label, low: money(f.item.low), high: money(f.item.high) }));
    } else {
      line.state = 'found';
      said.push(tr('quote.found.fair', { label: line.label, low: money(f.item.low), high: money(f.item.high) }));
    }
  }
  return said;
}


async function quoteFlow(c: Ctx) {
  const { t, reading, kb, where } = c;
  // What a model on this device copied is held against the paper's own words, by plain code on this device: an
  // amount that is not printed there is dropped, so that line is never judged.
  if (where === 'device' && !c.basic && !c.words && (c.picture || c.paper)) {
    const printed = (await paperWords(c)) ?? [];
    const lines = reading.understanding.lines;
    // A PDF's text is exact. Words recognized from a photo count only when the recognizer plainly read the page:
    // it found at least as many prices as the quote has priced lines.
    const readable = !!c.paper || printed.flatMap((w) => amountsIn(w)).length >= Math.max(1, lines.filter((l) => l.amount !== null).length);
    if (readable) reading.understanding = { ...reading.understanding, lines: keepPrinted(amountsFromRows(lines, printed), printed) };
  }
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
        // A job's name needs no long number: a house number, a permit or part number is taken out before it goes.
        return { i, payload: buildCloudLookup({ item: i.label.replace(/#?\b\d{3,}\b/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120), region: kb.region }) };
      } catch {
        return null; // personal data or a malformed line: never offered
      }
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
  const names = unknown.map((x) => x.i.label);
  /** The words that leave for each unknown line: its label with long numbers taken out, as the sheet shows it. */
  const lookedUp = unknown.map((x) => x.payload.item);
  const parcel = [...unknown.map((x) => tr('ask.item.price', { item: x.payload.item })), tr('ask.item.region', { region: kb.region })];
  const online = deviceStore.get().online;
  const p = getPrefs();
  // On the cloud path the person already said yes to the picture; then WeKnow only says it looks the lines up.
  const lookNow = unknown.length > 0 && online && route({ input: 'quote-lines', unknown: unknown.length }).escalate && p.internet === 'auto';

  // A quote or an invoice with priced lines can carry the same traps as a bill. The rules that read a bill for them
  // (core/verdict.ts) read this paper too: what the model flagged, its line labels, and the paper's own words when
  // they are already here (a PDF's text). They can only add a warning to the price verdict, never take one away.
  const ownWords = c.paper ? c.paper.text.split('\n') : (c.printed ?? c.basic?.lines ?? []);
  // On a quote, "it rushes you" comes from the printed words only: Gemini Nano flagged an ordinary quote as urgent in
  // one run of three, and a quote's verdict must not change from run to run.
  const signs = billVerdict({ ...u, urgent: false }, maskText([u.payee ?? '', ...u.lines.map((l) => l.label), ...ownWords].join(' ')), []).flags.filter(
    (f): f is 'account-change-notice' | 'urgency' | 'instruction-to-ai' => f === 'account-change-notice' || f === 'urgency' || f === 'instruction-to-ai',
  );
  const withSigns = (priced: ReturnType<typeof quoteSummary>): ReturnType<typeof quoteSummary> =>
    signs.length
    ? {
        ...priced,
        verdict:
          signs.includes('instruction-to-ai') || signs.includes('account-change-notice')
            ? { tone: 'stop', text: tr('quote.stop.title') }
            : priced.verdict.tone === 'stop'
              ? priced.verdict
              : { tone: 'warn', text: tr('quote.check.title') },
        sentences: [
          ...signs.map((f) => tr(f === 'instruction-to-ai' ? 'letter.sign.ai' : f === 'urgency' ? 'letter.sign.rush' : 'letter.sign.account')),
          ...priced.sentences,
        ],
      }
    : priced;
  const summary = withSigns(quoteSummary(items));
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
    // Counted now, not when the answer first showed: a line looked up since then is checked.
    const pending = items.filter((i) => i.state === 'pending').length;
    const w = whereRan({ where, online, sent: o.sent.length ? unknown.length : 0, pending });
    return {
      w,
      n: w === 'pending' ? pending : unknown.length,
      stayed:
        where === 'device'
          ? [tr('where.picture'), tr('where.covered.quote'), ...(note ? [tr('where.note', { when: note.when })] : []), tr('where.prices', { n: items.length - pending, total: items.length })]
          : [...stayedCovered(c), ...(note ? [tr('where.note', { when: note.when })] : []), tr('where.prices', { n: items.length - pending, total: items.length })],
      ...sentCovered(c, o.sent),
      waiting: o.waiting,
      sources: priceSources(matched as PriceItem[]),
      tech: tech(c, o.sent.length ? [`Price requests filed for ${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} (masked item and region only).`] : []),
    };
  };
  let receipt = receiptFor({
    sent: lookNow ? parcel : [],
    waiting: unknown.length && !online ? tr('where.waiting', { names: names.join(', ') }) : lookNow ? tr('where.requested', { names: names.join(', ') }) : undefined,
  });

  /** Looks the unknown lines up online and puts the prices on them (only the masked names and region are sent). */
  const runLookup = async (tt: number, afterSpeech = false) => {
    setHead('plain', tr('quote.looking.now'));
    const found = await lookUpLines(unknown, kb);
    alive(tt);
    const said = applyFound(items, found);
    const notFound = unknown.filter((x) => !found.some((f) => f.i.n === x.i.n));
    const missed = notFound.map((x) => x.i.label);
    if (missed.length) fileRequests(notFound.map((x) => x.payload.item), kb.region, () => undefined);
    const after = withSigns(quoteSummary(items));
    setHead(after.verdict.tone, after.verdict.text);
    receipt = {
      ...receiptFor({ sent: parcel, waiting: missed.length ? tr('where.requested', { names: missed.join(', ') }) : undefined }),
      sources: [...priceSources(matched as PriceItem[]), ...priceSources(found.map((f) => f.item)).map((r) => ({ ...r, label: tr('where.src.web', { name: r.label.replace(/^.*?: /, '') }) }))],
    };
    receipt.tech = [...receipt.tech, `Looked up online for ${unknown.length} ${unknown.length === 1 ? 'line' : 'lines'} with Google Search grounding through Firebase AI Logic; ${found.length} came back with sources${found.length ? ` (${found.map((f) => `${f.ms} ms`).join(', ')})` : ''}. Sent: the masked line names and the region only.`];
    patch({ items: [...items], receipt });
    // Every line has a price now: the question about unchecked lines goes.
    if (!items.some((i) => i.state === 'pending')) offerNext(quoteNext('unchecked'));
    if (afterSpeech) await narrated();
    alive(tt);
    void narrate(tt, [...said, ...(missed.length ? [tr('quote.notfound', { names: listNames(missed) })] : [])]);
  };

  // The answer goes on screen at once; it is read out after.
  const lines: Said[] = [...summary.sentences];
  if (note) lines.push({ text: note.text, noteTag: true });
  lines.push(...firstTimeHere(where));
  if (where === 'device') lines.push(tr('quote.stays', { device: dev() }));
  if (unknown.length && !online) lines.push(names.length === 1 ? tr('quote.wait') : tr('quote.wait.n'));
  if (lookNow && !c.settings.lookupEnabled) lines.push(names.length === 1 ? tr('quote.requested') : tr('quote.requested.n'));
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
  if (lookNow && c.settings.lookupEnabled) {
    void runLookup(t, true).catch(() => undefined);
  } else if (lookNow) {
    fileRequests(lookedUp, kb.region, (_filed, failed) => {
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
  // Ask before the unknown lines go over the internet (only the masked line names and the region), then look them up.
  const lookUpWithConsent = async (t2: number) => {
    // Ask before one line goes over the internet: only the masked line names and the region.
    const go = await mayUseInternet(
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
    const yes = go === 'go';
    looked = true;
    if (yes && c.settings.lookupEnabled) {
      await runLookup(t2);
    } else if (yes) {
      receipt = receiptFor({ sent: parcel, waiting: tr('where.requested', { names: names.join(', ') }) });
      fileRequests(lookedUp, kb.region, () => undefined);
      patch({ receipt });
      void narrate(t2, [names.length === 1 ? tr('quote.requested') : tr('quote.requested.n')]);
    } else {
      receipt = receiptFor({ sent: [], waiting: tr('where.declined', { names: names.join(', ') }) });
      patch({ receipt });
      void narrate(t2, [names.length === 1 ? tr('quote.skip') : tr('quote.skip.n'), ...(go === 'never' ? [tr('route.never', { device: dev() })] : [])]);
    }
  };
  const unchecked = async (t2: number) => {
    const pend = items.filter((i) => i.state === 'pending').map((i) => i.label);
    setHead('plain', pend.length ? tr('quote.unchecked', { names: listNames(pend) }) : tr('quote.unchecked.none'));
    patch({ receipt, items });
    settle();
    if (unknown.length && online && !looked) await lookUpWithConsent(t2);
    else void narrate(t2, []);
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
  // Remembering a new shop is offered as a button, never a pop-up over the answer (it used to open by itself once
  // the lookups were done and took the next click). A shop already in the notes gets today's prices added quietly.
  const knownShop = !!shop && dataStore.get().memory.some((m) => m.kind === 'job' && norm(m.shop) === norm(shop));
  let remembered = false;
  const rememberQ = (): Next[] =>
    shop && !knownShop && !remembered && getPrefs().offerNotes
      ? [
          nextQ(tr('next.remember.shop'), async (t2) => {
            remembered = true;
            await rememberShop(t2, shop, items, u.lines.map((l) => l.ref));
            offerNext(quoteNext());
          }),
        ]
      : [];
  const quoteNext = (skip?: 'say' | 'unchecked' | 'myself'): Next[] => [
    ...(say && skip !== 'say' ? [nextQ(tr('next.say'), say)] : []),
    ...(pending && skip !== 'unchecked' ? [nextQ(tr('next.unchecked'), unchecked)] : []),
    ...(myself.length && skip !== 'myself' ? [nextQ(tr('next.myself.any'), (t2) => chooseGuide(t2, { ...c, t: t2 }, myself))] : []),
    ...rememberQ(),
  ];
  topic = { kind: 'quote', c, again, next: () => quoteNext(), say, myself };

  void narrate(t, lines);
  setPhase('settled');
  offerNext(quoteNext());
  await narrated();
  alive(t);
  // The first time WeKnow would use the internet, it asks once, as it does for a bill (before, a quote only asked
  // when "Which lines did you not check?" was pressed, so on a fresh start the line was simply left unchecked).
  if (!looked && unknown.length && online && getPrefs().internet === 'ask-once') {
    await lookUpWithConsent(t);
    alive(t);
    offerNext(quoteNext());
  }
  const asked = knownShop ? await rememberShop(t, shop, items, u.lines.map((l) => l.ref)) : false;
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
  const mem = dataStore.get().memory;
  const known = knownPayees(mem);
  // The paper's own words (a PDF's text or the recognizer's lines), read on this device only.
  const words = await paperWords(c);
  alive(t);
  // When the model named no one, plain code reads who asks to be paid off the letterhead. When it named a bank and
  // the letterhead names someone else, the letterhead wins: the bank in the payment box only holds the account
  // (seen on Gemini Nano: "Thistlewick Savings Bank" for a letter from "Palisade Sovereign Reserve Trust").
  const letterhead = words?.length ? basicPayee(words, known.map((k) => k.name), !c.paper) : null;
  const BANK = /\b(bank|savings|credit union|bancorp|banking)\b/i;
  const said = reading.understanding.payee;
  if (letterhead && (!said || (BANK.test(said) && !BANK.test(letterhead) && norm(said) !== norm(letterhead))))
    reading.understanding = { ...reading.understanding, payee: letterhead };
  const u = reading.understanding;
  const masked = maskText([u.payee ?? '', ...u.lines.map((l) => l.label), ...(words ?? [])].join(' '));
  // Which account to pay into is printed next to "payment account": plain code takes it from the paper's own words, so
  // a member number the model copied by mistake never stands in for it (same as the iPhone).
  if (words?.length) {
    const lastTime = known.find((k) => u.payee && k.name.toLowerCase() === nameOf(u.payee)?.toLowerCase())?.payTo;
    const to = payToOf(words, lastTime);
    if (to) u.payTo = to;
  }
  let v = billVerdict(u, masked, known);
  // Remote Config phrases can only add the urgency warning, never clear one.
  const { matchesPhrase } = await import('../config');
  if (!v.flags.includes('urgency') && matchesPhrase(masked, settings.urgencyPhrases)) v = { safe: false, flags: [...v.flags, 'urgency'] };
  // Two plain-code checks on those words: printed sums that do not hold, two different account numbers. Add only.
  const math: BillMath | null = words?.length ? billMath(words) : null;
  v = withBillMath(v, math);
  const payee = nameOf(u.payee);
  const ans = billAnswer(v, payee, known, u.payTo, math);
  const match = known.find((k) => payee && k.name.toLowerCase() === payee.toLowerCase());
  const usedNote = ans.reasons.some((r) => r.fromNote) || (v.safe && !!match);

  // A company WeKnow has no note of, and something already wrong: this device cannot know whether the company or
  // these charges are real, so the web is asked (core/billCheck.ts). Only the company and the names of the charges
  // go; the answer can make the warning stronger, never weaker.
  let online: BillCheckResult | null = null;
  /** The words that went out for the online check, kept even when no answer came back: they are in the receipt. */
  let asked: string | null = null;
  const q =
    // (Words recognized from a photo with no model to read them: only when the company's name was made out.)
    v.flags.includes('new-payee') && v.flags.length > 1 && deviceStore.get().online && getPrefs().internet !== 'never' && (!c.basic?.lines || !!nameOf(u.payee))
      ? (() => {
          // Built from the paper's covered words, never its words as printed: a name the page-wide covering found
          // ("ACCOUNT HOLDER / Wei-Ling Chen", then "fee for CHEN family") is out of every line before one is picked.
          const cov = words?.length ? coverPaperText(words.join('\n')) : null;
          return billQuestion(u.payee, cov ? cov.text.split('\n') : u.lines.map((l) => l.label), cov?.names);
        })()
      : null;
  if (q) {
    const sheet: SheetRequest = { kind: 'net', title: tr('check.title'), hidden: {}, goes: 'words', parcel: [`“${q}”`], not: [], yes: tr('check.yes'), no: tr('check.no') };
    const go = await mayUseInternet(t, sheet, [tr('billcheck.ask')]);
    alive(t);
    if (go === 'go') {
      void narrate(t, [tr('billcheck.looking')]);
      asked = q;
      try {
        const { checkBillOnline } = await import('../webSearch');
        online = await withWaits(t, withTimeout(checkBillOnline(q), READ_TIMEOUT));
      } catch (e) {
        if (e instanceof Cancel) throw e;
        console.warn('[WeKnow] bill check online failed', e);
      }
      alive(t);
    }
  }
  const found = online?.check ?? null;
  const verdict =
    found?.finding === 'known-scam-pattern'
      ? { tone: 'stop' as const, text: tr('letter.stop.title') }
      : found?.finding === 'not-found' && ans.verdict.tone !== 'stop'
        ? { tone: 'warn' as const, text: tr('letter.check.title') }
        : ans.verdict;
  // What the web answer adds in its own words is shown only when it makes the warning stronger. For "real" or
  // "unclear" WeKnow says its own fixed sentence and nothing more: text that came from the paper could otherwise
  // steer those lines into saying it is safe.
  // A check that went out but came back with no answer from web sources is said too, so the person knows it ran.
  const onlineLines: Said[] = found
    ? [tr(`billcheck.${found.finding}`), ...(found.finding === 'known-scam-pattern' || found.finding === 'not-found' ? found.points : [])]
    : online
      ? [tr('billcheck.unclear')]
      : [];

  const receipt: Receipt = {
    w: whereRan({ where, online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed:
      where === 'device'
        ? [c.paper ? tr('where.paper') : tr('where.picture'), tr('where.covered.letter'), ...(usedNote && match ? [tr('where.note.payee', { digits: match.payTo })] : []), tr('where.rules', { device: dev() })]
        : [...stayedCovered(c), ...(usedNote && match ? [tr('where.note.payee', { digits: match.payTo })] : []), tr('where.rules', { device: dev() })],
    ...sentCovered(c, online ? [online.sent] : asked ? [asked] : []),
    ...((online || asked) && where === 'device' ? { w: 'mixed' as const, n: 1, why: tr('billcheck.why') } : {}),
    sources: [
      { label: tr('where.src.rules', { device: dev() }), date: tr('where.checked', { date: longDate(c.kb.version.slice(0, 10)) }) },
      ...(found?.sources ?? []).map((src) => ({ label: tr('where.src.web', { name: src.title ?? new URL(src.url).hostname }), date: '', url: src.url, title: src.title })),
    ],
    tech: tech(c, [
      ...(online
        ? [`Checked online with Google Search grounding through Firebase AI Logic (${online.model}): ${found ? `${found.finding}, ${found.sources.length} web ${found.sources.length === 1 ? 'source' : 'sources'}` : 'no answer with web sources'}, ${online.tries} ${online.tries === 1 ? 'try' : 'tries'}, ${online.ms} ms.`]
        : []),
      `Bill flags: ${v.flags.join(', ') || 'none'}.`,
      math
        ? `Plain-code checks on the paper's own words (${words?.length ?? 0} lines, on this ${dev()}): ${math.checked} printed ${math.checked === 1 ? 'sum' : 'sums'} checked, ${math.misses.length} off by more than $1; ${math.accounts.length} customer account ${math.accounts.length === 1 ? 'number' : 'numbers'} found.`
        : `Plain-code checks on the paper's own words: none (no words could be read on this ${dev()}).`,
    ]),
  };
  // Calling the company makes no sense when the company is the trap.
  const doLine = found?.finding === 'known-scam-pattern' ? tr('billcheck.do.scam') : ans.doLine;
  const reasons: Said[] = [...ans.reasons.map((r) => ({ text: r.text, noteTag: !!r.fromNote })), ...onlineLines, ...(doLine ? [doLine] : [])];
  const lines: Said[] = [...reasons, ...(c.basic ? [tr('basic.note', { device: dev() })] : []), ...firstTimeHere(where), ...(where === 'device' ? [tr('letter.stays', { device: dev() })] : [])];

  clearLines();
  setHead(verdict.tone, verdict.text);
  patch({ receipt });
  await keep(c, {
    kind: 'Bill',
    family: 'bill',
    title: payee ? `Bill from ${payee}` : tr('kind.Bill'),
    tone: verdict.tone,
    verdict: verdict.text,
    lines,
    receipt,
  });
  alive(t);

  // "Remember this company": only after a bill whose one doubt is that WeKnow has not seen it before.
  const digits = (u.payTo ?? '').replace(/\D/g, '');
  const onlyNew = v.flags.length === 1 && v.flags[0] === 'new-payee';
  let canRemember = !!payee && digits.length >= 4 && onlyNew && getPrefs().offerNotes;
  // A new company whose first bill raised warnings can still be remembered, after two confirmations (never after the
  // web found its charges are a known scam).
  let canRememberCareful = !!payee && digits.length >= 4 && !onlyNew && v.flags.includes('new-payee') && found?.finding !== 'known-scam-pattern' && getPrefs().offerNotes;
  const warnWords = v.flags.filter((f) => f !== 'new-payee').map((f) => tr(`careful.why.${f}`));
  if (v.safe && match) {
    const old = mem.find((m): m is PayeeMemory => m.kind === 'payee' && m.name === match.name);
    if (old) await putMemory({ ...old, date: today() });
  }
  const tone = verdict.tone;
  const whatNow = (t2: number) => {
    const p = getPrefs();
    setHead('plain', doLine ?? tr('bill.do.ok'));
    patch({ receipt });
    if (tone !== 'ok' && p.trustedName && p.trustedNumber)
      patch({ links: [{ value: 'call', label: tr('letter.call', { name: p.trustedName }), href: `tel:${p.trustedNumber.replace(/[^\d+]/g, '')}`, icon: 'phone' }] });
    settle();
    void narrate(t2, []);
    offerNext(billNext('do'));
  };
  const again = () => {
    setHead(verdict.tone, verdict.text);
    patch({ receipt });
    settle();
    void narrate(current(), reasons);
    offerNext(billNext());
  };
  // "Which numbers?": the amounts behind "the numbers don't add up", one per line, then what to do.
  const sums = (t2: number) => {
    setHead('stop', tr('math.title'));
    patch({ receipt });
    settle();
    void narrate(t2, math ? sumLines(math) : []);
    offerNext(billNext('sums'));
  };
  // "Where are the account numbers?": the two last-four digits, and the call to make before paying.
  const accounts = (t2: number) => {
    const [a, b] = math?.accounts ?? [];
    setHead('warn', tr('accts.title'));
    patch({ receipt });
    settle();
    void narrate(t2, [tr('accts.line', { a: a ?? '', b: b ?? '' }), tr('accts.do')]);
    offerNext(billNext('accounts'));
  };
  // The answer says what was pressed, since the pop-ups are gone from the screen.
  const notRemembered = (t2: number, sure: boolean) => {
    setHead('plain', sure ? tr('careful.notyet.title') : tr('careful.not.title'));
    settle();
    void narrate(t2, sure ? [tr('careful.notyet.line', { payee: payee! }), tr('careful.notyet.do')] : [tr('careful.not.line', { payee: payee! })]);
    offerNext(billNext(sure ? undefined : 'remember'));
  };
  const billNext = (skip?: 'do' | 'remember' | 'remind' | 'sums' | 'accounts'): Next[] => [
    ...(v.flags.includes('numbers-dont-add-up') && math?.misses.length && skip !== 'sums' ? [nextQ(tr('next.sums'), sums)] : []),
    ...(v.flags.includes('two-accounts') && skip !== 'accounts' ? [nextQ(tr('next.accounts'), accounts)] : []),
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
    ...(canRememberCareful && skip !== 'remember'
      ? [
          nextQ(tr('next.careful'), async (t2) => {
            // Two pop-up questions, Yes or No each: what was wrong and whether the person knows this company and
            // account; then whether they checked it with the company at a number they already had.
            const last4 = digits.slice(-4);
            const sure = await ask(
              t2,
              { kind: 'note', title: tr('careful.1.title', { payee: payee! }), body: tr('careful.1.why', { why: listNames(warnWords) }), parcel: [], not: [tr('careful.1.what', { digits: last4 })], yes: tr('careful.1.yes'), no: tr('careful.1.no') },
              [tr('careful.1.title', { payee: payee! })],
            );
            alive(t2);
            const checked =
              sure &&
              (await ask(
                t2,
                { kind: 'note', title: tr('careful.2.title'), body: tr('careful.2.line', { payee: payee!, digits: last4 }), parcel: [], not: [], yes: tr('careful.2.yes'), no: tr('careful.no') },
                [tr('careful.2.title')],
              ));
            alive(t2);
            if (!checked) return notRemembered(t2, sure);
            await putMemory({ kind: 'payee', id: newId('m'), name: payee!, payTo: last4, date: today() });
            setPrefs({ toldNotes: true });
            alive(t2);
            canRememberCareful = false;
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

async function problemFlow(c: Ctx, never = false) {
  const { t, reading } = c;
  const u = reading.understanding;
  const guide = !c.escalated && u.problemRef ? guideByRef(reading.pack, u.problemRef) : undefined;
  if (guide) return guideAnswer(c, guide);
  // The reader is not sure which problem it is: offer likely guides from the pack instead of picking one.
  const guides = await c.kb.candidates(c.question, { kind: 'guide', k: 3 }).catch(() => [] as Candidate[]);
  alive(t);
  clearLines();
  if (c.escalated) patch({ receipt: escReceipt(c, []) });
  if (guides.length && !c.escalated) return maybeGuides(t, c, guides, never);
  setHead('plain', c.escalated ? tr('route.none.title') : tr('new.title'));
  settle();
  void narrate(t, [
    ...(c.escalated ? noneLines(c.escalated) : [tr('new.line')]),
    ...(!deviceStore.get().online ? [tr('new.offline')] : []),
    ...(never ? [tr('route.never', { device: dev() })] : []),
  ]);
}

function guideReceipt(c: Ctx, guide: Guide): Receipt {
  const { where } = c;
  if (c.escalated) return escReceipt(c, guideSources(guide));
  return {
    w: whereRan({ where, online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed: where === 'device' ? [...(c.picture ? [tr('where.picture')] : []), tr('where.question'), tr('where.steps')] : [...stayedCovered(c), tr('where.steps')],
    ...sentCovered(c),
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
    const lines: Said[] = [tr('danger.line', { reason: guide.safety?.[0] ?? guide.name }), ...(proSentence ? [proSentence] : []), ...(c.escalated ? [tr('route.found')] : firstTimeHere(where))];
    await keep(c, { kind: 'Guide', family: 'problem', title: guide.name, tone: 'stop', verdict: tr('danger.title'), lines, receipt });
    await proLinks(guide);
    settle();
    void narrate(t, lines);
    return;
  }
  setHead('plain', tr('fix.what', { guide: guide.name }));
  const lines: Said[] = [tr('fix.time', { minutes: minutesText(guide) }), ...(c.escalated ? [tr('route.found')] : firstTimeHere(where))];
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
