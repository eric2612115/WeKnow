// Turning plain-code verdicts into what WeKnow shows and says. No model is involved here: every number comes
// from the pack item a line matched (core/verdict.ts), and every sentence is a whole string from strings.ts.

import type { BillFlag, BillVerdict, KnownPayee, LineVerdict } from '../core/verdict';
import type { Guide, Pack, PriceItem } from '../core/packs';
import type { PIIKind } from '../core/pii';
import type { BillMath, SumMiss } from '../core/billMath';
import { t, words, money, cents, longDate, type StringId } from '../strings';
import type { LineItem, Receipt, SourceRow, Verdict, WhereRan } from './types';

// ---------- quotes ----------

/** One row per printed line: the label as printed, the amount as printed, the verdict from the pack. */
export function lineItems(verdicts: LineVerdict[], labels: string[]): LineItem[] {
  return verdicts.map((v, i) => {
    const n = i + 1;
    if (v.kind === 'unknown') return { n, label: v.label, amount: v.amount, state: 'pending' as const };
    const base = { n, label: labels[i] ?? v.item.name, amount: v.amount, typical: v.item.typical, top: v.item.high, name: v.item.name };
    if (v.kind === 'high') return { ...base, state: 'high' as const, over: v.over };
    if (v.kind === 'low') return { ...base, state: 'low' as const };
    return { ...base, state: 'fair' as const };
  });
}

const COVER_ORDER: PIIKind[] = ['name', 'phone', 'email', 'street', 'account', 'card', 'ssn', 'plate', 'vin'];
/** "2 names, 1 phone number, 1 account number" (with `and` before the last when it is said). Empty when none. */
export function coveredList(counts: Partial<Record<PIIKind, number>>, said = false): string {
  const parts = COVER_ORDER.filter((k) => counts[k]).map((k) => t(`cover.${k}${counts[k] === 1 ? '' : '.many'}` as StringId, { n: counts[k] ?? 0 }));
  if (!said || parts.length < 2) return parts.join(', ');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** A label as it is said: printed asides such as "(parts + labor)" are left out of the sentence, not the screen. */
export const spoken = (s: string) => lower(s.replace(/\s*\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim() || s);
export function listNames(names: string[]): string {
  const ns = names.map(lower);
  if (ns.length <= 1) return ns[0] ?? '';
  return `${ns.slice(0, -1).join(', ')} and ${ns[ns.length - 1]}`;
}

/** "I know seven lines. One I do not: brake fluid flush." */
export function knownSentences(items: LineItem[]): string[] {
  const pending = items.filter((i) => i.state === 'pending');
  const known = items.length - pending.length;
  if (!pending.length) return [items.length === 1 ? t('quote.know.all.1') : t('quote.know.all', { n: words(items.length) })];
  const first = known === 0 ? t('quote.know.0') : known === 1 ? t('quote.know.1') : t('quote.know.n', { n: words(known) });
  if (known === 0) return [first];
  const names = listNames(pending.map((p) => p.label));
  const second = pending.length === 1 ? t('quote.dont.1', { names }) : t('quote.dont.n', { n: words(pending.length, true), names });
  return [first, second];
}

const isKnown = (i: LineItem) => i.state !== 'pending';

export interface QuoteSummary {
  verdict: Verdict;
  sentences: string[];
  /** The line to talk about with the shop: the one furthest above the usual top. */
  worst?: LineItem;
}

export function quoteSummary(items: LineItem[]): QuoteSummary {
  if (!items.length) return { verdict: { tone: 'plain', text: t('quote.small.title') }, sentences: [t('quote.small')] };
  const highs = items.filter((i) => i.state === 'high').sort((a, b) => (b.over ?? 0) - (a.over ?? 0));
  const fair = items.filter((i) => i.state === 'fair' || i.state === 'found' || i.state === 'low').length;
  const pending = items.filter((i) => i.state === 'pending').length;
  if (!items.some(isKnown)) return { verdict: { tone: 'plain', text: t('quote.none.title') }, sentences: [t('quote.none.line')] };

  const fairSentence = fair === 1 ? t('quote.fair.1') : t('quote.fair.n', { n: words(fair, true) });
  const pendingSentence = pending === 1 ? t('quote.pending.1') : t('quote.pending.n', { n: words(pending, true) });
  const lows = items.filter((i) => i.state === 'low').slice(0, 1).map((l) => t('quote.low', { n: l.n, label: spoken(l.label) }));

  if (highs.length) {
    const worst = highs[0];
    const sentences = highs
      .slice(0, 2)
      .map((h) => t('quote.high.1', { n: h.n, label: spoken(h.label), amount: money(h.amount ?? 0), over: money(h.over ?? 0), top: money(h.top ?? 0) }));
    const typical = t('quote.typical', { typical: money(worst.typical ?? 0) });
    if (!pending && fair === items.length - highs.length && fair > 0) sentences.push(t('quote.high.2', { typical: money(worst.typical ?? 0) }));
    else sentences.push([typical, fair ? fairSentence : '', pending ? pendingSentence : ''].filter(Boolean).join(' '));
    return {
      verdict: { tone: 'warn', text: highs.length === 1 ? t('quote.high.title', { n: worst.n, over: money(worst.over ?? 0) }) : t('quote.highs.title', { n: words(highs.length, true) }) },
      sentences: [...sentences, ...lows],
      worst,
    };
  }
  const sentences = pending ? [`${fairSentence} ${pendingSentence}`] : [t('quote.fair.all')];
  return { verdict: { tone: 'ok', text: t('quote.fair.title') }, sentences: [...sentences, ...lows] };
}

export function sayToShop(worst: LineItem): string {
  return t('quote.say.line', { label: spoken(worst.label), typical: money(worst.typical ?? 0) });
}

export function quoteTitle(items: LineItem[], shop: string | null): string {
  const total = items.reduce((s, i) => s + (i.amount ?? 0), 0);
  const name = shop && !/\[/.test(shop) ? `${shop} quote` : 'Repair quote';
  return total > 0 ? `${name}, ${money(total)}` : name;
}

// ---------- bills ----------

export interface BillAnswer {
  verdict: Verdict;
  /** Numbered reasons ("One. ..."), one may come from a note. */
  reasons: Array<{ text: string; fromNote?: boolean }>;
  doLine?: string;
}

// A letter announcing a new bank or account is said first and plainly; then anything else that is wrong.
const ORDER: BillFlag[] = ['account-change-notice', 'changed-account', 'numbers-dont-add-up', 'two-accounts', 'instruction-to-ai', 'new-payee', 'urgency'];
const STOP: BillFlag[] = ['account-change-notice', 'changed-account', 'numbers-dont-add-up', 'instruction-to-ai'];

/** One relation that did not hold, said plainly with its numbers. */
export function sumWhy(m: SumMiss): string {
  if (m.rule === 'tax' && m.discount)
    return t('math.why.tax.discount', { subtotal: cents(m.subtotal), discount: cents(m.discount), tax: cents(m.tax), sum: cents(m.expected), total: cents(m.total) });
  if (m.rule === 'tax') return t('math.why.tax', { subtotal: cents(m.subtotal), tax: cents(m.tax), sum: cents(m.expected), total: cents(m.total) });
  if (m.rule === 'balance')
    return t('math.why.balance', { previous: cents(m.previous), paid: cents(m.paid), charges: cents(m.charges), sum: cents(m.expected), due: cents(m.due) });
  return t('math.why.paid', { total: cents(m.total), paid: cents(m.paid), sum: cents(m.expected), due: cents(m.due) });
}

/** "The numbers on this bill don’t add up: ..." Undefined when they do (or nothing could be checked). */
export function sumSentence(m: BillMath | null | undefined): string | undefined {
  return m?.misses.length ? t('letter.sign.sum', { why: sumWhy(m.misses[0]) }) : undefined;
}

/** "This bill shows two different account numbers (ending 1234 and 5678). ..." Last four digits only. */
export function accountsSentence(m: BillMath | null | undefined): string | undefined {
  return m && m.accounts.length >= 2 ? t('letter.sign.twoacct', { a: m.accounts[0], b: m.accounts[1] }) : undefined;
}

/** The amounts behind "the numbers don’t add up", one per line, for "Which numbers?". */
export function sumLines(m: BillMath): string[] {
  const miss = m.misses[0];
  if (!miss) return [];
  const row = (id: StringId, n: number) => t(id, { amount: cents(n) });
  const rows =
    miss.rule === 'tax'
      ? [row('math.row.subtotal', miss.subtotal), ...(miss.discount ? [row('math.row.discount', miss.discount)] : []), row('math.row.tax', miss.tax), row('math.row.total', miss.total)]
      : miss.rule === 'balance'
        ? [row('math.row.previous', miss.previous), row('math.row.paid', miss.paid), row('math.row.charges', miss.charges), row('math.row.due', miss.due)]
        : [row('math.row.total', miss.total), row('math.row.paid', miss.paid), row('math.row.due', miss.due)];
  const said = miss.rule === 'tax' ? miss.total : miss.due;
  return [...rows, t('math.row.sum', { sum: cents(miss.expected), said: cents(said) }), t('math.row.do')];
}

/** A name inside a sentence never breaks at its hyphen ("Co-op"). */
export const keepTogether = (s: string) => s.replace(/(\w)-(\w)/g, '$1\u2011$2');

export function billAnswer(v: BillVerdict, payee: string | null, known: KnownPayee[], payTo: string | null = null, math?: BillMath | null): BillAnswer {
  const match = known.find((k) => payee && k.name.toLowerCase() === payee.toLowerCase());
  const digits = (payTo ?? '').replace(/\D/g, '');
  const has = (f: BillFlag) => v.flags.includes(f);
  const raw: Array<{ text: string; fromNote?: boolean }> = [];
  for (const f of ORDER.filter(has)) {
    if (f === 'account-change-notice')
      raw.push({ text: digits.length === 4 ? t('letter.sign.notice.digits', { digits }) : t('letter.sign.notice') });
    if (f === 'changed-account') {
      if (match) raw.push({ text: t('note.payee', { old: match.payTo }), fromNote: true });
      else if (!has('account-change-notice')) raw.push({ text: t('letter.sign.account') });
    }
    if (f === 'numbers-dont-add-up') raw.push({ text: sumSentence(math) ?? t('letter.sign.sum.plain') });
    if (f === 'two-accounts') raw.push({ text: accountsSentence(math) ?? t('letter.sign.twoacct.plain') });
    if (f === 'instruction-to-ai') raw.push({ text: t('letter.sign.ai') });
    if (f === 'new-payee') raw.push({ text: payee ? t('letter.sign.newpayee', { payee: keepTogether(payee) }) : t('letter.sign.nopayee') });
    if (f === 'urgency') raw.push({ text: t('letter.sign.rush') });
  }
  if (v.safe) return { verdict: { tone: 'ok', text: t('letter.fine.title') }, reasons: [{ text: t('letter.fine') }] };
  const stop = STOP.some(has);
  const reasons = raw.map((r, i) => ({ ...r, text: `${words(i + 1, true)}. ${r.text}` }));
  return {
    verdict: { tone: stop ? 'stop' : 'warn', text: stop ? t('letter.stop.title') : t('letter.check.title') },
    reasons,
    doLine: t('letter.do'),
  };
}

// ---------- guides ----------

export function minutesText(g: Guide): string {
  const [lo, hi] = g.minutes;
  return lo === hi ? String(lo) : t('fix.minutes', { low: lo, high: hi });
}

export function proLine(pack: Pack, g: Guide, pro: { low: number; high: number } | undefined): string | null {
  if (!pro) return null;
  const items = (g.proRefs ?? []).map((r) => pack.prices.find((p) => p.ref === r)).filter((p): p is PriceItem => !!p);
  const typical = items.length ? Math.round(items.reduce((s, i) => s + i.typical, 0) / items.length) : Math.round((pro.low + pro.high) / 2);
  return t('guide.pro.line', { low: money(pro.low), high: money(pro.high), typical: money(typical) });
}

// ---------- where it ran ----------

export function whereRan(o: { where: 'device' | 'cloud'; online: boolean; sent: number; pending: number }): WhereRan {
  if (o.where === 'cloud') return 'cloud';
  if (o.pending > 0) return 'pending';
  if (o.sent > 0) return 'mixed';
  if (!o.online) return 'offline';
  return 'local';
}

export function tagText(r: Pick<Receipt, 'w' | 'n'>, device: string): string {
  switch (r.w) {
    case 'local':
      return t('tag.local', { device });
    case 'mixed':
      return r.n === 1 ? t('tag.mixed', { n: 1 }) : t('tag.mixed.many', { n: r.n });
    case 'cloud':
      return t('tag.cloud');
    case 'offline':
      return t('tag.offline', { device });
    case 'pending':
      return r.n === 1 ? t('tag.pending', { n: 1 }) : t('tag.pending.many', { n: r.n });
  }
}

/** Sources named by kind and date; the addresses go inside Technical details. */
export function priceSources(items: PriceItem[]): SourceRow[] {
  // Every item an answer used is listed (it was cut at six, so the lines after the sixth showed no source).
  return items.filter((p, i, all) => all.findIndex((q) => q.ref === p.ref) === i).map((p) => {
    const fetched = p.sources.map((s) => s.fetched).filter(Boolean).sort().pop();
    return {
      // A price looked up on the web for a line the book did not have is named as that, never as the price book.
      label: p.ref.startsWith('learned-') ? t('where.src.web', { name: p.name }) : t('where.src.price', { name: p.name }),
      date: fetched ? t('where.checked', { date: longDate(fetched) }) : '',
      url: p.sources[0]?.url,
      title: p.sources[0]?.title,
    };
  });
}

export function guideSources(g: Guide): SourceRow[] {
  const fetched = g.sources.map((s) => s.fetched).filter(Boolean).sort().pop();
  return [{ label: t('where.src.guide', { name: g.name }), date: fetched ? t('where.checked', { date: longDate(fetched) }) : '', url: g.sources[0]?.url, title: g.sources[0]?.title }];
}
