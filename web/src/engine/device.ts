// What this device can do by itself, and getting it ready to work without the internet.
// Chrome's built-in model reports 'available' | 'downloadable' | 'downloading' | 'unavailable'
// (reader.deviceModelStatus). The download may only start from a press, so getReady() is called from a click.

import { createStore, useStore } from '../store/store';

export type ModelState = 'checking' | 'available' | 'downloadable' | 'downloading' | 'unavailable';

export interface DeviceState {
  model: ModelState;
  /** 0..100 while the model downloads; null otherwise. */
  pct: number | null;
  /** The download finished and the browser is unpacking it. */
  almost: boolean;
  /** Not enough space to get ready. */
  full: boolean;
  online: boolean;
}

export const deviceStore = createStore<DeviceState>({
  model: 'checking',
  pct: null,
  almost: false,
  full: false,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
});
export const useDevice = () => useStore(deviceStore);

const patch = (p: Partial<DeviceState>) => deviceStore.set((s) => ({ ...s, ...p }));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => patch({ online: true }));
  window.addEventListener('offline', () => patch({ online: false }));
}

type LMAvailability = { availability?: (o?: unknown) => Promise<string> };

/**
 * The same question reader.deviceModelStatus asks (text and image in, English out), asked here directly so the
 * status pill never has to load Firebase.
 */
async function availability(): Promise<string> {
  const lm = (globalThis as unknown as { LanguageModel?: LMAvailability }).LanguageModel;
  if (!lm?.availability) return 'unavailable';
  try {
    return await lm.availability({
      expectedInputs: [{ type: 'text' }, { type: 'image' }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
    });
  } catch {
    return 'unavailable';
  }
}

export async function refreshModel(): Promise<ModelState> {
  try {
    const s = (await availability()) as ModelState;
    const model: ModelState = ['available', 'downloadable', 'downloading', 'unavailable'].includes(s) ? s : 'unavailable';
    // Keep our own progress while we drive a download.
    if (deviceStore.get().pct === null || model === 'available') patch({ model, ...(model === 'available' ? { pct: null, almost: false } : {}) });
    return model;
  } catch {
    patch({ model: 'unavailable' });
    return 'unavailable';
  }
}

type Monitor = { addEventListener(type: 'downloadprogress', fn: (e: { loaded: number; total?: number }) => void): void };
type LM = {
  create(o: Record<string, unknown>): Promise<{ destroy?: () => void }>;
};

/** Start getting ready. Must run inside a click handler. Resolves when the model is ready or the attempt ended. */
export async function getReady(onDone?: (ok: boolean) => void): Promise<boolean> {
  const lm = (globalThis as unknown as { LanguageModel?: LM }).LanguageModel;
  if (!lm?.create) return false;
  patch({ model: 'downloading', pct: 0, almost: false, full: false });
  try {
    const session = await lm.create({
      expectedInputs: [{ type: 'text' }, { type: 'image' }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }],
      monitor(m: Monitor) {
        m.addEventListener('downloadprogress', (e) => {
          const f = e.total ? e.loaded / e.total : e.loaded;
          const pct = Math.max(0, Math.min(100, Math.round(f * 100)));
          patch({ pct, almost: pct >= 100 });
        });
      },
    });
    session.destroy?.();
    patch({ model: 'available', pct: null, almost: false });
    onDone?.(true);
    return true;
  } catch (e) {
    const name = (e as { name?: string }).name ?? '';
    patch({ pct: null, almost: false, full: name === 'QuotaExceededError' });
    await refreshModel();
    onDone?.(false);
    return false;
  }
}

/** The word for this device, used in every "on this {device}". */
export function deviceWord(): 'phone' | 'tablet' | 'computer' {
  if (typeof navigator === 'undefined') return 'computer';
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
  if (/iPhone|iPod/.test(ua) || (/Android/.test(ua) && /Mobile/.test(ua))) return 'phone';
  if (/Android/.test(ua)) return 'tablet';
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  if (coarse) return Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'phone';
  return 'computer';
}
