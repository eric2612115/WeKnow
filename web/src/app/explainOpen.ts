// Opening "Explain in my language" from an answer on the Ask page, from a kept check, or from an email.

import { view } from '../ask/conversation';
import { dataStore, pictureBlob, type Check, type Family } from '../store/data';
import { openSheet } from '../ui/uiStore';

const KIND: Record<Family, string> = {
  quote: 'repair quote',
  bill: 'bill or letter',
  problem: 'household problem and how to fix it',
  email: 'email about a bill',
  other: 'paper',
};

/** The answer on the Ask page now. */
export async function explainCurrent() {
  const v = view();
  const check = v.kept ? dataStore.get().checks.find((c) => c.id === v.kept!.checkId) : undefined;
  let picture: Blob | undefined;
  if (v.still) picture = await fetch(v.still).then((r) => r.blob()).catch(() => undefined);
  openSheet({
    type: 'explain',
    key: `ask-${Date.now()}`,
    kind: KIND[check?.family ?? 'other'],
    verdict: v.head?.text ?? check?.verdict ?? '',
    sentences: check?.lines ?? v.lines.filter((l) => l.kind !== 'heard').map((l) => l.text),
    picture,
    pictureUrl: v.still ?? undefined,
    sentToCloud: v.receipt?.w === 'cloud',
  });
}

export async function explainCheck(c: Check) {
  const picture = c.pictureId ? await pictureBlob(c.pictureId) : undefined;
  openSheet({
    type: 'explain',
    key: `check-${c.id}-${Date.now()}`,
    kind: KIND[c.family],
    verdict: c.verdict,
    sentences: c.lines,
    picture,
    pictureUrl: picture ? URL.createObjectURL(picture) : undefined,
    sentToCloud: c.receipt.w === 'cloud',
  });
}

export function explainText(o: { kind: Family; verdict: string; sentences: string[] }) {
  openSheet({ type: 'explain', key: `text-${Date.now()}`, kind: KIND[o.kind], verdict: o.verdict, sentences: o.sentences, sentToCloud: false });
}
