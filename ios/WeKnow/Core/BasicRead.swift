// The basic check: a paper read by plain code alone, for a phone that cannot read by itself (no Apple Intelligence).
// Nothing here asks a model and nothing leaves the phone. It says what kind of paper this is and who asks to be paid;
// the warnings themselves (a changed account, pressure, words aimed at an AI, sums that do not hold) are the same
// plain rules every bill goes through (Core/Verdict.swift, Core/BillMath.swift). The full check, which also reads the
// meaning of each part and prices each line of a quote, needs Apple's on-device model.
// Port of web/src/core/basicRead.ts (tests: web/src/core/__tests__/basicRead.test.ts).

import Foundation

enum BasicRead {
  enum Kind: String, Sendable { case bill, quote, unknown }

  private static func re(_ pattern: String) -> NSRegularExpression {
    try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
  }

  private static let billWords = re(#"\b(amount due|balance due|total due|payment due|due date|due by|pay by|please pay|statement|invoice|billing period|remit(?:tance)?|past due|account (?:number|no\.?)|autopay)\b"#)
  private static let quoteWords = re(#"\b(estimate|quotation|quote|proposal|work order|labor|labour|parts|technician|valid (?:until|for))\b"#)
  private static let quoteHead = re(#"\b(estimate|quotation|quote|proposal)\b"#)
  private static let billHead = re(#"\b(invoice|statement|bill)\b"#)
  /// A line that is only a heading, a page mark or a label: never the name of who asks to be paid.
  private static let notAName = re(#"^(invoice|statement|estimate|quote|quotation|bill|page|date|customer|account|amount|total|to|from|tel|phone|specimen|important|description)\b"#)
  /// Words a company, a utility or an office has in its name.
  private static let org = re(#"\b(co-?op|cooperative|inc|llc|ltd|corp|corporation|company|district|authority|utilit(?:y|ies)|services?|trust|bank|credit union|electric|energy|power|water|gas|telecom|wireless|insurance|clinic|hospital|medical|dental|auto|automotive|care|plumbing|heating|roofing|associates|partners|department|city of|county of|university)\b"#)
  private static let link = re(#"\[|@|https?:|www\.|\.(?:com|org|net|gov)\b"#)
  /// Where a letterhead ends: a second column, a tagline or a number starts.
  private static let column = re(#"\s{2,}| [·•|] | - "#)

  private static func count(_ re: NSRegularExpression, _ text: String) -> Int {
    re.numberOfMatches(in: text, range: NSRange(text.startIndex..., in: text))
  }

  private static func has(_ re: NSRegularExpression, _ text: String) -> Bool { count(re, text) > 0 }

  /// What kind of paper these lines are, by the words printed on them. `.unknown` when the words do not say.
  static func kind(_ lines: [String]) -> Kind {
    let text = lines.joined(separator: "\n")
    if text.filter({ !$0.isWhitespace }).count < 40 { return .unknown }
    let head = lines.prefix(12).joined(separator: "\n")
    let bill = count(billWords, text) + (has(billHead, head) ? 2 : 0)
    let quote = count(quoteWords, text) + (has(quoteHead, head) ? 3 : 0)
    if quote >= 3 && quote > bill { return .quote }
    if bill >= 2 { return .bill }
    return .unknown
  }

  /// A printed line, or one column of it, that reads like the name on a letterhead.
  private static func nameIn(_ piece: String) -> String? {
    if has(link, piece) { return nil }
    let name = piece
      .replacingOccurrences(of: #"[^\p{L}\p{N}&'’.,\- ]"#, with: " ", options: .regularExpression)
      .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespaces)
      .replacingOccurrences(of: #"^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$"#, with: "", options: .regularExpression)
    let words = name.split(separator: " ").map(String.init)
    let letters = name.filter(\.isLetter).count
    // The title of a paper or of a box on it ("Electric statement", "Payment stub") is not who sent it.
    let heading = name.range(of: #"(?i)\b(statement|invoice|bill|estimate|summary|notice|stub|receipt|details?|charges|service address|period)$"#, options: .regularExpression) != nil
    if letters < 4 || name.count > 60 || words.count > 7 || name.range(of: #"\d{3,}"#, options: .regularExpression) != nil || has(notAName, name) || heading {
      return nil
    }
    // A name is written with capitals: most of its words start with one (a sentence of small print does not).
    let capital = words.filter { $0.range(of: #"^[\p{Lu}\d&]"#, options: .regularExpression) != nil }.count
    if name.range(of: #"^[\p{Lu}\d]"#, options: .regularExpression) == nil || capital * 2 < words.count { return nil }
    return name
  }

  private static func pieces(_ line: String) -> [String] {
    var out: [String] = []
    var start = line.startIndex
    for m in column.matches(in: line, range: NSRange(line.startIndex..., in: line)) {
      guard let r = Range(m.range, in: line) else { continue }
      out.append(String(line[start..<r.lowerBound]))
      start = r.upperBound
    }
    out.append(String(line[start...]))
    return out
  }

  /// Who asks to be paid. A company the person already keeps a note of, when its name is printed on the paper; else
  /// the letterhead: near the top, the first line that reads like a name, one that sounds like a company first. Lines
  /// with a covered detail, a web address or small print are never used. `recognized`: the lines were read from a
  /// picture (always so on this phone: a PDF is drawn and read like a photo).
  static func payee(_ lines: [String], known: [String] = [], recognized: Bool = true) -> String? {
    let text = lines.joined(separator: "\n").lowercased()
    if let kept = known.first(where: { k in
      let t = k.trimmingCharacters(in: .whitespaces)
      return t.count >= 3 && text.contains(t.lowercased())
    }) { return kept }
    var names: [String] = []
    // Lines with nothing covered in them come first: a line that holds a covered detail is about the customer or an
    // account ("Electric statement   [account]"), and is used only when no clean line reads like a name.
    let top = Array(lines.prefix(15))
    for raw in top.filter({ !$0.contains("[") }) + top.filter({ $0.contains("[") }) {
      for piece in pieces(raw) {
        if let name = nameIn(piece) { names.append(name) }
      }
    }
    // Words recognized from a picture come out with stray pieces: only a line that sounds like a company is taken as
    // the name there. A PDF's own text is exact, so its first name-like line is the letterhead.
    return names.first { has(org, $0) } ?? (recognized ? nil : names.first)
  }

  /// The bill form, filled by plain code: only the kind and who asks to be paid. The two warning fields stay false
  /// here because the rules read the paper's own words for them (Verdicts.bill); a model is what would add to them.
  static func bill(_ lines: [String], known: [String] = [], recognized: Bool = true) -> Understanding {
    Understanding(kind: .bill, lines: [], problemRef: nil, payee: payee(lines, known: known, recognized: recognized), payTo: nil, urgent: false, addressedToAI: false)
  }
}
