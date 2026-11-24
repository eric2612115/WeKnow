// "Where this answer came from" (UI-SPEC 7.2): two lanes, always both, always in this order; then what was kept
// and the sources; Technical details closed by default and the only place for words like model or pack version.

import type { Receipt } from '../answer/types';
import { getReady, useDevice } from '../engine/device';
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

const laneH = 'mb-[0.4rem] flex items-center gap-2 text-[1.0625rem] font-semibold [&_svg]:size-5 [&_svg]:flex-none';

export function Lanes({ r, device }: { r: Receipt; device: string }) {
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
              {/* Only the covered copy that went is shown here, never the picture as it was taken. */}
              {r.sentPicture && r.coveredPicture && (
                <span className="thumb w-28 bg-white">
                  <img src={r.coveredPicture} alt="The covered picture that was sent" className="!object-contain" />
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
        {r.why && sent && <p className="mt-1 text-small text-ink-2" data-testid="why">{r.why}</p>}
        {r.waiting && <p className="mt-1 text-small">{r.waiting}</p>}
      </div>
    </>
  );
}

/** The hybrid, said plainly: what a device that reads by itself would do, and what this one can do now. */
export function HybridNote({ device }: { device: string }) {
  const d = useDevice();
  const here =
    d.pct !== null
      ? t('hybrid.here.getting', { device, n: d.pct })
      : d.model === 'available'
        ? t('hybrid.here.ready', { device })
        : d.model === 'downloadable'
          ? t('hybrid.here.can', { device })
          : t('hybrid.here.cloud', { device });
  return (
    <div className="border-t border-hair py-[0.85rem]" data-testid="hybrid">
      <div className={`${laneH} [&_svg]:text-go`}>
        <DeviceIcon device={device} />
        {t('hybrid.title')}
      </div>
      <p className="text-small">{t('hybrid.line')}</p>
      <p className="mt-1 text-small text-ink-2">{here}</p>
      {d.model === 'downloadable' && d.pct === null && (
        <button type="button" className="btn btn-sm mt-2" onClick={() => void getReady()}>
          {t('ready.offer.yes')}
        </button>
      )}
    </div>
  );
}

/**
 * The receipt, for people with little patience: two plain cards first (what stayed here, the one thing that went),
 * everything else folded away.
 */
export function ReceiptFull({ r, device }: { r: Receipt; device: string }) {
  const sent = r.sent.length > 0;
  const fold = 'border-t border-hair';
  const sum = 'flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 text-small font-semibold text-ink-2 [&::-webkit-details-marker]:hidden';
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-3 rounded-[1.25rem] bg-card-2 p-4">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-card text-go [&_svg]:size-6">
          <DeviceIcon device={device} />
        </span>
        <div className="min-w-0">
          <p className="text-body font-semibold">{t('where.stayed', { device })}</p>
          <p className="mt-0.5 text-small text-ink-2">{r.stayed.join(' · ') || t('where.nothing')}</p>
        </div>
      </div>
      <div className={`flex items-start gap-3 rounded-[1.25rem] p-4 ${sent ? 'bg-net-bg' : 'bg-card-2'}`}>
        <span className={`grid size-11 flex-none place-items-center rounded-full bg-card [&_svg]:size-6 ${sent ? 'text-net' : 'text-go'}`}>
          {sent ? <I.net /> : <I.ok />}
        </span>
        <div className="min-w-0">
          {sent ? (
            <>
              <p className="text-body font-semibold">{t('rc.went')}</p>
              {r.sentPicture && r.coveredPicture && (
                <span className="thumb mt-2 block w-28 bg-white">
                  <img src={r.coveredPicture} alt="The covered picture that was sent" className="!object-contain" />
                </span>
              )}
              <p className="mt-2 rounded-xl bg-card px-3 py-2 text-small font-medium">{r.sent[0]}</p>
              {r.sent.length > 1 && <p className="mt-1 text-small text-ink-2">{t('rc.more', { n: r.sent.length - 1 })}</p>}
            </>
          ) : (
            <p className="text-body font-semibold">{t('rc.none', { device })}</p>
          )}
        </div>
      </div>
      {r.waiting && <p className="text-small">{r.waiting}</p>}

      <div>
        {sent && (
          <details className={fold}>
            <summary className={sum}>{t('rc.all')}<I.chev /></summary>
            <ul className="grid gap-1.5 pb-3 text-small">
              {r.sent.map((s) => (
                <li key={s}>{s}</li>
              ))}
              <li className="text-ink-2">{t('where.else')}</li>
              {r.why && <li className="text-ink-2" data-testid="why">{r.why}</li>}
            </ul>
          </details>
        )}
        {r.sources.length > 0 && (
          <details className={fold}>
            <summary className={sum}>{t('rc.sources', { n: r.sources.length })}<I.chev /></summary>
            <ul className="grid gap-2 pb-3 text-small">
              {r.sources.map((s) => (
                <li key={s.label}>
                  {s.label}
                  {s.date && <small className="block text-small text-ink-2">{s.date}</small>}
                </li>
              ))}
            </ul>
          </details>
        )}
        {r.saved && (
          <details className={fold}>
            <summary className={sum}>{t('where.kept')}<I.chev /></summary>
            <p className="pb-3 text-small">{r.saved}</p>
          </details>
        )}
        <details className={fold}>
          <summary className={sum}>{t('where.tech')}<I.chev /></summary>
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
    </div>
  );
}
