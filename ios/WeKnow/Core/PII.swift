// Personal data that must never reach a model, on this phone or in the cloud.
// The patterns are a line-for-line port of web/src/core/pii.ts, so the web and the phone cover the same things.
// Two additions for a phone that reads the words itself, before any model sees them:
//  - personal names, found by Apple's NaturalLanguage name tagger (on the device), because a pattern cannot;
//  - an account number keeps its last four digits ("[account ending 9917]"), the same fingerprint WeKnow keeps in
//    its notes and the web model is asked to copy, so the bill rules can still tell a changed account.

import Foundation
import NaturalLanguage

enum PIIKind: String, CaseIterable, Sendable {
  case email, phone, card, account, ssn, plate, vin, street, name
}

struct PIIHit: Sendable, Equatable {
  let kind: PIIKind
  let range: Range<String.Index>
  let text: String
}

enum PII {
  private static func re(_ pattern: String, _ caseInsensitive: Bool) -> NSRegularExpression {
    // The patterns are constants; a bad one is a programming error caught by the first run.
    try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
  }

  /// Same order and same expressions as `PATTERNS` in web/src/core/pii.ts (JS `i` flag -> caseInsensitive).
  static let patterns: [(PIIKind, NSRegularExpression)] = [
    (.email, re(#"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}"#, true)),
    (.ssn, re(#"\b\d{3}-\d{2}-\d{4}\b"#, false)),
    (.card, re(#"\b(?:\d[ -]?){13,19}\b"#, false)),
    // Any 17 letters and digits with both in it: text recognition often reads 0 as O, so I, O and Q are allowed.
    (.vin, re(#"\b(?=[A-Z0-9]*[0-9])(?=[A-Z0-9]*[A-Z])[A-Z0-9]{17}\b"#, false)),
    // Labelled account / routing / IBAN numbers, and any long digit run.
    (.account, re(#"\b(?:acct|account|routing|aba|iban|a\/c)\b[#:\s.-]*[A-Z0-9][A-Z0-9 -]{5,}"#, true)),
    (.account, re(#"\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b"#, false)),
    (.account, re(#"\b\d{8,}\b"#, false)),
    (.phone, re(#"(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b"#, false)),
    (.plate, re(#"\b(?:plate|lic(?:ense)?\.?\s*(?:no|#)?)\b[#:\s.-]*[A-Z0-9-]{4,8}\b"#, true)),
    (.street, re(#"\b\d{1,6}\s+(?:[A-Z][a-z]+\s){0,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Ter|Terrace)\b\.?"#, false)),
  ]

  static let labelledName = re(
    #"\b(?i:customer|account holder|holder|name|bill to|billed to|sold to|ship to|attn|attention|client|owner|insured|patient|member|tenant|resident)\s*[:#]\s*([A-Z][A-Za-z'’.-]+(?:[ \t]+[A-Z][A-Za-z'’.-]+){0,3})"#,
    false)

  /// Every personal-data match in `text`, patterns first, then personal names from the on-device tagger.
  static func find(_ text: String, names: Bool = true) -> [PIIHit] {
    var hits: [PIIHit] = []
    let ns = NSRange(text.startIndex..., in: text)
    for (kind, regex) in patterns {
      for m in regex.matches(in: text, range: ns) {
        guard let r = Range(m.range, in: text) else { continue }
        hits.append(PIIHit(kind: kind, range: r, text: String(text[r])))
      }
    }
    if names {
      // A name after a label ("Customer: Margaret Ellis", "Account holder: Harold Brooks").
      for m in labelledName.matches(in: text, range: ns) where m.numberOfRanges > 1 {
        guard let r = Range(m.range(at: 1), in: text) else { continue }
        hits.append(PIIHit(kind: .name, range: r, text: String(text[r])))
      }
      let tagger = NLTagger(tagSchemes: [.nameType])
      tagger.string = text
      let options: NLTagger.Options = [.omitWhitespace, .omitPunctuation, .joinNames]
      tagger.enumerateTags(in: text.startIndex..<text.endIndex, unit: .word, scheme: .nameType, options: options) { tag, r in
        if tag == .personalName { hits.append(PIIHit(kind: .name, range: r, text: String(text[r]))) }
        return true
      }
    }
    return hits
  }

  /// Overlapping hits merged into covered spans; each span keeps the kind of the hit that starts first.
  static func spans(_ text: String, names: Bool = true) -> [PIIHit] {
    let hits = find(text, names: names).sorted { $0.range.lowerBound < $1.range.lowerBound }
    var out: [PIIHit] = []
    for h in hits {
      if let last = out.last, h.range.lowerBound < last.range.upperBound {
        let upper = max(last.range.upperBound, h.range.upperBound)
        let r = last.range.lowerBound..<upper
        out[out.count - 1] = PIIHit(kind: last.kind, range: r, text: String(text[r]))
      } else {
        out.append(h)
      }
    }
    return out
  }

  /// The token a covered span is replaced with. Account numbers keep their last four digits.
  static func token(for hit: PIIHit) -> String {
    if hit.kind == .account {
      let digits = hit.text.filter(\.isNumber)
      if digits.count >= 4 { return "[account ending \(digits.suffix(4))]" }
    }
    return "[\(hit.kind.rawValue)]"
  }

  /// Replace every personal-data match with a fixed token such as [phone].
  static func mask(_ text: String, names: Bool = true) -> String {
    var out = text
    for h in spans(text, names: names).reversed() { out.replaceSubrange(h.range, with: token(for: h)) }
    return out
  }
}
