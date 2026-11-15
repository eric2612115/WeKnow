// The read-only email connection (gmail.ts), as app state. The access token lives in memory only, for this visit.

import type { MailItem } from '../gmail';
import { createStore, useStore } from '../store/store';
import { t } from '../strings';

interface MailState {
  connected: boolean;
  items: MailItem[] | null;
  loading: boolean;
  error: string | null;
}

const store = createStore<MailState>({ connected: false, items: null, loading: false, error: null });
export const useMail = () => useStore(store);
const patch = (p: Partial<MailState>) => store.set((s) => ({ ...s, ...p }));

export const mailState = {
  async connect(): Promise<boolean> {
    patch({ error: null });
    try {
      const m = await import('../gmail');
      const ok = await m.connectGmail();
      patch({ connected: ok && m.gmailConnected() });
      return ok;
    } catch (e) {
      console.warn('[WeKnow] email connect', e);
      patch({ connected: false, error: t('read.fail.title') });
      return false;
    }
  },
  async disconnect() {
    const m = await import('../gmail');
    m.disconnectGmail();
    patch({ connected: false, items: null, error: null });
  },
  async load() {
    patch({ loading: true, error: null });
    try {
      const m = await import('../gmail');
      if (!m.gmailConnected()) {
        patch({ connected: false, loading: false, items: null });
        return;
      }
      patch({ items: await m.recentMail(15), loading: false });
    } catch (e) {
      console.warn('[WeKnow] email read', e);
      const m = await import('../gmail');
      patch({ loading: false, connected: m.gmailConnected(), error: t('mail.expired') });
    }
  },
};
