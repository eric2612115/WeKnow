// The front page: how WeKnow works, for a first visit and for people who want to see how it is built. Its spine: the
// device and the cloud stay in sync while personal details stay on the device. It opens with seven scrolling slides
// (Story.tsx), then the details: the main picture (the cloud above, the device below, the gated arrows between); the eight steps that happen
// before anything leaves the device; exactly what can cross to the cloud; the sync loop; why hybrid is hard; what the
// device does by itself; the Firebase services; the five test papers to try; the proof; the stack. One short line per idea, the detail opens on a
// press. Its words name the parts by their real names, so they live here and not in strings.ts (the app's own words
// never name a model or a service).

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Camera,
  Check,
  Cloud,
  Cpu,
  Database,
  Download,
  EyeOff,
  FileText,
  Folder,
  Globe,
  Languages,
  ListChecks,
  Lock,
  MessageSquare,
  Mic,
  Moon,
  NotebookText,
  Plane,
  Plus,
  RefreshCw,
  Scale,
  ScanText,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sun,
  TriangleAlert,
  UserRound,
  Volume2,
  WifiOff,
  Wrench,
  X,
  ZoomIn,
  type LucideIcon,
} from 'lucide-react';
import { Mark } from '../ui/controls';
import { setPrefs, usePrefs } from '../store/prefs';
import { t } from '../strings';
import { Story } from './Story';

const REPO = 'https://github.com/eric2612115/WeKnow';
const CLAIMS = `${REPO}/blob/main/docs/claims.md`;
const EVAL = `${REPO}/tree/main/docs/eval`;
const REPORT = `${REPO}/blob/main/docs/technical-report.md`;
const LICENSE = `${REPO}/blob/main/LICENSE`;

const stillMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The page's one width: everything sits inside it. */
const wrapper = 'mx-auto w-full max-w-[1160px] px-5 lg:px-12';
/** The page's one pill. */
const pill = 'inline-flex min-h-9 items-center gap-2 rounded-full bg-card-2 px-3 py-1 text-[0.9375rem] leading-tight font-semibold text-ink-2';

function Lockup({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-[0.4em] font-semibold tracking-[-0.03em] text-ink ${className}`}>
      <Mark className="size-[1.25em] flex-none text-go" />
      WeKnow
    </span>
  );
}

/** Fades and slides its children in the first time they come on screen. Still when the person asked for less motion. */
function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || stillMotion()) return setSeen(true);
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`transition-[opacity,transform] duration-700 ease-wk motion-reduce:transition-none ${seen ? '' : 'translate-y-5 opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

/** The part that opens: it slides, and is out of reach while shut. */
function Panel({ id, open, children }: { id: string; open: boolean; children: ReactNode }) {
  return (
    <div id={id} aria-hidden={!open} className={`grid transition-[grid-template-rows] duration-300 ease-wk motion-reduce:transition-none ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className={`min-h-0 overflow-hidden ${open ? '' : 'invisible'}`}>{children}</div>
    </div>
  );
}

const Sign = ({ open }: { open: boolean }) => (
  <Plus className={`size-5 flex-none text-ink-2 transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-45' : ''}`} strokeWidth={2.2} aria-hidden="true" />
);

/** A question that opens to its answer. */
function Fold({ q, children, className = '' }: { q: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`rounded-btn bg-card-2 ${className}`}>
      <button
        type="button"
        className="flex min-h-12 w-full items-center gap-3 rounded-btn border-0 bg-transparent px-4 py-2 text-left text-small font-semibold text-ink"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="min-w-0 flex-1">{q}</span>
        <Sign open={open} />
      </button>
      <Panel id={id} open={open}>
        <div className="px-4 pb-4 text-small text-ink-2">{children}</div>
      </Panel>
    </div>
  );
}

function Dot({ icon: Icon, cloud = false, small = false }: { icon: LucideIcon; cloud?: boolean; small?: boolean }) {
  return (
    <span className={`grid flex-none place-items-center rounded-full ${small ? 'size-9' : 'size-11'} ${cloud ? 'bg-net-bg text-net' : 'bg-ok-bg text-go'}`} aria-hidden="true">
      <Icon size={small ? 18 : 22} strokeWidth={2.2} />
    </span>
  );
}

function Section({ id, title, lead, children }: { id?: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <Reveal>
      <section id={id} className="mt-24 scroll-mt-24 lg:mt-28">
        <h2 className="text-[1.75rem] leading-[1.12] font-bold tracking-[-0.035em] lg:text-[2.4rem]">{title}</h2>
        {lead && <p className="mt-3 max-w-[44rem] text-small text-ink-2 lg:text-body">{lead}</p>}
        <div className="mt-7 lg:mt-10">{children}</div>
      </section>
    </Reveal>
  );
}

// ---------- the phone in the hero ----------

/** A phone with one answer on it: the paper with its details covered, the question, the answer, the box. */
// ---------- the main picture: the cloud above, the device below, the gated arrows between ----------

const IN_CLOUD: Array<{ icon: LucideIcon; name: ReactNode; line: string }> = [
  {
    icon: Cpu,
    name: (
      <>
        AI Logic <ArrowRight className="inline size-[1.1rem] align-[-0.15em]" aria-label="to" /> Gemini
      </>
    ),
    line: 'Prompt templates · Search grounding',
  },
  { icon: ShieldCheck, name: 'App Check', line: 'Only the real app can call.' },
  { icon: SlidersHorizontal, name: 'Remote Config', line: 'Change without a new release.' },
  { icon: Database, name: 'Firestore + Hosting', line: 'Masked requests in. Pack files out.' },
];

const ON_DEVICE: Array<{ icon: LucideIcon; name: ReactNode }> = [
  { icon: Camera, name: 'Camera' },
  { icon: EyeOff, name: 'Cover' },
  {
    icon: ScanText,
    name: (
      <>
        <span className="max-md:hidden">On-device </span>
        <span className="md:lowercase">Model</span>
      </>
    ),
  },
  { icon: BookOpen, name: 'Price book' },
  { icon: Volume2, name: 'Answer' },
];

/** A dotted line with an arrowhead, going up or down; its dots move the way it points. */
function Run({ up = false }: { up?: boolean }) {
  return (
    <svg viewBox="0 0 20 96" className="h-24 w-5 flex-none" fill="none" stroke={up ? 'var(--net)' : 'var(--go)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={up ? 'M10 94V6' : 'M10 2V90'} strokeDasharray="1 7" className="motion-safe:animate-dash" />
      <path d={up ? 'M4 9l6 -7l6 7' : 'M4 87l6 7l6 -7'} />
    </svg>
  );
}

/** One sentence beside a band, with its detail behind a question. */
function Note({ icon, line, q, children, cloud = false }: { icon: LucideIcon; line: string; q: string; children: ReactNode; cloud?: boolean }) {
  return (
    <div className="flex flex-col justify-center gap-3 max-lg:mb-6">
      <p className="flex items-center gap-3 text-small font-semibold text-ink">
        <Dot icon={icon} cloud={cloud} small />
        <span className="min-w-0">{line}</span>
      </p>
      <Fold q={q}>{children}</Fold>
    </div>
  );
}

/** The cloud above, the person's device below, and between them what goes up after a yes and what comes back. */
function Architecture() {
  const [step, setStep] = useState(-1);
  useEffect(() => {
    if (stillMotion()) return;
    const id = setInterval(() => setStep((s) => (s + 1) % ON_DEVICE.length), 1500);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
      {/* the cloud */}
      <div className="rounded-card bg-net-bg p-4 lg:p-5">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-net">
          <Cloud className="size-[1.15rem]" strokeWidth={2.2} aria-hidden="true" />
          The cloud · Firebase
        </h3>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {IN_CLOUD.map((c) => (
            <li key={c.line} className="flex items-center gap-3 rounded-btn bg-card p-3">
              <Dot icon={c.icon} cloud />
              <span className="min-w-0">
                <b className="block text-small font-bold tracking-[-0.01em] text-ink">{c.name}</b>
                <span className="block text-[0.9375rem] leading-[1.3] text-ink-2">{c.line}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <Note cloud icon={Cloud} line="The cloud helps only when asked." q="What runs there?">
        Gemini, through Firebase AI Logic, with server prompt templates and Google Search grounding. App Check, Remote Config, Cloud Firestore and Hosting
        stand behind it.
      </Note>

      {/* the arrows */}
      <div className="grid gap-x-6 gap-y-4 px-4 py-1 md:grid-cols-2 lg:px-5">
        <div className="flex items-center gap-4">
          <Run up />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-small font-bold text-net">
              <Lock className="size-[1.15rem] flex-none" strokeWidth={2.2} aria-hidden="true" />
              Only after a yes
            </p>
            <ul className="mt-1 text-small text-ink">
              <li>The picture</li>
              <li>A masked line name + region</li>
            </ul>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Run />
          <div className="min-w-0">
            <p className="text-small font-bold text-go">Comes back</p>
            <ul className="mt-1 text-small text-ink">
              <li>A reading in the fixed form</li>
              <li>A sourced price</li>
              <li>Pack files</li>
            </ul>
          </div>
        </div>
      </div>
      <Note icon={Lock} line="Nothing goes up without a yes." q="When does it go up?">
        <p>The picture: only on a device with no local model, for reading.</p>
        <p className="mt-2">A masked line name and a region: only for a quote line the price book does not know.</p>
      </Note>

      {/* the device */}
      <div className="rounded-card bg-ok-bg p-4 lg:p-5">
        <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-go">
          <Smartphone className="size-[1.15rem]" strokeWidth={2.2} aria-hidden="true" />
          Your phone or computer
        </h3>
        <ol className="mt-4 grid grid-cols-5">
          {ON_DEVICE.map((c, i) => (
            <li key={i} className="relative flex flex-col items-center gap-2 text-center">
              {i > 0 && <span className="absolute top-6 right-1/2 -left-1/2 h-[2px] bg-go opacity-30 lg:top-7" aria-hidden="true" />}
              <span
                className={`relative grid size-12 place-items-center rounded-full transition-colors duration-500 motion-reduce:transition-none lg:size-14 ${step === i ? 'bg-go text-on-go' : 'bg-card text-go'}`}
              >
                <c.icon size={24} strokeWidth={2.2} aria-hidden="true" />
                <b className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-go text-[0.75rem] leading-none font-bold text-on-go ring-2 ring-ok-bg">{i + 1}</b>
              </span>
              <span className="text-[0.8125rem] leading-tight font-semibold text-ink md:text-small">{c.name}</span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-center text-[0.9375rem] font-medium text-ink-2">Gemini Nano in Chrome · Apple’s on-device model on iPhone</p>
      </div>
      <Note icon={Smartphone} line="Reading, deciding and speaking happen here." q="In one breath?">
        The picture is read on the device, personal details are covered, an on-device model fills a fixed form, plain code compares it with a sourced price
        book, and the answer is spoken.
      </Note>
    </div>
  );
}

// ---------- before anything leaves the device: eight steps ----------

type Tech = ['Web' | 'iPhone' | 'Both', string];
type PipeStep = { icon: LucideIcon; title: string; line: string; data?: string; how: string; tech?: Tech[]; shown?: boolean };

const PIPE: PipeStep[] = [
  {
    icon: Camera,
    title: 'Capture',
    line: 'The camera opens only when you press it.',
    data: 'The photo, or typed or spoken words.',
    how: 'The camera opens only when you press it. The picture stays in memory until you keep a check.',
    tech: [
      ['Web', 'getUserMedia'],
      ['iPhone', 'UIImagePickerController'],
    ],
  },
  {
    icon: ScanText,
    title: 'Read the words',
    line: 'Read on the device.',
    data: 'The text on the paper, with its position.',
    how: 'Read on the device. On the web, Chrome’s Gemini Nano reads the photo itself.',
    tech: [
      ['iPhone', 'Apple Vision text recognition'],
      ['Web', 'Gemini Nano, multimodal Prompt API'],
    ],
  },
  {
    icon: EyeOff,
    title: 'Cover personal details',
    line: 'Tokens like [phone] in the text. Black bars on the picture.',
    data: 'Names, phones, emails, street addresses, plates, VINs, account and card numbers, SSNs.',
    how: 'Pattern rules plus Apple’s on-device name tagger replace them with tokens like [phone] and draw black bars on the picture. The copy kept in My checks is the covered one.',
    tech: [
      ['iPhone', 'On-device regex rules + NaturalLanguage name tagger'],
      ['Web', 'core/pii.ts rules over words found on the device (tesseract.js), black bars before a cloud reading; masking for lookups, mail, requests'],
    ],
    shown: true,
  },
  {
    icon: FileText,
    title: 'Fill a fixed form',
    line: 'The model may only fill this form.',
    data: 'Kind (quote, bill or problem), each line’s label and amount, the payee, the last 4 digits of the account, and three warning flags: urgent, account changed, words aimed at an AI.',
    how: 'The on-device model may only fill this form. It never writes prices or free text answers.',
    tech: [
      ['Both', 'Firebase AI Logic hybrid inference with structured output'],
      ['iPhone', 'Apple Foundation Models guided generation'],
      ['Web', 'Chrome Prompt API with a JSON schema'],
    ],
  },
  {
    icon: Search,
    title: 'Find candidates in the knowledge pack',
    line: 'At most 5 pack items per line, by plain code.',
    how: 'At most 5 pack items per line, found by plain code on the device.',
    tech: [
      ['Web', 'Layered pack: catalog → root with a Bloom filter per shard → MiniSearch BM25 shard index → content-hashed data blocks, cached and hash-checked'],
      ['iPhone', 'Installed pack sections with an IDF-weighted matcher, synonyms and a stemmer'],
    ],
  },
  {
    icon: ListChecks,
    title: 'Choose',
    line: 'The model marks which offered items are the same job.',
    how: 'The model marks which offered items are the same job: true or false per option. It cannot name anything it was not offered. An unknown ref is rejected.',
  },
  {
    icon: Scale,
    title: 'Decide in plain code',
    line: 'Price against the sourced range. Bill rules.',
    how: 'Price against the sourced low and high range (“$146 above the usual top”). Bill rules: account changed against the payee you remembered, urgency phrases (Remote Config can add more), words aimed at an AI. Text on the paper can add a warning, never remove one.',
  },
  {
    icon: Volume2,
    title: 'Answer and remember',
    line: 'Spoken and on screen. Kept on this device.',
    how: 'Spoken and on screen, with next-question buttons. Remembered payees and your checks stay on this device.',
    tech: [
      ['iPhone', 'SFSpeechRecognizer, on-device'],
      ['Web', 'Chrome speech recognition, processLocally'],
      ['Both', 'Speech synthesis'],
      ['iPhone', 'Files with data protection'],
      ['Web', 'Browser storage'],
    ],
  },
];

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1 md:grid-cols-[3.5rem_minmax(0,1fr)]">
      <dt className="text-[0.9375rem] leading-[1.6] font-bold text-go">{label}</dt>
      <dd className="text-small text-ink-2">{children}</dd>
    </div>
  );
}

function PipeRow({ n, s, last }: { n: number; s: PipeStep; last: boolean }) {
  const [open, setOpen] = useState(n === 3);
  const id = useId();
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 lg:grid-cols-[2.75rem_minmax(0,1fr)] lg:gap-x-5">
      <div className="flex flex-col items-center">
        <span className="mt-[0.6rem] grid size-10 flex-none place-items-center rounded-full bg-go text-small font-bold text-on-go tabular-nums lg:size-11">{n}</span>
        {!last && <span className="mt-2 w-[2px] flex-1 rounded-full bg-fill-2" aria-hidden="true" />}
      </div>
      <div className={`card mb-3 transition-colors duration-300 ${open ? 'border-go' : ''}`}>
        <button
          type="button"
          className="flex min-h-16 w-full items-center gap-3 rounded-card border-0 bg-transparent px-4 py-3 text-left text-ink lg:px-5"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <span className="max-md:hidden">
            <Dot icon={s.icon} small />
          </span>
          <span className="min-w-0 flex-1 lg:flex lg:items-baseline lg:gap-4">
            <b className="block text-[1.15rem] leading-[1.25] font-bold tracking-[-0.02em] lg:flex-none">{s.title}</b>
            <span className="block text-small text-ink-2">{s.line}</span>
          </span>
          <Sign open={open} />
        </button>
        <Panel id={id} open={open}>
          <dl className="grid gap-3 px-4 pt-1 pb-5 lg:pr-5 lg:pl-[4.25rem]">
            {s.data && <Row label="Data">{s.data}</Row>}
            <Row label="How">{s.how}</Row>
            {s.tech && (
              <Row label="Tech">
                <ul className="flex flex-wrap gap-2">
                  {s.tech.map(([where, what]) => (
                    <li key={where + what} className="inline-flex min-h-9 items-baseline gap-2 rounded-chip bg-card-2 px-3 py-[0.4rem] text-[0.9375rem] leading-[1.35] font-medium text-ink">
                      <b className="flex-none font-bold text-go">{where}</b>
                      <span className="min-w-0">{what}</span>
                    </li>
                  ))}
                </ul>
              </Row>
            )}
            {s.shown && (
              <Fold q="Shown before you agree" className="md:ml-[4.5rem]">
                The exact text that would be sent.
              </Fold>
            )}
          </dl>
        </Panel>
      </div>
    </li>
  );
}

// ---------- what can cross to the cloud ----------

/** The device keeps its lock; the way to the cloud has a gate that opens on a yes. */
function SplitPicture({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 190" className={className} role="img" aria-label="A locked phone on the left. A dotted line leaves it, passes a gate marked with a tick, and reaches a cloud on the right.">
      <rect x="0" y="0" width="250" height="190" rx="26" fill="var(--ok-bg)" />
      <rect x="82" y="22" width="86" height="146" rx="16" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="112" y="31" width="26" height="5" rx="2.5" fill="var(--fill-2)" />
      <rect x="96" y="52" width="46" height="7" rx="2" fill="var(--go)" />
      <rect x="96" y="65" width="34" height="7" rx="2" fill="var(--go)" />
      <rect x="96" y="82" width="58" height="5" rx="2.5" fill="var(--fill-2)" />
      <rect x="96" y="93" width="48" height="5" rx="2.5" fill="var(--fill-2)" />
      <circle cx="125" cy="132" r="21" fill="var(--go)" />
      <Lock x={114} y={121} width={22} height={22} color="var(--on-go)" strokeWidth={2.4} />
      <path d="M176 95H296" fill="none" stroke="var(--net)" strokeWidth="3" strokeLinecap="round" strokeDasharray="1 9" className="motion-safe:animate-dash" />
      <path d="M356 95H410m-9 -8l9 8l-9 8" fill="none" stroke="var(--net)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M326 46V144" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="326" cy="95" r="24" fill="var(--bg)" stroke="var(--go)" strokeWidth="3" />
      <Check x={313} y={82} width={26} height={26} color="var(--go)" strokeWidth={3} />
      <Cloud x={424} y={37} width={116} height={116} color="var(--net)" strokeWidth={1.3} fill="var(--net-bg)" />
    </svg>
  );
}

function Cross({ icon, title, line, code, down = false, children }: { icon: LucideIcon; title: string; line: string; code: string; down?: boolean; children?: ReactNode }) {
  return (
    <div className="card flex min-w-0 flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <Dot icon={icon} cloud />
        <span className={pill}>
          {down ? <ArrowDown className="size-4 text-go" strokeWidth={2.4} aria-hidden="true" /> : <Lock className="size-4 text-net" strokeWidth={2.4} aria-hidden="true" />}
          {down ? 'Downloads only' : 'Only after a yes'}
        </span>
      </div>
      <h3 className="mt-4 text-title font-bold tracking-[-0.02em]">{title}</h3>
      <p className="mt-1 text-small text-ink-2">{line}</p>
      <pre className="mt-4 mb-auto overflow-x-auto rounded-chip bg-card-2 px-4 py-3 font-mono text-[0.78rem] leading-[1.55] whitespace-pre text-ink md:text-[0.875rem]">{code}</pre>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ---------- sync without sharing you ----------

/** The loop: packs, prices and settings come down to every device; one masked line goes up through the gate. */
function LoopPicture({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 560 220" className={className} role="img" aria-label="A loop between a phone and a cloud. One arrow goes up from the phone through a locked gate to the cloud. One arrow comes back down from the cloud to the phone.">
      <rect x="0" y="35" width="150" height="150" rx="26" fill="var(--ok-bg)" />
      <rect x="45" y="55" width="60" height="110" rx="13" fill="var(--card)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="57" y="78" width="30" height="6" rx="2" fill="var(--go)" />
      <rect x="57" y="90" width="22" height="6" rx="2" fill="var(--go)" />
      <rect x="57" y="106" width="36" height="5" rx="2.5" fill="var(--fill-2)" />
      <rect x="57" y="117" width="30" height="5" rx="2.5" fill="var(--fill-2)" />
      <rect x="410" y="35" width="150" height="150" rx="26" fill="var(--net-bg)" />
      <Cloud x={441} y={66} width={88} height={88} color="var(--net)" strokeWidth={1.5} fill="var(--card)" />
      <g fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M160 78C215 14 345 14 400 78" stroke="var(--net)" strokeDasharray="1 9" className="motion-safe:animate-dash" />
        <path d="M388 76l12 2l1 -12" stroke="var(--net)" />
        <path d="M400 142C345 206 215 206 160 142" stroke="var(--go)" strokeDasharray="1 9" className="motion-safe:animate-dash" />
        <path d="M172 144l-12 -2l-1 12" stroke="var(--go)" />
      </g>
      <circle cx="280" cy="30" r="22" fill="var(--bg)" stroke="var(--net)" strokeWidth="3" />
      <Lock x={269} y={19} width={22} height={22} color="var(--net)" strokeWidth={2.4} />
      <circle cx="280" cy="190" r="22" fill="var(--bg)" stroke="var(--go)" strokeWidth="3" />
      <ArrowDown x={269} y={179} width={22} height={22} color="var(--go)" strokeWidth={2.6} />
    </svg>
  );
}

function SyncCard({ icon, title, items, q, tone, children }: { icon: LucideIcon; title: string; items: string[]; q: string; tone: 'down' | 'up' | 'stay'; children: ReactNode }) {
  const box = tone === 'down' ? 'bg-ok-bg' : tone === 'up' ? 'bg-net-bg' : 'bg-card-2';
  const ink = tone === 'up' ? 'text-net' : tone === 'down' ? 'text-go' : 'text-ink';
  const Bullet = tone === 'stay' ? X : tone === 'up' ? ArrowUp : ArrowDown;
  const Icon = icon;
  return (
    <div className={`flex flex-col rounded-card p-5 ${box}`}>
      <h3 className={`flex items-center gap-2 text-title font-bold tracking-[-0.02em] ${ink}`}>
        <Icon className="size-[1.3rem] flex-none" strokeWidth={2.2} aria-hidden="true" />
        {title}
      </h3>
      <ul className="mt-4 mb-auto grid gap-2 text-small font-semibold text-ink">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2">
            <Bullet className={`mt-[0.2rem] size-[1.05rem] flex-none ${ink}`} strokeWidth={2.6} aria-hidden="true" />
            {it}
          </li>
        ))}
      </ul>
      <Fold q={q} className="mt-5 !bg-card">
        {children}
      </Fold>
    </div>
  );
}

// ---------- why hybrid is hard ----------

const HARD: Array<{ icon: LucideIcon; hard: string; does: string }> = [
  { icon: Cloud, hard: 'Cloud AI sees your bill', does: 'Personal details are covered on the device before any model sees them.' },
  { icon: Scale, hard: 'The model makes up a price', does: 'The model can only point at sourced items. Plain code sets every number.' },
  { icon: TriangleAlert, hard: 'Text on a paper can trick the AI', does: 'Words aimed at an AI raise a warning. Nothing on the paper can clear one.' },
  { icon: WifiOff, hard: 'Offline means broken', does: 'Packs are cached and hash-checked. It answers in airplane mode.' },
  { icon: Globe, hard: 'You can’t tell where it ran', does: 'Every answer says “On this device” or “Used the internet”, and shows exactly what was sent.' },
  { icon: RefreshCw, hard: 'Stale knowledge', does: 'Packs update by changed files. New prices come back sourced.' },
];

// ---------- tiles that open ----------

/** An icon and a name; a press opens one line about it. */
function Opens({ icon, name, children }: { icon: LucideIcon; name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={`card transition-colors duration-300 ${open ? 'border-go' : ''}`}>
      <button
        type="button"
        className="flex w-full flex-col items-start gap-3 rounded-card border-0 bg-transparent px-4 pt-4 pb-3 text-left text-ink"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className="flex w-full items-start justify-between">
          <Dot icon={icon} />
          <Sign open={open} />
        </span>
        <span className="text-[1.15rem] leading-[1.2] font-bold tracking-[-0.02em]">{name}</span>
      </button>
      <Panel id={id} open={open}>
        <p className="px-4 pb-4 text-small text-ink-2">{children}</p>
      </Panel>
    </div>
  );
}

const Out = ({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) => (
  <a href={href} target="_blank" rel="noreferrer" className={className}>
    {children}
  </a>
);

const PROOF: Array<{ big: string; small: string; href: string }> = [
  { big: '50 of 50', small: 'fictional quotes and bills judged right in our evaluation, 0 personal details leaked', href: EVAL },
  { big: '173', small: 'sourced prices, and 80 repair guides', href: REPO },
  { big: '≈20 KB', small: 'loaded per quote', href: CLAIMS },
  { big: 'Offline', small: 'works in airplane mode on iPhone', href: CLAIMS },
  { big: 'Apache-2.0', small: 'open source', href: LICENSE },
];

/** The five made-up papers in docs/test-sheets, served at /test-sheets: what each one is and what WeKnow should say. */
const SHEETS: Array<{ file: string; name: string; expect: string; warn?: boolean }> = [
  { file: 'bill-2-electric-normal', name: 'An electricity bill', expect: 'Check first: a company you never paid. Remember it, and next time it is “the usual one”.' },
  { file: 'bill-3-electric-new-account-buried', name: 'The same bill, one sentence changed', expect: 'Don’t pay yet: a new account in the small print, and a 24-hour rush.', warn: true },
  { file: 'bill-4-water-ai-note', name: 'A water bill that talks to AI', expect: 'Don’t pay yet: hidden words that tell a reader it is safe.', warn: true },
  { file: 'bill-7-scam-numbers-dont-add-up', name: 'A “processing fee” invoice', expect: 'Don’t pay yet: the numbers don’t add up, and an online check finds a known scam.', warn: true },
  { file: 'quote-1-auto-one-high', name: 'A car repair estimate', expect: 'Line 4, a $385 belt, is above the usual range.' },
];

const quiet = 'inline-flex min-h-11 items-center font-semibold text-ink underline decoration-hair decoration-2 underline-offset-4 hover:decoration-go';

export default function How() {
  const p = usePrefs();
  const dark = p.theme === 'dark' || (p.theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
  const open = p.started ? 'Open WeKnow' : 'Try it';
  const look = dark ? 'Light screen' : 'Dark screen';
  return (
    <div className="min-h-dvh overflow-x-clip bg-bg">
      <header className="sticky top-0 z-10 bg-bg/90 backdrop-blur">
        <div className={`${wrapper} flex h-16 items-center gap-2`}>
          <Lockup className="text-[1.25rem]" />
          <div className="ml-auto flex items-center gap-1">
            <button type="button" className="bar-btn" aria-label={look} title={look} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}>
              {dark ? <Sun /> : <Moon />}
            </button>
            <Link to="/app" className="btn btn-yes btn-sm">
              Open WeKnow
            </Link>
          </div>
        </div>
      </header>

      <Story open={open} />

      <main className={`${wrapper} pb-20`}>
        <p className="mt-16 -mb-16 text-small font-semibold text-ink-2 lg:mt-20 lg:-mb-20">The details</p>
        <Section id="how" title="How it works" lead="The device does the work. The cloud helps only after a yes.">
          <Architecture />
        </Section>

        <Section title="Before anything leaves your device" lead="Eight steps. Press one to see the data, the how and the tech.">
          <ol>
            {PIPE.map((s, i) => (
              <PipeRow key={s.title} n={i + 1} s={s} last={i === PIPE.length - 1} />
            ))}
          </ol>
        </Section>

        <Section title="What can cross to the cloud — exactly">
          <SplitPicture className="mx-auto mb-8 block w-full max-w-[36rem] lg:mb-10" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Cross
              icon={ScanText}
              title="Reading, on a device with no local model"
              line="iPhone never sends the picture. The consent screen says what is sent, before sending."
              code={'iPhone  covered text rows only\nWeb     the covered picture + your question\n\nweknow-read-photo-v1\nweknow-choose-v1\n+ an App Check token'}
            >
              <Fold q="Why server prompt templates?">
                It goes through Firebase AI Logic server prompt templates. The prompts are kept on Firebase, so nobody can read or change them from the app.
              </Fold>
            </Cross>
            <Cross icon={Search} title="A price lookup" line="For a line the book does not know." code={'{\n  "item": "Install outdoor hose bib",\n  "region": "US"\n}'}>
              <Fold q="What happens to it?">
                Gemini with Google Search grounding looks it up. A price is used only with https sources. The same plain code judges it. It is kept on the
                device.
              </Fold>
            </Cross>
            <Cross
              icon={Search}
              title="A check on a suspicious bill"
              line="A company you never paid, and something on the bill already wrong."
              code={'Who asks to be paid: Palisade Sovereign Reserve Trust\nCharges: Government processing fee\n  (Federal Release Stamp); …'}
            >
              <Fold q="What happens to it?">
                Plain code builds it: the company and the names of the charges, no amounts, numbers or names. Gemini searches Google and says whether charges
                like these are a known scam. Used only with web sources. It can make the warning stronger, never weaker.
              </Fold>
            </Cross>
            <Cross icon={Plus} title="“Please add this item”" line="A request to Firestore. The rules refuse anything else." code={'{ item, region }'} />
            <Cross
              down
              icon={Download}
              title="Downloads"
              line="Nothing about you."
              code={'Pack files  ←  Hosting\nSettings    ←  Remote Config'}
            />
          </div>
        </Section>

        <Section title="Sync without sharing you" lead="Every device gets better. Nobody’s personal data moves.">
          <LoopPicture className="mx-auto mb-8 block w-full max-w-[36rem] lg:mb-10" />
          <div className="grid gap-4 lg:grid-cols-3">
            <SyncCard tone="down" icon={Download} title="Down to every device" items={['Knowledge pack updates', 'Reviewed learned prices', 'Settings']} q="From where?">
              <p>Pack updates come from Hosting. Only the files whose content hash changed are downloaded.</p>
              <p className="mt-2">Reviewed learned prices come from one Firestore document per pack, read-only for clients.</p>
              <p className="mt-2">Settings come from Remote Config: the cloud model, the pack version, the warning phrases, the lookup switch.</p>
            </SyncCard>
            <SyncCard tone="up" icon={Lock} title="Up, only after a yes" items={['A masked line name + region', 'A covered question: no names, no numbers']} q="For what?">
              A price lookup, a “please add this item” request, or a check the device cannot do by itself (is this company real?). Firestore rules make requests write-only and accept only the line-and-region shape.
            </SyncCard>
            <SyncCard tone="stay" icon={Smartphone} title="Never synced" items={['Pictures', 'Names and numbers', 'Your checks', 'The payees you remembered']} q="Where do they stay?">
              On the device: iPhone files with data protection, browser storage on the web.
            </SyncCard>
          </div>
          <p className="mt-6 flex items-start gap-4 rounded-card bg-go p-5 text-[1.2rem] leading-[1.35] font-semibold tracking-[-0.01em] text-on-go lg:items-center lg:p-7 lg:text-[1.45rem]">
            <RefreshCw className="mt-1 size-7 flex-none lg:mt-0 lg:size-8" strokeWidth={2.2} aria-hidden="true" />
            An unknown line on one person’s quote becomes a sourced, reviewed price for everyone, without anyone’s personal data ever moving.
          </p>
        </Section>

        <Section title="Why hybrid is hard — and what WeKnow does">
          <div className="mb-3 hidden grid-cols-[minmax(0,5fr)_2rem_minmax(0,7fr)] gap-x-4 px-5 text-[0.9375rem] font-semibold text-ink-2 lg:grid">
            <span>The hard part</span>
            <span />
            <span className="text-go">What WeKnow does</span>
          </div>
          <ul className="grid gap-3">
            {HARD.map((h) => (
              <li key={h.hard} className="card grid items-center gap-x-4 gap-y-3 p-4 lg:grid-cols-[minmax(0,5fr)_2rem_minmax(0,7fr)] lg:px-5">
                <span className="flex items-center gap-3 text-small font-semibold text-ink-2">
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-card-2 text-ink-2" aria-hidden="true">
                    <h.icon size={18} strokeWidth={2.2} />
                  </span>
                  {h.hard}
                </span>
                <ArrowRight className="hidden size-5 text-line lg:block" aria-hidden="true" />
                <span className="flex items-center gap-3 text-small font-semibold text-ink">
                  <span className="grid size-9 flex-none place-items-center rounded-full bg-go text-on-go" aria-hidden="true">
                    <Check size={18} strokeWidth={3} />
                  </span>
                  {h.does}
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mt-10 text-title font-bold tracking-[-0.02em]">Three rules, backed by tests in the repo</h3>
          <ul className="mt-4 grid gap-4 lg:grid-cols-3">
            {[
              { icon: ShieldCheck, main: 'Personal details never reach a cloud payload.', note: 'Property tests.' },
              { icon: ListChecks, main: 'The model can only cite items it was offered.' },
              { icon: TriangleAlert, main: 'Text on a paper can raise a warning, but never clear one.' },
            ].map((r) => (
              <li key={r.main} className="flex items-start gap-3 rounded-card bg-ok-bg p-5">
                <Dot icon={r.icon} small />
                <p className="pt-[0.3rem] text-small font-semibold text-ink">
                  {r.main}
                  {r.note && <span className="block font-medium text-ink-2">{r.note}</span>}
                </p>
              </li>
            ))}
          </ul>
          <Out href={CLAIMS} className={`${quiet} mt-4 gap-1`}>
            Claims and evidence
            <ArrowRight className="size-[1.1rem]" aria-hidden="true" />
          </Out>
        </Section>

        <Section title="On your device" lead="Nine things it does by itself. Press one.">
          <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3 lg:gap-4">
            <Opens icon={BookOpen} name="Knowledge packs">
              See each section and its size. Download or remove it. Works offline.
            </Opens>
            <Opens icon={Folder} name="My checks">
              Every answer kept, with a covered picture.
            </Opens>
            <Opens icon={NotebookText} name="What WeKnow remembers">
              Payees and their account endings. Delete any.
            </Opens>
            <Opens icon={Mic} name="Ask in words or voice">
              No photo needed.
            </Opens>
            <Opens icon={Wrench} name="Step-by-step repairs">
              One step at a time. Say next, again or stop.
            </Opens>
            <Opens icon={MessageSquare} name="Next questions to tap">
              Under each answer, as buttons.
            </Opens>
            <Opens icon={Languages} name="Explain in my language">
              On the device when it can. In the cloud otherwise.
            </Opens>
            <Opens icon={ZoomIn} name="Picture viewer with zoom">
              Open the picture large and look closely.
            </Opens>
            <Opens icon={Plane} name="Works in airplane mode">
              The reading and the packs are on the device.
            </Opens>
          </div>
        </Section>

        <Section title="Built on Firebase" lead="Six services. Press one.">
          <div className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3 lg:gap-4">
            <Opens icon={Cpu} name="AI Logic">
              Hybrid on-device and cloud inference, structured output, server prompt templates, Google Search grounding.
            </Opens>
            <Opens icon={ShieldCheck} name="App Check">
              Only the real app can call the model: reCAPTCHA Enterprise on the web, App Attest on iPhone.
            </Opens>
            <Opens icon={UserRound} name="Authentication">
              Anonymous by default. Optional Google sign-in on the web.
            </Opens>
            <Opens icon={Database} name="Cloud Firestore">
              Deny-by-default rules that accept only a masked item name and a region.
            </Opens>
            <Opens icon={SlidersHorizontal} name="Remote Config">
              The cloud model, the knowledge pack version, the warning phrases and the online lookup switch change without a new release.
            </Opens>
            <Opens icon={Server} name="Hosting">
              The app and the layered knowledge packs: a small catalog, then per-category sections, then content-hashed data blocks. Every price and guide has a
              source.
            </Opens>
          </div>
        </Section>

        <Section id="try" title="Try it with our test papers" lead="Five made-up papers. Drag a PDF into WeKnow, paste the picture, or print one and take a photo.">
          <ul className="grid gap-3 lg:grid-cols-2">
            {SHEETS.map((x) => (
              <li key={x.file} className="card flex items-start gap-4 p-4 lg:p-5">
                <Dot icon={x.warn ? TriangleAlert : FileText} small />
                <div className="min-w-0 flex-1">
                  <p className="text-[1.05rem] font-bold tracking-[-0.01em] text-ink">{x.name}</p>
                  <p className="mt-1 text-small text-ink-2">{x.expect}</p>
                  <p className="mt-2 flex flex-wrap gap-x-5">
                    <a href={`/test-sheets/${x.file}.pdf`} download className={`${quiet} gap-1`}>
                      <Download className="size-[1.1rem]" aria-hidden="true" />
                      PDF
                    </a>
                    <a href={`/test-sheets/${x.file}.png`} download className={`${quiet} gap-1`}>
                      <Download className="size-[1.1rem]" aria-hidden="true" />
                      Picture
                    </a>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Link to="/app" className="btn btn-yes mt-6 min-w-[9rem]">
            {open}
            <ArrowRight />
          </Link>
        </Section>

        {/* the proof */}
        <Reveal>
          <ul className="mt-24 grid grid-cols-2 gap-x-6 gap-y-8 rounded-card bg-card-2 p-6 lg:mt-28 lg:grid-cols-5 lg:p-8" aria-label="Proof">
            {PROOF.map((x, i) => (
              <li key={x.big} className={i === 0 ? 'max-lg:col-span-2' : ''}>
                <Out href={x.href} className="group block text-ink no-underline">
                  <b className="block text-[1.7rem] leading-[1.1] font-bold tracking-[-0.035em] text-go lg:text-[1.9rem]">{x.big}</b>
                  <span className="mt-2 block text-[0.9375rem] leading-[1.35] font-medium text-ink-2 underline decoration-transparent decoration-2 underline-offset-4 group-hover:decoration-go">
                    {x.small}
                  </span>
                </Out>
              </li>
            ))}
          </ul>
        </Reveal>

        <Section title="Tech stack" lead="Open source, Apache-2.0.">
          <dl className="grid gap-4 lg:grid-cols-2">
            {[
              { name: 'Web', icon: Globe, items: ['React', 'Vite', 'TypeScript', 'Tailwind', 'Radix', 'Firebase JS SDK', 'MiniSearch'] },
              { name: 'iPhone', icon: Smartphone, items: ['SwiftUI', 'Apple Vision', 'Foundation Models', 'Speech (on-device recognition)', 'Firebase iOS SDK'] },
            ].map((s) => (
              <div key={s.name} className="card p-5">
                <dt className="flex items-center gap-3 text-title font-bold tracking-[-0.02em]">
                  <Dot icon={s.icon} small />
                  {s.name}
                </dt>
                <dd className="mt-4 flex flex-wrap gap-2">
                  {s.items.map((it) => (
                    <span key={it} className={pill}>
                      {it}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <footer className="mt-24 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-hair pt-6 lg:mt-28">
          <Lockup className="mr-auto text-[1.1rem]" />
          <Out href={REPO} className={quiet}>
            Code
          </Out>
          <Out href={REPORT} className={quiet}>
            Technical report
          </Out>
          <Link to="/help" className={quiet}>
            {t('menu.help')}
          </Link>
          <Link to="/app" className="btn btn-yes btn-sm">
            {open}
          </Link>
        </footer>
      </main>
    </div>
  );
}
