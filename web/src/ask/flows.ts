// What happens after Ask, for real: hear the question (or take the sample's own question), take a still, route
// (this device when its model is ready, the internet only after a yes), read with reader.readPhoto, then let plain
// code decide (core/verdict.ts). The answer is put on screen as soon as it is decided, and only then read out:
// narration never holds a button. Every number shown or said comes from a pack item; every sentence is in strings.ts.

import type { Reading, Where } from '../reader';
import type { Settings } from '../config';
import type { LayeredKnowledge } from '../core/knowledge';
import type { Guide, PriceItem } from '../core/packs';
import type { JobMemory, PayeeMemory } from '../core/memory';
import { compareToLastTime, earlierJobs, knownPayees } from '../core/memory';
import { billVerdict, quoteVerdicts } from '../core/verdict';
import { guideByRef, proPrice } from '../core/packs';
import { maskText } from '../core/pii';
import { buildCloudLookup } from '../core/cloudPayload';
import {
  billAnswer,
  guideSources,
  lineItems,
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
import { addCheck, dataStore, newId, pictureUrl, projectName, putMemory, type Check, type CheckKind, type Family } from '../store/data';
import { getPrefs, setPrefs } from '../store/prefs';
import {
  addLine,
  alive,
  ask,
  choice,
  clearLines,
  clearWords,
  current,
  cutNarration,
  listenQuestion,
  narrate,
  narrated,
  patch,
  press,
  run,
  say,
  setErrorHandler,
  setHead,
  setPhase,
  settle,
  showLines,
  typed,
  view,
  type Choice,
  type Said,
} from './conversation';

// ---------- what the page provides ----------

export interface Still {
  blob: Blob;
  light?: number;
  fromCamera: boolean;
}
export interface AskUi {
  capture(): Promise<Still | null>;
  cameraState(): CameraState;
  navigate(path: string): void;
  openSamples(): void;
  openReminder(r: { title: string }): void;
}
let ui: AskUi = {
  capture: async () => null,
  cameraState: () => 'idle',
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
  patch({ reading: false });
  setPhase('speaking');
  clearLines();
  if (!deviceStore.get().online) {
    setHead('plain', tr('net.none.title'), 'nonet');
    await say(t, tr('net.stopped', { device: dev() }));
  } else {
    setHead('plain', tr('read.fail.title'));
    await say(t, tr('read.fail'));
  }
  settle();
});

// ---------- the opening ----------

/** The first greeting. The big button stays Ask the whole time: pressing it cuts the greeting and listens. */
export function greet() {
  void run(async (t) => {
    clearWords();
    patch({ phase: 'ready' });
    void narrate(t, [tr('first.say')]);
  });
}

/** Ask. A sample picture brings its own question, so it is asked at once, without listening. */
export function startAsk(preset?: string) {
  void run((t) => askFlow(t, preset));
}

async function askFlow(t: number, preset?: string) {
  const question = preset ?? (await hearQuestion(t));
  if (!question) return;
  clearWords();
  patch({ asked: tr('asked', { words: question }) });

  const still = await ui.capture();
  alive(t);
  if (!still) return cameraOff(t);
  if (still.fromCamera && still.light !== undefined && still.light < 0.08) return tooDark(t);

  const url = URL.createObjectURL(still.blob);
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

  const ctx: Ctx = { t, question, where, reading, kb, settings, picture: still.blob };
  const kind = reading.understanding.kind;
  if (kind === 'quote') return quoteFlow(ctx);
  if (kind === 'bill') return billFlow(ctx);
  if (kind === 'problem') return problemFlow(ctx);
  clearLines();
  setHead('plain', tr('what.title'));
  settle();
  void narrate(t, [tr('what.line')]);
}

interface Ctx {
  t: number;
  question: string;
  where: Where;
  reading: Reading;
  kb: LayeredKnowledge;
  settings: Settings;
  picture: Blob;
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

// ---------- hearing the question ----------

async function hearQuestion(t: number): Promise<string> {
  const can = await listening();
  alive(t);
  if (can === 'unavailable') {
    clearWords();
    setPhase('speaking');
    await say(t, tr('hear.pick'));
    return pickQuestion(t);
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    clearWords();
    patch({ still: null, looking: false, reading: false });
    setPhase('listening');
    setHead('plain', tr('listen.title'), 'mic');
    addLine('', 'heard');
    soundStart();
    const heard = (await listenQuestion(t)).trim();
    soundEnd();
    if (heard) {
      clearWords();
      return heard;
    }
    if ((await permission('microphone')) === 'denied') {
      setPhase('speaking');
      clearLines();
      setHead('plain', tr('hear.title'), 'mic');
      await say(t, tr('mic.line'));
      return pickQuestion(t);
    }
    setPhase('speaking');
    setHead('plain', tr('hear.title'), 'mic');
    clearLines();
    await say(t, attempt === 0 ? tr('hear.1') : tr('hear.2'));
  }
  return pickQuestion(t);
}

async function pickQuestion(t: number): Promise<string> {
  const qs = [tr('hear.q1'), tr('hear.q2'), tr('hear.q3'), tr('hear.q4')];
  const c = await choice(t, [...qs.map((q, i) => ({ value: `q${i}`, label: q })), { value: 'type', label: tr('hear.type') }], { stack: true });
  clearWords();
  if (c === 'type') {
    const text = (await typed(t)).trim();
    clearWords();
    return text;
  }
  return qs[Number(c.slice(1))] ?? qs[0];
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
  setPhase('ready');
  patch({ done: true, now: null });
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
// ---------- shared pieces of an answer ----------

/** "I worked that out right here", said once ever, after the first answer that stayed on the device. */
function firstTimeHere(where: Where): string[] {
  if (where !== 'device' || getPrefs().toldLocal) return [];
  setPrefs({ toldLocal: true });
  return [deviceStore.get().online ? tr('first.local', { device: dev() }) : tr('first.offline', { device: dev() })];
}

function tech(c: Ctx, extra: string[] = []): string[] {
  const r = c.reading;
  const chose = r.retrieval.offered > 0;
  const who =
    c.where === 'device'
      ? `Read by the built-in model on this ${dev()} (Firebase AI Logic, on-device).`
      : `Read in the cloud through the Firebase AI Logic server prompt template weknow-read-photo-v1${chose ? ', then weknow-choose-v1' : ''}.`;
  return [
    `${who} ${(r.ms / 1000).toFixed(1)} s (reading ${r.steps.read} ms${chose ? `, choosing ${r.steps.choose} ms` : ''}).`,
    `Requests to the cloud model: ${c.where === 'device' ? 0 : chose ? 2 : 1}.`,
    `Pack ${c.kb.id}, version ${c.kb.version}. Shards loaded: ${r.retrieval.shards.join(', ') || 'none'}; ${r.retrieval.bytes} bytes fetched; ${r.retrieval.offered} options offered${r.retrieval.trimmed ? `, ${r.retrieval.trimmed} trimmed to fit` : ''}.`,
    ...extra,
  ];
}

async function keep(
  c: Ctx,
  o: { kind: CheckKind; family: Family; title: string; tone: Tone; verdict: string; lines: Said[]; items?: LineItem[]; receipt: Receipt; project?: string },
): Promise<Check> {
  const { shrinkPhoto } = await import('../image');
  const small = await shrinkPhoto(c.picture, 900, 0.8).catch(() => c.picture);
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

function keptLine(check: Check): string {
  return dataStore.get().projects.length > 1 ? tr('kept.project', { project: projectName(check.projectId) }) : tr('kept.one');
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
  const check = await keep(c, {
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

  // On this device, the first time: ask before one line goes over the internet (after the verdict is read out).
  if (unknown.length && online && !lookNow) {
    void narrate(t, lines);
    setPhase('settled');
    await narrated();
    const yes = await ask(
      t,
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
    if (yes) {
      setPrefs({ consented: true });
      receipt = receiptFor({ sent: parcel, waiting: tr('where.requested', { names: names.join(', ') }) });
      fileRequests(names, kb.region, () => undefined);
    } else receipt = receiptFor({ sent: [], waiting: tr('where.declined', { names: names.join(', ') }) });
    patch({ receipt });
    lines.length = 0;
    lines.push(yes ? (names.length === 1 ? tr('quote.requested') : tr('quote.requested.n')) : names.length === 1 ? tr('quote.skip') : tr('quote.skip.n'));
  }

  if (summary.worst) {
    lines.push(tr('quote.words.ask'));
    void narrate(t, lines);
    const want = await choice(t, [
      { value: 'yes', label: tr('quote.words.yes') },
      { value: 'no', label: tr('quote.words.no') },
    ]);
    if (want === 'yes') {
      await sayThis(t, summary.worst);
      // Back to the answer: the verdict and its reasons stay on screen.
      clearLines();
      setHead(summary.verdict.tone, summary.verdict.text);
      showLines(verdictLines);
    }
    setPhase('settled');
    void narrate(t, [keptLine(check)]);
    await narrated();
  } else {
    lines.push(keptLine(check));
    void narrate(t, lines);
    setPhase('settled');
    await narrated();
  }
  alive(t);
  const asked = await rememberShop(t, shop, items, u.lines.map((l) => l.ref));
  settle();
  if (!asked) await offerReady(t);
}

async function sayThis(t: number, worst: LineItem) {
  for (;;) {
    clearLines();
    setHead('plain', tr('quote.say.title'), 'say');
    void narrate(t, [{ text: sayToShop(worst), kind: 'strong' }]);
    const c = await choice(t, [
      { value: 'done', label: tr('quote.say.done') },
      { value: 'again', label: tr('quote.say.again') },
    ]);
    if (c !== 'again') return;
  }
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
  const ans = billAnswer(v, payee, known);
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
  const check = await keep(c, {
    kind: 'Bill',
    family: 'bill',
    title: payee ? `Bill from ${payee}` : tr('kind.Bill'),
    tone: ans.verdict.tone,
    verdict: ans.verdict.text,
    lines,
    receipt,
  });
  alive(t);
  lines.push(keptLine(check));

  // Remember a payee only after a bill whose one doubt is that WeKnow has not seen it before.
  const digits = (u.payTo ?? '').replace(/\D/g, '');
  const onlyNew = v.flags.length === 1 && v.flags[0] === 'new-payee';
  let asked = false;
  if (payee && digits.length >= 4 && onlyNew && getPrefs().offerNotes) {
    asked = true;
    void narrate(t, lines);
    setPhase('settled');
    await narrated();
    const note: PayeeMemory = { kind: 'payee', id: newId('m'), name: payee, payTo: digits.slice(-4), date: today() };
    const first = !getPrefs().toldNotes;
    const yes = await ask(
      t,
      {
        kind: 'note',
        title: tr('note.ask.payee'),
        body: tr('note.ask.body', { device: dev() }),
        parcel: [payee, tr('note.account', { digits: note.payTo }), tr('note.last', { date: longDate(note.date) })],
        not: [tr('note.ask.fine', { device: dev() })],
        yes: tr('note.ask.yes'),
        no: tr('note.ask.no'),
      },
      first ? [tr('note.ask.payee'), tr('note.ask.first', { device: dev() })] : [tr('note.ask.payee')],
    );
    setPrefs({ toldNotes: true });
    if (yes) await putMemory(note);
    lines.length = 0;
    lines.push(yes ? tr('note.wrote') : tr('note.declined'));
  } else if (v.safe && match) {
    const old = mem.find((m): m is PayeeMemory => m.kind === 'payee' && m.name === match.name);
    if (old) await putMemory({ ...old, date: today() });
  }

  void narrate(t, lines);
  for (;;) {
    const p = getPrefs();
    const opts: Choice[] = [];
    const tone = ans.verdict.tone;
    if (tone !== 'ok' && p.trustedName && p.trustedNumber)
      opts.push({ value: 'call', label: tr('letter.call', { name: p.trustedName }), href: `tel:${p.trustedNumber.replace(/[^\d+]/g, '')}`, icon: 'phone' });
    if (tone !== 'ok') opts.push({ value: 'again', label: tr('letter.again') });
    if (tone !== 'stop') opts.push({ value: 'remind', label: tr('letter.remind') });
    const pickd = await choice(t, opts, { stack: opts.length > 2 });
    if (pickd === 'again') {
      clearLines();
      void narrate(t, reasons);
      continue;
    }
    if (pickd === 'call') void narrate(t, [tr('letter.calling', { name: p.trustedName })]);
    if (pickd === 'remind') ui.openReminder({ title: payee ? tr('remind.default', { payee }) : tr('remind.default.none') });
    break;
  }
  settle();
  if (!asked) await offerReady(t);
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
  const { t, reading, where } = c;
  const u = reading.understanding;
  const guide = u.problemRef ? guideByRef(reading.pack, u.problemRef) : undefined;
  if (!guide) {
    clearLines();
    setHead('plain', tr('new.title'));
    settle();
    void narrate(t, [tr('new.line'), ...(!deviceStore.get().online ? [tr('new.offline')] : [])]);
    return;
  }
  const pro = proPrice(reading.pack, guide);
  const proSentence = proLine(reading.pack, guide, pro);
  const receipt: Receipt = {
    w: whereRan({ where, online: deviceStore.get().online, sent: 0, pending: 0 }),
    n: 0,
    stayed: where === 'device' ? [tr('where.picture'), tr('where.question'), tr('where.steps')] : [tr('where.steps')],
    sent: where === 'cloud' ? [tr('where.sent.picture'), tr('where.sent.question', { q: c.question })] : [],
    sentPicture: where === 'cloud',
    sources: guideSources(guide),
    tech: tech(c),
  };

  clearLines();
  patch({ receipt });
  if (!guide.steps.length) {
    // Needs a professional: never offers steps.
    setHead('stop', tr('danger.title'));
    const lines: Said[] = [tr('danger.line', { reason: guide.safety?.[0] ?? guide.name }), ...(proSentence ? [proSentence] : []), ...firstTimeHere(where)];
    const check = await keep(c, { kind: 'Guide', family: 'problem', title: guide.name, tone: 'stop', verdict: tr('danger.title'), lines, receipt });
    await proLinks(guide);
    settle();
    void narrate(t, [...lines, keptLine(check)]);
    return;
  }
  setHead('ok', tr('fix.title'));
  void narrate(t, [tr('fix.what', { guide: guide.name }), ...firstTimeHere(where), tr('fix.offer', { minutes: minutesText(guide) })]);
  const yes = await choice(t, [
    { value: 'yes', label: tr('fix.yes') },
    { value: 'no', label: tr('fix.no') },
  ]);
  if (yes === 'yes') return guideFlow(c, guide, -1, receipt, proSentence);
  const check = await keep(c, { kind: 'Guide', family: 'problem', title: guide.name, tone: 'ok', verdict: tr('fix.title'), lines: [tr('fix.what', { guide: guide.name })], receipt });
  settle();
  void narrate(t, [keptLine(check)]);
  await offerReady(t);
}

/**
 * Step by step. `from` -1 starts with "Before you start". Each instruction is on screen at once and read out in
 * the background; Next, Again and Stop work at any moment and cut the reading.
 */
async function guideFlow(c: Ctx, g: Guide, from: number, receipt: Receipt, proSentence: string | null): Promise<void> {
  const { t } = c;
  const total = g.steps.length;
  patch({ still: null, looking: false, receipt: null, kept: null, items: null, links: [], asked: null });
  setHead(null);
  clearLines();
  setPhase('guide');

  if (from < 0) {
    patch({ steps: { label: tr('guide.before'), n: 0, total } });
    const cautions: Said[] = (g.safety ?? []).slice(0, 2).map((s, i) => ({ text: i === 0 ? tr('guide.caution', { text: s }) : tr('guide.caution.more', { text: s }), kind: 'warn' as const }));
    if (g.stopIf?.length) cautions.push({ text: tr('guide.stopif', { text: g.stopIf.slice(0, 2).join(' Or: ') }), kind: 'warn' });
    const pressed = press(t);
    void narrate(t, cautions);
    const a = await pressed;
    if (a === 'stop') return guideStop(c, g, 0, receipt, proSentence);
    from = 0;
  }
  let good = false;
  for (let i = from; i < total; i++) {
    patch({ steps: { label: tr('guide.step', { n: i + 1, total }), n: i + 1, total } });
    clearLines();
    const pressed = press(t);
    void narrate(t, [...(good ? [{ text: tr('guide.ok'), kind: 'ok' as const }] : []), { text: g.steps[i], kind: 'strong' as const }]);
    const act = await pressed;
    if (act === 'stop') return guideStop(c, g, i, receipt, proSentence);
    good = act === 'next';
    if (act === 'again') i--;
  }
  patch({ steps: null, receipt });
  setPhase('speaking');
  clearLines();
  setHead('ok', tr('guide.done.title', { total }));
  void narrate(t, [{ text: tr('guide.ok'), kind: 'ok' }, tr('guide.done.ask')]);
  const fixed = await choice(t, [
    { value: 'yes', label: tr('guide.yes') },
    { value: 'no', label: tr('guide.no') },
  ]);
  clearLines();
  const tone: Tone = fixed === 'yes' ? 'ok' : 'warn';
  const verdict = fixed === 'yes' ? tr('guide.good.title') : tr('guide.pro.title');
  const lines: Said[] = fixed === 'yes' ? [tr('guide.good.line')] : [...(proSentence ? [proSentence] : []), tr('guide.pro.quote')];
  setHead(tone, verdict);
  const check = await keep(c, { kind: 'Guide', family: 'problem', title: g.name, tone, verdict, lines, receipt });
  if (tone === 'warn') await proLinks(g);
  settle();
  void narrate(t, [...lines, keptLine(check)]);
  await offerReady(t);
}

async function guideStop(c: Ctx, g: Guide, i: number, receipt: Receipt, proSentence: string | null): Promise<void> {
  const { t } = c;
  patch({ steps: null });
  clearLines();
  setHead('plain', tr('guide.stop.title', { n: i + 1 }));
  void narrate(t, [tr('guide.wait')]);
  const go = await choice(t, [
    { value: 'go', label: tr('guide.carry') },
    { value: 'end', label: tr('guide.finish') },
  ]);
  if (go === 'go') return guideFlow(c, g, i, receipt, proSentence);
  const verdict = tr('guide.stop.title', { n: i + 1 });
  const check = await keep(c, { kind: 'Guide', family: 'problem', title: g.name, tone: 'plain', verdict, lines: [], receipt });
  patch({ receipt });
  settle();
  void narrate(t, [keptLine(check)]);
}

// ---------- hear a kept check again (nothing is sent anywhere) ----------

export function replay(check: Check) {
  void run(async (t) => {
    clearWords();
    const url = check.pictureId ? await pictureUrl(check.pictureId) : undefined;
    alive(t);
    const sameDay = new Date(check.date).toDateString() === new Date().toDateString();
    patch({
      still: url ?? null,
      looking: !!url,
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
