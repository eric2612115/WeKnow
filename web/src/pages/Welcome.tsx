// First open: what WeKnow is, in one line and three pictures, and one button. Start is the press that unlocks
// sound and opens the system box for the camera and microphone; "Press Allow" points at that box.

import { useState } from 'react';
import { Wordmark } from '../ui/controls';
import { t } from '../strings';
import { SAMPLES } from '../samples';
import { setPrefs } from '../store/prefs';
import { permission, requestCameraAndMic } from '../engine/camera';
import { deviceWord } from '../engine/device';
import { sayAloud, unlockSound, quiet } from '../engine/speech';
import { greet } from '../ask/flows';

export default function Welcome() {
  const [allow, setAllow] = useState(false);
  const device = deviceWord();

  const start = async () => {
    unlockSound();
    const [cam, mic] = await Promise.all([permission('camera'), permission('microphone')]);
    if (cam === 'granted' && mic === 'granted') return done(await requestCameraAndMic());
    setAllow(true);
    void sayAloud(t('allow.say'));
    done(await requestCameraAndMic());
  };
  const done = (state: string) => {
    quiet();
    setPrefs({ started: true });
    if (state === 'live') greet();
  };

  if (allow)
    return (
      <main className="relative flex h-dvh flex-col items-center justify-center gap-6 overflow-auto bg-bg px-5 text-center">
        {device === 'computer' && (
          <div className="absolute top-3 left-6 flex flex-col items-start text-[1.3rem] leading-tight font-bold text-go" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="size-10 -rotate-45" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V4M5 11l7-7 7 7" />
            </svg>
            {t('allow.point')}
          </div>
        )}
        <div>
          <h1 className="text-[2.5rem] leading-[1.12] font-bold tracking-[-0.035em]">{t('allow.title')}</h1>
          <p className="mt-2 text-[1.3rem] leading-[1.3] font-medium text-ink-2">{t('allow.line')}</p>
        </div>
        {device !== 'computer' && (
          <div className="flex flex-col items-center text-[1.3rem] leading-tight font-bold text-go" aria-hidden="true">
            {t('allow.point')}
            <svg viewBox="0 0 24 24" className="mt-1 size-10 rotate-180" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21V4M5 11l7-7 7 7" />
            </svg>
          </div>
        )}
        <p className="text-small text-ink-2">{t('allow.fine', { device })}</p>
      </main>
    );

  return (
    <main className="flex h-dvh flex-col items-center justify-between gap-4 overflow-auto bg-bg px-5 pt-8 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center lg:justify-center lg:gap-10">
      <div className="animate-rise">
        <span className="text-[1.6rem] lg:text-[1.9rem]">
          <Wordmark />
        </span>
        <h1 className="mt-[1.1rem] text-welcome font-bold tracking-[-0.035em] lg:mt-[1.3rem] lg:text-[3.1rem]">
          {t('welcome.line')
            .split(/(?<=\.) /)
            .map((s) => (
              <span key={s} className="block lg:inline">
                {s}{' '}
              </span>
            ))}
        </h1>
      </div>
      <ul className="grid w-full max-w-[46rem] grid-cols-3 gap-[0.7rem] lg:max-w-[44rem] lg:gap-[1.4rem]">
        {SAMPLES.map((s) => (
          <li key={s.id} className="flex flex-col items-center gap-2">
            <span className="thumb">
              <img src={s.url} alt="" />
            </span>
            <q className="text-small leading-tight font-semibold lg:text-[1.2rem]">{t(s.q)}</q>
          </li>
        ))}
      </ul>
      <div className="flex flex-col items-center">
        <button type="button" className="big" onClick={() => void start()}>
          <span>{t('welcome.start')}</span>
        </button>
        <p className="mt-[1.1rem] text-small text-ink-2">{t('welcome.fine')}</p>
      </div>
    </main>
  );
}
