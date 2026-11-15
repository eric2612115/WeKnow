// Parsing the string-shaped output of the server prompt templates (their schema format has no arrays of objects yet).

/** "Brake fluid flush || 160.00" -> { label, amount }. Anything unparseable keeps its label and has no amount. */
export function parseLine(s: unknown): { label: string; amount: number | null } {
  const text = String(s ?? '');
  const i = text.lastIndexOf('||');
  if (i < 0) return { label: text.trim(), amount: null };
  const amount = Number(text.slice(i + 2).replace(/[^0-9.]/g, ''));
  return { label: text.slice(0, i).trim(), amount: Number.isFinite(amount) && text.slice(i + 2).trim() !== '' ? amount : null };
}

/** "3 || brake-pads" -> { i: 3, ref: 'brake-pads' }; "3 || none" -> { i: 3, ref: null }. */
export function parseChoice(s: unknown): { i: number; ref: string | null } | null {
  const m = String(s ?? '').match(/^\s*(\d+)\s*\|\|\s*(\S+)\s*$/);
  if (!m) return null;
  return { i: Number(m[1]), ref: m[2].toLowerCase() === 'none' ? null : m[2] };
}


/** Whatever the model returned for an account, keep only its last four digits (or nothing). Plain code, not trust. */
export function lastFour(v: unknown): string | null {
  const digits = String(v ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * Retry a cloud call on rate limits and transient server errors. When the server says how long to wait
 * ("Please retry in 8.97s"), wait that long (at most 30 s); otherwise wait 3 s, 12 s, 30 s. Then give up.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  // A per-minute quota (429) can stay closed for most of a minute, so the waits add up to ~45 s.
  waits = [3000, 12000, 30000],
  onWait?: (ms: number) => void,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      // A daily quota will not reopen within a wait worth making a person sit through.
      if (isDailyQuota(e)) throw e;
      const transient = /\[(429|500|502|503|504)\b/.test(msg) || /RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(msg);
      if (!transient || attempt >= waits.length) throw e;
      const asked = msg.match(/retry in ([0-9.]+)s/i);
      const ms = asked ? Math.min(30000, Math.ceil(Number(asked[1]) * 1000) + 500) : waits[attempt];
      onWait?.(ms);
      await new Promise((r) => setTimeout(r, ms));
    }
  }
}

/**
 * True for a 429 that means the day's quota is gone (Gemini free tier: requests per day per model),
 * as opposed to a per-minute limit that reopens in seconds.
 */
export function isDailyQuota(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  if (!/\[429\b|RESOURCE_EXHAUSTED/.test(msg)) return false;
  if (/PerDay|per day/i.test(msg)) return true;
  const delay = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  return !!delay && Number(delay[1]) > 120;
}
