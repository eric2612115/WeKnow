// Which model reads, and how. Routing is explicit and the app always knows where a reading ran:
//  - On this phone: Apple's on-device model (FoundationModels SystemLanguageModel), whenever it is available.
//  - On the internet: Gemini through Firebase AI Logic, plugged into the same LanguageModelSession API
//    (FirebaseAI.geminiLanguageModel, iOS 27), only when the phone cannot read by itself and the person said yes.
// In both cases the model gets the masked words only; the picture never leaves the phone.

import FirebaseAILogic
import FirebaseAppCheck
import FirebaseCore
import Foundation
import FoundationModels

enum Cloud {
  /// The same default as the web app (web/src/firebase.ts): runs on the Gemini Developer API without billing.
  static let modelName = "gemini-3.5-flash-lite"

  static var isConfigured: Bool { FirebaseApp.app() != nil }

  /// Firebase with App Check. The simulator and debug builds use the App Check debug provider (register the token
  /// it prints, or the one in FIRAAppCheckDebugToken, under App Check > Manage debug tokens); release builds use
  /// App Attest. Without a GoogleService-Info.plist the app still reads on the device.
  static func configure() {
    guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
      readerLog.notice("no GoogleService-Info.plist: the internet path is not set up")
      return
    }
    #if DEBUG || targetEnvironment(simulator)
      AppCheck.setAppCheckProviderFactory(AppCheckDebugProviderFactory())
    #else
      AppCheck.setAppCheckProviderFactory(AttestFactory())
    #endif
    FirebaseApp.configure()
  }

  final class AttestFactory: NSObject, AppCheckProviderFactory {
    func createProvider(with app: FirebaseApp) -> (any AppCheckProvider)? { AppAttestProvider(app: app) }
  }

  static func session() -> LanguageModelSession {
    let model = FirebaseAI.firebaseAI(backend: .googleAI()).geminiLanguageModel(name: modelName)
    return LanguageModelSession(model: model, instructions: Reader.instructions)
  }

  static var engine: String { "Gemini (\(modelName)) through Firebase AI Logic" }
}

enum Device {
  static var model: SystemLanguageModel { .default }

  /// Testing only: `-WeKnowForceCloud YES` as a launch argument treats this phone as unable to read by itself.
  static var forcedCloud: Bool { UserDefaults.standard.bool(forKey: "WeKnowForceCloud") }

  static var canRead: Bool { !forcedCloud && model.availability == .available }

  /// Why the phone cannot read by itself, in words for Technical details.
  static var status: String {
    if forcedCloud { return "Treated as unavailable for testing (WeKnowForceCloud)" }
    switch model.availability {
    case .available: return "Available"
    case let .unavailable(reason):
      switch reason {
      case .deviceNotEligible: return "Unavailable: this device cannot run Apple Intelligence"
      case .appleIntelligenceNotEnabled: return "Unavailable: Apple Intelligence is turned off"
      case .modelNotReady: return "Unavailable: the model is still downloading"
      @unknown default: return "Unavailable"
      }
    }
  }

  static func session() -> LanguageModelSession {
    LanguageModelSession(model: model, instructions: Reader.instructions)
  }

  static let engine = "Apple on-device model (FoundationModels SystemLanguageModel)"
}

extension Reader {
  /// Read on this phone, or in the cloud after the person agreed. The caller decides; this never falls back.
  static func read(_ paper: PaperText, question: String, matcher: Matcher, where place: Where) async throws -> Reading {
    switch place {
    case .device:
      return try await read(
        paper, question: question, matcher: matcher, where: .device, engine: Device.engine,
        options: GenerationOptions(samplingMode: .greedy), session: Device.session)
    case .cloud:
      return try await read(
        paper, question: question, matcher: matcher, where: .cloud, engine: Cloud.engine,
        options: GenerationOptions(temperature: 0.1), session: Cloud.session)
    }
  }
}
