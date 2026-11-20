// "Explain in my language": pick a language, and WeKnow explains the answer and the paper in plain words in it.
// On this device when its built-in model writes that language; otherwise over the internet after a yes that shows
// exactly what would be sent. The answer on screen never changes.

import { useState } from 'react';
import { closeSheet, useUi, type SheetState } from '../ui/uiStore';
import { Sheet } from '../ui/Sheet';
import { DeviceIcon, I } from '../ui/icons';
import { t } from '../strings';
import { deviceWord, deviceStore } from '../engine/device';
import { appSettings } from '../engine/knowledge';
import { getPrefs, setPrefs } from '../store/prefs';
import { quiet } from '../engine/speech';
import type { Language } from '../explain';

const LANGS: Array<Pick<Language, 'code' | 'name'>> = [
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ja', name: '日本語' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'ko', name: '한국어' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'pt', name: 'Português' },
  { code: 'hi', name: 'हिन्दी' },
];

type Stage =
  | { s: 'pick' }
  | { s: 'ask'; withPicture: boolean; words: string }
  | { s: 'never' }
  | { s: 'working' }
  | { s: 'done'; text: string; where: 'device' | 'cloud'; lang: string }
  | { s: 'fail' };

export function ExplainSheet() {
  const { sheet } = useUi();
  if (sheet?.type !== 'explain') return null;
  return <ExplainBody key={sheet.key} x={sheet} />;
}

function ExplainBody({ x }: { x: Extract<SheetState, { type: 'explain' }> }) {
  const device = deviceWord();
  const [code, setCode] = useState(getPrefs().explainLang || 'es');
  const [stage, setStage] = useState<Stage>({ s: 'pick' });
  const lang = LANGS.find((l) => l.code === code) ?? LANGS[0];

  const run = async (where: 'device' | 'cloud', withPicture: boolean) => {
    setStage({ s: 'working' });
    try {
      const [m, s] = await Promise.all([import('../explain'), appSettings()]);
      const L = m.LANGUAGES.find((l) => l.code === code)!;
      const r = await m.explain(L, { kind: x.kind, verdict: x.verdict, sentences: x.sentences, picture: withPicture ? x.picture : undefined }, where, s.cloudModel);
      setStage({ s: 'done', text: r.text, where, lang: code });
    } catch (e) {
      console.warn('[WeKnow] explain', e);
      setStage({ s: 'fail' });
    }
  };

  const start = async () => {
    setPrefs({ explainLang: code });
    const m = await import('../explain');
    const L = m.LANGUAGES.find((l) => l.code === code)!;
    const withPicture = !!x.picture;
    if (await m.deviceCanExplain(L, withPicture)) return run('device', withPicture);
    if (withPicture && (await m.deviceCanExplain(L, false))) return run('device', false);
    const p = getPrefs();
    // This device cannot write that language itself. With the internet off or not allowed, nothing is sent.
    if (!deviceStore.get().online || p.internet === 'never') return setStage({ s: 'never' });
    // Over the internet only WeKnow's own answer goes (covered again), never the picture. The exact words are shown
    // first, every time: an earlier yes to a question was not a yes to this.
    setStage({ s: 'ask', withPicture: false, words: m.explainFacts(x) });
  };

  return (
    <Sheet open onClose={() => (quiet(), closeSheet())} title={t('explain.title')} titleIcon={<I.lang />} tone="device">
      {stage.s === 'pick' && (
        <>
          <p className="mb-2 text-body font-semibold">{t('explain.pick')}</p>
          <div role="radiogroup" aria-label={t('explain.pick')} className="grid grid-cols-2 gap-2">
            {LANGS.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                lang={l.code}
                aria-checked={l.code === code}
                onClick={() => setCode(l.code)}
                className="flex min-h-14 items-center gap-3 rounded-btn border-[1.5px] border-line bg-card px-4 text-left text-body font-semibold aria-checked:border-go"
              >
                <span
                  aria-hidden="true"
                  className={`size-[1.3rem] flex-none rounded-full ${l.code === code ? 'shadow-[inset_0_0_0_0.4rem_var(--go)]' : 'shadow-[inset_0_0_0_2px_var(--line)]'}`}
                />
                {l.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-yes mt-4 w-full" onClick={() => void start()}>
            {t('explain.go')}
          </button>
          <p className="mt-3 text-small text-ink-2">{t('explain.fine')}</p>
        </>
      )}
      {stage.s === 'ask' && (
        <>
          <p className="text-body font-semibold text-net">
            <span className="mr-2 inline-block size-6 align-[-0.3rem] [&_svg]:size-full">
              <I.net />
            </span>
            {t('ask.explain.title')}
          </p>
          <p className="mt-2 text-body font-medium">{t('ask.explain.body', { device, language: lang.name })}</p>
          <div className="parcel my-3">
            <span>{t('ask.explain.answer')}</span>
            <span className="font-mono text-small font-medium break-words whitespace-pre-wrap">{stage.words}</span>
            <span>{t('ask.explain.lang', { language: lang.name })}</span>
          </div>
          <p className="mt-[0.4rem] text-small text-ink-2">{t('ask.thing.not')}</p>
          <div className="mt-[1.1rem] grid grid-cols-2 gap-[0.7rem]">
            <button
              type="button"
              className="btn btn-yes"
              onClick={() => {
                void run('cloud', false);
              }}
            >
              {t('ask.explain.yes')}
            </button>
            <button type="button" className="btn" onClick={() => setStage({ s: 'pick' })}>
              {t('ask.thing.no')}
            </button>
          </div>
        </>
      )}
      {stage.s === 'working' && <p className="py-6 text-caption font-medium text-ink-2">{t('explain.working')}</p>}
      {stage.s === 'fail' && (
        <>
          <p className="py-4 text-caption font-medium">{t('explain.fail')}</p>
          <button type="button" className="btn" onClick={() => setStage({ s: 'pick' })}>
            {t('explain.again')}
          </button>
        </>
      )}
      {stage.s === 'never' && (
        <>
          <p className="py-4 text-caption font-medium">{t('explain.never', { device, language: lang.name })}</p>
          <button type="button" className="btn" onClick={() => setStage({ s: 'pick' })}>
            {t('explain.again')}
          </button>
        </>
      )}
      {stage.s === 'done' && (
        <>
          <div lang={stage.lang} className="grid gap-2 rounded-btn bg-card-2 px-4 py-3 text-caption leading-[1.4] font-medium whitespace-pre-line">
            {stage.text}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="wtag text-small" data-where={stage.where === 'device' ? 'local' : 'cloud'}>
              {stage.where === 'device' ? <DeviceIcon device={device} /> : <I.net />}
              {stage.where === 'device' ? t('tag.local', { device }) : t('tag.cloud')}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-[0.7rem]">
            <button
              type="button"
              className="btn btn-yes"
              onClick={async () => {
                const { speakIn } = await import('../explain');
                speakIn(stage.text, stage.lang);
              }}
            >
              <I.play />
              {t('explain.hear')}
            </button>
            <button type="button" className="btn" onClick={() => setStage({ s: 'pick' })}>
              {t('explain.again')}
            </button>
          </div>
          <p className="mt-3 text-small text-ink-2">{t('explain.fine')}</p>
        </>
      )}
    </Sheet>
  );
}
