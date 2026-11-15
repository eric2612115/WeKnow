// The camera: one live stream for the Ask window, a still frame when the person asks, and the torch on phones.
// Nothing here leaves the device; a still becomes a Blob that the reader may read on this device, or send only
// after the person said yes.

import { createStore, useStore } from '../store/store';

export type CameraState = 'idle' | 'starting' | 'live' | 'blocked' | 'none';

export const cameraStore = createStore<{ state: CameraState; stream: MediaStream | null }>({ state: 'idle', stream: null });
export const useCamera = () => useStore(cameraStore);

const VIDEO: MediaTrackConstraints = { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } };

function blockedOrNone(e: unknown): CameraState {
  const name = (e as { name?: string }).name ?? '';
  return name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError' ? 'none' : 'blocked';
}

export async function permission(name: 'camera' | 'microphone'): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: name as PermissionName })).state;
  } catch {
    return 'unknown';
  }
}

/** Camera and microphone together, so there is one system box. The microphone track is closed at once. */
export async function requestCameraAndMic(): Promise<CameraState> {
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStore.set({ state: 'none', stream: null });
    return 'none';
  }
  cameraStore.set((s) => ({ ...s, state: 'starting' }));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO, audio: true });
    stream.getAudioTracks().forEach((t) => {
      t.stop();
      stream.removeTrack(t);
    });
    cameraStore.set({ state: 'live', stream });
    return 'live';
  } catch (e) {
    // The microphone may be missing or refused on its own: try the camera alone before giving up.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
      cameraStore.set({ state: 'live', stream });
      return 'live';
    } catch {
      const state = blockedOrNone(e);
      cameraStore.set({ state, stream: null });
      return state;
    }
  }
}

export async function startCamera(): Promise<CameraState> {
  const cur = cameraStore.get();
  if (cur.state === 'live' && cur.stream?.active) return 'live';
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraStore.set({ state: 'none', stream: null });
    return 'none';
  }
  cameraStore.set((s) => ({ ...s, state: 'starting' }));
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: VIDEO });
    cameraStore.set({ state: 'live', stream });
    return 'live';
  } catch (e) {
    const state = blockedOrNone(e);
    cameraStore.set({ state, stream: null });
    return state;
  }
}

export function stopCamera() {
  const { stream } = cameraStore.get();
  stream?.getTracks().forEach((t) => t.stop());
  cameraStore.set({ state: 'idle', stream: null });
}

/** A still frame from the live video, as a JPEG, plus how bright it is (0..1). */
export async function captureStill(video: HTMLVideoElement): Promise<{ blob: Blob; light: number } | null> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return null;
  g.drawImage(video, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) return null;
  return { blob, light: brightness(g, w, h) };
}

function brightness(g: CanvasRenderingContext2D, w: number, h: number): number {
  const step = 16;
  const data = g.getImageData(0, 0, w, h).data;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const i = (y * w + x) * 4;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      n++;
    }
  }
  return n ? sum / n / 255 : 1;
}

/** Turn the phone's light on, where the camera has one. */
export async function torch(on: boolean): Promise<boolean> {
  const track = cameraStore.get().stream?.getVideoTracks()[0];
  const caps = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
  if (!track || !caps?.torch) return false;
  try {
    await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
    return true;
  } catch {
    return false;
  }
}
