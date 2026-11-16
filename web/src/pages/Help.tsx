// Help: how it works (and hear it), the three sample pictures, the words WeKnow always understands, and setting
// it up for someone else. At most 52rem wide.

import { useNavigate } from 'react-router';
import { Card, CardTitle, PageTitle } from '../ui/controls';
import { I } from '../ui/icons';
import { openSheet } from '../ui/uiStore';
import { SampleButtons, ChoosePhoto } from '../app/Sheets';
import { deviceWord } from '../engine/device';
import { attachSample } from '../samples';
import { quiet, sayAloud } from '../engine/speech';
import { t } from '../strings';

const WORDS = ['yes', 'no', 'next', 'done', 'again', 'wait', 'stop', 'help'];

export default function Help() {
  const nav = useNavigate();
  return (
    <main id="page" className="min-h-0 flex-1 animate-rise overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[40rem] lg:max-w-[52rem]">
        <PageTitle>{t('help.title')}</PageTitle>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <Card>
            <CardTitle>{t('help.how.title')}</CardTitle>
            <p className="text-small text-ink-2">{t('help.how')}</p>
            <p className="mt-2 text-small text-ink-2">{t('help.hybrid')}</p>
            <button
              type="button"
              className="btn btn-yes mt-[0.9rem]"
              onClick={() => {
                quiet();
                void sayAloud(t('help.hear.say'));
              }}
            >
              <I.say />
              {t('help.hear')}
            </button>
          </Card>
          <Card>
            <CardTitle>{t('home.samples')}</CardTitle>
            <div className="mt-[0.6rem]">
              <SampleButtons
                onPick={(id) => {
                  nav('/');
                  void attachSample(id);
                }}
              />
            </div>
            <ChoosePhoto className="mt-4" onPicked={() => nav('/')} />
          </Card>
          <Card>
            <CardTitle>{t('help.words.title')}</CardTitle>
            <div className="mt-[0.6rem] flex flex-wrap gap-2">
              {WORDS.map((w) => (
                <span key={w} className="inline-flex min-h-8 items-center rounded-full bg-card-2 px-3 text-small font-semibold text-ink-2">
                  {w}
                </span>
              ))}
            </div>
          </Card>
          <Card>
            <CardTitle>{t('help.setup.title')}</CardTitle>
            <p className="text-small text-ink-2">{t('help.setup', { device: deviceWord() })}</p>
            <button type="button" className="btn mt-[0.9rem]" onClick={() => openSheet({ type: 'setup' })}>
              {t('setup.title')}
            </button>
          </Card>
        </div>
      </div>
    </main>
  );
}
