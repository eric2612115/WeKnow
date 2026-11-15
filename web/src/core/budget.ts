// Prompt budgets for the "choose" step (stage C in reader.ts): the model sees each printed line with a few
// pack candidates and picks one ref or null. On-device models have small context windows, so stage B trims
// the candidate lists until the prompt fits, dropping the lowest-ranked option first and never a line's best.
//
// Context windows: Chrome's Gemini Nano exposes it as session.contextWindow (about 9,216 tokens on current
// builds); Apple's on-device model has 4,096 tokens per session, shared by instructions, prompt and answer.
// Apple documents 3–4 characters per token in English, so we count 3 to stay on the safe side.

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

export const CHARS_PER_TOKEN = 3;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/** The two instruction lines that open the choose prompt in reader.ts (≈ 170 characters). */
export const CHOOSE_HEADER_TOKENS = 60;

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

export interface Fitted<T extends ChoiceItem> {
  items: T[];
  tokens: number;
  /** Options removed to fit. */
  trimmed: number;
  /** Lines left out entirely (only when even one option per line does not fit). */
  dropped: number;
}

/** Trim candidate lists until the choose prompt fits the budget. Options are assumed best-first. */
export function fitChoices<T extends ChoiceItem>(items: T[], budget: PromptBudget): Fitted<T> {
  const out = items.map((it) => ({ ...it, options: [...it.options] }));
  let trimmed = 0;
  let dropped = 0;
  while (out.length && chooseTokens(out) > budget.chooseInputTokens) {
    let widest = -1;
    for (let j = out.length - 1; j >= 0; j--) if (out[j].options.length > 1 && (widest < 0 || out[j].options.length > out[widest].options.length)) widest = j;
    if (widest >= 0) {
      out[widest].options.pop();
      trimmed++;
    } else {
      out.pop();
      dropped++;
    }
  }
  return { items: out, tokens: chooseTokens(out), trimmed, dropped };
}
