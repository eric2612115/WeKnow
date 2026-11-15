// The words under the window: "You asked", the step bar, the verdict, the spoken sentences as captions (the one
// being spoken in full ink), the lines of a quote, the choices, and the where-it-ran tag pinned to the bottom.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { pick, submitTyped, useAsk, type IconKey } from '../ask/conversation';
import { deviceWord } from '../engine/device';
import { I, ToneIcon } from '../ui/icons';
import { WhereTag } from '../ui/Receipt';
import { openSheet } from '../ui/uiStore';
import { t, money } from '../strings';
import { projectName, useData } from '../store/data';
import { explainCurrent } from '../app/explainOpen';
import { SampleButtons } from '../app/Sheets';
import type { LineItem } from '../answer/types';

const HEAD_ICON: Record<IconKey, () => ReactNode> = {
  mic: I.mic,
  say: I.say,
  lamp: I.lamp,
  nonet: I.nonet,
  camoff: I.camoff,
  help: I.help,
};

function Head() {
  const v = useAsk();
  if (!v.head) return null;
  const { tone, text, icon } = v.head;
  const Icon = icon ? HEAD_ICON[icon] : null;
  return (
    <h2 key={`${tone}:${text}`} className="verdict mb-[0.6rem]" data-tone={tone} aria-live="polite">
      {Icon ? <Icon /> : <ToneIcon tone={tone} />}
      <span>{text}</span>
    </h2>
  );
}

function Steps() {
  const v = useAsk();
  if (!v.steps) return null;
  const { label, n, total } = v.steps;
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
  fair: { cls: 'text-go', icon: I.check, text: () => t('line.fair') },
  found: { cls: 'text-net', icon: I.check, text: () => t('line.found') },
  low: { cls: 'text-go', icon: I.check, text: () => t('line.low') },
  high: { cls: 'text-warn-ink bg-warn-bg', icon: I.warn, text: (i) => t('quote.mark', { over: money(i.over ?? 0) }) },
  pending: { cls: 'text-net bg-net-bg', icon: I.help, text: () => t('line.pending') },
};

function Items() {
  const v = useAsk();
  if (!v.items?.length) return null;
  return (
    <ol className="mb-2 grid grid-cols-[minmax(0,1fr)] gap-0.5 rounded-btn border border-hair bg-card px-2 py-1.5" aria-label="Lines on the paper">
      {v.items.map((it) => {
        const s = STATE[it.state];
        const Icon = s.icon;
        return (
          <li key={it.n} className="flex min-h-9 min-w-0 items-center gap-2 px-1 text-small lg:min-h-10">
            <span className="w-5 flex-none text-right font-semibold text-ink-2">{it.n}</span>
            <span className="min-w-0 flex-1 truncate font-semibold" title={it.label}>
              {it.label}
            </span>
            <span className="flex-none tabular-nums">{it.amount !== null ? money(it.amount) : ''}</span>
            <span className={`inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 font-semibold [&_svg]:size-[1.1rem] ${s.cls}`}>
              <Icon />
              <span className={it.state === 'high' || it.state === 'pending' ? '' : 'max-md:sr-only'}>{s.text(it)}</span>
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

function Lines() {
  const v = useAsk();
  return (
    <div aria-live="polite">
      {v.lines.map((l) => {
        // Every sentence stays readable; the one being said carries a green mark at its edge.
        const now = l.id === v.now && !v.done;
        const mark = now ? 'shadow-[inset_3px_0_0_var(--go)] pl-3 -ml-3' : '';
        if (l.kind === 'warn')
          return (
            <p key={l.id} className="my-[0.45rem] flex items-start gap-2 rounded-btn bg-warn-bg px-[0.8rem] py-[0.65rem] text-caption font-semibold tracking-[-0.012em] text-warn-ink lg:text-[1.4375rem] [&_svg]:mt-0.5 [&_svg]:size-7 [&_svg]:flex-none">
              <I.warn />
              <span>{l.text}</span>
            </p>
          );
        return (
          <div key={l.id}>
            <p
              className={`my-[0.45rem] tracking-[-0.012em] text-ink transition-shadow ${mark} ${
                l.kind === 'strong' || l.kind === 'heard'
                  ? 'min-h-[1.4em] text-strong font-bold tracking-[-0.02em] lg:text-[1.7rem]'
                  : 'text-caption font-medium lg:text-[1.4375rem]'
              } ${l.kind === 'ok' ? 'flex items-start gap-2 [&_svg]:mt-0.5 [&_svg]:size-7 [&_svg]:flex-none [&_svg]:text-go' : ''}`}
            >
              {l.kind === 'ok' && <I.ok />}
              <span>{l.text}</span>
            </p>
            {l.noteTag && <NoteTag />}
          </div>
        );
      })}
    </div>
  );
}

/** Links that stay under an answer (Find a pro nearby, Call someone). */
function Links() {
  const v = useAsk();
  if (!v.links.length) return null;
  return (
    <div className="mt-[0.9rem] grid gap-[0.7rem]">
      {v.links.map((o, i) => (
        <a
          key={o.value}
          href={o.href}
          className={`btn ${i === 0 ? 'btn-yes' : ''}`}
          {...(o.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {o.icon === 'map' ? <I.map /> : <I.phone />}
          {o.label}
        </a>
      ))}
      {v.links.some((o) => o.external) && <p className="text-small text-ink-2">{t('maps.open')}</p>}
    </div>
  );
}

/** Phone home: the three sample pictures, each asking its own question with one press. */
function SamplesRow() {
  return (
    <div className="mt-3">
      <p className="mb-2 text-small font-semibold text-ink-2">{t('home.samples')}</p>
      <SampleButtons compact />
    </div>
  );
}

function Choices() {
  const v = useAsk();
  if (!v.choices) return null;
  const { options, stack } = v.choices;
  return (
    <>
    <div className={`mt-[0.9rem] grid gap-[0.7rem] ${stack || options.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
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

function Typing() {
  const v = useAsk();
  const [text, setText] = useState('');
  if (!v.typing) return null;
  return (
    <form
      className="mt-[0.9rem] grid gap-[0.7rem]"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) submitTyped(text.trim());
      }}
    >
      <label className="grid gap-[0.35rem] text-small font-semibold text-ink-2">
        {t('hear.type.label')}
        <input className="field" autoFocus value={text} maxLength={200} onChange={(e) => setText(e.target.value)} />
      </label>
      <button type="submit" className="btn btn-yes">
        {t('hear.type.go')}
      </button>
    </form>
  );
}

export function KeptChip() {
  const v = useAsk();
  const data = useData();
  const c = v.kept ? data.checks.find((x) => x.id === v.kept!.checkId) : undefined;
  if (!c) return null;
  return (
    <button type="button" className="tag" onClick={() => openSheet({ type: 'move', checkId: c.id })}>
      <I.folder />
      <span>{t('kept.chip', { project: projectName(c.projectId) })}</span>
      <I.chev />
    </button>
  );
}

/** Phone: the words sit on the page and scroll as one; nothing is pinned over them. Desktop: the same in a card. */
export function Words({ desktop = false }: { desktop?: boolean }) {
  const v = useAsk();
  const box = useRef<HTMLDivElement>(null);
  const device = deviceWord();
  const headKey = v.head ? `${v.head.tone}:${v.head.text}` : '';
  // A new answer: show its start (the verdict and its reasons). Otherwise keep the newest words in view.
  useEffect(() => {
    const el = box.current;
    if (el && !desktop && headKey) el.scrollTop = 0;
  }, [headKey, desktop]);
  useEffect(() => {
    const el = box.current;
    if (el && !desktop && !headKey) el.scrollTop = v.phase === 'ready' ? 0 : el.scrollHeight;
  }, [v.lines.length, v.choices, v.typing, desktop, headKey, v.phase]);
  const showAsked = v.asked && !(v.head && v.head.tone !== 'plain');
  const answerLike = !!v.head && v.phase !== 'listening';
  const ready = v.phase === 'ready' && !v.head;
  const coach = ready && !v.lines.length;
  const explain = v.kept && (v.phase === 'settled' || v.phase === 'waiting');
  return (
    <div
      ref={box}
      className={
        desktop
          ? 'card rounded-win px-[1.3rem] pt-[1.25rem] pb-[1.3rem]'
          : 'flex min-h-0 flex-col overflow-auto px-[0.2rem] pb-1 [scrollbar-width:thin]'
      }
    >
      {showAsked && <p className="mb-2 text-small text-ink-2">{v.asked}</p>}
      <Steps />
      <Head />
      {coach ? (
        <p className="my-[0.45rem] text-caption font-medium tracking-[-0.012em] lg:text-[1.4375rem]">{t('home.coach')}</p>
      ) : (
        <Lines />
      )}
      <Choices />
      <Typing />
      <Links />
      {answerLike && <Items />}
      {(v.receipt || v.kept) && (
        <div className={desktop ? 'flex flex-wrap gap-2 pt-4 empty:hidden' : 'mt-3 flex gap-2 pb-[0.2rem] [&>*]:min-w-0 [&>*]:flex-1'}>
          {!desktop && v.receipt && <WhereTag r={v.receipt} device={device} onOpen={() => openSheet({ type: 'receipt' })} />}
          {desktop && <KeptChip />}
          {explain && (
            <button type="button" className="tag" onClick={() => void explainCurrent()}>
              <I.lang />
              <span>{t('explain.button')}</span>
            </button>
          )}
        </div>
      )}
      {ready && !desktop && <SamplesRow />}
    </div>
  );
}
