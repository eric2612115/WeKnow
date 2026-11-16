// The question box at the bottom of Ask, laid out the way chat apps lay it out: the camera and Choose a photo on the
// left (they attach a picture, shown as a small chip with an x, and in the window; nothing is sent), the words in the
// middle (always there, Enter sends), and on the right the microphone when the box is empty (it fills the words, it
// does not send), a send arrow when it holds words or a picture, the level bars while WeKnow listens and Stop while
// it looks or speaks.

import { useLayoutEffect, useRef, useState } from 'react';
import { cutNarration, detach, finishListening, hush, patch, useAsk, view, type AskView } from '../ask/conversation';
import { boxStore, setBoxFocus, useBox } from '../ask/box';
import { dictate, send as sendNow, takePicture } from '../ask/flows';
import { useCamera } from '../engine/camera';
import { chooseFile } from '../samples';
import { getPrefs, usePrefs } from '../store/prefs';
import { createStore, useStore } from '../store/store';
import { I } from '../ui/icons';
import { t } from '../strings';

/** The words have needed more than one line since the box was last empty: they get the whole width. */
const tallStore = createStore(false);
let field: HTMLTextAreaElement | null = null;
setBoxFocus(() => field?.focus());

/** Stop looking and speaking now; what is on screen stays. */
export function stopNow() {
  const v = view();
  hush();
  if (v.head || v.lines.length) patch({ phase: 'settled', looking: !!v.still });
  else patch({ phase: 'ready', still: null, looking: false });
}

/** On a phone, close the keyboard after sending so the answer can be seen. */
function blurOnTouch() {
  if (window.matchMedia?.('(pointer: coarse)').matches) field?.blur();
}

/** Send the words and the attached picture. Words that need a picture stay in the box until one is added. */
function send() {
  const text = boxStore.get();
  if (!text.trim() && !view().chosen) return;
  if (sendNow(text)) {
    boxStore.set('');
    tallStore.set(false);
  }
  blurOnTouch();
}

type Face = 'listen' | 'stop' | 'send' | 'hush' | 'mic';

/**
 * What the right-hand button is now. Listening: the level bars (press to finish). Looking or speaking: Stop.
 * Words or a picture in the box: send. An answer being read out with the sound on: Stop (cuts the reading only;
 * the answer and whatever WeKnow asks next stay). Otherwise the microphone.
 */
function faceOf(v: AskView, text: string, voice: boolean): Face {
  if (v.phase === 'listening') return 'listen';
  if (v.phase === 'looking' || v.phase === 'speaking') return 'stop';
  if (text.trim() || v.chosen) return 'send';
  if (voice && v.talking && v.phase !== 'guide') return 'hush';
  return 'mic';
}

/** The right-hand button. Space outside the box presses it too. */
export function pressRight() {
  const face = faceOf(view(), boxStore.get(), getPrefs().voice);
  if (face === 'listen') return finishListening();
  if (face === 'stop') return stopNow();
  if (face === 'hush') return cutNarration();
  if (face === 'send') return send();
  dictate();
}

const BARS = [0.5, 0.8, 1, 0.75, 0.55];

export function Composer() {
  const v = useAsk();
  const text = useBox();
  const cam = useCamera();
  const ref = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const listening = v.phase === 'listening';
  const heard = listening ? v.heard : '';
  // While WeKnow listens, the heard words show after anything already typed.
  const shown = listening ? [text.trim(), heard].filter(Boolean).join(' ') : text;
  const voice = usePrefs().voice;
  const face = faceOf(v, text, voice);
  const pic = v.chosen;
  // With a picture in the window and the camera on, the camera button goes back to the live camera first.
  const camLabel = cam.state === 'live' && (v.still || pic) ? t('box.camera.back') : t('box.camera');

  // The long hint only where it fits on one line; a phone gets the short one.
  const [wide, setWide] = useState(false);
  // Once the words take more than one line, they get the whole width above the buttons (until the box is empty).
  const tall = useStore(tallStore) && !!shown;

  // Grows with the words up to about four lines, then scrolls. Empty, it is one line (rows=1).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (!shown) return;
    const cs = getComputedStyle(el);
    const oneLine = parseFloat(cs.lineHeight) * 1.5 + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (!tall && el.scrollHeight > oneLine) tallStore.set(true);
    el.style.height = `${el.scrollHeight}px`;
  }, [shown, wide, tall, pic]);

  useLayoutEffect(() => {
    const el = ref.current;
    field = el;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWide(el.clientWidth >= 25 * parseFloat(getComputedStyle(document.documentElement).fontSize)));
    ro.observe(el);
    return () => {
      ro.disconnect();
      field = null;
    };
  }, []);

  const right =
    face === 'listen'
      ? { label: t('box.finish'), body: (
          <span className={`cbars ${v.level > 0.02 ? '' : 'idle'}`} aria-hidden="true">
            {BARS.map((b, i) => (
              <i key={i} style={v.level > 0.02 ? { ['--h' as string]: `${0.35 + Math.min(1, v.level * b * 1.6) * 1.05}rem` } : undefined} />
            ))}
          </span>
        ) }
      : face === 'stop' || face === 'hush'
        ? { label: t('btn.stop'), body: <I.stopSquare /> }
        : face === 'send'
          ? { label: t('box.send'), body: <I.send /> }
          : { label: t('box.mic'), body: <I.mic /> };

  return (
    <form
      className="px-0 pt-[0.45rem] pb-[calc(0.8rem+env(safe-area-inset-bottom))] lg:pt-0 lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="composer" data-listening={listening ? '' : undefined} data-tall={tall ? '' : undefined} data-pic={pic ? '' : undefined}>
        {pic && (
          <div className="cchip">
            <img src={pic.url} alt="" />
            <span>{t('box.attached')}</span>
            <button type="button" aria-label={t('box.remove')} title={t('box.remove')} onClick={detach}>
              <I.close />
            </button>
          </div>
        )}
        <button type="button" className="cbtn cbtn-cam" aria-label={camLabel} title={camLabel} onClick={takePicture}>
          <I.cam />
        </button>
        <button type="button" className="cbtn" aria-label={t('home.choose')} title={t('home.choose')} onClick={() => file.current?.click()}>
          <I.image />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) chooseFile(f);
            e.target.value = '';
          }}
        />
        <textarea
          ref={ref}
          rows={1}
          className="cfield"
          aria-label={t('box.label')}
          placeholder={
            listening
              ? t('box.listening')
              : pic
                ? wide
                  ? t('box.placeholder.picture')
                  : t('box.placeholder.picture.short')
                : wide
                  ? t('box.placeholder')
                  : t('box.placeholder.short')
          }
          enterKeyHint="send"
          maxLength={300}
          readOnly={listening}
          value={shown}
          onChange={(e) => {
            const next = e.target.value;
            if (!next || !boxStore.get()) tallStore.set(false);
            boxStore.set(next);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="cbtn cbtn-go"
          data-face={face === 'hush' ? 'stop' : face}
          aria-label={right.label}
          title={right.label}
          onClick={pressRight}
        >
          {right.body}
        </button>
      </div>
    </form>
  );
}
