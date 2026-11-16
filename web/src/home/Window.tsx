// The camera window: the live camera, or the picture being read, whole and never cropped. The window takes the shape
// of what it shows (as tall as `--win-h` allows), so there are no bars round the picture and no frame inside a frame.
// A line sweeps while WeKnow reads a paper. Labels on the picture are small white pills, the same in both themes.

import { forwardRef, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useAsk } from '../ask/conversation';
import { useCamera } from '../engine/camera';
import { deviceWord, useDevice } from '../engine/device';
import { DeviceIcon, I } from '../ui/icons';
import { backToCamera } from '../samples';
import { t } from '../strings';

/** `liveOnly`: always the live camera (the camera opened over the conversation), never a picture. */
export const CameraWindow = forwardRef<HTMLVideoElement, { className?: string; liveOnly?: boolean }>(function CameraWindow({ className = '', liveOnly = false }, ref) {
  const v = useAsk();
  const cam = useCamera();
  const d = useDevice();
  const video = useRef<HTMLVideoElement | null>(null);
  const [camShape, setCamShape] = useState(4 / 3);
  const [picShape, setPicShape] = useState<{ url: string; shape: number } | null>(null);

  // The camera's own shape (a phone held upright is taller than wide), kept up to date when it turns.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const read = () => {
      if (el.videoWidth && el.videoHeight) setCamShape(el.videoWidth / el.videoHeight);
    };
    read();
    el.addEventListener('loadedmetadata', read);
    el.addEventListener('resize', read);
    return () => {
      el.removeEventListener('loadedmetadata', read);
      el.removeEventListener('resize', read);
    };
  }, []);

  useEffect(() => {
    const el = video.current;
    if (el && cam.stream && el.srcObject !== cam.stream) {
      el.srcObject = cam.stream;
      void el.play().catch(() => undefined);
    }
  }, [cam.stream, v.still, v.chosen]);

  const picture = liveOnly ? null : (v.still ?? v.chosen?.url ?? null);
  const live = !picture && cam.state === 'live';
  const off = !picture && (cam.state === 'blocked' || cam.state === 'none');
  const looking = !liveOnly && (!!v.still || v.looking);
  const chip = v.chip ?? (live ? 'live' : null);
  const device = deviceWord();

  // Bottom label, phone only and only when it matters.
  let note: { icon: ReactNode; text: string } | null = null;
  if (d.pct !== null) note = { icon: <DeviceIcon device={device} />, text: d.almost ? t('ready.almost') : t('note.getting', { n: d.pct }) };
  else if (!d.online && d.model === 'available' && (v.phase === 'ready' || v.phase === 'listening'))
    note = { icon: <I.nonet />, text: t('note.offline') };

  // Very long or very wide pictures are fitted inside a gentler shape instead.
  const raw = picture ? (picShape?.url === picture ? picShape.shape : 4 / 3) : camShape;
  const shape = Math.min(2, Math.max(0.62, raw));
  const size: CSSProperties = off
    ? { width: '100%', height: '7.5rem' }
    : { aspectRatio: String(shape), width: `min(100%, calc(var(--win-h, 18rem) * ${shape.toFixed(4)}))` };

  return (
    <div className={`win ${looking ? 'looking' : ''} ${v.reading ? 'reading' : ''} ${className}`} style={size}>
      {/* the live camera stays mounted so the stream keeps running behind a still */}
      <video
        ref={(el) => {
          video.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        className={`absolute inset-0 size-full object-contain transition-[filter] duration-300 ${live ? '' : 'invisible'} ${v.dim ? 'brightness-[.16]' : ''}`}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />
      {picture && (
        <img
          src={picture}
          alt=""
          className={`absolute inset-0 size-full object-contain ${v.dim ? 'brightness-[.16]' : ''}`}
          onLoad={(e) => {
            const im = e.currentTarget;
            if (im.naturalWidth && im.naturalHeight) setPicShape({ url: picture, shape: im.naturalWidth / im.naturalHeight });
          }}
        />
      )}
      {chip && !off && (
        <div className="onpic corner top-[0.6rem]" role="status">
          <i className="dot" style={chip === 'dark' ? { background: '#B86E00' } : undefined} />
          <span>{chip === 'live' ? t('chip.live') : chip === 'dark' ? t('chip.dark') : t('chip.light')}</span>
        </div>
      )}
      {off && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-[1.0625rem] leading-tight font-medium text-ink-2 [&_svg]:size-7">
          <I.camoff />
          {t('cam.panel')}
        </div>
      )}
      {!liveOnly && v.chosen && !v.still && cam.state !== 'none' && (v.phase === 'ready' || v.phase === 'settled') && (
        <button type="button" className="onpic bottom-[0.6rem] min-h-11" onClick={backToCamera}>
          <I.cam />
          <span>{t('home.camera')}</span>
        </button>
      )}
      {note && !(v.chosen && !v.still) && (
        <div className="onpic bottom-[0.6rem] lg:hidden">
          {note.icon}
          <span>{note.text}</span>
        </div>
      )}
    </div>
  );
});
