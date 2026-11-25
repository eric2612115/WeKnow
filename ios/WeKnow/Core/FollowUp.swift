// The plain code around a follow-up answered by Apple's model on this phone ("Why is that a scam?", "What does line 4
// mean?"): what the model is given (the conversation since the paper it is about, as the person saw it), when a
// follow-up goes to it, and which replies are kept. The model explains; it never decides. A reply that brings a number
// the conversation does not have, or that clears a warning, is not shown. Same rules as web/src/core/followUp.ts.

import Foundation
import FoundationModels

enum FollowUp {
  struct Turn {
    var me: Bool
    var text: String
    var picture = false
    var warned = false
  }

  /// The turns since the last picture or paper (or the last few when there was none), oldest first, about 2000 characters.
  static func conversation(_ turns: [Turn]) -> String {
    var out: [String] = []
    var size = 0
    for t in turns.reversed() {
      if size >= 2000 { break }
      let line = t.me ? "Person: \(t.text)" + (t.picture ? " (with a picture of a paper)" : "") : "WeKnow: \(t.text)"
      out.insert(line, at: 0)
      size += line.count + 1
      if t.me && t.picture { break }
    }
    return String(out.joined(separator: "\n").suffix(2000))
  }

  /// The sentences of the model's reply that may be shown, after a leading "WeKnow:" is taken off: each one passes
  /// keep(...) on its own, so one bad sentence ("It is a scam.") does not cost the rest.
  static func keptSentences(conversation: String, question: String, reply: String, warned: Bool) -> [String] {
    let cleaned = reply.replacingOccurrences(of: #"^\s*WeKnow:\s*"#, with: "", options: [.regularExpression, .caseInsensitive])
      .replacingOccurrences(of: "\n", with: " ")
    var out: [String] = []
    var current = ""
    for ch in cleaned {
      current.append(ch)
      if ".!?".contains(ch) {
        let t = current.trimmingCharacters(in: .whitespaces)
        if !t.isEmpty { out.append(t) }
        current = ""
      }
    }
    let rest = current.trimmingCharacters(in: .whitespaces)
    if !rest.isEmpty { out.append(rest) }
    let same = { (a: String) in a.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { !$0.isEmpty }.joined(separator: " ") }
    return Array(out.map { $0.replacingOccurrences(of: #"^\s*WeKnow:\s*"#, with: "", options: [.regularExpression, .caseInsensitive]) }
      .filter { !$0.isEmpty && same($0) != same(question) && keep(conversation: conversation, question: question, reply: $0, warned: warned) }
      .prefix(3))
  }

  /// A yes-or-no question ("Can I bring my own parts?"): the model may not guess its answer.
  static func yesNo(_ q: String) -> Bool {
    q.range(of: #"^\s*(can|could|do|does|did|is|are|was|were|will|would|should|may|might|have|has)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
  }

  /// A question about the answer itself ("Why?", "What does line 4 mean?"): asked of the conversation before anything else.
  static func aboutTheAnswer(_ q: String) -> Bool {
    q.range(of: #"\b(why|explain|what does|what do|mean|means|meant|which|who|whom|how come|line \d+|tell me more|more about|what if|is it real|are they real|scam|fake|fraud|legit)\b"#,
            options: [.regularExpression, .caseInsensitive]) != nil
  }

  /// Words about the paper being talked about (paying it, its company or shop, its lines).
  static func aboutThePaper(_ q: String) -> Bool {
    aboutTheAnswer(q) || q.range(of: #"\b(pay|paid|paying|payment|money|account|bank|company|call|bill|due|late|fee|fees|half|refund|dispute|it|this|that|they|them|their|shop|line|lines|parts|labor|discount|warranty|total|price|quote|charge|charged)\b"#, options: [.regularExpression, .caseInsensitive]) != nil
  }

  private static let clears = #"\b(safe|fine|ok(ay)?|all right|alright|legit(imate)?)\s+to\s+pay\b|\byou can (go ahead and )?pay\b|\bgo ahead and pay\b|\bnothing (is )?wrong\b|\bnot a scam\b|\bno need to worry\b"#

  private static func numbers(_ s: String) -> [String] {
    guard let re = try? NSRegularExpression(pattern: #"\d[\d,.]*\d|\d"#) else { return [] }
    return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).compactMap { m in
      Range(m.range, in: s).map { r in
        var n = String(s[r]).replacingOccurrences(of: ",", with: "")
        if n.hasSuffix(".") { n.removeLast() }
        if let dot = n.range(of: #"\.0+$"#, options: .regularExpression) { n.removeSubrange(dot) }
        return n
      }
    }
  }

  /// Whether the model's reply may be shown: every number in it is one the conversation or the question has (a
  /// count up to 9 is fine), and after a warning it does not say the paper is fine to pay.
  static func keep(conversation: String, question: String, reply: String, warned: Bool) -> Bool {
    let text = reply.trimmingCharacters(in: .whitespacesAndNewlines)
    guard text.count >= 2 else { return false }
    let have = Set(numbers(conversation + " " + question))
    guard numbers(text).allSatisfy({ have.contains($0) || ($0.count == 1 && Int($0) != nil) }) else { return false }
    if warned, text.range(of: clears, options: [.regularExpression, .caseInsensitive]) != nil { return false }
    // "It is a scam" only when the conversation said so.
    if text.range(of: #"\b(is|it's|its) (a |definitely a )?scam\b"#, options: [.regularExpression, .caseInsensitive]) != nil,
       conversation.range(of: "scam", options: .caseInsensitive) == nil { return false }
    return true
  }

  /// One quote line spelled out, so a small model cannot mix up the price and how far above usual it is.
  static func lineFact(_ i: LineItem) -> String {
    var out = "Line \(i.n), \(i.label): the shop charges \(i.amount.map(S.money) ?? "no amount")."
    if let p = i.item { out += " Most shops charge \(S.money(p.low)) to \(S.money(p.high)), about \(S.money(p.typical))." }
    switch i.state {
    case .high: out += " That is \(S.money(i.over ?? 0)) above the usual top price."
    case .fair: out += " That is a usual price."
    case .low: out += " That is below the usual price."
    case .pending: out += " This line is not in the price book yet."
    }
    return out
  }

  static func prompt(_ conversation: String, _ question: String) -> String {
    """
    Below is the conversation so far. Answer the person's new question in one to three short, plain sentences, using
    only what the conversation says, and give WeKnow's reasons in your own words. Read the numbers carefully: what the shop
    or company charges is not the same as how much above the usual price it is. If the conversation does not answer the question,
    do not guess yes or no: say you can't tell from this check, and suggest asking the shop or the company. Never say a bill is safe to pay or that a warning was wrong. Say which warning signs WeKnow found; call it a scam only if WeKnow did. Do not bring
    any number that is not in the conversation. Answer in the language of the question. Give only the answer.
    
    Two examples of the style only (use the reasons in this conversation, not these):
    Question: Why is that line so high?
    Answer: Because the shop charges much more for that job than most shops do. Ask them what the extra covers.
    Question: What does past due mean?
    Answer: It means the date to pay has passed and the money has not arrived yet.

    Conversation so far:
    \(conversation)

    New question: \(question)
    """
  }

  /// Apple's model on this phone answers from the conversation. Nothing leaves the phone.
  /// A bill that warns about scams trips the default guardrails ("may contain unsafe content"), so the follow-up
  /// runs on the setting Apple provides for working with text the person already has; plain code still checks the reply.
  @MainActor
  static func ask(_ conversation: String, _ question: String) async -> String? {
    let instructions = "You are WeKnow, a careful helper that checks bills and quotes before people pay. You explain; you never change WeKnow's verdict."
    for model in [SystemLanguageModel(guardrails: .permissiveContentTransformations), Device.model] {
      let session = LanguageModelSession(model: model, instructions: instructions)
      do {
        let r = try await session.respond(to: prompt(conversation, question), options: GenerationOptions(temperature: 0.2))
        return r.content.trimmingCharacters(in: .whitespacesAndNewlines)
      } catch {
        print("[WeKnow] follow-up on this phone failed: \(error)")
      }
    }
    return nil
  }

  // MARK: The common follow-ups, answered by plain code from the last answer
  // A small model explains unevenly ("Because the account is new", "Yes, it is a scam"), so the questions people ask
  // most are answered from WeKnow's own words. The model only gets what is left. Same as web/src/core/followUp.ts.

  private static let means: [(String, String)] = [
    (#"\b(new account|account is new|account changed|bank has changed|account ending)\b"#, "It means the bill asks you to pay a bank account they never used with you before. If the company did not tell you itself, the money may go to someone else."),
    (#"\b(hidden words|tell a reader|aimed at an ai|to an ai|talks? to an ai)\b"#, "It means the paper has words written for a computer that reads it, telling it the bill is fine. A real bill has no reason to talk to a computer."),
    (#"\b(rush|rushes|hurry|within 24 hours|right away|today)\b"#, "It means it pushes you to pay fast, so you don’t stop to check. A real company gives you time."),
    (#"\b(don.t add up|do not add up|numbers)\b"#, "It means the amounts on the paper don’t match: the parts don’t add up to what it asks you to pay."),
    (#"\b(two account|two different account)\b"#, "It means the paper shows two different accounts to pay. Ask the company which one is theirs."),
  ]

  private static func has(_ s: String, _ pattern: String) -> Bool {
    s.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
  }

  /// The reasons in WeKnow's answer ("One. … Two. …"), as plain sentences.
  static func reasons(in answer: String) -> [String] {
    guard let re = try? NSRegularExpression(pattern: #"\b(?:One|Two|Three|Four|Five)\.\s+"#) else { return [] }
    let ns = answer as NSString
    let marks = re.matches(in: answer, range: NSRange(location: 0, length: ns.length))
    return marks.enumerated().compactMap { i, m in
      let start = m.range.location + m.range.length
      let end = i + 1 < marks.count ? marks[i + 1].range.location : ns.length
      var part = ns.substring(with: NSRange(location: start, length: end - start))
      for stop in [" I found", " I covered", " Call ", " I also", " Your ", " Nothing"] {
        if let r = part.range(of: stop) { part = String(part[..<r.lowerBound]) }
      }
      let t = part.trimmingCharacters(in: .whitespaces)
      return t.isEmpty ? nil : t
    }
  }

  /// A plain-code answer to a common follow-up about the last bill or quote, or nil when the model should try.
  static func plan(_ question: String, bill: Bool, answer: String, items: [LineItem]) -> [String]? {
    let q = question.lowercased()
    if !bill {
      if let m = q.range(of: #"\bline (\d+)\b"#, options: .regularExpression) {
        let n = Int(q[m].filter(\.isNumber)) ?? 0
        if let line = items.first(where: { $0.n == n }) { return [lineFact(line)] }
      }
      if has(q, #"\bwhich\b.*\b(fine|fair|ok|okay|good|normal)\b|\b(fine|fair) ones\b"#) {
        let fine = items.filter { $0.state == .fair || $0.state == .low }
        return fine.isEmpty ? ["None of the lines I could check looks fair."]
          : ["These lines look fair: " + fine.map { "line \($0.n), \($0.label)" }.joined(separator: "; ") + "."]
      }
      if has(q, #"\bwhy\b|\bhow come\b|\bso (high|much|expensive)\b"#) {
        let high = items.filter { $0.state == .high }
        if !high.isEmpty { return high.map(lineFact) }
      }
      return nil
    }
    let rs = reasons(in: answer)
    let scamOnline = has(answer, "known scam")
    if has(q, #"\bscam\b|\bfake\b|\bfraud\b|\blegit|\bis (it|this|that|the company) real\b"#) {
      if scamOnline { return ["I checked it online: charges like these are a known scam. Don’t pay it, and don’t call the numbers on this paper."] }
      guard !rs.isEmpty else { return nil }
      return ["I can’t say for sure from the paper alone. These are the warning signs I found:"]
        + rs.map { $0.hasSuffix(".") ? $0 : $0 + "." }
        + ["Don’t pay until you call the company on a number you already trust."]
    }
    if has(q, #"\bmean|\bwhat (is|does|do)\b"#), let hit = means.first(where: { has(q, $0.0) }) { return [hit.1] }
    if has(q, #"\bwhy\b|\bhow come\b|\breason"#), !rs.isEmpty {
      let joined = rs.map { r -> String in
        let t = r.hasSuffix(".") ? String(r.dropLast()) : r
        return t.prefix(1).lowercased() + t.dropFirst()
      }.joined(separator: "; and ")
      return ["Because \(joined).", "Any one of these is a reason to check with the company before you pay."]
    }
    return nil
  }
}
