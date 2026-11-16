// Checks, projects, pictures and household notes: kept in IndexedDB on this device, mirrored in memory so pages
// render at once. Nothing here is sent anywhere; signing in does not copy any of it.

import { useEffect, useState } from 'react';
import { sanitize, type Memory } from '../core/memory';
import type { LineItem, Receipt, Tone } from '../answer/types';
import { t } from '../strings';
import { idbAll, idbAvailable, idbClear, idbDelete, idbGet, idbPut } from './idb';
import { idbMemoryStorage } from './memoryIdb';
import { getPrefs, setPrefs } from './prefs';
import { createStore, useStore } from './store';

export type CheckKind = 'Guide' | 'Quote' | 'Price' | 'Invoice' | 'Bill' | 'Letter' | 'Email';
/** What a check is about, for filing it next to its own kind. */
export type Family = 'quote' | 'bill' | 'problem' | 'email' | 'other';

export interface Check {
  id: string;
  projectId: string;
  kind: CheckKind;
  family: Family;
  title: string;
  tone: Tone;
  verdict: string;
  date: string; // ISO
  question: string;
  lines: string[];
  noteLine?: number; // index of the sentence that came from a note
  items?: LineItem[];
  receipt: Receipt;
  pictureId?: string;
}

export interface Project {
  id: string;
  name: string;
  created: string;
}

interface Picture {
  id: string;
  blob: Blob;
}

export interface DataState {
  ready: boolean;
  checks: Check[]; // newest first
  projects: Project[];
  memory: Memory[];
}

export const dataStore = createStore<DataState>({ ready: false, checks: [], projects: [], memory: [] });
export const useData = () => useStore(dataStore);
const memory = idbMemoryStorage();
const persist = idbAvailable();
const pictures = new Map<string, Blob>(); // used when IndexedDB is missing (tests, private modes)

export const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const byDate = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

let loading: Promise<void> | null = null;
export function loadData(): Promise<void> {
  loading ??= (async () => {
    let checks: Check[] = [];
    let projects: Project[] = [];
    let mem: Memory[] = [];
    if (persist) {
      try {
        [checks, projects, mem] = await Promise.all([idbAll<Check>('checks'), idbAll<Project>('projects'), memory.all()]);
      } catch {
        /* storage blocked: start empty, keep working in memory */
      }
    }
    mem = mem.concat(await migratePayees());
    if (!projects.length) {
      const home: Project = { id: 'home', name: t('project.default'), created: new Date().toISOString() };
      projects = [home];
      if (persist) await idbPut('projects', home).catch(() => undefined);
    }
    projects.sort((a, b) => a.created.localeCompare(b.created));
    dataStore.set({ ready: true, checks: checks.sort(byDate), projects, memory: mem.sort(memSort) });
  })();
  return loading;
}

/** Payees confirmed in the earlier shell (localStorage "weknow.payees.v1") become notes once, then the key goes. */
async function migratePayees(): Promise<Memory[]> {
  const KEY = 'weknow.payees.v1';
  const out: Memory[] = [];
  try {
    const old = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown;
    if (!Array.isArray(old)) return out;
    for (const p of old as Array<{ name?: unknown; payTo?: unknown }>) {
      if (typeof p?.name !== 'string' || typeof p?.payTo !== 'string' || p.payTo.replace(/\D/g, '').length < 4) continue;
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const m = sanitize({ kind: 'payee', id: newId('m'), name: p.name, payTo: p.payTo, date });
      await memory.put(m).catch(() => undefined);
      out.push(m);
    }
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to bring over */
  }
  return out;
}

const memDate = (m: Memory) => m.date;
const memSort = (a: Memory, b: Memory) => memDate(b).localeCompare(memDate(a));

async function write<T extends { id: string }>(store: 'checks' | 'projects', v: T) {
  if (persist) await idbPut(store, v).catch(() => undefined);
}

// ---------- projects ----------

export function projectName(id: string): string {
  return dataStore.get().projects.find((p) => p.id === id)?.name ?? t('checks.title');
}

export async function createProject(name: string): Promise<Project> {
  const p: Project = { id: newId('p'), name: name.trim().slice(0, 40), created: new Date().toISOString() };
  dataStore.set((s) => ({ ...s, projects: [...s.projects, p] }));
  await write('projects', p);
  return p;
}

export async function renameProject(id: string, name: string) {
  const p = dataStore.get().projects.find((x) => x.id === id);
  if (!p) return;
  const next = { ...p, name: name.trim().slice(0, 40) || p.name };
  dataStore.set((s) => ({ ...s, projects: s.projects.map((x) => (x.id === id ? next : x)) }));
  await write('projects', next);
}

// ---------- checks ----------

/** Where a new check goes, without asking: next to its own kind, otherwise the project used last. */
export function fileProject(family: Family): string {
  const s = dataStore.get();
  const exists = (id: string | null | undefined) => !!id && s.projects.some((p) => p.id === id);
  const same = s.checks.find((c) => c.family === family && exists(c.projectId));
  if (same) return same.projectId;
  const last = getPrefs().lastProject;
  // "The car" holds car papers only: a bill or a drain after a car quote goes to the household project instead.
  const carOnly = (id: string) => s.projects.find((p) => p.id === id)?.name === t('project.car');
  if (exists(last) && !carOnly(last!)) return last!;
  return s.projects.find((p) => !carOnly(p.id))?.id ?? s.projects[0]?.id ?? 'home';
}

/** The project with this name, made on first use (for example "The car" for the first car quote). */
export async function projectNamed(name: string): Promise<string> {
  const found = dataStore.get().projects.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return found ? found.id : (await createProject(name)).id;
}

export async function addCheck(c: Omit<Check, 'id' | 'projectId' | 'date' | 'pictureId'>, picture?: Blob, project?: string): Promise<Check> {
  const id = newId('c');
  let pictureId: string | undefined;
  if (picture) {
    pictureId = `pic-${id}`;
    pictures.set(pictureId, picture);
    if (persist) await idbPut<Picture>('pictures', { id: pictureId, blob: picture }).catch(() => undefined);
  }
  const projectId = project ? await projectNamed(project) : fileProject(c.family);
  const check: Check = { ...c, id, projectId, date: new Date().toISOString(), pictureId };
  dataStore.set((s) => ({ ...s, checks: [check, ...s.checks] }));
  setPrefs({ lastProject: check.projectId });
  await write('checks', check);
  return check;
}

export async function updateCheck(id: string, patch: Partial<Check>) {
  const c = dataStore.get().checks.find((x) => x.id === id);
  if (!c) return;
  const next = { ...c, ...patch };
  dataStore.set((s) => ({ ...s, checks: s.checks.map((x) => (x.id === id ? next : x)) }));
  await write('checks', next);
}

export async function moveCheck(id: string, projectId: string) {
  await updateCheck(id, { projectId });
  setPrefs({ lastProject: projectId });
}

export async function deleteCheck(id: string) {
  const c = dataStore.get().checks.find((x) => x.id === id);
  dataStore.set((s) => ({ ...s, checks: s.checks.filter((x) => x.id !== id) }));
  if (c?.pictureId) {
    pictures.delete(c.pictureId);
    const u = urls.get(c.pictureId);
    if (u) URL.revokeObjectURL(u);
    urls.delete(c.pictureId);
  }
  if (persist) {
    await idbDelete('checks', id).catch(() => undefined);
    if (c?.pictureId) await idbDelete('pictures', c.pictureId).catch(() => undefined);
  }
}

// ---------- pictures ----------

const urls = new Map<string, string>();

export async function pictureBlob(id: string): Promise<Blob | undefined> {
  if (pictures.has(id)) return pictures.get(id);
  if (!persist) return undefined;
  const p = await idbGet<Picture>('pictures', id).catch(() => undefined);
  if (p) pictures.set(id, p.blob);
  return p?.blob;
}

export async function pictureUrl(id: string): Promise<string | undefined> {
  if (urls.has(id)) return urls.get(id);
  const blob = await pictureBlob(id);
  if (!blob) return undefined;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}

export function usePicture(id: string | undefined): string | undefined {
  const [loaded, setLoaded] = useState<{ id: string; url: string | undefined } | null>(null);
  useEffect(() => {
    let live = true;
    if (id && !urls.has(id)) void pictureUrl(id).then((url) => live && setLoaded({ id, url }));
    return () => {
      live = false;
    };
  }, [id]);
  if (!id) return undefined;
  return urls.get(id) ?? (loaded?.id === id ? loaded.url : undefined);
}

// ---------- household notes ----------

export async function putMemory(m: Memory) {
  const clean = sanitize(m);
  dataStore.set((s) => ({ ...s, memory: [clean, ...s.memory.filter((x) => x.id !== clean.id)].sort(memSort) }));
  await memory.put(clean).catch(() => undefined);
}

export async function removeMemory(id: string) {
  dataStore.set((s) => ({ ...s, memory: s.memory.filter((x) => x.id !== id) }));
  await memory.remove(id).catch(() => undefined);
}

export async function forgetEverything() {
  dataStore.set((s) => ({ ...s, memory: [] }));
  await memory.clear().catch(() => undefined);
}

/** A shop visit is one note, however many lines the quote had; other kinds are one record each. */
export function notesOf(memory: Memory[]): Memory[][] {
  const out: Memory[][] = [];
  const jobs = new Map<string, Memory[]>();
  for (const m of memory) {
    if (m.kind !== 'job') {
      out.push([m]);
      continue;
    }
    const k = `${m.shop.toLowerCase()}|${m.date}`;
    if (!jobs.has(k)) {
      jobs.set(k, []);
      out.push(jobs.get(k)!);
    }
    jobs.get(k)!.push(m);
  }
  // Within one visit, the largest amounts first.
  for (const g of jobs.values()) g.sort((a, b) => (b.kind === 'job' ? b.amount : 0) - (a.kind === 'job' ? a.amount : 0));
  return out;
}

// ---------- delete my data ----------

export async function wipeAll() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  pictures.clear();
  if (persist) {
    await Promise.all((['checks', 'projects', 'pictures'] as const).map((s) => idbClear(s).catch(() => undefined)));
  }
  await memory.clear().catch(() => undefined);
  const home: Project = { id: 'home', name: t('project.default'), created: new Date().toISOString() };
  if (persist) await idbPut('projects', home).catch(() => undefined);
  dataStore.set({ ready: true, checks: [], projects: [home], memory: [] });
}
