// Plain-code verdicts (port of web/src/core/verdict.ts). No model is involved past this point.

import Foundation

enum LineVerdict: Sendable, Equatable {
  case fair(ref: String, amount: Double, item: PriceItem)
  case high(ref: String, amount: Double, over: Double, item: PriceItem)
  case low(ref: String, amount: Double, under: Double, item: PriceItem)
  case unknown(label: String, amount: Double?)
}

enum Verdicts {
  static func price(_ amount: Double, _ item: PriceItem) -> LineVerdict {
    if amount > item.high { return .high(ref: item.ref, amount: amount, over: amount - item.high, item: item) }
    if amount < item.low { return .low(ref: item.ref, amount: amount, under: item.low - amount, item: item) }
    return .fair(ref: item.ref, amount: amount, item: item)
  }

  static func quote(_ u: Understanding, pack: Pack) -> [LineVerdict] {
    u.lines.map { line in
      guard let ref = line.ref, let item = pack.price(ref), let amount = line.amount else {
        return .unknown(label: line.label, amount: line.amount)
      }
      return price(amount, item)
    }
  }

  // ---- Bills ----

  struct KnownPayee: Sendable, Equatable, Codable {
    var name: String
    var payTo: String // the fingerprint the person confirmed before: last four digits
  }

  enum BillFlag: String, Sendable, CaseIterable {
    case accountChangeNotice = "account-change-notice", newPayee = "new-payee", changedAccount = "changed-account", urgency
    case instructionToAI = "instruction-to-ai"
  }

  struct Bill: Sendable, Equatable {
    var safe: Bool
    var flags: [BillFlag]
  }

  static let urgency = try! NSRegularExpression(
    pattern: #"\b(urgent|immediately|today only|within 24 hours|final notice|act now|avoid (?:suspension|disconnection|penalt))"#,
    options: [.caseInsensitive])
  /// A letter that says the bank or the account changed: the classic trick to send a payment somewhere else
  /// (web/src/core/verdict.ts ACCOUNT_CHANGE). "New account 12345678" reaches these rules covered, as
  /// "New [account ending 5678]", so that form counts too.
  static let accountChange = try! NSRegularExpression(
    pattern: #"\b(bank (?:has |have )?changed|new (?:bank|account)(?: details| number)?|new \[account|changed (?:our )?(?:bank|account)|updated (?:bank|payment) (?:details|information))\b"#,
    options: [.caseInsensitive])
  static let aiInstruction = try! NSRegularExpression(
    pattern: #"\b(ignore (?:all|any|previous|prior)|disregard|you are (?:an? )?(?:ai|assistant|model)|as an ai|system prompt|mark (?:this|it) as (?:safe|paid|verified)|say (?:this|it) is (?:safe|fine|legit))"#,
    options: [.caseInsensitive])

  /// Which sentences of the masked text tripped a rule, for the red boxes on the picture.
  static func matches(_ re: NSRegularExpression, _ text: String) -> Bool {
    re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
  }

  /// The payee the person confirmed before, compared on letters and digits only ("Co-op." and "Co-op" are one
  /// name). Matching a name only switches on the account check; it can never clear a flag.
  static func knownPayee(_ payee: String?, in known: [KnownPayee]) -> KnownPayee? {
    func key(_ s: String) -> String { s.lowercased().filter { $0.isLetter || $0.isNumber } }
    guard let payee, !key(payee).isEmpty else { return nil }
    return known.first { key($0.name) == key(payee) }
  }

  /// Judge a bill from the model's fixed form plus the masked text read on this phone, using rules only.
  /// Text inside the bill can raise flags; it can never clear one.
  static func bill(_ u: Understanding, maskedText: String, known: [KnownPayee]) -> Bill {
    var flags: [BillFlag] = []
    // A letter announcing a new bank or account is always a warning, whoever sent it.
    if matches(accountChange, maskedText) { flags.append(.accountChangeNotice) }
    let match = knownPayee(u.payee, in: known)
    if let match {
      if u.payTo == nil || u.payTo != match.payTo { flags.append(.changedAccount) }
    } else {
      flags.append(.newPayee)
    }
    if u.urgent || matches(urgency, maskedText) { flags.append(.urgency) }
    if u.addressedToAI || matches(aiInstruction, maskedText) { flags.append(.instructionToAI) }
    return Bill(safe: flags.isEmpty, flags: flags)
  }
}
