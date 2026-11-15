# WeKnow UI specification

How every screen is laid out on a phone and on a laptop, the type, the colours, the components, the motion, the
voice, and every string. The flows are in `USERFLOW.md`. `prototype.html` implements this document; where the two
differ, the prototype is right about looks and this document is right about rules.

## 1. The idea

- **A window and a deck.** The top of the screen is a window onto the camera. Under it is a solid deck that holds
  the words and one large button. Text never sits on top of the moving picture, so it is always readable.
- **One button that feels like a button.** Round, flat-faced, with a darker rim below it that it sinks into when
  pressed. It is also the mark of the product: the green dot in the wordmark is the same button.
- **Three colours people already know.** Green for go and fine, amber for look closer, red for stop. Each always
  comes with a shape and a word. Blue means one thing only: something went over the internet.
- **Light, plain, quiet.** A cool porcelain ground, near-black ink, no gradients, no glow, no sparkle, no chat
  bubbles. Dark is available from a switch in Help and nowhere else.

## 2. Layout

The layout follows the width of the app, not the kind of device.

| Width of the app | Layout |
|---|---|
| under 640 px | Phone: one column |
| 640 to 899 px | Phone layout in a column 40rem wide, centred |
| 900 px and over | Laptop: two columns, 1.18 to 1, at most 84rem wide |

It must hold from 320 px wide, in portrait and landscape, at the largest text size, and at 200% browser zoom.

### 2.1 Phone: Home

```
┌──────────────────────────┐
│ ┌──────────────────────┐ │
│ │ ┌      ● Camera on  ┐│ │  window: 54% of the height when ready or listening
│ │                      │ │          23% while looking and answering
│ │     camera view      │ │          44% in step by step
│ │                      │ │
│ │ └                   ┘│ │
│ └──────────────────────┘ │
│  You asked: "..."        │  words area: takes the rest, scrolls inside itself
│  ▲ One line is high      │    verdict stays pinned at the top of this area
│  Line 3, brake labor ... │    sentences
│  [ Yes, tell me ][ No  ] │    choices
│  ⓘ Used the internet ... │    tag stays pinned at the bottom of this area
│                          │
│ [Earlier]  ( Ask )  [Help]│  deck: never moves, never scrolls
└──────────────────────────┘
```

- Gutter 0.75rem. Gap between window, words and deck 0.75rem. The deck respects the safe area at the bottom.
- The window changes height between phases over 280 ms. The picture always shows the whole subject (it is fitted,
  never cropped), so marks on it are never cut off.
- When the words do not fit (largest text size), the verdict, the choices and the tag stay visible and the sentences
  scroll under the verdict. The newest sentence is always in view.

### 2.2 Laptop: Home

```
┌──────────────────────────────────────────────────────────────────────┐
│ ● WeKnow                                   ▭ Works without the internet │
│ ┌────────────────────────────────┐   ▲ One line is high                │
│ │ ┌                            ┐ │   Line 3, brake labor, is $180 high. │
│ │                                │   Shops near you charge about $240.  │
│ │          camera view           │   [ Yes, tell me ] [ No thanks ]     │
│ │                                │  ┌───────────────────────────────┐   │
│ │ └                            ┘ │  │ ⓘ Used the internet for 1 item │   │
│ └────────────────────────────────┘  │ ▭ Stayed on this computer      │   │
│ No camera handy?  [▢] [▢] [▢]       │   The picture ...              │   │
│ Try a picture.                      │ ⓘ Went over the internet       │   │
│      [Earlier]  ( Ask )  [Help]     │   ┌ "Brake fluid flush" price ┐│   │
│        The space bar works too      │ Sources and details            │   │
└──────────────────────────────────────────────────────────────────────┘
```

- Left column: window (fills the height that is left), sample pictures, the deck. Right column: the words, then the
  "where this answer came from" panel, always open once there is an answer.
- The header holds the wordmark and one status line (section 7.4). Nothing else.
- Sample pictures are hidden in step by step, and the window takes their room.
- Sheets become centred boxes 37rem wide (Help and Set up: 44rem).

### 2.3 Welcome and Allow

```
Phone                              Laptop: the same, centred, in one column
┌──────────────────────────┐
│        ● WeKnow          │
│      Point at it.        │
│     Ask out loud.        │       Point at it. Ask out loud. Hear what to do.
│    Hear what to do.      │
│  [▢]     [▢]     [▢]     │       three pictures, a question under each
│ "Why.."  "Is.."  "Should"│
│        ( Start )         │
│ No account. No typing.   │
│ Turn your sound up.      │
└──────────────────────────┘
```

Allow shows a heading ("Press Allow"), one line, and an arrow with "Press this one". The arrow must point at the real
system box: top left under the address bar in desktop Chrome, centre of the screen on iPhone. The words on the
highlighted button must match the button the system really shows on that platform.

### 2.4 Sheets

- Phone: rise from the bottom, top corners 1.5rem, at most 90% of the height. Earlier, Help and Set up fill the
  screen. A **Close** button with the word, top right, never an "x" alone.
- The asking sheet has no Close and does not close when the dark area is pressed. Its two buttons are the only ways
  out; Escape counts as No.
- Laptop: centred box, the page dimmed behind.

## 3. Sizes

| Thing | Size |
|---|---|
| Big button | 8rem across (128 px), or 36% of the app width if that is smaller |
| Left and right buttons | 4.9rem square (78 px), or 23% of the width |
| Yes/no buttons | at least 3.75rem tall (60 px), full width in two columns; stacked when there are three or more |
| Any other control | at least 2.75rem (44 px) in both directions |
| Space between two controls | at least 0.5rem |
| Corner radius | window 1.25rem, buttons 1rem, tag and chips 0.55 to 0.6rem, verdict band 0.9rem, sheets 1.5rem |

No control needs holding, dragging, swiping, double pressing or a long press.

## 4. Type

**Family.** Atkinson Hyperlegible Next, hosted with the app (open licence). It was drawn so that 1, l and I, and 0
and O, cannot be confused, which matters for prices and account numbers. Fallback: the system font. Chinese falls
through to PingFang TC or Noto Sans TC. One family, four weights (500, 600, 700, 800). No italics, no capitals for
labels, no letter-spacing tricks.

All sizes are in rem so the device's own text size and the browser's zoom both work.

| Use | Phone | Laptop | Weight | Line height |
|---|---|---|---|---|
| Verdict | 1.875rem (30 px) | 2.3rem | 700 | 1.12 |
| Step instruction, words as heard, sentence for the shop | 1.5rem (24 px) | 1.8rem | 700 | 1.32 |
| Spoken sentences (captions) | 1.375rem (22 px) | 1.55rem | 500 | 1.32 |
| Big button word | 1.625rem (26 px) | same | 700 | 1 |
| Yes/no buttons, rows in Help, sheet text | 1.25rem (20 px) | same | 700 / 600 / 500 | 1.15 to 1.35 |
| Sheet title | 1.625rem | same | 700 | 1.15 |
| Welcome line | 1.8rem | 2.9rem | 700 | 1.18 |
| Smallest text anywhere (tag, chips, "You asked", small notes) | 1.0625rem (17 px) | same | 600 / 500 | 1.2 to 1.35 |

- Nothing is ever smaller than 17 px at the default setting.
- Help has three text sizes: 100%, 115%, 130% of the root size. They multiply whatever the device already asks for.
- Captions: the sentence being spoken is in full ink; earlier sentences in the second ink; all go to full ink when
  speaking ends.
- Lines are at most about 34 characters on a phone and 60 on a laptop.

## 5. Colour

Text and its ground reach 7 to 1 or better. Borders of controls reach 3 to 1 against what is behind them.

| Token | Light | Dark | Used for | Contrast (light / dark) |
|---|---|---|---|---|
| `ground` | `#EDF0EC` | `#0F1613` | the deck, page | |
| `surface` | `#FFFFFF` | `#19231E` | buttons, sheets, tag | |
| `sunk` | `#E1E6E1` | `#0A0F0D` | switch track, progress track, camera-off panel | |
| `ink` | `#14211C` | `#F2F6F3` | text | 14.5 on ground / 16.8 |
| `ink-2` | `#3F4F48` | `#B9C6BF` | secondary text, earlier captions | 7.5 on ground / 10.4 |
| `line` | `#76847C` | `#6E7D75` | borders of controls | 3.4 on ground / 4.2 |
| `hair` | `#CDD5CF` | `#2C3832` | dividers only | |
| `go` | `#075C3D` | `#37C98B` | big button, yes buttons, ticks, switch on | white on go 8.1 / dark ink on go 7.8 |
| `go-deep` | `#04402B` | `#1F8A5D` | the rim under green buttons | |
| `ok-bg` | `#DDF1E6` | `#123524` | green verdict band | ink 14.1 / 12.3 |
| `warn-bg` | `#FFE9A6` | `#3F2E00` | amber verdict band, caution band, "not checked" tag | |
| `warn-ink` | `#4A3000` | `#FFD978` | text on amber | 10.2 / 9.6 |
| `warn-line` | `#7A4B00` | `#E0A400` | amber icon and border | 6.2 on warn-bg / 5.9 |
| `stop` | `#A31B12` | `#FF8A7A` | red icon | 7.7 on surface / 7.1 |
| `stop-bg` | `#FDE4E0` | `#431511` | red verdict band | ink 13.7 / 14.2 |
| `net` | `#1849A9` | `#9CC0FF` | anything that went over the internet | 8.2 on surface / 8.8 |
| `net-bg` | `#E3ECFB` | `#14294D` | internet tag, the "what would be sent" box | net 6.9 / 7.8 |
| `key` | `#14211C` | `#F2F6F3` | the Stop face of the big button | white 16.6 / dark 16.8 |

Rules:
- Light is the default whatever the device is set to. Dark comes only from the switch in Help.
- Colour never carries meaning alone: verdicts have a shape and words, the tag has an icon and words.
- Marks drawn on the picture (cover bars `#14211C`, ticks `#0A7A4F`, amber `#B86E00`, blue `#1849A9`, red `#B3261E`)
  do not change with the theme, because the picture does not.
- No gradients. Two shadows only: the hard rim under a button, and a soft shadow under sheets and under labels that
  sit on the picture.

## 6. Components

**Big button.** Round, `go` face, white word and icon. A 0.4rem rim of `go-deep` below it. Pressed: it moves down
0.26rem and the rim nearly disappears (80 ms). Four faces:

| Face | Icon and word | When | A press does |
|---|---|---|---|
| Ask | microphone, "Ask" | ready; after an answer; while yes/no buttons are showing | starts listening (and drops the open question) |
| Listening | five bars that follow the voice, a slow ring around the button | listening | ends listening now |
| Stop | square, "Stop", `key` colour | looking, speaking | stops talking and looking; keeps what is on screen |
| Next | arrow, "Next" | step by step | "done, look and go on" |

Start on the Welcome screen is the same button with one word. The word on the button is at most five letters in
English and three characters in Chinese.

**Left and right buttons.** White squares, 2 px `line` border, icon above a word. Left: Earlier, or Again in step by
step. Right: Help, or Stop in step by step.

**Window.** Rounded, 1 px `line` border. Four white corner marks, 1.1rem in from the corners. Labels on it, on solid
white with a soft shadow, never see-through:
- top centre, while live: a green dot and "Camera on". While WeKnow works on a still picture there is no label; the
  corner marks close in by 0.5rem instead. "Too dark" has an amber dot, "Light on" a green one.
- bottom centre, only when it matters: "No internet. Still works." or "Getting ready: 42%".
- Camera off: the window turns into a flat `sunk` panel with a crossed camera and "The camera is off".

**Marks on the picture.**
- Cover bars: solid, one per personal field, slide in left to right, 120 ms apart.
- Tick: a 13 px filled circle with a white check at the end of a line. Green: known and fair. Amber with "!": high.
  Blue with "?": not known yet (plus a dashed blue box round the line). Blue with a check: looked up just now.
- High line: amber box round the whole line and a small amber label, "$180 high".
- Warning sign in a letter: red box round the sentence and a numbered red dot, matching "One." and "Two." as spoken.
- Step by step: a dashed white ring round the part to touch.

**Words area.** In order: "You asked: ..." (small, second ink, hidden once a verdict is up), the step bar (step by
step only), the verdict, the sentences, the choices, the tag.

**Verdict.** Icon and three or four words on a tinted band.

| Tone | Icon | Band | Examples |
|---|---|---|---|
| fine | circle with a check, `go` | `ok-bg` | You can fix this. This looks fair. This looks normal. Well done. |
| look closer | triangle with "!", `warn-line` | `warn-bg` | One line is high. Check this first. Time for a plumber. |
| stop | eight-sided stop sign with a bar, `stop` | `stop-bg` | Don't pay this yet. Stop. Do not try this. |
| plain | a small icon or none, no band | none | I'm listening. I didn't hear that. Say this to the shop. Nothing was sent. |

**Step bar.** "Step 2 of 5" and five short bars: done (filled green), now (green outline), to come (grey).

**Choices.** At most two side by side; the first is the likely one, filled green with a rim. Three or four stack in
one column. Each can also be said out loud.

**Caution band.** Amber band, triangle, one sentence, weight 600.

**Tag, receipt, asking sheet.** Section 7.

**Rows in Help.** One line of words on the left, one control on the right, at least 4rem tall. Switches are 4.4 by
2.6rem and carry the word On or Off inside them. Choices of three are joined buttons; the chosen one is filled with
ink.

**Earlier row.** A picture (personal details covered), a title, the verdict with its icon, the day.

## 7. Where it ran

This is the one place the product shows how it works. It has to be small, honest and always there.

### 7.1 The tag

One line under every answer, with an icon. It names the device in the person's word: phone, tablet, or computer.

| State | Icon | Words | Colours | Spoken |
|---|---|---|---|---|
| All on the device | the device with a dot inside | On this phone | ink on white, `line` border | First answer ever only: "I worked that out right here, on this phone. Nothing left it." |
| One or more facts looked up | globe | Used the internet for 1 item | `net` on `net-bg` | Every time: "I am looking that one up on the internet." |
| The device cannot read by itself | globe | Answered using the internet | `net` on `net-bg` | Asked the first time; said each time after |
| No internet, answered anyway | crossed signal | No internet. Answered on this phone. | ink on white | Only if she asks |
| Something could not be checked | triangle | 1 item not checked | `warn-ink` on `warn-bg` | Every time: "One is not checked." |

- On a phone the tag is the last thing in the words area and stays pinned to its bottom edge. It is a button, with a
  small chevron, and opens the sheet in 7.2.
- On a laptop the tag is the heading of a panel that is always open beside the answer.
- The tag never moves, blinks or animates. It never says a brand, a model name or a number of seconds.

### 7.2 "Where this answer came from"

Two lanes, always both, always in this order, then what was kept and the sources.

```
ⓘ Used the internet for 1 item
▭ Stayed on this phone
   The picture
   Your name, phone, address and plate (covered)
   7 of 8 price checks
ⓘ Went over the internet
   ┌ - - - - - - - - - - - - - - ┐
     "Brake fluid flush" price
     City: Austin, TX
   └ - - - - - - - - - - - - - - ┘
   Nothing else was sent.
✓ Kept for next time
   That price is now on this phone. Next time this line works without the internet.
Where the facts come from
   Repair price book, Texas              checked 12 Nov 2026
   Published cost guide, found today     16 Nov 2026
▸ Technical details
```

- When nothing went over the internet, the second lane still appears and says "Nothing."
- The dashed blue box is the same box, with the same words, as the one in the asking sheet. What was shown before
  sending is what is listed after sending.
- Sources are named by kind and date. No logos. Addresses of the pages are inside Technical details.
- **Technical details** is closed by default and is the only place where terms such as model, request and pack
  version may appear: which model read the picture, how long it took, how many requests and how many bytes left the
  device, the pack version. It is there for helpers and reviewers.

### 7.3 The asking sheet

```
ⓘ May I look up one thing on the internet?
This is all I would send:
┌ - - - - - - - - - - - - - - ┐
  "Brake fluid flush" price
  City: Austin, TX
└ - - - - - - - - - - - - - - ┘
Not sent: the picture, your name, phone, address or plate.
[ Yes, look it up ]   [ No, skip it ]
```

- One question as the title, in the first person. The box shows the real payload: the actual words, or a small copy
  of the actual picture. Never a description such as "some data".
- One line of what is not sent. Two buttons. Yes is green and first. No is always there and always works.
- The whole sheet is spoken; "yes" and "no" out loud are accepted.
- The same sheet shape, with a device icon and no box, is used for the offer to work without the internet.

### 7.4 The status line (laptop header)

| Device | Words |
|---|---|
| Model ready | Works without the internet |
| Getting ready | Getting ready: 42% |
| Cannot read by itself | Using the internet |
| No connection | No internet |

On a phone the same information appears only when it matters, as the label at the bottom of the window.

## 8. Motion

| What | How | Time |
|---|---|---|
| Press of any button | moves down into its rim | 80 ms |
| Window changes height between phases | eases | 280 ms |
| Looking at a still picture | corner marks close in | 200 ms |
| Reading a paper | one white line sweeps down and back while it reads | 1.25 s each way |
| Cover bars | wipe in left to right, one after another | 220 ms, 120 ms apart |
| Ticks, boxes, flags on the picture | fade in | 250 ms |
| Sheet | rises (phone) or fades in (laptop) | 220 ms |
| Listening | bars follow the voice; a slow ring breathes round the button | 1.5 s |

- Motion only answers something the person or WeKnow just did. Nothing moves while the screen is waiting.
- No spinners, no shimmer, no typing dots, no entrance effects when a screen opens.
- With "reduce motion" on: every transition is off, the bars stand still, the reading line is not drawn.

## 9. Sound and voice

**The voice**
- The device's own voice, the best one that works without the internet. Pace 0.92 of normal (about 150 words a
  minute). Help offers Slower (0.8), Normal, Faster (1.2).
- First person, calm, plain. Short sentences, 14 words at most, one instruction in each. No exclamation marks, no
  jokes, no "As an assistant". It says "I do not know" when it does not.
- Praise is one word after a confirmed step: "Good."
- Numbers are spoken in full and shown as figures. It never reads out a web address.
- It never asks "Did you say ...?". What it heard is shown as "You asked: ...".
- Its last sentence is the question, when there is one.

**Listening**
- Starts with a press. Ends by itself after 2 seconds of quiet (2.5 on Slower), never in the middle of a word.
- After WeKnow asks a question the microphone opens by itself. Silence is not an error.
- Words always understood: yes, no, next, done, again, wait, stop, help.

**Waiting**
- Under 2 seconds: nothing extra. Over 6 seconds: "Still looking." once. Over 15 seconds: "This is taking a while. I
  am still here."

**Sounds**
- Two only: a soft pair of rising notes when listening starts, one lower note when it ends. Like a knuckle on wood,
  not a chime. Quieter than the voice. No sound for errors; errors are spoken.
- Phone: a light tap when listening starts and ends, a firm tap with a red verdict.

**Voice off**
- A switch in Help. Captions carry everything. With a screen reader running, WeKnow's own voice turns itself off and
  the captions are announced through the screen reader instead, so two voices never talk at once.

## 10. Every string

`{device}` is phone, tablet or computer. `{name}` is the person to call. Spoken lines are also shown as captions.
Strings are whole sentences with placeholders; nothing is glued together from parts, so Chinese can be added by
translating the table.

### Welcome and Allow

| Id | Text |
|---|---|
| welcome.line | Point at it. Ask out loud. Hear what to do. |
| welcome.q1 / q2 / q3 | "Why won't this drain?" / "Is this a fair price?" / "Should I pay this?" |
| welcome.start | Start |
| welcome.fine | No account. No typing. Turn your sound up. |
| allow.title | Press Allow |
| allow.line | So WeKnow can see and hear. |
| allow.point | Press this one |
| allow.fine | Pictures stay on this {device} unless you say yes. |
| allow.say | Hello. I'm WeKnow. A box has appeared. Press Allow, so I can see and hear. |
| allow.say.three | Hello. I'm WeKnow. Three boxes will appear. Press Allow on each. |
| first.say | Good. Now point me at something. Press Ask, and tell me what's wrong. |

### Home

| Id | Text |
|---|---|
| home.coach | Point at it. Press Ask. Say what's wrong. |
| btn.ask / stop / next | Ask / Stop / Next |
| btn.earlier / help / again | Earlier / Help / Again |
| home.space | The space bar works too |
| home.samples | No camera handy? Try a picture. |
| chip.live / dark / light | Camera on / Too dark / Light on |
| note.offline / getting | No internet. Still works. / Getting ready: {n}% |
| listen.title | I'm listening |
| asked | You asked: "{words}" |
| asked.earlier | From earlier today |
| look.thing / look.paper | Let me look. / Let me read it. |
| wait.6 / wait.15 | Still looking. / This is taking a while. I am still here. |
| first.local | I worked that out right here, on this {device}. Nothing left it. |
| first.offline | There is no internet, so I worked it out right here, on this {device}. |
| kept | All right. You will find it under Earlier. |

### A thing, and step by step

| Id | Text |
|---|---|
| fix.title | You can fix this |
| fix.what | This looks like a slow drain. Most likely hair. |
| fix.offer | It takes about 15 minutes. Shall I talk you through it? |
| fix.yes / no | Yes, guide me / Not now |
| guide.before | Before you start |
| guide.need | You need a plastic drain tool, or a bent wire hanger. |
| guide.caution | One caution. If you poured drain cleaner in, do not use the tool. |
| guide.step | Step {n} of {total} |
| guide.1 to 5 | Take off the drain cover. Some lift out. Some unscrew. / Wipe the hair and soap off the cover. / Push the tool into the drain. Twist it. Pull it out slowly. / Wipe the tool. Do it again until nothing comes up. / Run hot water for one minute. Then put the cover back. |
| guide.ok.1 to 5 | Good. The cover is off. / Good. That is clean. / Good. I can see hair on the tool. / Good. Nothing more is coming up. / Good. The water is going down. |
| guide.notyet | I can still see the cover. Take it off, then say done. |
| guide.done.title | All five steps done |
| guide.done.ask | Is the water going down now? |
| guide.yes / no | Yes / No |
| guide.good.title / line | Well done / A small mesh screen over the drain stops this from coming back. |
| guide.pro.title | Time for a plumber |
| guide.pro.line | A fair price to unclog a drain is $175 to $600. Most people pay about $385. When you get a quote, show it to me and I will check it. |
| guide.stop.title | Stopped at step {n} |
| guide.wait | No hurry. I will wait. |
| guide.carry / finish | Carry on / Finish for now |
| danger.title / line | Stop. Do not try this. / This needs a professional. {reason} |

### A quote

| Id | Text |
|---|---|
| quote.covered | I covered your name, phone, address and plate. They stay on this {device}. |
| quote.known | I know seven lines. One I do not: brake fluid flush. |
| quote.known.all | I know all eight lines. One I kept from last time. |
| quote.looking | I am looking that one up on the internet. |
| quote.found | Found it. That line is fair. I will keep it for next time. |
| quote.skip | All right. I will skip that line. |
| quote.wait | There is no internet, so that line has to wait. |
| quote.cloud | I am checking the prices on the internet. |
| quote.high.title | One line is high |
| quote.fair.title | This looks fair |
| quote.high.1 | Line 3, brake labor, is $180 high. |
| quote.high.2 | Shops near you charge about $240. The other lines look fair. |
| quote.high.2.part | Shops near you charge about $240. Six lines look fair. One is not checked. |
| quote.mark | $180 high |
| quote.words.ask | Want words to say to the shop? |
| quote.words.yes / no | Yes, tell me / No thanks |
| quote.say.title | Say this to the shop |
| quote.say.line | "Could you go over the brake labor with me? Other shops near me charge about $240." |
| quote.say.done / again | Done / Say it again |
| quote.small | I can't read the small words. Move closer to the top half. |

### A bill or a letter

| Id | Text |
|---|---|
| letter.covered | I covered your name, address and account number. They stay on this {device}. |
| letter.cloud | I am checking it on the internet. |
| letter.stop.title | Don't pay this yet |
| letter.check.title | Check this first |
| letter.fine.title | This looks normal |
| letter.sign.account | One. It wants the money sent to a new account. |
| letter.sign.rush | Two. It rushes you: 48 hours. |
| letter.do | Call the company first. Use the number on an older bill, not this letter. |
| letter.call | Call {name} |
| letter.again | Say it again |
| letter.calling | Calling {name}. |

### The internet

| Id | Text |
|---|---|
| ask.item.title | May I look up one thing on the internet? |
| ask.send | This is all I would send: |
| ask.item.not | Not sent: the picture, your name, phone, address or plate. |
| ask.item.yes / no | Yes, look it up / No, skip it |
| ask.item.say | May I look that one up on the internet? I would send only those words, and your city. Not the picture. |
| ask.thing.title | May I send this picture over the internet? |
| ask.thing.body | This {device} cannot read pictures by itself. This is all I would send: |
| ask.thing.not | I will tell you every time I use the internet. |
| ask.thing.yes / no | Yes, send it / No |
| ask.paper.title | May I check this on the internet? |
| ask.paper.body | I read the words here, on this {device}, and cover your details first. This is all I would send: |
| ask.paper.box | The 8 lines and their prices. Your details are covered. |
| ask.paper.not | Not sent: the picture, your name, phone, address, plate or account number. |
| ask.paper.yes / no | Yes, check it / No |
| ask.paper.say | This {device} cannot check papers by itself. I cover your details first. May I check the rest on the internet? |
| ask.new.title | May I look this up on the internet? |
| ask.new.not | Not sent: the picture. |
| ask.new.yes / no | Yes, look it up / No thanks |
| ask.none.title | Nothing was sent |
| ask.none.line | All right. This {device} needs the internet to see, so I cannot answer this one. Ask me again any time. |
| tag.local | On this {device} |
| tag.mixed | Used the internet for {n} item |
| tag.cloud | Answered using the internet |
| tag.offline | No internet. Answered on this {device}. |
| tag.pending | {n} item not checked |
| where.title | Where this answer came from |
| where.stayed | Stayed on this {device} |
| where.sent | Went over the internet |
| where.nothing / where.else | Nothing. / Nothing else was sent. |
| where.kept | Kept for next time |
| where.kept.line | That price is now on this {device}. Next time this line works without the internet. |
| where.waiting | One line is waiting for the internet: brake fluid flush. |
| where.declined | You said no, so one line was not checked: brake fluid flush. |
| where.facts | Where the facts come from |
| where.more | Sources and details |
| where.tech | Technical details |
| status.ready / cloud / none | Works without the internet / Using the internet / No internet |
| ready.offer.title | Shall I get ready to work without the internet? |
| ready.offer.line | It takes about 20 minutes. You can keep using me while I do. |
| ready.offer.fine | One time only. Best on home Wi-Fi. |
| ready.offer.yes / no | Get ready / Not now |
| ready.offer.web | Press Get ready to start. |
| ready.started | I have started. I will tell you when I am ready. |
| ready.later | All right. You can do it later, under Help. |
| ready.almost | Getting ready: almost there |
| ready.done | I am ready. I can work without the internet now. |
| ready.full | This {device} is too full to get ready. WeKnow will keep using the internet. |
| net.none.title | No internet |
| net.none.line | There is no internet, and this {device} needs it to see. Your earlier answers still work. |
| net.none.btn | Open Earlier |
| net.stopped | The internet stopped. Here is what I know from this {device}. |

### When something goes wrong

| Id | Text |
|---|---|
| hear.title | I didn't hear that |
| hear.1 | Sorry, I did not hear that. Say it once more. |
| hear.2 | I still cannot hear you. Press one of these instead. |
| hear.q1 / q2 / q3 | What is this? / How do I fix it? / Is this a fair price? |
| hear.type | Type instead |
| dark.title | It is too dark |
| dark.phone | It is too dark for me to see. I am turning on the light. |
| dark.better | That is better. Press Ask when you are ready. |
| dark.computer | It is too dark for me to see. Turn on a lamp, or move near a window. |
| see.still / back / closer | Hold still. / Move back a little. / Come closer. |
| see.which | I can see {thing}. Is that what you mean? |
| new.title | I don't know this one yet |
| new.line | I can see {thing}. I do not have a guide for it yet. |
| new.offline | There is no internet now. Ask me again when it is back. |
| new.found.title | Here is how |
| new.kept | I kept that, so next time I know it without the internet. |
| no.medicine | I can't help with medicine. Please ask your pharmacist. |
| cam.panel | The camera is off |
| cam.title | I cannot see |
| cam.line | The camera is turned off for WeKnow. |
| cam.how / cam.pic | Show me how to turn it on / Use a picture instead |
| cam.how.phone | Open Settings. Press WeKnow. Switch Camera on. Then come back. |
| cam.how.computer | Press the small camera picture at the top, next to the web address. Choose Allow. |
| mic.line | I cannot hear. The microphone is turned off for WeKnow. |
| sound.off | Turn your sound up to hear me. |

### Earlier, Help, Set up

| Id | Text |
|---|---|
| earlier.title | Earlier |
| earlier.empty | Your answers are kept here, on this {device}. |
| close | Close |
| help.title | Help and settings |
| help.how | Hear how WeKnow works |
| help.how.say | Point me at something. Press Ask, and say what's wrong. I will look, and tell you what to do. |
| help.size | Text size |
| help.speed | Voice speed: Slower / Normal / Faster |
| help.speed.say | This is how fast I will talk. |
| help.voice | Voice. Off shows the words only |
| help.dark | Dark screen |
| help.every | Ask me every time before using the internet |
| help.dev.ready | This {device} works without the internet. Ready. Guides and prices were last checked on {date}. |
| help.dev.can | This {device} needs the internet to see. It can get ready to work without it. About 20 minutes on home Wi-Fi. |
| help.dev.getting | Getting ready to work without the internet. {n}%. You can keep using WeKnow. |
| help.dev.cannot | This {device} uses the internet to see. |
| help.call | Person to call when unsure |
| help.change | Change |
| help.setup | Set up for someone else |
| help.keep | Keep your answers if this {device} is lost or replaced. Optional. WeKnow works the same without it. |
| help.signin / signout | Sign in with Google / Sign out |
| help.signed | Signed in as {email}. Your answers are kept safe. Pictures stay on this {device}. |
| setup.title | Set up for someone else |
| setup.line | Five things, about five minutes. Do them on their {device}. |
| setup.1 | Camera and microphone. Allowed. |
| setup.2 | Work without the internet |
| setup.3 | Voice and text they are comfortable with |
| setup.3.play | Play a sample |
| setup.4 | Before WeKnow uses the internet |
| setup.4.once / every | Ask the first time, then just say so / Ask every time |
| setup.5 | Who they should call when unsure |
| setup.5.fine | Kept on this {device} only. |
| setup.try | Try it together |
| setup.after | Then put WeKnow on the first screen, so it is one press away. |

### Adding Chinese

- Every string above is a whole sentence. Translate the sentence, not the words.
- Button words stay short: 問, 停, 下一步, 開始, 之前, 說明, 再一次.
- Prices, dates and counts go through the platform's own formatting.
- On iPhone the on-device model reads Chinese, so Chinese answers carry "On this phone". On the web, Chinese
  questions go through the internet path and carry "Answered using the internet". The interface is the same.

## 11. Access checklist

- [ ] Every control is at least 44 px; the main ones are 60 px and more.
- [ ] Text contrast 7 to 1; control borders 3 to 1; nothing told by colour alone.
- [ ] Works at 320 px wide, in both directions, at 200% zoom and at the largest text size, without sideways scrolling.
- [ ] Follows the device's text size; Help adds two larger steps.
- [ ] Nothing times out. Nothing disappears by itself. No moving content that cannot be stopped.
- [ ] Everything spoken is captioned. Everything shown that matters is spoken.
- [ ] The whole product works with voice off, and the whole product works without speaking (buttons, Type instead).
- [ ] Keyboard: Tab reaches everything with a visible 3 px focus ring; Space is the big button; Escape is Stop, No
      and Close; right arrow is Next; left arrow is Again.
- [ ] No holding, dragging, swiping or double pressing.
- [ ] Reduce-motion is respected.
- [ ] With a screen reader on, WeKnow's own voice is off and captions go through the reader.
- [ ] Left button and right button keep their meaning on every screen.

## 12. Platform notes

**Web, desktop Chrome**
- Camera and microphone are requested together, so there is one system box.
- Sound and the model download each need a press first. Start on Welcome is that press for sound.
- Model states map to the interface like this:

| The browser says | Status | Offer to get ready |
|---|---|---|
| available | Works without the internet | none |
| downloadable | Using the internet | once, after the first answer; always in Help |
| downloading | Getting ready: n%, then "almost there" while it unpacks | none |
| unavailable | Using the internet | never; Help says "This computer uses the internet to see." |

- The language pack for on-device listening is fetched as part of "getting ready" and is never mentioned separately.
- The time in `ready.offer.line` and `help.dev.can` is filled in from a measurement on an ordinary home connection.
- WeKnow can be installed to the dock or home screen; "Set up for someone else" ends by suggesting it.

**iPhone**
- The phone layout, with the system's text sizes.
- Up to three system boxes at first run; the voice says how many.
- The torch is used for "too dark". Taps are used as in section 9.
- If the phone's own on-device features are switched off, item 2 in "Set up for someone else" tells the family
  member where to turn them on. Until then the phone behaves as "cannot read by itself".

## 13. Where to see it

Open `prototype.html`. The dark bar at the top belongs to the prototype, not the product.

| Scene in the prototype | Sections here |
|---|---|
| First open, Allow camera and microphone, Ready for the first question | 2.3, 10 Welcome and Allow |
| Ask: a drain ..., Answer with an offer to guide, Step by step | 2.1, 6 |
| Ask: a repair quote, Quote: one line is high, Quote: a sentence to say | 6, 7.1 |
| Ask: a letter ..., Letter: do not pay yet | 6 |
| Asking before one item goes online, Asking when this device cannot read by itself | 7.3 |
| Where the answer came from | 7.2 |
| Offer to work without the internet | 7.3, 7.4 |
| No internet ..., and the "When things go wrong" group | 10 |
| Earlier, Help and settings, Set up for someone else | 6, 10 |

"This device" in the bar switches between a device that reads by itself, one that cannot, and one with no internet.
"View" shows the phone layout on a laptop screen. A link can open any state directly, for example
`prototype.html#s=quote-result&device=cloud&view=phone&voice=0`.

## 14. References

Background reading for the choices in sections 3, 9 and 12:

- W3C, What's New in WCAG 2.2 (target size): https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Chrome for Developers, Inform users of model download: https://developer.chrome.com/docs/ai/inform-users-of-model-download
- Spoken dialogue interfaces for older people (University of Edinburgh):
  https://www.cstr.ed.ac.uk/downloads/publications/2012/08-vipperla-2013.pdf
- Situated understanding of errors in older adults' interactions with voice assistants: https://arxiv.org/html/2403.02421v3
