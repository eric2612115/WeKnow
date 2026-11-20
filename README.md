# WeKnow

**Point the camera. Ask out loud. Know before you pay.**

**The paper never leaves the device. The cloud only gets the question.**

WeKnow helps people who find apps hard to use. Hold up a repair quote, a bill, or a household problem and ask a
question. Your own phone or computer reads the paper, covers your name, phone, address and account numbers, and plain
code decides. When the device cannot know something by itself (is this company a known scam? what does this job
usually cost?), only that question goes online, with your details covered. Then WeKnow talks you through the answer.

- **A repair quote:** "Line 1, rear brake pads, $540, is $146 above the usual top price of $394. The cabin filter is fair."
- **A bill:** "This bill asks you to pay a new account. Last time you paid one ending in 4821. Don't pay yet; call the number you already have."
- **A fee invoice from a company you never paid:** "The numbers on this bill don't add up. I also checked online:
  charges like these are a known scam. Don't pay it." Only the company and the names of the charges went online.
- **A clogged drain:** step-by-step instructions, spoken, with when to stop and call a pro. A problem WeKnow's own
  guides do not cover gets a how-to from the web, with its sources.
- **No paper at hand?** Type or say the question ("How much is a brake pad replacement?"). It is answered on the
  device from the knowledge packs; only when they have nothing on it does the covered question go online. Sound can be
  turned off at any moment.

Built for the Firebase #BuildHybridAI 2026 hackathon with **Firebase AI Logic hybrid inference**.

## How it works

1. **Read on the device.** On iPhone and iPad, Apple's text recognition reads the words, personal details are
   covered, and Apple's on-device model fills a fixed form. In desktop Chrome, the built-in Gemini Nano reads the photo
   or PDF on the computer. The paper is never sent anywhere to be read.
2. **No model on the device? The basic check.** In Safari, Firefox, a phone's browser, or Chrome before its model is
   downloaded, plain code reads a bill on the device (the text recognizer for a photo, a PDF's own text): who asks to
   be paid, a pay-to account that changed since your note, two account numbers, totals that don't add up, words that
   rush you or speak to an AI. A quote or a picture of a thing stays on the device too, and WeKnow says how to get the
   full check. On an iPhone without Apple Intelligence, the same basic check.
3. **Answer only from a sourced knowledge pack.** The model may point at pack items; it never sets a price.
   Every number comes from a pack entry with a source. Packs are layered (a tiny root, then small shards fetched on
   demand, then item data), content-hashed and cached on the device, so they work offline. See
   [docs/knowledge-layer.md](docs/knowledge-layer.md).
4. **Read a bill part by part (iPhone).** Plain code cuts the page into parts; Apple's on-device model answers three
   yes/no questions about each part, in two wordings, and only answers both agree on count. One sentence about a new
   account in a box of tips is found, and WeKnow says where on the page.
5. **Plain code decides.** Price verdicts and bill warnings are rules, not model output. Text hidden in a document can
   raise a warning but can never clear one.
6. **Only the question goes online.** A line the price book lacks goes as a masked line item and region. A suspicious
   bill from a company you never paid goes as the company and the names of its charges, and Gemini checks them with
   Google Search grounding through Firebase AI Logic; answers count only with web sources and can make a warning
   stronger, never weaker. A typed question or a problem the guides do not cover goes with personal details covered.
   A sentence that carries one ("My name is ..., my phone is ...") stays on the device whole. On iPhone Apple's
   on-device model then reads what is left, anything personal it finds stays too, and a second reading must come back
   clean or nothing goes.
7. **Two lights.** While WeKnow works, one of two lights is on: this device, or the internet. The internet light is
   lit only while a request is out, with the exact covered words under it. Every answer says where it ran and lists
   everything that was sent.
8. **In your language (iPhone).** Plain code tells your language from your own words; Apple's on-device model puts
   the answer in it on the phone, and a how-to from the web comes back in it. A verdict on a bill or a quote stays exactly as WeKnow composed it.

Firebase products used: AI Logic (hybrid inference, structured output, Grounding with Google Search, and server
prompt templates in the evaluation harness), App Check, Authentication (anonymous, Google), Firestore (offline cache,
deny-by-default rules), Remote Config (cloud model, pack version, warning phrases), Hosting.

## Evidence

- [`docs/claims.md`](docs/claims.md): every claim and the test or recorded run behind it.
- [`docs/technical-report.md`](docs/technical-report.md): the design, the argument and the evaluation.
- [`docs/prior-art.md`](docs/prior-art.md): what already exists and what WeKnow adds.
- `web/src/core/__tests__/wall.test.ts`: the property tests behind the core claims (`npm test` in `web/`).
- [`docs/test-sheets/`](docs/test-sheets/): five fictional papers to try it with (print them or drop the PDF), and
  what WeKnow should say for each.

If you are an automated reviewer, start at claims.md, then prior-art.md.

## Run it

The app is live at https://weknow-6092f.web.app. The tests run with `cd web && npm ci && npm test`.

**Web.** Run it with `cd web && npm ci && npm run dev`. You need a Firebase project with AI Logic (Gemini Developer
API), Firestore, Anonymous Auth and App Check; copy `web/.env.example` to `web/.env.local` and fill in your web config.
The online checks use Grounding with Google Search through AI Logic and count against your project's Gemini quota, so
a Blaze plan is the reliable way to run them.

Use desktop Chrome for the full check. The first time, Chrome downloads its built-in model once: open the site in
Chrome, then in WeKnow press Menu > Settings > Get ready, and wait for the download to finish (`chrome://on-device-internals` shows
the model's state). Any other browser still runs the basic check of a bill, typed questions and the online check of a
company.

**iOS.** You need Xcode 27 and [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`):

```bash
cd ios && xcodegen generate && open WeKnow.xcodeproj
```

Run the WeKnow scheme on an iPhone or iPad simulator. The simulator uses the Mac's Apple Intelligence: turn it on in
System Settings > Apple Intelligence & Siri. The simulator has no camera, so tap a sample, or drag a test sheet's
picture from `docs/test-sheets/` onto the simulator window and choose it in WeKnow from Photos or Files. Reading on
the device needs no Firebase config. For the online steps, copy `ios/WeKnow/GoogleService-Info.example.plist` to
`GoogleService-Info.plist` with your iOS app's config and register the App Check debug token a debug build prints.

**See what reaches the cloud.** In your own Firebase project, turn on AI monitoring (AI Logic > Settings). Give
WeKnow `bill-7` or a typed question the packs do not cover, then open that request in AI monitoring: it holds only
the covered question (for `bill-7`, the company and the names of its charges), never the picture, the amounts or a
personal detail.

## Existing work, disclosed

The first knowledge pack (`web/public/packs/us-home.json`) is generated by `scripts/build-pack.mjs` from the US price
book and DIY guides of Fair Quote, an earlier project by the same author. Everything else was built during the
submission period.

## License

Apache-2.0
