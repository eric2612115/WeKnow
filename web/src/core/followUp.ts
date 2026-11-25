// The plain code around a follow-up answered by the model on this device (thread.ts): what the model is given (the
// conversation since the paper it is about, as the person saw it), when a follow-up goes to it, and which replies are
// kept. The model explains; it never decides. A reply that brings a number the conversation does not have, or that
// clears a warning, is not shown.

import type { LineItem, Tone } from '../answer/types';

export interface Turn {
  who: 'me' | 'wk';
  text: string;
  picture?: boolean;
  tone?: Tone | null;
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** One quote line spelled out, so a small model cannot mix up the price and how far above usual it is. */
export function lineText(i: LineItem): string {
  let out = `Line ${i.n}, ${i.label}: the shop charges ${i.amount === null ? 'no amount' : money(i.amount)}.`;
  if (i.typical || i.top) out += ` Most shops charge about ${money(i.typical ?? i.top ?? 0)}${i.top ? `, at most about ${money(i.top)}` : ''}.`;
  if (i.state === 'high') out += ` That is ${money(i.over ?? 0)} above the usual top price.`;
  else if (i.state === 'pending') out += ' This line is not in the price book yet.';
  else if (i.state === 'low') out += ' That is below the usual price.';
  else if (i.state === 'found') out += ' Its usual price was looked up online.';
  else out += ' That is a usual price.';
  return out;
}

/**
 * The conversation the follow-up is about: the turns since the last picture or paper (or the last few turns when
 * there was none), oldest first, at most about 2000 characters. `turns` ends with the turn before the new question.
 */
export function conversationText(turns: Turn[]): string {
  const out: string[] = [];
  let size = 0;
  for (let i = turns.length - 1; i >= 0 && size < 2000; i--) {
    const m = turns[i];
    const line = m.who === 'me' ? `Person: ${m.text}${m.picture ? ' (with a picture of a paper)' : ''}` : `WeKnow: ${m.text}`;
    out.unshift(line);
    size += line.length + 1;
    if (m.who === 'me' && m.picture) break;
  }
  return out.join('\n').slice(-2000);
}

/** Words that point back at what was just said, rather than naming something new. */
const POINTS_BACK =
  /\b(why|explain|what does|what do|what is|what's|whats|which|who|whom|where|when|how come|mean|means|meant|line \d+|tell me more|more about|that|it|this|these|those|they|them|their|the company|the bill|the quote|the account|the shop)\b/i;

export function pointsBack(question: string): boolean {
  return POINTS_BACK.test(question);
}

/**
 * The sentences of the model's reply that may be shown, after a leading "WeKnow:" is taken off: each one passes
 * keepReply on its own, so one bad sentence ("It is a scam.") does not cost the rest.
 */
export function keptSentences(conversation: string, question: string, reply: string, warned: boolean): string[] {
  const same = (a: string) => a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return reply
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.replace(/^\s*WeKnow:\s*/i, '').trim())
    .filter((x) => x && same(x) !== same(question) && keepReply(conversation, question, x, warned))
    .slice(0, 3);
}

/** A yes-or-no question ("Can I bring my own parts?"): the model may not guess its answer. */
export function yesNo(question: string): boolean {
  return /^\s*(can|could|do|does|did|is|are|was|were|will|would|should|may|might|have|has)\b/i.test(question);
}

/** A question about the answer itself ("Why?", "What does line 4 mean?"): asked of the conversation before anything else. */
const ABOUT_ANSWER = /\b(why|explain|what does|what do|mean|means|meant|which|who|whom|how come|line \d+|tell me more|more about|what if|is it real|are they real|scam|fake|fraud|legit)\b/i;

export function aboutTheAnswer(question: string): boolean {
  return ABOUT_ANSWER.test(question);
}

/** Words about the paper being talked about (paying it, its company or shop, its lines). */
const ABOUT_PAPER = /\b(pay|paid|paying|payment|money|account|bank|company|call|bill|due|late|fee|fees|half|refund|dispute|it|this|that|they|them|their|shop|line|lines|parts|labor|discount|warranty|total|price|quote|charge|charged)\b/i;

export function aboutThePaper(question: string): boolean {
  return ABOUT_ANSWER.test(question) || ABOUT_PAPER.test(question);
}

const CLEARS = /\b(safe|fine|ok(?:ay)?|all right|alright|legit(?:imate)?)\s+to\s+pay\b|\byou can (?:go ahead and )?pay\b|\bgo ahead and pay\b|\bnothing (?:is )?wrong\b|\bnot a scam\b|\bno need to worry\b/i;

/**
 * Whether the model's reply may be shown. Every number in it must be one the conversation or the question has (a
 * count up to 9 is fine), and after a warning it may not say the paper is fine to pay.
 */
export function keepReply(conversation: string, question: string, reply: string, warned: boolean): boolean {
  const text = reply.trim();
  if (!text || text.length < 2) return false;
  const numbers = (s: string) => (s.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/,/g, '').replace(/\.$/, '').replace(/\.0+$/, ''));
  const have = new Set(numbers(`${conversation} ${question}`));
  if (!numbers(text).every((n) => have.has(n) || (/^\d$/.test(n) && Number(n) <= 9))) return false;
  if (warned && CLEARS.test(text)) return false;
  // "It is a scam" only when the conversation said so.
  if (/\b(is|it's|its) (a |definitely a )?scam\b/i.test(text) && !/scam/i.test(conversation)) return false;
  return true;
}

// ---------- the common follow-ups, answered by plain code from the last answer ----------
// A small model on a device explains unevenly ("Because the account is new", "Yes, it is a scam"), so the questions
// people ask most are answered from WeKnow's own words. The model only gets what is left.

/** What a warning sign means, in plain words, keyed by words of the reason WeKnow gave. */
const MEANS: Array<[RegExp, string]> = [
  [/\b(new account|account is new|account changed|bank has changed|account ending)\b/i, 'It means the bill asks you to pay a bank account they never used with you before. If the company did not tell you itself, the money may go to someone else.'],
  [/\b(hidden words|tell a reader|aimed at an ai|to an ai|talk(s)? to an ai)\b/i, 'It means the paper has words written for a computer that reads it, telling it the bill is fine. A real bill has no reason to talk to a computer.'],
  [/\b(rush|rushes|hurry|within 24 hours|right away|today)\b/i, 'It means it pushes you to pay fast, so you don’t stop to check. A real company gives you time.'],
  [/\b(don.t add up|do not add up|numbers)\b/i, 'It means the amounts on the paper don’t match: the parts don’t add up to what it asks you to pay.'],
  [/\b(two account|two different account)\b/i, 'It means the paper shows two different accounts to pay. Ask the company which one is theirs.'],
];

/** The reasons in WeKnow's answer ("One. … Two. …"), as plain sentences. */
export function reasonsIn(answer: string): string[] {
  const parts = answer.split(/\b(?:One|Two|Three|Four|Five)\.\s+/).slice(1);
  return parts
    .map((p) => p.split(/(?<=\.)\s+(?=(?:I found|I covered|Call |I also|Your |Nothing))/)[0].trim())
    .filter(Boolean);
}

// "It rushes you" → "it rushes you"; "I have no note" and names keep their capital.
const NONE_FOUND =
  'I found none of the warning signs I look for: a new or changed account, words that rush you, words written for a computer, or numbers that don’t add up.';

const lower1 = (s: string) => (/^(I\b|[A-Z][a-z]*[A-Z])/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/**
 * A plain-code answer to a common follow-up about the last bill or quote, or null when the model should try.
 * `answer` is WeKnow's last answer as one text; `items` its quote lines.
 */
export function planAnswer(question: string, kind: 'bill' | 'quote', answer: string, items: LineItem[] = []): string[] | null {
  const q = question.toLowerCase();
  if (kind === 'quote') {
    const n = q.match(/\bline (\d+)\b/)?.[1];
    const line = n ? items.find((i) => i.n === Number(n)) : null;
    if (line) return [lineText(line)];
    if (/\bwhich\b.*\b(fine|fair|ok|okay|good|normal)\b|\b(fine|fair) ones\b/.test(q)) {
      const fine = items.filter((i) => i.state === 'fair' || i.state === 'low' || i.state === 'found');
      return fine.length ? [`These lines look fair: ${fine.map((i) => `line ${i.n}, ${i.label}`).join('; ')}.`] : ['None of the lines I could check looks fair.'];
    }
    if (/\bwhy\b|\bhow come\b|\bso (high|much|expensive)\b/.test(q)) {
      const high = items.filter((i) => i.state === 'high');
      if (high.length) return high.map(lineText);
    }
    return null;
  }
  const reasons = reasonsIn(answer);
  const scamOnline = /known scam/i.test(answer);
  // A bill with no warning signs: say so, without calling it safe.
  if (!reasons.length && !scamOnline) {
    if (/\bscam\b|\bfake\b|\bfraud\b|\blegit|\bis (it|this|that|the company) real\b/.test(q)) {
      return [NONE_FOUND, 'I can’t promise anything about the company itself. If you are unsure, ask them.'];
    }
    if (/\bwhy\b|\bhow come\b|\breason/.test(q)) return [`Because ${NONE_FOUND}`];
    return null;
  }
  if (/\bscam\b|\bfake\b|\bfraud\b|\blegit|\bis (it|this|that|the company) real\b/.test(q)) {
    if (scamOnline) return ['I checked it online: charges like these are a known scam. Don’t pay it, and don’t call the numbers on this paper.'];
    if (!reasons.length) return null;
    return [
      'I can’t say for sure from the paper alone. These are the warning signs I found:',
      ...reasons.map((r) => `${r.replace(/\.$/, '')}.`),
      'Don’t pay until you call the company on a number you already trust.',
    ];
  }
  if (/\bmean|\bwhat (is|does|do)\b/.test(q)) {
    const hit = MEANS.find(([re]) => re.test(q));
    if (hit) return [hit[1]];
  }
  if (/\bwhy\b|\bhow come\b|\breason/.test(q) && reasons.length) {
    return [`Because ${reasons.map((r) => lower1(r.replace(/\.$/, ''))).join('; and ')}.`, 'Any one of these is a reason to check with the company before you pay.'];
  }
  return null;
}
