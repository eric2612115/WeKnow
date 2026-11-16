// Moving a question in words to the cloud, safely. The words are covered on this device first (maskText); then the
// payload guard (core/cloudPayload.ts) scans the exact outgoing text, and where this device has a model, that model
// reviews it too. If either finds a personal detail, nothing is sent. Otherwise the cloud sees the covered words and
// the whole pack index and may only name a ref from it (router.acceptChoice); the answer then comes from the pack.

import { buildCloudQuestion, CloudPayloadError } from '../core/cloudPayload';
import { findPII, maskText, type PIIKind } from '../core/pii';
import { acceptChoice, type IndexEntry } from './router';

export interface EscalateDeps {
  /** The whole pack index (every guide and price ref and name). */
  index(): Promise<IndexEntry[]>;
  /** The on-device review; absent when this device has no model. True means personal data is still there. */
  review?(text: string): Promise<boolean>;
  /** The cloud call: the covered words and the index go, the model's raw answer comes back. */
  cloud(text: string, index: IndexEntry[]): Promise<{ raw: unknown; ms: number; model: string }>;
}

export type Escalation =
  | { kind: 'found'; entry: IndexEntry; sent: string; offered: number; ms: number; model: string; reviewed: boolean }
  | { kind: 'none'; sent: string; offered: number; ms: number; model: string; reviewed: boolean }
  /** Nothing was sent: the guard or the on-device review still saw a personal detail. */
  | { kind: 'blocked'; by: 'guard' | 'review'; found: PIIKind[] }
  /** Nothing was sent: the pack index could not be read. */
  | { kind: 'no-index' };

/** The person's words as they may leave: every personal detail replaced by a token such as [phone]. */
export function coverWords(question: string): { text: string; counts: Partial<Record<PIIKind, number>> } {
  const counts: Partial<Record<PIIKind, number>> = {};
  for (const h of findPII(question)) counts[h.kind] = (counts[h.kind] ?? 0) + 1;
  return { text: maskText(question).replace(/\s+/g, ' ').trim().slice(0, 300), counts };
}

/**
 * Send covered words to the cloud to be placed in the pack index. `covered` must be what coverWords returned (or
 * any text: the guard refuses it if a personal pattern is still in it). The cloud is called at most once.
 */
export async function escalate(covered: string, deps: EscalateDeps): Promise<Escalation> {
  let text: string;
  try {
    text = buildCloudQuestion({ text: covered }).text;
  } catch (e) {
    if (!(e instanceof CloudPayloadError)) throw e;
    return { kind: 'blocked', by: 'guard', found: [...new Set(findPII(covered).map((h) => h.kind))] };
  }
  let reviewed = false;
  if (deps.review) {
    let flagged = false;
    try {
      flagged = await deps.review(text);
      reviewed = true;
    } catch (e) {
      // The plain-code guard already passed; a review that could not run does not hold the question back.
      console.warn('[WeKnow] on-device review could not run; the guard passed', e);
    }
    if (flagged) return { kind: 'blocked', by: 'review', found: [] };
  }
  const index = await deps.index();
  if (!index.length) return { kind: 'no-index' };
  const r = await deps.cloud(text, index);
  const entry = acceptChoice(r.raw, index);
  const base = { sent: text, offered: index.length, ms: r.ms, model: r.model, reviewed };
  return entry ? { kind: 'found', entry, ...base } : { kind: 'none', ...base };
}
