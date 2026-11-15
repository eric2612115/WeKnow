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
| C8 | On 50 labelled fictional quotes and bills, the cloud reader (gemini-3.5-flash-lite, free tier) got every line verdict and every bill warning right and leaked no planted name. Median 19.8 s per photo on the free tier. | `docs/eval/cloud-2026-11-16.json` from `web/src/eval.ts` over `web/fixtures/eval/truth.json` | VERIFIED (50/50, synthetic set) |
| C9 | On-device reading on Chrome's Gemini Nano. | not yet run: the development Mac lacks the disk space Nano needs | UNVERIFIED |
| C10 | Voice in and out run on the device in Chrome. | `web/src/voice.ts`; not yet run in a Chrome with a microphone | UNVERIFIED |
| C11 | Every pack item can be found on the device: each is in the top 5 for its own name, and all 71 labelled eval quote lines, 44 hand-written shop labels and 30 household problems find a right item in the top 5. | `web/src/core/__tests__/knowledge.test.ts` › "every item is reachable", "recall" | VERIFIED |
| C12 | A question downloads only the parts of the pack it needs: the pack root, a few index shards, then only the data blocks of the items chosen. A quote photo needs about 18 KB over the wire (median), against 78 KB for the whole pack today. | knowledge.test.ts › "a question loads only the levels it needs"; `node scripts/bench-pack.mjs` | VERIFIED |
| C13 | The step where the on-device model picks pack items fits its context window: Chrome's Gemini Nano (about 9,216 tokens) and Apple's on-device model (4,096). | `web/src/core/__tests__/budget.test.ts` | VERIFIED |
| C14 | A new pack version downloads only the files that changed, and the device works offline from the files it already has. | knowledge.test.ts › "a new version downloads only the files that changed", "offline" | VERIFIED |
