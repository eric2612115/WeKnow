// The shapes an answer is made of. Built by plain code from the reading and the pack (answer/compose.ts),
// shown on the Ask page, and kept with a check so "Hear it again" needs nothing from the network.

export type Tone = 'ok' | 'warn' | 'stop' | 'plain';

/** Where an answer ran, in the five states of UI-SPEC 7.1. */
export type WhereRan = 'local' | 'mixed' | 'cloud' | 'offline' | 'pending';

export type LineState = 'fair' | 'high' | 'low' | 'found' | 'pending';

/** One priced line of a quote, as shown in the answer and kept with the check. */
export interface LineItem {
  n: number; // 1-based line number on the paper
  label: string; // as printed (masked)
  amount: number | null;
  state: LineState;
  over?: number; // how far above the usual top, when high
  typical?: number;
  top?: number; // the usual top price, the reference for "high"
  name?: string; // the pack item it matched
}

export interface SourceRow {
  label: string; // named by kind: "Repair price book: Replace brake pads (one axle)"
  date: string; // "checked 12 Nov 2026"
  url?: string; // only shown inside Technical details
  title?: string;
}

export interface Receipt {
  w: WhereRan;
  n: number; // items for the mixed and pending tags
  stayed: string[];
  sent: string[]; // the exact words that went (the dashed box)
  sentPicture?: boolean; // the whole picture went (shown as a small copy in the box)
  waiting?: string;
  saved?: string;
  sources: SourceRow[];
  tech: string[];
}

export interface Verdict {
  tone: Tone;
  text: string;
}
