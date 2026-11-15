# WeKnow user flow

Open the camera, ask out loud. WeKnow looks, works it out on the device, and talks you through it.
No reading is needed to finish the main task.

This document says who uses WeKnow, every flow step by step, every screen and state, what is spoken and what is
shown, and what not to build. Layout, sizes, colours and the full list of strings are in `UI-SPEC.md`. Every screen
here can be opened in `prototype.html` (the Scene menu in its top bar).

## 1. Five rules the flows follow

1. **One screen, one button.** The camera view, the words, and one large button. The button always does the next
   thing: Ask, Stop, or Next.
2. **It talks; the screen keeps notes.** Every answer is spoken. The same words appear as large captions, and
   numbers (prices, step numbers) stay on the screen because they are hard to hold in the ear.
3. **Nothing rushes and nothing vanishes.** No countdowns, no messages that disappear on a timer. An answer stays
   until the next question. WeKnow waits as long as it takes.
4. **It says where the answer came from, in plain words.** "On this phone" or "Used the internet for 1 item". The
   first time anything would leave the device, WeKnow asks, and shows exactly what would be sent.
5. **Value before set-up.** No account, no typing, no settings before the first answer. Three presses from the first
   screen to the first answer: Start, Allow, Ask.

## 2. People

All names are invented.

| Who | Situation | What they need from the design |
|---|---|---|
| **Margaret, 78.** Lives on her own. Uses her phone for calls and photos. | Finds most apps hard to use: small words, pop-ups, passwords, menus. Reads with glasses, hears a little less than she did, and her hands are not perfectly steady. | One obvious thing to press. A voice at a calm pace. Large words. No account. Nothing that punishes a slow or wrong press. |
| **Daniel, 46.** Her son, two hours away. | Sets things up when he visits. Gets the phone calls when something on a screen is confusing or a letter looks odd. | Five minutes to set it up on her phone, without making her an account. To know it will tell her "don't pay yet" and suggest she rings him. |
| **A judge.** Works on Firebase or Chrome. | Watches a 3-minute video, may spend one minute on the hosted link, on a laptop that probably cannot run the on-device model. No blocked drain on the desk. | To understand the product in ten seconds. Sample pictures to try. To see consent before the internet, and a clear, honest "where this ran". No sign-in. |

## 3. Screens and states

One everyday screen (Home) and two first-run screens. Everything else is a sheet over Home.

| Id | Screen | Purpose |
|---|---|---|
| S1 | Welcome | Says what WeKnow is with three pictures and three questions. One button: Start. |
| S2 | Allow | Camera and microphone. The system box is up; the page points at "Allow". |
| S3 | Home | The camera view, the words, the big button. Has phases, below. |
| S4 | Where this answer came from | What stayed on the device, what went over the internet, sources. A sheet on the phone, a panel beside the answer on a laptop. |
| S5 | Earlier | Answers kept on this device. Press one to hear it again. |
| S6 | Help and settings | Hear how it works, sample pictures, text size, voice, dark screen, internet, sign-in. |
| S7 | Set up for someone else | A five-item checklist for a family member. |

Home phases (S3):

| Phase | Big button | Left / right buttons | Camera view | Words area |
|---|---|---|---|---|
| Ready | Ask | Earlier / Help | Live, large. "Camera on". | One line: "Point at it. Press Ask. Say what's wrong." |
| Listening | Moving bars (press to finish early) | Earlier / Help | Live | "I'm listening" and the words as they are heard |
| Looking | Stop | Earlier / Help | Still picture, corners close in; a line sweeps down a paper | "You asked: ..." and what WeKnow is doing |
| Answer | Stop while speaking, then Ask | Earlier / Help | Still picture with marks on it, smaller | Verdict, the sentences, yes/no buttons, the where-it-ran tag |
| Step by step | Next | Again / Stop | Live, with a ring on the part to touch | "Step 2 of 5", one instruction |

The left button is always "go back in time" (Earlier, Again). The right button is always "get out" (Help, Stop).
They never swap sides.

## 4. Flows

In the tables, **Says** is spoken and shown as a caption with the same words. **Shows** is what else is on the screen.

### A. First time (no account)

Prototype scenes: First open, Allow camera and microphone, Ready for the first question.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Opens the link or the app. | Nothing yet. Browsers block sound until the first press. | S1: "Point at it. Ask out loud. Hear what to do." Three pictures with a question under each. The Start button. "No account. No typing. Turn your sound up." |
| 2 | Presses **Start**. | "Hello. I'm WeKnow. A box has appeared. Press Allow, so I can see and hear." | S2: "Press Allow". An arrow points at the system box. "Pictures stay on this phone unless you say yes." |
| 3 | Presses **Allow** in the system box. | "Good. Now point me at something. Press Ask, and tell me what's wrong." | S3 Ready. Camera is live. |
| 4 | Presses **Ask** and speaks. | See flow B. | |

Notes:
- The Start press does two jobs: it unlocks sound, and it opens the system box. There is no separate "why we need
  the camera" page; the voice explains while the box is on screen.
- On the web the camera and microphone are one box. On iPhone there can be three boxes in a row (camera, microphone,
  speech). The voice then says "Three boxes will appear. Press Allow on each."
- An anonymous session is created silently so that answers can be kept. The word "account" is never shown.
- If the person presses "Don't allow": state E6 (camera is off).
- The offer to work without the internet (flow H) never appears before the first answer.

### B. Every day: ask about a thing

Prototype scenes: Ask: a drain that will not empty, Answer with an offer to guide.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Opens WeKnow. | Nothing. | S3 Ready, camera live. One press away from asking. |
| 2 | Points at the sink. Presses **Ask** (or the space bar). | A soft "listening" sound. | "I'm listening". The button shows moving bars. |
| 3 | "Why won't this drain?" Stops talking. | | Her words appear as she speaks. After about two seconds of quiet, listening ends by itself. |
| 4 | Waits. | "Let me look." | The picture freezes. "You asked: 'Why won't this drain?'" The button is Stop. |
| 5 | | "This looks like a slow drain. Most likely hair." | Green verdict: **You can fix this**. Tag: "On this phone". |
| 6 | | First answer ever, once: "I worked that out right here, on this phone. Nothing left it." | |
| 7 | | "It takes about 15 minutes. Shall I talk you through it?" | Two buttons: **Yes, guide me** / **Not now**. She can also just say yes or no. |
| 8a | "Yes." | Flow C. | |
| 8b | "Not now." | "All right. You will find it under Earlier." | The answer stays. Button is Ask again. |

Rules:
- "You asked: ..." is the only confirmation of what was heard. WeKnow never asks "Did you say ...?".
- She can interrupt at any time by pressing the button (Stop). Stopping never loses the answer already shown.
- After a question from WeKnow the microphone opens by itself. If she says nothing, nothing happens and nothing is
  said. The buttons stay.
- Every finished answer is kept under Earlier without asking.

### C. Step by step

Prototype scene: Step by step.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Said yes in flow B. | "You need a plastic drain tool, or a bent wire hanger." | "Before you start". The camera is live again and larger. Button: **Next**. Left: Again. Right: Stop. |
| 2 | | "One caution. If you poured drain cleaner in, do not use the tool." | The caution on an amber band with a triangle. |
| 3 | Says "next" or "ready", or presses **Next**. | "Take off the drain cover. Some lift out. Some unscrew." | "Step 1 of 5" with five bars. A dashed ring on the drain cover in the camera view. |
| 4 | Does it. Says "done" or presses **Next**. | "Good. The cover is off." | The corners close in for a moment (WeKnow is looking). A green tick with the sentence. |
| 5 | | "Wipe the hair and soap off the cover." ... and so on to step 5. | One instruction at a time. Nothing else. |
| 6 | After step 5. | "Is the water going down now?" | Green verdict: **All five steps done**. Buttons: Yes / No. |
| 7a | "Yes." | "A small mesh screen over the drain stops this from coming back." | **Well done**. |
| 7b | "No." | "A fair price to unclog a drain is $175 to $600. Most people pay about $385. When you get a quote, show it to me and I will check it." | Amber verdict: **Time for a plumber**. The price range stays on screen. |

Rules:
- Words she can say at any step: next, done, again, wait, stop. The three buttons do the same.
- WeKnow looks when she says "done" or presses Next: one still picture, checked on the device. If what it sees does
  not match ("I can still see the cover"), it says so and repeats the step.
- It never moves on by itself and never says "are you still there?". After a long quiet it says once, "No hurry. I
  will wait."
- Cautions from the guide are spoken before step 1. "Stop if" signs from the guide (more than one drain is slow, a
  smell of sewage) end the guide with the plumber answer in 7b.
- Stop shows "Stopped at step 3" with **Carry on** / **Finish for now**. A stopped guide is kept under Earlier and
  can be carried on from the same step.
- A guide marked "needs a professional" (gas, mains wiring, a swollen battery) never offers steps. It gives a red
  verdict, the reason, and the fair price for the job.

### D. A repair quote

Prototype scenes: Ask: a repair quote, Asking before one item goes online, Quote: one line is high, Quote: a sentence to say.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Points at the quote. Presses Ask. "Is this a fair price?" | "Let me read it." | The picture freezes. A line sweeps down the paper. |
| 2 | | "I covered your name, phone, address and plate. They stay on this phone." | Solid bars slide over those four fields on the picture. |
| 3 | | "I know seven lines. One I do not: brake fluid flush." | A tick appears beside each known line. A dashed blue box and "?" on line 4. |
| 4 | First time only: answers the question in flow F. | "May I look that one up on the internet? I would send only those words, and your city. Not the picture." | The asking sheet, with the exact words that would be sent. |
| 5 | "Yes." | "Found it. That line is fair. I will keep it for next time." | Line 4 gets a blue tick. |
| 6 | | "Line 3, brake labor, is $180 high. Shops near you charge about $240. The other lines look fair." | Amber verdict: **One line is high**. Line 3 is boxed in amber with "$180 high". Tag: "Used the internet for 1 item". |
| 7 | | "Want words to say to the shop?" | **Yes, tell me** / **No thanks**. |
| 8 | "Yes." | "Could you go over the brake labor with me? Other shops near me charge about $240." | **Say this to the shop**, with the sentence in large type so she can read it out or hold it up. **Done** / **Say it again**. |

What changes with the device:

| Condition | Step 3 to 5 become | Tag |
|---|---|---|
| Asked this before (the line was kept) | "I know all eight lines. One I kept from last time." No question, no internet. | On this phone |
| Said yes before, "ask every time" is off | "I am looking that one up on the internet." No sheet. | Used the internet for 1 item |
| She says no | "All right. I will skip that line." Verdict adds "One is not checked." | 1 item not checked |
| No internet, line not kept | "There is no internet, so that line has to wait." | 1 item not checked |
| The device cannot read by itself | Flow F, variant 3, before step 1. Then "I am checking the prices on the internet." | Answered using the internet |

Rules:
- Every number spoken is also on the screen. The verdict is one of three: nothing is high (green), one or more lines
  are high (amber), or the quote cannot be read (plain, with what to do).
- WeKnow never says a price it has no source for. A line without a source is "not checked", never guessed.
- One page at a time. If the picture is too small to read: "I can't read the small words. Move closer to the top half."

### E. A bill or a letter

Prototype scenes: Ask: a letter asking for money, Letter: do not pay yet.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Points at the letter. Presses Ask. "Should I pay this?" | "Let me read it." | The picture freezes. A line sweeps down. |
| 2 | | "I covered your name, address and account number. They stay on this phone." | Solid bars over those fields. |
| 3 | | "One. It wants the money sent to a new account." | Red verdict with a stop sign: **Don't pay this yet**. A red box and a "1" on that sentence in the picture. |
| 4 | | "Two. It rushes you: 48 hours." | A red box and a "2" on that sentence. |
| 5 | | "Call the company first. Use the number on an older bill, not this letter." | **Call Daniel** (if a person to call is set) / **Say it again**. Tag: "On this phone". |

Three verdicts only: **This looks normal** (green tick), **Check this first** (amber triangle), **Don't pay this yet**
(red stop sign). Each is followed by the reasons, numbered, and one thing to do. WeKnow never says "this is a scam";
it says what the letter does and what to do next. It never pays, and never opens a link from a letter.

### F. Asking before the internet

Prototype scenes: Asking before one item goes online, Asking when this device cannot read by itself.

The sheet has one question, a box that shows **exactly what would be sent**, one line saying what is not sent, and
two buttons. It is spoken as well, and "yes" or "no" out loud works. It cannot be closed by pressing outside it.

| Variant | When | Question | The box shows | Not sent |
|---|---|---|---|---|
| 1. One missing item | The device read the picture; a pack lacks one fact | "May I look up one thing on the internet?" | "Brake fluid flush" price. City: Austin, TX | The picture, name, phone, address, plate |
| 2. A thing, device cannot read | No on-device model | "May I send this picture over the internet?" | The picture itself, and the question | "I will tell you every time I use the internet." |
| 3. A paper, device cannot read | No on-device model | "May I check this on the internet?" | "The 8 lines and their prices. Your details are covered." | The picture, name, phone, address, plate, account number |
| 4. Not in any pack | WeKnow has no guide | "May I look this up on the internet?" | "How do I reset a wall thermostat?" | The picture |

After the first yes:
- WeKnow does not ask again. It **says** so each time ("I am looking that one up on the internet") and the tag on
  the answer says so.
- "Ask me every time before using the internet" in Help (off by default) brings the sheet back every time. A family
  member can set it in flow J.
- A yes is remembered on this device only. It is never carried to another device by sign-in.

After a no:
- Variant 1 and 4: WeKnow answers with what it has and marks the rest "not checked". It asks again next time.
- Variant 2 and 3: "All right. This phone needs the internet to see, so I cannot answer this one. Ask me again any
  time." Verdict: **Nothing was sent**.

Whatever WeKnow learns from the internet is kept with its source, so the same question next time needs no internet
and no question.

### G. No internet

Prototype scenes: No internet, still works; No internet, and this device needs it.

| Situation | WeKnow says | WeKnow shows |
|---|---|---|
| Device reads by itself, the packs know the answer | Nothing special. Answers as usual. | A small note on the camera view: "No internet. Still works." Tag on the answer: "No internet. Answered on this phone." |
| Device reads by itself, one fact is missing | "There is no internet, so that line has to wait." | Tag: "1 item not checked". The kept answer under Earlier shows the same; asking again with internet finishes it. |
| Device cannot read by itself | "There is no internet, and this phone needs it to see. Your earlier answers still work." | Verdict: **No internet**. One button: **Open Earlier**. |
| The internet stops in the middle of a look-up | "The internet stopped. Here is what I know from this phone." | Same as the second row. |

No error codes, no "retry" button. The big button always works; pressing Ask with no internet gives the spoken
explanation again.

### H. Getting ready to work without the internet

Prototype scene: Offer to work without the internet. Also in Help and in flow J.

| # | When | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | After the first finished answer, once, only if this device can run the model but has not got it | "I can get ready to work without the internet. It takes about 20 minutes. You can keep using me while I do." | A sheet over the answer: "Shall I get ready to work without the internet?" **Get ready** / **Not now**. "One time only. Best on home Wi-Fi." |
| 2 | She presses **Get ready** | "I have started. I will tell you when I am ready." | The answer is still there. A small note: "Getting ready: 12%". WeKnow keeps working through the internet meanwhile. |
| 3 | The download ends, then the device unpacks it | Nothing. | "Getting ready: almost there" (no percentage while unpacking). |
| 4 | Ready, and WeKnow is not in the middle of an answer | "I am ready. I can work without the internet now." | The note goes. Tags now say "On this phone". |
| - | She presses **Not now** | "All right. You can do it later, under Help." | Never offered again by itself. Help has "This phone needs the internet to see" with a **Get ready** button. |

Rules:
- Never before the first answer. Never blocks anything. Never the words "model", "download" or a size in gigabytes on
  the main screen (the size is in Technical details).
- If the device can never run it: no offer. Help says "This phone uses the internet to see." and nothing more.
- If the device is short of space: "This phone is too full to get ready. WeKnow will keep using the internet."
- On iPhone, when the phone's own on-device features are switched off, flow J tells the family member where to turn
  them on. Margaret is never sent to system settings by herself.

### I. Keeping answers, and signing in

- WeKnow starts with no account. Answers are kept on the device under Earlier.
- Signing in is offered in one place only: Help, "Keep your answers if this phone is lost or replaced", with the
  line "Optional. WeKnow works the same without it." One button: Sign in with Google.
- Signing in upgrades the silent session, so nothing already kept is lost.
- What goes with the account: the words of kept answers, what WeKnow has learned from the internet (with sources),
  text size and voice settings. What never does: pictures, the yes to using the internet, the person to call.
- After signing in the row reads "Signed in as ..." with **Sign out**. Signing out keeps everything on the device.
- WeKnow never asks to sign in during a question, after an answer, or as a pop-up.

### J. A family member sets it up

Prototype scene: Set up for someone else. Reached from Help, on the parent's own device, in person.

"Five things, about five minutes."

1. **Camera and microphone.** Shows "Allowed", or a button that opens the system box.
2. **Work without the internet.** A **Get ready** button and a progress bar (flow H, without the offer).
3. **Voice and text they are comfortable with.** Slower / Normal / Faster. Three text sizes. **Play a sample**.
4. **Before WeKnow uses the internet.** "Ask the first time, then just say so" (default) or "Ask every time".
5. **Who they should call when unsure.** A name and a number, kept on this device only. This puts **Call Daniel** on
   every red or amber verdict about money.

Then **Try it together**, which starts a real question, and one line: "Then put WeKnow on the first screen, so it is
one press away."

Signing in is not part of the checklist. A family member who wants the answers backed up uses flow I afterwards.

### K. A judge's first minute

On a laptop with Chrome, no on-device model, no drain to point at.

1. Opens the link. S1 says what it is in one line and three pictures.
2. Start, Allow. Home appears with the laptop layout: camera view on the left, words on the right, and under the
   camera view, "No camera handy? Try a picture." with the three sample pictures.
3. Presses the quote picture, then Ask (or the space bar). Because this laptop cannot read by itself, the asking
   sheet appears first (flow F, variant 3) and shows what would be sent.
4. Yes. The verdict appears with the high line marked. Beside it, without pressing anything, the panel "Answered
   using the internet": what stayed on this computer, what went over the internet. "Sources and details" opens the
   sources and the technical details (which model, how long, how many requests, pack version).
5. The top right corner says "Using the internet". On a machine with the model it says "Works without the internet",
   and the same quote shows "Used the internet for 1 item", then, asked again, "On this computer".

## 5. Spoken and shown

| | Spoken | Shown |
|---|---|---|
| Answers, questions, cautions | Always | Always, same words, as large captions. The sentence being spoken is darkest. |
| Prices, step numbers, the sentence for the shop | Always | Always, and they stay |
| The verdict (three or four words) | As part of the first sentence | Always, at the top, with a shape and a colour |
| Where it ran | The first time ever, and every time the internet is used | Always, as the tag |
| Sources | Only if she asks "how do you know?" | In "Where this answer came from" |
| Fillers ("Let me look.", "Good.") | Always | As captions |
| Marks on the picture (bars, ticks, boxes) | Described in the sentence ("line 3") | Always |
| Progress while getting ready | At start and at the end only | A small note with a percentage |
| Technical details | Never | One closed section inside the sheet |

Sounds without words: one soft sound when listening starts, one when it ends. Nothing else beeps.

## 6. When something goes wrong

Prototype scenes: the "When things go wrong" group. Every state is spoken, and every state has one clear way out.

| Id | State | WeKnow says | Shows | Way out |
|---|---|---|---|---|
| E1 | Did not hear (first time) | "Sorry, I did not hear that. Say it once more." | "I didn't hear that". Listens again. | Speak |
| E2 | Did not hear (second time) | "I still cannot hear you. Press one of these instead." | Three questions as buttons, chosen for what is in view, and **Type instead** | Press one |
| E3 | Too dark, phone | "It is too dark for me to see. I am turning on the light." | "Too dark", then "Light on" | Nothing to do |
| E3 | Too dark, laptop | "It is too dark for me to see. Turn on a lamp, or move near a window." | "Too dark" | Ask again |
| E4 | Blurred, too close, too far | "Hold still." / "Move back a little." / "Come closer." | The live view | Ask again; WeKnow does not answer from a bad picture |
| E5 | Not what was asked about | "I can see a wall thermostat. Is that what you mean?" | The picture | Yes / No |
| E6 | Does not know this yet | "I can see a wall thermostat. I do not have a guide for it yet." | **I don't know this one yet**, then flow F variant 4 | Yes: answer, kept for next time. No: "Nothing was sent." |
| E7 | Will not help (medicine, legal papers, anything dangerous to guess) | "I can't help with medicine. Please ask your pharmacist." | Plain verdict | None needed |
| E8 | Dangerous to do yourself | "Stop. Do not try this yourself." and the reason | Red verdict, fair price for a professional | Call Daniel, if set |
| E9 | Camera is off | "The camera is turned off for WeKnow." | "The camera is off" in the view. **Show me how to turn it on** / **Use a picture instead** | Either |
| E10 | Microphone is off | "I cannot hear. The microphone is turned off for WeKnow." | The same three question buttons as E2, **Type instead**, **Show me how to turn it on** | Any |
| E11 | No internet | Flow G | | |
| E12 | Sound is off or the voice fails | Nothing can be said | Captions carry everything. One line: "Turn your sound up to hear me." | None needed |

WeKnow never shows an error code, never blames the person ("invalid", "failed"), and never ends on a dead screen.

## 7. What not to build

- A chat thread, bubbles, or any scrolling history of the conversation on the main screen.
- A text box as the main way in. Typing exists only as "Type instead" after two failed listens.
- A sign-up, a sign-in wall, an email field, a password, a profile.
- A welcome tour, a carousel, tips of the day.
- A picker for what kind of thing this is. WeKnow chooses the pack from what it sees and hears.
- A home page with tiles or a feed. The camera is the home page.
- Settings for the model, the pack, or the route. People choose "ask every time", not "on-device".
- The words AI, model, cloud, on-device, sync, cache, token, offline or consent anywhere a person reads or hears them.
- Sparkles, glows, gradients, an animated orb, a mascot, a typing indicator.
- Confidence percentages on answers.
- Notifications, badges, streaks, reminders.
- Payments, saved cards, "pay this bill". Opening links found in letters.
- Guiding other apps or sharing the screen.
- Sharing to social media. A family dashboard that watches what the parent asks.
- Sending live video to the internet. WeKnow sends a still or words, after asking.
- Reading several pages, handwriting, or medicine labels in this version.
- Any logo, brand name or real company in the product, the samples or the video.

## 8. What the video has to show

In order, and none of it needs a caption to be understood:

1. A person, the phone, a sink. She presses the one button and asks out loud. WeKnow answers out loud. (10 seconds)
2. Step by step with her hands in the picture: "Good. The cover is off."
3. The quote: the bars sliding over her name, the ticks, the amber box on line 3, "$180 high".
4. The asking sheet with the two words that would be sent, and her saying "yes".
5. The tag changing between "On this phone" and "Used the internet for 1 item"; the same quote a second time with
   the phone in flight mode.
6. The letter: "Don't pay this yet", and **Call Daniel**.
7. A laptop without the model doing the same thing, with the panel showing what went over the internet.

## 9. Build notes

- Sound and the model download each start from a press in the browser. The Start button is the press for sound. The
  offer in flow H is pressed, and on the web the voice adds "Press Get ready to start."
- On a device that cannot read by itself, papers are read into words on the device (plain text recognition) and
  personal details are covered there. The asking sheet (flow F, variant 3) shows those covered words, and only they
  are sent.
- "City" for prices comes from the quote itself (city and state only) or from a place set once in Help.
- In step by step, WeKnow looks at one still picture each time she says "done" or presses Next.
- Kept answers hold the words and the picture with details covered. Pictures stay on the device that took them.
- The yes to using the internet, and the person to call, are stored on the device only.
