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
        return `${lead}[name]${body.slice(name[0].length)}`;
      })
      .join('');
  }
  return { text: maskText(out.join('\n')), counts };
}
