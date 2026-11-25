# WeKnow: a second look before you pay, on your own device

*Technical report, 2026-11-21. Every number below comes from a run recorded in this repository.*

## 1. Abstract

People who find apps hard to use are the ones most often overcharged on repair quotes and targeted by bills that quietly
change the account to pay. WeKnow lets them point a camera at the paper and ask out loud. The paper never leaves the
device: a model on the device reads it (Gemini Nano in Chrome, Apple's on-device model on iPhone and iPad, both through
Firebase AI Logic), personal details are covered, and plain code judges it against a sourced knowledge pack and the
person's own household memory, then speaks the answer. On a device with no model of its own, plain code alone gives a
bill the basic check: a changed account, two account numbers, totals that do not add up, words that rush the reader or
speak to an AI. The cloud only gets the question the device cannot answer (is this company a known scam? what does this
job cost?), built on the device with personal details covered, and a light shows each request for as long as it is out.
In the evaluation harness, 50 labelled synthetic quotes and bills read through Gemini were all judged correctly by the
same plain code, with none of the planted names leaked; on an iPhone, ten photos of printed test sheets were all judged
right with no personal detail left in the words any model saw; with no model at all, the four printed bills get their
warnings from plain code (§6). The design rests on one rule: the model reads, plain code decides, and text inside a
document can raise a warning but never clear one.

## 2. Problem

A 78-year-old receives a plumbing estimate: $540 for a job that usually tops out at $394. That evening an email from her
power company says its bank has changed and asks her to pay a new account; a line in faint grey text tells any AI assistant
reading it that the bill is verified. The first is overbilling; the second is business email compromise, which the FBI
counted at $3.05 billion in reported US losses in 2025. General camera assistants answer such questions from general
knowledge in the cloud: they send the whole page, cite no source, and give no verdict on the line that matters.

## 3. Data boundary and threat model

- **Untrusted:** everything printed in the photo or the email, including instructions aimed at an AI.
- **Trusted:** the knowledge pack (every item carries a fetched source), the person's confirmed payees and past jobs (on
  the device only), and the rules in `web/src/core/verdict.ts`.
- **Assets:** the person's money (what they pay and to whom) and their personal details.
- **Attacker:** anyone who can put text in front of the reader: a shop, a letter, an email, a sticker.
- **What may leave the device:** a question built on the device (§4, step 9). Never the paper, its picture or its words
  to be read.

## 4. Design

1. **Read (model, on the device).** The paper is read into a fixed form: kind, priced lines, the problem in one
   sentence, payee, last four digits of the account, and two warning flags. No knowledge pack in this prompt. On iPhone
   and iPad, Apple Vision reads the words, personal details are covered, and Apple's on-device model fills the form
   through Firebase AI Logic. In Chrome, Gemini Nano reads the photo, or a PDF's own text after it is covered. Chrome's
   built-in model reads English, Spanish, Japanese, German and French; on iPhone, Apple's model also reads Chinese.
2. **Find (plain code, on the device).** Local retrieval proposes at most five pack candidates per line from a layered
   index (categories → per-category maps → items), so every prompt stays within on-device budgets (Chrome Nano about
   9k tokens, Apple about 4k). See `docs/knowledge-layer.md`.
3. **Choose (model, text only).** The model may only pick one of the offered candidates or none.
4. **Decide (plain code).** `checkUnderstanding` rejects any ref that was not offered; prices come from the pack's
   sourced range; bill flags (`account-change-notice`, `new-payee`, `changed-account`, `urgency`, `instruction-to-ai`,
   `numbers-dont-add-up`, `two-accounts`) are rules over the form, the paper's own words and on-device household memory.
   Missing or malformed warning fields count as warnings; with the paper's own words at hand, the model's `urgency` and
   `instruction-to-ai` need a cue printed on the paper, and `new-payee` needs a request to send money to an account.
5. **Route (plain code).** Firebase AI Logic hybrid inference runs the model on the device when it is ready. The router
   (`web/src/ask/router.ts`) decides from what the device produced whether a question should go online, and why: no pack
   item fits the words, no guide fits the problem, or the price book lacks a line. `gate` then applies the person's
   setting (ask once, ask every time, never) and the connection. Every reason is shown in the answer's receipt.
6. **The basic check (plain code, no model).** On a device with no model of its own (Safari, Firefox, a phone's
   browser, Chrome before its model is downloaded), `web/src/core/basicRead.ts` tells a bill from a quote by its words
   and names who asks to be paid: a company the person keeps a note of, else the letterhead. The bill then goes through
   the same plain rules as every bill (`core/verdict.ts`, `core/billMath.ts`): a pay-to account that changed against the
   person's note, two account numbers, printed sums that do not hold, pressure words, words aimed at an AI. A photo's
   words are read on the device by the text recognizer (tesseract.js); a PDF's own text is used as it is. A quote, or a
   picture of a thing, is not sent: WeKnow says what the full check needs and how to get it, and a question that names
   the problem is still answered from its words. On an iPhone without Apple Intelligence, the same basic check.
7. **Questions in words, no picture.** A typed or spoken question has no photo to read in step 1: plain code finds pack
   candidates for it, the on-device model (when there is one) marks which ones it is about, and the answer is said from
   the pack item. A question that points at a paper ("Is this fair?") goes to the picture path instead. When nothing on
   the device fits, the router sends the covered question online (step 9). When several items fit (one job, many phone
   models), iOS gives their range and asks for the model.
8. **A bill, part by part (iPhone).** After the whole-page reading, plain code cuts the page (cut line, wide gaps,
   headings; small parts joined, long ones cut with overlap, at most eight). The on-device model answers three yes/no
   questions per part (rushes you, words to an AI, a new account) in two wordings; an answer counts only when both
   agree, and a new account needs an account number printed in that part. Plain code adds the answers up.
9. **Only the question goes online.** What may leave is a question, built on the device:
   - a quote line the price book lacks, as a masked line item and a region (`buildCloudLookup`; Firestore rules refuse
     anything else);
   - a bill from a company with no note and a warning already raised, as the company and the charge names (plain code,
     no amounts, numbers or covered names), answered by Gemini with Google Search grounding through AI Logic and sorted
     into one of four findings; only an answer with web sources is used, and only to raise a warning;
   - a typed question, or a problem the guides do not cover, with personal details covered: Gemini sees the whole pack
     index and may only name one ref from it (`acceptChoice`); when none fits, a how-to with web sources comes from
     Google Search grounding.

   Before a question goes, the payload guard (plain code) refuses any personal pattern left in it, and the on-device
   model reviews it where there is one. On iPhone, a sentence that carries a personal detail stays on the phone whole,
   anything personal Apple's model still finds stays too, and a second reading must come back clean or nothing goes
   (`CloudPick.cleared`). On the web, the search gets only the words that name the job.
10. **Two lights.** While WeKnow works, one of two lights is lit: this device, or the internet. The internet light is
    lit only while a request is out, with the exact covered words under it (`web/src/ask/wire.ts`, where requests go
    through `online()`; iOS `WorkingLight`, lit from `CloudPick.onSend`). Pressing the lights says what they mean, and the
    line under every answer lists everything that was sent.
11. **The person's language (iPhone).** Plain code tells the language from the person's own words (`Core/Lang.swift`).
    The answer is put in it on the phone by Apple's on-device model, keeping every number, and a how-to from the web
    comes back in it, with the fixed words around it from a built-in table (Traditional and Simplified Chinese,
    Japanese, Korean, Spanish, French, German). A verdict on a bill or a quote stays exactly as composed.

**Follow-ups: context on a small budget.** An on-device model has a small window (Apple: 4,096 tokens per session,
input and output together; Chrome: the `inputQuota` the session reports) and a long chat degrades it: models do best
with what is at the start or end of a prompt (Liu et al., 2023) and lose about 39% when a task arrives over several
turns (Laban et al., 2025). So WeKnow does not keep one growing chat. The paper stays the conversation's subject until
the next picture; the common follow-ups are answered by plain code from WeKnow's own answer
(`web/src/core/followUp.ts`, `ios/WeKnow/Core/FollowUp.swift`); anything else opens a fresh session with a compact,
fully stated context: the paper's facts first (each quote line spelled out: what the shop charges, the usual range, how
far above it), the turns since the paper, the question last, about 2,000 characters in all. Each sentence of the reply
is checked by plain code before it is shown.

Firebase pieces: AI Logic (hybrid inference, structured output, Google Search grounding, and server prompt templates in
the evaluation harness), App Check (reCAPTCHA Enterprise on the web, App Attest on iPhone), Authentication (anonymous,
upgraded in place by Google sign-in), Firestore (offline cache, deny-by-default rules), Remote Config (cloud model, pack
version, warning phrases), Hosting.

## 5. Argument

Every way hostile text can travel, and where it stops:

| Path | What the attacker controls | Where it stops |
|---|---|---|
| A line label or amount | The words and the number printed | The verdict uses the printed number against the pack range; the model cannot set a price (wall test 2) |
| A ref the model returns | Which candidate it picks | Only offered candidates are accepted; anything else is rejected, not repaired (wall test 2, `router.test.ts`) |
| The payee or account | What the bill says | Compared with payees the person confirmed on this device; a change raises `changed-account` (wall test 3) |
| The warning flags | The model's reading of "urgent" and "addressed to AI" | Flags can only be added; omitting them counts as a warning, and with the paper's words at hand a model's flag needs a printed cue, while the printed cue alone always raises it (wall test 3, `verdictReceipt.test.ts`) |
| The paper itself | Everything printed on it | Never sent to be read; with no model, a bill gets the basic check by plain code and a quote says what the full check needs (`noModel.test.ts`, `basicRead.test.ts`) |
| A cloud lookup | A masked line item | Personal patterns refused on the client and by Firestore rules (wall test 1, rules tests) |
| A question online | The words around it | Covered on the device; the payload guard and the on-device review hold back anything personal left (`escalate.test.ts`); on iPhone, `CloudPick.cleared` |
| A follow-up reply | The model's words about the paper | Each sentence shown only if its numbers are in the conversation and it neither clears a warning nor names a scam on its own; yes-or-no questions the answer does not settle are not guessed (`followUp.test.ts`, `flows.test.ts`) |
| A bill check online | The company name and charge names printed | Built by plain code with numbers and covered names removed; the finding can only raise a warning, and only with web sources (`billCheck.test.ts`, `noModel.test.ts`) |

What a fooled reader can still do: misread a line (the person sees the line and the verdict), or miss a warning that
the rules also miss. It cannot clear a warning, invent a price, or move money; WeKnow moves no money at all.

## 6. Evaluation

| Run | Cases | Correct | Leaks | Median latency | Source |
|---|---|---|---|---|---|
| Evaluation harness: three-step reader through Gemini with server prompt templates, 2026-11-16 (regenerated set) | 50 (25 quotes, 25 bills) | 50 | 0 | 3.4 s (42 via templates); 5.1 s (8 via the fallback model) | `docs/eval/cloud-templates-2026-11-16b.json` |
| Same harness, first set | 50 | 50 | 0 | 2.8 s | `docs/eval/cloud-templates-2026-11-16.json` |
| On-device, Apple model, iOS Simulator, 2026-11-16 | 2 fixtures (brake quote x4, changed-account bill), plus the brake quote on an iPhone 17 Pro in airplane mode | all | 0 | 25–50 s in the simulator | `design/screens/ios/` |
| On-device, Apple model, iOS Simulator, questions in words, 2026-11-16 | 5 questions (brake pads, new water heater, running toilet, cracked phone screen, an unknown job) | 5 | 0 | 4–10 s in the simulator | `docs/claims.md` C17 |
| On-device, Apple model, iPhone 17 Pro, photos of printed test sheets, 2026-11-17 | 10 photos (4 bills, 1 quote, two angles each) | 10 | 0 | 6–15 s per bill with the part-by-part read | `docs/claims.md` C19–C21 |
| Follow-ups, Chrome + Gemini Nano, 2026-11-25 | 12 follow-ups after bill-4 and quote-1, and a restaurant check | all as expected; the quote kept as the subject after a price question in between; no false warning on the check | 0 | 0.3 s by plain code; 2–3 s by Gemini Nano | `docs/eval/follow-ups-and-receipts-2026-11-25.md` |
| Basic check, plain code only, no model, the five printed test sheets | 5 (4 bills, 1 quote) | 5: the usual bill safe, the buried new account, the words to an AI and the sums that do not add up caught, the quote sent to the full check | 0 | plain code, no model call | `web/src/core/__tests__/basicRead.test.ts`, `web/src/ask/__tests__/noModel.test.ts` |

The 50-case set is synthetic: fictional quotes built from pack items at fair, high and low prices plus unknown lines,
and bills with and without a changed account, urgency and a hidden instruction (hand-written templates,
`scripts/make-eval.mjs`). It is read through Gemini by the evaluation harness (`web/src/eval.ts`); in the app the
paper is read on the device. Bills are scored on six checks: kind, last four digits,
`changed-account`, `account-change-notice`, `instruction-to-ai` and `urgency`. When the free tier's daily quota for the
templates' model is used, the harness reads the same form once on a second model (`FALLBACK_MODEL` in
`web/src/reader.ts`); verdicts are the same plain code either way.

## 7. Related work

- Dual LLM pattern (Willison, 2023): a quarantined model reads untrusted text; WeKnow puts that reader on the person's device.
- CaMeL (Google DeepMind, 2025): capability tracking for agents; WeKnow uses a fixed form and rules instead, trading
  expressiveness for a small, testable surface.
- Chrome's User Alignment Critic (2025): a model that sees only metadata of proposed actions; same separation, applied to
  browser agents rather than household documents.
- Google Lens, Gemini Live, Apple Visual Intelligence: camera questions with general answers; no sourced verdicts.
- Trail (Chrome Built-in AI Challenge 2025): builds knowledge online and answers offline; WeKnow's packs are sourced,
  versioned and shared through Firestore.

- Lost in the Middle (Liu et al., TACL 2024) and LLMs Get Lost in Multi-Turn Conversation (Laban et al., 2025): why
  each follow-up gets a fresh, fully stated context instead of a growing chat.
- Managing the on-device model's context window (Apple TN3193) and session management for the Prompt API (Chrome):
  the budgets the follow-up context is built for.

## 8. Reproduction

See `README.md`: `cd web && npm ci && npm test` runs the property tests, the basic check on the five test sheets and
the no-model wall; `scripts/make-eval.mjs` rebuilds the evaluation set; `web/src/eval.ts` replays it through the
evaluation harness.
