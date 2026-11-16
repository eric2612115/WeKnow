// Every sheet that can open over any page: where an answer came from, one check, Move, a project name, a
// confirmation, sample pictures, a reminder, set up for someone else, a note, the person to call.

import { useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { closeSheet, openSheet, useUi, type SheetState } from '../ui/uiStore';
import { Sheet } from '../ui/Sheet';
import { ReceiptFull } from '../ui/Receipt';
import { I } from '../ui/icons';
import { Seg, VerdictBand } from '../ui/controls';
import { t, shortDate, longDate, money, type StringId } from '../strings';
import { useAsk } from '../ask/conversation';
import { replay } from '../ask/flows';
import { createProject, deleteCheck, moveCheck, putMemory, renameProject, useData, usePicture, projectName } from '../store/data';
import { setPrefs, usePrefs } from '../store/prefs';
import { deviceWord, getReady, useDevice } from '../engine/device';
import { sayAloud, quiet } from '../engine/speech';
import { cameraStore, requestCameraAndMic, useCamera } from '../engine/camera';
import { attachSample, chooseFile, SAMPLES, type Sample } from '../samples';
import { googleCalendarLink, icsFile } from '../core/reminders';
import type { Memory } from '../core/memory';
import { ExplainSheet } from './ExplainSheet';
import { explainCheck } from './explainOpen';

export function Sheets() {
  const { sheet } = useUi();
  return (
    <>
      <ReceiptSheet open={sheet?.type === 'receipt'} s={sheet?.type === 'receipt' ? sheet : null} />
      <CheckSheet s={sheet?.type === 'check' ? sheet : null} />
      <MoveSheet s={sheet?.type === 'move' ? sheet : null} />
      <NameSheet s={sheet?.type === 'name' ? sheet : null} />
      <ConfirmSheet s={sheet?.type === 'confirm' ? sheet : null} />
      <SamplesSheet open={sheet?.type === 'samples'} />
      <ReminderSheet s={sheet?.type === 'reminder' ? sheet : null} />
      <SetupSheet open={sheet?.type === 'setup'} />
      <EditSheet s={sheet?.type === 'edit' ? sheet : null} />
      <TrustedSheet open={sheet?.type === 'trusted'} />
      <ExplainSheet />
    </>
  );
}

const Two = ({ children }: { children: ReactNode }) => <div className="mt-[1.1rem] grid grid-cols-2 gap-[0.7rem]">{children}</div>;
const Small = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <p className={`mt-[0.4rem] text-small text-ink-2 ${className}`}>{children}</p>
);

function ReceiptSheet({ open, s }: { open: boolean; s: Extract<SheetState, { type: 'receipt' }> | null }) {
  const v = useAsk();
  // The answer it was opened from (any answer in the conversation), else the newest one.
  const r = s?.r ?? v.receipt;
  if (!r) return null;
  return (
    <Sheet open={open} onClose={closeSheet} title={t('where.title')}>
      <ReceiptFull r={r} device={deviceWord()} />
    </Sheet>
  );
}

function CheckSheet({ s }: { s: Extract<SheetState, { type: 'check' }> | null }) {
  const data = useData();
  const nav = useNavigate();
  const c = s ? data.checks.find((x) => x.id === s.checkId) : undefined;
  const pic = usePicture(c?.pictureId);
  if (!c) return null;
  const device = deviceWord();
  return (
    <Sheet open={!!s} onClose={closeSheet} title={c.title} size="wide">
      <div className="grid gap-[1.4rem] lg:grid-cols-2 lg:items-start">
        {c.pictureId ? (
          <span className="thumb">{pic && <img src={pic} alt="" />}</span>
        ) : (
          <span className="thumb words">
            <I.say />
          </span>
        )}
        <div>
          <VerdictBand tone={c.tone} text={c.verdict} className="!animate-none" />
          <p className="mt-1 mb-2 text-small text-ink-2">{t('check.meta', { kind: t(`kind.${c.kind}` as StringId), date: shortDate(c.date), device })}</p>
          <div className="row">
            <span>
              {t('check.in')}
              <small>{projectName(c.projectId)}</small>
            </span>
            <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'move', checkId: c.id, back: 'check' })}>
              {t('check.move')}
            </button>
          </div>
          <Two>
            <button
              type="button"
              className="btn btn-yes"
              onClick={() => {
                closeSheet();
                nav('/app');
                replay(c);
              }}
            >
              {t('check.hear')}
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                openSheet({
                  type: 'confirm',
                  title: t('check.delete.ask'),
                  body: t('check.delete.body', { device }),
                  yes: t('check.delete'),
                  onYes: () => void deleteCheck(c.id),
                })
              }
            >
              {t('check.delete')}
            </button>
          </Two>
          <button type="button" className="btn btn-sm mt-3" onClick={() => void explainCheck(c)}>
            <I.lang />
            {t('explain.button')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function MoveSheet({ s }: { s: Extract<SheetState, { type: 'move' }> | null }) {
  const data = useData();
  const c = s ? data.checks.find((x) => x.id === s.checkId) : undefined;
  if (!c || !s) return null;
  const done = () => (s.back === 'check' ? openSheet({ type: 'check', checkId: c.id }) : closeSheet());
  return (
    <Sheet open onClose={done} title={t('check.move.title')}>
      <div role="radiogroup" aria-label={t('check.move.title')}>
        {data.projects.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={p.id === c.projectId}
            className="my-[0.45rem] flex min-h-14 w-full items-center gap-[0.8rem] rounded-btn border-[1.5px] border-line bg-card px-4 text-left text-body font-semibold aria-checked:border-go"
            onClick={async () => {
              await moveCheck(c.id, p.id);
              done();
            }}
          >
            <span
              className={`size-[1.3rem] flex-none rounded-full ${p.id === c.projectId ? 'shadow-[inset_0_0_0_0.4rem_var(--go)]' : 'shadow-[inset_0_0_0_2px_var(--line)]'}`}
              aria-hidden="true"
            />
            {p.name}
          </button>
        ))}
      </div>
      <button type="button" className="btn mt-[0.6rem] w-full" onClick={() => openSheet({ type: 'name', mode: 'newmove', checkId: c.id })}>
        <I.plus />
        {t('checks.new')}
      </button>
    </Sheet>
  );
}

function NameSheet({ s }: { s: Extract<SheetState, { type: 'name' }> | null }) {
  const data = useData();
  if (!s) return null;
  const project = s.projectId ? data.projects.find((p) => p.id === s.projectId) : undefined;
  return <NameForm key={`${s.mode}:${s.projectId ?? ''}:${s.checkId ?? ''}`} s={s} initial={s.mode === 'rename' && project ? project.name : ''} />;
}

function NameForm({ s, initial }: { s: Extract<SheetState, { type: 'name' }>; initial: string }) {
  const [name, setName] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const save = async () => {
    const v = name.trim();
    if (!v) return input.current?.focus();
    if (s.mode === 'rename' && s.projectId) await renameProject(s.projectId, v);
    else {
      const p = await createProject(v);
      if (s.mode === 'newmove' && s.checkId) await moveCheck(s.checkId, p.id);
      window.dispatchEvent(new CustomEvent('weknow:project', { detail: p.id }));
    }
    closeSheet();
  };
  return (
    <Sheet open onClose={closeSheet} title={s.mode === 'rename' ? t('checks.rename.title') : t('checks.new')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="mb-[0.8rem] grid gap-[0.35rem] text-small font-semibold text-ink-2">
          {t('checks.name')}
          <input
            ref={input}
            autoFocus
            className="field"
            value={name}
            maxLength={40}
            placeholder={t('checks.name.hint')}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button type="submit" className="btn btn-yes w-full">
          {t('save')}
        </button>
      </form>
    </Sheet>
  );
}

function ConfirmSheet({ s }: { s: Extract<SheetState, { type: 'confirm' }> | null }) {
  if (!s) return null;
  return (
    <Sheet open closable={false} onEscape={closeSheet} title={s.title}>
      <p className="text-body font-medium">{s.body}</p>
      <Two>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            closeSheet();
            s.onYes();
          }}
        >
          {s.yes}
        </button>
        <button type="button" className="btn" onClick={closeSheet}>
          {t('keep')}
        </button>
      </Two>
    </Sheet>
  );
}

/** The three sample pictures. A press asks that picture's own question at once. */
export function SampleButtons({ onPick, compact = false }: { onPick?: (id: Sample['id']) => void; compact?: boolean }) {
  const v = useAsk();
  return (
    <div className={`grid grid-cols-3 ${compact ? 'gap-2' : 'gap-[0.8rem]'}`}>
      {SAMPLES.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-pressed={v.chosen?.sample === s.id}
          aria-label={t(s.q)}
          className="group flex min-w-0 flex-col items-stretch gap-[0.45rem] text-center text-small leading-tight font-semibold transition-transform duration-150 hover:-translate-y-0.5"
          onClick={() => (onPick ? onPick(s.id) : void attachSample(s.id))}
        >
          <span className="thumb group-aria-pressed:shadow-[0_0_0_3px_var(--go)]">
            <img src={s.url} alt="" />
          </span>
          {/* Words are never broken mid-word; on the narrowest phones the compact row shows the pictures only. */}
          <span aria-hidden="true" className={`[overflow-wrap:normal] ${compact ? 'max-[22.5rem]:hidden' : ''}`}>
            “{t(s.q)}”
          </span>
        </button>
      ))}
    </div>
  );
}

export function ChoosePhoto({ onPicked, className = '' }: { onPicked?: () => void; className?: string }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className={`btn btn-sm ${className}`} onClick={() => input.current?.click()}>
        <I.image />
        {t('home.choose')}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            chooseFile(f);
            onPicked?.();
          }
          e.target.value = '';
        }}
      />
    </>
  );
}

function SamplesSheet({ open }: { open: boolean }) {
  const nav = useNavigate();
  return (
    <Sheet open={open} onClose={closeSheet} title={t('home.samples')}>
      <SampleButtons
        onPick={(id) => {
          closeSheet();
          nav('/app');
          void attachSample(id);
        }}
      />
      <ChoosePhoto
        onPicked={() => {
          closeSheet();
          nav('/app');
        }}
        className="mt-4 w-full"
      />
    </Sheet>
  );
}

function inAWeek(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function ReminderSheet({ s }: { s: Extract<SheetState, { type: 'reminder' }> | null }) {
  if (!s) return null;
  return <ReminderForm key={s.title} title0={s.title} />;
}

function saveIcs(reminder: { title: string; date: string; details: string }) {
  const blob = new Blob([icsFile(reminder, `${Date.now()}`)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'weknow-reminder.ics';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function ReminderForm({ title0 }: { title0: string }) {
  const [title, setTitle] = useState(title0);
  const [date, setDate] = useState(inAWeek);
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && title.trim();
  const reminder = { title: title.trim() || title0, date, details: 'Reminder added from WeKnow.' };
  return (
    <Sheet open onClose={closeSheet} title={t('remind.title')} titleIcon={<I.calendar />} tone="note">
      <label className="mb-[0.8rem] grid gap-[0.35rem] text-small font-semibold text-ink-2">
        {t('remind.what')}
        <input className="field" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="mb-[0.8rem] grid gap-[0.35rem] text-small font-semibold text-ink-2">
        {t('remind.when')}
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <div className="grid gap-[0.7rem]">
        <a
          className={`btn btn-yes ${valid ? '' : 'pointer-events-none'}`}
          aria-disabled={!valid}
          href={valid ? googleCalendarLink(reminder) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setTimeout(closeSheet, 200)}
        >
          <I.calendar />
          {t('remind.open')}
        </a>
        <button type="button" className="btn" disabled={!valid} onClick={() => saveIcs(reminder)}>
          {t('remind.file')}
        </button>
      </div>
      <Small className="mt-3">{t('remind.fine')}</Small>
    </Sheet>
  );
}

function Step({ n, ok, title, children }: { n: number; ok?: boolean; title: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[2.4rem_1fr] gap-x-[0.8rem] gap-y-[0.2rem] border-t border-hair py-[0.9rem]">
      <span
        className={`grid size-[2.4rem] place-items-center rounded-full text-small font-bold [&_svg]:size-[1.4rem] ${
          ok ? 'bg-go text-on-go' : 'shadow-[inset_0_0_0_1.5px_var(--line)]'
        }`}
      >
        {ok ? <I.check /> : n}
      </span>
      <b className="self-center text-body font-bold">{title}</b>
      <div className="col-start-2 grid justify-items-start gap-[0.55rem] text-small text-ink-2">{children}</div>
    </div>
  );
}

function SetupSheet({ open }: { open: boolean }) {
  const p = usePrefs();
  const d = useDevice();
  const cam = useCamera();
  const nav = useNavigate();
  const device = deviceWord();
  const allowed = cam.state === 'live';
  const ready = d.model === 'available';
  return (
    <Sheet open={open} onClose={closeSheet} title={t('setup.title')} size="full">
      <Small className="mt-0">{t('setup.line', { device })}</Small>
      <div className="mt-[0.8rem]">
        <Step n={1} ok={allowed} title={t('setup.1')}>
          {allowed ? (
            t('setup.1.ok')
          ) : (
            <button type="button" className="btn btn-sm" onClick={() => void requestCameraAndMic()}>
              {t('setup.1.ask')}
            </button>
          )}
        </Step>
        <Step n={2} ok={ready} title={t('setup.2')}>
          <DeviceRow compact />
        </Step>
        <Step n={3} title={t('setup.3')}>
          <RateSeg />
          <SizeSeg />
          <button type="button" className="btn btn-sm" onClick={() => void sayAloud(t('help.hear.say'))}>
            <I.play />
            {t('setup.3.play')}
          </button>
        </Step>
        <Step n={4} title={t('setup.4')}>
          {(
            [
              ['auto', 'setup.4.once'],
              ['every', 'setup.4.every'],
              ['never', 'set.net.never'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex min-h-11 items-center gap-[0.6rem] font-semibold text-ink">
              <input
                type="radio"
                name="internet"
                className="size-[1.4rem] accent-go"
                checked={p.internet === value || (value === 'auto' && p.internet === 'ask-once')}
                onChange={() => setPrefs({ internet: value })}
              />
              {t(label)}
            </label>
          ))}
        </Step>
        <Step n={5} ok={!!(p.trustedName && p.trustedNumber)} title={t('setup.5')}>
          <TrustedFields />
          {t('setup.5.fine', { device })}
        </Step>
      </div>
      <button
        type="button"
        className="btn btn-yes mt-[1.2rem] w-full"
        onClick={() => {
          closeSheet();
          nav('/app');
        }}
      >
        {t('setup.try')}
      </button>
      <Small className="mt-4">{t('setup.after')}</Small>
    </Sheet>
  );
}

export function RateSeg() {
  const p = usePrefs();
  return (
    <Seg<string>
      label={t('set.speed')}
      value={String(p.rate)}
      onChange={(v) => {
        setPrefs({ rate: Number(v) as 0 | 1 | 2 });
        quiet();
        void sayAloud(t('set.speed.say'));
      }}
      options={[
        { value: '0', label: t('set.speed.0') },
        { value: '1', label: t('set.speed.1') },
        { value: '2', label: t('set.speed.2') },
      ]}
    />
  );
}

export function SizeSeg() {
  const p = usePrefs();
  return (
    <Seg<string>
      label={t('set.size')}
      value={String(p.size)}
      onChange={(v) => setPrefs({ size: Number(v) as 0 | 1 | 2 })}
      options={[
        { value: '0', label: 'A', aria: t('pref.size.0') },
        { value: '1', label: 'A', aria: t('pref.size.1'), className: '!text-[1.3rem]' },
        { value: '2', label: 'A', aria: t('pref.size.2'), className: '!text-[1.6rem]' },
      ]}
    />
  );
}

/** Whether this device works without the internet, with Get ready while it can. */
export function DeviceRow({ compact = false }: { compact?: boolean }) {
  const d = useDevice();
  const device = deviceWord();
  if (d.pct !== null)
    return (
      <div className="grid w-full gap-[0.7rem]">
        <span className="text-body font-semibold">
          {compact ? null : t('set.dev.getting')}
          <small className="block text-small font-medium text-ink-2">{d.almost ? t('ready.almost') : t('set.dev.getting.fine', { n: d.pct })}</small>
        </span>
        <div className="prog" role="progressbar" aria-valuenow={d.pct} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${d.pct}%` }} />
        </div>
      </div>
    );
  if (d.model === 'available')
    return (
      <span className="text-body font-semibold">
        {t('set.dev.ready', { device })}
        <small className="block text-small font-medium text-ink-2">{t('set.dev.ready.fine', { date: longDate('2026-11-16') })}</small>
      </span>
    );
  if (d.model === 'downloadable')
    return (
      <div className="grid w-full gap-[0.7rem]">
        <span className="text-body font-semibold">
          {t('set.dev.can', { device })}
          <small className="block text-small font-medium text-ink-2">{d.full ? t('ready.full', { device }) : t('set.dev.can.fine')}</small>
        </span>
        <button type="button" className="btn btn-yes justify-self-start" onClick={() => void getReady()}>
          {t('ready.offer.yes')}
        </button>
      </div>
    );
  return <span className="text-body font-semibold">{t('set.dev.cannot', { device })}</span>;
}

function TrustedFields({ onSaved }: { onSaved?: () => void }) {
  const p = usePrefs();
  const [name, setName] = useState(p.trustedName);
  const [num, setNum] = useState(p.trustedNumber);
  return (
    <form
      className="grid w-full max-w-[18rem] gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setPrefs({ trustedName: name.trim().slice(0, 40), trustedNumber: num.trim().slice(0, 30) });
        onSaved?.();
      }}
    >
      <input className="field" aria-label={t('set.call.name')} placeholder={t('set.call.name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className="field"
        type="tel"
        aria-label={t('set.call.number')}
        placeholder={t('set.call.number')}
        value={num}
        onChange={(e) => setNum(e.target.value)}
      />
      <button type="submit" className="btn btn-sm justify-self-start">
        {t('save')}
      </button>
    </form>
  );
}

function TrustedSheet({ open }: { open: boolean }) {
  return (
    <Sheet open={open} onClose={closeSheet} title={t('set.call')}>
      <TrustedFields onSaved={closeSheet} />
      <Small className="mt-3">{t('setup.5.fine', { device: deviceWord() })}</Small>
    </Sheet>
  );
}

/** The three plain fields of a note, mapped to each kind of record (a shop visit may hold several lines). */
export function noteFields(m: Memory, group: Memory[] = [m]): { a: string; b: string; c: string } {
  switch (m.kind) {
    case 'job': {
      const jobs = group.filter((g): g is Extract<Memory, { kind: 'job' }> => g.kind === 'job');
      const shown = jobs.slice(0, 3).map((j) => `${j.label}, ${money(j.amount)}`);
      const more = jobs.length > 3 ? `; and ${jobs.length - 3} more` : '';
      return { a: m.shop, b: `${shown.join('; ')}${more}`, c: longDate(m.date) };
    }
    case 'payee':
      return { a: m.name, b: t('note.account', { digits: m.payTo }), c: t('note.last', { date: longDate(m.date) }) };
    case 'appliance':
      return { a: m.what, b: [m.make, m.model].filter(Boolean).join(' '), c: [longDate(m.date), m.note].filter(Boolean).join('. ') };
    case 'preference':
      return { a: m.key, b: m.value, c: longDate(m.date) };
  }
}

function EditSheet({ s }: { s: Extract<SheetState, { type: 'edit' }> | null }) {
  const data = useData();
  const m = s ? data.memory.find((x) => x.id === s.memId) : undefined;
  if (!m) return null;
  const group = m.kind === 'job' ? data.memory.filter((x) => x.kind === 'job' && x.shop === m.shop && x.date === m.date) : [m];
  return <EditForm key={m.id} m={m} group={group} />;
}

function EditForm({ m, group }: { m: Memory; group: Memory[] }) {
  const [f, setF] = useState(() => noteFields(m, group));
  const save = async () => {
    const a = f.a.trim();
    try {
      if (m.kind === 'job') {
        // A shop visit: the name applies to every line of that visit; the lines themselves come from the paper.
        for (const j of group) if (j.kind === 'job') await putMemory({ ...j, shop: a || j.shop });
      } else if (m.kind === 'payee') {
        const digits = f.b.replace(/\D/g, '');
        await putMemory({ ...m, name: a || m.name, payTo: digits.length >= 4 ? digits : m.payTo });
      } else if (m.kind === 'appliance') {
        await putMemory({ ...m, what: a || m.what, model: f.b.trim() || m.model, note: f.c.trim() || m.note });
      }
    } catch {
      /* a field that does not fit the record (for example fewer than four digits) keeps the old value */
    }
    closeSheet();
  };
  return (
    <Sheet open onClose={closeSheet} title={t('notes.edit.title')}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {(['a', 'b', 'c'] as const).map((k) => (
          <label key={k} className="mb-[0.8rem] grid gap-[0.35rem] text-small font-semibold text-ink-2">
            {t(`notes.edit.${k}`)}
            <input
              className="field read-only:bg-card-2 read-only:text-ink-2"
              value={f[k]}
              onChange={(e) => setF({ ...f, [k]: e.target.value })}
              readOnly={(k === 'c' && m.kind !== 'appliance') || (k === 'b' && m.kind === 'job')}
            />
          </label>
        ))}
        <button type="submit" className="btn btn-yes w-full">
          {t('save')}
        </button>
      </form>
    </Sheet>
  );
}

/** Give the person the camera box again from anywhere (Help, Set up). */
export const askForCamera = () => (cameraStore.get().state === 'live' ? Promise.resolve('live') : requestCameraAndMic());
