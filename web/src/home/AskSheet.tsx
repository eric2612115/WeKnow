// The asking sheet (before anything goes over the internet), the remember sheet (before a note is written) and
// the offer to get ready: one skeleton learned once. Blue globe and a dashed box: this would leave. Green
// notebook and a solid box: this stays here. No Close, no press outside; Escape counts as No.
//
// A check online (a sheet with `hidden`) is read at a glance, not word by word: three short points (what is hidden
// here, as pills with counts; that only the rest goes; the picture), two sections ("What stays hidden" closed, "See
// exactly what goes" open: the covered words as the paper's own lines, a covered detail as a small mark, in a box with
// its own scroll), and Yes and No always in view at the bottom.

import type { ReactNode } from 'react';
import { answerSheet, useAsk, type SheetRequest } from '../ask/conversation';
import type { PIIKind } from '../core/pii';
import { deviceWord } from '../engine/device';
import { Sheet } from '../ui/Sheet';
import { DeviceIcon, I } from '../ui/icons';
import { t, type StringId } from '../strings';

const TOKEN = /\[(name|phone|email|street|account|card|ssn|plate|vin)\]/g;
const MARK: Record<string, string> = { street: 'address', ssn: 'SSN', vin: 'VIN' };
const KINDS: PIIKind[] = ['name', 'phone', 'email', 'street', 'account', 'card', 'ssn', 'plate', 'vin'];
const ICON: Record<PIIKind, () => ReactNode> = {
  name: I.user,
  phone: I.phone,
  email: I.mail,
  street: I.house,
  account: I.card,
  card: I.card,
  ssn: I.idCard,
  plate: I.car,
  vin: I.car,
};

/** "1 name", "2 phones", "4 account numbers". */
export const hiddenLabel = (k: PIIKind, n: number) => t(`hid.${k}${n === 1 ? '' : '.many'}` as StringId, { n });

/** One covered line: its words, with every covered detail as a small mark. */
export function CoveredLine({ text }: { text: string }) {
  const parts: Array<string | { mark: string }> = [];
  let at = 0;
  for (const m of text.matchAll(TOKEN)) {
    if ((m.index ?? 0) > at) parts.push(text.slice(at, m.index));
    parts.push({ mark: MARK[m[1]] ?? m[1] });
    at = (m.index ?? 0) + m[0].length;
  }
  if (at < text.length) parts.push(text.slice(at));
  return (
    <span className="pline">
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <span key={i} className="ctoken" title={t('ask.mark.title')}>
            {p.mark}
          </span>
        ),
      )}
    </span>
  );
}

function Fold({ title, children, testId, open = false }: { title: string; children: ReactNode; testId: string; open?: boolean }) {
  return (
    <details className="fold" data-testid={testId} open={open}>
      <summary>
        <span>{title}</span>
        <I.down />
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

function CheckSheet({ s, icon }: { s: SheetRequest; icon: ReactNode }) {
  const hidden = KINDS.filter((k) => (s.hidden?.[k] ?? 0) > 0).map((k) => ({ k, n: s.hidden![k]! }));
  const lines = s.lines ?? [];
  const picture = s.goes === 'picture';
  return (
    <Sheet open closable={false} onEscape={() => answerSheet(false)} title={s.title} titleIcon={icon} tone={s.kind}>
      <ul className="check-points">
        <li>
          <span className="check-ico">
            <I.lock />
          </span>
          <div className="min-w-0">
            <p>{hidden.length ? t('check.hidden') : t('check.hidden.none')}</p>
            {hidden.length > 0 && (
              <ul className="hid-pills" data-testid="hidden-pills">
                {hidden.map(({ k, n }) => (
                  <li key={k} className="hid-pill">
                    {ICON[k]()}
                    <span>{hiddenLabel(k, n)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
        <li>
          <span className="check-ico net">
            <I.net />
          </span>
          <p>{picture ? t('check.rest.picture') : t('check.rest.words')}</p>
        </li>
        {s.goes !== 'question' && (
        <li>
          {picture && s.picture ? (
            <span className="check-thumb">
              <img src={s.picture} alt="The covered picture that would be sent" />
            </span>
          ) : (
            <span className="check-ico">
              <I.picture />
            </span>
          )}
          <p>{picture ? t('check.picture.goes') : t('check.picture.stays')}</p>
        </li>
        )}
      </ul>
      {hidden.length > 0 && (
        <Fold title={t('check.what.hidden')} testId="fold-hidden">
          <ul className="hid-list">
            {hidden.map(({ k, n }) => (
              <li key={k}>
                {ICON[k]()}
                <span>{hiddenLabel(k, n)}</span>
              </li>
            ))}
          </ul>
        </Fold>
      )}
      {/* What goes is open from the start: the exact words are the point of asking. */}
      <Fold title={t('check.what.goes')} testId="fold-goes" open>
        <div className="parcel lines goes-box" data-testid="parcel">
          {picture && s.picture && (
            <span className="thumb w-32 bg-white">
              <img src={s.picture} alt="" className="!object-contain" />
            </span>
          )}
          {lines.length ? lines.map((l, i) => <CoveredLine key={i} text={l} />) : s.parcel.map((x, i) => <CoveredLine key={i} text={x} />)}
        </div>
      </Fold>
      <div className="check-foot">
        <div className="grid grid-cols-2 gap-[0.7rem]">
          <button type="button" className="btn btn-yes" onClick={() => answerSheet(true)}>
            {s.yes}
          </button>
          <button type="button" className="btn" onClick={() => answerSheet(false)}>
            {s.no}
          </button>
        </div>
        {s.middle && (
          <button type="button" className="pmore mx-auto block" onClick={() => answerSheet('middle')}>
            {s.middle}
          </button>
        )}
        {s.note && <p className="check-note">{s.note}</p>}
      </div>
    </Sheet>
  );
}

export function AskSheet() {
  const v = useAsk();
  const s = v.sheet;
  if (!s) return null;
  const icon = s.kind === 'net' ? <I.net /> : s.kind === 'note' ? <I.note /> : <DeviceIcon device={deviceWord()} />;
  if (s.hidden) return <CheckSheet s={s} icon={icon} />;
  return (
    <Sheet open closable={false} onEscape={() => answerSheet(false)} title={s.title} titleIcon={icon} tone={s.kind}>
      {s.body && <p className="text-body font-medium">{s.body}</p>}
      {(s.parcel.length > 0 || s.picture) && (
        <div className={`parcel my-3 ${s.kind === 'note' ? 'note' : ''}`} data-testid="parcel">
          {s.picture && (
            <span className="thumb w-32 bg-white">
              <img src={s.picture} alt="The picture that would be sent" className="!object-contain" />
            </span>
          )}
          {s.parcel.map((x, i) => (
            <span key={i}>{x}</span>
          ))}
        </div>
      )}
      {s.not.map((x) => (
        <p key={x} className="mt-[0.4rem] text-small text-ink-2">
          {x}
        </p>
      ))}
      <div className={`mt-[1.1rem] grid gap-[0.7rem] ${s.middle ? 'grid-cols-1' : 'grid-cols-2'}`}>
        <button
          type="button"
          className="btn btn-yes"
          onClick={() => {
            s.onYesClick?.();
            answerSheet(true);
          }}
        >
          {s.yes}
        </button>
        {s.middle && (
          <button type="button" className="btn" onClick={() => answerSheet('middle')}>
            {s.middle}
          </button>
        )}
        <button type="button" className="btn" onClick={() => answerSheet(false)}>
          {s.no}
        </button>
      </div>
    </Sheet>
  );
}
