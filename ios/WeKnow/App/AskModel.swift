// The Ask conversation: one picture, one question, one answer. Read on the phone (Vision), cover personal
// details, let Apple's on-device model fill the fixed form (or, on a phone without Apple Intelligence, plain code do
// the basic check), let plain code decide, then show and say the answer with the where-it-ran tag. A paper's words
// and picture never leave the phone; only a covered question, or a new company's name and the names of its charges,
// may go online, and the receipt shows exactly what went.

import Foundation
import Observation
import OSLog
import SwiftUI
import UIKit

struct Sample: Identifiable, Sendable {
  let id: String
  let file: String
  let title: String
  let question: String

  static let all = [
    Sample(id: "quote", file: "quote-brakes", title: "A repair quote", question: "Is this a fair price?"),
    Sample(id: "bill", file: "bill-changed-account", title: "A bill", question: "Should I pay this?"),
  ]

  var image: UIImage? {
    Bundle.main.url(forResource: file, withExtension: "png").flatMap { UIImage(contentsOfFile: $0.path) }
  }
}

/// A mark drawn on the picture (UI-SPEC section 6, "Marks on the picture").
struct Mark: Identifiable, Sendable {
  enum Kind: Sendable { case fair, high(String), unknown, warn(Int) }
  let id = UUID()
  let kind: Kind
  let rect: CGRect // normalized, origin top-left
}

/// "Where this answer came from" (UI-SPEC 7.2).
struct Receipt: Sendable {
  var stayed: [String]
  var sent: [String] // the exact words that went, line by line (the dashed box); empty when nothing went
  var sources: [(label: String, date: String, url: String)]
  var tech: [String]
}

/// A Yes-or-No pop-up (for example the two checks before remembering a company whose bill raised warnings).
struct Confirm: Identifiable {
  let id = UUID()
  let title: String
  let message: String
  let yes: String
  let no: String
  let answer: (Bool) -> Void
}

/// The asking sheet before covered words go online (UI-SPEC 7.3): a covered question, or a new company's name and the
/// names of its charges. Never a paper to be read.
struct Consent: Identifiable {
  let id = UUID()
  let lines: [String]
  /// The first time: a yes also lets WeKnow use the internet by itself next time (Settings can change it).
  var once = false
  let answer: (Bool) -> Void
}


@MainActor
@Observable
final class AskModel {
  enum Phase: Equatable { case ready, looking, asking, speaking, done }

  var phase: Phase = .ready
  var picture: UIImage?
  var question: String?
  var bars: [CoverBar] = []
  var barsShown = 0
  var scanning = false
  var marks: [Mark] = []
  /// While a bill is read part by part: the part being read (normalized, top-left origin) and "Part 3 of 6".
  var scanPart: CGRect?
  var scanPartLabel: String?
  var verdict: Verdict?
  var sentences: [Sentence] = []
  var speaking: Int?
  /// The first sentence of the answer itself (after "I covered your ..."), where the words rest when done.
  var answerFrom = 0
  var tag: WhereRan?
  var receipt: Receipt?
  var consent: Consent?
  var confirm: Confirm?
  var showWhere = false
  /// The live light: the exact covered words on their way to the internet right now; nil while the phone works alone.
  var online: String?
  /// The sheet that says what the two lights mean.
  var showLights = false

  /// The conversation so far: every finished question and answer, oldest first. The one in progress lives in the
  /// properties above (picture, question, verdict, sentences ...) until the next question archives it.
  var thread: [Exchange] = []
  /// The next questions offered under the latest answer; pressing one asks it.
  var choices: [NextQ] = []
  /// What the conversation is about now, so a follow-up such as "How much to fix it?" needs no name.
  var topic: Topic?
  /// The bill or quote this conversation is about, until the next picture: follow-ups stay on it even after a price
  /// or a guide was asked about in between.
  var lastPaper: Topic?
  /// Google's search-suggestion chip for an answer grounded in Google Search (it must be shown with it).
  var searchChips: String?
  /// "This bill says" / the quote's lines: what the phone read, listed so nobody has to read the paper.
  var facts: [String] = []
  var inConversation: Bool { !thread.isEmpty || question != nil || picture != nil }

  struct Exchange: Identifiable {
    let id = UUID()
    var question: String?
    var picture: UIImage? // with personal details covered
    var head: String?
    var tone: Tone
    var sentences: [String]
    var tag: WhereRan?
    var receipt: Receipt?
    var facts: [String] = []
  }

  struct NextQ: Identifiable {
    let id = UUID()
    let label: String
    let action: NextAction
  }

  enum NextAction {
    case diy(String), steps(String, Int), pause(String, Int), fixed(String, Bool), proPrice(String)
    case noneOfThese, sayShop, unchecked, doNow, rememberPayee(String, String), haveQuote, quoteOrBill, broken
    /// What the full check needs, on a phone that cannot read by itself.
    case fullCheck
    /// A new company whose bill raised warnings: remembered only after two Yes-or-No pop-ups.
    case rememberCareful(String, String, [String])
  }

  enum Topic {
    case price(PriceItem), guide(Guide), quote([LineItem]), bill(stop: Bool, warn: Bool)
  }

  /// The installed knowledge sections, merged (Menu › Knowledge packs). The matcher is rebuilt when they change.
  var pack: Pack? { Knowledge.shared.active }
  @ObservationIgnored private var matcherKey = ""
  @ObservationIgnored private var cachedMatcher: Matcher?
  private var matcher: Matcher? {
    guard let p = pack else { return nil }
    let key = Knowledge.shared.signature
    if key != matcherKey || cachedMatcher == nil {
      cachedMatcher = Matcher(pack: p)
      matcherKey = key
    }
    return cachedMatcher
  }

  private var task: Task<Void, Never>?
  private var toldLocal = UserDefaults.standard.bool(forKey: "toldLocal")

  var packVersion: String { pack.map { "\($0.id) \($0.version)" } ?? "none" }

  func start(_ sample: Sample) {
    guard let image = sample.image else { return }
    start(image, question: sample.question)
  }

  func start(_ image: UIImage, question: String) {
    stop()
    archive()
    lastPaper = nil
    picture = image
    self.question = question
    answerLang = Lang.of(question)
    asComposed = false
    task = Task { await run(image, question: question) }
  }

  /// What is in the input bar before Send: a picture (camera, photo or sample) and the words typed or spoken.
  /// Nothing is read until the person presses Send, then both go together.
  var draft: UIImage?
  var draftText = ""
  /// The language of the person's own words in this conversation (Core/Lang.swift): the whole answer is given in it.
  var answerLang = Lang.english
  /// A verdict on a bill or a quote stays as composed: a warning about money is never left to a small model's
  /// translation. Set once the paper's kind is known; cleared with each new question.
  private var asComposed = false
  private var translates: Bool { answerLang != Lang.english && !asComposed }
  /// Shown under the input bar when a question needs a picture that is not there yet.
  var draftHint: String?

  /// Send: the picture with the words as its question, or the words alone.
  func send() {
    let q = draftText.trimmingCharacters(in: .whitespacesAndNewlines)
    if let img = draft {
      draft = nil
      draftText = ""
      draftHint = nil
      start(img, question: q.isEmpty ? "What should I know about this?" : q)
      return
    }
    guard !q.isEmpty else { return }
    // "Should I pay it?" in a conversation about a bill or a quote is about that paper: no new picture is needed.
    if WordsAnswer.needsPicture(q) && !paperTopic {
      draftHint = "Add a picture of it with the camera button, then press Send."
      return
    }
    draftText = ""
    draftHint = nil
    ask(words: q)
  }

  /// Asked in words, typed or spoken. Answered from the installed knowledge sections; nothing leaves the phone.
  /// Returns false when the question needs a picture, so the caller can ask for one.
  @discardableResult
  func ask(words: String) -> Bool {
    if WordsAnswer.needsPicture(words) && !paperTopic { return false }
    stop()
    archive()
    question = words
    answerLang = Lang.of(words)
    asComposed = false
    task = Task { await runWords(words) }
    return true
  }

  private func runWords(_ q: String) async {
    guard let pack, let matcher else { return fail("There is no price book on this \(S.device). Add one in Menu, Knowledge packs.", tech: "No knowledge sections installed.") }
    phase = .looking

    // A follow-up about the same thing: "How much would a pro charge?" after a guide, "Can I do it myself?" after a price.
    switch (WordsAnswer.lean(q), topic) {
    case let (.price, .guide(g)?) where proPrice(for: g) != nil: return await perform(.proPrice(g.ref))
    case let (.guide, .price(p)?) where diyGuide(for: p.ref) != nil: return await perform(.diy(diyGuide(for: p.ref)!.ref))
    default: break
    }

    // "Should I pay it?", "What should I do?" right after a bill: WeKnow's own fixed answer, not the model's.
    if case .bill? = lastPaper, !FollowUp.aboutTheAnswer(q), q.range(of: #"\bshould i pay\b|\bpay (it|this|that)\b|\bwhat (should|do|can) i do\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return await perform(.doNow)
    }
    // "What should I say to the shop?" after a quote: WeKnow's own words for the counter.
    if case let .quote(items)? = lastPaper, items.contains(where: { $0.state == .high }),
       q.range(of: #"\b(say|tell|ask)\b.*\b(shop|mechanic|garage|them|him|her)\b"#, options: [.regularExpression, .caseInsensitive]) != nil {
      return await perform(.sayShop)
    }
    // "Why?", "What does line 4 mean?" right after a bill or a quote: answered from the conversation, on this phone.
    let askedThread = paperTopic && FollowUp.aboutThePaper(q)
    if askedThread, await threadAnswer(q) { return }

    let t0 = Date()
    var found = await WordsAnswer.find(q, matcher: matcher, pack: pack, useModel: Device.canRead)
    if found.hit == nil, !paperTopic, let name = topicName {
      // The words name no job by themselves: try them with the topic of the conversation.
      found = await WordsAnswer.find("\(name) \(q)", matcher: matcher, pack: pack, useModel: Device.canRead)
      found.tech.insert("Follow-up: searched again with the topic “\(name)”.", at: 0)
    }
    if Task.isCancelled { return }
    // Words that name nothing new, in a conversation about something: answered from the conversation before anything
    // goes online.
    // After a paper, words that name no job of their own ("What happens if I wait?") are about it too.
    let aboutIt = lastPaper == nil || WordsAnswer.lean(q) == .either
    if found.hit == nil, topic != nil || lastPaper != nil, aboutIt, !askedThread, await threadAnswer(q) { return }
    // The phone found nothing: step up to the cloud by itself (after the one-time yes), covered words only.
    var cloud: (ms: Int, sent: String)?
    var cloudNote: String?
    var web: WebGuide?
    // Words with nothing personal in them go online by themselves when the phone can't answer (unless the person
    // chose Never); anything personal is covered first and needs the one-time yes.
    let mode = UserDefaults.standard.string(forKey: Prefs.internet) ?? ""
    let plain = PII.spans(q).isEmpty
    let online: Bool
    if found.hit != nil || !Cloud.isConfigured || mode == "never" { online = false }
    else if plain { online = true }
    else { online = await mayUseInternet([PII.mask(q)]) }
    if online {
      phase = .looking
      let went61 = await CloudPick.pick(q, pack: pack)
      self.online = nil
      switch went61 {
      case let .found(ref, ms, sent):
        found.hit = pack.guide(ref).map(WordsAnswer.Hit.guide) ?? pack.price(ref).map(WordsAnswer.Hit.price)
        cloud = (ms, sent)
        found.tech.append("The phone found no close match, so Gemini through Firebase AI Logic looked at the whole pack index and chose \(ref) in \(ms) ms. Sent: “\(sent)”.")
      case let .nothing(ms, sent):
        cloud = (ms, sent)
        found.tech.append("Gemini through Firebase AI Logic found nothing in the pack either (\(ms) ms). Sent: “\(sent)”.")
        // Not in WeKnow's own guides: a sourced answer from the web (Google Search grounding).
        let went725 = await CloudPick.searchGuide(q, lang: answerLang)
        self.online = nil
        switch went725 {
        case let .found(g):
          web = g
          cloud = (ms + g.ms, g.sent)
          found.tech.append("Google Search grounding through Firebase AI Logic: \(g.sources.count) web sources, \(g.ms) ms.")
        case let .nothing(ms2, _): found.tech.append("Web search came back without usable sources (\(ms2) ms).")
        case let .blocked(why): cloudNote = "I did not use the internet, because \(why)."
        case let .failed(e): found.tech.append("Web search failed: \(e)")
        }
      case let .blocked(why):
        cloudNote = "I did not use the internet, because \(why)."
        found.tech.append("Cloud step stopped on the phone: \(why).")
      case let .failed(e):
        found.tech.append("Cloud step failed: \(e)")
      }
    }
    let ran: WhereRan = cloud == nil ? .local : .cloud
    let sentLines = cloud.map { [$0.sent] } ?? []
    print("[WeKnow] words answer in \(Int(Date().timeIntervalSince(t0) * 1000)) ms (\(cloud == nil ? "on device" : "cloud")): " + found.tech.joined(separator: " | "))
    if Task.isCancelled { return }

    var lines: [String] = []
    var sources: [(label: String, date: String, url: String)] = []
    var head: String?
    var next: [NextQ] = []
    receipt = nil
    switch found.hit {
    case let .price(p):
      topic = .price(p)
      head = "Usually \(S.money(p.low)) to \(S.money(p.high))."
      lines.append("\(p.name): most people pay about \(S.money(p.typical))\(WordsAnswer.unitWords(p.unit)).")
      if let inc = WordsAnswer.includes(p) { lines.append(inc) }
      let when = WordsAnswer.checked(p.sources)
      lines.append("These numbers come from the price book on this \(S.device)" + (when.map { ", checked \($0)." } ?? "."))
      sources.append((label: "Repair price book: \(p.name)", date: when.map { "checked \($0)" } ?? "", url: p.sources.first?.url ?? ""))
      if let g = diyGuide(for: p.ref) { next.append(NextQ(label: "Can I do it myself?", action: .diy(g.ref))) }
      next.append(NextQ(label: "I have a quote for this", action: .haveQuote))
      keepWords(kind: .quote, title: "Price of \(S.lower(p.name))", car: isCar(p.name, p.category), head: head!, lines: lines)
    case let .prices(ps):
      let low = ps.map(\.low).min() ?? 0, high = ps.map(\.high).max() ?? 0
      topic = ps.first.map(Topic.price)
      head = "From \(S.money(low)) to \(S.money(high)), depending on the model."
      lines.append("I have prices for \(ps.count) models on this \(S.device).")
      for p in ps.prefix(3) { lines.append("\(p.name): about \(S.money(p.typical)).") }
      let when = WordsAnswer.checked(ps.flatMap(\.sources))
      lines.append("These numbers come from the price book on this \(S.device)" + (when.map { ", checked \($0)." } ?? "."))
      for p in ps { sources.append((label: "Repair price book: \(p.name)", date: when.map { "checked \($0)" } ?? "", url: p.sources.first?.url ?? "")) }
      next.append(NextQ(label: "I have a quote for this", action: .haveQuote))
      if let p = ps.first { keepWords(kind: .quote, title: "Price of \(S.lower(p.name))", car: isCar(p.name, p.category), head: head!, lines: lines) }
    case let .guide(g):
      let when = WordsAnswer.checked(g.sources)
      receipt = Receipt(stayed: cloud == nil ? ["Your question", "The answer"] : ["Your question as you said it", "The answer"], sent: sentLines,
                        sources: [(label: "Home repair guide: \(g.name)", date: when.map { "checked \($0)" } ?? "", url: g.sources.first?.url ?? "")],
                        tech: found.tech + ["On-device model: \(Device.status)", "Knowledge pack: \(packVersion)", "Nothing was sent to the internet."])
      keepWords(kind: .problem, title: g.name, car: isCar(g.name, g.category), head: "This sounds like: \(S.lower(g.name)).", lines: [])
      return await guideIntro(g, tag: ran)
    case nil where web != nil:
      let g = web!
      head = Lang.webWords[answerLang]?[0] ?? "I don’t have this in my guides."
      lines += await webLines(g)
      for src in g.sources { sources.append((label: "From the web: \(src.title)", date: "found just now", url: src.url)) }
      searchChips = g.entryHTML
      keepWords(kind: .problem, title: g.title, car: false, head: head!, lines: lines)
    case nil:
      head = "I don’t know this one yet."
      lines = [
        cloud == nil ? "None of the knowledge packs on this \(S.device) covers it." : "I looked in the knowledge packs on this \(S.device) and online, and none covers it.",
        "Try a repair price, like “brake pads”, or a problem at home, like “a clogged sink”. A picture helps too.",
      ]
    }
    if let cloudNote { lines.append(cloudNote) }
    receipt = Receipt(
      stayed: cloud == nil ? ["Your question", "The answer"] : ["Your question as you said it", "The answer"], sent: sentLines, sources: sources,
      tech: found.tech + ["On-device model: \(Device.status)", "Knowledge pack: \(packVersion)"] + (cloud == nil ? ["Nothing was sent to the internet."] : []))
    await answer(head, lines, next: next, tag: ran)
  }

  // MARK: Answers in the conversation

  /// Shows and says one answer: the point first (bold), then the sentences, then the next-question buttons.
  private func answer(_ head: String?, tone: Tone = .plain, _ lines: [String], next: [NextQ] = [], tag where_: WhereRan? = nil) async {
    #if DEBUG
    print("[WeKnow] answer: \(head ?? "-") | \(lines.joined(separator: " | "))")
    #endif
    var head = head, lines = lines, next = next
    if translates {
      let said = await Lang.say((head.map { [$0] } ?? []) + lines + next.map(\.label), in: answerLang)
      let h = head == nil ? 0 : 1
      if h == 1 { head = said[0] }
      lines = Array(said[h ..< h + lines.count])
      next = zip(next, said[(h + lines.count)...]).map { NextQ(label: $1, action: $0.action) }
    }
    verdict = head.map { Verdict(tone: tone, text: $0) }
    tag = where_
    answerFrom = sentences.count
    phase = .speaking
    // The whole answer is on screen at once; the voice then reads it, marking the sentence it is on.
    let first = sentences.count
    sentences.append(contentsOf: lines.map { Sentence(text: $0) })
    if let head { await Voice.shared.say(head) }
    for (i, s) in lines.enumerated() {
      if Task.isCancelled { return }
      speaking = first + i
      await Voice.shared.say(s)
    }
    speaking = nil
    if Task.isCancelled { return }
    choices = next
    phase = .done
  }

  /// A how-to from the web as sentences. The steps come back in the person's language; the fixed words around them
  /// are put in that language too, so no line is half one language and half another.
  private func webLines(_ g: WebGuide) async -> [String] {
    var lines: [String] = []
    let n = g.sources.count
    if answerLang == Lang.english {
      lines.append("From \(S.words(n)) \(n == 1 ? "source" : "sources") on the web, about \(S.lower(g.title)):")
      if let caution = g.safety { lines.append("First, be careful: \(caution)") }
      for (i, step) in g.steps.enumerated() { lines.append("Step \(i + 1). \(step)") }
      if let pro = g.callPro { lines.append("Call a professional if: \(S.lower(pro))") }
      return lines
    }
    let fixed: [String]
    if let table = Lang.webWords[answerLang] { fixed = Array(table[1...]) }
    else { fixed = await Lang.say(["Here is what I found on the web:", "First, be careful:", "Get a professional's help if:"], in: answerLang) }
    lines.append("\(fixed[0]) \(g.title)")
    if let caution = g.safety { lines.append("\(fixed[1]) \(caution)") }
    for (i, step) in g.steps.enumerated() { lines.append("\(i + 1). \(step)") }
    if let pro = g.callPro { lines.append("\(fixed[2]) \(pro)") }
    return lines
  }

  private var paperTopic: Bool {
    switch lastPaper {
    case .bill?, .quote?: true
    default: false
    }
  }

  /// A follow-up answered by Apple's model on this phone from the conversation so far (Core/FollowUp.swift). Nothing
  /// leaves the phone. False when the phone cannot read by itself, there is nothing to go on, or the reply is not kept.
  private func threadAnswer(_ q: String) async -> Bool {
    guard let tp = lastPaper ?? topic else { return false }
    // The common questions are answered by plain code from WeKnow's last answer about the paper.
    var next: [NextQ] = []
    switch tp {
    case let .quote(items):
      if items.contains(where: { $0.state == .high }) { next.append(NextQ(label: "What should I say to the shop?", action: .sayShop)) }
      if items.contains(where: { $0.state == .pending }) { next.append(NextQ(label: "Which lines did you not check?", action: .unchecked)) }
    case .bill: next.append(NextQ(label: "What should I do now?", action: .doNow))
    default: break
    }
    if paperTopic {
      let warnedOnes = thread.filter { $0.tone == .stop || $0.tone == .warn }
      let last = (warnedOnes.last ?? thread.last)
      let said = last.map { ([$0.head].compactMap { $0 } + $0.sentences).joined(separator: " ") } ?? ""
      var items: [LineItem] = []
      if case let .quote(i) = tp { items = i }
      if let plan = FollowUp.plan(q, bill: { if case .bill = tp { return true }; return false }(), answer: said, items: items) {
        print("[WeKnow] follow-up answered by plain code from the last answer")
        await answer(plan.first, Array(plan.dropFirst()), next: next, tag: .local)
        return true
      }
    }
    // A yes-or-no question WeKnow's answer does not settle: the model would guess, so WeKnow says it can't tell.
    if paperTopic, FollowUp.yesNo(q) {
      let bill: Bool = { if case .bill = tp { return true }; return false }()
      await answer("I can’t tell that from this check.", [bill ? "Don’t pay until you call the company on a number you already trust." : "Ask the shop; they can tell you."], next: next, tag: .local)
      return true
    }
    guard Device.canRead else { return false }
    var turns: [FollowUp.Turn] = []
    for e in thread {
      if let asked = e.question { turns.append(FollowUp.Turn(me: true, text: asked, picture: e.picture != nil)) }
      let said = ([e.head].compactMap { $0 } + e.sentences + e.facts).joined(separator: " ")
      if !said.isEmpty { turns.append(FollowUp.Turn(me: false, text: said, warned: e.tone == .stop || e.tone == .warn)) }
    }
    // A quote's lines, spelled out, with the answer they belong to.
    if case let .quote(items) = tp, let last = turns.lastIndex(where: { !$0.me }) {
      turns[last].text += " " + items.map(FollowUp.lineFact).joined(separator: " ")
    }
    let conversation = FollowUp.conversation(turns)
    guard conversation.contains("WeKnow:") else { return false }
    let t0 = Date()
    guard let reply = await FollowUp.ask(conversation, q), !Task.isCancelled else { return false }
    var parts = FollowUp.keptSentences(conversation: conversation, question: q, reply: reply, warned: turns.contains(where: \.warned))
    if parts.isEmpty {
      print("[WeKnow] follow-up reply not kept: \(reply)")
      // About the paper, but nothing the model said can be shown: say so, and what WeKnow already said to do.
      guard paperTopic else { return false }
      parts = ["I can’t tell that from this check."]
      if case .bill = tp { parts.append("Don’t pay until you call the company on a number you already trust.") } else { parts.append("Ask the shop; they can tell you.") }
    } else {
      print("[WeKnow] follow-up answered on this phone from the conversation in \(Int(Date().timeIntervalSince(t0) * 1000)) ms")
    }
    await answer(parts.first, Array(parts.dropFirst()), next: next, tag: .local)
    return true
  }

  private var topicName: String? {
    switch topic {
    case let .price(p)?: p.name
    case let .guide(g)?: g.name
    case let .quote(items)?: items.first?.label
    default: nil
    }
  }

  private func proPrice(for g: Guide) -> PriceItem? { g.proRefs?.compactMap { pack?.price($0) }.first }
  private func diyGuide(for priceRef: String) -> Guide? { pack?.guides.first { !$0.steps.isEmpty && ($0.proRefs ?? []).contains(priceRef) } }
  private func isCar(_ name: String, _ category: String?) -> Bool {
    (category ?? "").hasPrefix("car") || Self.carWords.contains { name.lowercased().contains($0) }
  }

  private func keepWords(kind: DocKind, title: String, car: Bool, head: String, lines: [String]) {
    guard !UserDefaults.standard.bool(forKey: Prefs.dontKeepChecks) else { return }
    Household.shared.add(
      CheckRecord(date: .now, kind: kind, project: car ? "The car" : "My home", title: title, verdict: head, tone: "plain",
                  sentences: lines, onDevice: true),
      picture: nil)
  }

  /// "This sounds like: a clogged kitchen sink." Then the time, the first caution, and the buttons.
  private func guideIntro(_ g: Guide, tag where_: WhereRan? = nil) async {
    topic = .guide(g)
    let pro = proPrice(for: g)
    if g.steps.isEmpty {
      var lines: [String] = []
      if let why = g.safety?.first { lines.append(why) }
      if let p = pro { lines.append("A professional usually charges \(S.money(p.low)) to \(S.money(p.high)) for this.") }
      return await answer("This needs a professional.", tone: .warn, lines, tag: where_)
    }
    var lines = ["It takes about \(WordsAnswer.minutes(g)) minutes, in \(S.words(g.steps.count)) steps."]
    if let s = g.safety?.first { lines.append("Before you start: \(s)") }
    var next = [NextQ(label: "Show me the steps", action: .steps(g.ref, 0))]
    if pro != nil { next.append(NextQ(label: "How much would a pro charge?", action: .proPrice(g.ref))) }
    await answer("This sounds like: \(S.lower(g.name)).", lines, next: next, tag: where_)
  }

  private func perform(_ a: NextAction) async {
    guard let pack else { return }
    phase = .looking
    switch a {
    case let .diy(ref):
      guard let g = pack.guide(ref) else { return await answer("I don’t have steps for this yet.", []) }
      await guideIntro(g)

    case let .steps(ref, i):
      guard let g = pack.guide(ref) else { return }
      topic = .guide(g)
      if i < g.steps.count {
        var lines = [g.steps[i]]
        if i == g.steps.count - 1, let stop = g.stopIf?.first { lines.append("Stop and call a professional if: \(S.lower(stop))") }
        await answer("Step \(i + 1) of \(g.steps.count)", lines, next: [
          NextQ(label: i + 1 < g.steps.count ? "Next step" : "I did the last step", action: .steps(ref, i + 1)),
          NextQ(label: "Say it again", action: .steps(ref, i)),
          NextQ(label: "Stop for now", action: .pause(ref, i)),
        ])
      } else {
        await answer("That was the last step.", ["Did that fix it?"], next: [
          NextQ(label: "It’s fixed", action: .fixed(ref, true)),
          NextQ(label: "Still not working", action: .fixed(ref, false)),
        ])
      }

    case let .pause(ref, i):
      await answer("All right, we stopped at step \(i + 1).", ["Carry on any time."], next: [NextQ(label: "Carry on", action: .steps(ref, i))])

    case let .fixed(ref, yes):
      if yes { return await answer("Good, it’s fixed.", ["If it comes back, ask me again."]) }
      await perform(.proPrice(ref))

    case let .proPrice(ref):
      guard let g = pack.guide(ref), let p = proPrice(for: g) else { return await answer("I don’t have a price for a professional for this yet.", []) }
      await answer("A professional usually charges \(S.money(p.low)) to \(S.money(p.high)).", [
        "Most charge about \(S.money(p.typical)).",
        "If you get a quote, show it to me and I will check it line by line.",
      ], next: [NextQ(label: "I have a quote", action: .haveQuote)])

    case .haveQuote:
      draftHint = "Take a picture of the quote with the camera button, then press Send."
      await answer(nil, ["Take a picture of the quote with the camera button, then press Send. I will check every line."])

    case .noneOfThese:
      await answer("I don’t have steps for this yet.", ["Tell me in a few words what is wrong, and I will look again."])

    case .quoteOrBill:
      await answer(nil, ["Hold the paper flat so it fills the picture, then take it again with the camera button."])

    case .broken:
      await answer(nil, ["Tell me in a few words what is wrong, then press Send. A picture helps too."])

    case .fullCheck:
      await answer("How to get the full check", [
        "The full check reads every part of the page and checks every price on a quote, here on this \(S.device). It needs Apple Intelligence.",
        Device.fullCheckStep,
        "When it is ready, give me the paper again. It is read on this \(S.device), even with no internet.",
        "Until then, I do the basic check of a bill here: the account to pay, the totals, and words that rush you or try to tell a reader it is safe. Your paper is never sent anywhere.",
      ])

    case .sayShop:
      guard case let .quote(items)? = lastPaper ?? topic, let worst = items.filter({ $0.state == .high }).max(by: { ($0.over ?? 0) < ($1.over ?? 0) }) else {
        return await answer("Every line looked normal.", ["You can pay it as it is."])
      }
      let usualTop = worst.item.map { S.money($0.high) } ?? ""
      await answer("Here is what you could say.", [
        "“Line \(worst.n), \(S.lower(worst.label)), is \(S.money(worst.amount ?? 0)). Most shops charge about \(S.money(worst.typical ?? 0)), and the usual top is \(usualTop). Can you explain the difference, or match the usual price?”",
      ])

    case .unchecked:
      guard case let .quote(items)? = lastPaper ?? topic else { return }
      let pending = items.filter { $0.state == .pending }.map(\.label)
      await answer(pending.count == 1 ? "I could not check one line." : "I could not check \(S.words(pending.count)) lines.", [
        "\(S.list(pending)) \(pending.count == 1 ? "is" : "are") not in my price book yet.",
        "Ask the shop what each one is for.",
      ])

    case .doNow:
      guard case let .bill(stop, warn)? = lastPaper ?? topic else { return }
      if stop {
        await answer("Don’t pay it yet.", [
          "Call the company with the number on an older bill or on their website, not the number on this paper.",
          "Ask them if the account really changed.",
        ])
      } else if warn {
        await answer("Check it before you pay.", ["Call the company with a number you already have, and ask if this bill is real."])
      } else {
        await answer("Pay it the way you always do.", [])
      }

    case let .rememberPayee(name, payTo):
      Household.shared.remember(payee: name, payTo: payTo)
      await answer("I will remember \(name).", ["Next time I will check that the account still ends in \(payTo). You can see it in Menu, What WeKnow remembers."])

    case let .rememberCareful(name, payTo, why):
      // Two pop-ups, Yes or No each: what was wrong and whether the person knows this company and account; then
      // whether they checked it with the company at a number they already had.
      let sure = await ask(Confirm(
        title: "Are you sure you know \(name)?",
        message: (why.isEmpty ? "This bill raised a warning." : "This bill raised a warning: \(S.list(why)).")
          + " If I remember it, I will treat the account ending \(payTo) as theirs next time.",
        yes: "Yes, I know them", no: "No", answer: { _ in }))
      let checked = sure ? await ask(Confirm(
        title: "One more check",
        message: "Did you call \(name) at a number you already had, not the one on this bill, and they said the account ends in \(payTo)?",
        yes: "Yes, I checked", no: "Not yet", answer: { _ in })) : false
      // The answer says what was pressed, since the pop-ups are gone from the screen.
      if checked {
        Household.shared.remember(payee: name, payTo: payTo)
        await answer("Saved: \(name)", ["Next time I will check that the account still ends in \(payTo). You can see it in Menu, What WeKnow remembers."])
      } else if sure {
        await answer("Not saved yet", [
          "You have not checked the account with \(name) yet.",
          "Call them at a number you already have, not the one on this bill. Then press the button again.",
        ], next: [NextQ(label: "I know this company, remember it", action: .rememberCareful(name, payTo, why))])
      } else {
        await answer("Not saved", ["You pressed No, so I did not save \(name)."])
      }
    }
  }

  func stop() {
    task?.cancel()
    task = nil
    Voice.shared.stop()
    speaking = nil
    scanning = false
    online = nil
    if phase == .looking || phase == .speaking || phase == .asking { phase = verdict == nil ? .ready : .done }
  }

  func reset() {
    picture = nil
    question = nil
    bars = []
    barsShown = 0
    marks = []
    verdict = nil
    sentences = []
    answerFrom = 0
    speaking = nil
    tag = nil
    receipt = nil
    choices = []
    searchChips = nil
    facts = []
    phase = .ready
  }

  /// Moves the finished question and answer into the conversation and clears the stage for the next one.
  private func archive() {
    if question != nil || picture != nil {
      thread.append(Exchange(
        question: question, picture: picture.map { annotated($0, bars: bars, marks: marks) }, head: verdict?.text,
        tone: verdict?.tone ?? .plain, sentences: sentences.map(\.text), tag: tag, receipt: receipt, facts: facts))
    }
    reset()
  }

  /// Menu › Start again.
  func newConversation() {
    stop()
    reset()
    thread = []
    topic = nil
    lastPaper = nil
  }

  /// Whether the internet may be used for this step (design/HYBRID-ROUTING.md): asked once, then by itself.
  private func mayUseInternet(_ lines: [String]) async -> Bool {
    guard Cloud.isConfigured else { return false }
    let mode = UserDefaults.standard.string(forKey: Prefs.internet) ?? ""
    switch mode {
    case "never": return false
    case "auto": return true
    default:
      let before = phase
      phase = .asking
      let yes = await withCheckedContinuation { c in consent = Consent(lines: lines, once: mode.isEmpty) { c.resume(returning: $0) } }
      consent = nil
      phase = before
      if yes && mode.isEmpty { UserDefaults.standard.set("auto", forKey: Prefs.internet) }
      return yes
    }
  }

  /// Shows a Yes-or-No pop-up and waits for the press.
  private func ask(_ c: Confirm) async -> Bool {
    // Let a pop-up that is closing finish first, so the next one shows.
    while confirm != nil { try? await Task.sleep(for: .milliseconds(100)) }
    try? await Task.sleep(for: .milliseconds(350))
    // Nothing is loading while the pop-up waits (no "Looking..." line under it).
    let before = phase
    phase = .done
    let yes = await withCheckedContinuation { k in
      confirm = Confirm(title: c.title, message: c.message, yes: c.yes, no: c.no) { k.resume(returning: $0) }
    }
    phase = before
    return yes
  }

  /// A next-question button: shown as the person's message, then answered.
  func choose(_ q: NextQ) {
    stop()
    archive()
    question = q.label
    task = Task { await perform(q.action) }
  }

  private func say(_ s: Sentence) async {
    var s = s
    if translates { s.text = await Lang.say(s.text, in: answerLang) }
    sentences.append(s)
    speaking = sentences.count - 1
    await Voice.shared.say(s.text)
    if speaking == sentences.count - 1 { speaking = nil }
  }

  private func run(_ image: UIImage, question: String) async {
    guard let pack, let matcher else { return fail("There is no price book on this \(S.device). Add one in Menu, Knowledge packs.", tech: "No knowledge sections installed.") }
    phase = .looking
    scanning = true
    guard var cg = image.uprightCGImage else { return fail("I can’t read this picture.", tech: "No CGImage.") }

    // 1. Read the words and cover personal details, here on the phone.
    let paper: PaperText
    // Pull the paper flat first (a photo is rarely square-on); the flat copy is what is read, covered and shown.
    if let flat = Straighten.document(cg) {
      cg = flat
      picture = UIImage(cgImage: flat)
      print("[WeKnow] paper straightened")
    }
    do { paper = try await PaperText.read(cg) } catch {
      return fail("I can’t read the small words. Move closer to the top half.", tech: "Vision: \(error)")
    }
    if Task.isCancelled { return }
    #if DEBUG
    // Covered rows only (never the picture or the words as taken), for checking the reading in test runs.
    for r in paper.rows { print("[WeKnow] row \(String(format: "%.3f", r.rect.midY)): \(r.masked)") }
    #endif
    bars = paper.bars
    for i in paper.bars.indices {
      try? await Task.sleep(for: .milliseconds(120))
      withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.22)) { barsShown = i + 1 }
    }
    // Said while the paper is being read: reading does not wait for the voice.
    if !paper.bars.isEmpty {
      let covered = Sentence(text: coveredSentence(paper.coveredKinds))
      sentences.append(covered)
      Task { await Voice.shared.say(covered.text) }
    }
    if Task.isCancelled { return }

    // 2. Read it on this phone. With Apple Intelligence, Apple's model reads the covered words; without it, plain code
    //    does the basic check of a bill, and anything else is not read. A paper is never sent anywhere to be read.
    let reading: Reading
    if Device.canRead {
      do {
        // 3. Read the masked words into the fixed form, find candidates, let the model choose.
        reading = try await Reader.read(paper, image: cg, question: question, matcher: matcher)
      } catch {
        readerLog.error("reading failed on the device: \(String(describing: error), privacy: .public)")
        print("[WeKnow] reading failed on the device: \(error)")
        let declined = "\(error)".localizedCaseInsensitiveContains("unsafe") || "\(error)".localizedCaseInsensitiveContains("sensitive")
        if declined, BasicRead.kind(paper.rows.map(\.masked)) == .bill {
          // Apple's on-device model declined this paper (its safety filter): a bill still gets the basic check by
          // plain code, here on the phone. Nothing is sent.
          print("[WeKnow] on-device model declined; the basic check by plain code instead")
          reading = basicReading(paper, why: "Apple's on-device model declined this paper (\(error))")
        } else {
          fail("I could not finish reading this. Nothing was sent.", tech: "\(Device.engine): \(error)")
          if declined {
            // The on-device model's safety filter declined the picture: never a dead end.
            verdict = Verdict(tone: .plain, text: "I couldn’t read this picture")
            sentences = [Sentence(text: "Tell me in a few words what is wrong, and I will look it up.")]
          }
          choices = [NextQ(label: "Something is broken", action: .broken), NextQ(label: "It’s a quote or a bill", action: .quoteOrBill)]
          return
        }
      }
    } else {
      // This phone cannot read by itself: the basic check. Only a bill goes on from here.
      guard let basic = await basicCheck(paper, question: question) else { return }
      reading = basic
    }
    if Task.isCancelled { return }
    let source = "[WeKnow] inference source: \(reading.where_ == .device ? "ON-DEVICE" : "BASIC CHECK (plain code, no model)") — \(reading.engine) — read \(reading.readMs) ms, choose \(reading.chooseMs) ms — on-device status: \(Device.status)"
    print(source)
    readerLog.notice("\(source, privacy: .public)")
    scanning = false

    // 4. Plain code decides.
    var u = reading.understanding
    // A quote line counts only if its amount is printed on the paper; a photo with no prices (earbuds, a sink) is
    // not a quote, whatever the model filled in.
    if u.kind == .quote {
      // The line's own total is the last amount printed on its row (after quantity, hours and rate); plain code
      // takes it from the paper rather than trusting which number the model copied.
      u.lines = u.lines.map { line in
        var l = line
        if let row = paper.row(for: l.label), let v = BillMath.lastMoney(row.masked), v >= 1 { l.amount = v }
        return l
      }
      // Compared as whole amounts, never as text inside text: 16 is not printed where the row says 160.
      // The line's own row when it can be found, else anywhere on the paper.
      let onPage = BillMath.moneyTokens(paper.masked)
      u.lines = u.lines.filter { line in
        guard let a = line.amount else { return false }
        let printed = paper.row(for: line.label).map { BillMath.moneyTokens($0.masked) } ?? onPage
        return printed.contains { abs($0 - a) < 0.005 }
      }
      if u.lines.isEmpty { u.kind = .unknown }
    }
    // A thing, not a paper (a sink, a filter, a pipe): when the model could not name the kind, what it saw and what
    // was asked still lead to the likely problems, offered as choices.
    if u.kind == .unknown,
       !reading.problem.trimmingCharacters(in: .whitespaces).isEmpty
         || !matcher.candidates("\(reading.problem) \(question)", kind: .guide, minCoverage: 0.2).isEmpty {
      u.kind = .problem
    }
    var escalated: (ms: Int, sent: String)?
    var alsoSent: [String] = [] // a second request with different words (the web search), listed too
    var answer: [Sentence] = []
    var stayed = ["The picture", "The words read from it"]
    var sources: [(String, String, String)] = []
    var tech: [String] = reading.where_ == .basic ? [
      "Basic check: \(reading.engine). The words read on this \(S.device) by Apple Vision were checked by plain code alone. No model read the paper, and nothing was sent to be read.",
      "On-device model: \(Device.status)",
      "Words read on this \(S.device) by Apple Vision; \(paper.bars.count) personal details covered",
      "Knowledge pack: \(packVersion)",
    ] : [
      "Read by: \(reading.engine)",
      "On-device model: \(Device.status)",
      "Read \(reading.readMs) ms, choose \(reading.chooseMs) ms; \(reading.offered) pack items offered",
      "Words read on this phone by Apple Vision; \(paper.bars.count) personal details covered before any model saw them",
      "Knowledge pack: \(packVersion)",
    ]
    if !paper.bars.isEmpty { stayed.insert(coveredList(paper.coveredKinds).capitalizedFirst + " (covered)", at: 1) }

    var next: [NextQ] = []
    asComposed = u.kind == .bill || u.kind == .quote
    switch u.kind {
    case .quote:
      let items = Compose.lineItems(Verdicts.quote(u, pack: pack), labels: u.lines.map(\.label))
      let q = Compose.quote(items)
      verdict = q.verdict
      // The point first, then which lines are not in the price book.
      answer = (q.sentences + Compose.notKnown(items)).map { Sentence(text: $0) }
      // A quote or an invoice with priced lines can carry the same traps as a bill: the same plain rules read its
      // covered words. They can only add a warning to the price verdict, never take one away.
      let signs = Verdicts.bill(u, maskedText: paper.masked, known: []).flags.filter { [.accountChangeNotice, .urgency, .instructionToAI].contains($0) }
      if !signs.isEmpty {
        if signs.contains(.instructionToAI) || signs.contains(.accountChangeNotice) {
          verdict = Verdict(tone: .stop, text: "Don’t pay this yet")
        } else if verdict?.tone != .stop {
          verdict = Verdict(tone: .warn, text: "Check this before you pay")
        }
        answer.insert(contentsOf: signs.map { f -> Sentence in
          let text: String = switch f {
          case .accountChangeNotice: "It wants the money sent to a new account."
          case .urgency: "It rushes you to pay."
          default: "It has hidden words that try to tell a reader it is safe."
          }
          return Sentence(text: text)
        }, at: 0)
        tech.append("Warning signs on this paper: \(signs.map(\.rawValue).joined(separator: ", ")).")
      }
      // Most lines not matched: often the item names came out blurred, or they are not in the price book.
      if items.count >= 3, items.filter({ $0.state == .pending }).count * 2 > items.count {
        answer.append(Sentence(text: "If the photo is blurred, hold the phone still over the paper and take it again."))
      }
      marks = items.compactMap { item in
        guard let row = paper.row(for: item.label) else { return nil }
        switch item.state {
        case .high: return Mark(kind: .high("\(S.money(item.over ?? 0)) high"), rect: row.rect)
        case .fair, .low: return Mark(kind: .fair, rect: row.rect)
        case .pending: return Mark(kind: .unknown, rect: row.rect)
        }
      }
      let known = items.filter { $0.state != .pending }.count
      stayed.append("\(known) of \(items.count) price checks")
      for item in items.compactMap(\.item) {
        let fetched = item.sources.compactMap(\.fetched).sorted().last
        sources.append(("Repair price book: \(item.name)", fetched.map { "checked \(S.longDate($0))" } ?? "", item.sources.first?.url ?? ""))
      }
      tech.append(contentsOf: items.map { i in
        "Line \(i.n): \(i.state) \(i.amount.map(S.money) ?? "-")" + (i.item.map { " vs \(S.money($0.low))–\(S.money($0.high)) (\($0.ref))" } ?? "")
      })
      facts = items.map { i in
        let amount = i.amount.map(S.money) ?? "—"
        let state: String = switch i.state {
        case .high: "\(S.money(i.over ?? 0)) above usual"
        case .fair, .low: "usual price"
        case .pending: "not in my price book"
        }
        return "\(i.label) — \(amount) — \(state)"
      }
      topic = .quote(items)
      lastPaper = topic
      if items.contains(where: { $0.state == .high }) { next.append(NextQ(label: "What should I say to the shop?", action: .sayShop)) }
      if items.contains(where: { $0.state == .pending }) { next.append(NextQ(label: "Which lines did you not check?", action: .unchecked)) }
      if let g = items.compactMap({ $0.item.flatMap { diyGuide(for: $0.ref) } }).first {
        next.append(NextQ(label: "Can I do some of it myself?", action: .diy(g.ref)))
      }
    case .bill:
      let known = Household.shared.known
      // Which account to pay into is printed next to "payment account"; plain code takes it from the paper, so a
      // member number the model copied by mistake never stands in for it.
      let printedRows = paper.rows.map(\.masked)
      // A company the model named that is printed nowhere on the paper was made up: it is not used, so no note can
      // match it (same rule as the web app).
      if let name = u.payee, !BillMath.namePrinted(name, in: paper.masked, covered: paper.coveredNames) {
        tech.append("The model named “\(name)”, which is printed nowhere on the paper, so it was not used.")
        u.payee = nil
      }
      if let to = BillMath.payTo(printedRows, lastTime: Verdicts.knownPayee(u.payee, in: known)?.payTo) { u.payTo = to }
      // Account digits the model gave that are printed nowhere on the paper are not an account (seen on a real
      // phone: a page too small to read came back with "1234"). They are dropped, so no warning is built on them.
      if let to = u.payTo, !paper.masked.contains(to) { u.payTo = nil }
      var v = Verdicts.bill(u, maskedText: paper.masked, known: known)
      // Then part by part, on this phone only (Reading/Sections.swift): plain code cuts the page, Apple's model
      // answers three yes/no questions per part in two wordings, and an answer counts only when both agree.
      var foundIn: [String] = []
      var unread: [String] = [] // parts the on-device model would not answer about: never read as "nothing found"
      var scamOnline = false
      if reading.where_ == .device {
        let parts = Sections.split(paper.rows)
        let f = await Sections.check(parts) { i in
          self.scanPartLabel = "Part \(i + 1) of \(parts.count)"
          self.scanPart = parts[i].rect
        }
        scanPart = nil
        scanPartLabel = nil
        func add(_ flag: Verdicts.BillFlag, _ names: [String]) {
          guard !names.isEmpty else { return }
          if !v.flags.contains(flag) { v.flags.append(flag) }
          for n in names where !foundIn.contains(n) { foundIn.append(n) }
        }
        add(.urgency, f.urgent)
        add(.instructionToAI, f.addressedToAI)
        // A part that says the account is new counts only with an account printed in it; when WeKnow has a note
        // of this payee, only an account other than the one in the note is a change.
        // With no note, the paper itself says the account is new: the same flag as the words "new account"
        // (said once, however many parts say it).
        let lastTime = Verdicts.knownPayee(u.payee, in: known)?.payTo
        for hit in f.newAccount {
          guard hit.endings.contains(where: { $0 != lastTime }) else { continue }
          // The account to pay is still the one printed after "payment account" or "new account" in that part;
          // a meter or invoice number in the same part is not it.
          let partRows = parts.filter { $0.name == hit.part }.flatMap { $0.rows.map(\.masked) }
          if lastTime != nil, let to = BillMath.payToEndings(partRows).first(where: { $0 != lastTime }) { u.payTo = to }
          add(lastTime == nil ? .accountChangeNotice : .changedAccount, [hit.part])
        }
        unread = f.unread
        v.safe = v.flags.isEmpty
        tech.append("Read part by part on this \(S.device): \(f.parts) parts, \(f.asks) yes/no questions in \(f.ms) ms"
          + "; urgent in: \(f.urgent.joined(separator: ", ").ifEmpty("none"))"
          + "; words to an AI in: \(f.addressedToAI.joined(separator: ", ").ifEmpty("none"))"
          + "; new account in: \(f.newAccount.map { "\($0.part) (\($0.endings.joined(separator: ", ")))" }.joined(separator: ", ").ifEmpty("none"))")
        if !f.unread.isEmpty {
          tech.append("Not read closely: \(f.unread.joined(separator: ", ")). Apple's on-device model gave no answer to at least one wording there"
            + " (\(f.errors.joined(separator: "; "))), so the verdict stays at least “Check this bill first”.")
        }
      }
      let b = Compose.bill(v, payee: u.payee, known: known)
      verdict = b.verdict
      answer = b.reasons + (b.doLine.map { [Sentence(text: $0)] } ?? [])
      // Where it was found helps only when it points somewhere: one or two parts, not the whole page.
      if !foundIn.isEmpty, foundIn.count <= 2 {
        answer.insert(Sentence(text: "I found it in \(S.list(foundIn))."), at: min(b.reasons.count, answer.count))
      }
      // Plain-code checks on the words themselves: numbers that don't add up, two account numbers.
      let math = BillMath.check(paper.rows.map(\.masked))
      if !math.isEmpty {
        let stop = math.contains(where: \.stop) || verdict?.tone == .stop
        verdict = Verdict(tone: stop ? .stop : .warn, text: stop ? "Don’t pay this yet" : "Check this bill first")
        answer = math.map { Sentence(text: $0.text) } + answer.filter { !$0.text.hasPrefix("Call the company first") }
        if b.doLine == nil { answer.append(Sentence(text: "Call the company first. Use the number on an older bill.")) }
        tech.append("Bill math: \(math.map(\.text).joined(separator: " / "))")
      }
      // A part the model would not answer about is not a part that was found clean: the bill is never called the
      // usual one on the strength of the part-by-part check, and the person hears which part to look at.
      if !unread.isEmpty {
        if verdict?.tone != .stop { verdict = Verdict(tone: .warn, text: "Check this bill first") }
        let doAt = answer.firstIndex { $0.text.hasPrefix("Call the company first") }
        answer.insert(Sentence(text: "I could not read \(S.list(unread)) closely."), at: doAt ?? answer.count)
        if doAt == nil { answer.append(Sentence(text: "Call the company first. Use the number on an older bill.")) }
      }
      // A company WeKnow has no note of, and something already wrong: the phone cannot know whether this company
      // or these charges are real, so it asks the web (design/HYBRID-ROUTING.md). Only the company and the names
      // of the charges go, built by plain code; the answer can make the warning stronger, never weaker.
      // (The basic check, with no model to read the words: only when a company's name was made out, as on the web.)
      if v.flags.contains(.newPayee), v.flags.count > 1 || !math.isEmpty,
         reading.where_ == .device || u.payee != nil,
         let q = CloudPick.billQuestion(payee: u.payee, rows: printedRows, coveredNames: paper.coveredNames) {
        print("[WeKnow] bill check online, would send: \(q.replacingOccurrences(of: "\n", with: " / "))")
        if await mayUseInternet([q]) {
          phase = .looking
          let went462 = await CloudPick.checkOnline(q, pageNames: paper.coveredNames)
          online = nil
          switch went462 {
          case let .found(c):
            escalated = (c.ms, c.sent)
            if c.finding == .knownScamPattern { scamOnline = true }
            let said: String = switch c.finding {
            case .knownScamPattern: "I also checked online: charges like these are a known scam."
            case .notFound: "I also checked online: I could not find this company."
            case .real: "I also checked online: this company can be found. Still check the account before you pay."
            case .unclear: "I also checked online, and found nothing clear about it."
            }
            answer.append(Sentence(text: said))
            // For "real" or "unclear" WeKnow says its own sentence and nothing more: words that came from the paper
            // could otherwise steer the web's lines into saying it is safe.
            if c.finding == .knownScamPattern || c.finding == .notFound { answer.append(contentsOf: c.points.map { Sentence(text: $0) }) }
            if c.finding == .knownScamPattern {
              verdict = Verdict(tone: .stop, text: "Don’t pay this yet")
              // Calling the company makes no sense when the company is the trap.
              answer.removeAll { $0.text.hasPrefix("Call the company first") }
              answer.append(Sentence(text: "Don’t pay it, and don’t call the numbers on this paper."))
            } else if c.finding == .notFound, verdict?.tone != .stop {
              verdict = Verdict(tone: .warn, text: "Check this bill first")
            }
            for src in c.sources { sources.append(("From the web: \(src.title)", "found just now", src.url)) }
            searchChips = c.entryHTML
            tech.append("Checked online with Google Search grounding through Firebase AI Logic: \(c.finding.rawValue), \(c.sources.count) web sources, \(c.ms) ms. Sent: “\(c.sent)”.")
          case let .nothing(ms, sent):
            escalated = (ms, sent)
            tech.append("Online check came back without usable sources (\(ms) ms).")
          case let .blocked(why):
            answer.append(Sentence(text: "I did not check online, because \(why)."))
            tech.append("Online check stopped on the phone: \(why).")
          case let .failed(e):
            tech.append("Online check failed: \(e)")
          }
        }
      }
      if reading.where_ == .basic {
        answer.append(Sentence(text: "This was the basic check: accounts, totals and warning words, by plain rules on this \(S.device)."))
      }
      marks = billMarks(v, u: u, paper: paper)
      if let match = Verdicts.knownPayee(u.payee, in: known) {
        stayed.append("Your note about this payee: account ending \(match.payTo)")
      }
      sources.append(("Bill checks on this \(S.device)", "checked \(S.longDate(pack.version))", ""))
      tech.append("Bill flags: \(v.flags.map(\.rawValue).joined(separator: ", ").ifEmpty("none"))")
      tech.append("Read: payee \(u.payee ?? "-"), pays to account ending \(u.payTo ?? "-"), urgent \(u.urgent), addressed to AI \(u.addressedToAI)")
      let rowsText = paper.rows.map(\.masked)
      let amountsDue = BillMath.dueAmounts(rowsText)
      facts = [
        u.payee.map { "From: \($0)" },
        amountsDue.due.map { "Amount due: \(S.money($0))" + (amountsDue.minimum.map { " (minimum \(S.money($0)))" } ?? "") },
        BillMath.dueDate(rowsText).map { "Due: \($0)" },
        u.payTo.map { to in "Pay to: account ending \(to)" + (Verdicts.knownPayee(u.payee, in: known).map { $0.payTo != to ? " (last time: \($0.payTo))" : " (same as last time)" } ?? "") },
      ].compactMap { $0 }
      topic = .bill(stop: verdict?.tone == .stop, warn: verdict?.tone == .warn)
      lastPaper = topic
      if v.flags == [.newPayee] && math.isEmpty && unread.isEmpty, let name = u.payee, let to = u.payTo {
        next.append(NextQ(label: "Remember this company", action: .rememberPayee(name, to)))
      } else if v.flags.contains(.newPayee), !scamOnline, let name = u.payee, let to = u.payTo {
        // A new company whose first bill raised warnings can still be remembered, after two confirmations.
        var why: [String] = []
        if Compose.said(.accountChangeNotice, in: v.flags) { why.append("it says the account has changed") }
        if v.flags.contains(.urgency) { why.append("it rushes you to pay") }
        if v.flags.contains(.instructionToAI) { why.append("it has words that try to tell a reader it is safe") }
        if v.flags.contains(.changedAccount) { why.append("it asks you to pay a new account") }
        if !math.isEmpty { why.append("its numbers don’t add up") }
        if !unread.isEmpty { why.append("part of it could not be read closely") }
        next.append(NextQ(label: "I know this company, remember it", action: .rememberCareful(name, to, why)))
      }
      if reading.where_ == .basic { next.append(NextQ(label: "How to get the full check", action: .fullCheck)) }
    case .problem:
      // Never one guess: the guide the model picked (if any) and the next closest ones, for the person to choose.
      let said = reading.problem.trimmingCharacters(in: .whitespacesAndNewlines)
      var refs: [String] = u.problemRef.map { [$0] } ?? []
      for c in matcher.candidates("\(said) \(question)", kind: .guide, minCoverage: 0.2) where !refs.contains(c.ref) { refs.append(c.ref) }
      var guides = refs.prefix(3).compactMap { pack.guide($0) }
      var web: WebGuide?
      var cloudNote: String?
      // Nothing on the phone fits: the covered description goes to the cloud by itself (after the one-time yes):
      // first the whole pack index, then, when no guide fits, a sourced how-to from the web, as for typed questions.
      // Anything that left the phone is listed in the receipt and turns the tag to "Checked online", found or not.
      // The same words twice (the picture's reading only echoed the question) are sent once.
      let norm = { (t: String) in t.lowercased().trimmingCharacters(in: .whitespacesAndNewlines.union(.punctuationCharacters)) }
      let words = said.isEmpty || norm(said) == norm(question) ? question : "\(said) \(question)"
      if guides.isEmpty, reading.where_ == .device, await mayUseInternet([PII.mask(words)]) {
        let went823 = await CloudPick.pick(words, pack: pack)
        online = nil
        switch went823 {
        case let .found(ref, ms, sent):
          escalated = (ms, sent)
          if let g = pack.guide(ref) {
            guides = [g]
            tech.append("The phone found no guide, so Gemini through Firebase AI Logic chose \(ref) from the whole pack index in \(ms) ms. Sent: “\(sent)”.")
          } else {
            tech.append("Gemini through Firebase AI Logic named \(ref), which is not a guide (\(ms) ms). Sent: “\(sent)”.")
          }
        case let .nothing(ms, sent):
          escalated = (ms, sent)
          tech.append("Gemini through Firebase AI Logic found no guide in the pack either (\(ms) ms). Sent: “\(sent)”.")
        case let .blocked(why):
          cloudNote = "I did not use the internet, because \(why)."
          tech.append("Cloud step stopped on the phone: \(why).")
        case let .failed(e):
          tech.append("Cloud step failed: \(e)")
        }
        if guides.isEmpty, cloudNote == nil {
          let went185 = await CloudPick.searchGuide(words, lang: answerLang)
          online = nil
          switch went185 {
          case let .found(g):
            web = g
            if escalated == nil { escalated = (g.ms, g.sent) } else if escalated?.sent != g.sent { alsoSent.append(g.sent) }
            tech.append("Google Search grounding through Firebase AI Logic: \(g.sources.count) web sources, \(g.ms) ms. Sent: “\(g.sent)”.")
          case let .nothing(ms, sent):
            if escalated == nil { escalated = (ms, sent) } else if escalated?.sent != sent { alsoSent.append(sent) }
            tech.append("Web search came back without usable sources (\(ms) ms).")
          case let .blocked(why):
            cloudNote = "I did not use the internet, because \(why)."
            tech.append("Web search stopped on the phone: \(why).")
          case let .failed(e):
            cloudNote = "I tried to look this up online, but it did not work this time."
            tech.append("Web search failed: \(e)")
          }
        }
      }
      let echo = said.lowercased().trimmingCharacters(in: .punctuationCharacters) == question.lowercased().trimmingCharacters(in: .punctuationCharacters)
      let looks = said.isEmpty ? "This looks like a problem at home." : echo ? "Here is what I have that might fit." : "This looks like: \(S.lower(said).trimmingCharacters(in: CharacterSet(charactersIn: ".")))."
      tech.append("Problem read: \(said.isEmpty ? "-" : said); guides offered: \(guides.map(\.ref).joined(separator: ", ").ifEmpty("none"))")
      if guides.isEmpty, let g = web {
        verdict = Verdict(tone: .plain, text: Lang.webWords[answerLang]?[0] ?? "I don’t have this in my guides")
        answer = await webLines(g).map { Sentence(text: $0) }
        for src in g.sources { sources.append(("From the web: \(src.title)", "found just now", src.url)) }
        searchChips = g.entryHTML
      } else if guides.isEmpty {
        verdict = Verdict(tone: .plain, text: "I don’t have steps for this yet")
        answer = [Sentence(text: looks), Sentence(text: escalated == nil
          ? "Tell me in a few words what is wrong, and I will look again."
          : "I looked in my guides and online, and found nothing I can trust. Tell me in a few words what is wrong, and I will look again.")]
        if let cloudNote { answer.append(Sentence(text: cloudNote)) }
      } else {
        verdict = Verdict(tone: .plain, text: "Which one is it?")
        answer = [Sentence(text: looks)]
        next = guides.map { NextQ(label: $0.name, action: .diy($0.ref)) } + [NextQ(label: "None of these", action: .noneOfThese)]
      }
    case .unknown:
      verdict = Verdict(tone: .plain, text: "I’m not sure what this is")
      answer = [Sentence(text: "I don’t see a price or a bill here.")]
      next = [NextQ(label: "It’s a quote or a bill", action: .quoteOrBill), NextQ(label: "Something is broken", action: .broken)]
    }

    // The paper itself never goes anywhere: only what a separate online step sent (a covered question, or a company
    // and the names of its charges) is listed, and turns the tag to the internet.
    tag = escalated == nil ? .local : .cloud
    receipt = Receipt(
      stayed: stayed,
      sent: (escalated.map { [$0.sent] } ?? []) + alsoSent,
      sources: sources.map { (label: $0.0, date: $0.1, url: $0.2) },
      tech: tech)
    if verdict?.tone == .stop { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    print("[WeKnow] result: \(verdict?.text ?? "-") | " + tech.joined(separator: " | "))
    _ = keep(u, answer: answer, picture: UIImage(cgImage: cg), onDevice: escalated == nil)

    // 5. Say it, in the person's language (translated on this phone; what was kept above stays as composed).
    if translates {
      let said = await Lang.say((verdict.map { [$0.text] } ?? []) + answer.map(\.text) + next.map(\.label), in: answerLang)
      let h = verdict == nil ? 0 : 1
      if let v = verdict { verdict = Verdict(tone: v.tone, text: said[0]) }
      for i in answer.indices { answer[i].text = said[h + i] }
      next = zip(next, said[(h + answer.count)...]).map { NextQ(label: $1, action: $0.action) }
    }
    answerFrom = sentences.count
    phase = .speaking
    // The whole answer is on screen at once; the voice then reads it, the point first, marking the sentence it is on.
    let first = sentences.count
    sentences.append(contentsOf: answer)
    if let v = verdict { await Voice.shared.say(v.text) }
    for (i, s) in answer.enumerated() {
      if Task.isCancelled { return }
      speaking = first + i
      await Voice.shared.say(s.text)
    }
    speaking = nil
    if reading.where_ == .device && escalated == nil && !toldLocal {
      toldLocal = true
      UserDefaults.standard.set(true, forKey: "toldLocal")
      await say(Sentence(text: "I worked that out right here, on this \(S.device). Nothing left it."))
    }
    if Task.isCancelled { return }
    choices = next
    phase = .done
  }

  // MARK: The basic check (a phone that cannot read by itself)

  /// The basic check, for a phone that cannot read by itself (web/src/ask/flows.ts basicPaper and noModelPicture).
  /// Plain code says what kind of paper this is from its covered words (Core/BasicRead.swift). A bill goes on through
  /// the same plain rules as every bill (the reading is returned); a quote or anything else is not read, and WeKnow says
  /// what the full check needs. A picture of a thing, with a question that names the problem, is answered from the
  /// question's words, as if typed. Nil when it has answered here. The picture and its words never leave the phone.
  private func basicCheck(_ paper: PaperText, question: String) async -> Reading? {
    let rows = paper.rows.map(\.masked)
    let kind = BasicRead.kind(rows)
    print("[WeKnow] basic check (\(Device.status)): paper kind \(kind.rawValue)")
    if kind == .bill { return basicReading(paper, why: "this \(S.device) cannot read by itself (\(Device.status))") }
    scanning = false
    if kind == .quote {
      await needFullCheck(.quote, paper: paper)
      return nil
    }
    // A thing, not a paper: the words of the question still find a guide or a price ("Why won't this drain?").
    let aboutPaper = question.range(of: #"(?i)price|pay|bill|quote|fair|letter|cost|charg|estimate|invoice|owe|statement|fee"#, options: .regularExpression) != nil
    let asked = PII.mask(question).replacingOccurrences(of: #"\[[a-z ]+(\d{4})?\]"#, with: " ", options: .regularExpression)
    let named = Lexicon.tokenize(WordsAnswer.topic(asked)).contains { !Lexicon.stop.contains($0) }
    if !aboutPaper, named {
      await runWords(question)
      if receipt != nil {
        receipt?.stayed.insert("The picture", at: 0)
        receipt?.tech.insert("This \(S.device) cannot look at pictures by itself (\(Device.status)): answered from the question's words only. The picture was not read or sent.", at: 0)
      }
      return nil
    }
    let wordy = rows.joined().filter { !$0.isWhitespace }.count >= 40
    await needFullCheck(aboutPaper || wordy ? .paper : .thing, paper: paper)
    return nil
  }

  /// The bill form filled by plain code alone: the kind, and who asks to be paid (a company in the person's notes when
  /// its name is printed, else a letterhead that sounds like a company).
  private func basicReading(_ paper: PaperText, why: String) -> Reading {
    let u = BasicRead.bill(paper.rows.map(\.masked), known: Household.shared.known.map(\.name))
    return Reading(understanding: u, where_: .basic, engine: "plain code on this \(S.device), because \(why)", readMs: 0, chooseMs: 0, offered: 0)
  }

  enum Need { case quote, paper, thing }

  /// This phone cannot read this by itself, and nothing was sent: what it is, and what the full check needs.
  private func needFullCheck(_ what: Need, paper: PaperText) async {
    scanning = false
    topic = nil
    let head: String
    let line: String
    switch what {
    case .quote:
      head = "A quote needs the full check"
      line = "I can see this is a quote. Checking each price needs a \(S.device) that can read papers by itself."
    case .paper:
      head = "This paper needs the full check"
      line = "I could not tell what this paper is from its words alone. Reading it needs a \(S.device) that can read papers by itself."
    case .thing:
      head = "I can’t look at pictures on this \(S.device)"
      line = "This \(S.device) cannot look at pictures by itself. Tell me in a few words what is wrong, and I will look that up."
    }
    var stayed = ["The picture", "The words read from it"]
    if !paper.bars.isEmpty { stayed.insert(coveredList(paper.coveredKinds).capitalizedFirst + " (covered)", at: 1) }
    let found = what == .quote ? "a quote" : "no bill"
    receipt = Receipt(stayed: stayed, sent: [], sources: [], tech: [
      "Basic check: this \(S.device) cannot read by itself (\(Device.status)). The words were read here by Apple Vision and \(paper.bars.count) personal details covered; plain code found \(found), so nothing more was read. No model read the paper, and nothing was sent to be read.",
      "Knowledge pack: \(packVersion)",
    ])
    print("[WeKnow] result: \(head) | " + (receipt?.tech ?? []).joined(separator: " | "))
    await answer(head, [line, Device.fullCheckNeeds, "Nothing was sent. Your \(what == .thing ? "picture" : "paper") stays on this \(S.device)."],
                 next: [NextQ(label: "How to get the full check", action: .fullCheck)], tag: .local)
  }

  private static let carWords = ["brake", "rotor", "oil", "tire", "tyre", "alignment", "transmission", "coolant", "battery",
                                 "cabin filter", "air filter", "wiper", "spark", "muffler", "suspension", "strut", "engine"]

  /// Files the check in My checks, on this phone only, unless Settings turned that off. Returns the project name.
  private func keep(_ u: Understanding, answer: [Sentence], picture: UIImage, onDevice: Bool) -> String? {
    guard !UserDefaults.standard.bool(forKey: Prefs.dontKeepChecks), u.kind != .unknown, let verdict else { return nil }
    let labels = u.lines.map { $0.label.lowercased() }.joined(separator: " ")
    let project: String
    let title: String
    switch u.kind {
    case .quote:
      project = Self.carWords.contains { labels.contains($0) } ? "The car" : "My home"
      let total = u.lines.compactMap(\.amount).reduce(0, +)
      title = total > 0 ? "Repair quote, \(S.money(total))" : "Repair quote"
    case .bill:
      project = "My home"
      title = u.payee.map { "Bill from \($0)" } ?? "A bill"
    case .problem:
      project = "My home"
      title = u.problemRef.flatMap { pack?.guide($0)?.name } ?? "A problem at home"
    case .unknown:
      return nil
    }
    Household.shared.add(
      CheckRecord(date: .now, kind: u.kind, project: project, title: title, verdict: verdict.text, tone: verdict.tone.word,
                  sentences: answer.map(\.text), onDevice: onDevice),
      picture: picture.covered(by: bars.map(\.rect)))
    return project
  }

  private func fail(_ line: String, tech: String) {
    scanning = false
    verdict = Verdict(tone: .plain, text: "I can’t answer this one")
    sentences = [Sentence(text: line)]
    receipt = Receipt(stayed: ["The picture"], sent: [], sources: [], tech: [tech])
    phase = .done
    print("[WeKnow] failed: \(tech)")
    Task { await Voice.shared.say(line) }
  }

  /// Red boxes round the sentences that raised a warning, numbered as spoken ("One.", "Two.").
  private func billMarks(_ v: Verdicts.Bill, u: Understanding, paper: PaperText) -> [Mark] {
    var out: [Mark] = []
    var n = 0
    for f in Compose.order where Compose.said(f, in: v.flags) {
      n += 1
      let rows: [PaperRow]
      switch f {
      case .accountChangeNotice:
        let said = paper.rows.filter { Verdicts.matches(Verdicts.accountChange, $0.masked) }
        rows = said.isEmpty ? paper.rows.filter { $0.masked.contains(u.payTo ?? "----") } : said
      case .changedAccount:
        let digits = u.payTo ?? "----"
        rows = paper.rows.filter { $0.masked.contains(digits) || $0.masked.localizedCaseInsensitiveContains("new [account") }
      case .instructionToAI:
        rows = paper.rows.filter { Verdicts.matches(Verdicts.aiInstruction, $0.masked) || $0.masked.localizedCaseInsensitiveContains("assistant") }
      case .urgency:
        rows = paper.rows.filter { Verdicts.matches(Verdicts.urgency, $0.masked) }
      case .newPayee:
        rows = Array(paper.rows.prefix(1))
      }
      if let first = rows.first {
        let rect = rows.dropFirst().reduce(first.rect) { $0.union($1.rect) }
        out.append(Mark(kind: .warn(n), rect: rect))
      }
    }
    return out
  }

  private func coveredList(_ kinds: Set<PIIKind>) -> String {
    let order: [(PIIKind, String)] = [(.name, "name"), (.phone, "phone"), (.street, "address"), (.plate, "plate"), (.account, "account number"),
                                      (.email, "email"), (.card, "long number"), (.ssn, "social security number"), (.vin, "VIN")]
    let words = order.filter { kinds.contains($0.0) }.map(\.1)
    guard let last = words.last else { return "your details" }
    return "your " + (words.count == 1 ? last : words.dropLast().joined(separator: ", ") + " and " + last)
  }

  /// "I covered your name, phone, address and plate. They stay on this phone." (quote.covered / letter.covered)
  private func coveredSentence(_ kinds: Set<PIIKind>) -> String {
    "I covered \(coveredList(kinds)). They stay on this \(S.device)."
  }
}

extension Tone {
  /// How a check's tone is stored in My checks.
  var word: String {
    switch self {
    case .ok: "ok"
    case .warn: "warn"
    case .stop: "stop"
    case .plain: "plain"
    }
  }
}

extension String {
  var capitalizedFirst: String { prefix(1).uppercased() + dropFirst() }
  func ifEmpty(_ s: String) -> String { isEmpty ? s : self }
}

extension UIImage {
  /// The same picture with black bars over the personal details (normalized rects, origin top-left), so the copy
  /// kept in My checks never shows a name, phone, address, plate or account number.
  func covered(by rects: [CGRect]) -> UIImage {
    guard !rects.isEmpty else { return self }
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
      draw(at: .zero)
      UIColor(hex: 0x14211C).setFill()
      for r in rects {
        let box = CGRect(x: r.minX * size.width, y: r.minY * size.height, width: r.width * size.width, height: r.height * size.height)
        ctx.fill(box.insetBy(dx: -3, dy: -2))
      }
    }
  }

  /// The pixels upright, whatever orientation the camera wrote.
  var uprightCGImage: CGImage? {
    if imageOrientation == .up, let cg = cgImage { return cg }
    let format = UIGraphicsImageRendererFormat()
    format.scale = scale
    return UIGraphicsImageRenderer(size: size, format: format).image { _ in draw(at: .zero) }.cgImage
  }
}
