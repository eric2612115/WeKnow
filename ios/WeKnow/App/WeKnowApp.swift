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
          // For recordings and screenshots: `-WeKnowSample quote` or `-WeKnowSample bill` starts that sample.
          if let id = UserDefaults.standard.string(forKey: "WeKnowSample"), let s = Sample.all.first(where: { $0.id == id }) {
            try? await Task.sleep(for: .milliseconds(600))
            model.start(s)
          }
          if let t = UserDefaults.standard.string(forKey: "WeKnowTheme"), let c = ThemeChoice(rawValue: t) { themeRaw = c.rawValue }
        }
    }
  }
}
