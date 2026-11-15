// What the model is allowed to say about a photo, and the check that holds it to that.
// The model reads; the program decides. It may cite refs from the menu it was given, copy amounts that are
// printed on the photo, and nothing else.

export type DocKind = 'quote' | 'bill' | 'problem' | 'unknown';

export interface QuoteLine {
  label: string; // as printed, already masked on device
  amount: number | null; // as printed on the photo
  ref: string | null; // must be a menu ref, or null when the pack has no match
}

export interface Understanding {
  kind: DocKind;
  lines: QuoteLine[];
  problemRef: string | null; // for a household problem: a guide ref from the menu
  payee: string | null; // for a bill: who is asking to be paid, as printed
  payTo: string | null; // for a bill: masked account fingerprint, e.g. last four digits
}

/** JSON schema handed to Firebase AI Logic for structured output. */
export const understandingSchema = {
  type: 'object',
  properties: {
    kind: { type: 'string', enum: ['quote', 'bill', 'problem', 'unknown'] },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          amount: { type: 'number', nullable: true },
          ref: { type: 'string', nullable: true },
        },
        required: ['label', 'amount', 'ref'],
      },
    },
    problemRef: { type: 'string', nullable: true },
    payee: { type: 'string', nullable: true },
    payTo: { type: 'string', nullable: true },
  },
  required: ['kind', 'lines', 'problemRef', 'payee', 'payTo'],
} as const;

export class UnderstandingError extends Error {}

/**
 * Accept the model's answer only if every ref is one we offered and every amount is a plain number.
 * Anything else is rejected rather than repaired, so a confused or manipulated model cannot add data.
 */
export function checkUnderstanding(raw: unknown, offeredRefs: ReadonlySet<string>): Understanding {
  if (typeof raw !== 'object' || raw === null) throw new UnderstandingError('not an object');
  const u = raw as Record<string, unknown>;
  const kinds: DocKind[] = ['quote', 'bill', 'problem', 'unknown'];
  if (!kinds.includes(u.kind as DocKind)) throw new UnderstandingError(`bad kind ${String(u.kind)}`);
  if (!Array.isArray(u.lines)) throw new UnderstandingError('lines must be a list');
  const lines: QuoteLine[] = u.lines.map((l, i) => {
    const line = l as Record<string, unknown>;
    if (typeof line.label !== 'string') throw new UnderstandingError(`line ${i}: label`);
    const amount = line.amount;
    if (amount !== null && (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0)) {
      throw new UnderstandingError(`line ${i}: amount`);
    }
    const ref = line.ref;
    if (ref !== null && (typeof ref !== 'string' || !offeredRefs.has(ref))) {
      throw new UnderstandingError(`line ${i}: ref ${String(ref)} was not offered`);
    }
    return { label: line.label, amount: amount as number | null, ref: ref as string | null };
  });
  const problemRef = u.problemRef ?? null;
  if (problemRef !== null && (typeof problemRef !== 'string' || !offeredRefs.has(problemRef))) {
    throw new UnderstandingError(`problemRef ${String(problemRef)} was not offered`);
  }
  const str = (v: unknown) => (v === null || v === undefined ? null : typeof v === 'string' ? v : undefined);
  const payee = str(u.payee);
  const payTo = str(u.payTo);
  if (payee === undefined || payTo === undefined) throw new UnderstandingError('payee/payTo must be text');
  return { kind: u.kind as DocKind, lines, problemRef: problemRef as string | null, payee, payTo };
}
