// "Where this answer came from" (UI-SPEC 7.2): two lanes, always both, always in this order; then what was kept
// and the sources; Technical details closed by default and the only place for words like model or pack version.

import type { Receipt } from '../answer/types';
import { tagText } from '../answer/compose';
import { t } from '../strings';
import { DeviceIcon, I, WhereIcon } from './icons';

export function WhereTag({ r, device, onOpen, className = '' }: { r: Receipt; device: string; onOpen?: () => void; className?: string }) {
  const body = (
    <>
      <WhereIcon w={r.w} device={device} />
      <span>{tagText(r, device)}</span>
    </>
  );
  if (onOpen)
    return (
      <button type="button" className={`tag ${className}`} data-where={r.w} onClick={onOpen} aria-haspopup="dialog">
        {body}
        <I.chev />
      </button>
    );
  return (
    <div className={`wtag ${className}`} data-where={r.w}>
      {body}
    </div>
  );
}

const laneH = 'mb-[0.4rem] flex items-center gap-2 text-body font-bold [&_svg]:size-6 [&_svg]:flex-none';

export function Lanes({ r, device, picture }: { r: Receipt; device: string; picture?: string | null }) {
  const sent = r.sent.length > 0;
  return (
    <>
      <div className="border-t border-hair py-[0.85rem] first:border-t-0">
        <div className={laneH}>
          <DeviceIcon device={device} />
          {t('where.stayed', { device })}
        </div>
        {r.stayed.length ? (
          <ul className="grid gap-1 text-small">
            {r.stayed.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ) : (
          <p className="text-small">{t('where.nothing')}</p>
        )}
      </div>
      <div className="border-t border-hair py-[0.85rem]">
        <div className={`${laneH} ${sent ? 'text-net' : ''}`}>
          <I.net />
          {t('where.sent')}
        </div>
        {sent ? (
          <>
            <div className="parcel my-[0.3rem] mb-[0.4rem] text-small">
              {r.sentPicture && picture && (
                <span className="thumb w-28">
                  <img src={picture} alt="" />
                </span>
              )}
              {r.sent.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <p className="text-small">{t('where.else')}</p>
          </>
        ) : (
          <p className="text-small">{t('where.nothing')}</p>
        )}
        {r.waiting && <p className="mt-1 text-small">{r.waiting}</p>}
      </div>
    </>
  );
}

export function ReceiptFull({ r, device, picture }: { r: Receipt; device: string; picture?: string | null }) {
  return (
    <div>
      <WhereTag r={r} device={device} className="mb-3" />
      <Lanes r={r} device={device} picture={picture} />
      {r.saved && (
        <div className="border-t border-hair py-[0.85rem]">
          <div className={`${laneH} [&_svg]:text-go`}>
            <I.ok />
            {t('where.kept')}
          </div>
          <p className="text-small">{r.saved}</p>
        </div>
      )}
      {r.sources.length > 0 && (
        <div className="border-t border-hair py-[0.85rem]">
          <div className={laneH}>{t('where.facts')}</div>
          <ul className="grid gap-2 text-small">
            {r.sources.map((s) => (
              <li key={s.label}>
                {s.label}
                {s.date && <small className="block text-small text-ink-2">{s.date}</small>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="border-t border-hair pt-[0.8rem]">
        <summary className="flex min-h-11 cursor-pointer items-center text-small font-semibold text-ink-2">{t('where.tech')}</summary>
        <div className="grid gap-1.5 pb-1 text-small text-ink-2">
          {r.tech.map((x) => (
            <p key={x}>{x}</p>
          ))}
          {r.sources
            .filter((s) => s.url)
            .map((s) => (
              <p key={s.url} className="break-all">
                {s.title ? `${s.title}: ` : ''}
                {s.url}
              </p>
            ))}
        </div>
      </details>
    </div>
  );
}
