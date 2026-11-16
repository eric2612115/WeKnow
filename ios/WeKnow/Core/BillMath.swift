// Two bill checks in plain code, on the phone, from the words read off the paper (no model involved):
//  - the numbers don't add up (subtotal + tax = total; previous − payments + new charges = amount due;
//    total − paid = balance due), within a dollar;
//  - the paper shows two different account numbers for the customer (top section vs payment stub).
// Same rules as web/src/core/billMath.ts. They can only add warnings.

import Foundation

enum BillMath {
  struct Finding: Equatable { let text: String; let stop: Bool }

  enum Field: String { case subtotal, tax, total, previous, paid, newCharges, due }

  /// Labels, most specific first; a row counts for the first label it starts with.
  static let labels: [(Field, String)] = [
    (.previous, #"^(previous balance|amount of last bill|last bill amount|balance forward)"#),
    (.paid, #"^(payments?( received)?|paid|payment received|amount paid|less payments?)"#),
    (.newCharges, #"^(total )?(new|current) charges"#),
    (.subtotal, #"^sub-?\s?total"#),
    (.tax, #"^(sales )?tax(es)?\b(?! and fees on)"#),
    (.due, #"^(total )?(amount|balance) due|^total due|^total amount due|^please pay"#),
    (.total, #"^total\b(?! (current|new|amount|due))"#),
  ]

  static let money = #"\$?\s?(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+\.\d{2})"#

  /// The labelled amounts on the paper (first one wins), from rows like "Subtotal ........ $324.99".
  static func amounts(_ rows: [String]) -> [Field: Double] {
    var out: [Field: Double] = [:]
    for raw in rows {
      // OCR often reads 0 as O inside numbers.
      let row = raw.replacingOccurrences(of: #"(?<=\d)[Oo](?=[\d.,])|(?<=[\d.,])[Oo](?=\d|\b)"#, with: "0", options: .regularExpression)
      let lower = row.lowercased().trimmingCharacters(in: .whitespaces)
      if lower.contains("minimum") { continue }
      for (field, pattern) in labels where out[field] == nil {
        guard lower.range(of: pattern, options: .regularExpression) != nil,
              let m = row.range(of: money, options: .regularExpression) else { continue }
        let n = Double(row[m].replacingOccurrences(of: "$", with: "").replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespaces))
        if let n { out[field] = n }
        break
      }
    }
    return out
  }

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

  static func check(_ rows: [String]) -> [Finding] {
    var found: [Finding] = []
    let a = amounts(rows)
    // A reading can misplace a number; only a clear gap counts.
    func off(_ x: Double, _ y: Double) -> Bool { abs(x - y) > 5.0 }
    if let s = a[.subtotal], let t = a[.tax], let total = a[.total], off(s + t, total) {
      found.append(Finding(text: "The numbers on this bill don’t add up: \(S.money(s)) plus \(S.money(t)) tax is \(S.money(s + t)), but it says the total is \(S.money(total)).", stop: false))
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
    let labelled = rows.filter { $0.range(of: #"(?i)(account (number|no\.?|#)|acct\.? ?#?)"#, options: .regularExpression) != nil
      && $0.range(of: #"(?i)pay(ment)? to|remit to|deposit"#, options: .regularExpression) == nil }
    let endings = Set(labelled.flatMap { row in
      row.matches(of: /account ending (\d{4})/).map { String($0.1) }
    })
    if endings.count >= 2 {
      let list = endings.sorted()
      found.append(Finding(text: "This bill shows two different account numbers (ending \(list[0]) and \(list[1])). Call the company before paying.", stop: false))
    }
    return found
  }
}
