# WeKnow UI specification

How every screen is laid out on a phone and on a desktop, the type, the colours in light and dark, the components,
the motion, the voice, and every string. The flows are in `USERFLOW.md`. `prototype.html` implements this document;
where the two differ, the prototype is right about looks and this document is right about rules.

## 1. The idea

- **The camera is home.** A window onto the camera, the words under it, and one large button. Text never sits on
  top of the moving picture, so it is always readable.
- **One button that feels like a button.** Round, flat-faced, a darker rim below it that it sinks into when pressed,
  and a soft ring round it. It is also the mark of the product: the green dot in the wordmark is the same button.
- **Three colours people already know.** Green for go and fine, amber for look closer, red for stop. Each always
  comes with a shape and a word. Blue means one thing only: something went over the internet.
- **A real app round it.** A Menu drawer, My checks, the notes page, Settings and Help, on the same quiet surface.
- **The finish.** The bar is the clarity of the best current product interfaces: generous even spacing, soft
  rounded cards on a calm ground, crisp modern type, buttons that answer hover and press, motion that is short and
  has a reason. There is no glow, no purple gradient, no sparkle icon, nothing that announces a machine. Light and
  dark are both complete.

## 2. Two layouts

The layout follows the width of the app, not the kind of device. The phone and the desktop are designed separately;
the desktop is not the phone made wider.

| Width of the app | Layout |
|---|---|
| under 640 px | Phone |
| 640 to 899 px | Phone layout in a column 40rem wide, centred |
| 900 px and over | Desktop, at most 90rem wide (pages 76rem) |

Both must hold at the largest text size and at 200% zoom; the phone from 320 px wide, in portrait and landscape.

### 2.1 App bar and Menu

```
Phone                                Desktop
[≡ Menu]  ● WeKnow                   [≡ Menu]  ● WeKnow            (▭ Works without the internet) (Sign in)
```

- Height 3.9rem on a phone, 4.4rem on a desktop. No line under it; it sits on the page ground.
- **Menu** is a white pill with the three-line icon and the word. It is in the same place on every screen.
- Desktop only, on the right: the status pill (section 7.4) and the account pill ("Sign in", or an initial and a
  first name). Both lead somewhere real: the account pill opens Settings.
- Welcome and Allow have no app bar.

The Menu drawer slides in from the left over a dimmed page: 88% of the width on a phone (at most 21.5rem), 22.5rem
on a desktop, with large round corners on its right side.

```
● WeKnow                    [Close]
[▣ Ask                          ]   current place: filled row, bold
[▢ My checks                  4 ]
[▤ What WeKnow remembers      5 ]
[≈ Settings                     ]
[? Help                         ]

Screen
[ ☼ Light | ☾ Dark | System ]
(M) Margaret Lin        or   ( ) Not signed in
```

### 2.2 Ask

```
Phone                              Desktop
┌──────────────────────────┐      ┌──────────────────────────────────────────────────────────────────┐
│ [≡ Menu]  ● WeKnow       │      │ [≡ Menu] ● WeKnow                     (▭ Works without ...) (Sign in) │
│ ┌──────────────────────┐ │      │ ┌─────────────────────────────┐  ┌────────────────────────────┐   │
│ │ ┌   ● Camera on    ┐ │ │      │ │ ┌─────────────────────────┐ │  │ ▲ One line is high         │   │
│ │      camera view     │ │      │ │ │                         │ │  │ Line 3, brake labor ...    │   │
│ │ └                  ┘ │ │      │ │ │       camera view       │ │  │ Same shop as last March... │   │
│ └──────────────────────┘ │      │ │ │                         │ │  │ (▤ From your notes ...)    │   │
│  ▲ One line is high      │      │ │ └─────────────────────────┘ │  │ [ Yes, tell me ] [ No ]    │   │
│  Line 3, brake labor ... │      │ │   [Again]  ( Ask )  [Stop]  │  │ (▢ Kept in The car ›)      │   │
│  [ Yes, tell me ][ No  ] │      │ │   Space presses the button  │  └────────────────────────────┘   │
│  (ⓘ Used the internet ›) │      │ └─────────────────────────────┘  ┌────────────────────────────┐   │
│        ( Ask )           │      │                                   │ (ⓘ Used the internet ...)  │   │
└──────────────────────────┘      │                                   │ ▭ Stayed on this computer  │   │
                                  │                                   │ ⓘ Went over the internet   │   │
                                  │                                   └────────────────────────────┘   │
                                  │                                   ┌ No camera handy? Try a picture ┐│
                                  └──────────────────────────────────────────────────────────────────┘
```

Phone
- One column: window, words, button. Gutter 1rem, gaps 0.8rem. The button respects the safe area at the bottom.
- The window is 50% of the height when ready or listening, 20% while looking and answering, 40% in step by step. It
  changes over 320 ms. The picture is always fitted whole, never cropped, so marks on it are never cut off.
- The words sit directly on the page ground. The verdict stays pinned to the top of the words area and the tag to
  its bottom; if the sentences do not fit, they scroll between the two and the newest is always in view.
- The big button is alone in the ready state. Again and Stop appear on either side of it only in step by step.

Desktop
- Two columns, 1.32 to 1. Left: one large card holding the camera view and, under it, the button row with the
  keyboard hint. Right: a stack of cards that scrolls on its own: the words, then "where this answer came from"
  (always open), then the sample pictures.
- The sample pictures card is at the top of the right column when nothing has been asked, and is hidden while
  WeKnow listens, looks, or guides step by step.
- After an answer the words card also shows **Kept in The car**, which opens Move.

### 2.3 My checks

```
Phone: projects                    Phone: one project             Desktop
My checks      [+ New project]     [‹ All projects]               My checks                      [+ New project]
┌──────────────────────────┐       The car          [Rename]      ┌──────────────┐  The car             [Rename]
│ My home                1 │       ┌──────────────────────────┐   │ All checks 4 │  ┌──────┐ ┌──────┐ ┌──────┐
│ [▢]                      │       │ [▢] Oil change ..., $118 │   │ My home    1 │  │ pic  │ │ pic  │ │ pic  │
│ ✓ Soy sauce ..., 12 Nov  │       │     Invoice, 14 Mar      │   │ Mom's pl.  2 │  │ title│ │      │ │      │
└──────────────────────────┘       │     (✓ This looks fair)  │   │ The car    1 │  │ ✓ ...│ │      │ │      │
┌ Mom's place            2 ┐       └──────────────────────────┘   │ ▤ What WeKnow│  └──────┘ └──────┘ └──────┘
┌ The car                1 ┐                                      │   remembers ›│
[▤ What WeKnow remembers ›]                                       └──────────────┘
```

- Phone: two levels. Project cards (name, count, up to three pictures, latest check), then the checks of one
  project as rows (picture left, title, kind and date, verdict chip).
- Desktop: both levels at once. Projects in a card on the left, starting with "All checks"; checks as a grid of
  cards on the right, picture on top. In "All checks" each card also names its project.
- A check opens as a sheet on the phone and as a box 48rem wide on a desktop, with the picture on the left.

### 2.4 What WeKnow remembers

- Top, full width: the **Only on this phone** band (section 7.6).
- Phone: one column of cards: Shops and what you paid. People you pay. Your appliances and devices. How you like
  WeKnow. Then one card with the switch, the backup row and Forget everything.
- Desktop: the same cards in two columns under the band; the last card spans both.
- A note row: name (bold), what, when (second ink); **Change** and **Delete** on the right, under the text on a phone.

### 2.5 Settings and Help

- Settings, phone: one column of cards in this order: Account, Voice and text, Screen, Language, Privacy, Notes and
  payees, Family, Delete my data.
- Settings, desktop: a card on the left listing those eight names, which stays in view and jumps to each; the cards
  on the right, at most 46rem wide. In Privacy the two boxes sit side by side.
- Help: four cards at most 52rem wide: How it works (with **Hear how WeKnow works**), the three sample pictures, the
  words WeKnow always understands, Set up for someone else.

### 2.6 Welcome and Allow

Centred, one column on both sizes: wordmark, the line "Point at it. Ask out loud. Hear what to do." (three lines on
a phone, one on a desktop), three pictures each with its question, the Start button, one small line.

Allow shows "Press Allow", one line, and an arrow with "Press this one". The arrow must point at the real system
box: top left under the address bar in desktop Chrome, centre of the screen on iPhone. The words on the highlighted
button must match the button the system really shows on that platform.

### 2.7 Sheets and boxes

- Phone: rise from the bottom, top corners 1.75rem, at most 92% of the height. Set up for someone else fills the
  screen. A **Close** button with the word, top right.
- Desktop: a centred box 36rem wide (wider for a check and for Set up), the page dimmed behind.
- The asking sheet, the remember sheet and confirmations have no Close and do not close when the dimmed area is
  pressed. Their two buttons are the only ways out; Escape counts as No.

## 3. Sizes and spacing

| Thing | Size |
|---|---|
| Big button | 7rem across (112 px), or 34% of the width if that is smaller, plus a ring 0.55rem wide |
| Again and Stop | 4.75rem square (76 px) |
| Yes/no buttons | at least 3.5rem tall (56 px), two columns; stacked when there are three or more |
| Other buttons | at least 2.75rem tall (44 px); Menu and the pills 2.9rem |
| Rows in Menu | 3.6rem tall |
| Any other control | at least 2.75rem (44 px) in both directions |
| Space between two controls | at least 0.5rem |
| Spacing steps | 0.25, 0.5, 0.75, 1, 1.5, 2.5rem. Page gutter 1rem on a phone, 1.75rem on a desktop. Card padding 1.1 to 1.3rem. |
| Corner radius | 1.75rem window, large cards, sheets, drawer. 1.25rem cards. 1rem buttons, fields, verdict band. 0.75rem small buttons, chips in a group. Fully round: Menu, pills, tags. |

No control needs holding, dragging, swiping, double pressing or a long press.

## 4. Type

**Family.** Inter, hosted with the app (open licence), with its clearer letter shapes switched on (`cv05`, `cv08`:
a tailed l and a barred I) so 1, l and I cannot be confused in prices and account numbers. Fallback: the system
font. Chinese falls through to PingFang TC or Noto Sans TC. One family, four weights (500, 600, 700, 800). No
italics, no capitals for labels.

Large sizes are set tight (letter-spacing -0.025 to -0.035em); text sizes slightly tight (-0.012em). All sizes are
in rem so the device's own text size and the browser's zoom both work.

| Use | Phone | Desktop | Weight | Line height |
|---|---|---|---|---|
| Page title (My checks, Settings) | 1.9rem | 2.3rem | 700 | 1.1 |
| Verdict | 1.75rem (28 px) | 2rem | 700 | 1.12 |
| Step instruction, words as heard, sentence for the shop | 1.5rem (24 px) | 1.7rem | 700 | 1.32 |
| Spoken sentences (captions) | 1.375rem (22 px) | 1.4375rem | 500 | 1.32 |
| Big button word | 1.5rem | same | 700 | 1 |
| Card titles, project names | 1.3rem | same | 700 | 1.2 |
| Buttons, rows, check titles, sheet text | 1.1875rem (19 px) | same | 700 / 600 / 500 | 1.15 to 1.4 |
| Sheet title | 1.6rem | same | 700 | 1.15 |
| Welcome line | 2rem | 3.1rem | 700 | 1.12 |
| Smallest text anywhere (tags, pills, counts, small notes) | 1.0625rem (17 px) | same | 600 / 500 | 1.2 to 1.45 |

- Nothing is ever smaller than 17 px at the default setting.
- Settings has three text sizes: 100%, 115%, 130% of the root size. They multiply whatever the device already asks for.
- Captions: the sentence being spoken is in full ink; earlier sentences in the second ink; all go to full ink when
  speaking ends.
- Lines are at most about 32 characters on a phone and 60 on a desktop.

## 5. Colour and depth

Text and its ground reach 7 to 1 or better. Borders of controls reach 3 to 1 against what is behind them.

| Token | Light | Dark | Used for | Contrast, light / dark |
|---|---|---|---|---|
| `bg` | `#F5F6F4` | `#0B0E0D` | the page | |
| `card` | `#FFFFFF` | `#141917` | cards, sheets, drawer, buttons, pills | |
| `card-2` | `#EEF1EE` | `#1C2320` | quiet fills: current row, group tracks, status pill, hover | |
| `ink` | `#0F1A15` | `#F1F5F3` | text | 16.4 on bg, 17.8 on card / 17.6, 16.2 |
| `ink-2` | `#46534D` | `#AEB9B3` | secondary text | 7.4 on bg, 8.1 on card, 7.1 on card-2 / 9.6, 8.8, 7.9 |
| `hair` | `#E2E6E3` | `#252C29` | card edges, dividers | decoration only |
| `line` | `#77847D` | `#6E7B75` | edges of buttons, fields, switches | 3.9 on card, 3.6 on bg / 4.0, 4.4 |
| `go` | `#075C3D` | `#3ECF92` | big button, yes buttons, ticks, switch on | text on it 8.1 / 9.6 |
| `go-h` | `#064E34` | `#57D9A2` | the same, under the pointer | 9.8 / 10.7 |
| `go-deep` | `#043C28` | `#1F8F62` | the rim under green buttons | |
| `go-ring` | go at 12% | go at 16% | the ring round the big button | |
| `ok-bg` | `#E3F4EA` | `#10301F` | green verdict band, on-device band, note box | ink 15.6 / 13.0 |
| `warn-bg` | `#FFEFC2` | `#392900` | amber verdict band, caution band, "not checked" tag | |
| `warn-ink` | `#4A3000` | `#FFD877` | text on amber | 10.7 / 10.3 |
| `warn-line` | `#8A5600` | `#E3A800` | amber icon and edge | 5.4 on warn-bg / 6.6 |
| `stop` | `#A8201A` | `#FF8D7E` | red icon, delete buttons | 7.3 on card / 7.9 |
| `stop-bg` | `#FDE7E3` | `#3A1411` | red verdict band | ink 15.0 / 14.8 |
| `net` | `#1849A9` | `#A6C6FF` | anything that went over the internet | 8.2 on card, 7.0 on net-bg / 10.3, 8.7 |
| `net-bg` | `#E7EEFD` | `#12254A` | internet tag, the "what would be sent" box, the internet box in Privacy | ink 15.3 / 13.7 |
| `key` | `#0F1A15` | `#F1F5F3` | the Stop face of the big button, the chosen option in a group | text on it 17.8 / 17.6 |

Depth, three steps:

| Step | Light | Dark | Used for |
|---|---|---|---|
| 1 | a 1 px `hair` edge and a 1 to 2 px soft shadow | the `hair` edge alone | cards, pills, small buttons |
| 2 | a soft shadow about 12 px down, 30 px wide, 20% | a darker, tighter shadow | the camera window, a card under the pointer, the desktop stage card |
| 3 | a soft shadow about 30 px down, 70 px wide, 38% | near-black shadow | sheets, boxes, the drawer |

Rules:
- Light is the first setting. Settings and the Menu drawer both offer Light, Dark and System.
- In dark, depth comes from the surface getting lighter (`bg`, then `card`, then `card-2`) and from the hair edge,
  not from shadows. Green becomes the bright colour with dark text on it. Bands become deep tints with light text.
- Colour never carries meaning alone: verdicts have a shape and words, tags have an icon and words.
- The camera picture, the sample pictures, and the marks drawn on them (cover bars `#14211C`, ticks `#0A7A4F`,
  amber `#B86E00`, blue `#1849A9`, red `#B3261E`, white labels) are the same in both themes.
- No gradients anywhere.

Every component in both themes:

| Component | Light | Dark |
|---|---|---|
| Page | `bg` | `bg` |
| App bar pills (Menu, account) | `card`, hair edge, depth 1 | `card`, hair edge |
| Status pill | `card-2`, `ink-2` | same tokens |
| Big button: Ask, Next | `go`, white word, `go-deep` rim, ring | `go`, dark word, `go-deep` rim, ring |
| Big button: Stop | `key`, white word | `key` (near white), dark word |
| Yes button | `go`, white word, rim | `go`, dark word, rim |
| Other buttons | `card`, 1.5 px `line` edge, `ink` | same tokens |
| Delete buttons | `card`, `stop` edge and word | same tokens |
| Verdict bands | `ok-bg` / `warn-bg` / `stop-bg` with `ink` / `warn-ink` / `ink` | the deep tints with `ink` / `warn-ink` / `ink` |
| Captions | `ink`, earlier ones `ink-2` | same tokens |
| Tags | `card` and `line` edge; internet `net-bg` and `net`; not checked `warn-bg` and `warn-ink` | same tokens |
| "From your notes" tag | `card`, hair edge, `ink-2` word, `go` icon | same tokens |
| Cards | `card`, hair edge, depth 1 | `card`, hair edge |
| Verdict chips on checks | the three tints | the three deep tints |
| Groups of choices | `card-2` track; chosen: `key` with `card` word | same tokens |
| Switch | off `card-2` with `line` edge; on `go` with a white knob | same tokens |
| Fields | `card`, 1.5 px `line` edge | same tokens |
| Drawer, sheets, boxes | `card`, depth 3, page dimmed 42% | `card`, hair edge, page dimmed 62% |
| "What would be sent" box | `net-bg`, dashed `net` edge | same tokens |
| Note box, on-device band | `ok-bg`, `go` edge or icon | same tokens |
| Focus ring | 3 px `net`, 3 px away | same token |

## 6. Components

States for every pressable thing: **rest**; **under the pointer** (desktop only): the fill moves one step (`card` to
`card-2`, `go` to `go-h`) and cards lift 2 px to depth 2; **pressed**: scales to 97 or 98%, or for the big button
sinks into its rim; **focus**: the ring; **not available**: 75% opacity with the words "Coming later" beside it,
never a silent grey control.

**Big button.** Round, `go` face, a thin highlight along its top edge, a 0.22rem rim of `go-deep` below, a soft
shadow, and a flat ring of `go-ring` round it. Pressed: it moves down 0.16rem and the rim nearly disappears. Faces:

| Face | Icon and word | When | A press does |
|---|---|---|---|
| Ask | microphone, "Ask" | ready; after an answer; while yes/no buttons are showing | starts listening (and drops the open question) |
| Listening | five bars that follow the voice, a slow ring pulse | listening | ends listening now |
| Stop | square, "Stop", `key` colour | looking, speaking | stops talking and looking; keeps what is on screen |
| Next | arrow, "Next" | step by step | "done, look and go on" |

Start on the Welcome screen is the same button with one word. The word is at most five letters in English and three
characters in Chinese.

**Again and Stop.** White rounded squares, hair edge, icon above a word. Only in step by step: Again on the left,
Stop on the right.

**Window.** Corner radius 1.75rem, depth 2 on a phone; inside the stage card on a desktop. Four white corner marks,
1rem in. Labels on it are white pills with a shadow, never see-through:
- top centre, while live: a green dot and "Camera on". While WeKnow works on a still picture there is no label; the
  corner marks close in by 0.5rem instead. "Too dark" has an amber dot, "Light on" a green one.
- bottom centre, phone only, only when it matters: "No internet. Still works." or "Getting ready: 42%".
- Camera off: the window turns into a flat `card-2` panel with a crossed camera and "The camera is off".

**Marks on the picture.**
- Cover bars: solid, one per personal field, slide in left to right, 120 ms apart.
- Tick: a 13 px filled circle with a white check at the end of a line. Green: known and fair. Amber with "!": high.
  Blue with "?": not known yet (plus a dashed blue box round the line). Blue with a check: looked up just now.
- High line: amber box round the whole line and a small amber label, "$180 high".
- Warning sign in a letter: red box round the sentence and a numbered red dot, matching "One." and "Two." as spoken.
- Step by step: a dashed white ring round the part to touch.

**Words area.** In order: "You asked: ..." (small, second ink, hidden once a verdict is up), the step bar (step by
step only), the verdict, the sentences (a note sentence is followed by its tag), the choices, the tag row. On a
desktop the area is a card.

**Verdict.** Icon and three or four words on a tinted band with 1rem corners.

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

**Card.** `card`, hair edge, 1.25rem corners, depth 1. Used for every group in My checks, the notes page, Settings
and Help. A card title is 1.3rem bold; rows inside are divided by hair lines.

**Project card (phone) and project row (desktop).** Name, count; on a phone also up to three pictures and the latest
check with its verdict icon. The current project on a desktop has a `card-2` fill and a bold name.

**Check card.** Picture (4 to 3, personal details covered), title, "kind, date", verdict chip. A row on a phone, a
tile on a desktop.

**Verdict chip.** A pill in the verdict's tint with its icon and words, 17 px.

**Note row.** Name, what, when; **Change** and **Delete**.

**Group of choices.** A `card-2` track with 1rem corners; the chosen option is a `key`-filled block with the word in
`card`. Used for Light / Dark / System, voice speed and text size (three A's of rising size).

**Switch.** 3.4 by 2rem, with the word On or Off beside it.

**Field.** 3.25rem tall, 1.5 px `line` edge, label above in the second ink. Used only for a project name, a note,
and the person to call.

**Option.** A full-width row with a radio dot, used in Move. The chosen one has a green dot and a green edge.

**Confirmation.** A sheet with a question, one sentence saying what is lost, a red-edged button that repeats the
action ("Forget everything") and **Keep**.

**Tag, receipt, asking sheet, notes tag, remember sheet, on-device band.** Section 7.

## 7. Where it ran, and what it remembered

This is the one place the product shows how it works. It has to be small, honest and always there.

### 7.1 The where-it-ran tag

One pill under every answer, with an icon. It names the device in the person's word: phone, tablet, or computer.

| State | Icon | Words | Colours | Spoken |
|---|---|---|---|---|
| All on the device | the device with a dot inside | On this phone | ink on card, `line` edge | First answer ever only: "I worked that out right here, on this phone. Nothing left it." |
| One or more facts looked up | globe | Used the internet for 1 item | `net` on `net-bg` | Every time: "I am looking that one up on the internet." |
| The device cannot read by itself | globe | Answered using the internet | `net` on `net-bg` | Asked the first time; said each time after |
| No internet, answered anyway | crossed signal | No internet. Answered on this phone. | ink on card | Only if she asks |
| Something could not be checked | triangle | 1 item not checked | `warn-ink` on `warn-bg` | Every time: "One is not checked." |

- On a phone the tag is the last thing in the words area and stays pinned to its bottom edge. It is a button, with a
  small chevron, and opens the sheet in 7.2.
- On a desktop the tag is the heading of a card that is always open under the answer.
- The tag never moves, blinks or animates. It never says a brand, a model name or a number of seconds.

### 7.2 "Where this answer came from"

Two lanes, always both, always in this order, then what was kept and the sources.

```
(ⓘ Used the internet for 1 item)
▭ Stayed on this phone
   The picture
   Your name, phone, address and plate (covered)
   Your note about this shop, from March
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
- A note that was used is listed in the first lane. Notes never appear in the second.
- The dashed blue box is the same box, with the same words, as the one in the asking sheet.
- Sources are named by kind and date. No logos. Addresses of the pages are inside Technical details.
- **Technical details** is closed by default and is the only place where terms such as model, request and pack
  version may appear.

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
- The same shape, with a device icon and no box, is the offer to work without the internet.

### 7.4 The status pill (desktop app bar)

| Device | Words |
|---|---|
| Model ready | Works without the internet |
| Getting ready | Getting ready: 42% |
| Cannot read by itself | Using the internet |
| No connection | No internet |

On a phone the same information appears only when it matters, as the label at the bottom of the window.

### 7.5 The notes tag

- A small pill directly under the one sentence that came from a note: a notebook icon in `go` and the words "From
  your notes on this phone" in the second ink, on `card` with a hair edge. 2.25rem tall.
- It is a button. It opens What WeKnow remembers.
- It is never blue. Notes did not go anywhere.
- One per answer at most.

### 7.6 The remember sheet and the on-device band

```
▤ Shall I remember this shop for next time?
I would write this in my notes on this phone:
┌──────────────────────────────┐
│ Marlow Street Garage         │   solid green edge, ok-bg: this stays here
│ Brake repair quote, $1,240   │
│ Labor $120 an hour           │
└──────────────────────────────┘
Notes never leave this phone. You can read, change or delete them any time.
[ Remember ]   [ No ]
```

- The same skeleton as the asking sheet, so the two are learned once. The differences carry the meaning: a notebook
  icon in green instead of a blue globe; a solid green box instead of a dashed blue one.
- The box shows the note exactly as it will be written.

The on-device band heads the notes page: `ok-bg`, the device icon in `go`, **Only on this phone** in bold, and three
short sentences. The same icon and the words "Kept on this phone" close the line under every check, and "Kept on
this phone only" opens the Notes and payees card in Settings.

### 7.7 Kept in

Desktop only: a pill in the answer card, "Kept in The car", folder icon, chevron. It opens Move. On a phone the
closing sentence says where the check went, and Move is in My checks.

## 8. Motion

| What | How | Time |
|---|---|---|
| Press of a button | scales to 97 or 98%; the big button sinks into its rim | 140 ms |
| Pointer over a button or card (desktop) | fill moves one step; cards lift 2 px | 140 to 180 ms |
| Window changes height between phases | eases | 320 ms |
| A verdict, a card, a page arriving | rises 8 px and fades in, once | 260 to 300 ms |
| Looking at a still picture | corner marks close in | 220 ms |
| Reading a paper | one white line sweeps down and back while it reads | 1.25 s each way |
| Cover bars | wipe in left to right, one after another | 220 ms, 120 ms apart |
| Ticks, boxes, flags on the picture | fade in | 250 ms |
| Drawer | slides in from the left | 280 ms |
| Sheet | rises (phone); fades in and grows from 98% (desktop) | 280 / 240 ms |
| Switch, group of choices | knob or fill moves | 140 to 200 ms |
| Listening | bars follow the voice; a slow ring pulses round the button | 1.6 s |

- One easing everywhere: quick out, soft landing (`cubic-bezier(.2,.8,.2,1)`).
- Motion only answers something the person or WeKnow just did. Nothing moves while the screen is waiting.
- Changing between light and dark is instant.
- No spinners, no shimmer, no typing dots.
- With "reduce motion" on: every transition is off, the bars stand still, the reading line is not drawn.

## 9. Sound and voice

**The voice**
- The device's own voice, the best one that works without the internet. Pace 0.92 of normal (about 150 words a
  minute). Settings offers Slower (0.8), Normal, Faster (1.2).
- First person, calm, plain. Short sentences, 14 words at most, one instruction in each. No exclamation marks, no
  jokes, no "As an assistant". It says "I do not know" when it does not.
- Praise is one word after a confirmed step: "Good."
- Numbers are spoken in full and shown as figures. It never reads out a web address.
- It never asks "Did you say ...?". What it heard is shown as "You asked: ...".
- A note is one sentence, after the reason and before the question. It says when the note is from ("last March").
- Its last sentence is the question, when there is one. It asks one thing after an answer, never two.
- Menu, My checks, the notes page and Settings are silent pages. Only "Hear how WeKnow works", "Play a sample" and
  "Hear it again" speak there.

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
- A switch in Settings. Captions carry everything. With a screen reader running, WeKnow's own voice turns itself off
  and the captions are announced through the screen reader instead, so two voices never talk at once.

## 10. Every string

`{device}` is phone, tablet or computer. `{name}` is the person to call. `{project}` is a project name. Spoken lines
are also shown as captions. Strings are whole sentences with placeholders; nothing is glued together from parts, so
Chinese can be added by translating the table.

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

### App bar and Menu

| Id | Text |
|---|---|
| menu.button | Menu |
| menu.ask / checks / notes / settings / help | Ask / My checks / What WeKnow remembers / Settings / Help |
| menu.screen | Screen |
| theme.light / dark / system | Light / Dark / System |
| menu.signedout | Not signed in |
| bar.signin | Sign in |
| close | Close |

### Ask

| Id | Text |
|---|---|
| home.coach | Point at it. Press Ask. Say what's wrong. |
| btn.ask / stop / next / again | Ask / Stop / Next / Again |
| home.space | Space presses the big button |
| home.samples | No camera handy? Try a picture. |
| chip.live / dark / light | Camera on / Too dark / Light on |
| note.offline / getting | No internet. Still works. / Getting ready: {n}% |
| listen.title | I'm listening |
| asked | You asked: "{words}" |
| asked.earlier | From earlier today / From {date} |
| look.thing / look.paper | Let me look. / Let me read it. |
| wait.6 / wait.15 | Still looking. / This is taking a while. I am still here. |
| first.local | I worked that out right here, on this {device}. Nothing left it. |
| first.offline | There is no internet, so I worked it out right here, on this {device}. |
| kept.project | All right. It is in My checks, under {project}. |
| kept.one | All right. You will find it in My checks. |
| kept.chip | Kept in {project} |

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
| letter.do | Call the company first. Use the number on an older bill. |
| letter.call | Call {name} |
| letter.again | Say it again |
| letter.calling | Calling {name}. |

### What WeKnow remembers

| Id | Text |
|---|---|
| note.tag | From your notes on this {device} |
| note.shop | Same shop as last March. Labor was $95 an hour then. Now it is $120. |
| note.payee | One. The account is new. You paid them at one ending 8815 before. |
| note.thing | Your washer, the Alder WF-710, shook last October too. One foot was short. |
| note.ask.shop | Shall I remember this shop for next time? |
| note.ask.payee | Shall I remember who you pay for water? |
| note.ask.thing | Shall I remember this washing machine? |
| note.ask.body | I would write this in my notes on this {device}: |
| note.ask.fine | Notes never leave this {device}. You can read, change or delete them any time. |
| note.ask.first | I keep notes only on this {device}. They never leave it. |
| note.ask.yes / no | Remember / No |
| note.wrote | I wrote it down. You can read my notes under What WeKnow remembers. |
| note.declined | All right. I will not. |
| note.added | I added today's quote to my notes on this {device}. |
| notes.title | What WeKnow remembers |
| notes.only.title | Only on this {device} |
| notes.only.line | WeKnow keeps these notes on this {device} and nowhere else. Not in your account. Not on the internet. It asks before it writes a new one, and it uses them to give you better answers. |
| notes.shops / payees / things / prefs | Shops and what you paid / People you pay / Your appliances and devices / How you like WeKnow |
| notes.shops.empty | Nothing yet. WeKnow asks before it remembers a shop. |
| notes.payees.empty | Nothing yet. WeKnow asks after a bill that looks normal. |
| notes.things.empty | Nothing yet. Point at a nameplate and WeKnow offers to remember it. |
| notes.change / delete | Change / Delete |
| notes.edit.title | Change this note |
| notes.edit.a / b / c | Name / What / When and more |
| save | Save |
| notes.deleted | Deleted "{name}". |
| notes.undo | Put it back |
| notes.offer | Offer to remember new things. Off: WeKnow stops asking and writes nothing new. |
| notes.backup | Backup locked with your own passphrase. To move your notes to a new {device}. Only you could open it. |
| soon | Coming later |
| notes.forget | Forget everything. Deletes every note on this page. Your checks stay in My checks. |
| notes.forget.ask | Forget everything? Every note on this page is deleted from this {device}. Your checks stay. This cannot be undone. |
| keep | Keep |

### My checks

| Id | Text |
|---|---|
| checks.title | My checks |
| checks.new | New project |
| checks.all | All checks |
| checks.back | All projects |
| checks.rename | Rename |
| checks.rename.title | Rename this project |
| checks.name | Name. For example: The garden |
| checks.empty.project | Nothing here yet |
| checks.empty | Nothing here yet. Every check you make is kept on this {device}. |
| check.kinds | Guide / Quote / Invoice / Bill / Letter |
| check.meta | {kind}, {date}. Kept on this {device}. |
| check.in | In |
| check.move | Move |
| check.move.title | Move to |
| check.hear | Hear it again |
| check.delete | Delete |
| check.delete.ask | Delete this check? It is removed from this {device}. This cannot be undone. |

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
| where.note.shop | Your note about this shop, from March |
| where.note.payee | Your note about this payee: account ending 8815 |
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
| ready.later | All right. You can do it later, in Settings. |
| ready.almost | Getting ready: almost there |
| ready.done | I am ready. I can work without the internet now. |
| ready.full | This {device} is too full to get ready. WeKnow will keep using the internet. |
| net.none.title | No internet |
| net.none.line | There is no internet, and this {device} needs it to see. Your earlier checks still work. |
| net.none.btn | Open My checks |
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
| dark.better.title / line | The light is on / That is better. Press Ask when you are ready. |
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
| cam.how.title | Turn the camera on |
| cam.how.phone | Open Settings. Press WeKnow. Switch Camera on. Then come back. |
| cam.how.computer | Press the small camera picture at the top, next to the web address. Choose Allow. |
| mic.line | I cannot hear. The microphone is turned off for WeKnow. |
| sound.off | Turn your sound up to hear me. |

### Settings, Help, Set up

| Id | Text |
|---|---|
| set.title | Settings |
| set.account | Account |
| set.account.out | Not signed in. WeKnow works the same without an account. |
| set.account.line | Signing in carries the guides and prices WeKnow has looked up to your other devices. Your checks, notes and pictures stay on this {device}. |
| set.signin / signout | Sign in with Google / Sign out |
| set.voice.title | Voice and text |
| set.voice | Voice. Off shows the words only |
| set.speed | Voice speed: Slower / Normal / Faster |
| set.speed.say | This is how fast I will talk. |
| set.size | Text size |
| set.screen | Screen. Light or dark. System follows this {device} |
| set.lang | Language. WeKnow speaks and shows: English / 繁體中文, later |
| set.privacy | Privacy |
| set.privacy.stays | Stays on this {device}: Your pictures. Names, phone numbers, addresses, account numbers. Your checks and your notes. The people you pay, and who to call. |
| set.privacy.goes | May go over the internet, after you say yes: The name of one thing to look up, and your city. If this {device} cannot read by itself: a picture of a thing, or the covered words of a paper. |
| set.every | Ask me every time before using the internet |
| set.dev.ready | This {device} works without the internet. Ready. Guides and prices were last checked on {date}. |
| set.dev.can | This {device} needs the internet to see. It can get ready to work without it. About 20 minutes on home Wi-Fi. |
| set.dev.getting | Getting ready to work without the internet. {n}%. You can keep using WeKnow. |
| set.dev.cannot | This {device} uses the internet to see. |
| set.notes | Notes and payees. Kept on this {device} only. WeKnow uses them to notice when a price or an account has changed. |
| set.notes.rows | What WeKnow remembers, {n} notes / Known payees, {n} |
| set.family | Family |
| set.call | Person to call when unsure. {name}, {number}. Kept on this {device}. |
| set.change / open | Change / Open |
| set.setup | Set up for someone else. Five things, about five minutes |
| set.delete | Delete my data. Deletes every check, project, note and setting from this {device}. This cannot be undone. |
| set.delete.ask | Delete all your data? Every check, project, note and setting is deleted from this {device}. This cannot be undone. |
| set.delete.yes | Delete everything |
| help.title | Help |
| help.how | How it works. Point the camera at it. Press Ask. Say what's wrong. WeKnow looks, and tells you what to do. |
| help.hear | Hear how WeKnow works |
| help.hear.say | Point me at something. Press Ask, and say what's wrong. I will look, and tell you what to do. |
| help.words | Words WeKnow always understands: yes, no, next, done, again, wait, stop, help |
| help.setup | Setting it up for someone else? Five things, about five minutes, on their own {device}. |
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
- Button words stay short: 問, 停, 下一步, 開始, 選單, 再一次.
- Prices, dates and counts go through the platform's own formatting.
- On iPhone the on-device model reads Chinese, so Chinese answers carry "On this phone". On the web, Chinese
  questions go through the internet path and carry "Answered using the internet". The interface is the same.

## 11. Access checklist

- [ ] Every control is at least 44 px; the main ones are 56 px and more.
- [ ] Text contrast 7 to 1 in both themes; control edges 3 to 1; nothing told by colour alone.
- [ ] Works at 320 px wide, in both directions, at 200% zoom and at the largest text size, without sideways scrolling.
- [ ] Follows the device's text size; Settings adds two larger steps.
- [ ] Nothing times out. Nothing disappears by itself. No moving content that cannot be stopped.
- [ ] Everything spoken is captioned. Everything shown that matters in an answer is spoken.
- [ ] The core flow needs no reading, no typing and no Menu.
- [ ] The whole product works with voice off, and the whole product works without speaking (buttons, Type instead).
- [ ] Keyboard: Tab reaches everything with a visible 3 px focus ring; Space is the big button; Escape is Stop, No
      and Close; right arrow is Next; left arrow is Again; Enter saves a name.
- [ ] No holding, dragging, swiping or double pressing. Moving a check is press, then press.
- [ ] Reduce-motion is respected.
- [ ] With a screen reader on, WeKnow's own voice is off and captions go through the reader.
- [ ] Menu is in the same place on every screen and always carries its word.
- [ ] Hover is never the only way to find or do anything.

## 12. Platform notes

**Web, desktop Chrome**
- Camera and microphone are requested together, so there is one system box.
- Sound and the model download each start from a press. Start on Welcome is that press for sound.
- Model states map to the interface like this:

| The browser says | Status | Offer to get ready |
|---|---|---|
| available | Works without the internet | none |
| downloadable | Using the internet | once, after an answer; always in Settings |
| downloading | Getting ready: n%, then "almost there" while it unpacks | none |
| unavailable | Using the internet | never; Settings says "This computer uses the internet to see." |

- The language pack for on-device listening is fetched as part of "getting ready" and is never mentioned separately.
- The time in `ready.offer.line` and `set.dev.can` is filled in from a measurement on an ordinary home connection.
- "System" follows the browser's light or dark setting and changes with it at once.
- WeKnow can be installed to the dock or home screen; "Set up for someone else" ends by suggesting it.

**iPhone**
- The phone layout, with the system's text sizes. "System" follows the phone's appearance.
- Up to three system boxes at first run; the voice says how many.
- The torch is used for "too dark". Taps are used as in section 9.
- If the phone's own on-device features are switched off, item 2 in "Set up for someone else" tells the family
  member where to turn them on. Until then the phone behaves as "cannot read by itself".

## 13. Where to see it

Open `prototype.html`. It shows a phone frame and a desktop frame side by side, both live. The dark bar at the top
belongs to the prototype, not the product.

| In the bar | What it does |
|---|---|
| Scene | Opens the same state in both frames |
| This device | Reads by itself; cannot read by itself; reads by itself with no internet |
| Both / Phone / Desktop | Two frames, or one at full size |
| Light / Dark / System | The theme of both frames. The product's own switch is in Menu and in Settings. |
| Voice | The frame under the pointer speaks; the other shows captions |

| Scene in the prototype | Sections here |
|---|---|
| First open, Allow camera and microphone, Ready for the first question | 2.6, 10 |
| Ask: a drain ..., Answer with an offer to guide, Step by step | 2.2, 6 |
| Ask: a repair quote, Quote: one line is high ..., Quote: words to say | 6, 7.1, 7.5 |
| Ask: a letter ..., Letter: do not pay yet ... | 6, 7.5 |
| First time it offers to remember, The notes page | 2.4, 7.6 |
| Menu open, My checks (three scenes), Settings, Help, Set up for someone else | 2.1, 2.3, 2.5 |
| Asking before one item goes online, Asking when this device cannot read by itself | 7.3 |
| Where the answer came from, Offer to work without the internet | 7.2, 7.3, 7.4 |
| No internet ..., and the "When things go wrong" group | 10 |

The "First time" scenes start with nothing kept and nothing remembered. The other scenes start with a household
that has used WeKnow for some months. A link can open any state directly, for example
`prototype.html#s=quote-result&layout=both&theme=dark&voice=0`.

## 14. References

Background reading for the choices in sections 3, 9 and 12:

- W3C, What's New in WCAG 2.2 (target size): https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Chrome for Developers, Inform users of model download: https://developer.chrome.com/docs/ai/inform-users-of-model-download
- Spoken dialogue interfaces for older people (University of Edinburgh):
  https://www.cstr.ed.ac.uk/downloads/publications/2012/08-vipperla-2013.pdf
- Situated understanding of errors in older adults' interactions with voice assistants: https://arxiv.org/html/2403.02421v3
