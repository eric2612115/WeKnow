// Cover personal details on a picture, on this device, before it may be sent: the web's version of the iPhone's
// text step (Apple Vision there). The words are found by tesseract.js in its own Web Worker; the worker, its
// WebAssembly core and the English data are served from WeKnow's own site (/tessdata, copied from npm by
// vite.config.ts), never from a CDN. Plain code (core/cover.ts) decides what to cover; the black bars are drawn
// here on a copy of the picture that would be sent. Loaded only on the cloud path.

import type { Worker as OcrWorker } from 'tesseract.js';
import { coverDetails, coveredCounts, type CoveredDetail, type OcrLine } from './core/cover';
import type { PIIKind } from './core/pii';

export interface Covered {
  /** The picture with black bars over every personal detail found: the only picture that may be sent. */
  blob: Blob;
  /** An object URL of `blob`, to show it. */
  url: string;
  details: CoveredDetail[];
  counts: Partial<Record<PIIKind, number>>;
  /** Words the recognizer found (0: no text on the picture). */
  words: number;
  /** The recognized words, one printed line per entry. They stay on this device (core/billMath.ts reads them). */
  text: string[];
  ms: { load: number; read: number; total: number };
}

export class CoverError extends Error {
  readonly reason: 'timeout' | 'failed';
  constructor(reason: 'timeout' | 'failed', message: string) {
    super(message);
    this.name = 'CoverError';
    this.reason = reason;
  }
}

/** Reading the words of one picture: past this, nothing is sent and the person is asked again. */
export const READ_LIMIT_MS = 8_000;
/** Getting the reader ready the first time (about 6 MB from this site, then kept by the browser). */
export const LOAD_LIMIT_MS = 30_000;
/** Small print reads better on a larger copy: the long side of the copy the words are read from. */
const READ_SIDE = { min: 1800, max: 2400 };

const asset = (path: string) => new URL(`${import.meta.env.BASE_URL}tessdata/${path}`, location.href).href;

let engine: Promise<OcrWorker> | null = null;

/** Start the text reader (worker, core and English data, all from this site). Safe to call more than once. */
export function warmCover(): Promise<OcrWorker> {
  if (!engine) {
    const p = (async () => {
      const mod = await import('tesseract.js');
      const T = (mod as unknown as { default?: typeof mod }).default ?? mod;
      return T.createWorker('eng', 1 as never /* LSTM only: matches the best_int data */, {
        workerPath: asset('worker.min.js'),
        corePath: asset('core'),
        langPath: asset(''),
        workerBlobURL: false,
        gzip: true,
      });
    })();
    engine = p;
    p.catch(() => {
      if (engine === p) engine = null;
    });
  }
  return engine;
}

function stop() {
  const p = engine;
  engine = null;
  void p?.then((w) => w.terminate()).catch(() => undefined);
}

function limit<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new CoverError('timeout', `${what} took longer than ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof CoverError ? e : new CoverError('failed', String((e as Error)?.message ?? e)));
      },
    );
  });
}

/**
 * Cover the personal details on `small` (the shrunk picture that would be sent). The words are read from
 * `original` when given (sharper small print), else from `small`. Throws CoverError when the words could not be
 * read in time: the caller must then send nothing.
 */
export async function coverPicture(small: Blob, original?: Blob): Promise<Covered> {
  const t0 = performance.now();
  const worker = await limit(warmCover(), LOAD_LIMIT_MS, 'loading the text reader');
  const t1 = performance.now();

  const target = await createImageBitmap(small);
  const source = original && original !== small ? await createImageBitmap(original).catch(() => null) : null;
  const from = source ?? target;
  const long = Math.max(from.width, from.height);
  const side = Math.min(READ_SIDE.max, Math.max(READ_SIDE.min, long));
  const k = Math.min(2.5, side / long);
  const rw = Math.round(from.width * k);
  const rh = Math.round(from.height * k);
  const readCopy = new OffscreenCanvas(rw, rh);
  const rctx = readCopy.getContext('2d');
  if (!rctx) throw new CoverError('failed', 'no canvas');
  rctx.fillStyle = '#fff';
  rctx.fillRect(0, 0, rw, rh);
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(from, 0, 0, rw, rh);
  source?.close();
  const readBlob = await readCopy.convertToBlob({ type: 'image/png' });

  let lines: OcrLine[];
  try {
    const r = await limit(worker.recognize(readBlob, {}, { blocks: true, text: false }), READ_LIMIT_MS, 'reading the words');
    lines = (r.data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  } catch (e) {
    // A reader stuck on one picture would hold the next one too: start it afresh next time.
    stop();
    target.close();
    throw e;
  }
  const t2 = performance.now();

  const details = coverDetails(lines, { width: rw, scale: target.width / rw });
  const canvas = new OffscreenCanvas(target.width, target.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    target.close();
    throw new CoverError('failed', 'no canvas');
  }
  ctx.drawImage(target, 0, 0);
  target.close();
  ctx.fillStyle = '#000';
  for (const d of details) for (const r of d.rects) ctx.fillRect(Math.floor(r.x), Math.floor(r.y), Math.ceil(r.w) + 1, Math.ceil(r.h) + 1);
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  const t3 = performance.now();

  const words = lines.reduce((n, l) => n + l.words.length, 0);
  const ms = { load: Math.round(t1 - t0), read: Math.round(t2 - t1), total: Math.round(t3 - t0) };
  console.info('[WeKnow] covered on this device', { words, counts: coveredCounts(details), ms, sentBytes: blob.size });
  return { blob, url: URL.createObjectURL(blob), details, counts: coveredCounts(details), words, text: textOf(lines), ms };
}

const textOf = (lines: OcrLine[]) => lines.map((l) => l.words.map((w) => w.text).join(' ').trim()).filter(Boolean);

/**
 * Only read the words of a picture, on this device, one printed line per entry (for the plain-code bill checks when
 * the picture was read by this device's model and nothing was covered). Throws CoverError when it takes too long.
 */
export async function readLines(picture: Blob): Promise<string[]> {
  const worker = await limit(warmCover(), LOAD_LIMIT_MS, 'loading the text reader');
  const bmp = await createImageBitmap(picture);
  const long = Math.max(bmp.width, bmp.height);
  const k = Math.min(2.5, Math.min(READ_SIDE.max, Math.max(READ_SIDE.min, long)) / long);
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext('2d');
  if (!ctx) {
    bmp.close();
    throw new CoverError('failed', 'no canvas');
  }
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await c.convertToBlob({ type: 'image/png' });
  try {
    const r = await limit(worker.recognize(blob, {}, { blocks: true, text: false }), READ_LIMIT_MS, 'reading the words');
    return textOf((r.data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines)));
  } catch (e) {
    stop();
    throw e;
  }
}
