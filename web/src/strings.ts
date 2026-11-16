// Every string the person reads or hears, from design/UI-SPEC.md section 10, keyed by the same ids.
// Strings are whole sentences with placeholders, so Chinese can be added by translating this table.
// `{device}` is phone, tablet or computer. Ids marked "added" are not in the spec: they cover states the real
// engine has and the prototype did not (each says so in its comment), in the same voice.

export const EN = {
  // Welcome and Allow
  'welcome.line': 'Point at it. Ask out loud. Hear what to do.',
  'welcome.q1': 'Why won’t this drain?',
  'welcome.q2': 'Is this a fair price?',
  'welcome.q3': 'Should I pay this?',
  'welcome.start': 'Start',
  'welcome.fine': 'No account. Show it, say it or type it. Turn your sound up.',
  'allow.title': 'Press Allow',
  'allow.line': 'So WeKnow can see and hear.',
  'allow.point': 'Press this one',
  'allow.fine': 'Pictures stay on this {device} unless you say yes.',
  'allow.say': 'Hello. I’m WeKnow. A box has appeared. Press Allow, so I can see and hear.',
  'allow.say.three': 'Hello. I’m WeKnow. Three boxes will appear. Press Allow on each.',
  'first.say': 'Good. Type or say your question, or show me the paper.',

  // App bar and Menu
  'menu.button': 'Menu',
  'menu.ask': 'Ask',
  'menu.checks': 'My checks',
  'menu.notes': 'What WeKnow remembers',
  'menu.settings': 'Settings',
  'menu.help': 'Help',
  'menu.how': 'How WeKnow works', // added: the front page, from the Menu, Help, Welcome and Ask
  'menu.screen': 'Screen',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'menu.signedout': 'Not signed in',
  'bar.signin': 'Sign in',
  'bar.new': 'New conversation', // added: the app bar's button for Menu › Start again
  close: 'Close',

  // Ask
  'home.greeting': 'What can I check for you?', // added: the start screen, before the first message
  'home.try1': 'My kitchen sink is clogged',
  'home.try2': 'How much are brake pads?',
  'home.try3': 'My toilet keeps running',
  'home.try4': 'What does a new water heater cost?',
  'home.try.label': 'Or ask',
  'home.samples.short': 'Try a sample',
  'pic.open': 'Open the picture large', // added: the full-screen picture viewer
  'pic.title': 'The picture',
  'pic.zoom.in': 'Make it bigger',
  'pic.zoom.out': 'Make it smaller',
  'menu.packs': 'Knowledge packs', // added: the Menu drawer
  'menu.recent': 'Recent checks',
  'packs.title': 'Knowledge packs',
  'packs.lead': 'Every price and every guide WeKnow uses comes from a pack kept on this {device}. Each one names its sources.',
  'packs.counts': '{prices} prices, {guides} guides',
  'packs.asof': 'Checked {date}',
  'packs.none': 'The packs could not be listed just now.',
  'home.coach': 'Type or say your question, or show me the paper.',
  'home.coach.picture': 'Press Send to ask about this picture. You can change the words first.', // added: a picture is attached
  'btn.ask': 'Ask',
  'btn.stop': 'Stop',
  'btn.next': 'Next',
  'btn.again': 'Again',
  'btn.listening': 'Listening. Press when you have finished.', // added: screen reader name of the Listening face
  'home.space': 'Space presses the big button',
  // added: the question box at the bottom of Ask (the pattern of chat apps), and the sound switch in the app bar
  'box.label': 'Your question',
  'box.placeholder': 'Ask about a quote, a bill or a problem…',
  'box.placeholder.short': 'Ask a question…', // added: the same box on a phone, where the long hint would wrap
  'box.placeholder.picture': 'Ask about this picture…',
  'box.placeholder.picture.short': 'Ask about it…',
  'box.placeholder.paste': 'Ask, or paste a screenshot', // added: a computer, where a screenshot or a PDF can be pasted
  'box.attached.pdf': 'PDF added', // added
  // added: a picture or a PDF pasted or dropped anywhere on Ask (home/PaperDrop.tsx); nothing is sent until Send
  'drop.title': 'Drop it here',
  'drop.line': 'A picture or a PDF. It stays on this {device} until you press Send.',
  'take.type.title': 'I can read pictures and PDFs',
  'take.type.line': 'This file is neither. Choose a photo, a screenshot or a PDF.',
  'take.pdf.title': 'I could not open this PDF',
  'take.pdf.line': 'It may be damaged. Take a screenshot of it instead, and paste it here.',
  'take.locked.line': 'It is locked with a password. Open it yourself, take a screenshot, and paste it here.',
  'box.listening': 'Listening…',
  'box.camera': 'Take a picture',
  'box.camera.back': 'Back to the camera',
  'box.camera.q': 'What should I know about this?',
  'box.attached': 'Picture added',
  'box.remove': 'Remove the picture',
  'box.mic': 'Say your question',
  'box.send': 'Send',
  'box.finish': 'Finished talking',
  'mic.none': 'This browser cannot listen. Type your question in the box instead.', // added: no speech recognition
  'mic.again': 'Press the microphone and say it once more, or type it.', // added: nothing was heard
  'pic.need.title': 'Add a picture first',
  'pic.need.line': 'Press the camera button to take a picture of it, then press Send. Your words are kept.',
  // added: Ask as one conversation (design/CHAT-SPEC.md): the next questions under every answer
  'menu.again': 'Start again',
  'tag.careful': 'Careful',
  'tag.stop': 'Stop',
  'next.label': 'Ask next',
  'cam.take': 'Take the picture',
  'cam.sheet': 'Take a picture',
  'next.myself': 'Can I do it myself?',
  'next.quote': 'I have a quote for this',
  'next.say': 'What should I say to the shop?',
  'next.unchecked': 'Which lines did you not check?',
  'next.myself.any': 'Can I do any of it myself?',
  'next.billdo': 'What should I do now?',
  'next.remember': 'Remember this company',
  'next.careful': 'I know this company, remember it',
  'careful.1.title': 'Are you sure you know {payee}?',
  'careful.1.why': 'This bill raised a warning: {why}.',
  'careful.1.what': 'If I remember it, I will treat the account ending {digits} as theirs next time.',
  'careful.1.yes': 'Yes, I know them',
  'careful.1.no': 'No, don’t remember it',
  'careful.2.title': 'One more check.',
  'careful.2.line': 'Did you call {payee} at a number you already had, not the one on this bill, and they said the account ends in {digits}?',
  'careful.2.yes': 'Yes, I checked with them',
  'careful.no': 'Not yet',
  'careful.not.title': 'Not saved',
  'careful.not.line': 'You pressed No, so I did not save {payee}.',
  'careful.notyet.title': 'Not saved yet',
  'careful.notyet.line': 'You have not checked the account with {payee} yet.',
  'careful.notyet.do': 'Call them at a number you already have, not the one on this bill. Then press the button again.',
  'careful.why.account-change-notice': 'it says the account has changed',
  'careful.why.changed-account': 'it asks you to pay a new account',
  'careful.why.urgency': 'it rushes you to pay',
  'careful.why.instruction-to-ai': 'it has words that try to tell a reader it is safe',
  'careful.why.numbers-dont-add-up': 'its numbers don’t add up',
  'careful.why.two-accounts': 'it shows two different account numbers',
  'careful.why.new-payee': 'it is a company I have no note of',
  'next.remind': 'Remind me to pay it',
  'next.sums': 'Which numbers?', // added: the bill's printed sums do not hold (core/billMath.ts)
  'next.accounts': 'Where are the account numbers?', // added: two different account numbers (core/billMath.ts)
  'next.steps': 'Show me the steps',
  'next.pro': 'How much would a pro charge?',
  'next.none': 'None of these',
  'next.step': 'Next step',
  'next.again': 'Say it again',
  'next.stop': 'Stop',
  'next.fixed': 'It’s fixed',
  'next.broken': 'Still broken',
  'next.paper': 'It’s a quote or a bill',
  'next.thing': 'Something is broken',
  'next.else': 'Something else',
  'q.paper': 'Is this a fair price, or should I pay this?',
  'q.thing': 'What is broken here, and how do I fix it?',
  'maybe.title': 'I am not sure which one this is.',
  'maybe.line': 'Is it one of these?',
  'none.title': 'Then I don’t have a guide for it yet.',
  'quote.photo': 'Take a picture of the quote with the camera button, then press Send. I will check every line.',
  'quote.unchecked': 'I did not check: {names}. They are not in my price book yet.',
  'quote.unchecked.none': 'I checked every line.',
  'quote.looking.now': 'Looking those prices up online…',
  'quote.found.fair': '{label}: usually {low} to {high}, from price guides online. This one is inside that.',
  'quote.found.high': '{label}: usually {low} to {high}, from price guides online. This one is {over} more than the usual top.',
  'quote.notfound': 'I could not find a sourced price for {names}. Ask the shop what it is for.',
  'pro.none': 'I don’t have a pro price for this one yet.',
  'myself.none': 'I don’t have steps for this one. A pro is the safe choice.',
  'bill.do.ok': 'Pay it the way you always do. Nothing looks different from last time.',
  'remember.done': 'Done. I will remember {payee} on this {device}, and tell you if the account ever changes.',
  'btn.sound.mute': 'Sound is on. Press to turn it off; the words stay on screen.',
  'btn.sound.unmute': 'Sound is off. Press to turn it on.',
  'type.title': 'Type your question',
  'type.line': 'Type it in the box at the bottom. You can ask about a price or a fix.',
  'home.samples': 'No camera handy? Try a picture.',
  'home.choose': 'Choose a photo or PDF', // added: the file picker beside the sample pictures (a PDF too)
  'home.camera': 'Use the camera', // added: back to the live camera after choosing a picture
  'chip.live': 'Camera on',
  'chip.dark': 'Too dark',
  'chip.light': 'Light on',
  'chip.picture': 'A picture', // added: a sample or chosen picture is in the window instead of the camera
  'note.offline': 'No internet. Still works.',
  'note.getting': 'Getting ready: {n}%',
  'listen.title': 'I’m listening',
  asked: 'You asked: “{words}”',
  'asked.earlier': 'From earlier today',
  'asked.date': 'From {date}',
  'look.thing': 'Let me look.',
  'look.paper': 'Let me read it.',
  'wait.6': 'Still looking.',
  'wait.15': 'This is taking a while. I am still here.',
  'first.local': 'I worked that out right here, on this {device}. Nothing left it.',
  'first.offline': 'There is no internet, so I worked it out right here, on this {device}.',
  'kept.project': 'All right. It is in My checks, under {project}.',
  'kept.one': 'All right. You will find it in My checks.',
  'kept.chip': 'Kept in {project}',

  // A thing, and step by step (guides come from the pack; these are the frame around them)
  'fix.title': 'You can fix this yourself.',
  'fix.what': 'I have a guide for this: {guide}.', // added: the guide's own name replaces the drain example
  'fix.offer': 'It takes about {minutes} minutes. Shall I talk you through it?',
  'fix.time': 'It takes about {minutes} minutes.', // added: the steps are a next question now
  'fix.minutes': '{low} to {high}', // added
  'fix.yes': 'Yes, guide me',
  'fix.no': 'Not now',
  'guide.before': 'Before you start',
  'guide.caution': 'One caution. {text}',
  'guide.caution.more': 'Also: {text}', // added: a second caution
  'guide.stopif': 'Stop and call a pro if: {text}', // added: the guide's "stop if" signs, spoken before step 1
  'guide.step': 'Step {n} of {total}',
  'guide.ok': 'Good.',
  'guide.done.title': 'All {total} steps done',
  'guide.done.ask': 'Is it fixed now?', // added: the general form of "Is the water going down now?"
  'guide.yes': 'Yes',
  'guide.no': 'No',
  'guide.good.title': 'Well done',
  'guide.good.line': 'Good. Show me the next thing any time.', // added: the general form of the mesh-screen tip
  'guide.pro.title': 'Time for a pro',
  'guide.pro.line': 'A fair price for a pro to do this is {low} to {high}. Most people pay about {typical}.',
  'guide.pro.quote': 'When you get a quote, show it to me and I will check it.',
  'guide.stop.title': 'Stopped at step {n}',
  'guide.wait': 'No hurry. I will wait.',
  'guide.carry': 'Carry on',
  'guide.finish': 'Finish for now',
  'danger.title': 'Stop. Do not try this.',
  'danger.line': 'This needs a professional. {reason}',

  // A quote
  'quote.covered': 'I covered your name, phone, address and plate. They stay on this {device}.',
  'quote.stays': 'Your name, phone, address and plate stay on this {device}.', // added: device path, no marks drawn
  'quote.know.0': 'I do not know these lines yet.',
  'quote.know.1': 'I know one line.',
  'quote.know.n': 'I know {n} lines.',
  'quote.know.all': 'I know all {n} lines.',
  'quote.know.all.1': 'I know this line.', // added
  'quote.dont.1': 'One I do not: {names}.',
  'quote.dont.n': '{n} I do not: {names}.',
  'quote.looking': 'I am looking that up on the internet.',
  'quote.looking.n': 'I am looking those up on the internet.', // added: several lines
  'quote.found': 'Found it. That line is fair. I will keep it for next time.',
  'quote.requested': 'I asked for that price to be added.', // added
  'quote.requested.n': 'I asked for those prices to be added.', // added
  'quote.skip': 'All right. I will skip that line.',
  'quote.skip.n': 'All right. I will skip those lines.', // added
  'quote.wait': 'There is no internet, so that line has to wait.',
  'quote.wait.n': 'There is no internet, so those lines have to wait.', // added
  'quote.cloud': 'I am checking the prices on the internet.',
  'quote.high.title': 'Line {n} is {over} more than usual.',
  'quote.highs.title': '{n} lines cost more than usual.', // added
  'quote.fair.title': 'This price is normal: every line I know is inside the usual range.',
  'quote.high.1': 'Line {n}, {label}: {amount} is {over} above the usual top price of {top}.', // spec: "Line 3, brake labor, is $180 high." with the reference stated
  'quote.high.2': 'Most shops charge about {typical}. The other lines look fair.',
  'quote.typical': 'Most shops charge about {typical}.', // "Shops near you" needs a local price book; ours is national
  'quote.fair.1': 'One line looks fair.',
  'quote.fair.n': '{n} lines look fair.',
  'quote.pending.1': 'One is not checked.',
  'quote.pending.n': '{n} are not checked.',
  'quote.none.title': 'I can’t check these prices yet', // added: no line is in the price book
  'quote.none.line': 'None of these lines is in my price book yet.', // added
  'quote.low': 'Line {n}, {label}, is below the usual price.', // added
  'quote.fair.all': 'Every line is inside the usual range.', // added
  'quote.mark': '{over} high',
  'quote.words.ask': 'Want words to say to the shop?',
  'quote.words.yes': 'Yes, tell me',
  'quote.words.no': 'No thanks',
  'quote.say.title': 'Say this to the shop',
  'quote.say.line': '“Could you go over the {label} with me? Other shops charge about {typical}.”',
  'quote.say.done': 'Done',
  'quote.say.again': 'Say it again',
  'quote.small': 'I can’t read the small words. Move closer to the top half.',
  'quote.small.title': 'I can’t read this yet', // added
  'line.fair': 'Fair',
  'line.low': 'Below usual',
  'line.found': 'Fair, looked up',
  'line.pending': 'Not checked yet',

  // A bill or a letter
  'letter.covered': 'I covered your name, address and account number. They stay on this {device}.',
  'letter.stays': 'Your name, address and account number stay on this {device}.', // added: device path
  'letter.cloud': 'I am checking it on the internet.',
  'letter.stop.title': 'Don’t pay this bill yet.',
  'letter.check.title': 'Check this bill before you pay.',
  'letter.fine.title': 'This bill looks normal.',
  'letter.sign.account': 'It wants the money sent to a new account.',
  'letter.sign.notice': 'It asks you to pay a new account.', // added: the letter itself announces a new bank or account
  'letter.sign.notice.digits': 'It asks you to pay a new account ending {digits}.', // added: the same, quoting the last four
  'letter.sign.newpayee': 'I have no note of paying {payee} before.', // added: new-payee flag
  'letter.sign.nopayee': 'I cannot tell who is asking for the money.', // added: new-payee flag, no name read
  'letter.sign.changed': 'It wants the money sent to a different account than last time.', // added: changed account, no digits read
  'letter.sign.rush': 'It rushes you to pay.', // added: the general form of "It rushes you: 48 hours."
  'letter.sign.ai': 'It has hidden words that try to tell a reader it is safe.', // added: instruction-to-ai flag
  'letter.fine': 'Same company and same account as last time.', // added
  // added: two plain-code checks on the bill's own words, on the device (core/billMath.ts)
  'letter.sign.sum': 'The numbers on this bill don’t add up: {why}',
  'letter.sign.sum.plain': 'The numbers on this bill don’t add up.',
  'letter.sign.twoacct': 'This bill shows two different account numbers (ending {a} and {b}). Call the company before paying.',
  'letter.sign.twoacct.plain': 'This bill shows two different account numbers. Call the company before paying.',
  'math.why.tax': '{subtotal} plus {tax} tax is {sum}, but the total says {total}.',
  'math.why.balance': 'the last bill of {previous}, minus {paid} paid, plus {charges} in new charges is {sum}, but it asks for {due}.',
  'math.why.paid': '{total} minus {paid} already paid is {sum}, but it asks for {due}.',
  'math.title': 'The numbers I added up',
  'math.row.subtotal': 'Subtotal: {amount}.',
  'math.row.tax': 'Tax: {amount}.',
  'math.row.total': 'Total: {amount}.',
  'math.row.previous': 'Last bill: {amount}.',
  'math.row.paid': 'Paid: {amount}.',
  'math.row.charges': 'New charges: {amount}.',
  'math.row.due': 'It asks for: {amount}.',
  'math.row.sum': 'Added up, that is {sum}, not {said}.',
  'math.row.do': 'Ask the company to explain the numbers before you pay. Use the phone number on an older bill.',
  'accts.title': 'Two account numbers on one bill',
  'accts.line': 'One account number ends in {a}. Another one ends in {b}. A real bill shows your same account number everywhere, also on the part you send back.',
  'accts.do': 'Call the company with the phone number on an older bill, and ask which account is yours before you pay.',
  'letter.do': 'Call the company first. Use the number on an older bill.',
  'letter.call': 'Call {name}',
  'letter.again': 'Say it again',
  'letter.calling': 'Calling {name}.',
  'letter.remind': 'Add a reminder', // added: bills, through a calendar link (no calendar permission)
  'remind.title': 'Add a reminder to your calendar', // added
  'remind.what': 'What', // added
  'remind.when': 'When', // added
  'remind.open': 'Open my calendar', // added
  'remind.file': 'Save a calendar file', // added
  'remind.fine': 'Your calendar does the reminding. WeKnow gets no access to it.', // added
  'remind.default': 'Pay the {payee} bill', // added
  'remind.default.none': 'Pay this bill', // added
  count: '{n}',

  // What WeKnow remembers
  'note.tag': 'From your notes on this {device}',
  'note.payee': 'The account is new. You paid them at one ending {old} before.',
  'note.ask.shop': 'Shall I remember this shop for next time?',
  'note.ask.payee': 'Shall I remember who you pay for this bill?',
  'note.ask.body': 'I would write this in my notes on this {device}:',
  'note.ask.fine': 'Notes never leave this {device}. You can read, change or delete them any time.',
  'note.ask.first': 'I keep notes only on this {device}. They never leave it.',
  'note.ask.yes': 'Remember',
  'note.ask.no': 'No',
  'note.wrote': 'I wrote it down. You can read my notes under What WeKnow remembers.',
  'note.declined': 'All right. I will not.',
  'note.added': 'I added today’s quote to my notes on this {device}.',
  'notes.title': 'What WeKnow remembers',
  'notes.only.title': 'Only on this {device}',
  'notes.only.line':
    'WeKnow keeps these notes on this {device} and nowhere else. Not in your account. Not on the internet. It asks before it writes a new one, and it uses them to give you better answers.',
  'notes.shops': 'Shops and what you paid',
  'notes.payees': 'People you pay',
  'notes.things': 'Your appliances and devices',
  'notes.prefs': 'How you like WeKnow',
  'notes.shops.empty': 'Nothing yet. WeKnow asks before it remembers a shop.',
  'notes.payees.empty': 'Nothing yet. WeKnow asks after a bill that looks normal.',
  'notes.things.empty': 'Nothing yet. Point at a nameplate and WeKnow offers to remember it.',
  'notes.change': 'Change',
  'notes.delete': 'Delete',
  'notes.edit.title': 'Change this note',
  'notes.edit.a': 'Name',
  'notes.edit.b': 'What',
  'notes.edit.c': 'When and more',
  save: 'Save',
  'notes.deleted': 'Deleted “{name}”.',
  'notes.undo': 'Put it back',
  'notes.offer': 'Offer to remember new things',
  'notes.offer.fine': 'Off: WeKnow stops asking and writes nothing new.',
  'notes.backup': 'Backup locked with your own passphrase',
  'notes.backup.fine': 'To move your notes to a new {device}. Only you could open it.',
  soon: 'Coming later',
  'notes.forget': 'Forget everything',
  'notes.forget.fine': 'Deletes every note on this page. Your checks stay in My checks.',
  'notes.forget.ask': 'Forget everything?',
  'notes.forget.body': 'Every note on this page is deleted from this {device}. Your checks stay. This cannot be undone.',
  keep: 'Keep',
  'pref.voice': 'Voice',
  'pref.voice.off': 'Off, words only',
  'pref.speed.0': 'Slower',
  'pref.speed.1': 'Normal speed',
  'pref.speed.2': 'Faster',
  'pref.size': 'Text size',
  'pref.size.0': 'Large',
  'pref.size.1': 'Larger',
  'pref.size.2': 'Largest',
  'pref.lang': 'Language',
  'pref.lang.en': 'English',
  'note.account': 'Account ending {digits}', // added: how a payee note reads
  'note.last': 'Last bill {date}.', // added

  // My checks
  'checks.title': 'My checks',
  'checks.new': 'New project',
  'checks.all': 'All checks',
  'checks.back': 'All projects',
  'checks.rename': 'Rename',
  'checks.rename.title': 'Rename this project',
  'checks.name': 'Name',
  'checks.name.hint': 'For example: The garden',
  'checks.empty.project': 'Nothing here yet',
  'checks.empty': 'Nothing here yet. Every check you make is kept on this {device}.',
  'kind.Guide': 'Guide',
  'kind.Quote': 'Quote',
  'kind.Invoice': 'Invoice',
  'kind.Bill': 'Bill',
  'kind.Letter': 'Letter',
  'kind.Email': 'Email', // added: an email judged with the bill rules
  'check.meta': '{kind}, {date}. Kept on this {device}.',
  'check.meta.short': '{kind}, {date}',
  'check.in': 'In',
  'check.move': 'Move',
  'check.move.title': 'Move to',
  'check.hear': 'Hear it again',
  'check.delete': 'Delete',
  'check.delete.ask': 'Delete this check?',
  'check.delete.body': 'It is removed from this {device}. This cannot be undone.',
  'project.default': 'My home',
  'project.car': 'The car', // added: car quotes are filed here (created on the first one)
  'project.count': '{n} checks', // added: screen reader text for the count

  // The internet
  'ask.item.title': 'May I look up one thing on the internet?',
  'ask.items.title': 'May I look up {n} things on the internet?', // added: several unknown lines at once
  'ask.send': 'This is all I would send:',
  'ask.item.not': 'Not sent: the picture, your name, phone, address or plate.',
  'ask.item.yes': 'Yes, look it up',
  'ask.item.no': 'No, skip it',
  'ask.item.say': 'May I look that up on the internet? I would send only those words, and your region. Not the picture.',
  'ask.item.price': '“{item}” price',
  'ask.item.region': 'Region: {region}',
  'ask.thing.title': 'Send this picture to check online?',
  'ask.thing.body': 'This {device} can’t read it by itself. Only the covered picture below goes.',
  // added: what was covered, said first in one plain line, on the picture and the words sheets alike
  // added: the consent sheet for a check online (picture, PDF words, words): short points, two closed sections,
  // Yes and No always in view (home/AskSheet.tsx)
  'check.title': 'Check this online?',
  'check.title.bill': 'Check this bill online?',
  'check.hidden': 'Hidden here:',
  'check.hidden.none': 'Nothing personal found to hide.',
  'check.rest.words': 'Only the rest of the words go online.',
  'check.rest.picture': 'Only the covered picture and your question go online.',
  'check.picture.goes': 'Black bars hide your details on it.',
  'check.picture.stays': 'The picture stays here.',
  'check.what.hidden': 'What stays hidden',
  'check.what.goes': 'See exactly what goes',
  'check.yes': 'Yes, check it',
  'check.no': 'No',
  'check.every': 'Ask me every time',
  'check.first': 'After a yes, I check by myself when it helps. You can change this in Settings.',
  'hid.name': '{n} name',
  'hid.name.many': '{n} names',
  'hid.phone': '{n} phone',
  'hid.phone.many': '{n} phones',
  'hid.email': '{n} email',
  'hid.email.many': '{n} emails',
  'hid.street': '{n} address',
  'hid.street.many': '{n} addresses',
  'hid.account': '{n} account number',
  'hid.account.many': '{n} account numbers',
  'hid.card': '{n} card number',
  'hid.card.many': '{n} card numbers',
  'hid.ssn': '{n} Social Security number',
  'hid.ssn.many': '{n} Social Security numbers',
  'hid.plate': '{n} license plate',
  'hid.plate.many': '{n} license plates',
  'hid.vin': '{n} car ID (VIN)',
  'hid.vin.many': '{n} car IDs (VIN)',
  'ask.words.more': 'Show all the words ({n} lines)',
  'ask.words.less': 'Show fewer lines',
  'ask.mark.title': 'Covered on this device',
  // The words on the picture are read on this device first, and every personal detail is covered in black.
  'ask.thing.covered': 'Names, numbers, addresses and accounts are covered on this {device} before the picture is sent.', // added
  'ask.thing.list': 'Covered: {list}.', // added
  'ask.thing.none': 'I found no personal details to cover.', // added
  // Still used when a picture read on this device is explained in another language over the internet (after a yes).
  'ask.thing.whole': 'The whole picture is sent as it is, with any names and numbers on it.',
  'ask.thing.not': 'I will tell you every time I use the internet.',
  'ask.thing.yes': 'Yes, send it',
  'ask.thing.no': 'No',
  'ask.thing.say': 'This {device} cannot read pictures by itself. I covered {list} on it. May I send the covered picture over the internet?',
  'ask.thing.say.none': 'This {device} cannot read pictures by itself. I found no personal details on it. May I send it over the internet?', // added
  'ask.thing.said': 'I covered your details and I am sending the picture over the internet.', // added: after the first yes
  // added: a PDF with real text is read from its words; only the covered words may go, never its picture
  'ask.paper.title': 'Send these words to check online?',
  'ask.paper.body': 'This {device} can’t read it by itself. Only the words below go — not the picture.',
  'ask.paper.covered': 'Names, numbers, addresses and accounts are covered on this {device} before the words are sent.',
  'ask.paper.say': 'This {device} cannot read this by itself. I covered {list} in its words. May I send the covered words over the internet?',
  'ask.paper.say.none': 'This {device} cannot read this by itself. I found no personal details in its words. May I send them over the internet?',
  'ask.paper.said': 'I covered your details and I am sending the words over the internet.',
  'where.paper': 'The PDF',
  'where.paper.original': 'The PDF as you gave it',
  'where.sent.paper': 'The words of the PDF, with your personal details covered ({n} characters)',
  // Covering personal details on the picture (added: the cloud reading path)
  'cover.name': '{n} name',
  'cover.name.many': '{n} names',
  'cover.phone': '{n} phone number',
  'cover.phone.many': '{n} phone numbers',
  'cover.email': '{n} email address',
  'cover.email.many': '{n} email addresses',
  'cover.street': '{n} address',
  'cover.street.many': '{n} addresses',
  'cover.account': '{n} account number',
  'cover.account.many': '{n} account numbers',
  'cover.card': '{n} card number',
  'cover.card.many': '{n} card numbers',
  'cover.ssn': '{n} Social Security number',
  'cover.ssn.many': '{n} Social Security numbers',
  'cover.plate': '{n} plate',
  'cover.plate.many': '{n} plates',
  'cover.vin': '{n} VIN',
  'cover.vin.many': '{n} VINs',
  'cover.fail.title': 'I could not cover your details',
  'cover.fail.line': 'I could not read the words on this picture to cover your personal details, so I sent nothing.',
  'cover.fail.try': 'Try again, or take a clearer photo: closer, flat and in good light.',
  'cover.fail.again': 'Try again',
  'cover.fail.photo': 'Take a clearer photo',
  'ask.mail.title': 'May I check this email on the internet?', // added: the email path
  'ask.mail.body': 'This {device} cannot read by itself. I covered your details first. This is all I would send:',
  'ask.mail.not': 'Not sent: your name, email address, phone or account numbers.',
  'ask.mail.yes': 'Yes, check it',
  'ask.none.title': 'Nothing was sent',
  'ask.none.line': 'All right. This {device} needs the internet to see, so I cannot answer this one.',
  'ask.none.again': 'Ask me again any time.',
  'tag.local': 'On this {device}',
  'tag.mixed': 'Used the internet for {n} item',
  'tag.mixed.many': 'Used the internet for {n} items',
  'tag.cloud': 'Checked online',
  'tag.offline': 'No internet. Answered on this {device}.',
  'tag.pending': '{n} item not checked',
  'tag.pending.many': '{n} items not checked',
  'where.title': 'Where this answer came from',
  'where.stayed': 'Stayed on this {device}',
  'where.sent': 'Went over the internet',
  'where.nothing': 'Nothing.',
  'rc.none': 'Nothing left this {device}.',
  'rc.went': 'Only this went online:',
  'rc.more': 'and {n} more, with no personal details',
  'rc.all': 'Everything that went online',
  'rc.sources': 'Where the facts come from ({n})',
  'where.else': 'Nothing else was sent.',
  'where.kept': 'Kept for next time',
  'where.kept.line': 'That price is now on this {device}. Next time this line works without the internet.',
  'where.waiting': 'Waiting for the internet: {names}.',
  'where.declined': 'You said no, so this was not checked: {names}.',
  'where.requested': 'Asked to be added to the price book: {names}.', // added
  'where.facts': 'Where the facts come from',
  'hybrid.title': 'On a device that reads by itself', // added: the hybrid, said plainly in every cloud receipt
  'hybrid.line': 'On a phone or computer that can read by itself, this same check runs right there, and the picture never leaves it. Only a missing price is looked up, after a yes.', // added
  'hybrid.here.cloud': 'This {device} cannot read pictures by itself, so it used the internet.', // added
  'hybrid.here.can': 'This {device} can get ready to read by itself. It takes a while, once, best on home Wi-Fi.', // added
  'hybrid.here.getting': 'This {device} is getting ready to read by itself: {n}%.', // added
  'hybrid.here.ready': 'This {device} now reads by itself.', // added
  'where.more': 'Sources and details',
  'where.tech': 'Technical details',
  'where.picture': 'The picture',
  'where.question': 'Your question',
  'where.covered.quote': 'Your name, phone, address and plate',
  'where.covered.letter': 'Your name, address and account number',
  'where.reading': 'The reading of every line',
  'where.prices': '{n} of {total} price checks',
  'where.steps': 'The steps, from the home repair guide',
  'where.rules': 'The checks on this bill, made by plain rules on this {device}', // added
  'where.answer': 'This answer, as it was given',
  'where.note': 'Your note about this shop, from {when}',
  'where.note.payee': 'Your note about this payee: account ending {digits}',
  'where.mail': 'The email, with your details covered',
  'where.sent.picture': 'This picture',
  'where.sent.covered': 'This picture, with your personal details covered in black', // added
  'where.picture.original': 'The picture as you took it', // added
  'where.covered.list': 'The details I covered: {list}', // added
  'where.sent.question': 'Your question: “{q}”',
  'where.src.price': 'Repair price book: {name}',
  'where.src.web': 'Looked up online just now: {name}',
  'where.src.guide': 'Home repair guide: {name}',
  'where.src.rules': 'Bill checks on this {device}',
  'where.src.kept': 'Kept with the answer',
  'where.checked': 'checked {date}',
  'status.ready': 'Works without the internet',
  'status.cloud': 'Using the internet',
  'status.none': 'No internet',
  'ready.offer.title': 'Shall I get ready to work without the internet?',
  'ready.offer.line': 'It takes a while, so it is best on home Wi-Fi. You can keep using me while I do.',
  'ready.offer.fine': 'One time only. Best on home Wi-Fi.',
  'ready.offer.yes': 'Get ready',
  'ready.offer.no': 'Not now',
  'ready.offer.web': 'Press Get ready to start.',
  'ready.started': 'I have started. I will tell you when I am ready.',
  'ready.later': 'All right. You can do it later, in Settings.',
  'ready.almost': 'Getting ready: almost there',
  'ready.done': 'I am ready. I can work without the internet now.',
  'ready.full': 'This {device} is too full to get ready. WeKnow will keep using the internet.',
  'net.none.title': 'No internet',
  'net.none.line': 'There is no internet, and this {device} needs it to see. Your earlier checks still work.',
  'net.none.btn': 'Open My checks',
  'net.stopped': 'The internet stopped. Here is what I know from this {device}.',

  // When something goes wrong
  'hear.title': 'I didn’t hear that',
  'hear.1': 'Sorry, I did not hear that. Say it once more.',
  'hear.2': 'I still cannot hear you. Press one of these instead.',
  'hear.pick': 'Press the question you want to ask.', // added: this browser cannot listen
  'hear.q1': 'What is this?',
  'hear.q2': 'How do I fix it?',
  'hear.q3': 'Is this a fair price?',
  'hear.q4': 'Should I pay this?', // added: the letter question as a button
  'hear.type': 'Type instead',
  'hear.type.label': 'Your question', // added
  'hear.type.go': 'Ask', // added
  'dark.title': 'It is too dark',
  'dark.phone': 'It is too dark for me to see. I am turning on the light.',
  'dark.better.title': 'The light is on',
  'dark.better.line': 'That is better. Press the camera button when you are ready.',
  'dark.computer': 'It is too dark for me to see. Turn on a lamp, or move near a window.',
  'new.title': 'I don’t know this one yet',
  'new.line': 'I do not have a guide for this yet.',
  'new.offline': 'There is no internet now. Ask me again when it is back.',
  // added: a question answered from words alone, without a picture
  'words.look': 'Let me check.',
  'words.price.head': 'This usually costs {low} to {high}.',
  'words.price.what': 'From my price book: {name}.',
  'words.price.typical': 'Most people pay about {typical}.',
  'words.price.typical.unit': 'Most people pay about {typical}, per {unit}.',
  'words.price.includes': 'That covers {includes}.',
  'words.price.source': 'The numbers come from the price book, checked {date}. Sources and details show where.',
  'words.price.source.nodate': 'The numbers come from the price book. Sources and details show where.',
  'words.price.quote': 'If you have a quote, show it to me and I will check it.',
  'words.none.title': 'I don’t know that one yet',
  'words.none.line': 'I have no price or guide for that yet.',
  'words.none.more': 'I know prices and fixes for home and car repairs. You can also try a sample picture.',
  'where.answer.words': 'The answer, from the price book on this {device}',
  'kind.Price': 'Price',
  'what.title': 'I’m not sure what this is', // added: the reading came back as "unknown"
  'what.line': 'Point me at a repair quote, a bill, or something at home that needs fixing.', // added
  'read.fail': 'I could not read that one. Press Send to try again, or take the picture again.', // added: the reading failed
  'read.fail.title': 'Let’s try that again', // added
  'read.fail.picture': 'I could not read that picture. Press Send to try again, or try another one.', // added: a sample or chosen picture
  'busy.title': 'Busy right now', // added: the cloud said too many requests, or the network failed
  'busy.line': 'WeKnow is busy right now. Try again in a minute.', // added
  'cam.panel': 'The camera is off',
  'cam.title': 'I cannot see',
  'cam.line': 'The camera is turned off for WeKnow.',
  'cam.how': 'Show me how to turn it on',
  'cam.pic': 'Use a picture instead',
  'cam.how.title': 'Turn the camera on',
  'cam.how.phone': 'Open Settings. Press WeKnow. Switch Camera on. Then come back.',
  'cam.how.computer': 'Press the small camera picture at the top, next to the web address. Choose Allow.',
  'cam.none': 'There is no camera here. Choose a picture instead.', // added
  'mic.line': 'I cannot hear. The microphone is turned off for WeKnow.',
  'sound.off': 'Turn your sound up to hear me.',

  // Settings, Help, Set up
  'set.title': 'Settings',
  'set.account': 'Account',
  'set.account.out.title': 'Not signed in',
  'set.account.out': 'WeKnow works the same without an account.',
  'set.account.line':
    'Signing in carries the guides and prices WeKnow has looked up to your other devices. Your checks, notes and pictures stay on this {device}.',
  'set.signin': 'Sign in with Google',
  'set.signout': 'Sign out',
  'set.voice.title': 'Voice and text',
  'set.voice': 'Voice',
  'set.voice.fine': 'Off shows the words only',
  'set.speed': 'Voice speed',
  'set.speed.0': 'Slower',
  'set.speed.1': 'Normal',
  'set.speed.2': 'Faster',
  'set.speed.say': 'This is how fast I will talk.',
  'set.size': 'Text size',
  'set.screen.title': 'Screen',
  'set.screen': 'Light or dark',
  'set.screen.fine': 'System follows this {device}',
  'set.lang.title': 'Language',
  'set.lang': 'WeKnow speaks and shows',
  'set.lang.en': 'English',
  'set.lang.zh': '繁體中文, later',
  'set.privacy': 'Privacy',
  'set.privacy.stays': 'Stays on this {device}',
  'set.privacy.stays.1': 'Your pictures',
  'set.privacy.stays.2': 'Names, phone numbers, addresses, account numbers',
  'set.privacy.stays.3': 'Your checks and your notes',
  'set.privacy.stays.4': 'The people you pay, and who to call',
  'set.privacy.goes': 'May go over the internet, when this {device} cannot answer',
  'set.privacy.goes.1': 'Your question in words, with personal details covered; the name of one thing to look up, and your region',
  'set.privacy.goes.2': 'If this {device} cannot read by itself: the picture you ask about, with names, numbers and addresses covered first, or the covered words of an email',
  'set.every': 'Ask me every time before using the internet',
  'set.net': 'Use the internet', // added: the one choice (HYBRID-ROUTING.md)
  'set.net.auto': 'When it helps',
  'set.net.every': 'Ask me every time',
  'set.net.never': 'Never',
  'set.net.fine.auto': 'When this {device} cannot answer well, WeKnow checks online by itself. Only covered words and pictures go, and every answer shows what went.',
  'set.net.fine.every': 'WeKnow asks you before anything goes over the internet.',
  'set.net.fine.never': 'WeKnow answers only from this {device}. Some questions will stay unanswered.',
  'set.net.fine.once': 'WeKnow will ask you once, the first time this {device} cannot answer.',
  'set.dev.ready': 'This {device} works without the internet',
  'set.dev.ready.fine': 'Ready. Guides and prices were last checked on {date}.',
  'set.dev.can': 'This {device} needs the internet to see',
  'set.dev.can.fine': 'It can get ready to work without it. A large download, best on home Wi-Fi.',
  'set.dev.getting': 'Getting ready to work without the internet',
  'set.dev.getting.fine': '{n}%. You can keep using WeKnow.',
  'set.dev.cannot': 'This {device} uses the internet to see.',
  'set.notes': 'Notes and payees',
  'set.notes.line': 'Kept on this {device} only. WeKnow uses them to notice when a price or an account has changed.',
  'set.notes.rows': 'What WeKnow remembers',
  'set.notes.count': '{n} notes',
  'set.notes.count.1': '1 note',
  'set.payees.rows': 'Known payees',
  'set.mail': 'Email', // added: read-only email connection
  'set.mail.line':
    'WeKnow can read recent bills in your email, read only. It covers your details on this {device}, and never sends, deletes or changes mail.', // added
  'set.mail.connect': 'Connect my email', // added
  'set.mail.open': 'Check recent bills', // added
  'set.mail.disconnect': 'Disconnect', // added
  'set.mail.on': 'Connected, read only', // added
  'set.mail.off': 'Not connected', // added
  'set.family': 'Family',
  'set.call': 'Person to call when unsure',
  'set.call.fine': '{name}, {number}. Kept on this {device}.',
  'set.call.none': 'Nobody yet. Kept on this {device} only.', // added
  'set.call.name': 'Name', // added
  'set.call.number': 'Phone number', // added
  'set.change': 'Change',
  'set.open': 'Open',
  'set.setup': 'Set up for someone else',
  'set.setup.fine': 'Five things, about five minutes',
  'set.delete': 'Delete my data',
  'set.delete.line': 'Deletes every check, project, note and setting from this {device}. This cannot be undone.',
  'set.delete.ask': 'Delete all your data?',
  'set.delete.body': 'Every check, project, note and setting is deleted from this {device}. This cannot be undone.',
  'set.delete.yes': 'Delete everything',
  'help.title': 'Help',
  'help.how.title': 'How it works',
  'help.how': 'Take a picture with the camera button. Type or say what’s wrong. Press Send. WeKnow looks, and tells you what to do.',
  'help.hear': 'Hear how WeKnow works',
  'help.hybrid': 'On a phone or computer that can read by itself, WeKnow reads the picture right there and your details never leave it. Where it cannot, it asks before using the internet, and says so on every answer.', // added
  'help.hear.say': 'Take a picture with the camera button. Type or say what’s wrong, and press Send. I will look, and tell you what to do.',
  'help.words.title': 'Words WeKnow always understands',
  'help.setup.title': 'Setting it up for someone else?',
  'help.setup': 'Five things, about five minutes, on their own {device}.',
  'setup.title': 'Set up for someone else',
  'setup.line': 'Five things, about five minutes. Do them on their {device}.',
  'setup.1': 'Camera and microphone',
  'setup.1.ok': 'Allowed.',
  'setup.1.ask': 'Allow', // added: opens the system box
  'setup.2': 'Work without the internet',
  'setup.3': 'Voice and text they are comfortable with',
  'setup.3.play': 'Play a sample',
  'setup.4': 'Before WeKnow uses the internet',
  'setup.4.once': 'Use it when it helps, and always show me what went',
  'setup.4.every': 'Ask every time',
  'setup.5': 'Who they should call when unsure',
  'setup.5.fine': 'Kept on this {device} only.',
  'setup.try': 'Try it together',
  'setup.after': 'Then put WeKnow on the first screen, so it is one press away.',

  // Explain in my language, and maps (added after the design pass, at Eric's request)
  'explain.button': 'Explain in my language',
  'explain.title': 'Explain in my language',
  'explain.pick': 'Which language?',
  'explain.go': 'Explain',
  'explain.working': 'Writing it in plain words.',
  'explain.fine': 'The answer above stays as it is. This explains it in plain words.',
  'explain.hear': 'Hear it',
  'explain.again': 'Another language',
  'explain.fail': 'I could not explain that one. Try again in a moment.',
  'ask.explain.title': 'May I explain this on the internet?',
  'ask.explain.body': 'This {device} cannot write {language} by itself. This is all I would send:',
  'ask.explain.answer': 'WeKnow’s answer, in English',
  'ask.explain.lang': 'Language: {language}',
  'ask.explain.yes': 'Yes, explain it',
  'pro.find': 'Find a pro nearby',
  'maps.open': 'Opens in Maps. Only the kind of job is searched.',

  // Email (added: read-only email, judged with the bill rules)
  'mail.title': 'Recent bills in your email',
  'mail.line': 'Read only. Your details are covered on this {device} before anything else sees them.',
  'mail.empty': 'Nothing that looks like a bill in the last 45 days.',
  'mail.check': 'Check this one',
  'mail.connect.first': 'Connect your email in Settings first.',
  'mail.loading': 'Reading your recent mail on this {device}.',
  'mail.expired': 'The connection to your email ended. Connect again in Settings.',
  // ---- the hybrid route (design/HYBRID-ROUTING.md) ----
  'consent.title': 'When this {device} can’t answer, may I use the internet?',
  'consent.body': 'Only covered words and pictures go, and I’ll always show you what went. This time it would be:',
  'consent.yes': 'Yes, when it helps',
  'consent.every': 'Ask me every time',
  'consent.no': 'No',
  'consent.say': 'When this {device} can’t answer, may I use the internet? Only covered words and pictures go, and I will always show you what went.',
  'ask.words.title': 'May I check this online?',
  'ask.words.body': 'This {device} could not answer it. This is all I would send:',
  'ask.words.not': 'Not sent: your name, phone, email, address or account numbers.',
  'ask.words.yes': 'Yes, check it',
  'ask.words.say': 'This {device} could not answer that. May I check it online? I would send only your words, with personal details covered.',
  'ask.words.index': 'The names of the guides and prices in my books',
  'route.checking': 'This {device} could not answer that. Let me check online.',
  'route.found': 'I checked online, and it pointed me to my guide.',
  'route.found.price': 'I checked online, and it pointed me to my price book.',
  'route.none': 'I checked online too. It is not in my books yet.',
  'route.none.title': 'It’s not in my books yet',
  'route.blocked.title': 'I did not send that',
  'route.blocked.line': 'Your words still look like they hold a personal detail{what}, so nothing went over the internet.',
  'route.blocked.try': 'Please ask again without it, or take a picture.',
  'route.blocked.again': 'Ask it differently',
  'route.blocked.photo': 'Take a picture',
  'route.never': 'You set WeKnow to answer only from this {device}. You can change that in Settings.',
  'route.never.picture': 'This {device} cannot read pictures by itself, and WeKnow is set never to use the internet. You can change that in Settings.',
  'route.settings': 'Open Settings',
  'route.why.no-device-model': 'This {device} cannot tell by itself which item your words mean.',
  'route.why.no-device-model.picture': 'This {device} cannot read pictures by itself.',
  'route.why.no-device-model.paper': 'This {device} cannot read papers by itself.', // added: a PDF read from its own text
  'route.why.no-match': 'Nothing in the books on this {device} clearly matched your words.',
  'route.why.unknown-picture': 'This {device} could not tell what the picture shows.',
  'route.why.no-guide': 'No guide on this {device} fit the problem.',
  'route.why.none-chosen': 'This {device} looked at its guides, and none of them clearly fit.',
  'route.why.unknown-price': 'The price book on this {device} had no price for these lines.',
  'where.why': 'Why the internet: {why}',
  'where.question.typed': 'Your question as you wrote it',
  'where.sent.words': 'Your words, covered: “{q}”',
  'where.sent.index': 'The names of the {n} guides and prices in my books (no personal details)',
  'where.answer.pack': 'The answer itself, from the books on this {device}',
  'route.web.looking': 'It is not in my books. I am looking on the web.',
  'billcheck.ask': 'I have not seen this company before, and something on it looks wrong. May I check the company and its charges online? Only those words go.',
  'billcheck.looking': 'I am checking this company and its charges online.',
  'billcheck.why': 'I had no note of this company and something on the bill looked wrong, so I checked it online.',
  'billcheck.known-scam-pattern': 'I also checked online: charges like these are a known scam.',
  'billcheck.not-found': 'I also checked online: I could not find this company.',
  'billcheck.real': 'I also checked online: this company can be found. Still check the account before you pay.',
  'billcheck.do.scam': 'Don’t pay it, and don’t call the numbers on this paper.',
  'billcheck.unclear': 'I also checked online, and found nothing clear about it.',
  'route.web.none': 'I also searched the web, but I could not find a reliable answer.',
  'web.intro': 'I don’t have this in my guides. From {n} sources on the web:',
  'web.intro.1': 'I don’t have this in my guides. From 1 source on the web:',
  'web.safety': 'Be careful: {text}',
  'web.pro': 'When to get help: {text}',
  'where.sent.web': 'A web search for: “{q}”',
} as const;

export type StringId = keyof typeof EN;

/** A string with its placeholders filled. Unknown placeholders are left as they are, so a gap is visible. */
export function t(id: StringId, vars: Record<string, string | number> = {}): string {
  const s: string = EN[id];
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Counts are said in words ("seven lines") and shown as figures elsewhere. */
export function words(n: number, capital = false): string {
  const w = n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
  return capital ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

/** An amount as printed on a bill, always with cents: "$90.75", "$129.90", "$1,500.00". */
export const cents = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

export function shortDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}
export function longDate(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}
export function monthYear(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
