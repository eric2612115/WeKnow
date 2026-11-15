// Prompt budgets for the "choose" step (stage C in reader.ts): the model sees each printed line with a few
// pack candidates and picks one ref or null. On-device models have small context windows, so stage B caps the
// reading (30 lines, 120 characters per label) and trims candidate lists until the prompt fits, dropping the
// lowest-ranked option first and never a line's best.
//
// Context windows: Chrome's Gemini Nano reports its window as session.contextWindow (about 9,216 tokens on
// current builds; the reader cannot read it through Firebase AI Logic, so we budget well under it). Apple's
// on-device model has 4,096 tokens per session, shared by instructions, prompt and answer.
//
// Token counting is deliberately pessimistic, because no tokenizer for either model ships to the web:
// SentencePiece tokenizers of the Gemini family split numbers into single digits, and hyphens, colons, quotes
// and brackets are tokens of their own, so every digit and every symbol counts as one token; everything else
// counts one token per 2.5 characters, where Apple documents 3–4 characters per token in English; any
// character outside ASCII (accents, CJK) counts as one token.

export interface PromptBudget {
  name: string;
  contextTokens: number;
  /** Tokens left for the choose prompt after the JSON schema, the answer (≤ 30 choices) and a margin. */
  chooseInputTokens: number;
}

export const BUDGETS = {
  nano: { name: 'Chrome Gemini Nano', contextTokens: 9216, chooseInputTokens: 6000 },
  apple: { name: 'Apple on-device model', contextTokens: 4096, chooseInputTokens: 2400 },
  cloud: { name: 'cloud', contextTokens: 1_000_000, chooseInputTokens: 32_000 },
} as const satisfies Record<string, PromptBudget>;

/** At most this many lines of one reading go to the choose step (the read schema asks for the same). */
export const MAX_LINES = 30;
/** Printed labels are cut to this many characters before retrieval and the choose step. */
export const MAX_LABEL_CHARS = 120;

const PLAIN_CHARS_PER_TOKEN = 2.5;

/** An upper estimate of the tokens a text costs on Nano or Apple's model. */
export function estimateTokens(text: string): number {
  let digits = 0;
  let symbols = 0;
  let plain = 0;
  for (const ch of String(text ?? '')) {
    if (ch >= '0' && ch <= '9') digits++;
    else if (ch.charCodeAt(0) > 0x7e || ch.codePointAt(0)! > 0xffff) symbols++;
    else if (/[A-Za-z\s]/.test(ch)) plain++;
    else symbols++;
  }
  return digits + symbols + Math.ceil(plain / PLAIN_CHARS_PER_TOKEN);
}

/** The two instruction lines that open the choose prompt in reader.ts (150 characters, ≈ 62 tokens counted as above). */
export const CHOOSE_HEADER_TOKENS = 80;

export interface ChoiceItem {
  i: number;
  text: string;
  options: Array<{ ref: string; name: string }>;
}

/** The numbered list exactly as reader.ts renders it in the choose prompt. */
export function renderChoices(items: ChoiceItem[]): string {
  return items.map((it) => `${it.i}. "${it.text}"\n${it.options.map((o) => `   - ${o.ref}: ${o.name}`).join('\n')}`).join('\n');
}

export function chooseTokens(items: ChoiceItem[]): number {
  return CHOOSE_HEADER_TOKENS + estimateTokens(renderChoices(items));
}

/** Cap a reading's lines: at most MAX_LINES, each label at most MAX_LABEL_CHARS. */
export function capLines<T extends { label?: unknown }>(lines: T[]): Array<T & { label: string }> {
  return (Array.isArray(lines) ? lines : []).slice(0, MAX_LINES).map((l) => ({
    ...l,
    label: (typeof l?.label === 'string' ? l.label : l?.label == null ? '' : String(l.label)).slice(0, MAX_LABEL_CHARS),
  }));
}

export interface Fitted<T extends ChoiceItem> {
  items: T[];
  tokens: number;
  /** Options removed to fit. */
  trimmed: number;
  /** Characters the label shown to the model was cut to, when cutting was needed. */
  labelChars: number;
  /** Lines left out entirely: past MAX_LINES, or when nothing else made the prompt fit. */
  dropped: number;
}

/**
 * Cap and trim candidate lists until the choose prompt fits the budget. Options are assumed best-first.
 * In order, while the prompt is still too long: keep at most 3 options per line; cut the label the model sees to
 * 60 characters; keep only each line's best option; cut labels to 32, then 16 characters; only then drop lines
 * from the end. Lines beyond MAX_LINES are always dropped and labels always cut to MAX_LABEL_CHARS.
 */
export function fitChoices<T extends ChoiceItem>(items: T[], budget: PromptBudget): Fitted<T> {
  const out = items.slice(0, MAX_LINES).map((it) => ({ ...it, text: String(it.text ?? '').slice(0, MAX_LABEL_CHARS), options: [...it.options] }));
  let trimmed = 0;
  let labelChars = MAX_LABEL_CHARS;
  let dropped = Math.max(0, items.length - MAX_LINES);
  const over = () => out.length > 0 && chooseTokens(out) > budget.chooseInputTokens;
  const keepOptions = (atLeast: number) => {
    while (over()) {
      let widest = -1;
      for (let j = out.length - 1; j >= 0; j--) {
        if (out[j].options.length > atLeast && (widest < 0 || out[j].options.length > out[widest].options.length)) widest = j;
      }
      if (widest < 0) return;
      out[widest].options.pop();
      trimmed++;
    }
  };
  const cutLabels = (chars: number) => {
    if (!over()) return;
    labelChars = chars;
    for (const it of out) it.text = it.text.slice(0, chars);
  };
  keepOptions(3);
  cutLabels(60);
  keepOptions(1);
  cutLabels(32);
  cutLabels(16);
  while (over()) {
    out.pop();
    dropped++;
  }
  return { items: out, tokens: chooseTokens(out), trimmed, labelChars, dropped };
}
