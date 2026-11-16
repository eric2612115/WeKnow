// @vitest-environment happy-dom
// Paste and drop on Ask: a picture or a PDF is attached to the question box (exactly like Choose); words, links and
// other files are left alone; nothing is sent.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const taken = vi.hoisted(() => ({ chooseFile: vi.fn(async () => true) }));
vi.mock('../../samples', () => ({
  canTake: (f: { type?: string; name?: string }) => !!f.type?.startsWith('image/') || f.type === 'application/pdf',
  chooseFile: taken.chooseFile,
}));
vi.mock('../../engine/device', () => ({ deviceWord: () => 'computer' }));

const { PaperDrop, fileFrom, carriesFiles, onPaste } = await import('../PaperDrop');

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const png = new File(['png'], 'screenshot.png', { type: 'image/png' });
const pdf = new File(['%PDF'], 'bill.pdf', { type: 'application/pdf' });
const doc = new File(['x'], 'notes.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
const carrier = (files: File[], types = files.length ? ['Files'] : ['text/plain']) => ({
  files: files as unknown as FileList,
  items: files.map((f) => ({ kind: 'file', type: f.type, getAsFile: () => f })) as unknown as DataTransferItemList,
  types,
});

describe('what a paste or a drop carries', () => {
  it('takes the first picture or PDF', () => {
    expect(fileFrom(carrier([png]))).toBe(png);
    expect(fileFrom(carrier([doc, pdf]))).toBe(pdf);
    expect(fileFrom(carrier([]))).toBeNull();
    expect(fileFrom(carrier([doc]))).toBeNull();
  });

  it('finds a screenshot that is only in the items', () => {
    const only = { files: [] as unknown as FileList, items: [{ kind: 'file', type: 'image/png', getAsFile: () => png }] as unknown as DataTransferItemList, types: ['Files'] };
    expect(fileFrom(only)).toBe(png);
  });

  it('a drag of words or a link is not a drag of files', () => {
    expect(carriesFiles(carrier([png]))).toBe(true);
    expect(carriesFiles(carrier([], ['text/plain', 'text/uri-list']))).toBe(false);
  });
});

describe('paste', () => {
  it('a pasted screenshot is attached, and the paste is not also put in the words', () => {
    const e = { clipboardData: carrier([png]), preventDefault: vi.fn() } as unknown as ClipboardEvent;
    expect(onPaste(e)).toBe(true);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(taken.chooseFile).toHaveBeenCalledWith(png);
  });

  it('pasted words are left to the question box', () => {
    const e = { clipboardData: carrier([]), preventDefault: vi.fn() } as unknown as ClipboardEvent;
    expect(onPaste(e)).toBe(false);
    expect(e.preventDefault).not.toHaveBeenCalled();
    expect(taken.chooseFile).not.toHaveBeenCalled();
  });

  it('a paste anywhere on the page reaches it (a real ClipboardEvent on the window)', () => {
    render(<PaperDrop />);
    const e = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
    Object.defineProperty(e, 'clipboardData', { value: carrier([pdf]) });
    act(() => {
      document.body.dispatchEvent(e);
    });
    expect(taken.chooseFile).toHaveBeenCalledWith(pdf);
    expect(e.defaultPrevented).toBe(true);
  });
});

describe('drag and drop', () => {
  it('shows the drop overlay while files are over the page, and attaches the dropped PDF', () => {
    render(<PaperDrop />);
    expect(screen.queryByTestId('paper-drop')).toBeNull();
    fireEvent.dragEnter(window, { dataTransfer: carrier([pdf]) });
    expect(screen.getByTestId('paper-drop').textContent).toContain('Drop it here');
    expect(screen.getByTestId('paper-drop').textContent).toContain('It stays on this computer until you press Send.');
    fireEvent.drop(window, { dataTransfer: carrier([pdf]) });
    expect(screen.queryByTestId('paper-drop')).toBeNull();
    expect(taken.chooseFile).toHaveBeenCalledWith(pdf);
  });

  it('leaving the page hides the overlay; dragging words never shows it', () => {
    render(<PaperDrop />);
    fireEvent.dragEnter(window, { dataTransfer: carrier([], ['text/plain']) });
    expect(screen.queryByTestId('paper-drop')).toBeNull();
    fireEvent.dragEnter(window, { dataTransfer: carrier([png]) });
    fireEvent.dragLeave(window, { dataTransfer: carrier([png]) });
    expect(screen.queryByTestId('paper-drop')).toBeNull();
    expect(taken.chooseFile).not.toHaveBeenCalled();
  });

  it('a dropped file of another kind is handed on, to be said it cannot be read', () => {
    render(<PaperDrop />);
    fireEvent.drop(window, { dataTransfer: carrier([doc]) });
    expect(taken.chooseFile).toHaveBeenCalledWith(doc);
  });
});
