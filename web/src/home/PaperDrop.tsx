// Giving WeKnow a paper on a computer: paste a screenshot (Ctrl or Cmd+V) or a copied PDF anywhere on Ask, or drag a
// picture or a PDF onto the page (a clear overlay says where it goes). Either way it is attached to the question box,
// exactly like Choose: nothing is sent anywhere until Send, and then only what the normal route decides.

import { useEffect, useState } from 'react';
import { view } from '../ask/conversation';
import { deviceWord } from '../engine/device';
import { canTake, chooseFile } from '../samples';
import { uiStore } from '../ui/uiStore';
import { I } from '../ui/icons';
import { t } from '../strings';

type Carrier = Pick<DataTransfer, 'files' | 'items' | 'types'>;

/** The first picture or PDF in a paste or a drop, or null (plain text, a link, a file of another kind). */
export function fileFrom(dt: Carrier | null | undefined): File | null {
  if (!dt) return null;
  for (const f of Array.from(dt.files ?? [])) if (canTake(f)) return f;
  // Some browsers put a pasted screenshot only in `items`.
  for (const it of Array.from(dt.items ?? [])) {
    if (it.kind !== 'file') continue;
    const f = it.getAsFile();
    if (f && canTake(f)) return f;
  }
  return null;
}

/** Does this drag carry files (not text or a link being moved)? */
export const carriesFiles = (dt: Carrier | null | undefined) => !!dt && Array.from(dt.types ?? []).includes('Files');

/** Busy elsewhere: an open sheet or drawer takes its own pastes and drops. */
const elsewhere = () => {
  const ui = uiStore.get();
  return !!(ui.drawer || ui.sheet || view().sheet || view().viewfinder);
};

/** A paste on Ask: a picture or PDF in it is attached to the box (the words of a paste are left alone). */
export function onPaste(e: ClipboardEvent): boolean {
  if (elsewhere()) return false;
  const f = fileFrom(e.clipboardData);
  if (!f) return false;
  e.preventDefault();
  void chooseFile(f);
  return true;
}

/** A drop on Ask: the first picture or PDF is attached to the box; any other file is said to be one it cannot read. */
export function onDrop(e: DragEvent): boolean {
  if (!carriesFiles(e.dataTransfer)) return false;
  e.preventDefault();
  if (elsewhere()) return false;
  const f = fileFrom(e.dataTransfer);
  const any = e.dataTransfer?.files?.[0];
  if (f) void chooseFile(f);
  else if (any) void chooseFile(any);
  return !!f;
}

/** The listeners, on the whole window while Ask is open, and the overlay while files are dragged over it. */
export function PaperDrop() {
  const [over, setOver] = useState(false);
  useEffect(() => {
    let depth = 0;
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e.dataTransfer) || elsewhere()) return;
      e.preventDefault();
      depth++;
      setOver(true);
    };
    const overIt = (e: DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return;
      // Without this the browser would open the file in the tab instead of giving it to the page.
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = elsewhere() ? 'none' : 'copy';
    };
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e.dataTransfer)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setOver(false);
    };
    const drop = (e: DragEvent) => {
      depth = 0;
      setOver(false);
      onDrop(e);
    };
    const paste = (e: ClipboardEvent) => void onPaste(e);
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', overIt);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    window.addEventListener('paste', paste);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', overIt);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
      window.removeEventListener('paste', paste);
    };
  }, []);
  if (!over) return null;
  return (
    <div className="paper-drop" data-testid="paper-drop" role="status" aria-live="polite">
      <div>
        <I.image />
        <p className="text-xl font-semibold">{t('drop.title')}</p>
        <p className="text-ink-2">{t('drop.line', { device: deviceWord() })}</p>
      </div>
    </div>
  );
}
