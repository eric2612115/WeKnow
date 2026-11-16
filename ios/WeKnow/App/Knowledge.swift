// Knowledge packs on this phone, managed like the system's language downloads: see every pack and section the
// web app publishes, how big each one is, which are on this phone and how much space they use, and download or
// remove each section. The layers are the web app's own (web/public/packs): catalog.json lists packs; each
// pack's root lists its categories and their shards; each shard points at content-hashed data blocks.
//
// The app answers only from sections that are installed. On first launch every section is installed from the copy
// built into the app, so it works in airplane mode from the start. Downloading fetches published files only;
// nothing about the person is sent.

import Foundation
import Observation

struct CatalogPack: Codable, Identifiable, Sendable {
  var id: String
  var region: String
  var language: String
  var currency: String
  var version: String
  var dataAsOf: String?
  var root: String
  var bytes: Int
  struct Counts: Codable, Sendable { var prices: Int; var guides: Int }
  var counts: Counts
}

struct PackRoot: Codable, Sendable {
  struct Category: Codable, Sendable, Identifiable { var id: String; var prices: Int; var guides: Int }
  struct Block: Codable, Sendable { var file: String; var bytes: Int; var count: Int }
  struct Shard: Codable, Sendable { var id: String; var category: String; var kind: String; var count: Int; var file: String; var bytes: Int; var blocks: [Block] }
  var id: String
  var version: String
  var categories: [Category]
  var shards: [Shard]

  func downloadBytes(_ category: String) -> Int {
    shards.filter { $0.category == category }.flatMap(\.blocks).map(\.bytes).reduce(0, +)
  }
}

/// One installed section of a pack (for example "Plumbing" of "us-home"), as stored on this phone.
struct InstalledSection: Codable, Sendable {
  var pack: String
  var category: String
  var version: String
  var prices: [PriceItem]
  var guides: [Guide]
}

@MainActor
@Observable
final class Knowledge {
  static let shared = Knowledge()
  static let base = URL(string: "https://weknow-6092f.web.app/packs/")!

  /// Sections on this phone, keyed "pack/category".
  private(set) var installed: [String: InstalledSection] = [:]
  private(set) var sizes: [String: Int] = [:]
  private(set) var catalog: [CatalogPack] = []
  private(set) var roots: [String: PackRoot] = [:]
  private(set) var busy: Set<String> = []
  private(set) var lastError: String?
  private(set) var loadedCatalog = false

  private let folder: URL = {
    let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("WeKnow/packs", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }()

  init() {
    scan()
    if installed.isEmpty && !UserDefaults.standard.bool(forKey: "packs.seeded") {
      installBuiltIn()
      UserDefaults.standard.set(true, forKey: "packs.seeded")
    }
  }

  // MARK: What the app answers from

  /// The pack the reader uses: every installed section merged. Nil when nothing is installed.
  var active: Pack? {
    guard !installed.isEmpty else { return nil }
    let secs = installed.values.sorted { $0.category < $1.category }
    let version = secs.map(\.version).max() ?? ""
    return Pack(id: "us-home", version: version, region: "US", currency: "USD",
                prices: secs.flatMap(\.prices), guides: secs.flatMap(\.guides))
  }

  /// Changes whenever the installed set changes, so the matcher is rebuilt.
  var signature: String { installed.keys.sorted().map { "\($0)@\(installed[$0]!.version)" }.joined(separator: ",") }

  var totalBytes: Int { sizes.values.reduce(0, +) }

  func key(_ pack: String, _ category: String) -> String { "\(pack)/\(category)" }
  func isInstalled(_ pack: String, _ category: String) -> Bool { installed[key(pack, category)] != nil }
  func size(_ pack: String, _ category: String) -> Int? { sizes[key(pack, category)] }

  /// Categories to show for a pack: from its published root when online, otherwise from what is installed.
  func categories(of pack: String) -> [PackRoot.Category] {
    if let r = roots[pack] { return r.categories }
    return installed.values.filter { $0.pack == pack }.sorted { $0.category < $1.category }
      .map { PackRoot.Category(id: $0.category, prices: $0.prices.count, guides: $0.guides.count) }
  }

  func needsUpdate(_ pack: String, _ category: String) -> Bool {
    guard let have = installed[key(pack, category)], let root = roots[pack] else { return false }
    // The copy built into the app carries the date only ("2026-11-16"); the published root adds a content hash.
    return have.version != root.version && !root.version.hasPrefix(have.version + ".")
  }

  // MARK: Catalog

  func refreshCatalog() async {
    lastError = nil
    do {
      struct Catalog: Codable { var packs: [CatalogPack] }
      let c = try JSONDecoder().decode(Catalog.self, from: try await fetch("catalog.json"))
      var rs: [String: PackRoot] = [:]
      for p in c.packs { rs[p.id] = try JSONDecoder().decode(PackRoot.self, from: try await fetch(p.root)) }
      catalog = c.packs
      roots = rs
    } catch {
      lastError = "Couldn’t reach the internet to see other packs. The packs on this \(S.device) still work."
    }
    loadedCatalog = true
  }

  // MARK: Download, remove

  func download(_ pack: String, _ category: String) async {
    let k = key(pack, category)
    guard let root = roots[pack] else { return }
    busy.insert(k)
    defer { busy.remove(k) }
    do {
      var prices: [PriceItem] = []
      var guides: [Guide] = []
      struct Block: Codable { var prices: [PriceItem]?; var guides: [Guide]? }
      for shard in root.shards where shard.category == category {
        for b in shard.blocks {
          let block = try JSONDecoder().decode(Block.self, from: try await fetch("\(pack)/\(b.file)"))
          prices += block.prices ?? []
          guides += block.guides ?? []
        }
      }
      try save(InstalledSection(pack: pack, category: category, version: root.version, prices: prices, guides: guides))
      lastError = nil
    } catch {
      lastError = "Couldn’t download \(Self.name(category)). Nothing was changed."
    }
  }

  func remove(_ pack: String, _ category: String) {
    let k = key(pack, category)
    try? FileManager.default.removeItem(at: file(pack, category))
    installed[k] = nil
    sizes[k] = nil
  }

  /// Puts every section back from the copy built into the app (no internet needed).
  func installBuiltIn() {
    guard let url = Bundle.main.url(forResource: "us-home", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let p = try? JSONDecoder().decode(Pack.self, from: data) else { return }
    let cats = Set(p.prices.compactMap(\.category) + p.guides.compactMap(\.category))
    for c in cats {
      try? save(InstalledSection(pack: p.id, category: c, version: p.version,
                                 prices: p.prices.filter { $0.category == c }, guides: p.guides.filter { $0.category == c }))
    }
  }

  // MARK: Files

  private func file(_ pack: String, _ category: String) -> URL {
    folder.appendingPathComponent("\(pack).\(category).json")
  }

  private func save(_ s: InstalledSection) throws {
    let url = file(s.pack, s.category)
    try JSONEncoder().encode(s).write(to: url, options: .atomic)
    let k = key(s.pack, s.category)
    installed[k] = s
    sizes[k] = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
  }

  private func scan() {
    let files = (try? FileManager.default.contentsOfDirectory(at: folder, includingPropertiesForKeys: [.fileSizeKey])) ?? []
    for url in files where url.pathExtension == "json" {
      guard let s = try? JSONDecoder().decode(InstalledSection.self, from: Data(contentsOf: url)) else { continue }
      let k = key(s.pack, s.category)
      installed[k] = s
      sizes[k] = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    }
  }

  private func fetch(_ path: String) async throws -> Data {
    var req = URLRequest(url: Self.base.appendingPathComponent(path))
    req.cachePolicy = .reloadIgnoringLocalCacheData
    let (data, resp) = try await URLSession.shared.data(for: req)
    guard (resp as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
    return data
  }

  // MARK: Words

  static func name(_ category: String) -> String {
    switch category {
    case "plumbing": "Plumbing"
    case "appliance": "Home appliances"
    case "electrical": "Electrical"
    case "home": "House and yard"
    case "device": "Phones and computers"
    case "cleaning": "Cleaning"
    case "car-service": "Car service"
    case "car-body": "Car body and glass"
    case "locksmith": "Locks and keys"
    default: category.replacingOccurrences(of: "-", with: " ").capitalizedFirst
    }
  }

  static func packName(_ id: String) -> String { id == "us-home" ? "US home and car" : id }

  static func bytes(_ n: Int) -> String {
    ByteCountFormatter.string(fromByteCount: Int64(n), countStyle: .file)
  }
}
