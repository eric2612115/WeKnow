// Covering the words of a paper (a PDF's own text, one printed line per text line) before a model may read them.
// The rules are the personal-data rules in pii.ts, plus the one rule a pattern cannot see, the same one the picture
// cover uses (cover.ts): a name printed on the line under its label ("ACCOUNT HOLDER" above "Theodora Quillfeather").
// Columns on one line are kept apart by two spaces or more (src/pdf.ts writes them that way).

import { LOOKS_LIKE_NAME, maskText, NAME_LABEL_ONLY, piiSpans, type PIIKind } from './pii';

/** Two to four capitalised words at the start of a column: how a name is printed under its label. */
const NAME_START = /^[A-Z][A-Za-z'’.-]+(?:[ \t]+[A-Z][A-Za-z'’.-]+){1,3}/;
const COLUMNS = /(\s{2,})/;

export interface CoveredPaper {
  /** The paper's words with every personal detail found replaced by a token such as [name]. */
  text: string;
  /** What was covered, for the sheet and the receipt. */
  counts: Partial<Record<PIIKind, number>>;
  /** The words of the people's names that were covered, lower case (a company's own words left out). */
  names: Set<string>;
}

export function coverPaperText(text: string): CoveredPaper {
  const counts: Partial<Record<PIIKind, number>> = {};
  // Overlapping matches ("40-2271-0583" is an account and looks like a phone) are one detail.
  const hits = piiSpans(text);
  for (const h of hits) counts[h.kind] = (counts[h.kind] ?? 0) + 1;
  // A name the rules in pii.ts already found is counted once.
  const seen = hits.filter((h) => h.kind === 'name').map((h) => h.text);
  const lines = text.split('\n');
  const out = [...lines];
  for (let i = 0; i + 1 < lines.length; i++) {
    const labelled = lines[i].split(COLUMNS).some((c) => NAME_LABEL_ONLY.test(c.trim()));
    if (!labelled) continue;
    out[i + 1] = out[i + 1]
      .split(COLUMNS)
      .map((col) => {
        const lead = col.match(/^\s*/)?.[0] ?? '';
        const body = col.slice(lead.length);
        const name = NAME_START.exec(body);
        if (!name || /\d/.test(name[0]) || !LOOKS_LIKE_NAME.test(name[0])) return col;
        if (!seen.some((x) => x.includes(name[0]) || name[0].includes(x))) counts.name = (counts.name ?? 0) + 1;
        seen.push(name[0]);
        return `${lead}[name]${body.slice(name[0].length)}`;
      })
      .join('');
  }
  // A name printed beside its label in the same line ("Customer  Theodora Quillfeather" on a payment stub).
  for (let i = 0; i < out.length; i++) {
    const cols = out[i].split(COLUMNS);
    for (let j = 0; j + 2 < cols.length; j += 2) {
      if (!NAME_LABEL_ONLY.test(cols[j].trim())) continue;
      const body = cols[j + 2];
      const name = NAME_START.exec(body);
      if (!name || /\d/.test(name[0]) || !LOOKS_LIKE_NAME.test(name[0])) continue;
      if (!seen.some((x) => x.includes(name[0]) || name[0].includes(x))) counts.name = (counts.name ?? 0) + 1;
      seen.push(name[0]);
      cols[j + 2] = `[name]${body.slice(name[0].length)}`;
    }
    out[i] = cols.join('');
  }
  // A name found once is covered everywhere on the page, in any case ("THEODORA QUILLFEATHER" in the address block,
  // a misspelt copy further down), with the capitalised words right after it. Words that also name the company stay.
  const masked = maskText(out.join('\n'));
  const words = new Set(seen.flatMap((n) => n.toLowerCase().split(/[^a-z'’-]+/)).filter((w) => w.length >= 3));
  for (const line of masked.split('\n')) {
    if (COMPANY.test(line) && !line.includes('[name]')) for (const w of line.toLowerCase().split(/[^a-z'’-]+/)) words.delete(w);
  }
  if (!words.size) return { text: masked, counts, names: words };
  const again = new RegExp(`\\b(?:${[...words].map(escape).join('|')})\\b(?:[ \\t]+[A-Z][A-Za-z'’.-]+){0,2}`, 'gi');
  const fixCase = new RegExp(`\\b(?:${[...words].map(escape).join('|')})\\b`, 'i');
  const covered = masked.replace(again, (m) => {
    // The 'i' flag lets the trailing words match any case; keep only words that look like part of a name.
    const first = fixCase.exec(m)?.[0] ?? m;
    const rest = m.slice(first.length).match(/^(?:[ \t]+[A-Z][A-Za-z'’.-]+)*/)?.[0] ?? '';
    return `[name]${m.slice(first.length + rest.length)}`;
  });
  return { text: covered, counts, names: words };
}

const COMPANY = /\b(co-?op|inc|llc|ltd|corp|company|district|bank|trust|care|services?|electric|water|clinic)\b/i;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The words that may be read by a model, on one line: covered, joined, and covered again, because a number split over
 * two lines ("account 2048" / "6650 3168") is one number once the lines are joined.
 */
export function flatPayload(text: string): string {
  return maskText(maskText(text).replace(/\s+/g, ' ').trim()).slice(0, 4000);
}
