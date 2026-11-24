// Plain-code verdicts. No model is involved past this point.

import type { Pack, PriceItem } from './packs';
import { priceByRef } from './packs';
import type { Understanding } from './understanding';
import type { BillMath } from './billMath';

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

export type BillFlag =
  | 'account-change-notice'
  | 'new-payee'
  | 'changed-account'
  | 'urgency'
  | 'instruction-to-ai'
  /** The printed amounts do not add up (core/billMath.ts). */
  | 'numbers-dont-add-up'
  /** Two different account numbers are labelled as the customer's (core/billMath.ts). */
  | 'two-accounts';

export interface BillVerdict {
  safe: boolean;
  flags: BillFlag[];
}

const URGENCY = /\b(urgent|immediately|today only|within 24 hours|final notice|act now|avoid (?:suspension|disconnection|penalt))/i;
const ACCOUNT_CHANGE = /\b(bank (?:has |have )?changed|new (?:bank|account)(?: details| number)?|changed (?:our )?(?:bank|account)|updated (?:bank|payment) (?:details|information))\b/i;
/** Words that put time pressure on the reader; the model's "urgent" counts only with one of them printed. */
const PRESSURE =
  /\b(urgent|immediate(?:ly)?|today|right away|asap|within \d+ (?:hours?|days?|business days?)|\d+ hours|final (?:notice|warning|reminder)|last (?:chance|notice|warning)|disconnect(?:ion|ed)?|shut ?off|suspen(?:d|ded|sion)|penalt(?:y|ies)|overdue|past due|deadline|legal action|collections?)\b/i;
/** Words about a new or changed account or bank; the model's "account changed" counts only with one printed. */
const CHANGE_CUE =
  /\b(?:new|changed|updated|different|replacement)\s+(?:[\w-]+\s+){0,2}(?:account|bank|routing|payment details)\b|\b(?:account|bank)\s+(?:[\w-]+\s+){0,3}(?:changed|updated|moved)\b|\breplaces?\s+(?:the|your)\s+(?:old\s+)?(?:\[?account)/i;
/** Words that speak to an AI or an automated reader; the model's "addressed to AI" counts only with one printed. */
const TO_A_READER =
  /\b(?:a\.?i\.?|al)\s+(?:assistants?|models?|readers?|systems?|tools?|agents?)\b|\b(?:artificial intelligence|chatbots?|language models?|llms?|automated (?:readers?|review|checks?|systems?)|assistants? reading|reading this (?:page|bill|letter|document)|(?:this|the) (?:bill|invoice|page) is (?:verified|safe|legitimate))\b|\bignore (?:all|any|previous|prior)\b/i;
const AI_INSTRUCTION =
  /\b(ignore (?:all|any|previous|prior)|disregard|you are (?:an? )?(?:ai|assistant|model)|as an ai|system prompt|mark (?:this|it) as (?:safe|paid|verified)|say (?:this|it) is (?:safe|fine|legit))/i;

/**
 * Judge a bill from the model's fixed form plus any masked text read on the device, using rules only.
 * Text inside the bill can raise flags; it can never clear one.
 */
export function billVerdict(u: Understanding, maskedText: string, known: KnownPayee[]): BillVerdict {
  const flags: BillFlag[] = [];
  // A letter that says the bank or account changed is the classic payment-redirection trick: always warn first.
  // With the paper's own words at hand, a warning the model raises needs a cue printed on the paper: Gemini Nano
  // raised "it rushes you" and "new account" on bills that print neither, in some runs and not others. Without the
  // words (a short text: only the model's own fields), the model's flag counts as it is.
  const printed = maskedText.length >= 200;
  const model = (flag: boolean, cue: RegExp) => flag && (!printed || cue.test(maskedText));
  if (model(u.accountChange, CHANGE_CUE) || ACCOUNT_CHANGE.test(maskedText)) flags.push('account-change-notice');
  const match = known.find((k) => u.payee && k.name.toLowerCase() === u.payee.toLowerCase());
  if (!match) flags.push('new-payee');
  else if (!u.payTo || u.payTo !== match.payTo) flags.push('changed-account');
  if (model(u.urgent, PRESSURE) || URGENCY.test(maskedText)) flags.push('urgency');
  if (model(u.addressedToAI, TO_A_READER) || AI_INSTRUCTION.test(maskedText)) flags.push('instruction-to-ai');
  return { safe: flags.length === 0, flags };
}

/**
 * Add the two plain-code checks on the bill's own words (core/billMath.ts) to a verdict. They can only add a
 * flag: every flag already raised stays, and a bill that was not safe never becomes safe.
 */
export function withBillMath(v: BillVerdict, m: BillMath | null | undefined): BillVerdict {
  if (!m) return v;
  const flags = [...v.flags];
  if (m.misses.length && !flags.includes('numbers-dont-add-up')) flags.push('numbers-dont-add-up');
  if (m.accounts.length >= 2 && !flags.includes('two-accounts')) flags.push('two-accounts');
  return { safe: v.safe && flags.length === v.flags.length, flags };
}
