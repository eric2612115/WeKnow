// Ask: the camera is home. Phone: one column, window, words, one big button. Desktop: the camera in a large card
// with the button under it; on the right the words, where the answer came from, and sample pictures.

import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  finishListening,
  hush,
  patch,
  pressGuide,
  useAsk,
  view,
  waitingForPress,
} from '../ask/conversation';
import { setAskUi, startAsk } from '../ask/flows';
import { cameraStore, captureStill, permission, startCamera, stopCamera } from '../engine/camera';
import { deviceWord } from '../engine/device';
import { CameraWindow } from '../home/Window';
import { Words } from '../home/Words';
import { AskSheet } from '../home/AskSheet';
import { ChoosePhoto, SampleButtons } from '../app/Sheets';
import { Lanes, WhereTag } from '../ui/Receipt';
import { I, StopFace } from '../ui/icons';
import { openSheet, uiStore } from '../ui/uiStore';
import { chooseSample, type Sample } from '../samples';
import { t } from '../strings';

function bigPress() {
  const v = view();
  if (v.phase === 'listening') return finishListening();
  if (v.phase === 'looking' || v.phase === 'speaking') {
    hush();
    if (v.head || v.lines.length) patch({ phase: 'settled', looking: !!v.still });
    else patch({ phase: 'ready', still: null, looking: false });
    return;
  }
  if (v.phase === 'guide') {
    if (waitingForPress()) pressGuide('next');
    return;
  }
  startAsk();
}

function BigButton() {
  const v = useAsk();
  const face = v.phase === 'listening' ? 'listen' : v.phase === 'looking' || v.phase === 'speaking' ? 'stop' : v.phase === 'guide' ? 'next' : 'ask';
  const bars = [0.5, 0.8, 1, 0.75, 0.55];
  return (
    <button type="button" className="big" data-face={face} onClick={bigPress}>
      {face === 'ask' && (
        <>
          <I.mic />
          <span>{t('btn.ask')}</span>
        </>
      )}
      {face === 'stop' && (
        <>
          <StopFace />
          <span>{t('btn.stop')}</span>
        </>
      )}
      {face === 'next' && (
        <>
          <I.next />
          <span>{t('btn.next')}</span>
        </>
      )}
      {face === 'listen' && (
        <>
          <span className={`bars ${v.level > 0.02 ? '' : 'idle'}`} aria-hidden="true">
            {bars.map((b, i) => (
              <i key={i} style={v.level > 0.02 ? { ['--h' as string]: `${0.7 + Math.min(1, v.level * b * 1.6) * 2}rem` } : undefined} />
            ))}
          </span>
          <span className="sr-only">{t('btn.listening')}</span>
        </>
      )}
    </button>
  );
}

function Deck() {
  const v = useAsk();
  const guide = v.phase === 'guide';
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center justify-items-center gap-2 px-1 pt-[0.55rem] pb-[calc(1.2rem+env(safe-area-inset-bottom))] lg:grid-cols-[auto_auto_auto] lg:justify-center lg:gap-x-[1.4rem] lg:pt-[0.4rem] lg:pb-[0.2rem]">
      <button type="button" className={`flank ${guide ? '' : 'invisible'}`} onClick={() => pressGuide('again')} tabIndex={guide ? 0 : -1}>
        <I.again />
        <span>{t('btn.again')}</span>
      </button>
      <BigButton />
      <button type="button" className={`flank ${guide ? '' : 'invisible'}`} onClick={() => pressGuide('stop')} tabIndex={guide ? 0 : -1}>
        <StopFace />
        <span>{t('btn.stop')}</span>
      </button>
      <p className="col-span-full mt-2 hidden text-small text-ink-2 lg:block">
        <kbd>Space</kbd> {t('home.space').replace(/^Space /, '')}
      </p>
    </div>
  );
}

function ReceiptCard() {
  const v = useAsk();
  if (!v.receipt) return null;
  const device = deviceWord();
  return (
    <section
      className="card flex-none animate-rise rounded-win px-[1.3rem] pt-[1.1rem] pb-[0.7rem]"
      style={{ borderColor: v.receipt.w === 'local' || v.receipt.w === 'offline' ? undefined : 'var(--w)' }}
      data-where={v.receipt.w}
      aria-label={t('where.title')}
    >
      <WhereTag r={v.receipt} device={device} className="mb-1" />
      <Lanes r={v.receipt} device={device} picture={v.still} />
      <button
        type="button"
        className="min-h-11 text-small font-semibold text-ink underline underline-offset-[0.2em]"
        onClick={() => openSheet({ type: 'receipt' })}
      >
        {t('where.more')}
      </button>
    </section>
  );
}

function SamplesCard() {
  return (
    <section className="card flex-none rounded-win px-[1.3rem] pt-[1.1rem] pb-[1.2rem]">
      <h3 className="mb-[0.7rem] text-body font-bold tracking-[-0.015em]">{t('home.samples')}</h3>
      <SampleButtons />
      <ChoosePhoto className="mt-4" />
    </section>
  );
}

export default function Home() {
  const v = useAsk();
  const video = useRef<HTMLVideoElement>(null);
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();

  // The page gives the flows what only it has: the video for a still, and the way to other pages.
  useEffect(() => {
    setAskUi({
      capture: async () => {
        const cur = view();
        if (cur.chosen) return { blob: cur.chosen.blob, fromCamera: false };
        if (cameraStore.get().state !== 'live' && (await startCamera()) !== 'live') return null;
        const el = video.current;
        if (!el) return null;
        for (let i = 0; i < 20 && !el.videoWidth; i++) await new Promise((r) => setTimeout(r, 100));
        const still = await captureStill(el);
        return still ? { ...still, fromCamera: true } : null;
      },
      cameraState: () => cameraStore.get().state,
      navigate: (p) => nav(p),
      openSamples: () => openSheet({ type: 'samples' }),
      openReminder: (r) => openSheet({ type: 'reminder', title: r.title }),
    });
  }, [nav]);

  // The camera runs only while Ask is open; it is never asked for here without a press.
  useEffect(() => {
    let live = true;
    void permission('camera').then((p) => {
      if (live && (p === 'granted' || cameraStore.get().state === 'live')) void startCamera();
      else if (live && p === 'denied') cameraStore.set({ state: 'blocked', stream: null });
    });
    return () => {
      live = false;
      const p = view().phase;
      hush();
      if (p === 'listening' || p === 'looking') patch({ phase: view().head ? 'settled' : 'ready', reading: false });
      else if (p === 'speaking' || p === 'waiting' || p === 'guide') patch({ phase: view().head ? 'settled' : 'ready' });
      stopCamera();
    };
  }, []);

  // ?sample=quote opens a sample picture (used by Help and by links shared with reviewers).
  useEffect(() => {
    const s = params.get('sample') as Sample['id'] | null;
    if (s) {
      void chooseSample(s);
      params.delete('sample');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // Keyboard: Space is the big button; Escape is Stop; right arrow Next; left arrow Again.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = uiStore.get();
      if (ui.drawer || ui.sheet || view().sheet) return;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() ?? '';
      const free = !/^(button|input|select|textarea|summary|a)$/.test(tag);
      const p = view().phase;
      if (e.key === ' ' && free) {
        e.preventDefault();
        bigPress();
      } else if (e.key === 'Escape' && (p === 'looking' || p === 'speaking' || p === 'listening')) bigPress();
      else if (e.key === 'Escape' && p === 'guide') pressGuide('stop');
      else if (e.key === 'ArrowRight' && p === 'guide') pressGuide('next');
      else if (e.key === 'ArrowLeft' && p === 'guide') pressGuide('again');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const phase = v.phase;
  const winH = phase === 'guide' ? '40dvh' : phase === 'ready' || phase === 'listening' ? '50dvh' : '20dvh';
  const showSamples = !(phase === 'listening' || phase === 'looking' || phase === 'guide');
  const nothingAsked = !v.head && !v.receipt;

  return (
    <main
      className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-[0.8rem] px-4 pt-[0.1rem] transition-[grid-template-rows] duration-[320ms] ease-wk md:mx-auto md:w-full md:max-w-[40rem] lg:max-w-[90rem] lg:grid-cols-[minmax(0,1.32fr)_minmax(23rem,1fr)] lg:!grid-rows-[minmax(0,1fr)] lg:gap-6 lg:px-7 lg:pt-1 lg:pb-7"
      style={{ gridTemplateRows: `${winH} minmax(0,1fr) auto` }}
    >
      {/* phone: window, words, button. desktop: left card holds window and button */}
      <div className="contents lg:grid lg:min-h-0 lg:grid-rows-[minmax(0,1fr)_auto] lg:gap-[0.9rem] lg:rounded-[2.25rem] lg:border lg:border-hair lg:bg-card lg:p-[0.9rem] lg:shadow-d2">
        <CameraWindow ref={video} className="row-start-1 lg:row-auto lg:shadow-none" />
        <div className="row-start-3 lg:row-auto">
          <Deck />
        </div>
      </div>
      <div className="row-start-2 min-h-0 lg:hidden">
        <div className="flex h-full min-h-0 flex-col">
          <Words />
        </div>
      </div>
      <aside className="hidden min-h-0 flex-col gap-4 overflow-auto px-[0.2rem] pt-[0.1rem] pb-2 lg:flex" aria-label={t('where.title')}>
        {showSamples && nothingAsked && <SamplesCard />}
        <Words desktop />
        <ReceiptCard />
        {showSamples && !nothingAsked && <SamplesCard />}
      </aside>
      <AskSheet />
    </main>
  );
}
