// Speaking and listening for the Ask page, on top of voice.ts (the device's own voice; Chrome's on-device
// recognition when it has it). Adds what a conversation needs: a pace from Settings, a safety timeout when a
// browser never reports the end of speech, caption pacing when the voice is off, the two listening sounds, and
// a level meter so the bars follow the voice.

import { listenOnce, listenWhere, speak, stopSpeaking, type ListenWhere } from '../voice';
import { getPrefs, RATES } from '../store/prefs';

/** `?fast=1` skips every pause: for automated screenshots only. */
export const FAST = typeof location !== 'undefined' && new URLSearchParams(location.search).has('fast');

const estimate = (text: string, rate: number) => Math.max(1000, text.split(/\s+/).length * 340 / rate + 300);

/** Speak one sentence (or pace it as a caption when the voice is off). Resolves when done or stopped. */
export function sayAloud(text: string): Promise<void> {
  const p = getPrefs();
  const rate = RATES[p.rate];
  const spoken = text.replace(/[“”]/g, '').replace(/\u2011/g, '-');
  if (FAST) return Promise.resolve();
  if (!p.voice || typeof speechSynthesis === 'undefined') return new Promise((r) => setTimeout(r, estimate(text, rate)));
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve();
    };
    const guard = setTimeout(finish, estimate(text, rate) * 2.2 + 2000);
    void speak(spoken, 'en-US', 0.92 * rate).then(finish);
  });
}

export function quiet() {
  stopSpeaking();
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, FAST ? 0 : ms));
}

// ---------- the two sounds: like a knuckle on wood, quieter than the voice ----------

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function knock(freq: number, at: number, ac: AudioContext) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(0.06, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
  o.connect(g).connect(ac.destination);
  o.start(at);
  o.stop(at + 0.18);
}

export function soundStart() {
  if (FAST || !getPrefs().voice) return;
  const ac = audio();
  if (!ac) return;
  knock(520, ac.currentTime, ac);
  knock(700, ac.currentTime + 0.09, ac);
}

export function soundEnd() {
  if (FAST || !getPrefs().voice) return;
  const ac = audio();
  if (ac) knock(390, ac.currentTime, ac);
}

/** Unlock sound on the first press (browsers block it until then). */
export function unlockSound() {
  audio();
  try {
    const u = new SpeechSynthesisUtterance('');
    speechSynthesis.speak(u);
  } catch {
    /* no speech here */
  }
}

// ---------- listening ----------

let where: Promise<ListenWhere> | null = null;
export function listening(): Promise<ListenWhere> {
  // Only a recognizer that runs on this device may listen. A browser's own speech service would send the person's
  // voice to a server, raw and with no lamp lit, so there the microphone is not offered and the question is typed.
  where ??= listenWhere('en-US')
    .then((w) => (w === 'device' ? w : ('unavailable' as const)))
    .catch(() => 'unavailable' as const);
  return where;
}

export interface Ear {
  stop(): void;
  done: Promise<string>;
}

/** Listen for one question. `onWords` gets the words as they are heard; `onLevel` 0..1 for the bars. */
export async function listenForQuestion(onWords: (w: string) => void, onLevel?: (l: number) => void): Promise<Ear> {
  const w = await listening();
  if (w === 'unavailable') return { stop() {}, done: Promise.resolve('') };
  const ear = listenOnce(w, 'en-US', onWords);
  const meter = onLevel ? await levelMeter(onLevel) : null;
  void ear.done.finally(() => meter?.());
  return { stop: () => ear.stop(), done: ear.done };
}

async function levelMeter(onLevel: (l: number) => void): Promise<(() => void) | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const ac = audio();
    if (!ac) {
      stream.getTracks().forEach((t) => t.stop());
      return null;
    }
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf = 0;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      onLevel(0);
    };
  } catch {
    return null;
  }
}

/** Words WeKnow always understands, matched to the choice they mean. */
export function matchWord(heard: string): 'yes' | 'no' | 'next' | 'again' | 'stop' | 'wait' | 'help' | null {
  const w = heard.toLowerCase();
  // A no is heard first: "I'm not sure", "no, okay" and "don't" must never count as a yes.
  if (/\b(no|nope|not|don'?t|do not|never|no thanks)\b/.test(w)) return 'no';
  if (/\b(yes|yeah|yep|sure|okay|ok|please do)\b/.test(w)) return 'yes';
  if (/\b(next|done|ready|finished)\b/.test(w)) return 'next';
  if (/\b(again|repeat)\b/.test(w)) return 'again';
  if (/\b(stop|cancel)\b/.test(w)) return 'stop';
  if (/\bwait\b/.test(w)) return 'wait';
  if (/\bhelp\b/.test(w)) return 'help';
  return null;
}
