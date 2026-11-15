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

