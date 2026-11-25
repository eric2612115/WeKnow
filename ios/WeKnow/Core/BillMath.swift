// Two bill checks in plain code, on the phone, from the words read off the paper (no model involved):
//  - the numbers don't add up (subtotal − discount + tax = total; previous − payments + new charges = amount due;
//    total − paid = balance due), within a dollar;
//  - the paper shows two different account numbers for the customer (top section vs payment stub).
// Same rules as web/src/core/billMath.ts. They can only add warnings.

import Foundation

enum BillMath {
  struct Finding: Equatable { let text: String; let stop: Bool }

  enum Field: String { case subtotal, discount, tax, total, previous, paid, newCharges, due }

  /// Labels, most specific first; a row counts for the first label it starts with.
  static let labels: [(Field, String)] = [
    (.previous, #"^(previous balance|amount of last bill|last bill amount|balance forward)"#),
    (.paid, #"^(payments?( received)?|paid|payment received|amount paid|less payments?)"#),
    (.newCharges, #"^(total )?(new|current) charges"#),
    (.discount, #"^(discount|savings|coupon|promo)"#),
    (.subtotal, #"^sub-?\s?total"#),
    (.tax, #"^(sales )?tax(es)?\b(?! and fees on)"#),
    (.due, #"^(total )?(amount|balance) due|^total due|^total amount due|^please pay"#),
    (.total, #"^total\b(?! (current|new|amount|due))"#),
  ]

  /// A money amount; a rate such as "(2.00%)" is not one.
  static let money = #"\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})(?!\d|\s?%)"#

  /// The labelled amounts on the paper, from rows like "Subtotal ........ $324.99". One amount printed beside a label
  /// is the paper's fact; a label printed beside two different amounts ("Amount due $120.00" at the top, "Amount due
  /// $210.00" on the stub) confirms neither, so it is left out and no sum is checked or said with either.
  static func amounts(_ rows: [String]) -> [Field: Double] {
    readAmounts(rows).amounts
  }

  static func readAmounts(_ rows: [String]) -> (amounts: [Field: Double], conflicts: [Field]) {
    var out: [Field: Double] = [:]
    var conflicts: [Field] = []
    for raw in rows {
      // OCR often reads 0 as O inside numbers.
      let row = raw.replacingOccurrences(of: #"(?<=\d)[Oo](?=[\d.,])|(?<=[\d.,])[Oo](?=\d|\b)"#, with: "0", options: .regularExpression)
      if row.lowercased().contains("minimum") { continue }
      // A row can hold several columns ("Beneficiary: …   Includes tax (2.00%)   $21.00"): each cell may be the
      // label, and its amount is the first one in that cell or the cells to its right.
      let cells = row.components(separatedBy: "   ")
      for (i, cell) in cells.enumerated() {
        var lower = cell.lowercased().trimmingCharacters(in: .whitespaces)
        if lower.contains("[") { continue } // "Payment [account ending 0931]" is not a label
        if lower.hasPrefix("includes ") { lower.removeFirst("includes ".count) }
        guard let (field, _) = labels.first(where: { lower.range(of: $0.1, options: .regularExpression) != nil }) else { continue }
        let rest = cells[i...].joined(separator: "   ")
        guard let m = rest.range(of: money, options: .regularExpression),
              let n = Double(rest[m].replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespaces))
        else { continue }
        guard let first = out[field] else { out[field] = n; continue }
        // Only an amount in the label's own cell can be a second amount for it; one found in a cell further right
        // may belong to another column.
        let beside = cell.range(of: money, options: .regularExpression) != nil
        if beside, abs(first - n) > 0.005, !conflicts.contains(field) { conflicts.append(field) }
      }
    }
    for f in conflicts { out[f] = nil }
    return (out, conflicts)
  }

  /// Words a company's name may carry or drop between the paper and a reading of it ("Riverbend Electric Co-op").
  static let nameFiller: Set<String> = ["the", "and", "of", "inc", "llc", "ltd", "co", "op", "corp", "company", "corporation", "group"]
  static func nameWords(_ s: String) -> [String] {
    s.lowercased().components(separatedBy: CharacterSet.alphanumerics.inverted).filter { $0.count >= 2 && !nameFiller.contains($0) }
  }

  /// One letter misread, added or dropped by the text recognizer ("Rlverbend", "Riverbnd").
  static func nearlySame(_ a: String, _ b: String) -> Bool {
    if a == b { return true }
    let x = Array(a), y = Array(b)
    guard min(x.count, y.count) >= 5, abs(x.count - y.count) <= 1 else { return false }
    var i = 0
    while i < x.count, i < y.count, x[i] == y[i] { i += 1 }
    if x.count == y.count { return x.dropFirst(i + 1).elementsEqual(y.dropFirst(i + 1)) }
    return x.count > y.count ? x.dropFirst(i + 1).elementsEqual(y.dropFirst(i)) : x.dropFirst(i).elementsEqual(y.dropFirst(i + 1))
  }

  /// Whether a company name the model gave is printed on the paper: every word of it is among the paper's words, or
  /// among the words covered on it (one misread letter allowed in a long word). A name printed nowhere was made up.
  static func namePrinted(_ name: String, in text: String, covered: Set<String> = []) -> Bool {
    let want = nameWords(name)
    guard !want.isEmpty else { return false }
    let have = Set(nameWords(text)).union(covered.map { $0.lowercased() })
    let flat = text.lowercased().filter { !$0.isWhitespace }
    return want.allSatisfy { w in
      have.contains(w)
        // Words without spaces between them (Chinese) are looked for as printed, anywhere in the text.
        || (w.unicodeScalars.contains { $0.properties.isIdeographic } ? flat.contains(w) : have.contains { nearlySame(w, $0) })
    }
  }

  /// Every number printed in a text, whole, as amounts: "$1,200.00", "160", "16.50". The digits inside a date
  /// ("11/16/2026") or a covered detail ("[account ending 5678]") are not amounts.
  static func moneyTokens(_ text: String) -> [Double] {
    let t = text.replacingOccurrences(of: #"\[[^\]]*\]"#, with: " ", options: .regularExpression)
    return amountToken.matches(in: t, range: NSRange(t.startIndex..., in: t)).compactMap { m in
      Range(m.range(at: 1), in: t).flatMap { Double(t[$0].replacingOccurrences(of: ",", with: "")) }
    }
  }
  private static let amountToken = try! NSRegularExpression(
    pattern: #"(?<![\d.,/])(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)(?![\d/]|[.,]\d)"#)

  /// The last money amount printed on a row: on a quote that is the line's own total, after quantity and rate.
  static func lastMoney(_ row: String) -> Double? {
    let all = row.matches(of: /\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})/)
    guard let m = all.last else { return nil }
    return Double(String(m.1).replacingOccurrences(of: ",", with: ""))
  }

  /// "Due date Dec 01, 2026", "Pay by 12/01/2026", "Due Dec 1".
  static func dueDate(_ rows: [String]) -> String? {
    for r in rows {
      if let m = r.firstMatch(of: /(?i)(?:due date|due by|pay by|payment due|due)\s*:?\s*([A-Z][a-z]{2,8}\.? \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/) {
        return String(m.1)
      }
    }
    return nil
  }

  /// Amount due and minimum due as printed, for "This bill says".
  static func dueAmounts(_ rows: [String]) -> (due: Double?, minimum: Double?) {
    var minimum: Double?
    for r in rows where r.lowercased().contains("minimum") { if let v = lastMoney(r) { minimum = v; break } }
    return (amounts(rows)[.due], minimum)
  }

  /// The accounts the paper asks you to pay into ("Payment account 3305 7719 4821" → "[account ending 4821]"),
  /// in the order printed. A member or customer number is not one of them.
  static func payToEndings(_ rows: [String]) -> [String] {
    var out: [String] = []
    for r in rows {
      for m in r.matches(of: /(?i)(?:payment|pay to|pay into|remit to|deposit to|transfer to|new)\s+(?:account\s+)?(?:number\s+)?(?:\[)?account ending (\d{4})/) {
        let e = String(m.1)
        if !out.contains(e) { out.append(e) }
      }
    }
    return out
  }

  /// Which of them the bill means: the one that differs from the account you paid last time (that is the change
  /// the person must see), else the first printed.
  static func payTo(_ rows: [String], lastTime: String?) -> String? {
    let all = payToEndings(rows)
    if let lastTime, let other = all.first(where: { $0 != lastTime }) { return other }
    return all.first
  }

  static func check(_ rows: [String]) -> [Finding] {
    var found: [Finding] = []
    let a = amounts(rows)
    // A reading can misplace a number; only a clear gap counts.
    func off(_ x: Double, _ y: Double) -> Bool { abs(x - y) > 5.0 }
    // A discount printed between them comes off the subtotal ("Discount -$188.68"; the sign is not read).
    if let s = a[.subtotal], let t = a[.tax], let total = a[.total], off(s - (a[.discount] ?? 0) + t, total) {
      let sum = s - (a[.discount] ?? 0) + t
      let parts = a[.discount].map { "\(S.money(s)) minus a \(S.money($0)) discount, plus \(S.money(t)) tax," } ?? "\(S.money(s)) plus \(S.money(t)) tax"
      found.append(Finding(text: "The numbers on this bill don’t add up: \(parts) is \(S.money(sum)), but it says the total is \(S.money(total)).", stop: false))
    }
    if let p = a[.previous], let paid = a[.paid], let n = a[.newCharges], let due = a[.due], off(p - paid + n, due) {
      found.append(Finding(text: "The numbers on this bill don’t add up: the last balance, payments and new charges come to \(S.money(p - paid + n)), but it asks for \(S.money(due)).", stop: false))
    } else if a[.previous] == nil, a[.newCharges] == nil,
              !rows.contains(where: { $0.range(of: #"(?i)previous balance|last bill|balance forward"#, options: .regularExpression) != nil }),
              let total = a[.total], let paid = a[.paid], let due = a[.due], off(total - paid, due) {
      found.append(Finding(text: "The numbers on this bill don’t add up: \(S.money(total)) minus \(S.money(paid)) already paid is \(S.money(total - paid)), but it asks for \(S.money(due)).", stop: false))
    }
    // Account numbers: masking keeps only the last four ("[account ending 4821]").
    // Only rows that label the customer's own account number count (a "pay to" bank account is something else).
    // A bare "acct 84109804" (a remittance or lockbox account) is not labelled as the customer's.
    let labelled = rows.filter { $0.range(of: #"(?i)(account (number|no\.?|#)|acct\.? ?(#|no\.?|number|:))"#, options: .regularExpression) != nil
      && $0.range(of: #"(?i)pay(ment)? to|payment account|remit|deposit|lockbox"#, options: .regularExpression) == nil }
    let endings = Set(labelled.flatMap { row in
      row.matches(of: /account ending (\d{4})/).map { String($0.1) }
    })
    if endings.count >= 2 {
      let list = endings.sorted()
      found.append(Finding(text: "This bill shows two different account numbers (ending \(list[0]) and \(list[1])). Call the company before paying.", stop: false))
    }
    return found
  }

  /// A company name, not a scrap of the page: at least three letters, and mostly letters ("BR3 : 807", read off a
  /// restaurant check, is not a name). Same as web/src/core/billMath.ts plausibleName.
  static func plausibleName(_ name: String) -> Bool {
    let chars = name.filter { !$0.isWhitespace }
    let letters = chars.filter(\.isLetter).count
    return letters >= 3 && Double(letters) / Double(max(1, chars.count)) >= 0.6
  }
}
