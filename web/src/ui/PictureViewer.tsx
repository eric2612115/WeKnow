// A picture, large: the whole screen, on black, with bigger and smaller buttons. Small print in a thumbnail cannot
// be read, so every picture in the conversation opens here with a press. Pressing the picture twice also makes it
// bigger; once bigger, it is moved by scrolling or dragging with a finger.

import { Dialog } from 'radix-ui';
import { createStore, useStore } from '../store/store';
import { I } from './icons';
import { t } from '../strings';

const store = createStore<string | null>(null);
const stepStore = createStore(0);
export const openPicture = (url: string) => {
  stepStore.set(0);
  store.set(url);
};
export const closePicture = () => store.set(null);

const STEPS = [1, 1.75, 2.5, 4];

export function PictureViewer() {
  const url = useStore(store);
  const step = useStore(stepStore);
  const setStep = (fn: (s: number) => number) => stepStore.set(fn(stepStore.get()));
  const zoom = STEPS[step];
  return (
    <Dialog.Root open={!!url} onOpenChange={(o) => !o && closePicture()}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" style={{ background: '#000' }} />
        <Dialog.Content className="pview" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">{t('pic.title')}</Dialog.Title>
          <div className="pview-stage" data-zoomed={step > 0 ? '' : undefined}>
            {url && (
              <img
                src={url}
                alt=""
                draggable={false}
                style={step > 0 ? { width: `${zoom * 100}%`, maxWidth: 'none', maxHeight: 'none' } : undefined}
                onDoubleClick={() => setStep((s) => (s === 0 ? 2 : 0))}
              />
            )}
          </div>
          <Dialog.Close className="pview-btn pview-close" type="button" aria-label={t('close')} title={t('close')}>
            <I.close />
          </Dialog.Close>
          <div className="pview-zoom">
            <button type="button" className="pview-btn" aria-label={t('pic.zoom.out')} title={t('pic.zoom.out')} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              <I.minus />
            </button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="pview-btn"
              aria-label={t('pic.zoom.in')}
              title={t('pic.zoom.in')}
              disabled={step === STEPS.length - 1}
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            >
              <I.plus />
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
