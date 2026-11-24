// Sound on or off, beside the answer it reads out. Off cuts what is being said now; the words stay on screen.

import { I } from './icons';
import { t } from '../strings';
import { getPrefs, setPrefs, usePrefs } from '../store/prefs';
import { quiet } from '../engine/speech';

export function SoundButton() {
  const p = usePrefs();
  const label = p.voice ? t('btn.sound.mute') : t('btn.sound.unmute');
  return (
    <button
      type="button"
      className="bar-btn -my-2 flex-none"
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
