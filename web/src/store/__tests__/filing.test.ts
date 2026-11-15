import { describe, expect, it } from 'vitest';
import { dataStore, fileProject, type Check } from '../data';
import { setPrefs } from '../prefs';

const check = (id: string, family: Check['family'], projectId: string): Check => ({
  id,
  projectId,
  family,
  kind: 'Quote',
  title: id,
  tone: 'ok',
  verdict: 'ok',
  date: '2026-11-16T10:00:00Z',
  question: '',
  lines: [],
  receipt: { w: 'cloud', n: 0, stayed: [], sent: [], sources: [], tech: [] },
});

describe('where a new check is kept', () => {
  const projects = [
    { id: 'home', name: 'My home', created: '2026-11-01' },
    { id: 'car', name: 'The car', created: '2026-11-16' },
  ];

  it('next to its own kind first', () => {
    dataStore.set({ ready: true, projects, memory: [], checks: [check('q', 'quote', 'car'), check('b', 'bill', 'home')] });
    expect(fileProject('quote')).toBe('car');
    expect(fileProject('bill')).toBe('home');
  });

  it('a bill after a car quote is not filed in The car', () => {
    dataStore.set({ ready: true, projects, memory: [], checks: [check('q', 'quote', 'car')] });
    setPrefs({ lastProject: 'car' });
    expect(fileProject('bill')).toBe('home');
    expect(fileProject('problem')).toBe('home');
  });
});
