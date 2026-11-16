// My checks: every finished answer, kept on this device and grouped into projects.
// Phone: two levels (project cards, then one project's checks as rows). Desktop: both at once.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useData, usePicture, projectName, type Check } from '../store/data';
import { deviceWord } from '../engine/device';
import { I, ToneIcon } from '../ui/icons';
import { PageTitle, VerdictChip } from '../ui/controls';
import { openSheet } from '../ui/uiStore';
import { t, shortDate, type StringId } from '../strings';

const useDesktop = () => {
  const q = '(min-width: 56.25rem)';
  const [d, setD] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setD(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return d;
};

function Thumb({ check, className = '' }: { check: Check; className?: string }) {
  const url = usePicture(check.pictureId);
  if (!check.pictureId)
    return (
      <span className={`thumb words ${className}`}>
        <I.say />
      </span>
    );
  return <span className={`thumb ${className}`}>{url && <img src={url} alt="" />}</span>;
}

const kindText = (c: Check) => t(`kind.${c.kind}` as StringId);

function CheckItem({ c, showProject }: { c: Check; showProject: boolean }) {
  return (
    <button
      type="button"
      className="card lift flex w-full items-center gap-[0.9rem] p-[0.7rem] text-left lg:flex-col lg:items-stretch lg:gap-[0.8rem] lg:px-[0.75rem] lg:pt-[0.75rem] lg:pb-4"
      onClick={() => openSheet({ type: 'check', checkId: c.id })}
    >
      <Thumb check={c} className="w-[6.6rem] flex-none lg:w-full" />
      <span className="grid min-w-0 justify-items-start gap-[0.3rem] lg:px-1">
        <b className="text-body leading-[1.2] font-bold tracking-[-0.015em]">{c.title}</b>
        <span className="text-small text-ink-2">
          {t('check.meta.short', { kind: kindText(c), date: shortDate(c.date) })}
          {showProject ? `, ${projectName(c.projectId)}` : ''}
        </span>
        <VerdictChip tone={c.tone} text={c.verdict} />
      </span>
    </button>
  );
}

export default function Checks() {
  const data = useData();
  const desktop = useDesktop();
  const device = deviceWord();
  const [sel, setSel] = useState<string | null>(null);
  const current = desktop ? (sel ?? 'all') : sel === 'all' ? null : sel;

  useEffect(() => {
    const on = (e: Event) => setSel((e as CustomEvent<string>).detail);
    window.addEventListener('weknow:project', on);
    return () => window.removeEventListener('weknow:project', on);
  }, []);

  const count = (id: string) => data.checks.filter((c) => id === 'all' || c.projectId === id).length;
  const project = data.projects.find((p) => p.id === current);
  const list = data.checks.filter((c) => current === 'all' || c.projectId === current);

  const nav = (
    <aside
      className={`grid grid-cols-[minmax(0,1fr)] gap-[0.8rem] lg:sticky lg:top-0 lg:gap-[0.2rem] lg:rounded-card lg:border lg:border-hair lg:bg-card lg:p-[0.6rem] lg:shadow-d1 ${
        !desktop && current ? 'hidden' : ''
      }`}
      aria-label={t('checks.title')}
    >
      {desktop && (
        <button
          type="button"
          aria-current={current === 'all'}
          className="nav-row min-h-12 justify-between rounded-chip px-[0.9rem] text-body"
          onClick={() => setSel('all')}
        >
          <span>{t('checks.all')}</span>
          <small>{count('all')}</small>
        </button>
      )}
      {data.projects.map((p) => {
        const its = data.checks.filter((c) => c.projectId === p.id);
        const last = its[0];
        if (desktop)
          return (
            <button
              key={p.id}
              type="button"
              aria-current={current === p.id}
              className="nav-row min-h-12 justify-between rounded-chip px-[0.9rem] text-body"
              onClick={() => setSel(p.id)}
            >
              <span>{p.name}</span>
              <small>
                {its.length}
                <span className="sr-only"> {t('project.count', { n: its.length })}</span>
              </small>
            </button>
          );
        return (
          <button key={p.id} type="button" className="card lift block w-full px-[1.1rem] py-[1.05rem] text-left" onClick={() => setSel(p.id)}>
            <span className="flex items-center justify-between gap-2 text-title font-bold tracking-[-0.02em]">
              {p.name}
              <small className="text-small font-semibold tracking-normal text-ink-2">{its.length}</small>
            </span>
            {its.length > 0 && (
              <span className="mt-[0.8rem] mb-[0.7rem] flex gap-2">
                {its.slice(0, 3).map((c) => (
                  <Thumb key={c.id} check={c} className="w-[5.6rem]" />
                ))}
              </span>
            )}
            {last ? (
              <span className="flex items-center gap-[0.4rem] text-small text-ink-2 [&_svg]:size-[1.3rem] [&_svg]:flex-none" data-tone={last.tone}>
                <span className={last.tone === 'ok' ? 'text-go' : last.tone === 'warn' ? 'text-warn-line' : 'text-stop'}>
                  <ToneIcon tone={last.tone} />
                </span>
                <span>
                  {last.title}, {shortDate(last.date)}
                </span>
              </span>
            ) : (
              <span className="mt-1 block text-small text-ink-2">{t('checks.empty.project')}</span>
            )}
          </button>
        );
      })}
      <Link
        to="/remembers"
        className={`card lift flex items-center gap-[0.7rem] px-[1.1rem] py-4 text-body font-semibold text-ink no-underline [&_svg]:flex-none [&>svg:first-child]:size-6 lg:mt-[0.4rem] lg:rounded-none lg:rounded-b-chip lg:border-0 lg:border-t lg:border-hair lg:shadow-none lg:hover:translate-y-0`}
      >
        <I.note />
        <span className="flex-1">{t('menu.notes')}</span>
        <I.chev />
      </Link>
    </aside>
  );

  const main = current ? (
    <section>
      {!desktop && (
        <button type="button" className="btn btn-sm mb-[0.9rem]" onClick={() => setSel(null)}>
          <I.back />
          {t('checks.back')}
        </button>
      )}
      <div className="mb-[0.9rem] flex flex-wrap items-center gap-[0.7rem]">
        <h2 className="min-w-32 flex-1 text-[1.5rem] leading-[1.15] font-bold tracking-[-0.025em]">{project ? project.name : t('checks.all')}</h2>
        {project && (
          <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'name', mode: 'rename', projectId: project.id })}>
            {t('checks.rename')}
          </button>
        )}
      </div>
      {list.length ? (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-[0.8rem] lg:grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] lg:gap-[1.1rem]">
          {list.map((c) => (
            <CheckItem key={c.id} c={c} showProject={current === 'all'} />
          ))}
        </div>
      ) : (
        <p className="py-[0.4rem] text-small text-ink-2">{project ? t('checks.empty.project') : t('checks.empty', { device })}</p>
      )}
    </section>
  ) : null;

  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[40rem] lg:max-w-[76rem]">
        <PageTitle
          action={
            <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'name', mode: 'new' })}>
              <I.plus />
              {t('checks.new')}
            </button>
          }
        >
          {t('checks.title')}
        </PageTitle>
        {!data.checks.length && !desktop && !current && <p className="mb-4 text-small text-ink-2">{t('checks.empty', { device })}</p>}
        <div className="lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)] lg:items-start lg:gap-7">
          {nav}
          {main}
        </div>
      </div>
    </main>
  );
}
