// Knowledge packs: what WeKnow answers from. Read from the pack catalog that ships with the app; nothing here is
// written by a model.

import { useEffect, useState } from 'react';
import { Card, PageTitle } from '../ui/controls';
import { I } from '../ui/icons';
import { deviceWord } from '../engine/device';
import { longDate, t } from '../strings';

interface CatalogPack {
  id: string;
  region: string;
  dataAsOf: string;
  counts: { prices: number; guides: number };
}

export default function Packs() {
  const [packs, setPacks] = useState<CatalogPack[] | null | 'failed'>(null);
  useEffect(() => {
    let live = true;
    fetch('/packs/catalog.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: { packs?: CatalogPack[] }) => live && setPacks(c.packs ?? []))
      .catch(() => live && setPacks('failed'));
    return () => {
      live = false;
    };
  }, []);
  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[40rem] lg:max-w-[45rem]">
        <PageTitle>{t('packs.title')}</PageTitle>
        <p className="mb-4 text-small text-ink-2">{t('packs.lead', { device: deviceWord() })}</p>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {packs === 'failed' && <p className="text-small">{t('packs.none')}</p>}
          {Array.isArray(packs) &&
            packs.map((p) => (
              <Card key={p.id} className="flex items-center gap-4">
                <span className="grid size-11 flex-none place-items-center rounded-full bg-card-2 text-go [&_svg]:size-[1.35rem]">
                  <I.book />
                </span>
                <div className="grid min-w-0 gap-[0.15rem]">
                  <b className="text-body font-semibold tracking-[-0.01em]">
                    {p.id} · {p.region}
                  </b>
                  <span className="text-small">{t('packs.counts', { prices: p.counts.prices, guides: p.counts.guides })}</span>
                  <small className="text-small text-ink-2">{t('packs.asof', { date: longDate(p.dataAsOf) })}</small>
                </div>
              </Card>
            ))}
        </div>
      </div>
    </main>
  );
}
