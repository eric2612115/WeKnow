// The hybrid decision, in plain code. Firebase AI Logic's hybrid SDK runs every step with an explicit mode (only on
// this device, or only in the cloud); WeKnow picks the mode, so nothing reaches the cloud by an automatic fallback.
// The router decides whether what the device produced is good enough, or whether a covered question should go to
// the cloud, and why. No model, no network, no UI: flows.ts asks it and acts.
//
//   route        - from what the device produced: escalate or not, and the reason
//   gate         - from the person's choice and the connection: go, ask first, or stay on the device
//   acceptChoice - what the cloud named, kept only when it is a ref in the index it was offered

import type { Internet } from '../store/prefs';
import type { IndexEntry } from '../core/knowledge';

export type { IndexEntry };

/** Why WeKnow moved to the cloud. Shown in every cloud receipt. */
export type Reason = 'no-device-model' | 'no-match' | 'unknown-picture' | 'no-guide' | 'none-chosen' | 'unknown-price';

/** What the device did with one question. */
export type DeviceResult =
  | {
      input: 'words';
      /** A pack item was picked on the device (by the on-device model or a confident plain match). */
      hit: boolean;
      /** Pack items plain search found for the words. */
      found: number;
      /** The on-device model was there to choose among them. */
      model: boolean;
      /** Words that name a job or a problem (ask/words.ts terms); 0 means there is nothing to look up. */
      words: number;
    }
  | {
      input: 'picture';
      /** Where the picture was read: on this device, or (no device model) the covered copy in the cloud. */
      ranOn: 'device' | 'cloud';
      /** The on-device model can read pictures. */
      model: boolean;
      kind?: 'quote' | 'bill' | 'problem' | 'unknown';
      /** For a problem: guides offered to the model, and whether it named one. */
      offered?: number;
      chosen?: boolean;
      words: number;
    }
  | {
      input: 'quote-lines';
      /** Lines the pack has no price for (only the ones that may leave: masked and well formed). */
      unknown: number;
    };

export interface Route {
  escalate: boolean;
  reason: Reason | null;
}

const stay: Route = { escalate: false, reason: null };
const go = (reason: Reason): Route => ({ escalate: true, reason });

/** Whether the device's answer is good enough, and if not, why the cloud should try. */
export function route(r: DeviceResult): Route {
  if (r.input === 'quote-lines') return r.unknown > 0 ? go('unknown-price') : stay;
  if (r.input === 'words') {
    // No confident pick on this device (the model named none, or without a model no name or alias was wholly in the
    // words, of the kind they lean to): the cloud sees the whole index instead.
    if (r.hit || r.words === 0) return stay;
    return go('no-match');
  }
  // A picture.
  if (r.ranOn === 'cloud') return stay; // already read in the cloud: the same reader is never asked twice
  if (!r.model) return go('no-device-model');
  if (r.words === 0) return stay; // nothing in words to send instead of the picture
  if (r.kind === 'unknown' || r.kind === undefined) return go('unknown-picture');
  if (r.kind === 'problem' && !r.chosen) return (r.offered ?? 0) > 0 ? go('none-chosen') : go('no-guide');
  return stay;
}

/** 'go': use the internet now. 'ask': show the sheet first. 'stay': answer from this device only. */
export type Gate = 'go' | 'ask' | 'stay';

export function gate(internet: Internet, online: boolean): Gate {
  if (!online || internet === 'never') return 'stay';
  return internet === 'auto' ? 'go' : 'ask';
}

/** What a choice on the consent sheet leaves the preference as. */
export function afterConsent(internet: Internet, answer: 'yes' | 'every' | 'no'): Internet {
  if (internet !== 'ask-once') return internet; // "every": the sheet is a yes or no for this time only
  return answer === 'yes' ? 'auto' : answer === 'every' ? 'every' : 'never';
}

/**
 * The cloud's choice, kept only when its ref is one of the index entries it was offered. The kind comes from the
 * index, never from the model. Anything else (an invented ref, a malformed answer) is no choice.
 */
export function acceptChoice(raw: unknown, index: readonly IndexEntry[]): IndexEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const ref = (raw as { ref?: unknown }).ref;
  if (typeof ref !== 'string' || !ref.trim()) return null;
  return index.find((e) => e.ref === ref.trim()) ?? null;
}
