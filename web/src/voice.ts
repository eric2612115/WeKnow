// Voice in and out, on the device where the browser allows it.
// Speaking uses the system's speech synthesis (local voices). Listening asks Chrome for on-device recognition
// (`processLocally`) and reports honestly when it had to fall back or is unavailable.

export type ListenWhere = 'device' | 'browser-service' | 'unavailable';

type SR = {
  new (): SRInstance;
  available?: (o: { langs: string[]; processLocally: boolean }) => Promise<string>;
  install?: (o: { langs: string[]; processLocally: boolean }) => Promise<boolean>;
};
type SRInstance = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  processLocally?: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function recognitionClass(): SR | undefined {
  const g = globalThis as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
  return g.SpeechRecognition ?? g.webkitSpeechRecognition;
}

/** Where listening would run right now, installing Chrome's local English pack when it is downloadable. */
export async function listenWhere(lang = 'en-US'): Promise<ListenWhere> {
  const R = recognitionClass();
  if (!R) return 'unavailable';
  if (!R.available) return 'browser-service';
  try {
    const status = await R.available({ langs: [lang], processLocally: true });
    if (status === 'available') return 'device';
    if (status === 'downloadable' && R.install && (await R.install({ langs: [lang], processLocally: true }))) return 'device';
  } catch {
    /* fall through */
  }
  return 'browser-service';
}

export interface Listening {
  stop(): void;
  done: Promise<string>;
}

/** Listen for one utterance. Resolves with the final transcript ('' if nothing was heard). */
export function listenOnce(where: ListenWhere, lang = 'en-US', onPartial?: (t: string) => void): Listening {
  const R = recognitionClass();
  if (!R || where === 'unavailable') return { stop() {}, done: Promise.resolve('') };
  const rec = new R();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  if (where === 'device') rec.processLocally = true;
  let finalText = '';
  const done = new Promise<string>((resolve) => {
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onPartial?.(finalText + interim);
    };
    rec.onerror = () => resolve(finalText.trim());
    rec.onend = () => resolve(finalText.trim());
  });
  rec.start();
  return { stop: () => rec.stop(), done };
}

/** Speak a sentence with a local voice when one exists. Resolves when speech ends. */
export function speak(text: string, lang = 'en-US', rate = 0.92): Promise<void> {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate; // a little slower than default: easier to follow
  const voices = synth.getVoices().filter((v) => v.lang.startsWith(lang.slice(0, 2)));
  u.voice = voices.find((v) => v.localService) ?? voices[0] ?? null;
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking() {
  globalThis.speechSynthesis?.cancel();
}
