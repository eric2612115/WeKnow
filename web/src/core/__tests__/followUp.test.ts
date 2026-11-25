import { describe, expect, it } from 'vitest';
import { aboutTheAnswer, conversationText, keepReply, lineText, planAnswer } from '../followUp';

describe('a follow-up about the conversation', () => {
  const turns = [
    { who: 'me' as const, text: 'My tap drips' },
    { who: 'wk' as const, text: 'Here is how to fix a dripping tap.' },
    { who: 'me' as const, text: 'Should I pay this?', picture: true },
    { who: 'wk' as const, text: 'Don’t pay this bill yet. It asks you to pay a new account ending 7730; you paid them at one ending 4821 before.', tone: 'stop' as const },
  ];

  it('is given the conversation since the paper it is about, oldest first', () => {
    const c = conversationText(turns);
    expect(c.startsWith('Person: Should I pay this? (with a picture of a paper)')).toBe(true);
    expect(c).toContain('WeKnow: Don’t pay this bill yet.');
    expect(c).not.toContain('tap');
  });

  it('keeps a reply that only uses the conversation’s numbers', () => {
    const c = conversationText(turns);
    expect(keepReply(c, 'Why?', 'Because the account changed: you paid one ending 4821, and this one ends 7730.', true)).toBe(true);
  });

  it('drops a reply that brings a number of its own, or clears a warning', () => {
    const c = conversationText(turns);
    expect(keepReply(c, 'Why?', 'Call 1-800-555-0199 to check.', true)).toBe(false);
    expect(keepReply(c, 'Is it ok?', 'It is safe to pay this bill.', true)).toBe(false);
    expect(keepReply(c, 'Is it ok?', 'You can go ahead and pay.', true)).toBe(false);
  });

  it('reads a quote line as words, and knows a question about the answer', () => {
    expect(lineText({ n: 4, label: 'Serpentine belt replacement', amount: 385, state: 'high', over: 185, typical: 147.5, top: 200 })).toBe(
      'Line 4, Serpentine belt replacement: the shop charges $385. Most shops charge about $147.50, at most about $200. That is $185 above the usual top price.',
    );
    expect(aboutTheAnswer('Why is line 4 so high?')).toBe(true);
    expect(aboutTheAnswer('What does that mean?')).toBe(true);
    expect(aboutTheAnswer('How much are brake pads?')).toBe(false);
  });
});

describe('the common follow-ups, answered by plain code', () => {
  const bill =
    'Don’t pay this yet. I covered your name, address and account number. They stay on this phone. One. The account is new. You paid them at one ending 4821 before. Two. It has hidden words that try to tell a reader it is safe. Three. It rushes you to pay. I found it in the middle of the page. Call the company first. Use the number on an older bill.';

  it('why: every reason WeKnow gave', () => {
    const a = planAnswer('Why shouldn’t I pay it?', 'bill', bill)!;
    expect(a[0]).toContain('the account is new');
    expect(a[0]).toContain('it has hidden words');
    expect(a[0]).toContain('it rushes you to pay');
    expect(planAnswer('Why?', 'bill', 'Careful. One. I have no note of paying Millbrook before. Two. It rushes you to pay.')![0]).toBe(
      'Because I have no note of paying Millbrook before; and it rushes you to pay.',
    );
  });

  it('a scam? only the online check says so; otherwise the warning signs', () => {
    const a = planAnswer('Is it a scam?', 'bill', bill)!;
    expect(a[0]).toBe('I can’t say for sure from the paper alone. These are the warning signs I found:');
    expect(a.join(' ')).not.toMatch(/\bis a scam\b/);
    const online = planAnswer('Is it a scam?', 'bill', `${bill} I also checked online: charges like these are a known scam.`)!;
    expect(online[0]).toContain('known scam');
  });

  it('what a warning means', () => {
    expect(planAnswer('What does the new account mean?', 'bill', bill)![0]).toContain('never used with you before');
    expect(planAnswer('What do the hidden words mean?', 'bill', bill)![0]).toContain('written for a computer');
  });

  it('a quote line, the fair lines, and why it is high', () => {
    const items = [
      { n: 1, label: 'Rear brake pads', amount: 540, state: 'high' as const, over: 146, typical: 271, top: 394 },
      { n: 2, label: 'Cabin filter', amount: 45, state: 'fair' as const, typical: 40, top: 70 },
    ];
    expect(planAnswer('What about line 2?', 'quote', 'One price is higher than usual.', items)![0]).toContain('Line 2, Cabin filter: the shop charges $45.');
    expect(planAnswer('Which lines are fine?', 'quote', '', items)![0]).toBe('These lines look fair: line 2, Cabin filter.');
    expect(planAnswer('Why is it so expensive?', 'quote', '', items)![0]).toContain('That is $146 above the usual top price.');
    expect(planAnswer('Can I bring my own parts?', 'quote', '', items)).toBeNull();
  });
});
