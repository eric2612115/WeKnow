// Turning plain-code verdicts into what WeKnow shows and says (port of web/src/answer/compose.ts and the strings
// it uses from web/src/strings.ts). No model is involved here: every number comes from the pack item a line
// matched, and every sentence is a whole string from design/UI-SPEC.md section 10.

import Foundation

enum Tone: Sendable { case ok, warn, stop, plain }

struct Verdict: Sendable, Equatable {
  var tone: Tone
  var text: String
}

enum LineState: Sendable { case fair, high, low, pending }

struct LineItem: Sendable, Identifiable, Equatable {
  var n: Int // 1-based line number on the paper
  var label: String // as printed (masked)
  var amount: Double?
  var state: LineState
  var over: Double?
  var typical: Double?
  var item: PriceItem?
  var id: Int { n }
}

/// One spoken sentence, shown as a caption. `fromNote` puts the "From your notes on this phone" tag under it.
struct Sentence: Sendable, Identifiable, Equatable {
  let id = UUID()
  var text: String
  var fromNote = false
}

enum S {
  /// "phone" or "tablet": the word WeKnow uses for the device in its hands.
  static let device = ProcessInfo.processInfo.isiOSAppOnMac ? "computer" : (deviceIsPad ? "tablet" : "phone")
  private static let deviceIsPad: Bool = {
    var info = utsname()
    uname(&info)
    let model = withUnsafeBytes(of: &info.machine) { String(decoding: $0.prefix { $0 != 0 }, as: UTF8.self) }
    return model.hasPrefix("iPad") || (ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"] ?? "").hasPrefix("iPad")
  }()
  static func money(_ n: Double) -> String {
    let f = NumberFormatter()
    f.numberStyle = .currency
    f.currencyCode = "USD"
    f.locale = Locale(identifier: "en_US")
    f.maximumFractionDigits = n.rounded() == n ? 0 : 2
    f.minimumFractionDigits = f.maximumFractionDigits
    return f.string(from: NSNumber(value: n)) ?? "$\(n)"
  }

  private static let words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
  /// Counts are said in words ("seven lines") and shown as figures elsewhere.
  static func words(_ n: Int, capital: Bool = false) -> String {
    let w = n >= 0 && n < words.count ? words[n] : String(n)
    return capital ? w.prefix(1).uppercased() + w.dropFirst() : w
  }

  static func longDate(_ iso: String) -> String {
    let p = DateFormatter()
    p.locale = Locale(identifier: "en_US_POSIX")
    p.dateFormat = "yyyy-MM-dd"
    guard let d = p.date(from: String(iso.prefix(10))) else { return iso }
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US")
    f.setLocalizedDateFormatFromTemplate("d MMMM yyyy")
    return f.string(from: d)
  }

  static func lower(_ s: String) -> String { s.isEmpty ? s : s.prefix(1).lowercased() + s.dropFirst() }

  static func list(_ names: [String]) -> String {
    let ns = names.map(lower)
    if ns.count <= 1 { return ns.first ?? "" }
    return ns.dropLast().joined(separator: ", ") + " and " + ns.last!
  }
}

enum Compose {
  // ---------- quotes ----------

  static func lineItems(_ verdicts: [LineVerdict]) -> [LineItem] {
    verdicts.enumerated().map { i, v in
      let n = i + 1
      switch v {
      case let .unknown(label, amount): return LineItem(n: n, label: label, amount: amount, state: .pending)
      case let .fair(_, amount, item): return LineItem(n: n, label: "", amount: amount, state: .fair, typical: item.typical, item: item)
      case let .high(_, amount, over, item): return LineItem(n: n, label: "", amount: amount, state: .high, over: over, typical: item.typical, item: item)
      case let .low(_, amount, _, item): return LineItem(n: n, label: "", amount: amount, state: .low, typical: item.typical, item: item)
      }
    }
  }

  /// Labels as printed (from the reading), so the person hears the words on their paper.
  static func lineItems(_ verdicts: [LineVerdict], labels: [String]) -> [LineItem] {
    lineItems(verdicts).map { var l = $0; if l.label.isEmpty { l.label = labels[l.n - 1] }; return l }
  }

  /// "I know two lines. Three I do not: front brake rotors resurface, brake fluid flush and shop supplies."
  static func known(_ items: [LineItem]) -> [String] {
    let pending = items.filter { $0.state == .pending }
    let known = items.count - pending.count
    if pending.isEmpty { return ["I know all \(S.words(items.count)) lines."] }
    let first = known == 0 ? "I do not know these lines yet." : known == 1 ? "I know one line." : "I know \(S.words(known)) lines."
    if known == 0 { return [first] }
    let names = S.list(pending.map(\.label))
    let second = pending.count == 1 ? "One I do not: \(names)." : "\(S.words(pending.count, capital: true)) I do not: \(names)."
    return [first, second]
  }

  /// "Not in my price book yet: front brake rotors resurface, brake fluid flush and shop supplies."
  static func notKnown(_ items: [LineItem]) -> [String] {
    let pending = items.filter { $0.state == .pending }
    guard !pending.isEmpty, pending.count < items.count else { return [] }
    return ["Not in my price book yet: \(S.list(pending.map(\.label)))."]
  }

  static func quote(_ items: [LineItem]) -> (verdict: Verdict, sentences: [String]) {
    if items.isEmpty { return (Verdict(tone: .plain, text: "I can’t read the prices yet"), ["I can’t read the small words. Move closer to the top half."]) }
    let highs = items.filter { $0.state == .high }.sorted { ($0.over ?? 0) > ($1.over ?? 0) }
    let fair = items.filter { $0.state == .fair || $0.state == .low }.count
    let pending = items.filter { $0.state == .pending }.count
    if !items.contains(where: { $0.state != .pending }) {
      return (Verdict(tone: .plain, text: "I can’t check these prices yet"), ["None of these lines is in my price book yet."])
    }
    let fairSentence = fair == 1 ? "One line looks fair." : "\(S.words(fair, capital: true)) lines look fair."
    let pendingSentence = pending == 1 ? "One is not checked." : "\(S.words(pending, capital: true)) are not checked."
    let lows = items.filter { $0.state == .low }.prefix(1).map { "Line \($0.n), \(S.lower($0.label)), is below the usual price." }

    if let worst = highs.first {
      var sentences = highs.prefix(2).map { "Line \($0.n), \(S.lower($0.label)), is \(S.money($0.over ?? 0)) high." }
      let typical = "Most shops charge about \(S.money(worst.typical ?? 0))."
      if pending == 0 && fair == items.count - highs.count && fair > 0 {
        sentences.append("Most shops charge about \(S.money(worst.typical ?? 0)). The other lines look fair.")
      } else {
        sentences.append([typical, fair > 0 ? fairSentence : "", pending > 0 ? pendingSentence : ""].filter { !$0.isEmpty }.joined(separator: " "))
      }
      let title = highs.count == 1 ? "One price is higher than usual" : "\(S.words(highs.count, capital: true)) prices are higher than usual"
      return (Verdict(tone: .warn, text: title), sentences + lows)
    }
    // Most lines unchecked: "normal" would claim more than was checked.
    if pending > fair {
      return (Verdict(tone: .plain, text: "I could check only \(S.words(fair, capital: false)) of \(items.count) lines"), ["\(fairSentence) \(pendingSentence)"] + lows)
    }
    let sentences = pending > 0 ? ["\(fairSentence) \(pendingSentence)"] : ["Every line is inside the usual range."]
    return (Verdict(tone: .ok, text: "These prices look normal"), sentences + lows)
  }

  // ---------- bills ----------

  // A letter announcing a new bank or account is said first; then anything else that is wrong.
  static let order: [Verdicts.BillFlag] = [.accountChangeNotice, .changedAccount, .instructionToAI, .newPayee, .urgency]

  /// A flag that has its own sentence. "The account has changed" is said once: a changed-account line already
  /// says it, so the letter's own announcement adds no second line (and no second mark).
  static func said(_ f: Verdicts.BillFlag, in flags: [Verdicts.BillFlag]) -> Bool {
    flags.contains(f) && !(f == .accountChangeNotice && flags.contains(.changedAccount))
  }

  static func bill(_ v: Verdicts.Bill, payee: String?, known: [Verdicts.KnownPayee]) -> (verdict: Verdict, reasons: [Sentence], doLine: String?) {
    let match = Verdicts.knownPayee(payee, in: known)
    // Safe: the usual company and account, or a paper that asks for no transfer at all (a check paid at the counter).
    if v.safe {
      if match != nil { return (Verdict(tone: .ok, text: "This bill looks like the usual one"), [Sentence(text: "Same company and same account as last time.", fromNote: true)], nil) }
      return (Verdict(tone: .ok, text: "This bill looks normal"), [Sentence(text: "Nothing on it asks you to send money to an account, and I found no warning signs.")], nil)
    }
    var raw: [Sentence] = []
    for f in order where said(f, in: v.flags) {
      switch f {
      case .accountChangeNotice: raw.append(Sentence(text: "It wants the money sent to a new account."))
      case .changedAccount:
        raw.append(match.map { Sentence(text: "The account is new. You paid them at one ending \($0.payTo) before.", fromNote: true) }
          ?? Sentence(text: "It wants the money sent to a different account than last time."))
      case .instructionToAI: raw.append(Sentence(text: "It has hidden words that try to tell a reader it is safe."))
      case .newPayee: raw.append(Sentence(text: payee.map { "I have no note of paying \($0) before." } ?? "I cannot tell who is asking for the money."))
      case .urgency: raw.append(Sentence(text: "It rushes you to pay."))
      }
    }
    let stop = v.flags.contains(.accountChangeNotice) || v.flags.contains(.changedAccount) || v.flags.contains(.instructionToAI)
    let reasons = raw.enumerated().map { i, r in Sentence(text: "\(S.words(i + 1, capital: true)). \(r.text)", fromNote: r.fromNote) }
    return (Verdict(tone: stop ? .stop : .warn, text: stop ? "Don’t pay this yet" : "Check this bill first"), reasons,
            "Call the company first. Use the number on an older bill.")
  }
}

// ---------- where it ran (UI-SPEC 7.1) ----------

enum WhereRan: Sendable, Equatable {
  case local, cloud, offline, pending(Int)

  var text: String {
    switch self {
    case .local: "On this \(S.device)"
    case .cloud: "Answered using the internet"
    case .offline: "No internet. Answered on this \(S.device)."
    case let .pending(n): n == 1 ? "1 item not checked" : "\(n) items not checked"
    }
  }
}
