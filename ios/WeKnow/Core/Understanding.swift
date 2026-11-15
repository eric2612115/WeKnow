// What the model is allowed to say about a paper, and the check that holds it to that
// (port of web/src/core/understanding.ts). The model reads; the program decides. It may cite refs from the
// candidates it was offered, copy amounts that are printed, and nothing else.

import Foundation

enum DocKind: String, Sendable, Codable, CaseIterable { case quote, bill, problem, unknown }

struct QuoteLine: Sendable, Equatable {
  var label: String // as printed, already masked on this phone
  var amount: Double? // as printed
  var ref: String? // an offered candidate, or nil when the pack has no match
}

struct Understanding: Sendable, Equatable {
  var kind: DocKind
  var lines: [QuoteLine]
  var problemRef: String?
  var payee: String?
  var payTo: String?
  var urgent: Bool // the model's reading; can only add a warning
  var addressedToAI: Bool // the model's reading; can only add a warning
}

struct UnderstandingError: Error, CustomStringConvertible {
  let description: String
}

enum Check {
  /// Accept the reading only if every ref is one we offered and every amount is a plain, finite, non-negative
  /// number. Anything else is rejected rather than repaired, so a confused or manipulated model cannot add data.
  /// Missing warning fields count as warnings: a model cannot clear a warning by leaving it out.
  static func understanding(
    kind: DocKind, lines: [QuoteLine], problemRef: String?, payee: String?, payTo: String?,
    urgent: Bool?, addressedToAI: Bool?, offered: Set<String>
  ) throws -> Understanding {
    for (i, l) in lines.enumerated() {
      if let a = l.amount, !a.isFinite || a < 0 { throw UnderstandingError(description: "line \(i): amount") }
      if let r = l.ref, !offered.contains(r) { throw UnderstandingError(description: "line \(i): ref \(r) was not offered") }
    }
    if let r = problemRef, !offered.contains(r) { throw UnderstandingError(description: "problemRef \(r) was not offered") }
    return Understanding(
      kind: kind, lines: lines, problemRef: problemRef, payee: payee, payTo: payTo,
      urgent: urgent == false ? false : true, addressedToAI: addressedToAI == false ? false : true
    )
  }
}
