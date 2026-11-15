# Claims ledger

Every claim WeKnow makes in its README, video or Devpost text, with the test or recording that backs it.
Status: VERIFIED (a test or recorded run in this repo shows it), PARTIAL, or UNVERIFIED (not used in public text).

| # | Claim | Evidence | Status |
|---|---|---|---|
| C1 | Personal details (email, phone, card, account, SSN, VIN, plate, street address) never reach a cloud lookup payload. | `web/src/core/__tests__/wall.test.ts` › "1. personal data never reaches a cloud payload" (property tests, 500 random cases each) | VERIFIED |
| C2 | The model can only cite knowledge-pack items it was offered; an unknown ref is rejected, not repaired. | wall test 2 › "a ref that was not offered is rejected" | VERIFIED |
| C3 | Every price verdict comes from the pack's sourced range, never from the model. | wall test 2 › "extra fields such as a price from the model are ignored" and "the verdict depends only on the printed amount and the pack range" | VERIFIED |
| C4 | Text inside a bill can raise a warning but never clear one, including when the model leaves the warning fields out. | wall test 3 (four tests) | VERIFIED |
| C5 | A learned price without an https source is refused. | wall test 2 › "a learned price without an https source is refused" | VERIFIED |
| C6 | The database accepts only a masked line item plus region from clients; anything else is refused. | `web/rules-test/rules.test.ts` against the Firestore emulator in CI (job `rules`), plus a live probe on 2026-11-16 | VERIFIED |
| C7 | Every item in the shipped pack has at least one https source; refs are unique and every pro ref resolves. | `scripts/build-pack.mjs` refuses to write otherwise; `web/src/core/__tests__/packBuild.test.ts` › "the builder refuses packs that could show an unsourced number" (including a property: removing any item's sources stops the build) and "the shipped pack files are exactly what the builder makes" | VERIFIED |
| C8 | On 50 labelled fictional quotes and bills, the earlier single-call cloud reader (gemini-3.5-flash-lite, free tier) got every line verdict and bill warning right and leaked no planted name; median 19.8 s. | `docs/eval/cloud-2026-11-16.json` | PARTIAL: measured on the earlier reader (before commit 6608551); re-run on the current three-step reader pending |
| C9 | On-device reading on Chrome's Gemini Nano. | not yet run: the development Mac lacks the disk space Nano needs | UNVERIFIED |
| C10 | Voice in and out run on the device in Chrome. | `web/src/voice.ts`; not yet run in a Chrome with a microphone | UNVERIFIED |
| C11 | Every pack item can be found on the device: each is in the top 5 for its own name, and all 71 labelled eval quote lines, 44 hand-written shop labels and 30 household problems find a right item in the top 5. | `web/src/core/__tests__/knowledge.test.ts` › "every item is reachable", "recall" | VERIFIED |
| C12 | A question downloads only the parts of the pack it needs: the pack root, a few index shards, then only the data blocks of the items chosen. A quote photo needs about 20 KB over the wire (median, 19.5 KB), against 78 KB for the whole pack as one file today. | knowledge.test.ts › "a question loads only the levels it needs"; `node scripts/bench-pack.mjs` | VERIFIED |
| C13 | The step where the on-device model picks pack items fits its context window: Chrome's Gemini Nano (about 9,216 tokens) and Apple's on-device model (4,096), counted pessimistically (every digit and symbol a token) and with every reading capped at 30 lines of 120 characters, including the worst case. | `web/src/core/__tests__/budget.test.ts` | VERIFIED |
| C14 | A new pack version downloads only the files that changed, and the device works offline from the files it already has. | knowledge.test.ts › "a new version downloads only the files that changed", "offline" | VERIFIED |
| C15 | A misspelled or partial word finds items at least as well as one whole-pack index (150-case probe: 150, 22 and 75 hits for a typo in the name, the typo alone, and a six-letter prefix, equal to the whole-pack index). | knowledge.test.ts › "typos and partial words" | VERIFIED |
| C16 | A pack file is checked against its content hash every time it is read, from the network or from the device; a copy changed after download is never shown (a cached price edited from 700 to 7000 is re-fetched online and refused offline). | knowledge.test.ts › "integrity and versions" | VERIFIED |
