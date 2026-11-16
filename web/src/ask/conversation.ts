// The Ask screen as a conversation: one script runs at a time, says each sentence as a caption (and aloud),
// waits for a press or a word, and can be stopped at any moment without losing what is on screen.
// Flows (ask/flows.ts) are plain async code written against these few primitives.

import { createStore, useStore } from '../store/store';
import type { LineItem, Receipt, Tone } from '../answer/types';
import { listenForQuestion, matchWord, quiet, sayAloud, type Ear } from '../engine/speech';
import { permission } from '../engine/camera';

export type Phase = 'ready' | 'listening' | 'looking' | 'speaking' | 'waiting' | 'settled' | 'guide';
export type IconKey = 'mic' | 'say' | 'lamp' | 'nonet' | 'camoff' | 'help' | 'type' | 'cam';

export interface Line {
  id: number;
  text: string;
  kind?: 'strong' | 'ok' | 'warn' | 'heard';
  noteTag?: boolean;
}
export interface Choice {
  value: string;
  label: string;
  href?: string;
  icon?: 'phone' | 'map';
  /** Opens in a new tab (maps). */
  external?: boolean;
}
export interface SheetRequest {
  kind: 'net' | 'note' | 'device';
  title: string;
  body?: string;
  parcel: string[];
  /** A small copy of the picture that would be sent. */
  picture?: string;
  not: string[];
  yes: string;
  no: string;
  /** Runs inside the Yes click itself (the model download needs the press). */
  onYesClick?: () => void;
}

/** A picture in the window instead of the live camera: a sample, a chosen photo, or the still being read. */
export interface Picture {
  url: string;
  blob: Blob;
  sample?: string;
  /** Taken with the camera button (not a chosen photo or a sample). */
  camera?: boolean;
}

/** Something the person said or showed: their words and their picture, on the right. */
export interface MineMsg {
  id: number;
  who: 'me';
  text: string;
  picture?: string;
}
/** An answer from WeKnow that is no longer the newest: kept as it was, without its buttons. */
export interface WkMsg {
  id: number;
  who: 'wk';
  head: AskView['head'];
  steps: AskView['steps'];
  lines: Line[];
  items: LineItem[] | null;
  receipt: Receipt | null;
  kept: { checkId: string } | null;
  links: Choice[];
}
export type Msg = MineMsg | WkMsg;

/** A next question under the newest answer: pressing it asks it (it shows as the person's message). */
export interface Next {
  label: string;
  act: () => void;
}

export interface AskView {
  /** The conversation so far, oldest first. The newest answer is not in it: it is the live fields below. */
  history: Msg[];
  /** The next-question buttons under the newest answer. */
  next: Next[];
  /** Words heard so far while listening (they go into the question box). */
  heard: string;
  /** The camera opened from the question box once the conversation has started. */
  viewfinder: boolean;
  phase: Phase;
  asked: string | null;
  steps: { label: string; n: number; total: number } | null;
  head: { tone: Tone; text: string; icon?: IconKey } | null;
  lines: Line[];
  now: number | null;
  done: boolean;
  items: LineItem[] | null;
  choices: { options: Choice[]; stack: boolean } | null;
  receipt: Receipt | null;
  kept: { checkId: string } | null;
  /** The picture attached to the question box (shown in the window until it is sent or taken off). */
  chosen: Picture | null;
  /** The still WeKnow is reading or answered about. */
  still: string | null;
  looking: boolean;
  reading: boolean;
  dim: boolean;
  chip: 'live' | 'dark' | 'light' | null;
  sheet: SheetRequest | null;
  level: number;
  /** Links that stay under an answer (for example "Find a pro nearby"); they do not end the conversation. */
  links: Choice[];
  /** Offer the sample pictures under the words (when nothing could be answered). */
  offerSamples: boolean;
  /** An answer is being read out in the background (narrate), so the question box offers Stop. */
  talking: boolean;
}

const INITIAL: AskView = {
  history: [],
  next: [],
  heard: '',
  viewfinder: false,
  phase: 'ready',
  asked: null,
  steps: null,
  head: null,
  lines: [],
  now: null,
  done: true,
  items: null,
  choices: null,
  receipt: null,
  kept: null,
  chosen: null,
  still: null,
  looking: false,
  reading: false,
  dim: false,
  chip: null,
  sheet: null,
  level: 0,
  links: [],
  offerSamples: false,
  talking: false,
};

export const askStore = createStore<AskView>(INITIAL);
export const useAsk = () => useStore(askStore);
export const view = () => askStore.get();
export function patch(p: Partial<AskView>) {
  askStore.set((s) => ({ ...s, ...p }));
}

export class Cancel extends Error {}

let token = 0;
let seq = 0;
let resolveChoice: ((v: string) => void) | null = null;
let resolveSheet: ((yes: boolean) => void) | null = null;
let resolvePress: ((v: 'next' | 'again' | 'stop') => void) | null = null;
let stopEar: (() => void) | null = null;
let ear: Ear | null = null;
/** Every wait for the person can be cancelled, so a stopped script unwinds instead of hanging. */
const waits = new Set<(e: Error) => void>();
function waitFor<T>(attach: (resolve: (v: T) => void) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cancel = (e: Error) => reject(e);
    waits.add(cancel);
    attach((v) => {
      waits.delete(cancel);
      resolve(v);
    });
  });
}

export const current = () => token;
export function alive(t: number) {
  if (t !== token) throw new Cancel();
}

/** Stop talking and looking. What is on screen stays. */
export function hush() {
  token++;
  quiet();
  stopEar?.();
  stopEar = null;
  ear?.stop();
  ear = null;
  resolveChoice = resolveSheet = resolvePress = null;
  narrGen++;
  narrating = false;
  for (const cancel of [...waits]) cancel(new Cancel());
  waits.clear();
  patch({ sheet: null, choices: null, reading: false, now: null, done: true, level: 0, talking: false });
}

export type ErrorHandler = (e: unknown, t: number) => Promise<void>;
let onError: ErrorHandler = async () => undefined;
export function setErrorHandler(h: ErrorHandler) {
  onError = h;
}

/** Run one script. Any earlier script is stopped first. */
export async function run(fn: (t: number) => Promise<void>) {
  hush();
  const t = token;
  try {
    await fn(t);
  } catch (e) {
    if (e instanceof Cancel) return;
    try {
      await onError(e, t);
    } catch (e2) {
      if (!(e2 instanceof Cancel)) console.warn(e2);
    }
  }
}

// ---------- the words ----------

export function clearWords() {
  patch({ asked: null, head: null, lines: [], now: null, items: null, choices: null, steps: null, receipt: null, kept: null, links: [], offerSamples: false, next: [] });
}

// ---------- the conversation ----------

/** The newest answer has something in it worth keeping in the conversation. */
function liveHasContent(v: AskView) {
  return !!(v.head || v.steps || v.lines.some((l) => l.text.trim() && l.kind !== 'heard') || v.items?.length);
}

/** The newest answer moves up into the conversation (without its buttons); the live answer starts empty. */
export function archive() {
  const v = view();
  if (liveHasContent(v)) {
    const msg: WkMsg = {
      id: ++seq,
      who: 'wk',
      head: v.head,
      steps: v.steps,
      lines: v.lines.filter((l) => l.kind !== 'heard'),
      items: v.items,
      receipt: v.receipt,
      kept: v.kept,
      links: v.links,
    };
    askStore.set((s) => ({ ...s, history: [...s.history, msg] }));
  }
  clearWords();
}

/** The person asks: what WeKnow said last moves up, and their words (and picture) go on the right. */
export function postMine(text: string, picture?: string) {
  archive();
  const msg: MineMsg = { id: ++seq, who: 'me', text, picture };
  askStore.set((s) => ({ ...s, history: [...s.history, msg] }));
}

/** The person has asked something: the page is a conversation now (the camera opens on demand). */
export const started = () => view().history.some((m) => m.who === 'me');

/** Offer the next questions under the newest answer. */
export function offerNext(next: Next[]) {
  patch({ next: next.slice(0, 4) });
}

export function setHead(tone: Tone | null, text = '', icon?: IconKey) {
  patch({ head: tone ? { tone, text, icon } : null });
}

export function addLine(text: string, kind?: Line['kind'], noteTag = false): number {
  const id = ++seq;
  askStore.set((s) => ({ ...s, lines: [...s.lines, { id, text, kind, noteTag }], now: id, done: false }));
  return id;
}

export function clearLines() {
  patch({ lines: [], now: null });
}

/** Mark the last sentence as coming from a note (the "From your notes" tag goes under it). */
export function tagLastAsNote() {
  askStore.set((s) => ({ ...s, lines: s.lines.map((l, i) => (i === s.lines.length - 1 ? { ...l, noteTag: true } : l)) }));
}

/** Show a sentence and say it (any narration still going is cut first, so two voices never overlap). */
export async function say(t: number, text: string, kind?: Line['kind'], noteTag = false) {
  alive(t);
  if (narrating) cutNarration();
  addLine(text, kind, noteTag);
  await sayAloud(text);
  alive(t);
}

// ---------- narration: the answer is on screen first, then it is read out ----------

let narrGen = 0;
let narrating = false;
let narration: Promise<void> = Promise.resolve();
export type Said = string | { text: string; kind?: Line['kind']; noteTag?: boolean };

/**
 * Put every sentence on screen at once, then say them one after another in the background. Nothing waits for it:
 * buttons work at once, and a press, Stop, a new question or the next sentence that has to be said cuts it.
 * The returned promise ends when the narration ends (or is cut).
 */
export function narrate(t: number, texts: Said[]): Promise<void> {
  alive(t);
  if (narrating) cutNarration();
  const items = texts.map((x) => (typeof x === 'string' ? { text: x } : x)).map((x) => ({ ...x, id: ++seq }));
  askStore.set((s) => ({
    ...s,
    lines: [...s.lines, ...items.map(({ id, text, kind, noteTag }) => ({ id, text, kind, noteTag }))],
    now: items[0]?.id ?? null,
    done: false,
    talking: true,
  }));
  const gen = ++narrGen;
  narrating = true;
  narration = (async () => {
    try {
      for (const it of items) {
        if (gen !== narrGen || t !== token) return;
        patch({ now: it.id, done: false });
        await sayAloud(it.text);
      }
    } finally {
      if (gen === narrGen) {
        narrating = false;
        if (t === token) patch({ now: null, done: true, talking: false });
      }
    }
  })();
  return narration;
}

/** Stop reading out; the words stay on screen. */
export function cutNarration() {
  narrGen++;
  narrating = false;
  quiet();
  patch({ now: null, done: true, talking: false });
}

/** Put sentences on screen without saying them (for example the verdict's own words, restored). */
export function showLines(texts: Said[]) {
  const items = texts.map((x) => (typeof x === 'string' ? { text: x } : x)).map((x) => ({ ...x, id: ++seq }));
  askStore.set((s) => ({ ...s, lines: [...s.lines, ...items.map(({ id, text, kind, noteTag }) => ({ id, text, kind, noteTag }))] }));
}

/** Wait until the narration has been said (or cut). */
export function narrated(): Promise<void> {
  return narration;
}

export async function sayAll(t: number, texts: string[]) {
  for (const x of texts) await say(t, x);
}

export function setPhase(phase: Phase) {
  patch({ phase });
}

export function settle() {
  patch({ phase: 'settled', done: true, now: null, looking: false, reading: false });
}

// ---------- waiting for the person ----------

/** Offer buttons (also answerable out loud). The first is the likely one. */
export function choice(t: number, options: Choice[], o: { stack?: boolean; listen?: boolean } = {}): Promise<string> {
  alive(t);
  patch({ phase: 'waiting', choices: { options, stack: o.stack ?? options.length > 2 } });
  const picked = waitFor<string>((resolve) => {
    resolveChoice = resolve;
  });
  // The microphone opens only after WeKnow has finished talking, so it never hears itself.
  if (o.listen !== false) void narration.then(() => listenFor(t, options, () => !!resolveChoice, pick));
  return picked.then((v) => {
    alive(t);
    stopEar?.();
    stopEar = null;
    patch({ choices: null });
    return v;
  });
}

export function pick(value: string) {
  cutNarration();
  const r = resolveChoice;
  resolveChoice = null;
  // The answer the person pressed shows as their message, as in any chat.
  const label = view().choices?.options.find((o) => o.value === value)?.label;
  if (r && label) postMine(label);
  r?.(value);
}

/** After WeKnow asks a question the microphone opens by itself (only once it has been allowed). */
async function listenFor(t: number, options: Choice[], waiting: () => boolean, apply: (v: string) => void) {
  if ((await permission('microphone')) !== 'granted') return;
  if (t !== token || !waiting()) return;
  try {
    const e = await listenForQuestion(() => undefined);
    stopEar = () => e.stop();
    const heard = (await e.done).toLowerCase().trim();
    if (t !== token || !waiting() || !heard) return;
    const w = matchWord(heard);
    const byLabel = options.find((o) => !o.href && o.label.toLowerCase() === heard);
    if (byLabel) return apply(byLabel.value);
    if ((w === 'yes' || w === 'next') && options[0] && !options[0].href) return apply(options[0].value);
    if (w === 'no' && options[1] && !options[1].href) return apply(options[1].value);
    if (w === 'again') {
      const again = options.find((o) => /again/.test(o.value));
      if (again) return apply(again.value);
    }
  } catch {
    /* silence is not an error */
  }
}

/** The asking sheet, the remember sheet and the offer to get ready. Resolves true for yes. */
export async function ask(t: number, sheet: SheetRequest, spoken: string[]): Promise<boolean> {
  alive(t);
  if (narrating) cutNarration();
  patch({ phase: 'waiting', sheet });
  const answer = waitFor<boolean>((resolve) => {
    resolveSheet = resolve;
  });
  void (async () => {
    for (const s of spoken) {
      if (t !== token || !resolveSheet) return;
      await sayAloud(s);
    }
    if (t === token && resolveSheet) {
      const options = [{ value: 'yes', label: sheet.yes }, { value: 'no', label: sheet.no }];
      void listenFor(t, options, () => !!resolveSheet, (v) => answerSheet(v === 'yes'));
    }
  })();
  const yes = await answer;
  quiet();
  alive(t);
  patch({ sheet: null });
  return yes;
}

export function answerSheet(yes: boolean) {
  cutNarration();
  const r = resolveSheet;
  resolveSheet = null;
  stopEar?.();
  stopEar = null;
  r?.(yes);
}

/** Step by step: wait for Next, Again or Stop (button, key or word). */
export function press(t: number): Promise<'next' | 'again' | 'stop'> {
  alive(t);
  return waitFor<'next' | 'again' | 'stop'>((resolve) => {
    resolvePress = (v) => {
      resolvePress = null;
      resolve(v);
    };
  });
}

export function pressGuide(v: 'next' | 'again' | 'stop') {
  cutNarration();
  resolvePress?.(v);
}

export const waitingForPress = () => !!resolvePress;

// ---------- listening for the question ----------

export async function listenQuestion(t: number): Promise<string> {
  alive(t);
  const e = await listenForQuestion(
    (w) => {
      if (t !== token) return;
      askStore.set((s) => ({ ...s, heard: w, lines: s.lines.map((l) => (l.kind === 'heard' ? { ...l, text: w } : l)) }));
    },
    (level) => {
      if (t === token) patch({ level });
    },
  );
  ear = e;
  const heard = await e.done;
  ear = null;
  alive(t);
  return heard;
}

/** The microphone button (or Space), while listening: end listening now. */
export function finishListening() {
  ear?.stop();
}

// ---------- the picture attached to the question box ----------

/** Attach a picture (a camera still, a chosen photo or a sample): it shows in the window and goes with Send. */
export function attach(blob: Blob, sample?: string, camera = false) {
  const old = view().chosen;
  if (old) URL.revokeObjectURL(old.url);
  patch({ chosen: { url: URL.createObjectURL(blob), blob, sample, camera }, still: null, looking: false, dim: false, chip: null, viewfinder: false });
}

/** A picture was attached: whatever WeKnow was saying or waiting for stops; the conversation stays. */
export function startOver() {
  hush();
  // Before the first message, a dead end that was on screen ("Add a picture first") makes way for the picture.
  if (!started()) clearWords();
  patch({ choices: null, phase: started() ? 'settled' : 'ready', viewfinder: false });
}

/** Take the attached picture off (the × on it, or "Use the camera"): the window shows the live camera again. */
export function detach() {
  const old = view().chosen;
  if (old) URL.revokeObjectURL(old.url);
  patch({ chosen: null, still: null, looking: false });
}

/** Start again: the conversation is cleared (a picture already attached stays on the box). */
export function resetView() {
  hush();
  const chosen = view().chosen;
  askStore.set({ ...INITIAL, chosen });
}
