// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../engine/speech', () => ({
  sayAloud: () => Promise.resolve(),
  quiet: () => undefined,
  listenForQuestion: async () => ({ stop() {}, done: Promise.resolve('') }),
  matchWord: () => null,
}));
vi.mock('../../engine/camera', () => ({ permission: async () => 'prompt', useCamera: () => ({ state: 'live', stream: null }) }));
const flows = vi.hoisted(() => ({ send: vi.fn((text: string) => text !== '\u0000'), dictate: vi.fn(), takePicture: vi.fn() }));
vi.mock('../../ask/flows', () => flows);

const C = await import('../../ask/conversation');
const B = await import('../../ask/box');
const { Composer, pressRight } = await import('../Composer');

afterEach(() => {
  cleanup();
  C.resetView();
  C.detach();
  B.setBox('');
  vi.clearAllMocks();
});

const right = () => document.querySelector('.cbtn-go') as HTMLButtonElement;

describe('the question box', () => {
  it('is the microphone when empty, and the microphone only fills the words (it never sends)', () => {
    render(<Composer />);
    expect(right().getAttribute('aria-label')).toBe('Say your question');
    fireEvent.click(right());
    expect(flows.dictate).toHaveBeenCalledOnce();
    expect(flows.send).not.toHaveBeenCalled();
  });

  it('sends typed words with Enter and empties the box; Shift+Enter does not send', () => {
    render(<Composer />);
    const field = screen.getByLabelText('Your question') as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: 'My kitchen sink is clogged' } });
    expect(right().getAttribute('aria-label')).toBe('Send');
    fireEvent.keyDown(field, { key: 'Enter', shiftKey: true });
    expect(flows.send).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(flows.send).toHaveBeenCalledWith('My kitchen sink is clogged');
    expect(B.boxText()).toBe('');
  });

  it('keeps the words when nothing was sent (words that need a picture, with none attached)', () => {
    flows.send.mockReturnValueOnce(false);
    render(<Composer />);
    fireEvent.change(screen.getByLabelText('Your question'), { target: { value: 'Is this fair?' } });
    fireEvent.click(right());
    expect(B.boxText()).toBe('Is this fair?');
  });

  it('shows an attached picture as a chip with an x; Send is offered with the picture alone', () => {
    render(<Composer />);
    act(() => C.attach(new Blob(['x'], { type: 'image/png' })));
    expect(screen.getByText('Picture added')).toBeTruthy();
    expect(right().getAttribute('aria-label')).toBe('Send');
    fireEvent.click(right());
    expect(flows.send).toHaveBeenCalledWith('');
    fireEvent.click(screen.getByLabelText('Remove the picture'));
    expect(C.view().chosen).toBeNull();
    expect(screen.queryByText('Picture added')).toBeNull();
  });

  it('the camera button only takes a picture (the flows attach it); it never sends', () => {
    render(<Composer />);
    fireEvent.click(screen.getByLabelText('Take a picture'));
    expect(flows.takePicture).toHaveBeenCalledOnce();
    expect(flows.send).not.toHaveBeenCalled();
  });

  it('while listening: the heard words follow the typed ones, the box is read-only, the button finishes', () => {
    B.setBox('My water bill');
    render(<Composer />);
    act(() => C.patch({ phase: 'listening', heard: 'is too high' }));
    const field = screen.getByLabelText('Your question') as HTMLTextAreaElement;
    expect(field.value).toBe('My water bill is too high');
    expect(field.readOnly).toBe(true);
    expect(right().getAttribute('aria-label')).toBe('Finished talking');
  });

  it('is Stop while WeKnow looks or speaks, and Stop while an answer is read out', () => {
    render(<Composer />);
    act(() => C.patch({ phase: 'looking' }));
    expect(right().getAttribute('aria-label')).toBe('Stop');
    act(() => C.patch({ phase: 'settled', talking: true }));
    expect(right().getAttribute('aria-label')).toBe('Stop');
    act(() => pressRight());
    expect(C.view().talking).toBe(false);
    expect(right().getAttribute('aria-label')).toBe('Say your question');
  });
});
