// The step up to the cloud when the phone cannot answer well (design/HYBRID-ROUTING.md).
//  - The phone's model sees at most five candidates (its window is small). Gemini, through Firebase AI Logic, sees
//    the covered words and the whole pack index, and may only name one ref from it — never a price or free text.
//  - Before anything goes, two checks on the phone: the payload guard (plain code) and, where Apple's model is
//    available, a review of the covered text for any personal detail left. Either one stops the request.

import FirebaseAILogic
import Foundation
import FoundationModels

@Generable
struct PackPick {
  @Guide(description: "The ref of the one item the person's words are about, copied exactly from the list. Write none if no item fits.")
  var ref: String
}

@Generable
struct PrivacyReview {
  @Guide(description: "Each personal detail still in the text — a person's name, a phone number, an email, a street address, or an account, card or plate number — copied exactly as it appears. Empty if there is none. Placeholders in brackets such as [phone] are not personal details.")
  var details: [String]
}

enum CloudPick {
  enum Outcome {
    case found(ref: String, ms: Int, sent: String)
    case nothing(ms: Int, sent: String)
    case blocked(String) // why nothing was sent
    case failed(String)
  }

  /// Plain-code guard on the exact text that would leave: anything that still looks personal stops it.
  static func guardText(_ text: String) -> String? {
    if !PII.spans(text).isEmpty { return "it still had a personal detail in it" }
    if text.range(of: #"\d[\d\s-]{4,}\d"#, options: .regularExpression) != nil { return "it had a long number in it" }
    return nil
  }

  /// Apple's on-device model reads the covered text once more. Nil when there is no on-device model.
  static func reviewOnDevice(_ text: String) async -> Bool? {
    guard Device.canRead else { return nil }
    let session = LanguageModelSession(model: Device.model, instructions: "You check text for personal details before it is sent anywhere.")
    guard let r = try? await session.respond(to: "Text:\n\"\"\"\n\(text)\n\"\"\"", generating: PrivacyReview.self, options: GenerationOptions(samplingMode: .greedy)) else { return nil }
    // A small model over-flags; a detail counts only if it is really in the text and looks personal
    // (digits, an @, or a capitalised word that does not start the text).
    let first = text.split(separator: " ").first.map(String.init) ?? ""
    let real = r.content.details.filter { d in
      let t = d.trimmingCharacters(in: .whitespacesAndNewlines)
      guard t.count >= 3, text.contains(t), !t.hasPrefix("[") else { return false }
      let digits = t.filter(\.isNumber).count
      let name = t.first?.isUppercase == true && !t.hasPrefix(first)
      return digits >= 3 || t.contains("@") || name
    }
    if !real.isEmpty { print("[WeKnow] on-device review flagged: \(real)") }
    return !real.isEmpty
  }

  /// Covers, checks twice, then asks Gemini for the one pack item the words are about.
  /// Items that fit almost anything and so say nothing: never an answer from the cloud step.
  static let catchAll: Set<String> = ["appliance-repair", "handyman-job", "handyman-hourly", "electrician-service-call", "plumber-service-call"]

  static func pick(_ words: String, pack: Pack) async -> Outcome {
    let covered = PII.mask(words).prefix(400).trimmingCharacters(in: .whitespacesAndNewlines)
    if let why = guardText(covered) { return .blocked(why) }
    if await reviewOnDevice(covered) == true { return .blocked("the check on this phone thought a personal detail was left") }

    let guides = pack.guides.map { "\($0.ref): \($0.name)" }.joined(separator: "\n")
    let prices = pack.prices.map { "\($0.ref): \($0.name)" }.joined(separator: "\n")
    let prompt = """
    A person asks or describes: "\(covered)"
    Which ONE item below is it about? Prefer a repair guide when they describe a problem, a price when they ask what \
    something costs. A general item such as a service call or general repair does not count. Copy its ref exactly, or write none.
    Guides:
    \(guides)
    Prices:
    \(prices)
    """
    let t0 = Date()
    do {
      let session = LanguageModelSession(model: FirebaseCloud.model, instructions: "You match a person's words to one item in a list. You never invent items.")
      let r = try await session.respond(to: prompt, generating: PackPick.self, options: GenerationOptions(temperature: 0))
      let ms = Int(Date().timeIntervalSince(t0) * 1000)
      let ref = r.content.ref.trimmingCharacters(in: .whitespacesAndNewlines)
      // Only refs that exist in the pack count, of the kind the words lean to (how to fix → a guide, how much →
      // a price), and never a catch-all; anything else is "nothing", and the web search may try.
      let lean = WordsAnswer.lean(words)
      let isGuide = pack.guide(ref) != nil, isPrice = pack.price(ref) != nil
      let fits = (isGuide && lean != .price) || (isPrice && lean != .guide)
      if fits && !catchAll.contains(ref) { return .found(ref: ref, ms: ms, sent: String(covered)) }
      return .nothing(ms: ms, sent: String(covered))
    } catch {
      return .failed("\(error)")
    }
  }
}

// MARK: - Beyond the pack: a sourced answer from the web

/// A how-to found with Google Search grounding through Firebase AI Logic, kept only when it came with web sources.
struct WebGuide: Sendable {
  var title: String
  var steps: [String]
  var safety: String?
  var callPro: String?
  var sources: [(title: String, url: String)]
  /// Google's search-suggestion chip, which must be shown with a grounded answer.
  var entryHTML: String?
  var ms: Int
  var sent: String
}

extension CloudPick {
  enum WebOutcome { case found(WebGuide), nothing(ms: Int, sent: String), blocked(String), failed(String) }

  /// The model sometimes answers without searching; one more try in that case.
  static func searchGuide(_ words: String) async -> WebOutcome {
    let first = await searchGuideOnce(words)
    if case .nothing = first { return await searchGuideOnce(words) }
    return first
  }

  private static func searchGuideOnce(_ words: String) async -> WebOutcome {
    let covered = String(PII.mask(words).prefix(300)).trimmingCharacters(in: .whitespacesAndNewlines)
    if let why = guardText(covered) { return .blocked(why) }
    if await reviewOnDevice(covered) == true { return .blocked("the check on this phone thought a personal detail was left") }
    let prompt = """
    Search the web for how a homeowner can safely deal with this: "\(covered)".
    Use what you find with Google Search, then end your answer with one line of JSON:
    {"title": short plain name of the problem, "steps": [at most 6 short plain steps a careful older person can do], \
    "safety": one short caution or null, "callPro": when to call a professional, or null}
    Do not put prices in the steps.
    """
    let t0 = Date()
    do {
      let model = FirebaseAI.firebaseAI(backend: .googleAI()).generativeModel(
        modelName: Cloud.modelName, generationConfig: GenerationConfig(temperature: 0), tools: [.googleSearch()])
      let r = try await model.generateContent(prompt)
      let ms = Int(Date().timeIntervalSince(t0) * 1000)
      let meta = r.candidates.first?.groundingMetadata
      let sources: [(title: String, url: String)] = (meta?.groundingChunks ?? []).compactMap { c in
        guard let u = c.web?.uri, u.hasPrefix("https://") else { return nil }
        return (title: c.web?.title ?? c.web?.domain ?? "Web page", url: u)
      }
      guard !sources.isEmpty, let text = r.text,
            let jsonText = text.ranges(of: /\{[^{}]*\}/).last.map({ String(text[$0]) }),
            let obj = try? JSONSerialization.jsonObject(with: Data(jsonText.utf8)) as? [String: Any],
            let steps = obj["steps"] as? [String], !steps.isEmpty else { return .nothing(ms: ms, sent: covered) }
      // No prices from the web in a how-to: numbers that matter come from the price book or a sourced lookup.
      let clean = steps.prefix(6).map { $0.replacingOccurrences(of: #"\$\s?\d[\d,.]*"#, with: "", options: .regularExpression).trimmingCharacters(in: .whitespaces) }
      return .found(WebGuide(
        title: (obj["title"] as? String) ?? "This problem", steps: clean,
        safety: obj["safety"] as? String, callPro: obj["callPro"] as? String,
        sources: Array(sources.prefix(5)), entryHTML: meta?.searchEntryPoint?.renderedContent, ms: ms, sent: covered))
    } catch {
      return .failed("\(error)")
    }
  }
}
