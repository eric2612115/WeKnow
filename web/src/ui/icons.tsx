// Icons: lucide-react, plus the few shapes the design draws itself (a device with a dot inside it, the stop sign
// with a bar). Every icon is decorative; the word next to it carries the meaning.

import type { SVGProps } from 'react';
import {
  ArrowRight,
  CalendarPlus,
  Camera,
  CameraOff,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Copy,
  Folder,
  Globe,
  Lamp,
  Mail,
  Menu,
  MessageSquare,
  Mic,
  Moon,
  NotebookText,
  Phone,
  Play,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Square,
  Sun,
  TriangleAlert,
  User,
  WifiOff,
  ImageUp,
  MapPin,
  Languages,
} from 'lucide-react';
import type { Tone, WhereRan } from '../answer/types';

const base = { 'aria-hidden': true, focusable: false, strokeWidth: 2 } as const;

function Svg(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p} />
  );
}

export const PhoneDot = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </Svg>
);
export const ComputerDot = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="11" rx="1.5" />
    <path d="M2 19.5h20" />
    <circle cx="12" cy="10.5" r="1.7" fill="currentColor" stroke="none" />
  </Svg>
);
export const TabletDot = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="4.5" y="2.5" width="15" height="19" rx="2.5" />
    <circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" />
  </Svg>
);
export const StopSign = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" />
    <path d="M7.5 12h9" />
  </Svg>
);
export const StopFace = (p: SVGProps<SVGSVGElement>) => (
  <Svg {...p}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
  </Svg>
);

export function DeviceIcon({ device, ...p }: { device: string } & SVGProps<SVGSVGElement>) {
  if (device === 'phone') return <PhoneDot {...p} />;
  if (device === 'tablet') return <TabletDot {...p} />;
  return <ComputerDot {...p} />;
}

export function ToneIcon({ tone, ...p }: { tone: Tone } & SVGProps<SVGSVGElement>) {
  if (tone === 'ok') return <CircleCheck {...base} {...(p as object)} />;
  if (tone === 'warn') return <TriangleAlert {...base} {...(p as object)} />;
  if (tone === 'stop') return <StopSign {...p} />;
  return null;
}

export function WhereIcon({ w, device }: { w: WhereRan; device: string }) {
  if (w === 'local') return <DeviceIcon device={device} />;
  if (w === 'offline') return <WifiOff {...base} />;
  if (w === 'pending') return <TriangleAlert {...base} />;
  return <Globe {...base} />;
}

export const I = {
  menu: () => <Menu {...base} />,
  mic: () => <Mic {...base} />,
  next: () => <ArrowRight {...base} />,
  again: () => <RotateCcw {...base} />,
  ok: () => <CircleCheck {...base} />,
  check: () => <Check {...base} />,
  warn: () => <TriangleAlert {...base} />,
  say: () => <MessageSquare {...base} />,
  net: () => <Globe {...base} />,
  nonet: () => <WifiOff {...base} />,
  lamp: () => <Lamp {...base} />,
  cam: () => <Camera {...base} />,
  camoff: () => <CameraOff {...base} />,
  folder: () => <Folder {...base} />,
  note: () => <NotebookText {...base} />,
  set: () => <SlidersHorizontal {...base} />,
  help: () => <CircleHelp {...base} />,
  sun: () => <Sun {...base} />,
  moon: () => <Moon {...base} />,
  plus: () => <Plus {...base} />,
  back: () => <ChevronLeft {...base} />,
  chev: () => <ChevronRight {...base} className="chev" strokeWidth={2.4} />,
  user: () => <User {...base} />,
  mail: () => <Mail {...base} />,
  calendar: () => <CalendarPlus {...base} />,
  phone: () => <Phone {...base} />,
  play: () => <Play {...base} />,
  copy: () => <Copy {...base} />,
  stopSquare: () => <Square {...base} />,
  image: () => <ImageUp {...base} />,
  map: () => <MapPin {...base} />,
  lang: () => <Languages {...base} />,
};
