# Gemini Nano in Chrome on a Windows PC (2026-11-24)

WeKnow's web app run on a real Windows PC, with Chrome's built-in Gemini Nano reading every paper on the device through
Firebase AI Logic (`InferenceMode.ONLY_ON_DEVICE`). The run was driven by Claude Code on that PC, in five rounds, each
reported in full on [issue #1](https://github.com/eric2612115/WeKnow/issues/1), with screenshots in
[pull request #2](https://github.com/eric2612115/WeKnow/pull/2) (`docs/eval/nano-windows/`). The table below is the
final round, on build `e18847b` (live at https://weknow-6092f.web.app/app).

**Machine:** Windows 11, Chrome 158.0.8127.89, NVIDIA GeForce RTX 3070 Ti 8 GB, 32 GB RAM. `LanguageModel.availability()`
was `available` for text and image input.

**How requests were counted:** every request to a cloud model goes to `firebasevertexai.googleapis.com`; an in-page hook
kept each request body, so what went online is quoted exactly below. Papers are the fictional test sheets in
[`docs/test-sheets/`](../test-sheets/).

## Papers

| # | Paper | Given as | Answer | Read on the device | Requests to a cloud model | What went online |
|---|---|---|---|---|---|---|
| 1 | bill-2 (new company) | PDF, dragged in | Check this bill before you pay (no note of this company); 1 printed sum checked, holds | 2.9 s | 0 | nothing |
| 2 | bill-2 again, after "Remember this company" | PDF | This bill looks normal | 2.9 s | 0 | nothing |
| 3 | bill-3 (new account buried) | PDF | Don't pay this bill yet: new account ending 7730, paid at 4821 before, rushes you | 2.9 s | 0 | nothing |
| 4 | bill-4 (words aimed at an AI) | PDF, file picker | Don't pay this bill yet: hidden words that tell a reader it is safe | 2.4–2.9 s | 2 (one company check, sent twice when the first answer had no web sources) | `Who asks to be paid: Millbrook Valley Water District` / the names of three charges |
| 5 | bill-7 (sums that do not hold) | PNG, pasted | Don't pay this bill yet: $1,050.00 plus $21.00 tax is $1,071.00, but the total says $1,091.00; charges like these are a known scam (web sources) | 6.9 s | 1 company check | `Who asks to be paid: Palisade Sovereign Reserve Trust` / the names of three charges / the sentence that asks for the fee |
| 6 | quote-1 (ten lines) | PNG, dragged in | Line 4 is $185 more than usual (serpentine belt $385, usual top $200); eight lines fair | 12.5 s | 1 price lookup | `“Fuel induction cleaning service” price` and the region |

No request body in any round held a person's name, address, phone number or account number.

**The same paper gives the same answer.** Paper 6 was run three times in new conversations: the bold line, all ten line
names and amounts, every result, the tag and the one lookup were identical. Paper 3 was identical in three runs as well.
Chrome does not let a web page fix Gemini Nano's sampling, so WeKnow does not leave to it what plain code can read: a
quote that numbers its lines gives them, with their names and totals, from its printed words; a line that names a
price-book item in full is matched by plain code; the printed sums and the account to pay are plain-code checks.

## From a clean start (rounds 6 and 7, build `95f2419`)

After Delete my data, with nothing remembered and the internet question not yet answered:

- Paper 6 asks the one-time internet question for the line the price book lacks, right after the answer, and looks it
  up only after Yes.
- Paper 1 three times: the same answer each time (no note of this company), nothing sent.
- Papers 3 and 4 twice each: the same warnings each time. A warning Gemini Nano raises counts only when the paper prints
  words for it (pressure such as "within 24 hours", a new account or bank, words aimed at an AI); with every model flag
  forced on, each test bill still gets exactly its own warnings.
- With the internet setting on Never, and with the connection cut inside the page, papers 3 and 6 are answered on the
  computer; a question that needs the web says so and asks to be asked again when the connection is back.

## Typed questions

| Question | Answer | Requests |
|---|---|---|
| My kitchen sink is clogged | the pack's guide, on this computer | 0 |
| How much are brake pads? | $148 to $394, from the price book | 0 |
| how much is an altenrator replacement | the alternator price, misspelling and all | 0 |
| My vacuum won't pick anything up | not in the pack: a how-to from 4 web sources | 2 (pick from the pack index, web search) |
| My name is Pat Kim. I live at 12 Oak Lane. My vacuum won't pick anything up. | the same how-to | 2; both bodies hold only `My vacuum won't pick anything up.` and the pack's item names |

## Explain in my language

After paper 3, Spanish was written by Gemini Nano on the PC (0 requests): the answer sentence by sentence, with the
account endings 7730 and 4821, nothing added. Traditional Chinese, which Nano does not write, asked first and then sent
only WeKnow's covered answer.
