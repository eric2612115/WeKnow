// WeKnow for iPhone and iPad. Point at a quote, a bill or a problem; the phone reads it, covers your details, and a
// model that runs on this phone fills a fixed form (without Apple Intelligence, plain code does the basic check of a
// bill). Plain code judges it against a sourced knowledge pack and WeKnow says the answer. The paper is never sent
// anywhere to be read; only a covered question, or a new company's name and its charges, may go online through
// Firebase AI Logic.

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
          // The live light: every request that leaves the phone says so here, with its exact covered words.
          CloudPick.onSend = { [model] words in Task { @MainActor in if model.phase == .looking { model.online = words } } }
          Voice.shared.warmUp()
          _ = Knowledge.shared
          // For recordings and screenshots: `-WeKnowSample quote` or `-WeKnowSample bill` starts that sample.
          if let id = UserDefaults.standard.string(forKey: "WeKnowSample"), let s = Sample.all.first(where: { $0.id == id }) {
            try? await Task.sleep(for: .milliseconds(600))
            model.start(s)
          }
          // `-WeKnowImage /path/to/sheet.png -WeKnowQuestion "Is this fair?"` reads a picture file (simulator tests).
          if let path = UserDefaults.standard.string(forKey: "WeKnowImage"),
             let img = PaperFile.image(from: path.hasPrefix("/") ? URL(fileURLWithPath: path)
               : FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(path)) {
            try? await Task.sleep(for: .milliseconds(600))
            // The picture goes into the input bar with the words; `-WeKnowSend YES` presses Send as well.
            model.draft = img
            model.draftText = UserDefaults.standard.string(forKey: "WeKnowQuestion") ?? ""
            if UserDefaults.standard.bool(forKey: "WeKnowSend") { model.send() }
          }
          // `-WeKnowLights YES` opens the sheet that says what the two lights mean (screenshots).
          if UserDefaults.standard.bool(forKey: "WeKnowLights") { model.showLights = true }
          // `-WeKnowAsk "How much is a brake pad replacement?"` asks in words, as if typed.
          if let q = UserDefaults.standard.string(forKey: "WeKnowAsk"), !q.isEmpty {
            try? await Task.sleep(for: .milliseconds(600))
            model.ask(words: q)
          }
          // `-WeKnowPick "0,0,1"` presses those next-question buttons one after another (simulator tests).
          if let picks = UserDefaults.standard.string(forKey: "WeKnowPick") {
            // Each pick is an index or the start of a button's label ("I know").
            for pick in picks.split(separator: ",").map(String.init) {
              while !(model.phase == .done && !model.choices.isEmpty) { try? await Task.sleep(for: .milliseconds(300)) }
              try? await Task.sleep(for: .milliseconds(700))
              print("[WeKnow] choices: \(model.choices.map(\.label).joined(separator: " | "))")
              let c = Int(pick).flatMap { model.choices.indices.contains($0) ? model.choices[$0] : nil }
                ?? model.choices.first { $0.label.hasPrefix(pick) }
              if let c { model.choose(c) }
            }
          }
          if let t = UserDefaults.standard.string(forKey: "WeKnowTheme"), let c = ThemeChoice(rawValue: t) { themeRaw = c.rawValue }
        }
    }
  }
}
