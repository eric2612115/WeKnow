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

    struct Piece { let masked: String; let rect: CGRect }
    var pieces: [Piece] = []
    var bars: [CoverBar] = []
    let underLabel = namesUnderLabels(observations)
    for (i, obs) in observations.enumerated() {
      guard let best = obs.topCandidates(1).first else { continue }
      let text = best.string
      if underLabel.contains(i) {
        // A name printed under its label ("CUSTOMER" above "Wendell Farthingale"): covered whole.
        pieces.append(Piece(masked: "[name]", rect: flip(obs.boundingBox.cgRect)))
        bars.append(CoverBar(kind: .name, rect: flip(obs.boundingBox.cgRect)))
        continue
      }
      let spans = PII.spans(text)
      var masked = text
      for span in spans.reversed() { masked.replaceSubrange(span.range, with: PII.token(for: span)) }
      for span in spans {
        let r = best.boundingBox(for: span.range)?.boundingBox.cgRect ?? obs.boundingBox.cgRect
        bars.append(CoverBar(kind: span.kind, rect: flip(r)))
      }
      pieces.append(Piece(masked: masked, rect: flip(obs.boundingBox.cgRect)))
    }

    // Group pieces into visual rows: same band of height, then left to right.
    let sorted = pieces.sorted { $0.rect.midY < $1.rect.midY }
    var rows: [[Piece]] = []
    for p in sorted {
      if let first = rows.last?.first, abs(first.rect.midY - p.rect.midY) < min(first.rect.height, p.rect.height) * 0.6 {
        rows[rows.count - 1].append(p)
      } else {
        rows.append([p])
      }
    }
    let paperRows = rows.map { row -> PaperRow in
      let ordered = row.sorted { $0.rect.minX < $1.rect.minX }
      let rect = ordered.dropFirst().reduce(ordered[0].rect) { $0.union($1.rect) }
      return PaperRow(masked: ordered.map(\.masked).joined(separator: "   "), rect: rect)
    }
    return PaperText(rows: paperRows, bars: bars)
  }

  /// Labels that put a person's name on the next line down, as forms and quotes print them.
  private static let nameLabel = #"^(?i:customer|customer name|name|bill to|billed to|sold to|ship to|attn|attention|client|owner|insured|patient|member|tenant|resident|account holder|prepared for|service advisor|technician)\s*:?$"#
  private static let looksLikeName = #"^[A-Z][A-Za-z'’.-]+(?:\s+[A-Z][A-Za-z'’.-]+){1,3}$"#

  /// Observations that hold a name right under a name label, in the same column.
  private static func namesUnderLabels(_ obs: [RecognizedTextObservation]) -> Set<Int> {
    var out = Set<Int>()
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
      if let (j, b) = below, let s = b.topCandidates(1).first?.string.trimmingCharacters(in: .whitespaces),
         s.range(of: looksLikeName, options: .regularExpression) != nil, !s.contains(where: \.isNumber) {
        out.insert(j)
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
