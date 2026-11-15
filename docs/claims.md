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
| C7 | Every item in the shipped pack has at least one source. | `scripts/build-pack.mjs` throws on an unsourced item | VERIFIED |
| C8 | On 50 labelled fictional quotes and bills, the cloud reader (gemini-3.5-flash-lite, free tier) got every line verdict and every bill warning right and leaked no planted name. Median 19.8 s per photo on the free tier. | `docs/eval/cloud-2026-11-16.json` from `web/src/eval.ts` over `web/fixtures/eval/truth.json` | VERIFIED (50/50, synthetic set) |
| C9 | On-device reading on Chrome's Gemini Nano. | not yet run: the development Mac lacks the disk space Nano needs | UNVERIFIED |
| C10 | Voice in and out run on the device in Chrome. | `web/src/voice.ts`; not yet run in a Chrome with a microphone | UNVERIFIED |
