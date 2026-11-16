// Ask as one conversation (design/CHAT-SPEC.md): the person's messages on the right in a soft bubble (their words and
// picture), WeKnow's as plain text on the page, newest at the bottom. An answer has no verdict band: its first
// sentence is the point, in a stronger weight, with a small amber "Careful" or red "Stop" tag only when it matters;
// then the other sentences, the lines of a quote, the quiet where-it-ran tag, and, under the newest answer only, the
// next questions to ask as light pills.

import { useEffect, useRef, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { pick, pressGuide, useAsk, type AskView, type Line, type MineMsg, type WkMsg } from '../ask/conversation';
import { setBox } from '../ask/box';
import { send } from '../ask/flows';
import { attachSample, SAMPLES } from '../samples';
import { deviceWord } from '../engine/device';
import { I } from '../ui/icons';
import { WhereTag } from '../ui/Receipt';
import { openSheet } from '../ui/uiStore';
import { openPicture } from '../ui/PictureViewer';
import { t, money } from '../strings';
import { projectName, useData } from '../store/data';
import { explainCurrent } from '../app/explainOpen';
import { SampleButtons } from '../app/Sheets';
import type { LineItem, Receipt } from '../answer/types';

/** The first sentence: the point, in bold. A tag only for a warning or a stop; never a band, never a green tick. */
function Head({ head }: { head: AskView['head'] }) {
  if (!head) return null;
  const { tone, text } = head;
  return (
    <div className="mb-1">
      {(tone === 'warn' || tone === 'stop') && (
        <span className="ctag" data-tone={tone}>
          {tone === 'stop' ? <I.stopSquare /> : <I.warn />}
          {tone === 'stop' ? t('tag.stop') : t('tag.careful')}
        </span>
      )}
      <p className="wk-head">{text}</p>
    </div>
  );
}

function Steps({ steps }: { steps: AskView['steps'] }) {
  if (!steps) return null;
  const { label, n, total } = steps;
  return (
    <div className="mb-2 flex items-center gap-3 text-[0.9375rem] font-semibold text-ink-2">
      <span className="flex-none">{label}</span>
      {n > 0 && (
        <span className="flex max-w-[16rem] flex-1 gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              className={`h-1 flex-1 rounded-full ${i + 1 <= n ? 'bg-go' : 'bg-fill-2'} ${i + 1 === n ? 'opacity-55' : ''}`}
            />
          ))}
        </span>
      )}
    </div>
  );
}

const STATE: Record<LineItem['state'], { cls: string; icon: () => ReactNode; text: (i: LineItem) => string }> = {
  fair: { cls: 'text-ink-2', icon: I.check, text: () => t('line.fair') },
  found: { cls: 'text-ink-2', icon: I.check, text: () => t('line.found') },
  low: { cls: 'text-ink-2', icon: I.check, text: () => t('line.low') },
  high: { cls: 'text-warn-ink bg-warn-bg', icon: I.warn, text: (i) => t('quote.mark', { over: money(i.over ?? 0) }) },
  pending: { cls: 'text-net bg-net-bg', icon: I.help, text: () => t('line.pending') },
};

function Items({ items }: { items: LineItem[] | null }) {
  if (!items?.length) return null;
  return (
    // Every line name wraps, never truncates; the amount stays at the right and the status sits under the name.
    <ol className="mt-3 mb-1 grid grid-cols-[minmax(0,1fr)] border-y border-hair" aria-label="Lines on the paper">
      {items.map((it) => {
        const s = STATE[it.state];
        const Icon = s.icon;
        return (
          <li key={it.n} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 border-t border-hair py-[0.6rem] first:border-t-0">
            <span className="text-ink-2 tabular-nums">{it.n}</span>
            <span className="font-medium [overflow-wrap:normal] [word-break:normal]">{it.label}</span>
            <span className="text-right font-medium whitespace-nowrap tabular-nums">{it.amount !== null ? money(it.amount) : ''}</span>
            <span
              className={`col-start-2 col-span-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2 py-0.5 text-[0.9375rem] font-medium first:[&_svg]:-ml-0.5 [&_svg]:size-4 [&_svg]:flex-none ${s.cls}`}
            >
              <Icon />
              <span>{s.text(it)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function NoteTag() {
  const nav = useNavigate();
  return (
    <button
      type="button"
      className="tag tag-quiet -ml-[0.6rem] [&_svg]:text-go"
      onClick={() => nav('/remembers')}
    >
      <I.note />
      <span>{t('note.tag', { device: deviceWord() })}</span>
    </button>
  );
}

function Lines({ lines, now }: { lines: Line[]; now?: number | null }) {
  return (
    <>
      {lines.map((l) => {
        if (l.kind === 'heard') return null;
        if (l.kind === 'warn')
          return (
            <p key={l.id} className="wk-warn">
              <I.warn />
              <span>{l.text}</span>
            </p>
          );
        // Every sentence stays readable; the one being said carries a green mark at its edge.
        return (
          <div key={l.id}>
            <p className="wk-line" data-kind={l.kind} data-now={l.id === now ? '' : undefined}>
              <span>{l.text}</span>
            </p>
            {l.noteTag && <NoteTag />}
          </div>
        );
      })}
    </>
  );
}

function LinkButtons({ links }: { links: AskView['links'] }) {
  if (!links.length) return null;
  return (
    <div className="mt-3">
      <div className="sugg-row">
        {links.map((o, i) => (
          <a key={o.value} href={o.href} className="sugg" data-primary={i === 0 ? '' : undefined} {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            {o.icon === 'map' ? <I.map /> : <I.phone />}
            {o.label}
          </a>
        ))}
      </div>
      {links.some((o) => o.external) && <p className="mt-2 text-[0.9375rem] text-ink-2">{t('maps.open')}</p>}
    </div>
  );
}

function KeptChip({ kept }: { kept: AskView['kept'] }) {
  const data = useData();
  const c = kept ? data.checks.find((x) => x.id === kept.checkId) : undefined;
  if (!c) return null;
  return (
    <button type="button" className="tag tag-quiet" onClick={() => openSheet({ type: 'move', checkId: c.id })}>
      <I.folder />
      <span>{t('kept.chip', { project: projectName(c.projectId) })}</span>
      <I.chev />
    </button>
  );
}

function Tags({ receipt, kept, picture, explain }: { receipt: Receipt | null; kept: AskView['kept']; picture?: string | null; explain?: boolean }) {
  if (!receipt && !kept) return null;
  return (
    <div className="mt-1 -ml-[0.6rem] flex flex-wrap">
      {receipt && <WhereTag className="tag-quiet" r={receipt} device={deviceWord()} onOpen={() => openSheet({ type: 'receipt', r: receipt, picture: picture ?? null })} />}
      <KeptChip kept={kept} />
      {explain && (
        <button type="button" className="tag tag-quiet" onClick={() => void explainCurrent()}>
          <I.lang />
          <span>{t('explain.button')}</span>
        </button>
      )}
    </div>
  );
}

function WkBubble({ m }: { m: WkMsg }) {
  return (
    <article className="msg-wk">
      <Steps steps={m.steps} />
      <Head head={m.head} />
      <Lines lines={m.lines} />
      <Items items={m.items} />
      <LinkButtons links={m.links} />
      <Tags receipt={m.receipt} kept={m.kept} />
    </article>
  );
}

function MeBubble({ m, looking, reading }: { m: MineMsg; looking: boolean; reading: boolean }) {
  return (
    <article className="msg-me" aria-label={t('box.label')}>
      {m.picture && (
        <button
          type="button"
          className={`win msg-pic ${looking ? 'looking' : ''} ${reading ? 'reading' : ''}`}
          aria-label={t('pic.open')}
          title={t('pic.open')}
          onClick={() => m.picture && openPicture(m.picture)}
        >
          <img src={m.picture} alt="" className="block size-full object-contain" />
          {looking && (
            <>
              <span className="brk tl" />
              <span className="brk tr" />
              <span className="brk bl" />
              <span className="brk br" />
            </>
          )}
        </button>
      )}
      {m.text && <p>{m.text}</p>}
    </article>
  );
}

/** The buttons under the newest answer: what WeKnow waits for, step by step, or the next questions. */
function Buttons() {
  const v = useAsk();
  if (v.phase === 'guide')
    return (
      <div className="sugg-row mt-3">
        <button type="button" className="sugg" data-primary="" onClick={() => pressGuide('next')}>
          {t('next.step')}
          <I.next />
        </button>
        <button type="button" className="sugg" onClick={() => pressGuide('again')}>
          <I.again />
          {t('next.again')}
        </button>
        <button type="button" className="sugg" onClick={() => pressGuide('stop')}>
          {t('next.stop')}
        </button>
      </div>
    );
  if (v.choices) {
    const { options } = v.choices;
    return (
      <>
        <div className="sugg-row mt-3">
          {options.map((o, i) =>
            o.href ? (
              <a
                key={o.value}
                href={o.href}
                className="sugg"
                data-primary={i === 0 ? '' : undefined}
                onClick={() => pick(o.value)}
                {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {o.icon === 'map' ? <I.map /> : <I.phone />}
                {o.label}
              </a>
            ) : (
              <button key={o.value} type="button" className="sugg" onClick={() => pick(o.value)}>
                {o.label}
              </button>
            ),
          )}
        </div>
        {options.some((o) => o.external) && <p className="mt-2 text-[0.9375rem] text-ink-2">{t('maps.open')}</p>}
      </>
    );
  }
  if (!v.next.length || v.phase === 'looking' || v.phase === 'listening') return null;
  return (
    <div className="sugg-row mt-3" role="group" aria-label={t('next.label')}>
      {v.next.map((n) => (
        <button key={n.label} type="button" className="sugg" onClick={n.act}>
          {n.label}
        </button>
      ))}
    </div>
  );
}

/** Offered inside an answer (no camera, say): the three sample pictures, each attaching itself with its question. */
export function SamplesRow() {
  return (
    <div className="mt-4 max-w-[26rem]">
      <p className="mb-2 text-[0.9375rem] font-medium text-ink-2 max-[22.5rem]:sr-only">{t('home.samples')}</p>
      <SampleButtons compact />
    </div>
  );
}

/** On the start screen: the sample pictures as small cards. A press attaches the picture and puts its question in
 * the box, ready for Send. */
function SampleCards() {
  const v = useAsk();
  return (
    <section aria-label={t('home.samples.short')}>
      <p className="mb-2 text-center text-[0.9375rem] font-medium text-ink-2">{t('home.samples.short')}</p>
      <div className="mx-auto grid max-w-[34rem] grid-cols-3 gap-2 md:gap-3">
        {SAMPLES.map((s) => (
          <button key={s.id} type="button" className="sample-card" aria-pressed={v.chosen?.sample === s.id} onClick={() => void attachSample(s.id)}>
            {/* a paper is shown from its top-left corner, close enough for its printed lines to be seen */}
            <div className="overflow-hidden bg-fill-2">
              <img src={s.url} alt="" className={s.id === 'drain' ? '' : 'origin-[6%_4%] scale-[1.7]'} />
            </div>
            <span>{t(s.q)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

const TRY = ['home.try1', 'home.try2', 'home.try3', 'home.try4'] as const;

/** Things to ask, on the start screen. A press asks it, the same as typing it and pressing Send: words that need a
 * picture stay in the box until one is added. */
function Suggestions() {
  return (
    <section aria-label={t('home.try.label')}>
      <p className="mb-2 text-center text-[0.9375rem] font-medium text-ink-2">{t('home.try.label')}</p>
      <div className="sugg-row justify-center">
        {TRY.map((id) => (
          <button
            key={id}
            type="button"
            className="sugg"
            onClick={() => {
              const q = t(id);
              if (!send(q)) setBox(q);
            }}
          >
            {t(id)}
          </button>
        ))}
      </div>
    </section>
  );
}

const hasWordsOf = (v: AskView) =>
  !!(v.head || v.steps || v.lines.some((l) => l.kind !== 'heard' && l.text) || v.items?.length || v.choices || v.next.length);

/** The newest answer, live: it is being said, and its buttons work. */
function LiveAnswer() {
  const v = useAsk();
  if (!hasWordsOf(v)) return null;
  const explain = !!v.kept && (v.phase === 'settled' || v.phase === 'waiting');
  return (
    <article className="msg-wk" aria-live="polite">
      <Steps steps={v.steps} />
      <Head head={v.head} />
      <Lines lines={v.lines} now={v.done ? null : v.now} />
      {v.phase !== 'listening' && <Items items={v.items} />}
      <LinkButtons links={v.links} />
      <Tags receipt={v.receipt} kept={v.kept} picture={v.still} explain={explain} />
      <Buttons />
      {v.offerSamples && v.phase !== 'looking' && !v.chosen && <SamplesRow />}
    </article>
  );
}

/** The conversation, newest at the bottom; it keeps the newest words in view as they come. */
export function Chat() {
  const v = useAsk();
  const box = useRef<HTMLDivElement>(null);
  const lastMe = [...v.history].reverse().find((m) => m.who === 'me') as MineMsg | undefined;
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [v.history.length, v.lines.length, v.next.length, v.choices, v.head, v.phase, v.items]);
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain pt-3 pb-6 [scrollbar-width:thin]">
      {v.history.map((m) =>
        m.who === 'me' ? (
          <MeBubble key={m.id} m={m} looking={m === lastMe && v.looking} reading={m === lastMe && v.reading} />
        ) : (
          <WkBubble key={m.id} m={m} />
        ),
      )}
      <LiveAnswer />
    </div>
  );
}

/**
 * Before the first message: a short greeting with one line under it, the sample pictures and a few things to ask.
 * No camera here: it opens from the camera button. When WeKnow has something to say first (no camera, "Add a picture
 * first"), its words take the place of the greeting.
 */
export function Opening() {
  const v = useAsk();
  const words = hasWordsOf(v);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain [scrollbar-width:thin]">
      <div className="my-auto flex flex-col gap-6 py-3 md:gap-8 lg:pb-12">
        {words ? (
          <LiveAnswer />
        ) : (
          <div className="text-center">
            <h1 className="text-[1.75rem] leading-[1.2] font-semibold tracking-[-0.025em] text-ink lg:text-[2rem]">{t('home.greeting')}</h1>
            <p className="mt-2 text-ink-2" aria-live="polite">
              {v.chosen ? t('home.coach.picture') : t('home.coach')}
            </p>
          </div>
        )}
        {!v.offerSamples && <SampleCards />}
        {!v.chosen && !words && <Suggestions />}
        {!v.chosen && !words && (
          <Link to="/" className="mx-auto inline-flex min-h-11 items-center text-[0.9375rem] font-medium text-ink-2 underline-offset-4 hover:underline">
            {t('menu.how')}
          </Link>
        )}
      </div>
    </div>
  );
}
