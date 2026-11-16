// Ask as one conversation (design/CHAT-SPEC.md). Before the first message the live camera fills the top, with the
// greeting and the sample pictures under it; after it, the conversation scrolls, newest at the bottom. The question
// box stays at the bottom the whole time. Phone and desktop are the same column (desktop centres it).

import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { hush, patch, pressGuide, useAsk, view, waitingForPress } from '../ask/conversation';
import { setAskUi, takePicture } from '../ask/flows';
import { cameraStore, captureStill, permission, startCamera, stopCamera } from '../engine/camera';
import { CameraWindow } from '../home/Window';
import { Chat, Opening } from '../home/Words';
import { AskSheet } from '../home/AskSheet';
import { Composer, pressRight, stopNow } from '../home/Composer';
import { ChoosePhoto, SampleButtons } from '../app/Sheets';
import { Sheet } from '../ui/Sheet';
import { I } from '../ui/icons';
import { openSheet, uiStore } from '../ui/uiStore';
import { attachSample, type Sample } from '../samples';
import { t } from '../strings';

/** Once the conversation has started, the camera button opens the camera over it; its own button takes the picture. */
function Viewfinder({ video }: { video: React.RefObject<HTMLVideoElement | null> }) {
  const v = useAsk();
  return (
    <Sheet open={v.viewfinder} onClose={() => patch({ viewfinder: false })} title={t('cam.sheet')} size="wide">
      <CameraWindow ref={video} liveOnly className="h-[min(52dvh,30rem)]" />
      <button type="button" className="btn btn-yes mt-4 w-full" onClick={takePicture}>
        <I.cam />
        {t('cam.take')}
      </button>
      <ChoosePhoto className="mt-3 w-full" />
      <div className="mt-4">
        <p className="mb-2 text-small font-semibold text-ink-2">{t('home.samples')}</p>
        <SampleButtons compact onPick={(id) => void attachSample(id)} />
      </div>
    </Sheet>
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
      snap: async () => {
        if (cameraStore.get().state !== 'live') return null;
        const el = video.current;
        if (!el) return null;
        for (let i = 0; i < 20 && !el.videoWidth; i++) await new Promise((r) => setTimeout(r, 100));
        const still = await captureStill(el);
        return still ? { ...still, fromCamera: true } : null;
      },
      cameraState: () => cameraStore.get().state,
      startCamera,
      navigate: (p) => nav(p),
      openSamples: () => openSheet({ type: 'samples' }),
      openReminder: (r) => openSheet({ type: 'reminder', title: r.title }),
    });
  }, [nav]);

  // The reader (Firebase, App Check) is warmed up once Ask has painted, so the first read does not wait for it.
  useEffect(() => {
    const later = (fn: () => void) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 600));
    later(() => void import('../reader').catch(() => undefined));
  }, []);

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
      void attachSample(s);
      params.delete('sample');
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  // Keyboard, outside the question box: Space presses Next in step by step, otherwise the box's right-hand button
  // (speak, send, finish, stop). Escape is Stop; right arrow Next; left arrow Again. Typing in the box is never caught.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ui = uiStore.get();
      if (ui.drawer || ui.sheet || view().sheet) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase() ?? '';
      const free = !/^(button|input|select|textarea|summary|a)$/.test(tag) && !el?.isContentEditable;
      const p = view().phase;
      if (e.key === ' ' && free) {
        e.preventDefault();
        if (p === 'guide') {
          if (waitingForPress()) pressGuide('next');
        } else pressRight();
      } else if (e.key === 'Escape' && p === 'listening') pressRight();
      else if (e.key === 'Escape' && (p === 'looking' || p === 'speaking')) stopNow();
      else if (e.key === 'Escape' && p === 'guide') pressGuide('stop');
      else if (e.key === 'ArrowRight' && p === 'guide') pressGuide('next');
      else if (e.key === 'ArrowLeft' && p === 'guide') pressGuide('again');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const chatting = v.history.some((m) => m.who === 'me');

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-[46rem] flex-1 flex-col px-4 pt-[0.1rem] lg:px-6">
      {chatting ? (
        <Chat />
      ) : (
        <>
          <CameraWindow ref={video} className="h-[max(6rem,min(42dvh,calc(100dvh-27rem)))] flex-none" />
          <Opening />
        </>
      )}
      <Composer />
      {chatting && <Viewfinder video={video} />}
      <AskSheet />
    </main>
  );
}
