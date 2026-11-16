// Step 1 on the phone: read the words with Apple's Vision text recognizer, then cover personal details
// before any model, on this phone or in the cloud, sees a word. Everything here runs on the device.

import CoreGraphics
import Foundation
import Vision

/// A personal detail covered on the picture. `rect` is normalized to the image, origin top-left.
struct CoverBar: Sendable, Hashable, Identifiable {
  let id = UUID()
  let kind: PIIKind
  let rect: CGRect
}

/// One visual line of the paper (cells of a table row joined left to right), already masked.
struct PaperRow: Sendable, Hashable, Identifiable {
  let id = UUID()
  let masked: String
  let rect: CGRect // normalized, origin top-left
}

struct PaperText: Sendable {
  let rows: [PaperRow]
  let bars: [CoverBar]
  /// The words of the names covered on this page, lowercased (kept on the phone), so nothing built from the paper
  /// for the internet can carry one, even if a model copied it from the picture.
  var coveredNames: Set<String> = []
  /// The only text any model is given: every row, masked, top to bottom.
  var masked: String { rows.map(\.masked).joined(separator: "\n") }
  /// The kinds that were covered, for "I covered your name, phone, address and plate."
  var coveredKinds: Set<PIIKind> { Set(bars.map(\.kind)) }

  static func read(_ image: CGImage) async throws -> PaperText {
    var request = RecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = [Locale.Language(identifier: "en-US")]
    // Small print matters on bills: the default ignores text under 1/32 of the image height.
    request.minimumTextHeightFraction = 0.008
    let observations = try await request.perform(on: image, orientation: nil)

    struct Piece { let masked: String; let rect: CGRect; let slope: Double; let lineHeight: Double }
    var pieces: [Piece] = []
    var bars: [CoverBar] = []
    let underLabel = namesUnderLabels(observations)

    // First pass: every personal detail each piece holds by itself.
    var found: [Int: [PIIHit]] = [:]
    var nameWords = Set<String>()
    var streetWords = Set<String>()
    for (i, obs) in observations.enumerated() {
      guard let text = obs.topCandidates(1).first?.string else { continue }
      if underLabel.contains(i) { nameWords.formUnion(words(text)); continue }
      let spans = PII.spans(text)
      found[i] = spans
      for s in spans where s.kind == .name { nameWords.formUnion(words(s.text)) }
      for s in spans where s.kind == .street { streetWords.formUnion(words(s.text).subtracting(streetSuffixes)) }
    }
    // A name found once is covered everywhere on the page, in any case and with the words around it that look
    // like part of it: "THEODORA QUILLFEATHER" on the envelope window, a misread "Quilifeather" further down.
    // Words that also name the company are left alone.
    let company = #"(?i)\b(co-?op|inc|llc|ltd|corp|company|district|bank|trust|care|services?|electric|water|clinic)\b"#
    for obs in observations {
      guard let t = obs.topCandidates(1).first?.string, t.range(of: company, options: .regularExpression) != nil else { continue }
      if PII.spans(t).contains(where: { $0.kind == .name }) { continue }
      nameWords.subtract(words(t))
    }
    let knownName = nameWords.isEmpty ? nil : try? NSRegularExpression(
      pattern: #"(?i:\b(?:"# + nameWords.map(NSRegularExpression.escapedPattern(for:)).joined(separator: "|")
        + #")\b)(?:[ \t]+[A-Z][A-Za-z'’.-]+){0,2}"#)

    // The same for a street: "512 Bramble Ct" covered once means a misread "S12 Bramble Cr" is covered too.
    let knownStreet = streetWords.isEmpty ? nil : try? NSRegularExpression(
      pattern: #"(?:\b\S{1,6}\s+)?(?i:\b(?:"# + streetWords.map(NSRegularExpression.escapedPattern(for:)).joined(separator: "|")
        + #")\b)(?:\s+[A-Za-z]{2,6}\b\.?)?"#)

    for (i, obs) in observations.enumerated() {
      guard let best = obs.topCandidates(1).first else { continue }
      let text = best.string
      // The line's slant and height from its four corners (Vision's y grows upward): a photo is rarely level.
      let dx = Double(obs.topRight.x - obs.topLeft.x)
      let slope = dx > 0.01 ? -Double(obs.topRight.y - obs.topLeft.y) / dx : 0
      let lineHeight = max(0.002, Double(obs.topLeft.y - obs.bottomLeft.y))
      if underLabel.contains(i) {
        // A name printed under its label ("CUSTOMER" above "Wendell Farthingale"): covered whole.
        pieces.append(Piece(masked: "[name]", rect: flip(obs.boundingBox.cgRect), slope: slope, lineHeight: lineHeight))
        bars.append(CoverBar(kind: .name, rect: flip(obs.boundingBox.cgRect)))
        continue
      }
      var hits = found[i] ?? []
      if let knownStreet {
        for m in knownStreet.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
          if let r = Range(m.range, in: text) { hits.append(PIIHit(kind: .street, range: r, text: String(text[r]))) }
        }
      }
      if let knownName {
        for m in knownName.matches(in: text, range: NSRange(text.startIndex..., in: text)) {
          if let r = Range(m.range, in: text) { hits.append(PIIHit(kind: .name, range: r, text: String(text[r]))) }
        }
      }
      let spans = merge(hits, in: text)
      var masked = text
      for span in spans.reversed() { masked.replaceSubrange(span.range, with: PII.token(for: span)) }
      for span in spans {
        let r = best.boundingBox(for: span.range)?.boundingBox.cgRect ?? obs.boundingBox.cgRect
        bars.append(CoverBar(kind: span.kind, rect: flip(r)))
      }
      pieces.append(Piece(masked: masked, rect: flip(obs.boundingBox.cgRect), slope: slope, lineHeight: lineHeight))
    }

    // Group pieces into visual rows. The page may still lean a little after straightening, so each piece's height
    // is measured along the slant of the long lines around it: a label on the left and its amount far to the right
    // end up on one row.
    let long = pieces.filter { $0.rect.width > 0.15 }.map(\.slope).sorted()
    let tilt = long.isEmpty ? 0 : long[long.count / 2]
    func level(_ p: Piece) -> Double { Double(p.rect.midY) - tilt * (Double(p.rect.midX) - 0.5) }
    let sorted = pieces.sorted { level($0) < level($1) }
    var rows: [[Piece]] = []
    for p in sorted {
      if let row = rows.last {
        let y = row.map(level).reduce(0, +) / Double(row.count)
        let h = min(p.lineHeight, row.map(\.lineHeight).min() ?? p.lineHeight)
        let overlapsSideways = row.contains { $0.rect.minX < p.rect.maxX - 0.01 && p.rect.minX < $0.rect.maxX - 0.01 }
        if abs(level(p) - y) < h * 0.6 && !overlapsSideways {
          rows[rows.count - 1].append(p)
          continue
        }
      }
      rows.append([p])
    }
    let paperRows = rows.map { row -> PaperRow in
      let ordered = row.sorted { $0.rect.minX < $1.rect.minX }
      let rect = ordered.dropFirst().reduce(ordered[0].rect) { $0.union($1.rect) }
      return PaperRow(masked: ordered.map(\.masked).joined(separator: "   "), rect: rect)
    }
    return PaperText(rows: paperRows, bars: bars, coveredNames: nameWords)
  }

  /// Labels that put a person's name on the next line down or beside them, as forms and quotes print them.
  private static let nameLabel = #"^(?i:customer|customer name|name|bill to|billed to|sold to|ship to|attn|attention|client|owner|insured|patient|member|tenant|resident|account holder|prepared for|service advis\w*|technician|clearing officer|signed)\s*:?$"#
  private static let looksLikeName = #"^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$"#

  /// Observations that hold a name right under a name label, in the same column.
  private static func namesUnderLabels(_ obs: [RecognizedTextObservation]) -> Set<Int> {
    var out = Set<Int>()
    // The page's slant in Vision's coordinates (y up), from its long lines.
    let slopes = obs.compactMap { o -> CGFloat? in
      let dx = o.topRight.x - o.topLeft.x
      return dx > 0.15 ? (o.topRight.y - o.topLeft.y) / dx : nil
    }.sorted()
    let tilt = slopes.isEmpty ? 0 : slopes[slopes.count / 2]
    for (i, o) in obs.enumerated() {
      guard let t = o.topCandidates(1).first?.string.trimmingCharacters(in: .whitespaces),
            t.range(of: nameLabel, options: .regularExpression) != nil else { continue }
      let label = o.boundingBox.cgRect
      // The nearest piece below the label (Vision's y grows upward) that starts in the label's column.
      let below = obs.enumerated().filter { j, b in
        let r = b.boundingBox.cgRect
        return j != i && r.maxY <= label.minY + label.height * 0.3 && label.minY - r.maxY < label.height * 2.5
          && abs(r.minX - label.minX) < 0.05
      }.min { label.minY - $0.element.boundingBox.cgRect.maxY < label.minY - $1.element.boundingBox.cgRect.maxY }
      // Or the nearest piece to its right on the same line, as a payment stub prints it ("Customer   Theodora …").
      // A short label has no slant of its own worth trusting; the line's slant comes from the long lines nearby.
      let beside = obs.enumerated().filter { j, b in
        let r = b.boundingBox.cgRect
        let expected = label.midY + tilt * (r.midX - label.midX)
        return j != i && r.minX > label.maxX - 0.005 && r.minX - label.maxX < 0.5 && abs(r.midY - expected) < label.height * 0.7
      }.min { $0.element.boundingBox.cgRect.minX < $1.element.boundingBox.cgRect.minX }
      for (j, b) in [below, beside].compactMap({ $0 }) {
        guard let s = b.topCandidates(1).first?.string.trimmingCharacters(in: .whitespaces) else { continue }
        // An optional "#07" before the name, as a technician line prints it.
        let bare = s.replacingOccurrences(of: #"^#?\d+\s+"#, with: "", options: .regularExpression)
        if (bare.range(of: looksLikeName, options: .regularExpression) != nil || bare.range(of: #"^[A-Z]\.\s?[A-Z][a-z'’-]+$"#, options: .regularExpression) != nil),
           !bare.contains(where: \.isNumber) {
          out.insert(j)
        }
      }
    }
    return out
  }

  private static let streetSuffixes: Set<String> = ["street", "ave", "avenue", "road", "blvd", "boulevard", "drive", "lane", "court", "way", "place", "ter", "terrace"]

  /// Words of three letters or more, lowercased, for remembering a name across the page.
  private static func words(_ s: String) -> Set<String> {
    Set(s.split { !$0.isLetter && $0 != "'" && $0 != "’" && $0 != "-" }.map { $0.lowercased() }.filter { $0.count >= 3 })
  }

  /// Overlapping hits merged into one covered span each (as PII.spans does).
  private static func merge(_ hits: [PIIHit], in text: String) -> [PIIHit] {
    var out: [PIIHit] = []
    for h in hits.sorted(by: { $0.range.lowerBound < $1.range.lowerBound }) {
      if let last = out.last, h.range.lowerBound < last.range.upperBound {
        let r = last.range.lowerBound..<max(last.range.upperBound, h.range.upperBound)
        out[out.count - 1] = PIIHit(kind: last.kind, range: r, text: String(text[r]))
      } else {
        out.append(h)
      }
    }
    return out
  }

  /// Vision's normalized rects have their origin bottom-left; the picture is drawn top-left.
  private static func flip(_ r: CGRect) -> CGRect {
    CGRect(x: r.minX, y: 1 - r.maxY, width: r.width, height: r.height)
  }

  /// The row a printed label most likely sits on, for drawing a mark beside it.
  func row(for label: String) -> PaperRow? {
    let want = Set(Lexicon.tokenize(label))
    guard !want.isEmpty else { return nil }
    var best: (PaperRow, Double)?
    for r in rows {
      let have = Set(Lexicon.tokenize(r.masked))
      let score = Double(want.intersection(have).count) / Double(want.count)
      if score > (best?.1 ?? 0.5) { best = (r, score) }
    }
    return best?.0
  }
}
