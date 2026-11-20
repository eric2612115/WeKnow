# Hybrid routing: the device first, the cloud automatically when it helps (2026-11-16)

People should not decide, question by question, whether the internet is used. WeKnow covers personal details on
the device, tries to answer on the device, and moves to the cloud by itself when the device cannot answer well —
with consent given once, and with every cloud answer labelled and showing exactly what was sent.

WeKnow names the place for every request itself, with Firebase AI Logic's explicit modes (`ONLY_ON_DEVICE`,
`ONLY_IN_CLOUD`): nothing falls over to the cloud on its own. The paper is read on the device or not at all; the
decision WeKnow makes is whether a covered question may go online when the device cannot answer well.

## Consent, once
The first time WeKnow would use the internet it asks once:
"When this device can't answer, may I use the internet? Only covered words and pictures go, and I'll always show you
what went." — [Yes, when it helps] [Ask me every time] [No]. Kept as a preference (Settings: Use the internet:
When it helps / Ask me every time / Never). "When it helps" is the recommended default after that one yes.

## The route for every question (plain code, `router`)
1. **Cover** — personal details are covered on the device first (always, before any model).
2. **Device** — the on-device model (Gemini Nano in Chrome, Apple's model on iPhone) and the local knowledge pack
   try first.
3. **Escalate automatically** (preference "When it helps", online) when:
   - there is no on-device model;
   - a question in words has no confident match in the pack;
   - a picture's kind is unknown, or no pack guide fits the problem, or the device model marked none of the offered
     options;
   - a quote line is not in the pack (price lookup with Google Search grounding).
4. **Check before sending** — the payload guard (plain code) scans the exact outgoing text again and blocks any
   personal pattern; then, where an on-device model exists, it reviews the covered text ("does this still contain a
   name, number, address or account?"); if either says yes, nothing is sent and WeKnow asks the person.
5. **Cloud** — Gemini through Firebase AI Logic. For questions and problems it sees the covered words plus the
   whole pack index (every guide and price name — too big for the on-device model's window, easy for the cloud) and
   may only return refs from it; the answer then comes from the pack item as usual. For unknown prices, Google Search
   grounding with https sources only.
6. **Label** — the answer says "Checked online" with what was sent; local answers say "On this device".
   If the cloud also finds nothing, WeKnow says so and offers to take a picture or ask differently.

"Ask me every time" shows the consent sheet at step 3; "Never" stops at step 2 and says what the device could do.
