// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../engine/speech', () => ({
  sayAloud: () => Promise.resolve(),
  quiet: () => undefined,
  listenForQuestion: async () => ({ stop() {}, done: Promise.resolve('') }),
  matchWord: () => null,
}));
vi.mock('../../engine/camera', () => ({ permission: async () => 'prompt' }));

const C = await import('../../ask/conversation');
const { AskSheet } = await import('../AskSheet');

afterEach(() => {
  cleanup();
  C.resetView();
});

describe('the asking sheet', () => {
  it('a check online: short points with hidden pills, two closed sections, Yes and No always there', async () => {
    const lines = ['Riverbend Electric Co-op · STATEMENT', '[name] · [account]', '[street], Riverbend, OR', ...Array.from({ length: 30 }, (_, i) => `Line ${i + 4}`)];
    let answer: boolean | null = null;
    const done = C.run(async (t) => {
      answer = await C.ask(
        t,
        { kind: 'net', title: 'Check this bill online?', hidden: { name: 1, phone: 2, email: 1, street: 2, account: 4 }, goes: 'words', parcel: [], lines, not: [], yes: 'Yes, check it', no: 'No' },
        [],
      );
    });
    render(<AskSheet />);
    const pills = await screen.findByTestId('hidden-pills');
    expect([...pills.querySelectorAll('.hid-pill')].map((x) => x.textContent)).toEqual(['1 name', '2 phones', '1 email', '2 addresses', '4 account numbers']);
    expect(screen.getByText('Hidden here:')).toBeTruthy();
    expect(screen.getByText('Only the rest of the words go online.')).toBeTruthy();
    expect(screen.getByText('The picture stays here.')).toBeTruthy();
    // Both sections start closed; the words are inside the second, with their marks.
    expect((screen.getByTestId('fold-hidden') as HTMLDetailsElement).open).toBe(false);
    expect((screen.getByTestId('fold-goes') as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByText('See exactly what goes')).toBeTruthy();
    const parcel = screen.getByTestId('parcel');
    expect(parcel.querySelectorAll('.pline')).toHaveLength(33);
    expect([...parcel.querySelectorAll('.ctoken')].map((x) => x.textContent)).toEqual(['name', 'account', 'address']);
    // No long sentences: nothing but the points, the sections and the buttons.
    expect(screen.queryByText(/I will tell you every time/)).toBeNull();
    fireEvent.click(screen.getByText('Yes, check it'));
    await done;
    expect(answer).toBe(true);
  });

  it('shows exactly what would be sent, and No always works', async () => {
    let answer: boolean | null = null;
    const done = C.run(async (t) => {
      answer = await C.ask(
        t,
        {
          kind: 'net',
          title: 'May I look up one thing on the internet?',
          body: 'This is all I would send:',
          parcel: ['“Brake fluid flush” price', 'Region: US'],
          not: ['Not sent: the picture, your name, phone, address or plate.'],
          yes: 'Yes, look it up',
          no: 'No, skip it',
        },
        [],
      );
    });
    render(<AskSheet />);
    const parcel = await screen.findByTestId('parcel');
    expect(parcel.textContent).toBe('“Brake fluid flush” priceRegion: US');
    expect(screen.queryByText('Close')).toBeNull(); // no Close on an asking sheet
    fireEvent.click(screen.getByText('No, skip it'));
    await done;
    expect(answer).toBe(false);
  });

  it('the remember sheet uses a solid note box, and Yes runs its click action first', async () => {
    const onYesClick = vi.fn();
    const done = C.run(async (t) => {
      await C.ask(t, { kind: 'note', title: 'Shall I remember this shop for next time?', parcel: ['Sunrise Auto Care'], not: [], yes: 'Remember', no: 'No', onYesClick }, []);
    });
    render(<AskSheet />);
    const parcel = await screen.findByTestId('parcel');
    expect(parcel.className).toContain('note');
    fireEvent.click(screen.getByText('Remember'));
    await done;
    expect(onYesClick).toHaveBeenCalledOnce();
  });
});
