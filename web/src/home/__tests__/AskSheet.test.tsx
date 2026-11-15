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
