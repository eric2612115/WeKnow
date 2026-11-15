# WeKnow user flow

Open the camera, ask out loud. WeKnow looks, works it out on the device, and talks you through it.
No reading is needed to finish the main task.

This document says who uses WeKnow, every flow step by step, every screen and state, what is spoken and what is
shown, and what not to build. Layout, sizes, colours and the full list of strings are in `UI-SPEC.md`. Every screen
here can be opened in `prototype.html`, which shows the phone and the desktop side by side.

## 1. Six rules the flows follow

1. **The camera is home, and one button runs it.** The camera view, the words, and one large button that always does
   the next thing: Ask, Stop, or Next. Everything else lives behind Menu.
2. **It talks; the screen keeps notes.** Every answer is spoken. The same words appear as large captions, and
   numbers (prices, step numbers) stay on the screen because they are hard to hold in the ear.
3. **Nothing rushes and nothing vanishes.** No countdowns, no messages that disappear on a timer. An answer stays
   until the next question. WeKnow waits as long as it takes.
4. **It says where the answer came from, in plain words.** "On this phone" or "Used the internet for 1 item". The
   first time anything would leave the device, WeKnow asks, and shows exactly what would be sent.
5. **It remembers your household, only on this device, and only after asking.** A shop you used, a bill you pay, an
   appliance you own. It uses those notes in one short sentence, marks that sentence "From your notes on this phone",
   and shows every note on one page where each can be changed or deleted.
6. **Value before set-up.** No account, no typing, no settings before the first answer. Three presses from the first
   screen to the first answer: Start, Allow, Ask.

## 2. People

All names are invented.

| Who | Situation | What they need from the design |
|---|---|---|
| **Margaret, 78.** Lives on her own. Uses her phone for calls and photos. | Finds most apps hard to use: small words, pop-ups, passwords, menus. Reads with glasses, hears a little less than she did, and her hands are not perfectly steady. | One obvious thing to press. A voice at a calm pace. Large words. No account. Nothing that punishes a slow or wrong press. She may never open Menu, and nothing she needs is in it. |
| **Daniel, 46.** Her son, two hours away. | Sets things up when he visits, and uses WeKnow himself for his own home, his mother's place and the car. Often at a laptop. | Five minutes to set it up on her phone. A tidy place for what was checked, grouped his way. Settings he can understand at a glance, including exactly what stays on the device. |
| **A judge.** Works on Firebase or Chrome. | Watches a 3-minute video, may spend one minute on the hosted link, on a laptop that probably cannot run the on-device model. No blocked drain on the desk. | To understand the product in ten seconds. Sample pictures to try. To see consent before the internet, and a clear, honest "where this ran". No sign-in. |

## 3. Screens and states

| Id | Screen | Purpose |
|---|---|---|
| S1 | Welcome | Says what WeKnow is with three pictures and three questions. One button: Start. |
| S2 | Allow | Camera and microphone. The system box is up; the page points at "Allow". |
| S3 | Ask (home) | The camera view, the words, the big button. Has phases, below. |
| S4 | Menu | A drawer from the left: Ask, My checks, What WeKnow remembers, Settings, Help. Light, dark or system. Who is signed in. |
| S5 | My checks | Every check kept on this device, grouped into projects such as "My home", "Mom's place", "The car". |
| S6 | What WeKnow remembers | Every note WeKnow keeps on this device: shops and what was paid, payees, appliances, preferences. |
| S7 | Settings | Account, voice and text, screen, language, privacy, notes and payees, family, delete my data. |
| S8 | Help | Hear how it works, sample pictures, words it understands, set up for someone else. |
| S9 | Where this answer came from | What stayed on the device, what went over the internet, sources. A sheet on the phone, a card beside the answer on a desktop. |

The app bar is the same everywhere after the first run: a **Menu** button with its word, and the wordmark. On a
desktop it also shows whether this device works without the internet, and who is signed in.

Ask phases (S3):

| Phase | Big button | Side buttons | Camera view | Words |
|---|---|---|---|---|
| Ready | Ask | none | Live, large. "Camera on". | One line: "Point at it. Press Ask. Say what's wrong." |
| Listening | Moving bars (press to finish early) | none | Live | "I'm listening" and the words as they are heard |
| Looking | Stop | none | Still picture, corners close in; a line sweeps down a paper | "You asked: ..." and what WeKnow is doing |
| Answer | Stop while speaking, then Ask | none | Still picture with marks on it, smaller | Verdict, the sentences, yes/no buttons, the where-it-ran tag |
| Step by step | Next | Again (left), Stop (right) | Live, with a ring on the part to touch | "Step 2 of 5", one instruction |

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
- The Start press does two jobs: it unlocks sound, and it opens the system box. The voice explains while the box is
  on screen.
- On the web the camera and microphone are one box. On iPhone there can be three boxes in a row (camera, microphone,
  speech). The voice then says "Three boxes will appear. Press Allow on each."
- A session without a name is created silently so that checks can be kept. The word "account" is never shown here.
- If the person presses "Don't allow": state E9 (camera is off).
- Nothing is offered before the first answer: not signing in, not getting ready to work without the internet, not
  remembering.

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
| 8b | "Not now." | "All right. It is in My checks, under My home." | The answer stays. Button is Ask again. |

Rules:
- "You asked: ..." is the only confirmation of what was heard. WeKnow never asks "Did you say ...?".
- She can interrupt at any time by pressing the button (Stop). Stopping never loses the answer already shown.
- After a question from WeKnow the microphone opens by itself. If she says nothing, nothing happens and nothing is
  said. The buttons stay.
- Every finished answer is kept as a check, and WeKnow says so. Where it is filed is in flow M.

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
- Stop shows "Stopped at step 3" with **Carry on** / **Finish for now**. A stopped guide is kept as a check and can
  be carried on from the same step.
- A guide marked "needs a professional" (gas, mains wiring, a swollen battery) never offers steps. It gives a red
  verdict, the reason, and the fair price for the job.
- When WeKnow has a note about the thing in front of it, it uses it once: "Your washer, the Alder WF-710, shook last
  October too. One foot was short." (flow N)

### D. A repair quote

Prototype scenes: Ask: a repair quote, Asking before one item goes online, Quote: one line is high, Quote: words to say.

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Points at the quote. Presses Ask. "Is this a fair price?" | "Let me read it." | The picture freezes. A line sweeps down the paper. |
| 2 | | "I covered your name, phone, address and plate. They stay on this phone." | Solid bars slide over those four fields on the picture. |
| 3 | | "I know seven lines. One I do not: brake fluid flush." | A tick appears beside each known line. A dashed blue box and "?" on line 4. |
| 4 | First time only: answers the question in flow F. | "May I look that one up on the internet? I would send only those words, and your city. Not the picture." | The asking sheet, with the exact words that would be sent. |
| 5 | "Yes." | "Found it. That line is fair. I will keep it for next time." | Line 4 gets a blue tick. |
| 6 | | "Line 3, brake labor, is $180 high. Shops near you charge about $240. The other lines look fair." | Amber verdict: **One line is high**. Line 3 is boxed in amber with "$180 high". Tag: "Used the internet for 1 item". |
| 7 | Only if WeKnow has a note about this shop. | "Same shop as last March. Labor was $95 an hour then. Now it is $120." | Under that sentence, a small tag: "From your notes on this phone". |
| 8 | | "Want words to say to the shop?" | **Yes, tell me** / **No thanks**. |
| 9 | "Yes." | "Could you go over the brake labor with me? Other shops near me charge about $240." | **Say this to the shop**, with the sentence in large type so she can read it out or hold it up. **Done** / **Say it again**. |
| 10 | "Done." | "All right. It is in My checks, under The car." | The answer stays. |
| 11 | First time with this shop. | "Shall I remember this shop for next time?" | The remember sheet (flow N). |

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
| 3 | | With a note about this payee: "One. The account is new. You paid them at one ending 8815 before." Without one: "One. It wants the money sent to a new account." | Red verdict with a stop sign: **Don't pay this yet**. A red box and a "1" on that sentence in the picture. With a note: the tag "From your notes on this phone". |
| 4 | | "Two. It rushes you: 48 hours." | A red box and a "2" on that sentence. |
| 5 | | "Call the company first. Use the number on an older bill." | **Call Daniel** (if a person to call is set) / **Say it again**. Tag: "On this phone". |

Three verdicts only: **This looks normal** (green tick), **Check this first** (amber triangle), **Don't pay this yet**
(red stop sign). Each is followed by the reasons, numbered, and one thing to do. WeKnow never says "this is a scam";
it says what the letter does and what to do next. It never pays, and never opens a link from a letter. It offers to
remember a payee only after a bill that looks normal, never after an amber or red one.

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
- "Ask me every time before using the internet" in Settings (off by default) brings the sheet back every time. A
  family member can set it in flow J.
- A yes is remembered on this device only.

After a no:
- Variant 1 and 4: WeKnow answers with what it has and marks the rest "not checked". It asks again next time.
- Variant 2 and 3: "All right. This phone needs the internet to see, so I cannot answer this one. Ask me again any
  time." Verdict: **Nothing was sent**.

Whatever WeKnow learns from the internet is a public fact with its source. It is kept, so the same question next
time needs no internet and no question. Notes about the household (flow N) are never part of what is sent.

### G. No internet

Prototype scenes: No internet, still works; No internet, and this device needs it.

| Situation | WeKnow says | WeKnow shows |
|---|---|---|
| Device reads by itself, the packs know the answer | Nothing special. Answers as usual. | A small label on the camera view: "No internet. Still works." Tag on the answer: "No internet. Answered on this phone." |
| Device reads by itself, one fact is missing | "There is no internet, so that line has to wait." | Tag: "1 item not checked". The check in My checks shows the same; asking again with internet finishes it. |
| Device cannot read by itself | "There is no internet, and this phone needs it to see. Your earlier checks still work." | Verdict: **No internet**. One button: **Open My checks**. |
| The internet stops in the middle of a look-up | "The internet stopped. Here is what I know from this phone." | Same as the second row. |

No error codes, no "retry" button. The big button always works; pressing Ask with no internet gives the spoken
explanation again. My checks, the notes and Settings all work without the internet.

### H. Getting ready to work without the internet

Prototype scene: Offer to work without the internet. Also in Settings and in flow J.

| # | When | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | After a finished answer, once, only if this device can run the model but has not got it, and nothing else was asked after that answer | "I can get ready to work without the internet. It takes about 20 minutes. You can keep using me while I do." | A sheet over the answer: "Shall I get ready to work without the internet?" **Get ready** / **Not now**. "One time only. Best on home Wi-Fi." |
| 2 | She presses **Get ready** | "I have started. I will tell you when I am ready." | The answer is still there. A small label: "Getting ready: 12%". WeKnow keeps working through the internet meanwhile. |
| 3 | The download ends, then the device unpacks it | Nothing. | "Getting ready: almost there" (no percentage while unpacking). |
| 4 | Ready, and WeKnow is not in the middle of an answer | "I am ready. I can work without the internet now." | The label goes. Tags now say "On this phone". |
| - | She presses **Not now** | "All right. You can do it later, in Settings." | Never offered again by itself. Settings, Privacy has the same **Get ready** button. |

Rules:
- Never before the first answer. Never blocks anything. Never the words "model", "download" or a size in gigabytes on
  the Ask screen (the size is in Technical details).
- One question after an answer at most. If WeKnow has just offered to remember something, this offer waits.
- If the device can never run it: no offer. Settings says "This phone uses the internet to see."
- If the device is short of space: "This phone is too full to get ready. WeKnow will keep using the internet."

### I. Account

- WeKnow starts with no account and works the same without one.
- Signing in is offered in one place only: Settings, Account. One button: Sign in with Google. The desktop app bar
  shows "Sign in" or the person's first name, and both lead to that card.
- Signing in upgrades the silent session in place.
- What goes with the account: the guides and prices WeKnow has looked up on the internet, with their sources, so the
  person's other devices know them too. What stays on the device: pictures, checks, projects, notes, payees,
  preferences, the yes to using the internet, the person to call.
- After signing in the card shows the name, the address and **Sign out**. Signing out changes nothing on the device.
- WeKnow never asks to sign in during a question, after an answer, or as a pop-up.

### J. A family member sets it up

Prototype scene: Set up for someone else. Reached from Help or Settings, on the parent's own device, in person.

"Five things, about five minutes."

1. **Camera and microphone.** Shows "Allowed", or a button that opens the system box.
2. **Work without the internet.** A **Get ready** button and a progress bar (flow H, without the offer).
3. **Voice and text they are comfortable with.** Slower / Normal / Faster. Three text sizes. **Play a sample**.
4. **Before WeKnow uses the internet.** "Ask the first time, then just say so" (default) or "Ask every time".
5. **Who they should call when unsure.** A name and a number, kept on this device only. This puts **Call Daniel** on
   every red or amber verdict about money.

Then **Try it together**, which starts a real question, and one line: "Then put WeKnow on the first screen, so it is
one press away."

### K. A judge's first minute

On a laptop with Chrome, no on-device model, no drain to point at.

1. Opens the link. S1 says what it is in one line and three pictures.
2. Start, Allow. Ask appears in the desktop layout: the camera in a large card on the left with the button under
   it, and on the right a card, "No camera handy? Try a picture.", with the three sample pictures.
3. Presses the quote picture, then Ask (or the space bar). Because this laptop cannot read by itself, the asking
   sheet appears first (flow F, variant 3) and shows what would be sent.
4. Yes. The verdict appears with the high line marked. Under it, without pressing anything, the card "Answered
   using the internet": what stayed on this computer, what went over the internet. "Sources and details" opens the
   sources and the technical details (which model, how long, how many requests, pack version).
5. The top right corner says "Using the internet". On a machine with the model it says "Works without the internet",
   and the same quote shows "Used the internet for 1 item", then, asked again, "On this computer".
6. Menu, My checks: the quote is there under "The car". Menu, What WeKnow remembers: the page that says "Only on this
   computer".

### L. Menu and moving around

Prototype scene: Menu open.

- **Menu** is top left on every screen, on the phone and on a desktop, always with its word.
- It opens a drawer from the left with five places, each a large row with an icon and a word: **Ask**, **My checks**
  (with how many), **What WeKnow remembers** (with how many), **Settings**, **Help**. The current place is marked.
- Under them: **Screen**, with Light / Dark / System; then who is signed in.
- Close with the **Close** button, by pressing outside, or with Escape. Choosing a place closes it.
- Leaving Ask in the middle of an answer stops the voice and keeps the answer. Coming back to Ask shows it again.
- Margaret can use WeKnow for years without opening Menu. Nothing in the core flows A to H needs it.

### M. My checks

Prototype scenes: My checks, My checks: one project, My checks: one check.

A check is one finished answer: the picture with details covered, the verdict, the words, the date. Checks are
kept on the device and grouped into **projects**. WeKnow starts with one project, "My home". The sample data shows
three: "My home", "Mom's place", "The car".

Where a new check goes, without asking:
- to the project that already holds that kind of thing (a car quote joins the other car papers, a letter from the
  water company joins its earlier bills);
- otherwise to the project used last.
- WeKnow says where once, in its closing sentence: "It is in My checks, under The car." On a desktop the answer also
  shows **Kept in The car**, which opens Move.

| Task | Phone | Desktop |
|---|---|---|
| See the projects | A card for each: name, count, up to three pictures, the latest check. | A list on the left with counts, starting with "All checks". |
| See the checks in one | Press the card. A list: picture, title, kind and date, verdict. "All projects" goes back. | Press the name. A grid of cards on the right. |
| Open a check | Press it. A sheet: the picture, the verdict, where it is kept, **Hear it again**, **Move**, **Delete**. | The same, as a box with the picture on the left. |
| Hear it again | Goes to Ask with that picture and speaks the answer again. Nothing is sent anywhere. | Same. |
| Move a check | **Move**, then press a project, or **New project**. | Same. |
| New project | **New project**, type a name, **Save**. | Same. |
| Rename a project | Open it, **Rename**. | Same. |
| Delete a check | **Delete**, then confirm. | Same. |

An empty project says "Nothing here yet". An empty My checks says "Every check you make is kept on this phone."
Typing is used here and nowhere in the core flow; this page is for whoever keeps the household papers in order.

### N. What WeKnow remembers

Prototype scenes: First time it offers to remember, The notes page, and the two result scenes.

WeKnow keeps notes about the household on the device and nowhere else. Signing in does not copy them.

**What it can note**

| Kind | Example | Comes from |
|---|---|---|
| Shops and what was paid | Marlow Street Garage. Oil change and tire rotation, $118. 14 March 2026. Labor $95 an hour. | A quote or invoice she showed |
| People she pays | Pinefield Water & Power. Account ending 8815. Last bill 3 October 2026. | A bill that looked normal |
| Appliances and devices | Washing machine. Alder WF-710, from its nameplate. Shook on spin; one foot was short. | A nameplate she pointed at, and what was fixed |
| How she likes WeKnow | Voice speed, text size, language. | Her own choices in Settings |

**The first time it offers** (after flow D, step 10)

| # | The person | WeKnow says | WeKnow shows |
|---|---|---|---|
| 1 | Finished a quote from a shop WeKnow has no note about. | "Shall I remember this shop for next time? I keep notes only on this phone. They never leave it." | A sheet: "Shall I remember this shop for next time?" A green box with the note exactly as it would be written: "Marlow Street Garage. Brake repair quote, $1,240. Labor $120 an hour." Under it: "Notes never leave this phone. You can read, change or delete them any time." **Remember** / **No**. |
| 2a | "Yes." | "I wrote it down. You can read my notes under What WeKnow remembers." | The tag "From your notes on this phone" under that sentence; pressing it opens the page. |
| 2b | "No." | "All right. I will not." | Nothing is written. |

Rules for remembering:
- Never silent. A new shop, payee or appliance is always asked about. Something added to a shop it already knows is
  said out loud: "I added today's quote to my notes on this phone."
- The explanation ("only on this phone, they never leave it") is spoken the first time ever. After that the
  question is one sentence; the line under the box stays.
- Never offered after an amber or red verdict about money, and never more than one question after an answer.
- "Offer to remember new things" on the notes page turns the questions off. Then nothing new is written.

**Where a note shows up in an answer**

- One short sentence, after the verdict and its reason, before WeKnow's closing question.
- Marked by a small tag directly under it: a notebook and "From your notes on this phone". Pressing the tag opens the
  page.
- Listed again under "Stayed on this phone" in "Where this answer came from".
- Examples: "Same shop as last March. Labor was $95 an hour then. Now it is $120." "The account is new. You paid them
  at one ending 8815 before." "Your washer, the Alder WF-710, shook last October too. One foot was short."
- At most one note in one answer. If a note and a price book disagree, WeKnow says both and does not choose.

**The page** (Menu, or Settings, or the bottom of My checks)

- At the top, on a green band with the device icon: **Only on this phone.** "WeKnow keeps these notes on this phone
  and nowhere else. Not in your account. Not on the internet. It asks before it writes a new one, and it uses them
  to give you better answers."
- Four groups, each note with **Change** and **Delete**: Shops and what you paid. People you pay. Your appliances
  and devices. How you like WeKnow.
- **Change** opens three plain fields. **Delete** removes the note at once and leaves "Deleted 'Marlow Street
  Garage'. **Put it back**" at the top until she leaves the page.
- "Offer to remember new things": a switch.
- "Backup locked with your own passphrase": a row marked **Coming later**. It will let her move her notes to a new
  phone in a form only she can open.
- **Forget everything**, then confirm: deletes every note on the page. Her checks stay in My checks.
- On a phone the groups are one column. On a desktop they are two columns of cards under the band.

### O. Settings

Prototype scene: Settings. One column of cards on a phone. On a desktop, a list of the sections on the left that
jumps to each card.

| Card | What is in it |
|---|---|
| Account | Signed in or not, in one line. What signing in carries and what stays. **Sign in with Google** or **Sign out**. |
| Voice and text | Voice on or off ("Off shows the words only"). Slower / Normal / Faster. Three text sizes. |
| Screen | Light / Dark / System. |
| Language | English. Traditional Chinese is listed as coming later. |
| Privacy | Two boxes side by side: **Stays on this phone** and **May go over the internet, after you say yes**. The switch "Ask me every time before using the internet". Whether this phone works without the internet, with **Get ready**. |
| Notes and payees | "Kept on this phone only." Two rows into flow N: What WeKnow remembers, Known payees. |
| Family | Person to call when unsure. Set up for someone else. |
| Delete my data | Deletes every check, project, note and setting from this phone. One button, then confirm. |

### P. Light and dark

- Three choices: Light, Dark, System. Light is the first setting. System follows the device.
- The choice is in the Menu drawer, under "Screen", and in Settings, under "Screen". Both show all three choices at
  once; neither is a hidden toggle.
- Both themes are complete. The picture from the camera and the marks drawn on it look the same in both.

## 5. Spoken and shown

| | Spoken | Shown |
|---|---|---|
| Answers, questions, cautions | Always | Always, same words, as large captions. The sentence being spoken is darkest. |
| Prices, step numbers, the sentence for the shop | Always | Always, and they stay |
| The verdict (three or four words) | As part of the first sentence | Always, at the top, with a shape and a colour |
| Where it ran | The first time ever, and every time the internet is used | Always, as the tag |
| A note from memory | One sentence | The sentence, and the tag "From your notes on this phone" |
| Where the check was kept | Once, in the closing sentence | On a desktop, "Kept in The car" |
| Sources | Only if she asks "how do you know?" | In "Where this answer came from" |
| Fillers ("Let me look.", "Good.") | Always | As captions |
| Marks on the picture (bars, ticks, boxes) | Described in the sentence ("line 3") | Always |
| Progress while getting ready | At start and at the end only | A small label with a percentage |
| Menu, My checks, the notes page, Settings | Not spoken. These are read and pressed. | Always |
| Technical details | Never | One closed section inside the sheet |

Sounds without words: one soft sound when listening starts, one when it ends. Nothing else beeps.

## 6. When something goes wrong

Prototype scenes: the "When things go wrong" group. Every state is spoken, and every state has one clear way out.

| Id | State | WeKnow says | Shows | Way out |
|---|---|---|---|---|
| E1 | Did not hear (first time) | "Sorry, I did not hear that. Say it once more." | "I didn't hear that". Listens again. | Speak |
| E2 | Did not hear (second time) | "I still cannot hear you. Press one of these instead." | Three questions as buttons, chosen for what is in view, and **Type instead** | Press one |
| E3 | Too dark, phone | "It is too dark for me to see. I am turning on the light." | "Too dark", then "Light on" | Nothing to do |
| E3 | Too dark, desktop | "It is too dark for me to see. Turn on a lamp, or move near a window." | "Too dark" | Ask again |
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

- A chat thread, bubbles, or any scrolling history of the conversation on the Ask screen.
- A text box as the main way in. Typing exists only as "Type instead" after two failed listens, and for names in My
  checks and the notes page.
- A sign-up, a sign-in wall, an email field, a password, a profile page.
- A welcome tour, a carousel, tips of the day.
- A picker for what kind of thing this is, or a "which project?" question after an answer.
- A home page of tiles or a feed. The camera is the home page; My checks is one press behind Menu.
- Tabs along the bottom. Navigation is the Menu drawer, on every size of screen.
- Settings for the model, the pack, or the route. People choose "ask every time", not "on-device".
- The words AI, model, cloud, on-device, sync, cache, token, offline or consent anywhere a person reads or hears them.
- Sparkles, glows, purple gradients, an animated orb, a mascot, a typing indicator.
- Confidence percentages on answers.
- Notifications, badges, streaks, reminders.
- Remembering anything silently. Sending notes, checks or pictures to an account.
- Payments, saved cards, "pay this bill". Opening links found in letters.
- Guiding other apps or sharing the screen.
- Sharing to social media. A view where one person watches what another asks.
- Sending live video to the internet. WeKnow sends a still or words, after asking.
- Reading several pages, handwriting, or medicine labels in this version.
- Any logo, brand name or real company in the product, the samples or the video.

## 8. What the video has to show

In order, and none of it needs a caption to be understood:

1. A person, the phone, a sink. She presses the one button and asks out loud. WeKnow answers out loud. (10 seconds)
2. Step by step with her hands in the picture: "Good. The cover is off."
3. The quote: the bars sliding over her name, the ticks, the amber box on line 3, "$180 high".
4. The asking sheet with the two words that would be sent, and her saying "yes".
5. "Same shop as last March. Labor was $95 an hour then. Now it is $120." with the tag "From your notes on this phone".
6. The tag changing between "On this phone" and "Used the internet for 1 item"; the same quote a second time with
   the phone in flight mode.
7. The letter: "The account is new. You paid them at one ending 8815 before." "Don't pay this yet", and **Call Daniel**.
8. Her son at a laptop: the same thing in the desktop layout, the card showing what went over the internet, My
   checks with three projects, and the page that says "Only on this computer".

## 9. Build notes

- Sound and the model download each start from a press in the browser. The Start button is the press for sound. The
  offer in flow H is pressed, and on the web the voice adds "Press Get ready to start."
- On a device that cannot read by itself, papers are read into words on the device (plain text recognition) and
  personal details are covered there. The asking sheet (flow F, variant 3) shows those covered words, and only they
  are sent.
- "City" for prices comes from the quote itself (city and state only) or from a place set once in Settings.
- In step by step, WeKnow looks at one still picture each time she says "done" or presses Next.
- Checks, projects and notes are stored on the device. A check holds the words and the picture with details covered.
- Notes are plain records (kind, name, what, when). The program, not the model, decides when a note applies: same
  shop name, same payee name, same nameplate. The model only reads the name off the picture.
- A new check is filed by kind: the project that already holds that pack's checks, otherwise the project used last.
- The yes to using the internet, and the person to call, are stored on the device only.
