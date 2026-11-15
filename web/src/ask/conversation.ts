// The Ask screen as a conversation: one script runs at a time, says each sentence as a caption (and aloud),
// waits for a press or a word, and can be stopped at any moment without losing what is on screen.
// Flows (ask/flows.ts) are plain async code written against these few primitives.

import { createStore, useStore } from '../store/store';
import type { LineItem, Receipt, Tone } from '../answer/types';
import { listenForQuestion, matchWord, quiet, sayAloud, type Ear } from '../engine/speech';
import { permission } from '../engine/camera';

export type Phase = 'ready' | 'listening' | 'looking' | 'speaking' | 'waiting' | 'settled' | 'guide';
export type IconKey = 'mic' | 'say' | 'lamp' | 'nonet' | 'camoff' | 'help';

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
}

export interface AskView {
  phase: Phase;
  asked: string | null;
  steps: { label: string; n: number; total: number } | null;
  head: { tone: Tone; text: string; icon?: IconKey } | null;
  lines: Line[];
  now: number | null;
  done: boolean;
  items: LineItem[] | null;
  choices: { options: Choice[]; stack: boolean } | null;
  typing: boolean;
  receipt: Receipt | null;
  kept: { checkId: string } | null;
  /** The picture the person chose (shown when nothing is being read). */
  chosen: Picture | null;
  /** The still WeKnow is reading or answered about. */
  still: string | null;
  looking: boolean;
  reading: boolean;
  dim: boolean;
  chip: 'live' | 'dark' | 'light' | null;
  sheet: SheetRequest | null;
  level: number;
}

const INITIAL: AskView = {
  phase: 'ready',
  asked: null,
  steps: null,
  head: null,
  lines: [],
  now: null,
  done: true,
  items: null,
  choices: null,
  typing: false,
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
let resolveTyped: ((v: string) => void) | null = null;
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
  resolveChoice = resolveSheet = resolvePress = resolveTyped = null;
  for (const cancel of [...waits]) cancel(new Cancel());
  waits.clear();
  patch({ sheet: null, choices: null, typing: false, reading: false, now: null, done: true, level: 0 });
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
  patch({ asked: null, head: null, lines: [], now: null, items: null, choices: null, steps: null, receipt: null, kept: null, typing: false });
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

/** Show a sentence and say it. */
export async function say(t: number, text: string, kind?: Line['kind'], noteTag = false) {
  alive(t);
  addLine(text, kind, noteTag);
  await sayAloud(text);
  alive(t);
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
  patch({ phase: 'waiting', done: true, now: null, choices: { options, stack: o.stack ?? options.length > 2 } });
  const picked = waitFor<string>((resolve) => {
    resolveChoice = resolve;
  });
  if (o.listen !== false) void listenFor(t, options, () => !!resolveChoice, pick);
  return picked.then((v) => {
    alive(t);
    stopEar?.();
    stopEar = null;
    patch({ choices: null });
    return v;
  });
}

export function pick(value: string) {
  quiet();
  const r = resolveChoice;
  resolveChoice = null;
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
  quiet();
  resolvePress?.(v);
}

export const waitingForPress = () => !!resolvePress;

/** "Type instead": resolves with what was typed. */
export function typed(t: number): Promise<string> {
  alive(t);
  patch({ typing: true, choices: null, phase: 'waiting' });
  return waitFor<string>((resolve) => {
    resolveTyped = (v) => {
      resolveTyped = null;
      patch({ typing: false });
      resolve(v);
    };
  });
}

export function submitTyped(v: string) {
  resolveTyped?.(v);
}

// ---------- listening for the question ----------

export async function listenQuestion(t: number): Promise<string> {
  alive(t);
  const e = await listenForQuestion(
    (w) => {
      if (t !== token) return;
      askStore.set((s) => ({ ...s, lines: s.lines.map((l) => (l.kind === 'heard' ? { ...l, text: w } : l)) }));
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

/** The big button, while listening: end listening now. */
export function finishListening() {
  ear?.stop();
}

export function resetView() {
  hush();
  const chosen = view().chosen;
  askStore.set({ ...INITIAL, chosen });
}
