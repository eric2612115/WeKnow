// Sample pictures for anyone without a sink, a quote or a bill to hand. The quote and the bill are the labelled
// fixtures (fictional names and numbers); the sink is a drawing. Choosing one puts it in the camera window.

import quoteUrl from '../fixtures/quote-brakes.png';
import billUrl from '../fixtures/bill-changed-account.png';
import drainUrl from './assets/samples/drain.jpg';
import { patch, view } from './ask/conversation';
import { startAsk } from './ask/flows';
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

/** One press: put the sample in the window and ask its own question at once (no listening). */
export async function askSample(id: Sample['id']) {
  const s = SAMPLES.find((x) => x.id === id);
  if (!s) return;
  await chooseSample(id);
  startAsk(t(s.q));
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
  const old = view().chosen;
  if (old) URL.revokeObjectURL(old.url);
  const url = URL.createObjectURL(blob);
  patch({ chosen: { url, blob, sample }, still: null, looking: false, dim: false });
}

export function backToCamera() {
  const old = view().chosen;
  if (old) URL.revokeObjectURL(old.url);
  patch({ chosen: null, still: null, looking: false });
}
