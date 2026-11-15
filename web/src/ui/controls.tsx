// Small shared pieces: the wordmark, groups of choices (Radix ToggleGroup), the switch (Radix Switch), verdicts,
// verdict chips, cards and the "Coming later" pill.

import { Switch as RSwitch, ToggleGroup } from 'radix-ui';
import type { ReactNode } from 'react';
import type { Tone } from '../answer/types';
import { ToneIcon } from './icons';
import { t } from '../strings';

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-bold tracking-[-0.025em] ${className}`}>
      <span className="mark-dot" aria-hidden="true" />
      WeKnow
    </span>
  );
}

export function Seg<T extends string>({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: ReactNode; aria?: string; disabled?: boolean; className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={`seg ${className}`}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} aria-label={o.aria} disabled={o.disabled} className={o.className}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex min-h-11 flex-none items-center gap-2.5 text-small font-semibold text-ink-2">
      <span aria-hidden="true">{checked ? 'On' : 'Off'}</span>
      <RSwitch.Root className="sw" checked={checked} onCheckedChange={onChange} aria-label={label}>
        <RSwitch.Thumb />
      </RSwitch.Root>
    </label>
  );
}

export function VerdictBand({ tone, text, icon, className = '' }: { tone: Tone; text: string; icon?: ReactNode; className?: string }) {
  return (
    <h2 className={`verdict ${className}`} data-tone={tone}>
      {icon ?? <ToneIcon tone={tone} />}
      <span>{text}</span>
    </h2>
  );
}

export function VerdictChip({ tone, text }: { tone: Tone; text: string }) {
  return (
    <span className="vchip" data-tone={tone}>
      <ToneIcon tone={tone} />
      {text}
    </span>
  );
}

export function Card({ children, className = '', id, as: As = 'section' }: { children: ReactNode; className?: string; id?: string; as?: 'section' | 'div' }) {
  return (
    <As id={id} className={`card px-[1.15rem] py-[1.1rem] ${className}`}>
      {children}
    </As>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 text-title font-bold tracking-[-0.02em]">{children}</h2>;
}

export function Soon() {
  return (
    <span className="inline-flex min-h-8 flex-none items-center rounded-full bg-card-2 px-3 text-small font-semibold text-ink-2">{t('soon')}</span>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-1 mb-4 flex items-center justify-between gap-4">
      <h1 className="text-page font-bold tracking-[-0.035em] lg:text-[2.3rem]">{children}</h1>
      {action}
    </div>
  );
}
