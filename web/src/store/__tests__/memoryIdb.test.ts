import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { idbMemoryStorage } from '../memoryIdb';
import { notesOf } from '../data';
import type { Memory } from '../../core/memory';

describe('household memory in IndexedDB (this device only)', () => {
  it('stores, lists, removes and clears; a payee keeps only the last four digits', async () => {
    const s = idbMemoryStorage();
    await s.clear();
    await s.put({ kind: 'payee', id: 'p1', name: 'Riverbend Electric Co-op', payTo: '5530-221-87-4821', date: '2026-11-16' });
    await s.put({ kind: 'job', id: 'j1', shop: 'Sunrise Auto Care', ref: 'brake-pads', label: 'Rear brake pads', amount: 540, date: '2026-11-16' });
    const all = await s.all();
    expect(all).toHaveLength(2);
    expect(all.find((m) => m.kind === 'payee')).toMatchObject({ payTo: '4821' });
    await s.remove('j1');
    expect((await s.all()).map((m) => m.id)).toEqual(['p1']);
    await s.clear();
    expect(await s.all()).toEqual([]);
  });

  it('refuses a payee without four digits, so nothing half-known is remembered', async () => {
    const s = idbMemoryStorage();
    await expect(s.put({ kind: 'payee', id: 'p2', name: 'X', payTo: '12', date: '2026-11-16' })).rejects.toThrow();
  });

  it('shows one shop visit as one note, largest amounts first', () => {
    const job = (id: string, label: string, amount: number, date = '2026-11-16'): Memory => ({ kind: 'job', id, shop: 'Sunrise Auto Care', ref: null, label, amount, date });
    const notes = notesOf([job('a', 'Cabin air filter', 95), job('b', 'Rear brake pads', 540), job('c', 'Oil change', 62, '2026-03-14')]);
    expect(notes).toHaveLength(2);
    expect(notes[0].map((m) => m.id)).toEqual(['b', 'a']);
  });
});
