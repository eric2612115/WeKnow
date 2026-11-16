// Which drawer or sheet is open. One sheet at a time, as in the design: opening one closes the other.

import type { Receipt } from '../answer/types';
import { createStore, useStore } from '../store/store';

export type SheetState =
  | { type: 'receipt'; r?: Receipt; picture?: string | null }
  | { type: 'check'; checkId: string }
  | { type: 'move'; checkId: string; back?: 'check' }
  | { type: 'name'; mode: 'new' | 'rename' | 'newmove'; projectId?: string; checkId?: string }
  | { type: 'confirm'; title: string; body: string; yes: string; onYes: () => void }
  | { type: 'samples' }
  | { type: 'reminder'; title: string }
  | { type: 'setup' }
  | { type: 'edit'; memId: string }
  | { type: 'trusted' }
  | {
      type: 'explain';
      key: string;
      kind: string;
      verdict: string;
      sentences: string[];
      picture?: Blob;
      pictureUrl?: string;
      /** `picture` is the copy with personal details covered (the one the cloud reading was sent). */
      pictureCovered?: boolean;
      /** The picture already went over the internet for this answer (with a yes). */
      sentToCloud: boolean;
    };

export const uiStore = createStore<{ drawer: boolean; sheet: SheetState | null }>({ drawer: false, sheet: null });
export const useUi = () => useStore(uiStore);

export function openSheet(sheet: SheetState) {
  uiStore.set({ drawer: false, sheet });
}
export function closeSheet() {
  uiStore.set((s) => ({ ...s, sheet: null }));
}
export function setDrawer(open: boolean) {
  uiStore.set((s) => ({ drawer: open, sheet: open ? null : s.sheet }));
}
