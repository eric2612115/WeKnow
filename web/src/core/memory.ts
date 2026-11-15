// Household memory: what WeKnow remembers about this home, kept only on this device.
// Pure logic here (storage is injected), so it can be tested and so nothing in it can reach the network.
// Every record is visible, editable and deletable by the person; nothing is remembered without a yes.

export type MemoryKind = 'job' | 'appliance' | 'payee' | 'preference';

export interface JobMemory {
  kind: 'job';
  id: string;
  shop: string; // as printed, e.g. "Summit Plumbing"
  ref: string | null; // pack ref of the job, when known
  label: string; // the line as printed
  amount: number;
  date: string; // YYYY-MM-DD
}
export interface ApplianceMemory {
  kind: 'appliance';
  id: string;
  what: string; // e.g. "washer"
  make: string | null;
  model: string | null;
  note: string | null; // e.g. "shakes on spin"
  date: string;
}
export interface PayeeMemory {
  kind: 'payee';
  id: string;
  name: string;
  payTo: string; // last four digits only
  date: string;
}
export interface PreferenceMemory {
  kind: 'preference';
  id: string;
  key: 'voiceRate' | 'textSize' | 'language';
  value: string;
  date: string;
}
export type Memory = JobMemory | ApplianceMemory | PayeeMemory | PreferenceMemory;

export interface MemoryStorage {
  all(): Promise<Memory[]>;
  put(m: Memory): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Validate and trim a record before it is stored: last four digits only, short strings, no free-form blobs. */
export function sanitize(m: Memory): Memory {
  const cut = (s: string | null, n: number) => (s === null ? null : s.slice(0, n));
  switch (m.kind) {
    case 'job':
      if (!Number.isFinite(m.amount) || m.amount < 0) throw new Error('bad amount');
      return { ...m, shop: m.shop.slice(0, 80), label: m.label.slice(0, 120) };
    case 'appliance':
      return { ...m, what: m.what.slice(0, 40), make: cut(m.make, 40), model: cut(m.model, 40), note: cut(m.note, 120) };
    case 'payee': {
      const digits = m.payTo.replace(/\D/g, '');
      if (digits.length < 4) throw new Error('payee needs the last four digits');
      return { ...m, name: m.name.slice(0, 80), payTo: digits.slice(-4) };
    }
    case 'preference':
      return { ...m, value: m.value.slice(0, 20) };
  }
}

/** Earlier jobs that match a line on a new quote: same pack ref, or same shop and similar label. */
export function earlierJobs(memories: Memory[], line: { ref: string | null; label: string }, shop: string | null): JobMemory[] {
  const jobs = memories.filter((m): m is JobMemory => m.kind === 'job');
  return jobs
    .filter((j) => (line.ref && j.ref === line.ref) || (shop && norm(j.shop) === norm(shop) && norm(j.label) === norm(line.label)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** One short sentence comparing a new price to the last time, or null when there is nothing to say. */
export function compareToLastTime(earlier: JobMemory[], amount: number, shop: string | null): string | null {
  const last = earlier[0];
  if (!last) return null;
  const when = new Date(`${last.date}T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const same = shop && norm(last.shop) === norm(shop) ? 'This shop' : last.shop;
  const diff = amount - last.amount;
  if (Math.abs(diff) < 1) return `${same} charged the same, $${last.amount}, in ${when}.`;
  return `${same} charged $${last.amount} for this in ${when}. Now it is $${amount}, ${diff > 0 ? `$${diff} more` : `$${-diff} less`}.`;
}

export function knownPayees(memories: Memory[]): Array<{ name: string; payTo: string }> {
  return memories.filter((m): m is PayeeMemory => m.kind === 'payee').map(({ name, payTo }) => ({ name, payTo }));
}

/** The few memories worth putting in a small on-device prompt for this question (never the whole store). */
export function relevant(memories: Memory[], text: string, limit = 5): Memory[] {
  const q = new Set(norm(text).split(' ').filter((w) => w.length > 2));
  const score = (m: Memory) => {
    const words = norm(Object.values(m).filter((v) => typeof v === 'string').join(' ')).split(' ');
    return words.reduce((s, w) => s + (q.has(w) ? 1 : 0), 0);
  };
  return memories
    .map((m) => ({ m, s: score(m) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.m);
}

/** In-memory storage for tests and for browsers without IndexedDB. */
export function memoryStorage(): MemoryStorage {
  const map = new Map<string, Memory>();
  return {
    all: async () => [...map.values()],
    put: async (m) => void map.set(m.id, sanitize(m)),
    remove: async (id) => void map.delete(id),
    clear: async () => map.clear(),
  };
}
