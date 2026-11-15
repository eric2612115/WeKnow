// The frame round every page: the app bar (Menu, wordmark; on a desktop the status and account pills) and the
// Menu drawer. Welcome and Allow have no app bar.

import { Dialog } from 'radix-ui';
import { Suspense, useEffect, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { DeviceIcon, I } from '../ui/icons';
import { Seg, Wordmark } from '../ui/controls';
import { setDrawer, useUi } from '../ui/uiStore';
import { t } from '../strings';
import { setPrefs, usePrefs, type Theme } from '../store/prefs';
import { notesOf, useData } from '../store/data';
import { deviceWord, refreshModel, useDevice } from '../engine/device';
import { firstName, useAccount, watchAccountLater } from '../engine/accountState';
import { Sheets } from './Sheets';
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
    <span className="flex h-[2.6rem] items-center gap-[0.45rem] rounded-full bg-card-2 px-[0.9rem] text-small font-semibold text-ink-2 [&_svg]:size-[1.35rem]">
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
    <button type="button" className="pill-btn px-4" onClick={() => nav('/settings#set-account')}>
      {name ? (
        <>
          <b className="-ml-[0.45rem] grid size-[1.9rem] place-items-center rounded-full bg-go text-small text-on-go">{name[0].toUpperCase()}</b>
          {name}
        </>
      ) : (
        t('bar.signin')
      )}
    </button>
  );
}

function Drawer() {
  const { drawer } = useUi();
  const data = useData();
  const a = useAccount();
  const notes = notesOf(data.memory).length;
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
          <div className="mt-1 mr-1 mb-[0.9rem] ml-2 flex flex-wrap items-center justify-between gap-2">
            <Dialog.Title asChild>
              <span className="min-w-0 text-[min(1.3rem,6.2vw)]">
                <Wordmark />
              </span>
            </Dialog.Title>
            <Dialog.Close className="btn btn-sm" type="button">
              {t('close')}
            </Dialog.Close>
          </div>
          <nav aria-label={t('menu.button')} className="flex flex-col gap-[0.2rem]">
            {row('/', <I.cam />, t('menu.ask'))}
            {row('/checks', <I.folder />, t('menu.checks'), data.checks.length)}
            {row('/remembers', <I.note />, t('menu.notes'), notes)}
            {row('/settings', <I.set />, t('menu.settings'))}
            {row('/help', <I.help />, t('menu.help'))}
          </nav>
          <div className="mt-auto grid gap-[0.8rem] border-t border-hair px-[0.4rem] pt-[0.9rem] pb-[0.3rem]">
            <span className="text-small font-semibold text-ink-2">{t('menu.screen')}</span>
            <ThemeSeg full />
            <NavLink to="/settings#set-account" className="nav-row px-2" onClick={() => setDrawer(false)}>
              {a?.signedIn ? (
                <>
                  <span className="grid size-[2.4rem] place-items-center rounded-full bg-go text-[1.1rem] font-bold text-on-go">
                    {(a.name ?? a.email ?? '?')[0].toUpperCase()}
                  </span>
                  <span>{a.name ?? a.email}</span>
                </>
              ) : (
                <>
                  <span className="grid size-[2.4rem] place-items-center rounded-full bg-card-2 text-ink-2 [&_svg]:size-[1.4rem]">
                    <I.user />
                  </span>
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
    } else if (loc.pathname !== '/') document.getElementById('page')?.scrollTo({ top: 0 });
  }, [loc.pathname, loc.hash]);

  if (!p.started && loc.pathname === '/') return <Welcome />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg">
      <header className="flex h-[3.9rem] flex-none items-center gap-[0.8rem] px-4 lg:h-[4.4rem] lg:px-7">
        <button type="button" className="pill-btn" aria-haspopup="dialog" onClick={() => setDrawer(true)}>
          <I.menu />
          <span>{t('menu.button')}</span>
        </button>
        <NavLink to="/" className="inline-flex min-h-11 min-w-0 items-center text-[min(1.3rem,6.2vw)] text-ink no-underline lg:text-[1.45rem]" aria-label="WeKnow, Ask">
          <Wordmark />
        </NavLink>
        <div className="ml-auto hidden items-center gap-[0.6rem] lg:flex">
          <StatusPill />
          <AccountPill />
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
