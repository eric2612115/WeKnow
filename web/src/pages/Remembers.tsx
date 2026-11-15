// What WeKnow remembers: every household note, visible, changeable and deletable, kept only on this device.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { Memory } from '../core/memory';
import { forgetEverything, notesOf, putMemory, removeMemory, useData } from '../store/data';
import { setPrefs, usePrefs } from '../store/prefs';
import { deviceWord } from '../engine/device';
import { Card, CardTitle, PageTitle, Soon, Toggle } from '../ui/controls';
import { DeviceIcon } from '../ui/icons';
import { openSheet } from '../ui/uiStore';
import { noteFields } from '../app/Sheets';
import { t, type StringId } from '../strings';

function NoteRow({ group, onDelete }: { group: Memory[]; onDelete: (g: Memory[]) => void }) {
  const m = group[0];
  const f = noteFields(m, group);
  return (
    <div className="flex flex-wrap items-center justify-between gap-[0.8rem] border-t border-hair py-[0.8rem] first:border-t-0">
      <div className="grid min-w-0 flex-[1_1_9rem] gap-[0.15rem]">
        <b className="text-body leading-[1.25] font-bold tracking-[-0.01em]">{f.a}</b>
        <span className="text-small">{f.b}</span>
        <small className="text-small text-ink-2">{f.c}</small>
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'edit', memId: m.id })}>
          {t('notes.change')}
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => onDelete(group)}>
          {t('notes.delete')}
        </button>
      </div>
    </div>
  );
}

function Group({ title, items, empty, onDelete }: { title: StringId; items: Memory[][]; empty: StringId; onDelete: (g: Memory[]) => void }) {
  return (
    <Card>
      <CardTitle>{t(title)}</CardTitle>
      {items.length ? (
        items.map((g) => <NoteRow key={g[0].id} group={g} onDelete={onDelete} />)
      ) : (
        <p className="py-[0.4rem] text-small text-ink-2">{t(empty)}</p>
      )}
    </Card>
  );
}

export default function Remembers() {
  const data = useData();
  const p = usePrefs();
  const device = deviceWord();
  const [undo, setUndo] = useState<Memory[] | null>(null);
  useEffect(() => () => setUndo(null), []);
  const del = (g: Memory[]) => {
    setUndo(g);
    for (const m of g) void removeMemory(m.id);
  };
  const notes = notesOf(data.memory);
  const by = (k: Memory['kind']) => notes.filter((g) => g[0].kind === k);
  const pref = (label: string, value: string, action?: boolean) => (
    <div className="flex flex-wrap items-center justify-between gap-[0.8rem] border-t border-hair py-[0.8rem] first:border-t-0">
      <div className="grid min-w-0 flex-[1_1_9rem] gap-[0.15rem]">
        <b className="text-body font-bold">{label}</b>
        <span className="text-small">{value}</span>
      </div>
      {action && (
        <Link to="/settings#set-voice" className="btn btn-sm">
          {t('notes.change')}
        </Link>
      )}
    </div>
  );

  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[40rem] lg:max-w-[76rem]">
        <PageTitle>{t('notes.title')}</PageTitle>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
          <div className="card flex items-start gap-[0.9rem] border-transparent bg-ok-bg px-[1.15rem] py-4 lg:col-span-2 [&>svg]:mt-0.5 [&>svg]:size-8 [&>svg]:flex-none [&>svg]:text-go">
            <DeviceIcon device={device} />
            <div className="min-w-0">
              <b className="block text-[1.25rem] leading-[1.2] font-bold tracking-[-0.015em]">{t('notes.only.title', { device })}</b>
              <p className="mt-1 text-small">{t('notes.only.line', { device })}</p>
            </div>
          </div>
          {undo && (
            <div className="card flex items-center justify-between gap-4 px-[1.1rem] py-[0.8rem] text-small font-semibold lg:col-span-2" role="status">
              <span>{t('notes.deleted', { name: noteName(undo[0]) })}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  for (const m of undo) void putMemory(m);
                  setUndo(null);
                }}
              >
                {t('notes.undo')}
              </button>
            </div>
          )}
          <Group title="notes.shops" items={by('job')} empty="notes.shops.empty" onDelete={del} />
          <Group title="notes.payees" items={by('payee')} empty="notes.payees.empty" onDelete={del} />
          <Group title="notes.things" items={by('appliance')} empty="notes.things.empty" onDelete={del} />
          <Card>
            <CardTitle>{t('notes.prefs')}</CardTitle>
            {pref(t('pref.voice'), p.voice ? t(`pref.speed.${p.rate}` as StringId) : t('pref.voice.off'), true)}
            {pref(t('pref.size'), t(`pref.size.${p.size}` as StringId))}
            {pref(t('pref.lang'), t('pref.lang.en'))}
          </Card>
          <Card className="lg:col-span-2">
            <div className="row">
              <span>
                {t('notes.offer')}
                <small>{t('notes.offer.fine')}</small>
              </span>
              <Toggle checked={p.offerNotes} onChange={(v) => setPrefs({ offerNotes: v })} label={t('notes.offer')} />
            </div>
            <div className="row">
              <span>
                {t('notes.backup')}
                <small>{t('notes.backup.fine', { device })}</small>
              </span>
              <Soon />
            </div>
            <div className="row">
              <span>
                {t('notes.forget')}
                <small>{t('notes.forget.fine')}</small>
              </span>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() =>
                  openSheet({
                    type: 'confirm',
                    title: t('notes.forget.ask'),
                    body: t('notes.forget.body', { device }),
                    yes: t('notes.forget'),
                    onYes: () => {
                      setUndo(null);
                      void forgetEverything();
                    },
                  })
                }
              >
                {t('notes.forget')}
              </button>
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}

function noteName(m: Memory): string {
  return m.kind === 'job' ? m.shop : m.kind === 'payee' ? m.name : m.kind === 'appliance' ? m.what : m.key;
}
