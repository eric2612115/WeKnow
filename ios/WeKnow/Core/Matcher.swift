// Local candidates: which pack items a printed line (or a problem) might be. Plain code, on the device.
// The web app uses a layered index with BM25+ (docs/knowledge-layer.md); for one bundled pack of a few hundred
// items the phone ranks the whole pack directly, with the same lexicon (stop words, rewrites, synonyms copied
// from the pack root's `text` section) and IDF-weighted name/alias overlap. The model then chooses among at most
// five candidates, or none; it never sees a price.

import Foundation

struct Candidate: Sendable, Hashable {
  let ref: String
  let name: String
  let detail: String // what the price includes ("Pads only, ..."), so the model can tell close jobs apart
  let score: Double
  /// The line carries this item's own name, or one of its other names, in full and asks for nothing the item does
  /// not know: plain code can take it without asking a model. `named` is how many words that name has.
  var sure = false
  var named = 0
}

struct Matcher: Sendable {
  enum Kind { case price, guide }

  private struct Doc: Sendable {
    let ref: String
    let name: String
    let detail: String
    let nameTerms: Set<String>
    let aliasTerms: Set<String>
    /// The name (without its brackets) and each other name, as word sets.
    let phrases: [Set<String>]
  }

  private let prices: [Doc]
  private let guides: [Doc]
  private let idf: [String: Double]
  private let medianIDF: Double

  init(pack: Pack) {
    func doc(_ ref: String, _ name: String, _ aliases: [String], _ detail: String?) -> Doc {
      let n = Set(Lexicon.terms(name))
      let a = Set(aliases.flatMap { Lexicon.terms($0) })
      // "(typical = midpoint)" is a note about the numbers, which the model never sees.
      let d = (detail ?? "").replacingOccurrences(of: #"\s*\(typical[^)]*\)"#, with: "", options: .regularExpression)
      let plain = name.replacingOccurrences(of: #"\([^)]*\)"#, with: " ", options: .regularExpression)
      let phrases = ([plain] + aliases).map { Set(Lexicon.terms($0)) }.filter { !$0.isEmpty }
      return Doc(ref: ref, name: name, detail: d, nameTerms: n, aliasTerms: a, phrases: phrases)
    }
    prices = pack.prices.map { doc($0.ref, $0.name, $0.aliases, $0.includes) }
    guides = pack.guides.map { doc($0.ref, $0.name, $0.aliases, nil) }
    let all = prices + guides
    var df: [String: Int] = [:]
    for d in all { for t in d.nameTerms.union(d.aliasTerms) { df[t, default: 0] += 1 } }
    let n = Double(all.count)
    idf = df.mapValues { log(1 + n / Double($0)) }
    let sorted = idf.values.sorted()
    medianIDF = sorted.isEmpty ? 1 : sorted[sorted.count / 2]
  }

  /// Words that say where on the car or house, not which job.
  private static let sides: Set<String> = Set(["front", "rear", "left", "right", "both", "side", "driver", "passenger"].map(Lexicon.stem))

  /// The one candidate plain code is sure of, or nil: the sure one with the longest name in the line, when no
  /// other sure one has a name as long ("brake pads and rotors" before "brake pads").
  static func sure(_ options: [Candidate]) -> Candidate? {
    let sures = options.filter(\.sure)
    guard let top = sures.map(\.named).max() else { return nil }
    let best = sures.filter { $0.named == top }
    return best.count == 1 ? best[0] : nil
  }

  /// At most `k` candidates, best first; anything under 20% of the best score is dropped, and so is an item
  /// that covers less than 60% of the printed line's meaning (IDF-weighted; a word no item knows weighs as much
  /// as a middling word, and one with a digit, such as a part number or a size no item lists, is left out).
  /// A small on-device model then chooses among fewer, closer options: "Brake fluid flush" offers nothing rather
  /// than "Replace brake pads".
  /// At 0.6, every one of the 71 labelled eval lines (web/fixtures/eval/truth.json) still has its item in the top 5,
  /// and 11 of the 15 lines the pack does not know get no candidates at all (0.5: 4 of 15). Measured again on
  /// 2026-11-21 (90 lines): each of the 80 labelled lines has its item first, and none of the 10 unknown lines gets one.
  func candidates(_ text: String, kind: Kind, k: Int = 5, minCoverage: Double = 0.6) -> [Candidate] {
    let found = rank(text, kind: kind, k: k, minCoverage: minCoverage)
    if !found.isEmpty { return found }
    // Shops add details in brackets or after a comma or a dash: "Install ceiling fan (existing box)", "Washer repair,
    // won't spin", "Brake pads - OEM ceramic". When the whole line finds nothing, the job itself is tried: without the
    // brackets, then before the comma or dash (a hyphen inside a word, as in "Co-op", is not a dash).
    let core = text.replacingOccurrences(of: #"\([^)]*\)"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: " - ", with: ",")
      .trimmingCharacters(in: .whitespaces)
    let head = core.split(whereSeparator: { ",;–—".contains($0) }).first.map { String($0).trimmingCharacters(in: .whitespaces) } ?? core
    for alt in [core, head] where alt != text && Lexicon.terms(alt).count >= 1 {
      let r = rank(alt, kind: kind, k: k, minCoverage: minCoverage)
      if !r.isEmpty { return r }
    }
    return []
  }

  private func rank(_ text: String, kind: Kind, k: Int, minCoverage: Double) -> [Candidate] {
    let q = Lexicon.expand(text)
    guard !q.terms.isEmpty else { return [] }
    let docs = kind == .price ? prices : guides
    // The share of the line an item covers leaves out the words with digits that no item knows: "15" in
    // "iPhone 15" still counts, a part number or a size no item lists does not sink the right item.
    let printed = q.terms.filter { !q.added.contains($0) && (idf[$0] != nil || !$0.contains(where: \.isNumber)) }
    let printedWeight = printed.reduce(0) { $0 + (idf[$1] ?? medianIDF) }
    var scored: [Candidate] = []
    for d in docs {
      var s = 0.0
      var covered = Set<String>()
      for t in q.terms {
        let w = (q.added.contains(t) ? 0.6 : 1.0) * (idf[t] ?? 0)
        let hit = d.nameTerms.contains(t) ? 2.0 : d.aliasTerms.contains(t) ? 1.0 : 0
        if hit > 0 { s += hit * w; covered.insert(t) }
      }
      let coveredWeight = printed.filter { covered.contains($0) }.reduce(0) { $0 + (idf[$1] ?? medianIDF) }
      let coverage = printedWeight > 0 ? coveredWeight / printedWeight : 0
      guard s > 0, coverage >= minCoverage else { continue }
      var c = Candidate(ref: d.ref, name: d.name, detail: d.detail, score: s)
      // Sure: one of the item's names (two words or more) is wholly in the line, and every word of the line is one
      // the item knows, or only says which side ("front", "rear"). "Brake pads inspection" is not sure of
      // "Replace brake pads": the item does not know "inspection".
      let line = Set(q.terms)
      c.named = d.phrases.filter { $0.count >= 2 && $0.isSubset(of: line) }.map(\.count).max() ?? 0
      let known = d.nameTerms.union(d.aliasTerms)
      c.sure = c.named > 0 && Set(Lexicon.terms(text)).allSatisfy { known.contains($0) || Self.sides.contains($0) }
      scored.append(c)
    }
    // On a tie the plainer name wins ("iPhone 15" before "iPhone 15 Plus", "S24" before "S24+"), then the ref, so
    // the order is stable.
    let words = { (c: Candidate) in Lexicon.terms(c.name).count }
    scored.sort { $0.score != $1.score ? $0.score > $1.score : words($0) != words($1) ? words($0) < words($1) : $0.ref < $1.ref }
    guard let best = scored.first?.score else { return [] }
    return Array(scored.filter { $0.score >= best * 0.2 }.prefix(k))
  }
}

/// The pack's language data (us-home root, `text` section) and a light stemmer used on both sides of a match.
enum Lexicon {
  static let rewrite: [(String, String)] = [
    ("a/c", "ac"), ("r&r", "replace"), ("r & r", "replace"), ("w/", "with"), ("sq ft", "square foot"), ("sq. ft.", "square foot"),
  ]
  /// Each rewrite as a whole-word pattern (web/src/core/text.ts): "w/" in "w/ install" but not in "new/used".
  private static let rewritePatterns: [(NSRegularExpression, String)] = rewrite.map { from, to in
    (try! NSRegularExpression(pattern: #"(^|[^\p{L}\p{N}])"# + NSRegularExpression.escapedPattern(for: from) + #"(?=$|[^\p{L}\p{N}])"#),
     "$1 " + NSRegularExpression.escapedTemplate(for: to) + " ")
  }
  static let stop: Set<String> = [
    "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "at", "by", "with", "from", "into", "per", "each", "my",
    "your", "our", "its", "it", "is", "are", "was", "were", "be", "been", "this", "that", "these", "those", "i", "me", "we",
    "you", "he", "she", "they", "them", "his", "her", "their", "as", "so", "if", "then", "than", "do", "does", "did", "can",
    "could", "should", "would", "will", "please", "how", "what", "why", "when", "where", "which", "who", "there", "here",
    "very", "just", "also", "get", "got", "some", "any", "all", "labor", "labour", "parts", "qty", "ea", "item", "items",
    "line", "total", "subtotal", "tax", "estimate", "est", "incl", "included", "including", "new", "fair", "price", "cost",
    "costs", "usual", "normal",
  ]
  static let synonyms: [[String]] = [
    ["refrigerator", "fridge"], ["air conditioner", "air conditioning", "ac", "hvac"], ["faucet", "tap"], ["tire", "tyre"],
    ["windshield", "windscreen"], ["rotor", "brake disc", "brake disk"], ["car", "auto", "vehicle"], ["front", "frt"],
    ["rear", "rr"], ["garbage disposal", "waste disposal", "disposer", "garburator"], ["washing machine", "washer"],
    ["clothes dryer", "tumble dryer"], ["clogged", "blocked", "stopped up"],
    ["outlet", "receptacle", "wall socket", "power socket"], ["screen", "display"], ["battery", "batt"],
    ["oil change", "lube oil filter", "lof"], ["transmission", "trans"], ["coolant", "antifreeze"],
    ["smoke alarm", "smoke detector", "fire alarm"], ["cockroach", "roach"], ["mold", "mould"], ["color", "colour"],
    ["aluminum", "aluminium"], ["gray", "grey"], ["tv", "television"],
    ["cell phone", "cellphone", "mobile phone", "smartphone"], ["doorknob", "door knob", "door handle"],
    ["drywall", "sheetrock", "plasterboard", "gypsum board"], ["caulk", "sealant"], ["gfci", "gfi"],
    ["dishwasher", "dish washer"], ["showerhead", "shower head"], ["deadbolt", "dead bolt"],
    ["headlight", "head light", "headlamp"], ["exterminator", "pest control"], ["locksmith", "lock smith"],
    ["handyman", "handy man"],
  ]

  static func tokenize(_ text: String) -> [String] {
    var t = text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: .init(identifier: "en_US")).lowercased()
    for (re, to) in rewritePatterns { t = re.stringByReplacingMatches(in: t, range: NSRange(t.startIndex..., in: t), withTemplate: to) }
    // "S24+" is "S24 plus", as the pack writes it in its other names.
    t = t.replacingOccurrences(of: #"([\p{L}\p{N}])\+"#, with: "$1 plus ", options: .regularExpression)
    t = t.replacingOccurrences(of: "’", with: "").replacingOccurrences(of: "'", with: "")
    return t.split { !($0.isLetter || $0.isNumber) }.map(String.init)
  }

  /// A light, consistent suffix stripper: pads/pad, brakes/brake, replace/replacement/replacing.
  static func stem(_ w: String) -> String {
    var s = w
    if s.count > 4, s.hasSuffix("ies") { s = String(s.dropLast(3)) + "y" }
    else if s.count > 3, s.hasSuffix("s"), !s.hasSuffix("ss"), !s.hasSuffix("us"), !s.hasSuffix("is") { s.removeLast() }
    if s.count > 6, s.hasSuffix("ment") { s = String(s.dropLast(4)) }
    if s.count > 5, s.hasSuffix("ing") { s = String(s.dropLast(3)) }
    if s.count > 4, s.hasSuffix("ed") { s = String(s.dropLast(2)) }
    if s.count > 3, s.hasSuffix("e") { s.removeLast() }
    return s
  }

  static func process(_ word: String) -> String? {
    if stop.contains(word) { return nil }
    if word.contains(where: \.isNumber) { return word }
    if word.count < 2 { return nil }
    return stem(word)
  }

  static func terms(_ text: String) -> [String] { tokenize(text).compactMap(process) }

  private static let groups: [[[String]]] = synonyms.map { $0.map { terms($0) }.filter { !$0.isEmpty } }

  /// The query's terms plus synonym terms; synonym-only terms count for less.
  static func expand(_ text: String) -> (terms: [String], added: Set<String>) {
    let base = terms(text)
    let have = Set(base)
    var added = Set<String>()
    func contains(_ hay: [String], _ seq: [String]) -> Bool {
      guard seq.count <= hay.count else { return false }
      for i in 0...(hay.count - seq.count) where Array(hay[i..<(i + seq.count)]) == seq { return true }
      return false
    }
    for g in groups where g.contains(where: { contains(base, $0) }) {
      for seq in g where !contains(base, seq) { for t in seq where !have.contains(t) { added.insert(t) } }
    }
    var out = base
    for t in added where !out.contains(t) { out.append(t) }
    return (Array(NSOrderedSet(array: out)) as? [String] ?? out, added)
  }
}
