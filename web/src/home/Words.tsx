// Ask as one conversation (design/CHAT-SPEC.md): the person's messages on the right (their words and picture),
// WeKnow's on the left, newest at the bottom. An answer has no verdict band: its first sentence is the point, in bold,
// with a small amber "Careful" or red "Stop" tag only when it matters; then the other sentences, the lines of a
// quote, the where-it-ran tag, and, under the newest answer only, the buttons: the next questions to ask.

import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { pick, pressGuide, useAsk, type AskView, type Line, type MineMsg, type WkMsg } from '../ask/conversation';
import { deviceWord } from '../engine/device';
import { I } from '../ui/icons';
import { WhereTag } from '../ui/Receipt';
import { openSheet } from '../ui/uiStore';
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
    <div className="mb-[0.35rem]">
      {(tone === 'warn' || tone === 'stop') && (
        <span className="ctag" data-tone={tone}>
          {tone === 'stop' ? <I.stopSquare /> : <I.warn />}
          {tone === 'stop' ? t('tag.stop') : t('tag.careful')}
        </span>
      )}
      <p className="text-[1.375rem] leading-[1.3] font-bold tracking-[-0.018em] text-ink lg:text-[1.5rem]">{text}</p>
    </div>
  );
}

function Steps({ steps }: { steps: AskView['steps'] }) {
  if (!steps) return null;
  const { label, n, total } = steps;
  return (
    <div className="mb-2 flex items-center gap-[0.8rem] text-small font-bold text-ink-2">
      <span className="flex-none">{label}</span>
      {n > 0 && (
        <span className="flex flex-1 gap-[0.3rem]" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              className={`h-2 flex-1 rounded-[0.3rem] ${
                i + 1 < n ? 'bg-go' : i + 1 === n ? 'bg-card shadow-[inset_0_0_0_2px_var(--go)]' : 'bg-card-2 shadow-[inset_0_0_0_1px_var(--line)]'
              }`}
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
    <ol className="mt-3 mb-1 grid grid-cols-[minmax(0,1fr)] rounded-btn border border-hair bg-bg px-3 py-1" aria-label="Lines on the paper">
      {items.map((it) => {
        const s = STATE[it.state];
        const Icon = s.icon;
        return (
          <li key={it.n} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2 gap-y-1 border-t border-hair py-2 text-small first:border-t-0">
            <span className="font-semibold text-ink-2 tabular-nums">{it.n}</span>
            <span className="font-semibold [overflow-wrap:normal] [word-break:normal]">{it.label}</span>
            <span className="text-right font-semibold whitespace-nowrap tabular-nums">{it.amount !== null ? money(it.amount) : ''}</span>
            <span
              className={`col-start-2 col-span-2 inline-flex items-center gap-1 justify-self-start rounded-full px-2 py-0.5 font-semibold [&_svg]:size-[1.1rem] [&_svg]:flex-none ${s.cls}`}
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
      className="mt-[-0.1rem] mb-[0.3rem] inline-flex min-h-11 items-center gap-[0.4rem] rounded-full border border-hair bg-card py-[0.3rem] pr-[0.7rem] pl-2 text-small font-semibold text-ink-2 shadow-d1 hover:brightness-[.97] [&_svg]:size-5 [&_svg]:flex-none [&_svg]:text-go"
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
        // Every sentence stays readable; the one being said carries a green mark at its edge.
        const mark = l.id === now ? 'shadow-[inset_3px_0_0_var(--go)] pl-3 -ml-3' : '';
        if (l.kind === 'warn')
          return (
            <p key={l.id} className="my-[0.45rem] flex items-start gap-2 rounded-btn bg-warn-bg px-[0.8rem] py-[0.65rem] text-caption font-semibold tracking-[-0.012em] text-warn-ink [&_svg]:mt-0.5 [&_svg]:size-7 [&_svg]:flex-none">
              <I.warn />
              <span>{l.text}</span>
            </p>
          );
        return (
          <div key={l.id}>
            <p
              className={`my-[0.4rem] tracking-[-0.012em] text-ink transition-shadow ${mark} ${
                l.kind === 'strong' ? 'text-strong font-bold tracking-[-0.02em]' : 'text-caption font-medium'
              }`}
            >
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
    <div className="mt-[0.8rem] grid gap-[0.6rem]">
      {links.map((o, i) => (
        <a key={o.value} href={o.href} className={`btn ${i === 0 ? 'btn-yes' : ''}`} {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
          {o.icon === 'map' ? <I.map /> : <I.phone />}
          {o.label}
        </a>
      ))}
      {links.some((o) => o.external) && <p className="text-small text-ink-2">{t('maps.open')}</p>}
    </div>
  );
}

function KeptChip({ kept }: { kept: AskView['kept'] }) {
  const data = useData();
  const c = kept ? data.checks.find((x) => x.id === kept.checkId) : undefined;
  if (!c) return null;
  return (
    <button type="button" className="tag" onClick={() => openSheet({ type: 'move', checkId: c.id })}>
      <I.folder />
      <span>{t('kept.chip', { project: projectName(c.projectId) })}</span>
      <I.chev />
    </button>
  );
}

function Tags({ receipt, kept, picture, explain }: { receipt: Receipt | null; kept: AskView['kept']; picture?: string | null; explain?: boolean }) {
  if (!receipt && !kept) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {receipt && <WhereTag r={receipt} device={deviceWord()} onOpen={() => openSheet({ type: 'receipt', r: receipt, picture: picture ?? null })} />}
      <KeptChip kept={kept} />
      {explain && (
        <button type="button" className="tag" onClick={() => void explainCurrent()}>
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
        <div className={`win msg-pic ${looking ? 'looking' : ''} ${reading ? 'reading' : ''}`}>
          <img src={m.picture} alt="" className="block size-full object-contain" />
          {looking && (
            <>
              <span className="brk tl" />
              <span className="brk tr" />
              <span className="brk bl" />
              <span className="brk br" />
            </>
          )}
        </div>
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
      <div className="mt-[0.9rem] grid gap-[0.6rem]">
        <button type="button" className="btn btn-yes" onClick={() => pressGuide('next')}>
          <I.next />
          {t('next.step')}
        </button>
        <div className="grid grid-cols-2 gap-[0.6rem]">
          <button type="button" className="btn" onClick={() => pressGuide('again')}>
            <I.again />
            {t('next.again')}
          </button>
          <button type="button" className="btn" onClick={() => pressGuide('stop')}>
            <I.stopSquare />
            {t('next.stop')}
          </button>
        </div>
      </div>
    );
  if (v.choices) {
    const { options } = v.choices;
    return (
      <>
        <div className="mt-[0.9rem] grid grid-cols-1 gap-[0.6rem]">
          {options.map((o, i) =>
            o.href ? (
              <a
                key={o.value}
                href={o.href}
                className={`btn ${i === 0 ? 'btn-yes' : ''}`}
                onClick={() => pick(o.value)}
                {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >
                {o.icon === 'map' ? <I.map /> : <I.phone />}
                {o.label}
              </a>
            ) : (
              <button key={o.value} type="button" className={`btn ${i === 0 ? 'btn-yes' : ''}`} onClick={() => pick(o.value)}>
                {o.label}
              </button>
            ),
          )}
        </div>
        {options.some((o) => o.external) && <p className="mt-2 text-small text-ink-2">{t('maps.open')}</p>}
      </>
    );
  }
  if (!v.next.length || v.phase === 'looking' || v.phase === 'listening') return null;
  return (
    <div className="mt-[0.9rem] grid gap-[0.6rem]" aria-label={t('next.label')}>
      {v.next.map((n) => (
        <button key={n.label} type="button" className="btn btn-next" onClick={n.act}>
          {n.label}
        </button>
      ))}
    </div>
  );
}

/** Phone and desktop: the three sample pictures, each attaching itself with its question. */
export function SamplesRow() {
  return (
    <div className="mt-3">
      <p className="mb-2 text-small font-semibold text-ink-2 max-[22.5rem]:sr-only">{t('home.samples')}</p>
      <SampleButtons compact />
    </div>
  );
}

/** The newest answer, live: it is being said, and its buttons work. */
function LiveAnswer({ coach }: { coach: boolean }) {
  const v = useAsk();
  const hasWords = !!(v.head || v.steps || v.lines.some((l) => l.kind !== 'heard' && l.text) || v.items?.length || v.choices || v.next.length);
  if (!hasWords && !coach) return null;
  const explain = !!v.kept && (v.phase === 'settled' || v.phase === 'waiting');
  return (
    <article className="msg-wk" aria-live="polite">
      {!hasWords && coach ? (
        <p className="text-caption font-medium tracking-[-0.012em]">{v.chosen ? t('home.coach.picture') : t('home.coach')}</p>
      ) : (
        <>
          <Steps steps={v.steps} />
          <Head head={v.head} />
          <Lines lines={v.lines} now={v.done ? null : v.now} />
          {v.phase !== 'listening' && <Items items={v.items} />}
          <LinkButtons links={v.links} />
          <Tags receipt={v.receipt} kept={v.kept} picture={v.still} explain={explain} />
        </>
      )}
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
    <div ref={box} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-1 pt-2 pb-3 [scrollbar-width:thin]">
      {v.history.map((m) =>
        m.who === 'me' ? (
          <MeBubble key={m.id} m={m} looking={m === lastMe && v.looking} reading={m === lastMe && v.reading} />
        ) : (
          <WkBubble key={m.id} m={m} />
        ),
      )}
      <LiveAnswer coach={false} />
    </div>
  );
}

/** Before the first message: the greeting (or a dead end, such as no camera) under the camera window. */
export function Opening() {
  const v = useAsk();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pt-1 pb-2">
      <LiveAnswer coach />
      {!v.chosen && !v.offerSamples && !v.choices && <SamplesRow />}
    </div>
  );
}
