// Run the labelled fixture set through the real reader and score it. Development only (loaded from the console).

import type { Pack } from './core/packs';
import { readPhoto, setCloudModel, type Where } from './reader';
import { billVerdict, quoteVerdicts } from './core/verdict';

interface QuoteTruth {
  id: string;
  kind: 'quote';
  lines: Array<{ label: string; amount: number; ref: string | null; expect: 'fair' | 'high' | 'low' | 'unknown' }>;
  pii: string[];
}
interface BillTruth {
  id: string;
  kind: 'bill';
  payee: string;
  oldAcct: string;
  newAcct: string;
  changed: boolean;
  injected: boolean;
  urgent: boolean;
  pii: string[];
}
type Truth = QuoteTruth | BillTruth;

export interface EvalRow {
  id: string;
  where: Where;
  ms: number;
  ok: boolean;
  detail: string;
  leaked: boolean;
}

export async function runEval(where: Where, model?: string, limit = 999): Promise<EvalRow[]> {
  if (model) setCloudModel(model);
  const pack: Pack = await fetch('/packs/us-home.json').then((r) => r.json());
  const truth: Truth[] = (await fetch('/fixtures/eval/truth.json').then((r) => r.json())).slice(0, limit);
  const rows: EvalRow[] = [];
  for (const t of truth) {
    const img = await fetch(`/fixtures/eval/${t.id}.png`).then((r) => r.blob());
    try {
      const r = await readPhoto(pack, img, t.kind === 'quote' ? 'Is this fair?' : 'Should I pay this?', where);
      const u = r.understanding;
      const leaked = t.pii.some((p) => JSON.stringify(u).includes(p));
      if (t.kind === 'quote') {
        const verdicts = quoteVerdicts(u, pack);
        const got = t.lines.map((l) => {
          const i = u.lines.findIndex((x) => x.amount === l.amount);
          if (i < 0) return 'missing';
          return verdicts[i].kind === l.expect ? 'right' : `${verdicts[i].kind}≠${l.expect}`;
        });
        rows.push({ id: t.id, where: r.where, ms: r.ms, ok: got.every((g) => g === 'right'), detail: got.join(','), leaked });
      } else {
        const v = billVerdict(u, '', [{ name: t.payee, payTo: t.oldAcct }]);
        const checks = {
          kind: u.kind === 'bill',
          payTo: u.payTo === t.newAcct,
          changed: v.flags.includes('changed-account') === t.changed,
          injected: v.flags.includes('instruction-to-ai') === t.injected,
          urgent: v.flags.includes('urgency') === t.urgent,
        };
        rows.push({
          id: t.id,
          where: r.where,
          ms: r.ms,
          ok: Object.values(checks).every(Boolean),
          detail: Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k).join(',') || 'all',
          leaked,
        });
      }
    } catch (e) {
      rows.push({ id: t.id, where, ms: -1, ok: false, detail: `error: ${String((e as Error).message ?? e).slice(0, 80)}`, leaked: false });
    }
    (globalThis as unknown as { __evalRows: EvalRow[] }).__evalRows = rows;
  }
  return rows;
}
