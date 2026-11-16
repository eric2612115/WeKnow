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
    reset()
    picture = image
    self.question = question
    task = Task { await run(image, question: question) }
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
    phase = .ready
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
      reading = try await Reader.read(paper, question: question, matcher: matcher, where: place)
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
    let u = reading.understanding
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
    case .problem:
      if let ref = u.problemRef, let g = pack.guide(ref) {
        verdict = Verdict(tone: .ok, text: "You can fix this")
        let mins = g.minutes.count == 2 && g.minutes[0] != g.minutes[1] ? "\(Int(g.minutes[0])) to \(Int(g.minutes[1]))" : "\(Int(g.minutes.first ?? 15))"
        answer = [Sentence(text: "This looks like: \(S.lower(g.name)).")]
        answer.append(Sentence(text: "It takes about \(mins) minutes. Here is the first step."))
        if let first = g.steps.first { answer.append(Sentence(text: first)) }
        let fetched = g.sources.compactMap(\.fetched).sorted().last
        sources.append(("Home repair guide: \(g.name)", fetched.map { "checked \(S.longDate($0))" } ?? "", g.sources.first?.url ?? ""))
      } else {
        verdict = Verdict(tone: .plain, text: "I don’t know this one yet")
        answer = [Sentence(text: "I do not have a guide for it yet.")]
      }
    case .unknown:
      verdict = Verdict(tone: .plain, text: "I can’t read this yet")
      answer = [Sentence(text: "I can’t tell what this paper is. Try a repair quote, a bill or a problem at home.")]
    }

    tag = reading.where_ == .device ? .local : .cloud
    receipt = Receipt(
      stayed: stayed,
      sent: reading.where_ == .cloud ? paper.rows.map(\.masked) : [],
      sources: sources.map { (label: $0.0, date: $0.1, url: $0.2) },
      tech: tech)
    if verdict?.tone == .stop { UINotificationFeedbackGenerator().notificationOccurred(.warning) }
    let filedUnder = keep(u, answer: answer, picture: UIImage(cgImage: cg), onDevice: reading.where_ == .device)

    // 5. Say it.
    answerFrom = sentences.count
    phase = .speaking
    // The verdict is on the band; it is said first, not repeated as a caption.
    if let v = verdict { await Voice.shared.say(v.text + ".") }
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
    if let filedUnder { await say(Sentence(text: "It is in My checks, under \(filedUnder).")) }
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
    let tone: String = switch verdict.tone {
    case .ok: "ok"
    case .warn: "warn"
    case .stop: "stop"
    case .plain: "plain"
    }
    Household.shared.add(
      CheckRecord(date: .now, kind: u.kind, project: project, title: title, verdict: verdict.text, tone: tone,
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
