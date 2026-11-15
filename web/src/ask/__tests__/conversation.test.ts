import { beforeEach, describe, expect, it, vi } from 'vitest';

// Speech is instant here; the conversation logic is what is under test.
vi.mock('../../engine/speech', () => ({
  sayAloud: () => Promise.resolve(),
  quiet: () => undefined,
  listenForQuestion: async () => ({ stop() {}, done: Promise.resolve('') }),
  matchWord: () => null,
}));
vi.mock('../../engine/camera', () => ({ permission: async () => 'prompt' }));

const C = await import('../conversation');

describe('the conversation on the Ask page', () => {
  beforeEach(() => C.resetView());

  it('says sentences as captions and waits for a press', async () => {
    let picked = '';
    const done = C.run(async (t) => {
      await C.say(t, 'One line is high.');
      picked = await C.choice(t, [
        { value: 'yes', label: 'Yes, tell me' },
        { value: 'no', label: 'No thanks' },
      ]);
    });
    await vi.waitFor(() => expect(C.view().choices?.options).toHaveLength(2));
    expect(C.view().lines.map((l) => l.text)).toEqual(['One line is high.']);
    expect(C.view().phase).toBe('waiting');
    C.pick('yes');
    await done;
    expect(picked).toBe('yes');
    expect(C.view().choices).toBeNull();
  });

  it('Stop ends the script but keeps what is on screen', async () => {
    let reached = false;
    const done = C.run(async (t) => {
      C.setHead('warn', 'One line is high');
      await C.say(t, 'Line 1 is $146 high.');
      await C.choice(t, [{ value: 'a', label: 'A' }]);
      reached = true;
    });
    await vi.waitFor(() => expect(C.view().choices).not.toBeNull());
    C.hush();
    await done;
    expect(reached).toBe(false);
    expect(C.view().head?.text).toBe('One line is high');
    expect(C.view().lines).toHaveLength(1);
  });

  it('an asking sheet resolves only from its two answers', async () => {
    let yes: boolean | null = null;
    const done = C.run(async (t) => {
      yes = await C.ask(t, { kind: 'net', title: 'May I look up one thing on the internet?', parcel: ['“Brake fluid flush” price', 'Region: US'], not: [], yes: 'Yes', no: 'No' }, []);
    });
    await vi.waitFor(() => expect(C.view().sheet?.parcel).toEqual(['“Brake fluid flush” price', 'Region: US']));
    C.answerSheet(false);
    await done;
    expect(yes).toBe(false);
    expect(C.view().sheet).toBeNull();
  });

  it('a new run stops the old one', async () => {
    const order: string[] = [];
    const first = C.run(async (t) => {
      await C.choice(t, [{ value: 'x', label: 'X' }]);
      order.push('first');
    });
    await vi.waitFor(() => expect(C.view().choices).not.toBeNull());
    const second = C.run(async (t) => {
      await C.say(t, 'New question.');
      order.push('second');
    });
    await Promise.all([first, second]);
    expect(order).toEqual(['second']);
  });
});
