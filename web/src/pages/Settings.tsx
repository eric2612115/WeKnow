// Settings: one column of cards on a phone; on a desktop a list of the sections that stays in view and jumps to
// each card. Silent page: nothing here speaks except the voice-speed sample.

import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { setPrefs, usePrefs, resetPrefs } from '../store/prefs';
import { notesOf, useData, wipeAll } from '../store/data';
import { deviceWord } from '../engine/device';
import { signIn, signOut, useAccount, watchAccountLater } from '../engine/accountState';
import { Card, CardTitle, PageTitle, Seg, Toggle } from '../ui/controls';
import { DeviceIcon, I } from '../ui/icons';
import { openSheet } from '../ui/uiStore';
import { ThemeSeg } from '../app/Shell';
import { DeviceRow, RateSeg, SizeSeg } from '../app/Sheets';
import { resetView } from '../ask/conversation';
import { mailState, useMail } from '../engine/mailState';
import { t } from '../strings';

const SECTIONS = [
  ['account', 'set.account'],
  ['voice', 'set.voice.title'],
  ['look', 'set.screen.title'],
  ['lang', 'set.lang.title'],
  ['privacy', 'set.privacy'],
  ['notes', 'set.notes'],
  ['mail', 'set.mail'],
  ['family', 'set.family'],
  ['delete', 'set.delete'],
] as const;

function Row({ title, fine, children, wrap = false }: { title: string; fine?: string; children?: ReactNode; wrap?: boolean }) {
  return (
    <div className={`row ${wrap ? 'flex-wrap gap-y-2' : ''}`}>
      <span className="min-w-0">
        {title}
        {fine && <small>{fine}</small>}
      </span>
      {children}
    </div>
  );
}

function Account() {
  const a = useAccount();
  const [msg, setMsg] = useState('');
  const device = deviceWord();
  watchAccountLater();
  return (
    <Card id="set-account" className="scroll-mt-4">
      <CardTitle>{t('set.account')}</CardTitle>
      <div className="mt-[0.3rem] mb-[0.9rem] flex items-center gap-[0.9rem]">
        {a?.signedIn ? (
          <span className="grid size-[3.2rem] flex-none place-items-center rounded-full bg-go text-[1.4rem] font-bold text-on-go">
            {(a.name ?? a.email ?? '?')[0].toUpperCase()}
          </span>
        ) : (
          <span className="grid size-[3.2rem] flex-none place-items-center rounded-full bg-card-2 text-ink-2 [&_svg]:size-[1.6rem]">
            <I.user />
          </span>
        )}
        <div>
          <b className="block text-body font-bold">{a?.signedIn ? (a.name ?? a.email) : t('set.account.out.title')}</b>
          <span className="text-small text-ink-2">{a?.signedIn ? a.email : t('set.account.out')}</span>
        </div>
      </div>
      <p className="text-small text-ink-2">{t('set.account.line', { device })}</p>
      <button
        type="button"
        className={`btn mt-[0.9rem] ${a?.signedIn ? '' : 'btn-yes'}`}
        onClick={async () => {
          setMsg('');
          try {
            if (a?.signedIn) await signOut();
            else await signIn();
          } catch (e) {
            console.warn('[WeKnow] sign-in', e);
            setMsg(t('read.fail.title'));
          }
        }}
      >
        {a?.signedIn ? t('set.signout') : t('set.signin')}
      </button>
      {msg && <p className="mt-2 text-small text-ink-2">{msg}</p>}
    </Card>
  );
}

function Mail() {
  const m = useMail();
  const nav = useNavigate();
  const device = deviceWord();
  return (
    <Card id="set-mail" className="scroll-mt-4">
      <CardTitle>{t('set.mail')}</CardTitle>
      <p className="text-small text-ink-2">{t('set.mail.line', { device })}</p>
      <div className="row mt-2">
        <span className="flex items-center gap-2 [&_svg]:size-6">
          <I.mail />
          {m.connected ? t('set.mail.on') : t('set.mail.off')}
        </span>
        {m.connected ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm" onClick={() => nav('/mail')}>
              {t('set.mail.open')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => void mailState.disconnect()}>
              {t('set.mail.disconnect')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-sm"
            onClick={async () => {
              if (await mailState.connect()) nav('/mail');
            }}
          >
            {t('set.mail.connect')}
          </button>
        )}
      </div>
      {m.error && <p className="text-small text-ink-2">{m.error}</p>}
    </Card>
  );
}

export default function Settings() {
  const p = usePrefs();
  const data = useData();
  const device = deviceWord();
  const nav = useNavigate();
  const notes = notesOf(data.memory).filter((g) => g[0].kind !== 'payee').length;
  const payees = data.memory.filter((m) => m.kind === 'payee').length;

  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[40rem] lg:max-w-[76rem]">
        <PageTitle>{t('set.title')}</PageTitle>
        <div className="lg:grid lg:grid-cols-[15.5rem_minmax(0,46rem)] lg:items-start lg:gap-7">
          <nav
            aria-label="Sections"
            className="hidden lg:sticky lg:top-0 lg:grid lg:gap-[0.15rem] lg:rounded-card lg:border lg:border-hair lg:bg-card lg:p-[0.6rem] lg:shadow-d1"
          >
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#set-${id}`} className="nav-row min-h-12 text-small" onClick={(e) => {
                e.preventDefault();
                document.getElementById(`set-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
              }}>
                {t(label)}
              </a>
            ))}
          </nav>
          <div className="grid gap-4">
            <Account />
            <Card id="set-voice" className="scroll-mt-4">
              <CardTitle>{t('set.voice.title')}</CardTitle>
              <Row title={t('set.voice')} fine={t('set.voice.fine')}>
                <Toggle checked={p.voice} onChange={(voice) => setPrefs({ voice })} label={t('set.voice')} />
              </Row>
              <Row title={t('set.speed')} wrap>
                <RateSeg />
              </Row>
              <Row title={t('set.size')}>
                <SizeSeg />
              </Row>
            </Card>
            <Card id="set-look" className="scroll-mt-4">
              <CardTitle>{t('set.screen.title')}</CardTitle>
              <Row title={t('set.screen')} fine={t('set.screen.fine', { device })} wrap>
                <ThemeSeg />
              </Row>
            </Card>
            <Card id="set-lang" className="scroll-mt-4">
              <CardTitle>{t('set.lang.title')}</CardTitle>
              <Row title={t('set.lang')} wrap>
                <Seg
                  label={t('set.lang')}
                  value="en"
                  onChange={() => undefined}
                  options={[
                    { value: 'en', label: t('set.lang.en') },
                    { value: 'zh', label: t('set.lang.zh'), disabled: true, aria: `${t('set.lang.zh')}. ${t('soon')}` },
                  ]}
                />
              </Row>
            </Card>
            <Card id="set-privacy" className="scroll-mt-4">
              <CardTitle>{t('set.privacy')}</CardTitle>
              <div className="my-[0.6rem] mb-[0.4rem] grid gap-[0.8rem] lg:grid-cols-2">
                <div className="rounded-btn bg-card-2 px-4 py-[0.9rem]">
                  <h3 className="mb-[0.4rem] flex items-center gap-2 text-body font-bold [&_svg]:size-6 [&_svg]:flex-none">
                    <DeviceIcon device={device} />
                    {t('set.privacy.stays', { device })}
                  </h3>
                  <ul className="grid gap-1 text-small">
                    {(['set.privacy.stays.1', 'set.privacy.stays.2', 'set.privacy.stays.3', 'set.privacy.stays.4'] as const).map((k) => (
                      <li key={k}>{t(k)}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-btn bg-net-bg px-4 py-[0.9rem]">
                  <h3 className="mb-[0.4rem] flex items-center gap-2 text-body font-bold text-net [&_svg]:size-6 [&_svg]:flex-none">
                    <I.net />
                    {t('set.privacy.goes')}
                  </h3>
                  <ul className="grid gap-1 text-small">
                    <li>{t('set.privacy.goes.1')}</li>
                    <li>{t('set.privacy.goes.2', { device })}</li>
                  </ul>
                </div>
              </div>
              <Row title={t('set.every')}>
                <Toggle checked={p.askEvery} onChange={(askEvery) => setPrefs({ askEvery })} label={t('set.every')} />
              </Row>
              <div className="row flex-col items-stretch">
                <DeviceRow />
              </div>
            </Card>
            <Card id="set-notes" className="scroll-mt-4">
              <CardTitle>{t('set.notes')}</CardTitle>
              <p className="text-small text-ink-2">{t('set.notes.line', { device })}</p>
              <Link to="/remembers" className="nav-row mt-2 px-1">
                <I.note />
                <span>{t('set.notes.rows')}</span>
                <small>{notes === 1 ? t('set.notes.count.1') : t('set.notes.count', { n: notes })}</small>
              </Link>
              <Link to="/remembers" className="nav-row px-1">
                <I.user />
                <span>{t('set.payees.rows')}</span>
                <small>{payees}</small>
              </Link>
            </Card>
            <Mail />
            <Card id="set-family" className="scroll-mt-4">
              <CardTitle>{t('set.family')}</CardTitle>
              <Row
                title={t('set.call')}
                fine={p.trustedName && p.trustedNumber ? t('set.call.fine', { name: p.trustedName, number: p.trustedNumber, device }) : t('set.call.none', { device })}
              >
                <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'trusted' })}>
                  {t('set.change')}
                </button>
              </Row>
              <Row title={t('set.setup')} fine={t('set.setup.fine')}>
                <button type="button" className="btn btn-sm" onClick={() => openSheet({ type: 'setup' })}>
                  {t('set.open')}
                </button>
              </Row>
            </Card>
            <Card id="set-delete" className="scroll-mt-4">
              <CardTitle>{t('set.delete')}</CardTitle>
              <p className="text-small text-ink-2">{t('set.delete.line', { device })}</p>
              <button
                type="button"
                className="btn btn-danger mt-[0.9rem]"
                onClick={() =>
                  openSheet({
                    type: 'confirm',
                    title: t('set.delete.ask'),
                    body: t('set.delete.body', { device }),
                    yes: t('set.delete.yes'),
                    onYes: async () => {
                      await wipeAll();
                      resetPrefs();
                      resetView();
                      void mailState.disconnect();
                      nav('/settings');
                    },
                  })
                }
              >
                {t('set.delete')}
              </button>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
