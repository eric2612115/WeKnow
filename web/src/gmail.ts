// Gmail, read-only: find recent bills, booking confirmations and suspicious mail, mask them on this device,
// and judge them with the same rules as a photographed bill. WeKnow never deletes, sends or drafts mail.
// The gmail.readonly scope is requested only when the person presses "Connect Gmail" (incremental consent).

import { GoogleAuthProvider, linkWithPopup, reauthenticateWithPopup, signInWithPopup } from 'firebase/auth';
import { auth } from './firebase';
import { maskText } from './core/pii';

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
let token: { value: string; expires: number } | null = null;

/** Ask Google for read-only Gmail access. Returns false if the person cancels. */
export async function connectGmail(): Promise<boolean> {
  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);
  provider.setCustomParameters({ prompt: 'consent' });
  const user = auth.currentUser;
  try {
    const result = !user
      ? await signInWithPopup(auth, provider)
      : user.isAnonymous
        ? await linkWithPopup(user, provider)
        : await reauthenticateWithPopup(user, provider);
    const cred = GoogleAuthProvider.credentialFromResult(result);
    if (!cred?.accessToken) return false;
    token = { value: cred.accessToken, expires: Date.now() + 50 * 60 * 1000 };
    return true;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    if (code.includes('popup-closed') || code.includes('cancelled')) return false;
    throw e;
  }
}

export function gmailConnected(): boolean {
  return !!token && token.expires > Date.now();
}

export function disconnectGmail() {
  token = null;
}

async function api<T>(path: string): Promise<T> {
  if (!gmailConnected()) throw new Error('Gmail is not connected');
  const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${token!.value}` },
  });
  if (r.status === 401) {
    token = null;
    throw new Error('Gmail access expired; connect again');
  }
  if (!r.ok) throw new Error(`Gmail ${r.status}`);
  return r.json() as Promise<T>;
}

/** Mail worth a look: bills, payment requests, bookings, and messages that push for money. */
export const SEARCH =
  'newer_than:45d -in:sent -in:drafts (bill OR invoice OR statement OR "amount due" OR "payment due" OR "past due" ' +
  'OR estimate OR quote OR "new account" OR "bank details" OR "wire" OR "gift card" OR booking OR reservation ' +
  'OR appointment OR confirmation OR itinerary OR "check-in")';

export interface MailItem {
  id: string;
  from: string; // sender display name only, email address removed
  subject: string; // masked
  date: string; // ISO
  text: string; // masked plain text, at most 4,000 characters
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}
interface GmailMessage {
  id: string;
  internalDate: string;
  payload: GmailPart & { headers?: Array<{ name: string; value: string }> };
}

function decode(data: string): string {
  const b = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0)));
}

function textOf(part: GmailPart): string {
  if (part.mimeType === 'text/plain' && part.body?.data) return decode(part.body.data);
  if (part.parts) {
    const plain = part.parts.map(textOf).find((t) => t.trim());
    if (plain) return plain;
  }
  if (part.mimeType === 'text/html' && part.body?.data) {
    const html = decode(part.body.data);
    return new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
  }
  return '';
}

/** Fetch recent candidate messages and mask them before anything else sees them. */
export async function recentMail(max = 15): Promise<MailItem[]> {
  const list = await api<{ messages?: Array<{ id: string }> }>(
    `messages?maxResults=${max}&q=${encodeURIComponent(SEARCH)}`,
  );
  const out: MailItem[] = [];
  for (const { id } of list.messages ?? []) {
    const m = await api<GmailMessage>(`messages/${id}?format=full`);
    const header = (n: string) => m.payload.headers?.find((h) => h.name.toLowerCase() === n)?.value ?? '';
    const fromName = header('from').replace(/<[^>]*>/g, '').replace(/"/g, '').trim();
    out.push({
      id,
      from: maskText(fromName).slice(0, 80),
      subject: maskText(header('subject')).slice(0, 160),
      date: new Date(Number(m.internalDate)).toISOString(),
      text: maskText(textOf(m.payload).replace(/\s+/g, ' ').trim()).slice(0, 4000),
    });
  }
  return out;
}
