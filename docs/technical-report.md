# WeKnow: a second look before you pay, on your own device

*Technical report, draft of 2026-11-16. Every number below comes from a run recorded in this repository; numbers not yet measured are marked TODO.*

## 1. Abstract

People who find apps hard to use are the ones most often overcharged on repair quotes and targeted by bills that quietly
change the account to pay. WeKnow lets them point a camera at the paper and ask out loud; a model reads it, and plain code
judges it against a sourced knowledge pack and the person's own household memory, then speaks the answer. Built on
Firebase AI Logic hybrid inference, the reading happens on the device when a local model is available (Gemini Nano in
Chrome, Apple's on-device model on iOS), so personal details never leave it; elsewhere the cloud reads the photo only after
the person agrees, and says so. On 50 labelled fictional quotes and bills the cloud path judged every line and every
bill warning correctly and leaked none of the planted names (§6); on-device numbers are TODO. The design rests on one rule:
the model reads, plain code decides, and text inside a document can raise a warning but never clear one.

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

## 4. Design

1. **Read (model).** The photo is read into a fixed form: kind, priced lines, the problem in one sentence, payee, last four
   digits of the account, and two warning flags. No knowledge pack in this prompt.
2. **Find (plain code, on the device).** Local retrieval proposes at most five pack candidates per line from a layered
   index (categories → per-category maps → items), so every prompt stays within on-device budgets (Chrome Nano about
   9k tokens, Apple about 4k). See `docs/knowledge-layer.md`.
3. **Choose (model, text only).** The model may only pick one of the offered candidates or none.
4. **Decide (plain code).** `checkUnderstanding` rejects any ref that was not offered; prices come from the pack's
   sourced range; bill flags (`account-change-notice`, `new-payee`, `changed-account`, `urgency`, `instruction-to-ai`) are rules over the form plus
   on-device household memory. Missing or malformed warning fields count as warnings.
5. **Route (explicit).** On-device when Chrome reports the model available; cloud only after consent, labelled on screen.
6. **Leave the device only as a masked line item.** `buildCloudLookup` admits only an item name and a region and refuses
   any personal pattern; Firestore rules refuse anything else.

Firebase pieces: AI Logic (hybrid inference, structured output), App Check (reCAPTCHA Enterprise), Authentication
(anonymous, upgraded in place by Google sign-in), Firestore (offline cache, deny-by-default rules), Remote Config (cloud
model, pack version, warning phrases), Hosting.

## 5. Argument

Every way hostile text can travel, and where it stops:

| Path | What the attacker controls | Where it stops |
|---|---|---|
| A line label or amount | The words and the number printed | The verdict uses the printed number against the pack range; the model cannot set a price (wall test 2) |
| A ref the model returns | Which candidate it picks | Only offered candidates are accepted; anything else is rejected, not repaired (wall test 2) |
| The payee or account | What the bill says | Compared with payees the person confirmed on this device; a change raises `changed-account` (wall test 3) |
| The warning flags | The model's reading of "urgent" and "addressed to AI" | Flags can only be added; omitting them counts as a warning (wall test 3) |
| A cloud lookup | A masked line item | Personal patterns refused on the client and by Firestore rules (wall test 1, rules tests) |

What a fooled reader can still do: misread a line (the person sees the line and the verdict), or miss a warning that
the rules also miss. It cannot clear a warning, invent a price, or move money; WeKnow moves no money at all.

## 6. Evaluation

| Run | Cases | Correct | Leaks | Median latency | Source |
|---|---|---|---|---|---|
| Cloud, three-step reader via server prompt templates, free tier, 2026-11-16 (regenerated set) | 50 (25 quotes, 25 bills) | 50 | 0 | 3.4 s (42 via templates); 5.1 s (8 via the fallback model) | `docs/eval/cloud-templates-2026-11-16b.json` |
| Same reader, first set | 50 | 50 | 0 | 2.8 s | `docs/eval/cloud-templates-2026-11-16.json` |
| On-device, Apple model, iOS Simulator, 2026-11-16 | 2 fixtures (brake quote x4, changed-account bill) | all | 0 | 25–50 s in the simulator | `design/screens/ios/` |
| On-device, Chrome Gemini Nano | TODO | TODO | TODO | TODO | TODO |

The set is synthetic: fictional quotes built from pack items at fair, high and low prices plus unknown lines, and bills
with and without a changed account, urgency and a hidden instruction (hand-written templates, `scripts/make-eval.mjs`).
Bills are scored on six checks: kind, last four digits, `changed-account`, `account-change-notice`, `instruction-to-ai`
and `urgency`. When the free tier's daily quota for the templates' model is used, the reader runs the same form once
on a second model (`FALLBACK_MODEL` in `web/src/reader.ts`); verdicts are the same plain code either way.

## 7. Limitations

- Chrome's on-device model reads English, Spanish, Japanese, German and French only; Chinese works on iOS only.
- Chrome's model needs about 22 GB of free disk and a capable GPU or 16 GB RAM; most judges will see the cloud path.
- On devices without a local model the cloud reads the photo (after consent), so the personal-details guarantee holds
  on the device path only.
- The free cloud tier is slow and does not allow search-grounded lookups; unknown lines are marked "not checked yet".
- The evaluation set is synthetic; real photos (glare, handwriting, folds) are TODO.
- Packs cover US household repairs and bills today; a wrong source would give a wrong range, so every item keeps its source.

## 8. Related work

- Dual LLM pattern (Willison, 2023): a quarantined model reads untrusted text; WeKnow puts that reader on the person's device.
- CaMeL (Google DeepMind, 2025): capability tracking for agents; WeKnow uses a fixed form and rules instead, trading
  expressiveness for a small, testable surface.
- Chrome's User Alignment Critic (2025): a model that sees only metadata of proposed actions; same separation, applied to
  browser agents rather than household documents.
- Google Lens, Gemini Live, Apple Visual Intelligence: camera questions with general answers; no sourced verdicts.
- Trail (Chrome Built-in AI Challenge 2025): builds knowledge online and answers offline; WeKnow's packs are sourced,
  versioned and shared through Firestore.

## 9. Reproduction

See `README.md`: `cd web && npm ci && npm test` runs the property tests; `scripts/make-eval.mjs` rebuilds the evaluation
set; `web/src/eval.ts` replays it against the live reader.
