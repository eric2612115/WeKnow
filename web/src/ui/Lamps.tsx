// The two lamps: this device, the internet. While WeKnow works exactly one is lit; `lit` null shows both off.

import { DeviceIcon, I } from './icons';
import { deviceWord } from '../engine/device';

export function Lamps({ lit, pulse = false }: { lit: 'device' | 'net' | null; pulse?: boolean }) {
  const lamp = (on: boolean, color: string, icon: 'device' | 'net') => (
    <span
      className={`grid size-[1.875rem] place-items-center rounded-full [&>svg]:size-[1rem] ${on ? `${color} text-white ${pulse ? 'lamp-on' : ''}` : 'text-ink-2 opacity-45'}`}
    >
      {icon === 'device' ? <DeviceIcon device={deviceWord()} /> : I.net()}
    </span>
  );
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-fill-2 px-2 py-1.5" aria-hidden="true">
      {lamp(lit === 'device', 'bg-go', 'device')}
      {lamp(lit === 'net', 'bg-net', 'net')}
    </span>
  );
}
