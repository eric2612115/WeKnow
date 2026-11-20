// Recent bills in the person's email, read only. Each message was masked on this device when it was fetched
// (gmail.ts). Checking one reads its words into the bill form (on this device when it can; otherwise over the
// internet, after a yes that shows the exact words) and judges it with the same rules as a photographed bill.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { MailItem } from '../gmail';
import { billVerdict, withBillMath } from '../core/verdict';
import { billMath } from '../core/billMath';
import { knownPayees } from '../core/memory';
import { basicBill } from '../core/basicRead';
import { coverPaperText } from '../core/paperText';
import { billAnswer, type BillAnswer } from '../answer/compose';
import type { Receipt } from '../answer/types';
import { mailState, useMail } from '../engine/mailState';
import { appSettings } from '../engine/knowledge';
import { deviceStore, deviceWord } from '../engine/device';
import { addCheck, dataStore } from '../store/data';
import { Card, PageTitle, VerdictBand } from '../ui/controls';
import { I } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { WhereTag, ReceiptFull } from '../ui/Receipt';
import { t, shortDate } from '../strings';
import { explainText } from '../app/explainOpen';

interface Judged {
  answer: BillAnswer;
  receipt: Receipt;
}

export default function Mail() {
  const m = useMail();
  const device = deviceWord();
  const [busy, setBusy] = useState<string | null>(null);
  const [judged, setJudged] = useState<Record<string, Judged>>({});
  const [details, setDetails] = useState<Receipt | null>(null);

  useEffect(() => {
    if (m.connected && !m.items && !m.loading) void mailState.load();
  }, [m.connected, m.items, m.loading]);

  const check = async (item: MailItem) => {
    setBusy(item.id);
    try {
      const { readMailText, mailPayload } = await import('../textReader');
      const s = await appSettings();
      // An email is read on this device or not at all: by its built-in model when it has one, otherwise by plain
      // code (the basic check, core/basicRead.ts). Its words are never sent to be read.
      const basic = deviceStore.get().model !== 'available';
      const mail = `${item.subject}\n${item.text}`;
      const r = basic
        ? { understanding: basicBill(coverPaperText(mail).text.split('\n'), knownPayees(dataStore.get().memory).map((k) => k.name)), ms: 0, masked: mailPayload(mail) }
        : await readMailText(mail, 'device', s.cloudModel);
      const u = r.understanding;
      const known = knownPayees(dataStore.get().memory);
      let v = billVerdict(u, r.masked, known);
      const { matchesPhrase } = await import('../config');
      if (!v.flags.includes('urgency') && matchesPhrase(r.masked, s.urgencyPhrases)) v = { safe: false, flags: [...v.flags, 'urgency'] };
      // The same plain-code check as a paper bill: printed sums that do not hold (on the covered words, on this device).
      const math = billMath(`${item.subject}\n${item.text}`);
      v = withBillMath(v, math);
      const payee = u.payee && !/\[/.test(u.payee) ? u.payee : null;
      const answer = billAnswer(v, payee, known, null, math);
      const receipt: Receipt = {
        w: 'local',
        n: 0,
        stayed: [t('where.mail'), t('where.covered.letter')],
        sent: [],
        sources: [{ label: t('where.src.rules', { device }), date: '' }],
        tech: [
          basic
            ? `Basic check: this ${device} has no built-in model, so the email's words were checked by plain code alone. Nothing was sent to be read.`
            : `Read by the built-in model on this ${device} in ${(r.ms / 1000).toFixed(1)} s.`,
          `Bill flags: ${v.flags.join(', ') || 'none'}. ${r.masked.length} characters of covered text.`,
        ],
      };
      setJudged((j) => ({ ...j, [item.id]: { answer, receipt } }));
      const lines = [...answer.reasons.map((x) => x.text), ...(answer.doLine ? [answer.doLine] : []), ...(basic ? [t('basic.note', { device })] : [])];
      await addCheck({
        kind: 'Email',
        family: 'email',
        title: item.subject || t('kind.Email'),
        tone: answer.verdict.tone,
        verdict: answer.verdict.text,
        question: t('hear.q4'),
        lines,
        receipt,
      });
    } catch (e) {
      console.warn('[WeKnow] email check', e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[46rem]">
        <PageTitle>{t('mail.title')}</PageTitle>
        <p className="mb-4 text-small text-ink-2">{t('mail.line', { device })}</p>
        {!m.connected && (
          <Card>
            <p className="text-body font-semibold">{t('mail.connect.first')}</p>
            <Link to="/settings#set-mail" className="btn btn-yes mt-4">
              <I.mail />
              {t('set.mail')}
            </Link>
          </Card>
        )}
        {m.error && <p className="mb-4 text-small text-ink-2">{m.error}</p>}
        {m.connected && m.loading && <p className="text-small text-ink-2">{t('mail.loading', { device })}</p>}
        {m.connected && m.items && !m.items.length && <p className="text-small text-ink-2">{t('mail.empty')}</p>}
        <div className="grid gap-[0.8rem]">
          {m.items?.map((item) => {
            const j = judged[item.id];
            return (
              <Card key={item.id} as="div">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid min-w-0 flex-1 gap-1">
                    <b className="text-body leading-tight font-bold">{item.subject}</b>
                    <span className="text-small text-ink-2">
                      {item.from}, {shortDate(item.date)}
                    </span>
                  </div>
                  {!j && (
                    <button type="button" className="btn btn-sm" disabled={!!busy} onClick={() => void check(item)}>
                      {busy === item.id ? t('look.paper') : t('mail.check')}
                    </button>
                  )}
                </div>
                {j && (
                  <div className="mt-4 grid gap-2">
                    <VerdictBand tone={j.answer.verdict.tone} text={j.answer.verdict.text} />
                    {j.answer.reasons.map((r) => (
                      <p key={r.text} className="text-caption font-medium">
                        {r.text}
                      </p>
                    ))}
                    {j.answer.doLine && <p className="text-caption font-medium">{j.answer.doLine}</p>}
                    <div className="flex flex-wrap gap-2">
                      <WhereTag r={j.receipt} device={device} onOpen={() => setDetails(j.receipt)} />
                      <button
                        type="button"
                        className="tag"
                        onClick={() =>
                          explainText({
                            kind: 'email',
                            verdict: j.answer.verdict.text,
                            sentences: [...j.answer.reasons.map((r) => r.text), ...(j.answer.doLine ? [j.answer.doLine] : [])],
                          })
                        }
                      >
                        <I.lang />
                        <span>{t('explain.button')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </div>
      {details && (
        <Sheet open onClose={() => setDetails(null)} title={t('where.title')}>
          <ReceiptFull r={details} device={device} />
        </Sheet>
      )}
    </main>
  );
}
