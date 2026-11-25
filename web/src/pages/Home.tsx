// Ask as one conversation (design/CHAT-SPEC.md). Before the first message: a short greeting, the sample pictures and
// a few things to ask; after it, the conversation scrolls, newest at the bottom. The question box stays at the bottom
// the whole time. The camera is never on by itself: the camera button opens it over the page, its own button takes
// the picture, and the camera goes off again. Phone and desktop are the same column (desktop centres it, ~720 px).

import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { hush, patch, pressGuide, useAsk, view, waitingForPress } from '../ask/conversation';
import { setAskUi, takePicture } from '../ask/flows';
import { cameraStore, captureStill, startCamera, stopCamera } from '../engine/camera';
import { CameraWindow } from '../home/Window';
import { Chat, Opening } from '../home/Words';
import { AskSheet } from '../home/AskSheet';
import { PaperDrop } from '../home/PaperDrop';
import { Composer, pressRight, stopNow } from '../home/Composer';
import { Sheet } from '../ui/Sheet';
import { PictureViewer } from '../ui/PictureViewer';
import { I } from '../ui/icons';
import { openSheet, uiStore } from '../ui/uiStore';
import { attachSample, type Sample } from '../samples';
import { t } from '../strings';

/** The camera button opens the camera over the page; its own button takes the picture and closes it. */
function Viewfinder({ video }: { video: React.RefObject<HTMLVideoElement | null> }) {
  const v = useAsk();
  return (
    <Sheet open={v.viewfinder} onClose={() => patch({ viewfinder: false })} title={t('cam.sheet')} size="wide">
      <CameraWindow ref={video} liveOnly className="[--win-h:min(40dvh,24rem)]" />
      <button type="button" className="btn btn-yes mt-4 w-full" onClick={takePicture}>
        <I.cam />
        {t('cam.take')}
      </button>
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
    // Every part a check may need is loaded now, while there is a connection, so a check still runs after the Wi-Fi
    // goes off (a part fetched only on Send would fail then).
    later(() => {
      for (const load of [
        () => import('../reader'),
        () => import('../image'),
        () => import('../textReader'),
        () => import('../coverPicture'),
        () => import('../config'),
        () => import('../lookup'),
        () => import('../webSearch'),
        () => import('../requests'),
        () => import('../explain'),
        () => import('../maps'),
        () => import('../knowledgeBrowser'),
      ])
        void load().catch(() => undefined);
    });
  }, []);

  // The camera is on only while its view is open; closing it (or taking the picture) turns it off.
  useEffect(() => {
    if (!v.viewfinder) stopCamera();
  }, [v.viewfinder]);

  useEffect(() => {
    return () => {
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
      if (ui.drawer || ui.sheet || view().sheet || view().viewfinder) return;
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
    <main className="mx-auto flex min-h-0 w-full max-w-[47rem] flex-1 flex-col px-4">
      {chatting ? <Chat /> : <Opening />}
      <Composer />
      <Viewfinder video={video} />
      <PictureViewer />
      <AskSheet />
      <PaperDrop />
    </main>
  );
}
