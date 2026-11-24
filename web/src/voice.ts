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

// macOS lists its novelty voices (Albert, Bad News, Bubbles...) first, and its Eloquence voices (Eddy, Flo...) sound
// robotic: neither may read an answer.
const NOVELTY = new Set(
  'Albert,Bad News,Bahh,Bells,Boing,Bubbles,Cellos,Good News,Jester,Organ,Superstar,Trinoids,Whisper,Wobble,Zarvox,Junior,Ralph,Fred,Kathy,Hysterical,Deranged,Pipe Organ'.split(','),
);
const ROBOTIC = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley)\b/;
const NATURAL = /^(Samantha|Ava|Zoe|Allison|Susan|Tom|Evan|Nathan|Nicky|Joelle|Noelle|Microsoft (Aria|Jenny|Guy|Zira|David|Mark)|Google US English|Mei-Jia|Meijia|Tingting|Sinji)\b|\((Premium|Enhanced)\)|Natural/;

const tag = (l: string) => l.replace('_', '-').toLowerCase();

/**
 * The voice to read in `lang` ("en-US", "zh-Hant"): a natural voice on this device when there is one. Same language
 * and region first, then the device's own voice for it, then a voice on the device rather than one online.
 */
export function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  const want = tag(lang === 'zh-Hant' ? 'zh-TW' : lang === 'zh-Hans' ? 'zh-CN' : lang);
  const same = voices.filter((v) => tag(v.lang).slice(0, 2) === want.slice(0, 2) && !NOVELTY.has(v.name.split(' (')[0]));
  if (!same.length) return null;
  const score = (v: SpeechSynthesisVoice) =>
    (tag(v.lang) === want ? 8 : 0) + (v.localService ? 16 : 0) + (NATURAL.test(v.name) ? 4 : 0) + (v.default ? 2 : 0) - (ROBOTIC.test(v.name) ? 6 : 0);
  return same.reduce((best, v) => (score(v) > score(best) ? v : best));
}

/** Speak a sentence with a natural local voice when one exists. Resolves when speech ends. */
export function speak(text: string, lang = 'en-US', rate = 0.92): Promise<void> {
  const synth = globalThis.speechSynthesis;
  if (!synth) return Promise.resolve();
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate; // a little slower than default: easier to follow
  u.voice = pickVoice(synth.getVoices(), lang);
  return new Promise((resolve) => {
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking() {
  globalThis.speechSynthesis?.cancel();
}
