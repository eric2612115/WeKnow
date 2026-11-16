// The asking sheet (before anything goes over the internet), the remember sheet (before a note is written) and
// the offer to get ready: one skeleton learned once. Blue globe and a dashed box: this would leave. Green
// notebook and a solid box: this stays here. No Close, no press outside; Escape counts as No.

import { answerSheet, useAsk } from '../ask/conversation';
import { deviceWord } from '../engine/device';
import { Sheet } from '../ui/Sheet';
import { DeviceIcon, I } from '../ui/icons';

export function AskSheet() {
  const v = useAsk();
  const s = v.sheet;
  if (!s) return null;
  const icon = s.kind === 'net' ? <I.net /> : s.kind === 'note' ? <I.note /> : <DeviceIcon device={deviceWord()} />;
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
