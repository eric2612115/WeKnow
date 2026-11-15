# Working on WeKnow

WeKnow: open the camera, ask out loud; the device reads it, masks personal data, and talks you through it.
Entry for the Firebase #BuildHybridAI 2026 hackathon (deadline 2026-11-30 2:00 PM PT). Strategy (Chinese) lives
outside this repo in `../BuildHybridAI-2026/STRATEGY-weknow.md`; design in `design/`.

## Layout
- `web/` — the web app (Vite + React + TypeScript, Firebase JS SDK, Firebase AI Logic hybrid inference).
- `web/src/core/` — the engine, no UI: personal-data masking, the cloud payload guard, knowledge packs,
  the model-output check, plain-code verdicts. `web/src/core/__tests__/wall.test.ts` holds the three
  structural properties every public claim rests on. Never weaken them to make a feature pass.
- `design/` — user flow, UI spec and prototype from the design pass.

## Rules
- The model reads; the program decides. The model may only cite refs it was offered and copy amounts printed
  on the photo. Every number shown to a user comes from a knowledge pack with a source.
- Nothing personal leaves the device: anything sent to the cloud goes through `buildCloudLookup` or an
  explicit, consented cloud-reading path that the UI labels.
- Never ask a cloud model to invent scams or attacks; test attacks are hand-written fixtures.
- Firebase config lives in `web/.env.local` (git-ignored). No production secrets in the repo.
- Ask Eric before every commit and push; this repository is public.
- Code, commits and repository documents are in English. Talk to Eric in Traditional Chinese.
- Public text never judges people; describe users neutrally ("people who find apps hard to use").
