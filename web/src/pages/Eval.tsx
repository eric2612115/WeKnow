// Hidden evaluation page (/eval): run the labelled fixture set (fixtures/eval, 50 cases with truth.json) through
// the real reader on this device or in the cloud, and show what came back: correct, leaks, latency, where it ran.
// Not linked from the app. Cloud runs use the free-tier quota, so the size of a run is chosen first.

import { useEffect, useRef, useState } from 'react';
import type { EvalRow } from '../eval';
import { appSettings } from '../engine/knowledge';
import { useDevice } from '../engine/device';
import { Card, PageTitle, Seg } from '../ui/controls';
import { I } from '../ui/icons';

type Where = 'device' | 'cloud';
const SIZES = ['5', '10', '25', '50'] as const;

export default function Eval() {
  const d = useDevice();
  const [where, setWhere] = useState<Where>('cloud');
  const [size, setSize] = useState<(typeof SIZES)[number]>('5');
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [running, setRunning] = useState(false);
  const [model, setModel] = useState('');
  const [copied, setCopied] = useState(false);
  const poll = useRef<number | null>(null);

  useEffect(() => {
    void appSettings().then((s) => setModel(s.cloudModel));
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, []);

  const run = async () => {
    setRunning(true);
    setRows([]);
    const g = globalThis as unknown as { __evalRows?: EvalRow[] };
    g.__evalRows = [];
    poll.current = window.setInterval(() => setRows([...(g.__evalRows ?? [])]), 500);
    try {
      const { runEval } = await import('../eval');
      const out = await runEval(where, where === 'cloud' ? model || undefined : undefined, Number(size));
      setRows(out);
    } finally {
      if (poll.current) clearInterval(poll.current);
      setRunning(false);
    }
  };

  const done = rows.filter((r) => r.ms >= 0);
  const right = rows.filter((r) => r.ok).length;
  const leaks = rows.filter((r) => r.leaked).length;
  const sorted = done.map((r) => r.ms).sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const json = JSON.stringify(
    { where, model: where === 'cloud' ? `templates (${model})` : 'built-in', cases: rows.length, correct: right, leaks, medianMs: median, rows },
    null,
    1,
  );

  return (
    <main id="page" className="min-h-0 flex-1 overflow-auto px-4 pt-[0.4rem] pb-10 lg:px-7 lg:pt-2 lg:pb-12">
      <div className="mx-auto max-w-[60rem]">
        <PageTitle>Evaluation</PageTitle>
        <Card className="mb-4">
          <p className="text-small text-ink-2">
            The labelled fixture set: synthetic quotes and bills with planted names, changed accounts and hidden instructions. Each case is read by
            the real reader and judged by the same rules as the app.
          </p>
          <div className="row mt-2 flex-wrap">
            <span>Where to read</span>
            <Seg<Where>
              label="Where to read"
              value={where}
              onChange={setWhere}
              options={[
                { value: 'device', label: 'This device', disabled: d.model !== 'available' },
                { value: 'cloud', label: 'Cloud' },
              ]}
            />
          </div>
          <div className="row flex-wrap">
            <span>
              Cases
              <small>Cloud runs count against the free-tier quota.</small>
            </span>
            <Seg label="Cases" value={size} onChange={setSize} options={SIZES.map((s) => ({ value: s, label: s }))} />
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn btn-yes" disabled={running} onClick={() => void run()}>
              <I.play />
              {running ? `Running ${rows.length} of ${size}` : 'Run'}
            </button>
            <button
              type="button"
              className="btn"
              disabled={!rows.length}
              onClick={async () => {
                await navigator.clipboard.writeText(json);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <I.copy />
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
        </Card>
        {rows.length > 0 && (
          <Card>
            <p className="mb-3 text-body font-bold">
              {right} of {rows.length} correct. {leaks} leaks. Median {(median / 1000).toFixed(1)} s. {where === 'cloud' ? 'Cloud, through the server prompt templates.' : 'Built-in model on this device.'}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-hair text-ink-2">
                    <th className="py-2 pr-3 font-semibold">Case</th>
                    <th className="py-2 pr-3 font-semibold">Correct</th>
                    <th className="py-2 pr-3 font-semibold">Leaks</th>
                    <th className="py-2 pr-3 font-semibold">Latency</th>
                    <th className="py-2 pr-3 font-semibold">Where</th>
                    <th className="py-2 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-hair last:border-0">
                      <td className="py-2 pr-3 font-semibold tabular-nums">{r.id}</td>
                      <td className={`py-2 pr-3 font-semibold ${r.ok ? 'text-go' : 'text-stop'}`}>{r.ok ? 'Yes' : 'No'}</td>
                      <td className={`py-2 pr-3 ${r.leaked ? 'font-semibold text-stop' : ''}`}>{r.leaked ? 'Leak' : 'None'}</td>
                      <td className="py-2 pr-3 tabular-nums">{r.ms >= 0 ? `${(r.ms / 1000).toFixed(1)} s` : '-'}</td>
                      <td className="py-2 pr-3">{r.where === 'device' ? 'This device' : 'Cloud'}</td>
                      <td className="py-2 break-all text-ink-2">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </main>
  );
}
