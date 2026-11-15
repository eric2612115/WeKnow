// Knowledge packs: sourced data the answers must come from (port of web/src/core/packs.ts).
// The app bundles the same us-home.json the web app ships (web/public/packs), so both answer from one pack.
// The model may only point at an item by `ref`; every number shown to the person comes from here.

import Foundation

struct Source: Codable, Sendable, Hashable {
  var url: String
  var title: String?
  var quote: String?
  var fetched: String?
}

struct PriceItem: Codable, Sendable, Hashable, Identifiable {
  var ref: String
  var category: String?
  var name: String
  var aliases: [String]
  var unit: String
  var low: Double
  var typical: Double
  var high: Double
  var includes: String?
  var sources: [Source]
  var id: String { ref }
}

struct Guide: Codable, Sendable, Hashable, Identifiable {
  var ref: String
  var category: String?
  var name: String
  var aliases: [String]
  var minutes: [Double]
  var difficulty: Double?
  var steps: [String]
  var safety: [String]?
  var stopIf: [String]?
  var proRefs: [String]?
  var sources: [Source]
  var id: String { ref }
}

struct Pack: Codable, Sendable {
  var id: String
  var version: String
  var region: String
  var currency: String
  var prices: [PriceItem]
  var guides: [Guide]

  func price(_ ref: String) -> PriceItem? { prices.first { $0.ref == ref } }
  func guide(_ ref: String) -> Guide? { guides.first { $0.ref == ref } }

  /// The pack bundled with the app (a copy of web/public/packs/us-home.json at build time).
  static func bundled(_ bundle: Bundle = .main) throws -> Pack {
    guard let url = bundle.url(forResource: "us-home", withExtension: "json") else {
      throw CocoaError(.fileNoSuchFile)
    }
    return try JSONDecoder().decode(Pack.self, from: Data(contentsOf: url))
  }
}
