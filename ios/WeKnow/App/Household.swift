// What WeKnow keeps, and only on this phone: the checks you made (My checks) and the notes it uses to answer
// better (people you pay). Stored as one JSON file plus small thumbnails in the app's own folder; nothing here is
// ever sent anywhere. Every item can be looked at and deleted, and "Forget everything" deletes it all.

import Foundation
import Observation
import UIKit

struct CheckRecord: Codable, Identifiable, Equatable {
  var id = UUID()
  var date: Date
  var kind: DocKind
  var project: String
  var title: String
  var verdict: String
  var tone: String
  var sentences: [String]
  var onDevice: Bool
  var thumb: String?

  var toneValue: Tone {
    switch tone {
    case "ok": .ok
    case "warn": .warn
    case "stop": .stop
    default: .plain
    }
  }
}

struct PayeeNote: Codable, Identifiable, Equatable {
  var id = UUID()
  var name: String
  var payTo: String
  var since: String
}

@MainActor
@Observable
final class Household {
  static let shared = Household()

  private(set) var checks: [CheckRecord] = []
  private(set) var payees: [PayeeNote] = []

  private struct Saved: Codable {
    var checks: [CheckRecord]
    var payees: [PayeeNote]
  }

  private let folder: URL = {
    let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
    let dir = base.appendingPathComponent("WeKnow", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()

  private var file: URL { folder.appendingPathComponent("household.json") }

  init() {
    if let d = try? Data(contentsOf: file), let s = try? JSONDecoder().decode(Saved.self, from: d) {
      checks = s.checks
      payees = s.payees
    } else {
      // The demo household already pays Riverbend Electric Co-op at an account ending 4821 (UI-SPEC section 13).
      payees = [PayeeNote(name: "Riverbend Electric Co-op", payTo: "4821", since: "October 2026")]
      save()
    }
  }

  var known: [Verdicts.KnownPayee] { payees.map { Verdicts.KnownPayee(name: $0.name, payTo: $0.payTo) } }

  func thumbnail(_ record: CheckRecord) -> UIImage? {
    record.thumb.flatMap { UIImage(contentsOfFile: folder.appendingPathComponent($0).path) }
  }

  func add(_ record: CheckRecord, picture: UIImage?) {
    var r = record
    if let picture, let data = picture.scaled(maxSide: 360).jpegData(compressionQuality: 0.7) {
      let name = "\(r.id.uuidString).jpg"
      try? data.write(to: folder.appendingPathComponent(name), options: .completeFileProtection)
      r.thumb = name
    }
    checks.insert(r, at: 0)
    save()
  }

  func delete(_ record: CheckRecord) {
    if let t = record.thumb { try? FileManager.default.removeItem(at: folder.appendingPathComponent(t)) }
    checks.removeAll { $0.id == record.id }
    save()
  }

  func deleteAllChecks() {
    for c in checks { delete(c) }
  }

  func delete(_ payee: PayeeNote) {
    payees.removeAll { $0.id == payee.id }
    save()
  }

  func forgetEverything() {
    deleteAllChecks()
    payees = []
    save()
  }

  private func save() {
    let data = try? JSONEncoder().encode(Saved(checks: checks, payees: payees))
    try? data?.write(to: file, options: [.atomic, .completeFileProtection])
  }
}

/// Settings kept on this phone (UserDefaults keys shared with Voice and AskModel).
enum Prefs {
  static let voiceOff = "voiceOff"
  static let speed = "voiceSpeedStep" // -1 slower, 0 normal (default), 1 faster
  static let dontKeepChecks = "dontKeepChecks" // stored inverted so the default (false) keeps checks

  /// Multiplier on the system's default speaking rate; normal is 0.92 (UI-SPEC section 9).
  static var rate: Float {
    switch UserDefaults.standard.integer(forKey: speed) {
    case ..<0: 0.80
    case 1...: 1.05
    default: 0.92
    }
  }
}

extension UIImage {
  func scaled(maxSide: CGFloat) -> UIImage {
    let s = min(1, maxSide / max(size.width, size.height))
    guard s < 1 else { return self }
    let target = CGSize(width: size.width * s, height: size.height * s)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in draw(in: CGRect(origin: .zero, size: target)) }
  }
}
