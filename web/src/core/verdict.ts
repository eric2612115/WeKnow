// Plain-code verdicts. No model is involved past this point.

import type { Pack, PriceItem } from './packs';
import { priceByRef } from './packs';
import type { Understanding } from './understanding';

export type LineVerdict =
  | { kind: 'fair'; ref: string; amount: number; item: PriceItem }
  | { kind: 'high'; ref: string; amount: number; over: number; item: PriceItem }
  | { kind: 'low'; ref: string; amount: number; under: number; item: PriceItem }
  | { kind: 'unknown'; label: string; amount: number | null };

export function priceVerdict(amount: number, item: PriceItem): LineVerdict {
  if (amount > item.high) return { kind: 'high', ref: item.ref, amount, over: amount - item.high, item };
  if (amount < item.low) return { kind: 'low', ref: item.ref, amount, under: item.low - amount, item };
  return { kind: 'fair', ref: item.ref, amount, item };
}

export function quoteVerdicts(u: Understanding, pack: Pack): LineVerdict[] {
  return u.lines.map((line) => {
    const item = line.ref ? priceByRef(pack, line.ref) : undefined;
    if (!item || line.amount === null) return { kind: 'unknown', label: line.label, amount: line.amount };
    return priceVerdict(line.amount, item);
  });
}

// ---- Bills ----

export interface KnownPayee {
  name: string;
  payTo: string; // fingerprint the user confirmed before, e.g. last four digits
}

export type BillFlag = 'new-payee' | 'changed-account' | 'urgency' | 'instruction-to-ai';

export interface BillVerdict {
  safe: boolean;
  flags: BillFlag[];
}

const URGENCY = /\b(urgent|immediately|today only|within 24 hours|final notice|act now|avoid (?:suspension|disconnection|penalt))/i;
const AI_INSTRUCTION =
  /\b(ignore (?:all|any|previous|prior)|disregard|you are (?:an? )?(?:ai|assistant|model)|as an ai|system prompt|mark (?:this|it) as (?:safe|paid|verified)|say (?:this|it) is (?:safe|fine|legit))/i;

/**
 * Judge a bill from the model's fixed form plus any masked text read on the device, using rules only.
 * Text inside the bill can raise flags; it can never clear one.
 */
export function billVerdict(u: Understanding, maskedText: string, known: KnownPayee[]): BillVerdict {
  const flags: BillFlag[] = [];
  const match = known.find((k) => u.payee && k.name.toLowerCase() === u.payee.toLowerCase());
  if (!match) flags.push('new-payee');
  else if (!u.payTo || u.payTo !== match.payTo) flags.push('changed-account');
  if (u.urgent || URGENCY.test(maskedText)) flags.push('urgency');
  if (u.addressedToAI || AI_INSTRUCTION.test(maskedText)) flags.push('instruction-to-ai');
  return { safe: flags.length === 0, flags };
}
