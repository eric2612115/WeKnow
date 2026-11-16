// Sample pictures for anyone without a sink, a quote or a bill to hand. The quote and the bill are the labelled
// fixtures (fictional names and numbers); the sink is a drawing. Choosing one attaches it to the question box.

import quoteUrl from '../fixtures/quote-brakes.png';
import billUrl from '../fixtures/bill-changed-account.png';
import drainUrl from './assets/samples/drain.jpg';
import { attach, detach, startOver, view } from './ask/conversation';
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
  const blob = await fetch(s.url).then((r) => r.blob());
  showPicture(blob, id);
}

export function chooseFile(file: File) {
  if (!file.type.startsWith('image/')) return;
  showPicture(file);
}

function showPicture(blob: Blob, sample?: string) {
  startOver();
  attach(blob, sample);
}

export const backToCamera = detach;
