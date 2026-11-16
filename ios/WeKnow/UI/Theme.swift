// Colour tokens from design/UI-SPEC.md section 5, light and dark. Marks on the picture use the fixed colours the
// spec gives for both themes.

import SwiftUI
import UIKit

extension Color {
  private static func token(_ light: UInt32, _ dark: UInt32) -> Color {
    Color(UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
  }

  static let bg = token(0xFFFFFF, 0x0F1110)
  static let card = token(0xFFFFFF, 0x141917)
  static let card2 = token(0xF1F3F2, 0x1F2321)
  static let ink = token(0x0F1A15, 0xF1F5F3)
  static let ink2 = token(0x46534D, 0xAEB9B3)
  static let hair = token(0xE6E9E7, 0x2A2F2D)
  static let line = token(0x77847D, 0x6E7B75)
  static let go = token(0x075C3D, 0x3ECF92)
  static let goDeep = token(0x043C28, 0x1F8F62)
  static let onGo = token(0xFFFFFF, 0x0B0E0D)
  static let okBg = token(0xE3F4EA, 0x10301F)
  static let warnBg = token(0xFFEFC2, 0x392900)
  static let warnInk = token(0x4A3000, 0xFFD877)
  static let warnLine = token(0x8A5600, 0xE3A800)
  static let stop = token(0xA8201A, 0xFF8D7E)
  static let stopBg = token(0xFDE7E3, 0x3A1411)
  static let net = token(0x1849A9, 0xA6C6FF)
  static let netBg = token(0xE7EEFD, 0x12254A)
  static let key = token(0x0F1A15, 0xF1F5F3)
  static let onKey = token(0xFFFFFF, 0x0B0E0D)

  // Marks on the picture: the same in both themes.
  static let markCover = Color(UIColor(hex: 0x14211C))
  static let markTick = Color(UIColor(hex: 0x0A7A4F))
  static let markAmber = Color(UIColor(hex: 0xB86E00))
  static let markBlue = Color(UIColor(hex: 0x1849A9))
  static let markRed = Color(UIColor(hex: 0xB3261E))
}

extension UIColor {
  convenience init(hex: UInt32) {
    self.init(
      red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255,
      blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
  }
}

enum ThemeChoice: String, CaseIterable, Identifiable {
  case light = "Light", dark = "Dark", system = "System"
  var id: String { rawValue }
  var scheme: ColorScheme? {
    switch self {
    case .light: .light
    case .dark: .dark
    case .system: nil
    }
  }
}

extension Tone {
  var band: Color {
    switch self {
    case .ok: .okBg
    case .warn: .warnBg
    case .stop: .stopBg
    case .plain: .clear
    }
  }
  var textColor: Color { self == .warn ? .warnInk : .ink }
  var icon: String {
    switch self {
    case .ok: "checkmark.circle.fill"
    case .warn: "exclamationmark.triangle.fill"
    case .stop: "octagon.fill"
    case .plain: "text.bubble"
    }
  }
  var iconColor: Color {
    switch self {
    case .ok: .go
    case .warn: .warnLine
    case .stop: .stop
    case .plain: .ink2
    }
  }
}

/// The spec's one easing: quick out, soft landing.
extension Animation {
  static func weknow(_ seconds: Double) -> Animation { .timingCurve(0.2, 0.8, 0.2, 1, duration: seconds) }
}
