// Questions asked in words, typed or spoken, with no picture: "How much is a brake pad replacement?",
// "My kitchen sink is clogged." They are answered from the knowledge sections on this phone and nothing leaves it.
// Plain code finds candidates in the pack; when Apple's on-device model is available it says which of them the
// question is about (true/false per option, it cannot name anything else); plain code then says the answer from the
// pack item. Without the model, only a close lexical match is used. A question about a paper waits for its picture.

import Foundation
import FoundationModels

enum WordsAnswer {
  /// One price, a guide, or several prices for one job that depends on the model ("a phone screen").
  enum Hit: Sendable { case price(PriceItem), prices([PriceItem]), guide(Guide) }

  struct Found: Sendable {
    var hit: Hit?
    var tech: [String]
  }

  enum Lean: Sendable { case price, guide, either }

  // MARK: Routing

  /// The question points at a paper or a picture ("Is this quote fair?", "Should I pay this?"): it needs the picture.
  static func needsPicture(_ q: String) -> Bool {
    let s = q.lowercased()
    let patterns = [
      #"\b(this|that|these|those|the|my)\s+(quote|bill|price|paper|letter|estimate|invoice|statement|notice|receipt|picture|photo|email|message)\b"#,
      #"\b(pay|sign|trust|check|read|look at|see)\s+(this|that|it|these)\b"#,
      #"\bis\s+(this|that)\s+(fair|right|ok|okay|real|a scam|too much|too high|correct)\b"#,
    ]
    return patterns.contains { s.range(of: $0, options: .regularExpression) != nil }
  }

  static func lean(_ q: String) -> Lean {
    let s = q.lowercased()
    let price = #"\b(how much|cost|costs|price|prices|charge|charged|pay for|paying|expensive|cheap|quote for|estimate for)\b"#
    let guide = #"\b(how do i|how to|how can i|fix|clogged|blocked|leak|leaks|leaking|drip|dripping|won'?t|doesn'?t|isn'?t|broken|stuck|not working|stopped|running|smell|smells|noise|tripped|squeak|squeaky)\b"#
    let p = s.range(of: price, options: .regularExpression) != nil
    let g = s.range(of: guide, options: .regularExpression) != nil
    return p == g ? .either : p ? .price : .guide
  }

  /// Words that only make it a question; dropping them keeps the coverage test about the thing itself.
  static let filler: Set<String> = [
    "much", "usually", "typically", "normally", "pay", "paying", "charge", "charged", "charges", "need", "needs",
    "want", "know", "tell", "about", "okay", "ok", "whats", "hows", "im", "ive", "expensive", "cheap", "quote",
    "help", "shop", "average", "roughly", "around", "someone", "somebody", "guy", "pro", "professional",
  ]

  static func topic(_ q: String) -> String {
    let words = Lexicon.tokenize(q)
    var kept = words.filter { !filler.contains($0) }
    // "a new water heater", "install a dishwasher": the job is replacing it, not repairing it.
    if words.contains(where: { ["new", "install", "installed", "installing"].contains($0) }) { kept.append("replace") }
    return kept.joined(separator: " ")
  }

  // MARK: Finding

  /// Lexical-only answers need this much of the question's meaning covered; with the on-device model choosing,
  /// a looser net is cast and the model throws out what the question is not about.
  static let alone = 0.5
  static let withModel = 0.3

  static func find(_ q: String, matcher: Matcher, pack: Pack, useModel: Bool) async -> Found {
    let text = topic(q)
    let order: [Matcher.Kind] = switch lean(q) {
    case .price: [.price, .guide]
    case .guide: [.guide, .price]
    case .either: [.guide, .price]
    }
    var tech = ["Asked in words, no picture. Searched: “\(text)”."]

    if useModel {
      for kind in order {
        let options = matcher.candidates(text, kind: kind, minCoverage: withModel)
        guard !options.isEmpty else { continue }
        do {
          let t0 = Date()
          let item = Reader.Item(i: 0, text: q, options: options)
          let content = try await Device.session().respond(
            to: prompt(item, kind: kind), schema: Reader.chooseSchema(item), options: GenerationOptions(samplingMode: .greedy)
          ).content
          let marked = options.indices.filter { (try? content.value(Bool.self, forProperty: "option\($0 + 1)")) == true }
          let ms = Int(Date().timeIntervalSince(t0) * 1000)
          tech.append("Apple on-device model looked at \(options.count) \(kind == .price ? "prices" : "guides") (\(options.map(\.ref).joined(separator: ", "))) and marked \(marked.count) in \(ms) ms.")
          // Three or more prices marked for one question: the job depends on the model, so give the whole span.
          if kind == .price, marked.count >= 3 {
            let items = marked.compactMap { pack.price(options[$0].ref) }
            tech.append("Several prices fit (\(items.map(\.ref).joined(separator: ", "))): the answer gives their range.")
            return Found(hit: .prices(items), tech: tech)
          }
          if let best = marked.first, let hit = hit(options[best].ref, kind: kind, pack: pack) {
            tech.append("Chosen: \(options[best].ref).")
            return Found(hit: hit, tech: tech)
          }
        } catch {
          tech.append("On-device model did not answer (\(error)); using the closest match instead.")
          break
        }
      }
    }

    // Plain code alone: the closest match that covers at least half of what was asked, the leaning kind first.
    var best: (Candidate, Matcher.Kind)?
    for kind in order {
      if let c = matcher.candidates(text, kind: kind, minCoverage: alone).first, c.score > (best?.0.score ?? 0) * 1.25 {
        best = (c, kind)
      }
    }
    if let (c, kind) = best, let hit = hit(c.ref, kind: kind, pack: pack) {
      tech.append("Closest match in the knowledge pack (plain code): \(c.ref).")
      return Found(hit: hit, tech: tech)
    }
    tech.append("No item in the installed sections matches closely enough, so nothing is said about a price.")
    return Found(hit: nil, tech: tech)
  }

  private static func hit(_ ref: String, kind: Matcher.Kind, pack: Pack) -> Hit? {
    switch kind {
    case .price: pack.price(ref).map(Hit.price)
    case .guide: pack.guide(ref).map(Hit.guide)
    }
  }

  static func prompt(_ it: Reader.Item, kind: Matcher.Kind) -> String {
    let head = kind == .price
      ? "A person asks: \"\(it.text)\". For each option, answer true only if the question is about that job, false if it is a different job, even on the same part."
      : "A person asks: \"\(it.text)\". For each guide, answer true only if it is about that problem."
    let opts = it.options.enumerated().map { n, o in "option\(n + 1): \(o.name)" + (o.detail.isEmpty ? "" : " (\(o.detail))") }
    return "\(head)\n" + opts.joined(separator: "\n")
  }

  // MARK: Saying it

  static func unitWords(_ unit: String) -> String {
    switch unit {
    case "job", "device", "": ""
    case "sq ft": " per square foot"
    default: " per \(unit)"
    }
  }

  static func includes(_ p: PriceItem) -> String? {
    guard let s = p.includes?.replacingOccurrences(of: #"\s*\(typical[^)]*\)"#, with: "", options: .regularExpression)
      .trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
    return s.hasSuffix(".") ? s : s + "."
  }

  static func checked(_ sources: [Source]) -> String? {
    sources.compactMap(\.fetched).sorted().last.map { S.longDate($0) }
  }

  static func minutes(_ g: Guide) -> String {
    g.minutes.count == 2 && g.minutes[0] != g.minutes[1] ? "\(Int(g.minutes[0])) to \(Int(g.minutes[1]))" : "\(Int(g.minutes.first ?? 15))"
  }
}
