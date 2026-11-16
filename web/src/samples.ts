// Sample pictures for anyone without a sink, a quote or a bill to hand. The quote and the bill are the labelled
// fixtures (fictional names and numbers); the sink is a drawing. Choosing one attaches it to the question box.

import quoteUrl from '../fixtures/quote-brakes.png';
import billUrl from '../fixtures/bill-changed-account.png';
import drainUrl from './assets/samples/drain.jpg';
import { attach, detach, startOver, view, type Paper } from './ask/conversation';
import { isPdf, openPdf } from './pdf';
import { cannotTake } from './ask/flows';
import { setBox } from './ask/box';
import { t, type StringId } from './strings';

export interface Sample {
  id: 'drain' | 'quote' | 'bill';
  url: string;
  q: StringId;
}

export const SAMPLES: Sample[] = [
  { id: 'drain', url: drainUrl, q: 'welcome.q1' },
  { id: 'quote', url: quoteUrl, q: 'welcome.q2' },
  { id: 'bill', url: billUrl, q: 'welcome.q3' },
];

export const sampleQuestion = (s: Sample) => t(s.q);

/** The question a chosen sample picture asks by itself, if a sample is in the window. */
export function chosenSampleQuestion(): string | undefined {
  const id = view().chosen?.sample;
  const s = SAMPLES.find((x) => x.id === id);
  return s ? t(s.q) : undefined;
}

/** One press: attach the sample to the question box (it shows in the window) and put its question in the box,
 * ready for Send. Nothing is asked until Send. */
export async function attachSample(id: Sample['id']) {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) return;
  await chooseSample(id);
  setBox(t(s.q));
}

export async function chooseSample(id: Sample['id']) {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) return;
  opening++;
  const blob = await fetch(s.url).then((r) => r.blob());
  showPicture(blob, id);
}

/** A picture or a PDF this page can take (from Choose, a paste or a drop). */
export const canTake = (f: { type?: string; name?: string }) => !!f.type?.startsWith('image/') || isPdf(f);

let opening = 0;
/**
 * Attach a chosen, pasted or dropped file to the question box. A picture is attached as it is; a PDF is opened on
 * this device first (src/pdf.ts): its first pages become the picture, and its own text goes with it. Nothing is sent
 * anywhere until Send, and then only what the normal route decides. Resolves false when the file could not be taken.
 */
export async function chooseFile(file: File): Promise<boolean> {
  if (file.type.startsWith('image/')) {
    opening++;
    showPicture(file);
    return true;
  }
  if (!isPdf(file)) {
    cannotTake('type');
    return false;
  }
  const mine = ++opening;
  try {
    const pdf = await openPdf(file);
    if (mine !== opening) return false;
    showPicture(pdf.image, undefined, { text: pdf.text, hasText: pdf.hasText, pages: pdf.pages });
    return true;
  } catch (e) {
    console.warn('[WeKnow] could not open the PDF', e);
    if (mine === opening) cannotTake((e as { reason?: string })?.reason === 'locked' ? 'locked' : 'pdf');
    return false;
  }
}

function showPicture(blob: Blob, sample?: string, paper?: Paper) {
  startOver();
  attach(blob, sample, false, paper);
}

export const backToCamera = detach;
