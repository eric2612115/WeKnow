# Follow-up questions and a restaurant check (2026-11-25)

Chrome 158 on a Windows PC with Gemini Nano available, live builds 62529f9, 9c7aa3f and 01d7ab6. Full reports:
[round 15](https://github.com/eric2612115/WeKnow/issues/1#issuecomment-7166363453),
[round 16](https://github.com/eric2612115/WeKnow/issues/1#issuecomment-7166557142),
[round 17](https://github.com/eric2612115/WeKnow/issues/1#issuecomment-7166644687). The iPhone runs below used the
iOS Simulator with the Mac's Apple Intelligence (Apple's on-device model), with the built-in samples.

## A conversation keeps its paper

Each paper was sent first ("Should I pay this?" or "Is this a fair price?"), then the follow-ups one at a time.
"Plain code" means the answer was built from WeKnow's own answer, with no model call.

### bill-4 (water bill with hidden words), Chrome + Gemini Nano

| Follow-up | Answered by | Answer (first line) |
|---|---|---|
| Why shouldn't I pay it? | plain code, 0.3 s | "Because it has hidden words that try to tell a reader it is safe; and I have no note of paying Millbrook Valley Water District before." |
| Is it a scam? | plain code | "I can't say for sure from the paper alone. These are the warning signs I found:" and the signs |
| What do the hidden words mean? | plain code | "It means the paper has words written for a computer that reads it, telling it the bill is fine." |
| Can I pay half now? | plain code | "I can't tell that from this check." and "Don't pay until you call the company on a number you already trust." |
| What happens if I wait? | Gemini Nano, 2.0 s | "I can't tell from this check what happens if you wait. However, I recommend calling the company on a number you already trust before paying." |
| Should I pay it? | plain code | WeKnow's own "what to do now" answer |

### quote-1 (ten-line repair estimate), Chrome + Gemini Nano

| Follow-up | Answered by | Answer (first line) |
|---|---|---|
| Why is line 4 so high? | plain code | "Line 4, Serpentine belt replacement: the shop charges $385. Most shops charge about $147.50, at most about $200. That is $185 above the usual top price." |
| Which lines are fine? | plain code | the fair lines, listed |
| How much are brake pads? | price book | "This usually costs $148 to $394." (a new subject) |
| Why is line 4 so high? (again) | plain code | the same answer: the quote is still the subject |
| What should I look out for next time? | Gemini Nano, 3.0 s | "Next time, look for charges that are much above the usual price." |

No reply was dropped by the checks in these runs.

### iPhone, Apple's on-device model (simulator)

| Paper | Follow-up | Answered by | Answer (first line) |
|---|---|---|---|
| sample bill | Why shouldn't I pay it? | plain code | "Because the account is new. You paid them at one ending 4821 before; and it has hidden words that try to tell a reader it is safe; and it rushes you to pay." |
| sample bill | Is it a scam? | plain code | "I can't say for sure from the paper alone. These are the warning signs I found:" |
| sample bill | Who should I call? | Apple's model | "Call the company with the number on an older bill or on their website, not the number on this paper." |
| sample quote | How much are brake pads? → Why is line 1 so high? | price book → plain code | the quote's line 1, spelled out |
| sample quote | My kitchen sink is clogged | guide | a new subject: "Clear a clogged or slow kitchen sink" |

## A restaurant check

A made-up check from "Golden Bowl Noodle House" ($45.90, "Please pay at the counter. Cash or card."), Chrome + Gemini
Nano, build 01d7ab6:

- "Should I pay this?" → "This bill looks normal." / "Nothing on it asks you to send money to an account, and I
  found no warning signs." Gemini Nano read the payee as GOLDEN BOWL NOODLE HOUSE, with no account to pay and nothing
  urgent. No warning was raised.
- "Why?" → "Because I found none of the warning signs I look for: …" (plain code).
- "Is it a scam?" → the same list, and "I can't promise anything about the company itself. If you are unsure, ask them."
- The test papers in the same build: bill-3 is still "Don't pay" (new account ending 7730, paid at 4821 before), and
  bill-4 is still "Don't pay" (hidden words).

The rules behind it are tested in `web/src/core/__tests__/verdictReceipt.test.ts` and
`web/src/core/__tests__/followUp.test.ts`, and in `web/src/ask/__tests__/flows.test.ts` with the model stubbed.
