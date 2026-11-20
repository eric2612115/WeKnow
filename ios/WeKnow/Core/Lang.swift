// The language of one answer. Before WeKnow answers, plain code looks at the person's own words and names their
// language; the whole answer (the point, the sentences, the next-question buttons, the voice) is then given in that
// one language, never a mix. Translating happens on this phone with Apple's on-device model, so the answer (which
// names who asks for money and how much) goes nowhere. A line is kept in English when the phone cannot translate it
// or when a number in it did not survive, because the numbers are the answer.

import Foundation
import FoundationModels
import NaturalLanguage

@Generable
struct TranslatedLines {
  @Guide(description: "The same lines in the target language, one per input line, in the same order.")
  var lines: [String]
}

enum Lang {
  static let english = "en"

  /// The language the person wrote or said, as a code ("en", "zh-Hant", "es"). English when there are no words of
  /// their own, or too few to tell.
  static func of(_ words: String?) -> String {
    guard let w = words?.trimmingCharacters(in: .whitespacesAndNewlines), !w.isEmpty else { return english }
    // Chinese, Japanese and Korean are told from the letters themselves, which is certain even for three words.
    let han = w.unicodeScalars.filter { (0x4E00...0x9FFF).contains($0.value) }.count
    let kana = w.unicodeScalars.filter { (0x3040...0x30FF).contains($0.value) }.count
    let hangul = w.unicodeScalars.filter { (0xAC00...0xD7AF).contains($0.value) }.count
    if kana > 0 { return "ja" }
    if hangul > 0 { return "ko" }
    let r = NLLanguageRecognizer()
    r.processString(w)
    if han > 0 {
      let simplified = r.languageHypotheses(withMaximum: 3)[.simplifiedChinese] ?? 0
      let traditional = r.languageHypotheses(withMaximum: 3)[.traditionalChinese] ?? 0
      return simplified > traditional ? "zh-Hans" : "zh-Hant"
    }
    // Latin letters: a short question is easy to mistake, so another language needs to be clear.
    guard w.split(separator: " ").count >= 3, let best = r.dominantLanguage,
          (r.languageHypotheses(withMaximum: 1)[best] ?? 0) >= 0.8 else { return english }
    return best.rawValue
  }

  /// Whether a line is already in that language (so it is left as it is).
  static func isIn(_ code: String, _ line: String) -> Bool {
    if code == english { return true }
    let letters = line.unicodeScalars.filter { CharacterSet.letters.contains($0) }
    guard !letters.isEmpty else { return true } // numbers and marks only
    if code.hasPrefix("zh") || code == "ja" || code == "ko" {
      let cjk = letters.filter { $0.value >= 0x3040 }.count
      return Double(cjk) / Double(letters.count) > 0.6
    }
    return of(line) == code
  }

  /// The language's name in English, for a prompt.
  static func name(_ code: String) -> String {
    switch code {
    case "zh-Hant": "Traditional Chinese (Taiwan)"
    case "zh-Hans": "Simplified Chinese"
    default: Locale(identifier: "en").localizedString(forIdentifier: code) ?? "English"
    }
  }

  /// The voice to read that language with.
  static func speech(_ code: String) -> String {
    switch code {
    case "zh-Hant": "zh-TW"
    case "zh-Hans": "zh-CN"
    case english: "en-US"
    default: code
    }
  }

  /// The fixed words around a how-to from the web, written out for the languages asked most. They are the same every
  /// time, so they are not left to a model. Other languages are translated on this phone.
  static let webWords: [String: [String]] = [
    //          not in my guides                    found on the web, about:            first, be careful:   get help if:
    "zh-Hant": ["我自己的指南裡沒有這一項。", "這是我在網路上找到的做法：", "先注意：", "遇到這種情況請找專業人員："],
    "zh-Hans": ["我自己的指南里没有这一项。", "这是我在网上找到的做法：", "先注意：", "遇到这种情况请找专业人员："],
    "ja": ["私のガイドにはこの項目がありません。", "ウェブで見つけた方法です：", "まず注意：", "次の場合は専門家に相談してください："],
    "ko": ["제 안내서에는 이 항목이 없습니다.", "웹에서 찾은 방법입니다:", "먼저 주의하세요:", "다음 경우에는 전문가에게 맡기세요:"],
    "es": ["No tengo esto en mis guías.", "Esto es lo que encontré en la web:", "Primero, tenga cuidado:", "Llame a un profesional si:"],
    "fr": ["Je n'ai pas cela dans mes guides.", "Voici ce que j'ai trouvé sur le web :", "D'abord, attention :", "Appelez un professionnel si :"],
    "de": ["Das steht nicht in meinen Anleitungen.", "Das habe ich im Web gefunden:", "Zuerst, Vorsicht:", "Holen Sie eine Fachkraft, wenn:"],
  ]

  private static let cache = Cache()
  private actor Cache {
    var done: [String: String] = [:]
    func get(_ k: String) -> String? { done[k] }
    func set(_ k: String, _ v: String) { done[k] = v }
  }

  /// One line, in the person's language.
  static func say(_ line: String, in code: String) async -> String {
    await say([line], in: code).first ?? line
  }

  /// The lines in the person's language, translated on this phone. Lines already in it are left alone.
  static func say(_ lines: [String], in code: String) async -> [String] {
    guard code != english, Device.canRead else { return lines }
    var out = lines
    var todo: [Int] = []
    for (i, l) in lines.enumerated() where !isIn(code, l) {
      if let hit = await cache.get("\(code)|\(l)") { out[i] = hit } else { todo.append(i) }
    }
    // Small batches: the on-device model's window is small, and one bad line should not cost the others.
    var start = 0
    while start < todo.count {
      var batch: [Int] = []
      var size = 0
      while start < todo.count, batch.count < 6, size + lines[todo[start]].count <= 700 || batch.isEmpty {
        batch.append(todo[start])
        size += lines[todo[start]].count
        start += 1
      }
      let source = batch.map { lines[$0] }
      guard let got = await translate(source, to: code), got.count == source.count else { continue }
      for (k, i) in batch.enumerated() where keepsNumbers(source[k], got[k]) && !got[k].isEmpty {
        out[i] = got[k]
        await cache.set("\(code)|\(source[k])", got[k])
      }
    }
    return out
  }

  private static func translate(_ lines: [String], to code: String) async -> [String]? {
    let numbered = lines.enumerated().map { "\($0.offset + 1). \($0.element)" }.joined(separator: "\n")
    let prompt = """
    Translate each numbered line into \(name(code)), for an older reader, in plain everyday words.
    Keep every number, amount, date and company name exactly as written. Do not add or remove anything.
    Give back \(lines.count) \(lines.count == 1 ? "line" : "lines"), without the numbering.
    Lines:
    \(numbered)
    """
    let session = LanguageModelSession(model: Device.model, instructions: "You translate short sentences faithfully. You never answer them or add to them.")
    guard let r = try? await session.respond(to: prompt, generating: TranslatedLines.self, options: GenerationOptions(samplingMode: .greedy)) else { return nil }
    return r.content.lines.map {
      $0.replacingOccurrences(of: #"^\s*\d+[.)]\s+"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
    }
  }

  /// Every number in the English line is still in the translated one.
  static func keepsNumbers(_ from: String, _ to: String) -> Bool {
    let numbers = { (s: String) in s.ranges(of: /\d[\d,.]*\d|\d/).map { String(s[$0]).replacingOccurrences(of: ",", with: "") } }
    var have = numbers(to)
    for n in numbers(from) {
      guard let i = have.firstIndex(of: n) else { return false }
      have.remove(at: i)
    }
    return true
  }
}
