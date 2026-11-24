// The question box at the bottom of Ask, laid out the way chat apps lay it out: the camera and Choose a photo on the
// left (they attach a picture or a PDF, shown as a small picture with an x on its corner, and in the window; nothing is sent),
// the words in the middle (always there, Enter sends), and on the right the microphone when the box is empty (it fills
// the words, it does not send), a round dark send arrow when it holds words or a picture, the level bars while WeKnow
// listens and a stop square while it looks or speaks. One soft pill, no border.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cutNarration, detach, finishListening, hush, patch, useAsk, view, type AskView } from '../ask/conversation';
import { boxStore, setBoxFocus, useBox } from '../ask/box';
import { dictate, send as sendNow, takePicture } from '../ask/flows';
import { chooseFile } from '../samples';
import { getPrefs, usePrefs } from '../store/prefs';
import { createStore, useStore } from '../store/store';
import { I } from '../ui/icons';
import { openPicture } from '../ui/PictureViewer';
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
  const ref = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  // The front page's "Take a photo" and "Upload" open Ask with ?start=camera or ?start=upload: do that once.
  useEffect(() => {
    const url = new URL(location.href);
    const start = url.searchParams.get('start');
    if (!start) return;
    url.searchParams.delete('start');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    // After Ask has handed the flows its camera (the page's own effect runs after this one).
    setTimeout(() => {
      if (start === 'camera') takePicture();
      else if (start === 'upload') file.current?.click();
    }, 0);
  }, []);
  const listening = v.phase === 'listening';
  const heard = listening ? v.heard : '';
  // While WeKnow listens, the heard words show after anything already typed.
  const shown = listening ? [text.trim(), heard].filter(Boolean).join(' ') : text;
  const voice = usePrefs().voice;
  const face = faceOf(v, text, voice);
  const pic = v.chosen;
  const camLabel = t('box.camera');

  // The long hint only where it fits on one line; a phone gets the short one.
  const [wide, setWide] = useState(false);
  // A computer (a mouse or trackpad): a screenshot or a PDF can be pasted anywhere on Ask, so the hint says so.
  const [desktop] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches);
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
      className="flex-none pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-4"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <div className="composer" data-listening={listening ? '' : undefined} data-tall={tall ? '' : undefined} data-pic={pic ? '' : undefined}>
        {pic && (
          <div className="cchip">
            <span className="cthumb">
              <button type="button" className="cview" aria-label={t('pic.open')} title={t('pic.open')} onClick={() => openPicture(pic.url)}>
                <img src={pic.url} alt="" />
              </button>
              <button type="button" className="cx" aria-label={t('box.remove')} title={t('box.remove')} onClick={detach}>
                <I.close />
              </button>
              {pic.paper && (
                <span className="cbadge" aria-hidden="true">
                  PDF
                </span>
              )}
            </span>
            <span className="sr-only">{pic.paper ? t('box.attached.pdf') : t('box.attached')}</span>
          </div>
        )}
        <button type="button" className="cbtn" aria-label={camLabel} title={camLabel} onClick={takePicture}>
          <I.cam />
        </button>
        <button type="button" className="cbtn" aria-label={t('home.choose')} title={t('home.choose')} onClick={() => file.current?.click()}>
          <I.image />
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void chooseFile(f);
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
                  ? desktop
                    ? t('box.placeholder.paste')
                    : t('box.placeholder')
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
