// WeKnow for iPhone. Point at a quote, a bill or a problem; the phone reads it, covers your details, and a model
// that runs on this phone fills a fixed form. Plain code judges it against a sourced knowledge pack and WeKnow
// says the answer. Only when the phone cannot read by itself, and only after a yes, do the covered words go to
// Gemini through Firebase AI Logic.

import SwiftUI

@main
struct WeKnowApp: App {
  @State private var model = AskModel()
  @AppStorage("theme") private var themeRaw = ThemeChoice.light.rawValue

  init() {
    Cloud.configure()
    print("[WeKnow] launch: on-device model \(Device.status); internet path \(Cloud.isConfigured ? "configured" : "not set up")")
  }

  var body: some Scene {
    WindowGroup {
      HomeView(model: model, theme: Binding(get: { ThemeChoice(rawValue: themeRaw) ?? .light }, set: { themeRaw = $0.rawValue }))
        .preferredColorScheme(ThemeChoice(rawValue: themeRaw)?.scheme)
        .task {
          Voice.shared.warmUp()
          _ = Knowledge.shared
          // For recordings and screenshots: `-WeKnowSample quote` or `-WeKnowSample bill` starts that sample.
          if let id = UserDefaults.standard.string(forKey: "WeKnowSample"), let s = Sample.all.first(where: { $0.id == id }) {
            try? await Task.sleep(for: .milliseconds(600))
            model.start(s)
          }
          // `-WeKnowImage /path/to/sheet.png -WeKnowQuestion "Is this fair?"` reads a picture file (simulator tests).
          if let path = UserDefaults.standard.string(forKey: "WeKnowImage"), let img = UIImage(contentsOfFile: path) {
            try? await Task.sleep(for: .milliseconds(600))
            // The picture goes into the input bar with the words; `-WeKnowSend YES` presses Send as well.
            model.draft = img
            model.draftText = UserDefaults.standard.string(forKey: "WeKnowQuestion") ?? ""
            if UserDefaults.standard.bool(forKey: "WeKnowSend") { model.send() }
          }
          // `-WeKnowAsk "How much is a brake pad replacement?"` asks in words, as if typed.
          if let q = UserDefaults.standard.string(forKey: "WeKnowAsk"), !q.isEmpty {
            try? await Task.sleep(for: .milliseconds(600))
            model.ask(words: q)
          }
          // `-WeKnowPick "0,0,1"` presses those next-question buttons one after another (simulator tests).
          if let picks = UserDefaults.standard.string(forKey: "WeKnowPick") {
            for i in picks.split(separator: ",").compactMap({ Int($0) }) {
              while !(model.phase == .done && !model.choices.isEmpty) { try? await Task.sleep(for: .milliseconds(300)) }
              try? await Task.sleep(for: .milliseconds(700))
              if model.choices.indices.contains(i) { model.choose(model.choices[i]) }
            }
          }
          if let t = UserDefaults.standard.string(forKey: "WeKnowTheme"), let c = ThemeChoice(rawValue: t) { themeRaw = c.rawValue }
        }
    }
  }
}
