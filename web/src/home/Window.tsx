// The camera window: the live camera, or the picture being read, fitted whole and never cropped. Four corner
// marks that close in while WeKnow looks at a still; a line that sweeps while it reads a paper. Labels on the
// picture are white pills, the same in both themes. Text never sits on the moving picture.

import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
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

  return (
    <div className={`win ${looking ? 'looking' : ''} ${v.reading ? 'reading' : ''} ${className}`}>
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
      {picture && <img src={picture} alt="" className={`absolute inset-0 size-full object-contain ${v.dim ? 'brightness-[.16]' : ''}`} />}
      {!off && (
        <>
          <span className="brk tl" />
          <span className="brk tr" />
          <span className="brk bl" />
          <span className="brk br" />
        </>
      )}
      {chip && !off && (
        <div className="onpic top-[0.7rem]" role="status">
          <i className="dot" style={chip === 'dark' ? { background: '#B86E00' } : undefined} />
          <span>{chip === 'live' ? t('chip.live') : chip === 'dark' ? t('chip.dark') : t('chip.light')}</span>
        </div>
      )}
      {off && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[0.6rem] bg-card-2 p-4 text-center text-[1.2rem] leading-tight font-semibold text-ink-2 [&_svg]:size-12">
          <I.camoff />
          {t('cam.panel')}
        </div>
      )}
      {!liveOnly && v.chosen && !v.still && cam.state !== 'none' && (v.phase === 'ready' || v.phase === 'settled') && (
        <button type="button" className="onpic bottom-[0.7rem] min-h-11" onClick={backToCamera}>
          <I.cam />
          <span>{t('home.camera')}</span>
        </button>
      )}
      {note && !(v.chosen && !v.still) && (
        <div className="onpic bottom-[0.7rem] lg:hidden">
          {note.icon}
          <span>{note.text}</span>
        </div>
      )}
    </div>
  );
});
