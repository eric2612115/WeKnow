// The frame round every page: a quiet app bar (the menu, the name, a new conversation, the sound switch; on a desktop
// also the status and the account) and the Menu drawer. Welcome and Allow have no app bar.

import { Dialog } from 'radix-ui';
import { Suspense, useEffect, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { DeviceIcon, I } from '../ui/icons';
import { Seg, Wordmark } from '../ui/controls';
import { openSheet, setDrawer, useUi } from '../ui/uiStore';
import { t } from '../strings';
import { getPrefs, setPrefs, usePrefs, type Theme } from '../store/prefs';
import { notesOf, useData } from '../store/data';
import { deviceWord, refreshModel, useDevice } from '../engine/device';
import { quiet } from '../engine/speech';
import { firstName, useAccount, watchAccountLater } from '../engine/accountState';
import { Sheets } from './Sheets';
import { startAgain } from '../ask/flows';
import Welcome from '../pages/Welcome';

export function ThemeSeg({ full = false }: { full?: boolean }) {
  const p = usePrefs();
  return (
    <Seg<Theme>
      label={t('menu.screen')}
      value={p.theme}
      onChange={(theme) => setPrefs({ theme })}
      className={full ? 'w-full [&>button]:flex-1 [&>button]:px-1 max-[22.5rem]:flex-col max-[22.5rem]:[&>button]:w-full' : ''}
      options={[
        { value: 'light', label: <><I.sun />{t('theme.light')}</> },
        { value: 'dark', label: <><I.moon />{t('theme.dark')}</> },
        { value: 'system', label: t('theme.system') },
      ]}
    />
  );
}

function StatusPill() {
  const d = useDevice();
  const device = deviceWord();
  let icon = <DeviceIcon device={device} />;
  let text = t('status.ready');
  if (!d.online) {
    icon = <I.nonet />;
    text = t('status.none');
  } else if (d.pct !== null) text = d.almost ? t('ready.almost') : t('note.getting', { n: d.pct });
  else if (d.model !== 'available') {
    icon = <I.net />;
    text = t('status.cloud');
  }
  if (d.model === 'checking' && d.online) return null;
  return (
    <span className="flex h-11 items-center gap-[0.4rem] px-2 text-[0.9375rem] font-medium text-ink-2 [&_svg]:size-[1.15rem]">
      {icon}
      <span>{text}</span>
    </span>
  );
}

function AccountPill() {
  const a = useAccount();
  const nav = useNavigate();
  const name = firstName(a);
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center gap-2 rounded-full px-3 text-[0.9375rem] font-semibold text-ink transition-colors hover:bg-card-2"
      onClick={() => nav('/settings#set-account')}
    >
      {name ? (
        <>
          <b className="-ml-1 grid size-7 place-items-center rounded-full bg-go text-[0.875rem] text-on-go">{name[0].toUpperCase()}</b>
          {name}
        </>
      ) : (
        t('bar.signin')
      )}
    </button>
  );
}

/** Sound on or off. Off cuts what is being said now; the words stay on screen. */
function SoundButton() {
  const p = usePrefs();
  const label = p.voice ? t('btn.sound.mute') : t('btn.sound.unmute');
  return (
    <button
      type="button"
      className="bar-btn"
      data-off={p.voice ? undefined : ''}
      aria-label={label}
      title={label}
      onClick={() => {
        const on = !getPrefs().voice;
        setPrefs({ voice: on });
        if (!on) quiet();
      }}
    >
      {p.voice ? <I.sound /> : <I.soundOff />}
    </button>
  );
}

/** A new conversation: the same as Menu › Start again. */
function NewButton() {
  const nav = useNavigate();
  return (
    <button
      type="button"
      className="bar-btn"
      aria-label={t('bar.new')}
      title={t('bar.new')}
      onClick={() => {
        startAgain();
        nav('/app');
      }}
    >
      <I.compose />
    </button>
  );
}

function Drawer() {
  const { drawer } = useUi();
  const nav = useNavigate();
  const data = useData();
  const a = useAccount();
  const notes = notesOf(data.memory).length;
  const recent = [...data.checks].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const row = (to: string, icon: ReactNode, label: string, count?: number) => (
    <NavLink to={to} end className="nav-row" onClick={() => setDrawer(false)}>
      {icon}
      <span>{label}</span>
      {count ? <small>{count}</small> : null}
    </NavLink>
  );
  return (
    <Dialog.Root open={drawer} onOpenChange={setDrawer}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className="drawer" aria-describedby={undefined}>
          <div className="mb-2 ml-3 flex items-center justify-between gap-2">
            <Dialog.Title asChild>
              <span className="min-w-0 text-[1.125rem]">
                <Wordmark />
              </span>
            </Dialog.Title>
            <Dialog.Close className="bar-btn" type="button" aria-label={t('close')} title={t('close')}>
              <I.close />
            </Dialog.Close>
          </div>
          <nav aria-label={t('menu.button')} className="flex flex-col gap-[0.15rem]">
            <button
              type="button"
              className="nav-row w-full text-left"
              onClick={() => {
                setDrawer(false);
                startAgain();
                nav('/app');
              }}
            >
              <I.compose />
              <span>{t('bar.new')}</span>
            </button>
            {row('/checks', <I.folder />, t('menu.checks'), data.checks.length)}
            {row('/remembers', <I.note />, t('menu.notes'), notes)}
            {row('/packs', <I.book />, t('menu.packs'))}
            {row('/settings', <I.set />, t('menu.settings'))}
            {row('/help', <I.help />, t('menu.help'))}
            {row('/', <I.how />, t('menu.how'))}
          </nav>
          {recent.length > 0 && (
            <section className="mt-4 min-h-0" aria-label={t('menu.recent')}>
              <h2 className="px-3 pb-1 text-[0.9375rem] font-medium text-ink-2">{t('menu.recent')}</h2>
              <div className="flex flex-col gap-[0.15rem]">
                {recent.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="nav-row nav-recent w-full"
                    onClick={() => {
                      setDrawer(false);
                      openSheet({ type: 'check', checkId: c.id });
                    }}
                  >
                    <span>{c.title}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <div className="mt-auto grid gap-[0.6rem] px-[0.4rem] pt-6 pb-[0.3rem]">
            <span className="text-[0.9375rem] font-medium text-ink-2">{t('menu.screen')}</span>
            <ThemeSeg full />
            <NavLink to="/settings#set-account" className="nav-row px-2" onClick={() => setDrawer(false)}>
              {a?.signedIn ? (
                <>
                  <b className="grid flex-none size-8 place-items-center rounded-full bg-go text-[0.9375rem] font-bold text-on-go">
                    {(a.name ?? a.email ?? '?')[0].toUpperCase()}
                  </b>
                  <span>{a.name ?? a.email}</span>
                </>
              ) : (
                <>
                  <b className="grid flex-none size-8 place-items-center rounded-full bg-card-2 text-ink-2 [&_svg]:size-[1.1rem]">
                    <I.user />
                  </b>
                  <span>{t('menu.signedout')}</span>
                </>
              )}
            </NavLink>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function Shell() {
  const p = usePrefs();
  const loc = useLocation();
  useEffect(() => {
    if (!p.started) return;
    const later = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
    later(() => {
      void refreshModel();
      watchAccountLater();
    });
  }, [p.started]);
  useEffect(() => {
    if (loc.hash) {
      const el = document.getElementById(loc.hash.slice(1));
      el?.scrollIntoView({ block: 'start' });
    } else if (loc.pathname !== '/app') document.getElementById('page')?.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);

  if (!p.started && loc.pathname === '/app') return <Welcome />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex h-14 flex-none items-center gap-1 px-2 lg:px-3">
        <button type="button" className="bar-btn" aria-haspopup="dialog" aria-label={t('menu.button')} title={t('menu.button')} onClick={() => setDrawer(true)}>
          <I.menu />
        </button>
        <NavLink to="/app" className="inline-flex min-h-11 min-w-0 items-center px-1 text-[1.125rem] text-ink no-underline" aria-label="WeKnow, Ask">
          <Wordmark />
        </NavLink>
        <div className="ml-auto flex flex-none items-center gap-1">
          <span className="hidden items-center gap-1 lg:flex">
            <StatusPill />
            <AccountPill />
          </span>
          <NewButton />
          <SoundButton />
        </div>
      </header>
      <Suspense fallback={<div className="flex-1" />}>
        <Outlet />
      </Suspense>
      <Drawer />
      <Sheets />
    </div>
  );
}
