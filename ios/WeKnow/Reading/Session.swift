// Who reads a paper. Always this phone, never the internet:
//  - With Apple Intelligence: Apple's on-device model (FoundationModels SystemLanguageModel) reads the masked words.
//  - Without it: plain code does the basic check of a bill (Core/BasicRead.swift); anything else is not read, and
//    WeKnow says what the full check needs.
// The paper's words and its picture are never sent anywhere to be read. Firebase AI Logic is set up here only for
// the separate online steps that carry a covered question or a company's name (Reading/CloudPick.swift).

import FirebaseAILogic
import FirebaseAppCheck
import FirebaseCore
import Foundation
import CoreGraphics
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
}

/// The cloud model on its own, for the online steps with a covered question (Reading/CloudPick.swift). It is never
/// given a paper to read.
enum FirebaseCloud {
  static var model: some LanguageModel { FirebaseAI.firebaseAI(backend: .googleAI()).geminiLanguageModel(name: Cloud.modelName) }
}

enum Device {
  static var model: SystemLanguageModel { .default }

  /// Testing only: `-WeKnowForceCloud YES` as a launch argument treats this phone as unable to read by itself (as if
  /// it had no Apple Intelligence): papers get the basic check by plain code, and nothing is read anywhere else. The
  /// flag keeps its old name so earlier test scripts still work.
  static var forcedCannotRead: Bool { UserDefaults.standard.bool(forKey: "WeKnowForceCloud") }

  static var canRead: Bool { !forcedCannotRead && model.availability == .available }

  /// The on-device model can be given the photo itself, not only the words read from it.
  static var seesPictures: Bool { canRead && model.capabilities.contains(.vision) }

  /// Why the phone cannot read by itself, in words for Technical details.
  static var status: String {
    if forcedCannotRead { return "Treated as unable to read by itself, for testing (WeKnowForceCloud): basic check only" }
    switch model.availability {
    case .available: return "Available"
    case let .unavailable(reason):
      switch reason {
      case .deviceNotEligible: return "Unavailable: this device cannot run Apple Intelligence"
      case .appleIntelligenceNotEnabled: return "Unavailable: Apple Intelligence is turned off"
      case .modelNotReady: return "Unavailable: Apple Intelligence is still downloading"
      @unknown default: return "Unavailable"
      }
    }
  }

  static func session() -> LanguageModelSession {
    LanguageModelSession(model: model, instructions: Reader.instructions)
  }

  static let engine = "Apple on-device model (FoundationModels SystemLanguageModel)"

  /// Why the full check is missing, in the terms the person can act on.
  private enum Missing { case off, notEligible, notReady }
  private static var missing: Missing {
    if forcedCannotRead { return .off }
    switch model.availability {
    case .available: return .off
    case let .unavailable(reason):
      switch reason {
      case .deviceNotEligible: return .notEligible
      case .appleIntelligenceNotEnabled: return .off
      case .modelNotReady: return .notReady
      @unknown default: return .off
      }
    }
  }

  /// What the full check needs on this phone, in one plain sentence for an answer.
  static var fullCheckNeeds: String {
    switch missing {
    case .off: "For the full check, turn on Apple Intelligence in Settings › Apple Intelligence & Siri."
    case .notEligible: "The full check needs an iPhone or iPad that has Apple Intelligence."
    case .notReady: "The full check needs Apple Intelligence, which is still getting ready on this \(S.device). Try again when it has finished."
    }
  }

  /// The step to take, for "How to get the full check".
  static var fullCheckStep: String {
    switch missing {
    case .off: "Open Settings › Apple Intelligence & Siri, and turn on Apple Intelligence. It downloads what it needs once, best on Wi-Fi."
    case .notEligible: "This \(S.device) can’t run it. An iPhone or iPad that has Apple Intelligence can."
    case .notReady: "It is still getting ready on this \(S.device). Leave it on Wi-Fi and charging for a while."
    }
  }
}

extension Reader {
  /// Read on this phone with Apple's on-device model. There is no other reader: without it, the caller does the basic
  /// check (Core/BasicRead.swift) and never sends the paper anywhere.
  static func read(_ paper: PaperText, image: CGImage? = nil, question: String, matcher: Matcher) async throws -> Reading {
    try await read(
      paper, image: Device.seesPictures ? image : nil, question: question, matcher: matcher, where: .device, engine: Device.engine,
      options: GenerationOptions(samplingMode: .greedy), session: Device.session)
  }
}
