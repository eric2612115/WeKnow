// The front page, in the product site's calm system (styles.css, ".site"): one headline, one line and one big box that
// leads into the app; the four test papers as a gallery (what WeKnow covered, what went online, the answer, the source);
// three numbered steps; the privacy promise; then how it is built, for people who want the parts by their real names.
// Its words name those parts, so they live here and not in strings.ts (the app's own words never name a model or a
// service).

import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowUp, Camera, Moon, Plus, Sun, Upload } from 'lucide-react';
import { Mark } from '../ui/controls';
import { setPrefs, usePrefs } from '../store/prefs';

const REPO = 'https://github.com/eric2612115/WeKnow';
const CLAIMS = `${REPO}/blob/main/docs/claims.md`;
const EVAL = `${REPO}/tree/main/docs/eval`;
const REPORT = `${REPO}/blob/main/docs/technical-report.md`;
const LICENSE = `${REPO}/blob/main/LICENSE`;

/** The page's one width. */
const wrapper = 'mx-auto w-full max-w-[72rem] px-5 md:px-8';
const quiet = 'text-s-muted no-underline transition-colors hover:text-s-ink';
const under = 'text-s-ink underline decoration-s-hair underline-offset-[6px] transition-colors hover:decoration-s-ink';

function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-[-0.02em] text-s-ink ${className}`}>
      <Mark className="size-[1.2em] flex-none text-s-accent" />
      WeKnow
    </span>
  );
}

const Out = ({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className={className}>
    {children}
  </a>
);

/** A section: its heading, one optional line under it, then the content. */
function Section({ id, title, lead, center = false, children }: { id?: string; title: string; lead?: string; center?: boolean; children: ReactNode }) {
  return (
    <section id={id} aria-label={title} className="py-16 md:py-24">
      <div className={center ? 'mx-auto max-w-[40rem] text-center' : 'max-w-[40rem]'}>
        <h2 className="s-h2">{title}</h2>
        {lead && <p className="s-lead mt-3 text-s-muted">{lead}</p>}
      </div>
      <div className="mt-10 md:mt-12">{children}</div>
    </section>
  );
}

type Tone = 'stop' | 'warn';
/** The small coloured mark in front of an answer. */
const ToneDot = ({ tone }: { tone: Tone }) => (
  <span className={`mt-[0.55em] size-2.5 flex-none rounded-full ${tone === 'stop' ? 'bg-s-stop' : 'bg-s-warn'}`} aria-hidden="true" />
);

// ---------- the header ----------

function Header() {
  const p = usePrefs();
  const dark = p.theme === 'dark' || (p.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const look = dark ? 'Light screen' : 'Dark screen';
  const link = 'rounded-full px-3 py-2 s-small ' + quiet;
  return (
    <header className="sticky top-0 z-20 bg-s-bg/85 backdrop-blur-md">
      <div className={`${wrapper} flex h-16 items-center`}>
        <Link to="/" aria-label="WeKnow home" className="no-underline">
          <Logo className="text-[1.25rem]" />
        </Link>
        <nav className="ml-auto flex items-center">
          <a href="#examples" className={`${link} max-md:hidden`}>
            Examples
          </a>
          <a href="#built" className={`${link} max-md:hidden`}>
            How it’s built
          </a>
          <Out href={REPO} className={`${link} max-md:hidden`}>
            Code
          </Out>
          <button
            type="button"
            className="inline-grid size-11 place-items-center rounded-full text-s-muted transition-colors hover:bg-s-surface hover:text-s-ink"
            aria-label={look}
            title={look}
            onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}
          >
            {dark ? <Sun className="size-[1.15rem]" strokeWidth={1.75} aria-hidden="true" /> : <Moon className="size-[1.15rem]" strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <Link to="/app" className="pill pill-solid s-small ml-2 min-h-10 px-4">
            Open WeKnow
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ---------- the first screen ----------

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate pt-16 pb-8 text-center md:pt-28">
      <div className="glow" aria-hidden="true" />
      <h1 id="hero-title" className="s-display mx-auto max-w-[14ch]">
        Check it before you pay.
      </h1>
      <p className="s-lead mx-auto mt-5 max-w-[34rem] text-s-muted">
        WeKnow reads a bill or a quote on your own device, covers your personal details, and tells you what to do next, with the source.
      </p>

      <div className="mx-auto mt-10 max-w-[42rem] rounded-[1.75rem] border border-s-hair bg-s-bg p-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_60px_-24px_rgb(0_0_0/0.22)]">
        <Link to="/app" className="s-lead block rounded-[1.25rem] px-4 pt-4 pb-10 text-s-muted no-underline transition-colors hover:text-s-ink md:pb-14">
          Snap or upload a bill or a quote
        </Link>
        <div className="flex items-center gap-1 px-1 pb-1">
          <Link to="/app?start=camera" className="pill pill-line s-small min-h-11 px-4">
            <Camera strokeWidth={1.75} aria-hidden="true" />
            Take a photo
          </Link>
          <Link to="/app?start=upload" className="pill pill-line s-small min-h-11 px-4">
            <Upload strokeWidth={1.75} aria-hidden="true" />
            Upload
          </Link>
          <Link to="/app" className="ml-auto grid size-11 place-items-center rounded-full bg-s-ink text-s-bg transition-opacity hover:opacity-85" aria-label="Open WeKnow" title="Open WeKnow">
            <ArrowUp className="size-5" strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <p className="s-small mt-4 text-s-muted">No sign-in. Your paper never leaves your device.</p>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-2" role="group" aria-label="Try a sample">
        <span className="s-small text-s-muted max-md:w-full md:mr-1">Try a sample</span>
        <Link to="/app?sample=bill" className="s-small rounded-full border border-s-hair px-4 py-2 text-s-ink no-underline transition-colors hover:border-s-muted">
          A bill
        </Link>
        <Link to="/app?sample=quote" className="s-small rounded-full border border-s-hair px-4 py-2 text-s-ink no-underline transition-colors hover:border-s-muted">
          A quote
        </Link>
      </div>
    </section>
  );
}

// ---------- the gallery: the made-up test papers in docs/test-sheets ----------

/** A piece of a redrawn line: plain words, a covered detail (its width in characters), or words that went online. */
type Seg = string | { cover: number } | { went: string };
type Line = Seg[] | { row: [Seg, string]; flag?: boolean };
type Case = {
  id: string;
  file: string;
  tag: string;
  head: Seg[];
  lines: Line[];
  tone: Tone;
  answer: string;
  went: string;
  source: string;
};

const CASES: Case[] = [
  {
    id: 'new-account',
    file: 'bill-3-electric-new-account-buried',
    tag: 'Electric bill',
    head: ['Riverbend Electric Co-op'],
    lines: [
      [{ cover: 8 }, ' ', { cover: 6 }],
      [{ cover: 13 }],
      { row: ['Amount due by Dec 1', '$89.00'] },
      { row: ['Our bank has changed. Pay to our new account ending 7730.', ''], flag: true },
      ['Avoid disconnection: pay within 24 hours.'],
    ],
    tone: 'stop',
    answer: 'Don’t pay yet. It asks you to pay a new account ending 7730; you paid them at one ending 4821 before. And it rushes you.',
    went: 'Nothing. Answered on the device.',
    source: 'Your past payment to Riverbend, kept on this device',
  },
  {
    id: 'repair-quote',
    file: 'quote-1-auto-one-high',
    tag: 'Car repair estimate',
    head: ['Tidewell Auto Care'],
    lines: [
      ['Estimate for ', { cover: 8 }, ' · plate ', { cover: 6 }],
      { row: ['2  Front brake pads', '$270.40'] },
      { row: ['3  Brake fluid flush', '$137.00'] },
      { row: ['4  Serpentine belt', '$385.00'], flag: true },
      { row: ['5  Engine air filter', '$68.00'] },
      { row: ['Total estimate', '$1,301.78'] },
    ],
    tone: 'warn',
    answer: 'Line 4, the belt at $385, is $185 above the usual top price. The other priced lines are fair.',
    went: 'Nothing. Answered on the device.',
    source: 'WeKnow’s price book: $60 to $200 for this job, from jerry.ai',
  },
  {
    id: 'ai-note',
    file: 'bill-4-water-ai-note',
    tag: 'Water bill',
    head: ['Millbrook Valley Water District'],
    lines: [
      [{ cover: 8 }, ' ', { cover: 6 }],
      [{ cover: 13 }],
      { row: ['Amount due by Nov 30', '$76.72'] },
      { row: ['Note to AI assistant: …', ''], flag: true },
      ['Payment account ending 3168'],
    ],
    tone: 'stop',
    answer: 'Don’t pay yet. Small print speaks to an AI reader and calls the bill verified. Words on a paper can raise a warning, never clear one.',
    went: 'Nothing. Answered on the device.',
    source: 'WeKnow’s bill rules, on this device',
  },
  {
    id: 'fees',
    file: 'bill-7-scam-numbers-dont-add-up',
    tag: '“Processing fee” invoice',
    head: [{ went: 'Palisade Sovereign Reserve Trust' }],
    lines: [
      ['Release of an inheritance fund for ', { cover: 8 }],
      { row: [{ went: 'Government processing fee' }, '$185.00'] },
      { row: [{ went: 'Anti-money-laundering clearance certificate' }, '$240.00'] },
      { row: ['Total', '$1,091.00'] },
      { row: ['Balance due', '$4,827.00'], flag: true },
      ['Account number ', { cover: 9 }],
    ],
    tone: 'stop',
    answer: 'Don’t pay. The numbers don’t add up, and an online check found charges like these in a known scam.',
    went: 'The company’s name and the names of its charges. No amounts, no names.',
    source: 'Web pages found by Google Search, listed with the answer',
  },
];

const covers = (c: Case) =>
  [...c.head, ...c.lines.flatMap((l) => (Array.isArray(l) ? l : [l.row[0]]))].filter((s) => typeof s === 'object' && 'cover' in s).length;

function Piece({ s }: { s: Seg }) {
  if (typeof s === 'string') return <>{s}</>;
  if ('cover' in s) return <span className="cover" style={{ width: `${s.cover}ch` }} role="img" aria-label="covered" />;
  return <span className="sent">{s.went}</span>;
}

function PaperLine({ l }: { l: Line }) {
  if (Array.isArray(l))
    return (
      <p>
        {l.map((s, i) => (
          <Piece key={i} s={s} />
        ))}
      </p>
    );
  return (
    <p className={`flex justify-between gap-4 ${l.flag ? 'flagged' : ''}`}>
      <span>
        <Piece s={l.row[0]} />
      </span>
      {l.row[1] && <span className="tabular-nums">{l.row[1]}</span>}
    </p>
  );
}

function CaseCard({ c }: { c: Case }) {
  const n = covers(c);
  return (
    <li id={`case-${c.id}`} className="flex flex-col overflow-hidden rounded-[1.25rem] bg-s-surface">
      {/* The paper sits in a fixed-height window, so every card lines up. */}
      <div className="relative overflow-hidden px-5 pt-6 pb-2 md:h-[16rem] md:px-8 md:pt-8 md:pb-0">
        <div className="mx-auto max-w-[24rem] rotate-[-0.6deg]">
          <div className="paper px-5 py-4">
            <p className="mb-2 text-[1.0625rem] font-bold">
              {c.head.map((s, i) => (
                <Piece key={i} s={s} />
              ))}
            </p>
            {c.lines.map((l, i) => (
              <PaperLine key={i} l={l} />
            ))}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-s-surface max-md:hidden" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6 md:p-7">
        <p className="s-small flex flex-wrap justify-between gap-x-4 text-s-muted">
          <span className="text-s-ink">{c.tag}</span>
          <span>{n === 1 ? '1 detail covered' : `${n} details covered`}</span>
        </p>
        <p className="s-lead flex gap-3 font-semibold tracking-[-0.01em]">
          <ToneDot tone={c.tone} />
          <span>{c.answer}</span>
        </p>
        <dl className="s-small mt-auto grid gap-2 border-t border-s-hair pt-4">
          <div className="grid gap-0.5 sm:flex sm:gap-3">
            <dt className="flex-none text-s-muted sm:w-32">Went online</dt>
            <dd className="min-w-0">{c.went}</dd>
          </div>
          <div className="grid gap-0.5 sm:flex sm:gap-3">
            <dt className="flex-none text-s-muted sm:w-32">Source</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere]">
              {c.source}
              <span className="block text-s-muted">
                Made-up test paper ·{' '}
                <a href={`/test-sheets/${c.file}.pdf`} download className="text-s-muted underline underline-offset-4">
                  PDF
                </a>{' '}
                ·{' '}
                <a href={`/test-sheets/${c.file}.png`} download className="text-s-muted underline underline-offset-4">
                  picture
                </a>
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </li>
  );
}

function Gallery() {
  return (
    <Section id="examples" title="See what it sees" lead="Black bars are what WeKnow covers on the device. Green is the only part that goes online.">
      <ul className="grid gap-5 md:grid-cols-2 md:gap-6">
        {CASES.map((c) => (
          <CaseCard key={c.id} c={c} />
        ))}
      </ul>
      <p className="s-small mt-6 text-s-muted">
        Print one and take a photo, or drop the PDF into WeKnow. One more, an ordinary electricity bill:{' '}
        <a href="/test-sheets/bill-2-electric-normal.pdf" download className="text-s-muted underline underline-offset-4">
          PDF
        </a>{' '}
        ·{' '}
        <a href="/test-sheets/bill-2-electric-normal.png" download className="text-s-muted underline underline-offset-4">
          picture
        </a>
        .
      </p>
    </Section>
  );
}

// ---------- the steps and the promise ----------

const STEPS = [
  ['Read on your device', 'Gemini Nano in Chrome, or Apple’s on-device model on iPhone, reads the paper. Nothing is uploaded.'],
  ['Your details covered', 'Names, addresses, account, card and phone numbers are covered before anything else happens.'],
  ['Plain code decides', 'The model only fills a form. Plain code checks it against price books and bill rules, each with a source.'],
] as const;

function Steps() {
  return (
    <Section id="how" title="How it works">
      <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
        {STEPS.map(([title, line], i) => (
          <li key={title} className="border-t border-s-hair pt-5">
            <span className="s-small text-s-muted tabular-nums">{i + 1}</span>
            <h3 className="s-lead mt-2 font-semibold tracking-[-0.01em]">{title}</h3>
            <p className="s-body mt-1 text-s-muted">{line}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Privacy() {
  return (
    <section aria-label="Your paper never leaves your device." className="py-16 md:py-24">
      <div className="mx-auto max-w-[46rem] text-center">
        <p className="s-h2 md:text-[2.75rem] md:leading-[1.1]">Your paper never leaves your device.</p>
        <p className="s-lead mx-auto mt-5 max-w-[36rem] text-s-muted">
          Only a covered question, or a company’s name and its charges, can go online. A light shows the exact words while they are out, and every answer
          says where it came from.
        </p>
      </div>
    </section>
  );
}

// ---------- how it is built ----------

/** A row that opens to its detail; the opening slides, and stays still with Reduce Motion. */
function Opens({ q, line, children }: { q: ReactNode; line?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <li className="border-b border-s-hair">
      <button type="button" className="flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="min-w-0">
          <span className="s-lead block">{q}</span>
          {line && <span className="s-small block text-s-muted">{line}</span>}
        </span>
        <Plus
          className={`size-5 flex-none text-s-muted transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
      <div id={id} className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className={`min-h-0 overflow-hidden ${open ? '' : 'invisible'}`}>
          <div className="s-body max-w-[44rem] pb-5 text-s-muted">{children}</div>
        </div>
      </div>
    </li>
  );
}

type PipeStep = { title: string; line: string; data?: string; how: string; tech?: string[] };

const PIPE: PipeStep[] = [
  {
    title: 'Capture',
    line: 'The camera opens only when you press it.',
    data: 'The photo, or typed or spoken words.',
    how: 'The picture stays in memory until you keep a check.',
    tech: ['Web: getUserMedia', 'iPhone: UIImagePickerController'],
  },
  {
    title: 'Read the words',
    line: 'Read on the device.',
    data: 'The text on the paper, with its position.',
    how: 'On the web, Chrome’s Gemini Nano reads the photo itself; in a browser without it, the text recognizer reads the words for the basic check.',
    tech: ['iPhone: Apple Vision text recognition', 'Web: Gemini Nano, multimodal Prompt API', 'Web: tesseract.js for the basic check'],
  },
  {
    title: 'Cover personal details',
    line: 'Tokens like [phone] in the text. Black bars on the picture.',
    data: 'Names, phones, emails, street addresses, plates, VINs, account and card numbers, SSNs.',
    how: 'Pattern rules plus Apple’s on-device name tagger replace them with tokens and draw black bars on the picture. The copy kept in My checks is the covered one. The exact text that would be sent is shown before you agree.',
    tech: ['iPhone: regex rules + NaturalLanguage name tagger', 'Web: core/pii.ts over the words found on the device'],
  },
  {
    title: 'Fill a fixed form',
    line: 'The model may only fill this form.',
    data: 'Kind (quote, bill or problem), each line’s label and amount, the payee, the last 4 digits of the account, and three warning flags: urgent, account changed, words aimed at an AI.',
    how: 'It never writes prices or free-text answers. An amount counts only when one value is printed beside its label; a payee printed nowhere on the paper is dropped. With no model on the device, plain code fills it for a bill.',
    tech: ['Both: Firebase AI Logic hybrid inference with structured output', 'iPhone: Apple Foundation Models guided generation', 'Web: Chrome Prompt API with a JSON schema'],
  },
  {
    title: 'Find candidates in the knowledge pack',
    line: 'At most 5 pack items per line, by plain code.',
    how: 'Found by plain code on the device.',
    tech: [
      'Web: layered pack, catalog → root with a Bloom filter per shard → MiniSearch BM25 shard index → content-hashed data blocks',
      'iPhone: installed pack sections with an IDF-weighted matcher, synonyms and a stemmer',
    ],
  },
  {
    title: 'Choose',
    line: 'The model marks which offered items are the same job.',
    how: 'True or false per option. It cannot name anything it was not offered; an unknown ref is rejected.',
  },
  {
    title: 'Decide in plain code',
    line: 'Price against the sourced range. Bill rules.',
    how: 'Price against the sourced low and high range (“$185 above the usual top”). Bill rules: account changed against the payee you remembered, urgency phrases (Remote Config can add more), words aimed at an AI. Text on the paper can add a warning, never remove one.',
  },
  {
    title: 'Answer and remember',
    line: 'Spoken and on screen. Kept on this device.',
    how: 'Spoken and on screen, with next-question buttons. Remembered payees and your checks stay on this device.',
    tech: ['iPhone: SpeechAnalyzer, on-device', 'Web: Chrome speech recognition, processLocally', 'Both: speech synthesis'],
  },
];

const STAYS = ['The photo or PDF', 'Names, addresses and numbers', 'Your checks', 'The payees you remembered', 'Reading and deciding'];
const GOES = [
  ['A question the device can’t answer', 'Covered first. Gemini names an item from the pack’s index, or searches Google and returns a how-to with sources.'],
  ['A price lookup', 'The line’s name and the region. Used only with https sources, judged by the same plain code, kept on the device.'],
  ['A check on a suspicious bill', 'The company and the names of its charges. It can make a warning stronger, never weaker.'],
  ['Downloads', 'Pack files from Hosting and settings from Remote Config. Nothing about you.'],
] as const;

const FIREBASE = [
  ['AI Logic', 'Hybrid on-device and cloud inference, structured output, Google Search grounding, server prompt templates for the evaluation.'],
  ['App Check', 'Only the real app can call the model: reCAPTCHA Enterprise on the web, App Attest on iPhone.'],
  ['Authentication', 'Anonymous by default. Optional Google sign-in on the web.'],
  ['Cloud Firestore', 'Deny-by-default rules that accept only a masked item name and a region.'],
  ['Remote Config', 'The cloud model, the pack version, the warning phrases and the lookup switch change without a release.'],
  ['Hosting', 'The app and the layered knowledge packs. Every price and guide has a source.'],
] as const;

const PROOF = [
  { big: '50 of 50', small: 'made-up quotes and bills judged right, 0 personal details leaked', href: EVAL },
  { big: '173', small: 'sourced prices, and 80 repair guides', href: REPO },
  { big: 'Wi-Fi off', small: 'answers in Chrome and on iPhone', href: CLAIMS },
  { big: 'Apache-2.0', small: 'open source', href: LICENSE },
];

function Built() {
  return (
    <Section id="built" title="How it’s built" lead="The device reads and decides. The cloud only answers a covered question.">
      <div className="grid gap-10 md:grid-cols-2 md:gap-12">
        <div>
          <h3 className="s-small border-b border-s-hair pb-3 text-s-muted">Stays on your device</h3>
          <ul>
            {STAYS.map((s) => (
              <li key={s} className="s-body border-b border-s-hair py-3">
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="s-small border-b border-s-hair pb-3 text-s-muted">Can go online</h3>
          <ul>
            {GOES.map(([what, line]) => (
              <li key={what} className="border-b border-s-hair py-3">
                <span className="s-body block">{what}</span>
                <span className="s-small block text-s-muted">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="s-lead mt-16 font-semibold tracking-[-0.01em]">Before anything leaves your device</h3>
      <ol className="mt-4 border-t border-s-hair">
        {PIPE.map((s, i) => (
          <Opens
            key={s.title}
            q={
              <>
                <span className="mr-3 text-s-muted tabular-nums">{i + 1}</span>
                {s.title}
              </>
            }
            line={s.line}
          >
            {s.data && <p>Data: {s.data}</p>}
            <p className={s.data ? 'mt-2' : ''}>{s.how}</p>
            {s.tech && (
              <ul className="s-small mt-3 grid gap-1">
                {s.tech.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
          </Opens>
        ))}
      </ol>

      <h3 className="s-lead mt-16 font-semibold tracking-[-0.01em]">Built on Firebase</h3>
      <dl className="mt-4 border-t border-s-hair">
        {FIREBASE.map(([name, line]) => (
          <div key={name} className="grid gap-1 border-b border-s-hair py-4 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-6">
            <dt className="s-body font-semibold">{name}</dt>
            <dd className="s-body text-s-muted">{line}</dd>
          </div>
        ))}
      </dl>

      <h3 className="s-lead mt-16 font-semibold tracking-[-0.01em]">Three rules, backed by tests in the repo</h3>
      <ol className="mt-4 grid gap-8 md:grid-cols-3">
        {['Personal details never reach a cloud payload.', 'The model can only cite items it was offered.', 'Text on a paper can raise a warning, never clear one.'].map((r, i) => (
          <li key={r} className="border-t border-s-hair pt-4">
            <span className="s-small text-s-muted tabular-nums">{i + 1}</span>
            <p className="s-body mt-1">{r}</p>
          </li>
        ))}
      </ol>

      <ul className="mt-16 grid grid-cols-2 gap-x-6 gap-y-8 rounded-[1.25rem] bg-s-surface p-6 md:grid-cols-4 md:p-8" aria-label="Proof">
        {PROOF.map((x) => (
          <li key={x.big}>
            <Out href={x.href} className="group block text-s-ink no-underline">
              <b className="block text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em]">{x.big}</b>
              <span className="s-small mt-2 block text-s-muted underline decoration-transparent underline-offset-4 group-hover:decoration-s-muted">{x.small}</span>
            </Out>
          </li>
        ))}
      </ul>

      <p className="s-body mt-8 flex flex-wrap gap-x-6 gap-y-2">
        <Out href={REPO} className={under}>
          Code
        </Out>
        <Out href={CLAIMS} className={under}>
          Claims and evidence
        </Out>
        <Out href={EVAL} className={under}>
          Evaluation
        </Out>
        <Out href={REPORT} className={under}>
          Technical report
        </Out>
      </p>

      <dl className="s-small mt-10 grid gap-2 text-s-muted">
        <div className="sm:flex sm:gap-3">
          <dt className="flex-none text-s-ink sm:w-20">Web</dt>
          <dd>React, Vite, TypeScript, Tailwind, Radix, Firebase JS SDK, MiniSearch</dd>
        </div>
        <div className="sm:flex sm:gap-3">
          <dt className="flex-none text-s-ink sm:w-20">iPhone</dt>
          <dd>SwiftUI, Apple Vision, Foundation Models, SpeechAnalyzer, Firebase iOS SDK</dd>
        </div>
      </dl>
    </Section>
  );
}

// ---------- the footer ----------

function Footer() {
  return (
    <footer className="border-t border-s-hair">
      <div className={`${wrapper} flex flex-col gap-6 py-10 md:flex-row md:items-start md:justify-between`}>
        <div className="max-w-[28rem]">
          <Logo className="text-[1.125rem]" />
          <p className="s-small mt-3 text-s-muted">Every example and test paper here is made up.</p>
        </div>
        <div className="s-small flex flex-col gap-1 md:items-end">
          <Link to="/app" className={quiet}>
            Open WeKnow
          </Link>
          <Link to="/help" className={quiet}>
            Help
          </Link>
          <Out href={REPO} className={quiet}>
            Code · Apache-2.0
          </Out>
        </div>
      </div>
    </footer>
  );
}

export default function How() {
  return (
    <div className="site min-h-dvh overflow-x-clip">
      <Header />
      <main id="main" className={wrapper}>
        <Hero />
        <Gallery />
        <Steps />
        <Privacy />
        <Built />
      </main>
      <Footer />
    </div>
  );
}
