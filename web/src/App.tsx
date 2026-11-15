// Temporary working shell until the design pass lands: proves the pipeline end to end.

import { useEffect, useState } from 'react';
import { ensureUser } from './firebase';
import type { Pack } from './core/packs';
import { guideByRef, proPrice } from './core/packs';
import { deviceModelStatus, readPhoto, type Reading } from './reader';
import { quoteVerdicts, billVerdict, type LineVerdict } from './core/verdict';
import { maskText } from './core/pii';
import { signInWithGoogle, signOut, watchAccount, type AccountState } from './account';

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function lineText(v: LineVerdict): string {
  if (v.kind === 'unknown') return `${v.label}: not in my price book yet`;
  if (v.kind === 'high') return `${v.item.name}: ${money(v.amount)} is ${money(v.over)} above the usual top of ${money(v.item.high)}`;
  if (v.kind === 'low') return `${v.item.name}: ${money(v.amount)} is below the usual ${money(v.item.low)}`;
  return `${v.item.name}: ${money(v.amount)} is a fair price (${money(v.item.low)}–${money(v.item.high)})`;
}

function AccountBar() {
  const [acct, setAcct] = useState<AccountState>();
  const [msg, setMsg] = useState('');
  useEffect(() => watchAccount(setAcct), []);
  if (!acct) return null;
  return (
    <p>
      {acct.signedIn ? (
        <>
          Signed in as {acct.name ?? acct.email}.{' '}
          <button onClick={() => signOut().then(() => setMsg('Signed out.'))}>Sign out</button>
        </>
      ) : (
        <>
          Using WeKnow without an account.{' '}
          <button onClick={() => signInWithGoogle().then((r) => setMsg(r)).catch((e) => setMsg(String(e)))}>
            Sign in with Google
          </button>
        </>
      )}{' '}
      <small>{msg}</small>
    </p>
  );
}

export default function App() {
  const [pack, setPack] = useState<Pack>();
  const [device, setDevice] = useState('checking');
  const [file, setFile] = useState<File>();
  const [question, setQuestion] = useState('Is this fair?');
  const [reading, setReading] = useState<Reading>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cloudOk, setCloudOk] = useState(false);

  useEffect(() => {
    fetch('/packs/us-home.json').then((r) => r.json()).then(setPack);
    deviceModelStatus().then(setDevice);
    ensureUser().catch((e) => setError(String(e)));
  }, []);

  async function run() {
    if (!pack || !file) return;
    const where = device === 'available' ? 'device' : 'cloud';
    if (where === 'cloud' && !cloudOk) {
      setError('This computer has no on-device model. Tick the box to let the cloud read this photo.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      setReading(await readPhoto(pack, file, question, where));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const u = reading?.understanding;
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: 16, fontFamily: 'system-ui', fontSize: 18 }}>
      <h1>WeKnow</h1>
      <AccountBar />
      <p>On-device model: {device}. Pack: {pack ? `${pack.prices.length} prices, ${pack.guides.length} guides` : 'loading'}</p>
      <input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0])} />
      <p>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} style={{ width: '100%', fontSize: 18 }} />
      </p>
      {device !== 'available' && (
        <label>
          <input type="checkbox" checked={cloudOk} onChange={(e) => setCloudOk(e.target.checked)} /> Let the cloud read this photo
        </label>
      )}
      <p>
        <button onClick={run} disabled={!file || busy} style={{ fontSize: 20, padding: '12px 24px' }}>
          {busy ? 'Reading…' : 'Ask'}
        </button>
      </p>
      {error && <p style={{ color: '#b00' }}>{error}</p>}
      {reading && u && pack && (
        <section>
          <p>
            Read {reading.where === 'device' ? 'on this device' : 'in the cloud'} in {reading.ms} ms. Kind: {u.kind}
          </p>
          {u.kind === 'quote' && (
            <ul>
              {quoteVerdicts(u, pack).map((v, i) => (
                <li key={i}>{lineText(v)}</li>
              ))}
            </ul>
          )}
          {u.kind === 'bill' && <p>{JSON.stringify(billVerdict(u, maskText(u.lines.map((l) => l.label).join(' ')), []))}</p>}
          {u.kind === 'problem' && u.problemRef && (() => {
            const g = guideByRef(pack, u.problemRef);
            if (!g) return null;
            const pro = proPrice(pack, g);
            return (
              <div>
                <h2>{g.name}</h2>
                <ol>{g.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
                {pro && <p>A pro usually charges {money(pro.low)}–{money(pro.high)}.</p>}
              </div>
            );
          })()}
          <details>
            <summary>Raw form</summary>
            <pre>{JSON.stringify(u, null, 1)}</pre>
          </details>
        </section>
      )}
    </main>
  );
}
