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
  'welcome.fine': 'No account. No typing. Turn your sound up.',
  'allow.title': 'Press Allow',
  'allow.line': 'So WeKnow can see and hear.',
  'allow.point': 'Press this one',
  'allow.fine': 'Pictures stay on this {device} unless you say yes.',
  'allow.say': 'Hello. I’m WeKnow. A box has appeared. Press Allow, so I can see and hear.',
  'allow.say.three': 'Hello. I’m WeKnow. Three boxes will appear. Press Allow on each.',
  'first.say': 'Good. Now point me at something. Press Ask, and tell me what’s wrong.',

  // App bar and Menu
  'menu.button': 'Menu',
  'menu.ask': 'Ask',
  'menu.checks': 'My checks',
  'menu.notes': 'What WeKnow remembers',
  'menu.settings': 'Settings',
  'menu.help': 'Help',
  'menu.screen': 'Screen',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',
  'menu.signedout': 'Not signed in',
  'bar.signin': 'Sign in',
  close: 'Close',

  // Ask
  'home.coach': 'Point at it. Press Ask. Say what’s wrong.',
  'btn.ask': 'Ask',
  'btn.stop': 'Stop',
  'btn.next': 'Next',
  'btn.again': 'Again',
  'btn.listening': 'Listening. Press when you have finished.', // added: screen reader name of the Listening face
  'home.space': 'Space presses the big button',
  'home.samples': 'No camera handy? Try a picture.',
  'home.choose': 'Choose a photo', // added: the file picker beside the sample pictures
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
  'fix.title': 'You can fix this',
  'fix.what': 'I have a guide for this: {guide}.', // added: the guide's own name replaces the drain example
  'fix.offer': 'It takes about {minutes} minutes. Shall I talk you through it?',
  'fix.minutes': '{low} to {high}', // added
  'fix.yes': 'Yes, guide me',
  'fix.no': 'Not now',
  'guide.before': 'Before you start',
  'guide.caution': 'One caution. {text}',
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
  'quote.requested': 'I do not have a price I can trust for that yet. I asked for it to be added.', // added
  'quote.requested.n': 'I do not have prices I can trust for those yet. I asked for them to be added.', // added
  'quote.skip': 'All right. I will skip that line.',
  'quote.skip.n': 'All right. I will skip those lines.', // added
  'quote.wait': 'There is no internet, so that line has to wait.',
  'quote.wait.n': 'There is no internet, so those lines have to wait.', // added
  'quote.cloud': 'I am checking the prices on the internet.',
  'quote.high.title': 'One line is high',
  'quote.highs.title': '{n} lines are high', // added
  'quote.fair.title': 'This looks fair',
  'quote.high.1': 'Line {n}, {label}, is {over} high.',
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
  'letter.stop.title': 'Don’t pay this yet',
  'letter.check.title': 'Check this first',
  'letter.fine.title': 'This looks normal',
  'letter.sign.account': 'It wants the money sent to a new account.',
  'letter.sign.newpayee': 'I have no note of paying {payee} before.', // added: new-payee flag
  'letter.sign.nopayee': 'I cannot tell who is asking for the money.', // added: new-payee flag, no name read
  'letter.sign.changed': 'It wants the money sent to a different account than last time.', // added: changed account, no digits read
  'letter.sign.rush': 'It rushes you to pay.', // added: the general form of "It rushes you: 48 hours."
  'letter.sign.ai': 'It has hidden words that try to tell a reader it is safe.', // added: instruction-to-ai flag
  'letter.fine': 'Same company and same account as last time.', // added
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
  'ask.thing.title': 'May I send this picture over the internet?',
  'ask.thing.body': 'This {device} cannot read pictures by itself. This is all I would send:',
  // Lead decision (design notes, question 2): no local text reading on the web, so the whole picture goes.
  'ask.thing.whole': 'The whole picture is sent as it is, with any names and numbers on it.',
  'ask.thing.not': 'I will tell you every time I use the internet.',
  'ask.thing.yes': 'Yes, send it',
  'ask.thing.no': 'No',
  'ask.thing.say': 'This {device} cannot read pictures by itself. May I send this picture over the internet?',
  'ask.thing.said': 'I am sending the picture over the internet.', // added: after the first yes
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
  'tag.cloud': 'Answered using the internet',
  'tag.offline': 'No internet. Answered on this {device}.',
  'tag.pending': '{n} item not checked',
  'tag.pending.many': '{n} items not checked',
  'where.title': 'Where this answer came from',
  'where.stayed': 'Stayed on this {device}',
  'where.sent': 'Went over the internet',
  'where.nothing': 'Nothing.',
  'where.else': 'Nothing else was sent.',
  'where.kept': 'Kept for next time',
  'where.kept.line': 'That price is now on this {device}. Next time this line works without the internet.',
  'where.waiting': 'Waiting for the internet: {names}.',
  'where.declined': 'You said no, so this was not checked: {names}.',
  'where.requested': 'Asked to be added to the price book: {names}.', // added
  'where.facts': 'Where the facts come from',
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
  'where.sent.question': 'Your question: “{q}”',
  'where.src.price': 'Repair price book: {name}',
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
  'dark.better.line': 'That is better. Press Ask when you are ready.',
  'dark.computer': 'It is too dark for me to see. Turn on a lamp, or move near a window.',
  'new.title': 'I don’t know this one yet',
  'new.line': 'I do not have a guide for this yet.',
  'new.offline': 'There is no internet now. Ask me again when it is back.',
  'what.title': 'I’m not sure what this is', // added: the reading came back as "unknown"
  'what.line': 'Point me at a repair quote, a bill, or something at home that needs fixing.', // added
  'read.fail': 'I could not read that one. Hold it still and press Ask again.', // added: the reading failed
  'read.fail.title': 'Let’s try that again', // added
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
  'set.privacy.goes': 'May go over the internet, after you say yes',
  'set.privacy.goes.1': 'The name of one thing to look up, and your region',
  'set.privacy.goes.2': 'If this {device} cannot read by itself: the whole picture you ask about, or the covered words of an email',
  'set.every': 'Ask me every time before using the internet',
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
  'help.how': 'Point the camera at it. Press Ask. Say what’s wrong. WeKnow looks, and tells you what to do.',
  'help.hear': 'Hear how WeKnow works',
  'help.hear.say': 'Point me at something. Press Ask, and say what’s wrong. I will look, and tell you what to do.',
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
  'setup.4.once': 'Ask the first time, then just say so',
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
