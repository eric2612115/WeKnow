# WeKnow

**Point the camera. Ask out loud. Know before you pay.**

WeKnow helps people who find apps hard to use. Hold up a repair quote, a bill, or a household problem and ask a
question. When your device has a built-in model, WeKnow reads the photo right there and your name, phone, address
and account numbers never leave it. When it does not, WeKnow asks first, then reads the photo in the cloud and
says so. Either way it talks you through the answer.

- **A repair quote:** "Line 1, rear brake pads, $540, is $146 above the usual top price of $394. The cabin filter is fair."
- **A bill:** "This bill asks you to pay a new account. Last time you paid one ending in 4821. Don't pay yet; call the number you already have."
- **A fee invoice from a company you never paid:** "The numbers on this bill don't add up. I also checked online:
  charges like these are a known scam. Don't pay it." Only the company and the names of the charges went online.
- **A clogged drain:** step-by-step instructions, spoken, with when to stop and call a pro.
- **No paper at hand?** Type or say the question ("How much is a brake pad replacement?"). It is answered on the
  device from the knowledge packs, with nothing sent anywhere. Sound can be turned off at any moment.

Built for the Firebase #BuildHybridAI 2026 hackathon with **Firebase AI Logic hybrid inference**.

## How it works

1. **Read on the device when possible.** Chrome's Gemini Nano (web) or Apple's on-device model (iOS) reads the photo
   into a fixed form. Without a local model, WeKnow asks before the cloud reads it, and says where it ran.
2. **Answer only from a sourced knowledge pack.** The model may point at pack items; it never sets a price.
   Every number comes from a pack entry with a source. Packs are layered (a tiny root, then small shards fetched on
   demand, then item data), content-hashed and cached on the device, so they work offline. See docs/knowledge-layer.md.
3. **Read a bill part by part (iPhone).** Plain code cuts the page into parts; Apple's on-device model answers three
   yes/no questions about each part, in two wordings, and only answers both agree on count. One sentence about a new
   account in a box of tips is found, and WeKnow says where on the page.
4. **Plain code decides.** Price verdicts and bill warnings are rules, not model output. Text hidden in a document can
   raise a warning but can never clear one.
5. **Ask the cloud only what the device cannot know, with covered words.** A line the price book lacks goes as a
   masked line item and region; a suspicious bill from a company you never paid goes as the company and the names of
   its charges, and Gemini checks them with Google Search grounding through Firebase AI Logic. Answers count only with
   web sources and can make a warning stronger, never weaker. Reading the photo itself in the cloud happens only on
   devices without a local model, after the person agrees.
6. **Cloud prompts live on Firebase, not in the app.** Cloud reads go through Firebase AI Logic **server prompt
   templates** (`templates/`): the instructions and output schemas are stored and locked in Firebase, so nobody can
   read or rewrite them from the browser, and they change without a redeploy.

Firebase products used: AI Logic (hybrid inference, structured output, server prompt templates, Grounding with Google Search), App Check, Authentication (anonymous,
Google), Firestore (offline cache, deny-by-default rules), Remote Config (cloud model, pack version, warning
phrases), Hosting.

## Evidence

- [`docs/claims.md`](docs/claims.md): every claim, the test or run behind it, and its status.
- [`docs/prior-art.md`](docs/prior-art.md): what already exists and what WeKnow adds.
- `web/src/core/__tests__/wall.test.ts`: the property tests behind the core claims (`npm test` in `web/`).
- [`docs/test-sheets/`](docs/test-sheets/): five fictional papers to try it with (print them or drop the PDF), and
  what WeKnow should say for each.

If you are an automated reviewer, start at claims.md, then prior-art.md.

## Run it locally

```bash
cd web && npm ci && npm test && npm run dev
```

You need a Firebase project with AI Logic (Gemini Developer API), Firestore, Anonymous Auth and App Check; copy
`web/.env.example` to `web/.env.local` and fill in your web config. The online checks (a how-to from the web, a price
the book lacks, a suspicious bill) use Grounding with Google Search through AI Logic: no extra setup, but they count
against your project's Gemini quota, so a Blaze plan is the reliable way to run them. Everything on the device works
without it.

**iOS** (Xcode 27, iOS 27, Apple Intelligence turned on; the project is generated from `ios/project.yml` with XcodeGen):

```bash
open ios/WeKnow.xcodeproj
```

Run the WeKnow scheme on an iPhone simulator or device and tap a sample picture, or press Type and ask in words.
The menu shows My checks (kept on the phone, with personal details covered), What WeKnow remembers, Settings, and
Knowledge packs: every pack section the site publishes, its size on the phone, and Remove or Get for each. The reading happens on the device
with Apple's model; no Firebase config is needed for that. To enable the consented cloud path, copy
`ios/WeKnow/GoogleService-Info.example.plist` to `GoogleService-Info.plist` with your iOS app's config and register an
App Check debug token.

## Existing work, disclosed

The first knowledge pack (`web/public/packs/us-home.json`) is generated by `scripts/build-pack.mjs` from the US price
book and DIY guides of Fair Quote, an earlier project by the same author. Everything else was built during the
submission period.

## License

Apache-2.0
