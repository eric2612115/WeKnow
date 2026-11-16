// The Ask conversation: one picture, one question, one answer. Read on the phone (Vision), cover personal
// details, let a model fill the fixed form, let plain code decide, then show and say the answer with the
// where-it-ran tag. The only thing that can ever leave the phone is the masked text, and only after a yes.

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

/// The asking sheet before the masked words go to the cloud (UI-SPEC 7.3, ask.paper.*).
struct Consent: Identifiable {
  let id = UUID()
  let lines: [String]
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
  var verdict: Verdict?
  var sentences: [Sentence] = []
  var speaking: Int?
  /// The first sentence of the answer itself (after "I covered your ..."), where the words rest when done.
  var answerFrom = 0
  var tag: WhereRan?
  var receipt: Receipt?
  var consent: Consent?
  var showWhere = false

  /// The conversation so far: every finished question and answer, oldest first. The one in progress lives in the
  /// properties above (picture, question, verdict, sentences ...) until the next question archives it.
  var thread: [Exchange] = []
  /// The next questions offered under the latest answer; pressing one asks it.
  var choices: [NextQ] = []
  /// What the conversation is about now, so a follow-up such as "How much to fix it?" needs no name.
  var topic: Topic?
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
  }

  struct NextQ: Identifiable {
    let id = UUID()
    let label: String
    let action: NextAction
  }

  enum NextAction {
    case diy(String), steps(String, Int), pause(String, Int), fixed(String, Bool), proPrice(String)
    case noneOfThese, sayShop, unchecked, doNow, rememberPayee(String, String), haveQuote, quoteOrBill, broken
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
    picture = image
    self.question = question
    task = Task { await run(image, question: question) }
  }

  /// What is in the input bar before Send: a picture (camera, photo or sample) and the words typed or spoken.
  /// Nothing is read until the person presses Send, then both go together.
  var draft: UIImage?
  var draftText = ""
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
    if WordsAnswer.needsPicture(q) {
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
    if WordsAnswer.needsPicture(words) { return false }
    stop()
    archive()
    question = words
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

    let t0 = Date()
    var found = await WordsAnswer.find(q, matcher: matcher, pack: pack, useModel: Device.canRead)
    if found.hit == nil, let name = topicName {
      // The words name no job by themselves: try them with the topic of the conversation.
      found = await WordsAnswer.find("\(name) \(q)", matcher: matcher, pack: pack, useModel: Device.canRead)
      found.tech.insert("Follow-up: searched again with the topic “\(name)”.", at: 0)
    }
    print("[WeKnow] words answer in \(Int(Date().timeIntervalSince(t0) * 1000)) ms: " + found.tech.joined(separator: " | "))
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
      receipt = Receipt(stayed: ["Your question", "The answer"], sent: [],
                        sources: [(label: "Home repair guide: \(g.name)", date: when.map { "checked \($0)" } ?? "", url: g.sources.first?.url ?? "")],
                        tech: found.tech + ["On-device model: \(Device.status)", "Knowledge pack: \(packVersion)", "Nothing was sent to the internet."])
      keepWords(kind: .problem, title: g.name, car: isCar(g.name, g.category), head: "This sounds like: \(S.lower(g.name)).", lines: [])
      return await guideIntro(g, tag: .local)
    case nil:
      head = "I don’t know this one yet."
      lines = [
        "None of the knowledge packs on this \(S.device) covers it.",
        "Try a repair price, like “brake pads”, or a problem at home, like “a clogged sink”. A picture helps too.",
      ]
    }
    receipt = Receipt(
      stayed: ["Your question", "The answer"], sent: [], sources: sources,
      tech: found.tech + ["On-device model: \(Device.status)", "Knowledge pack: \(packVersion)", "Nothing was sent to the internet."])
    await answer(head, lines, next: next, tag: .local)
  }

  // MARK: Answers in the conversation

  /// Shows and says one answer: the point first (bold), then the sentences, then the next-question buttons.
  private func answer(_ head: String?, tone: Tone = .plain, _ lines: [String], next: [NextQ] = [], tag where_: WhereRan? = nil) async {
    verdict = head.map { Verdict(tone: tone, text: $0) }
    tag = where_
    answerFrom = sentences.count
    phase = .speaking
    if let head { await Voice.shared.say(head) }
    for s in lines {
      if Task.isCancelled { return }
      await say(Sentence(text: s))
    }
    if Task.isCancelled { return }
    choices = next
    phase = .done
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

    case .sayShop:
      guard case let .quote(items)? = topic, let worst = items.filter({ $0.state == .high }).max(by: { ($0.over ?? 0) < ($1.over ?? 0) }) else {
        return await answer("Every line looked normal.", ["You can pay it as it is."])
      }
      let usualTop = worst.item.map { S.money($0.high) } ?? ""
      await answer("Here is what you could say.", [
        "“Line \(worst.n), \(S.lower(worst.label)), is \(S.money(worst.amount ?? 0)). Most shops charge about \(S.money(worst.typical ?? 0)), and the usual top is \(usualTop). Can you explain the difference, or match the usual price?”",
      ])

    case .unchecked:
      guard case let .quote(items)? = topic else { return }
      let pending = items.filter { $0.state == .pending }.map(\.label)
      await answer(pending.count == 1 ? "I could not check one line." : "I could not check \(S.words(pending.count)) lines.", [
        "\(S.list(pending)) \(pending.count == 1 ? "is" : "are") not in my price book yet.",
        "Ask the shop what each one is for.",
      ])

    case .doNow:
      guard case let .bill(stop, warn)? = topic else { return }
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
    }
  }

  func stop() {
    task?.cancel()
    task = nil
    Voice.shared.stop()
    speaking = nil
    scanning = false
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
    phase = .ready
  }

  /// Moves the finished question and answer into the conversation and clears the stage for the next one.
  private func archive() {
    if question != nil || picture != nil {
      thread.append(Exchange(
        question: question, picture: picture.map { annotated($0, bars: bars, marks: marks) }, head: verdict?.text,
        tone: verdict?.tone ?? .plain, sentences: sentences.map(\.text), tag: tag, receipt: receipt))
    }
    reset()
  }

  /// Menu › Start again.
  func newConversation() {
    stop()
    reset()
    thread = []
    topic = nil
  }

  /// A next-question button: shown as the person's message, then answered.
  func choose(_ q: NextQ) {
    stop()
    archive()
    question = q.label
    task = Task { await perform(q.action) }
  }

  private func say(_ s: Sentence) async {
    sentences.append(s)
    speaking = sentences.count - 1
    await Voice.shared.say(s.text)
    if speaking == sentences.count - 1 { speaking = nil }
  }

  private func run(_ image: UIImage, question: String) async {
    guard let pack, let matcher else { return fail("There is no price book on this \(S.device). Add one in Menu, Knowledge packs.", tech: "No knowledge sections installed.") }
    phase = .looking
    scanning = true
    guard let cg = image.uprightCGImage else { return fail("I can’t read this picture.", tech: "No CGImage.") }

    // 1. Read the words and cover personal details, here on the phone.
    let paper: PaperText
    do { paper = try await PaperText.read(cg) } catch {
      return fail("I can’t read the small words. Move closer to the top half.", tech: "Vision: \(error)")
    }
    if Task.isCancelled { return }
    bars = paper.bars
    for i in paper.bars.indices {
      try? await Task.sleep(for: .milliseconds(120))
      withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.22)) { barsShown = i + 1 }
    }
    if !paper.bars.isEmpty { await say(Sentence(text: coveredSentence(paper.coveredKinds))) }
    if Task.isCancelled { return }

    // 2. Decide where it reads. On this phone whenever Apple's model is available; otherwise ask first.
    let place: Where
    if Device.canRead {
      place = .device
    } else if Cloud.isConfigured {
      phase = .asking
      let lines = paper.rows.map(\.masked)
      let yes = await withCheckedContinuation { c in consent = Consent(lines: lines) { c.resume(returning: $0) } }
      consent = nil
      if !yes {
        scanning = false
        verdict = Verdict(tone: .plain, text: "Nothing was sent")
        tag = nil
        await say(Sentence(text: "All right. This phone needs the internet to check papers, so I cannot answer this one. Ask me again any time."))
        phase = .done
        return
      }
      phase = .looking
      place = .cloud
    } else {
      return fail("This phone cannot read papers by itself yet.", tech: "On-device model: \(Device.status). No Firebase config for the internet path.")
    }

    // 3. Read the masked words into the fixed form, find candidates, let the model choose.
    let reading: Reading
    do {
      reading = try await Reader.read(paper, image: cg, question: question, matcher: matcher, where: place)
    } catch {
      readerLog.error("reading failed on \(place.rawValue, privacy: .public): \(String(describing: error), privacy: .public)")
      print("[WeKnow] reading failed on \(place.rawValue): \(error)")
      return fail("I could not finish reading this. Nothing else was sent.", tech: "\(place == .device ? Device.engine : Cloud.engine): \(error)")
    }
    if Task.isCancelled { return }
    let source = "[WeKnow] inference source: \(reading.where_ == .device ? "ON-DEVICE" : "CLOUD") — \(reading.engine) — read \(reading.readMs) ms, choose \(reading.chooseMs) ms — on-device status: \(Device.status)"
    print(source)
    readerLog.notice("\(source, privacy: .public)")
    scanning = false

    // 4. Plain code decides.
    var u = reading.understanding
    // A quote line counts only if its amount is printed on the paper; a photo with no prices (earbuds, a sink) is
    // not a quote, whatever the model filled in.
    if u.kind == .quote {
      let printed = paper.masked.replacingOccurrences(of: ",", with: "")
      u.lines = u.lines.filter { line in
        guard let a = line.amount else { return false }
        let whole = a.rounded() == a ? String(Int(a)) : String(format: "%.2f", a)
        return printed.contains(whole)
      }
      if u.lines.isEmpty { u.kind = .unknown }
    }
    var answer: [Sentence] = []
    var stayed = ["The picture", "The words read from it"]
    var sources: [(String, String, String)] = []
    var tech: [String] = [
      "Read by: \(reading.engine)",
      "On-device model: \(Device.status)",
      "Read \(reading.readMs) ms, choose \(reading.chooseMs) ms; \(reading.offered) pack items offered",
      "Words read on this phone by Apple Vision; \(paper.bars.count) personal details covered before any model saw them",
      "Knowledge pack: \(packVersion)",
    ]
    if !paper.bars.isEmpty { stayed.insert(coveredList(paper.coveredKinds).capitalizedFirst + " (covered)", at: 1) }

    var next: [NextQ] = []
    switch u.kind {
    case .quote:
      let items = Compose.lineItems(Verdicts.quote(u, pack: pack), labels: u.lines.map(\.label))
      let q = Compose.quote(items)
      verdict = q.verdict
      // The point first, then which lines are not in the price book.
      answer = (q.sentences + Compose.notKnown(items)).map { Sentence(text: $0) }
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
      topic = .quote(items)
      if items.contains(where: { $0.state == .high }) { next.append(NextQ(label: "What should I say to the shop?", action: .sayShop)) }
      if items.contains(where: { $0.state == .pending }) { next.append(NextQ(label: "Which lines did you not check?", action: .unchecked)) }
      if let g = items.compactMap({ $0.item.flatMap { diyGuide(for: $0.ref) } }).first {
        next.append(NextQ(label: "Can I do some of it myself?", action: .diy(g.ref)))
      }
    case .bill:
      let known = Household.shared.known
      let v = Verdicts.bill(u, maskedText: paper.masked, known: known)
      let b = Compose.bill(v, payee: u.payee, known: known)
      verdict = b.verdict
      answer = b.reasons + (b.doLine.map { [Sentence(text: $0)] } ?? [])
      marks = billMarks(v, u: u, paper: paper)
      if let match = Verdicts.knownPayee(u.payee, in: known) {
        stayed.append("Your note about this payee: account ending \(match.payTo)")
      }
      sources.append(("Bill checks on this \(S.device)", "checked \(S.longDate(pack.version))", ""))
      tech.append("Bill flags: \(v.flags.map(\.rawValue).joined(separator: ", ").ifEmpty("none"))")
      tech.append("Read: payee \(u.payee ?? "-"), pays to account ending \(u.payTo ?? "-"), urgent \(u.urgent), addressed to AI \(u.addressedToAI)")
      topic = .bill(stop: b.verdict.tone == .stop, warn: b.verdict.tone == .warn)
      if v.flags == [.newPayee], let name = u.payee, let to = u.payTo {
        next.append(NextQ(label: "Remember this company", action: .rememberPayee(name, to)))
      }
    case .problem:
      // Never one guess: the guide the model picked (if any) and the next closest ones, for the person to choose.
      let said = reading.problem.trimmingCharacters(in: .whitespacesAndNewlines)
      var refs: [String] = u.problemRef.map { [$0] } ?? []
      for c in matcher.candidates("\(said) \(question)", kind: .guide, minCoverage: 0.2) where !refs.contains(c.ref) { refs.append(c.ref) }
      let guides = refs.prefix(3).compactMap { pack.guide($0) }
      let echo = said.lowercased().trimmingCharacters(in: .punctuationCharacters) == question.lowercased().trimmingCharacters(in: .punctuationCharacters)
      let looks = said.isEmpty ? "This looks like a problem at home." : echo ? "Here is what I have that might fit." : "This looks like: \(S.lower(said).trimmingCharacters(in: CharacterSet(charactersIn: ".")))."
      tech.append("Problem read: \(said.isEmpty ? "-" : said); guides offered: \(guides.map(\.ref).joined(separator: ", ").ifEmpty("none"))")
      if guides.isEmpty {
        verdict = Verdict(tone: .plain, text: "I don’t have steps for this yet")
        answer = [Sentence(text: looks), Sentence(text: "Tell me in a few words what is wrong, and I will look again.")]
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

    tag = reading.where_ == .device ? .local : .cloud
    receipt = Receipt(
      stayed: stayed,
      sent: reading.where_ == .cloud ? paper.rows.map(\.masked) : [],
      sources: sources.map { (label: $0.0, date: $0.1, url: $0.2) },
      tech: tech)
    if verdict?.tone == .stop { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    print("[WeKnow] result: \(verdict?.text ?? "-") | " + tech.joined(separator: " | "))
    _ = keep(u, answer: answer, picture: UIImage(cgImage: cg), onDevice: reading.where_ == .device)

    // 5. Say it.
    answerFrom = sentences.count
    phase = .speaking
    // The point is said first (it is shown in bold above the sentences).
    if let v = verdict { await Voice.shared.say(v.text) }
    for s in answer {
      if Task.isCancelled { return }
      await say(s)
    }
    if reading.where_ == .device && !toldLocal {
      toldLocal = true
      UserDefaults.standard.set(true, forKey: "toldLocal")
      await say(Sentence(text: "I worked that out right here, on this \(S.device). Nothing left it."))
    } else if reading.where_ == .cloud {
      await say(Sentence(text: "I checked the covered words on the internet. The picture stayed on this \(S.device)."))
    }
    if Task.isCancelled { return }
    choices = next
    phase = .done
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
    for f in Compose.order where v.flags.contains(f) {
      n += 1
      let rows: [PaperRow]
      switch f {
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
                                      (.email, "email"), (.card, "card number"), (.ssn, "social security number"), (.vin, "VIN")]
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
