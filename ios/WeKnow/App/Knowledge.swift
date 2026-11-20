// Knowledge packs on this phone, managed like the system's language downloads: see every pack and section the
// web app publishes, how big each one is, which are on this phone and how much space they use, and download or
// remove each section. The layers are the web app's own (web/public/packs): catalog.json lists packs; each
// pack's root lists its categories and their shards; each shard points at content-hashed data blocks.
//
// The app answers only from sections that are installed. On first launch every section is installed from the copy
// built into the app, so it works in airplane mode from the start. Downloading fetches published files only;
// nothing about the person is sent. Every file below the catalog is named by its content hash (the first 16 hex
// digits of the SHA-256 of its bytes, web/src/core/packFormat.ts), and a downloaded file that does not match its
// name is thrown away, never installed.

import CryptoKit
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

  /// Categories to show for a pack: from its published root when online, otherwise what is installed plus what
  /// the copy built into the app holds (so a removed section can be put back with no internet).
  func categories(of pack: String) -> [PackRoot.Category] {
    if let r = roots[pack] { return r.categories }
    var cats = installed.values.filter { $0.pack == pack }
      .map { PackRoot.Category(id: $0.category, prices: $0.prices.count, guides: $0.guides.count) }
    if let b = Self.builtIn, b.pack.id == pack {
      for c in Self.categories(of: b.pack) where !cats.contains(where: { $0.id == c }) {
        cats.append(PackRoot.Category(id: c, prices: b.pack.prices.filter { $0.category == c }.count,
                                      guides: b.pack.guides.filter { $0.category == c }.count))
      }
    }
    return cats.sorted { $0.id < $1.id }
  }

  /// The pack built into the app, listed even when every one of its sections was removed.
  var builtInPackID: String? { Self.builtIn?.pack.id }

  /// The published root's version is its date and a hash of its content ("2026-11-16.20e72c4a"); a section keeps
  /// the version it was installed from. Any difference is an update, even a new publish on the same date.
  func needsUpdate(_ pack: String, _ category: String) -> Bool {
    guard let have = installed[key(pack, category)], let root = roots[pack] else { return false }
    return have.version != root.version
  }

  // MARK: Catalog

  func refreshCatalog() async {
    lastError = nil
    do {
      struct Catalog: Codable { var packs: [CatalogPack] }
      let c = try JSONDecoder().decode(Catalog.self, from: try await fetch("catalog.json"))
      var rs: [String: PackRoot] = [:]
      for p in c.packs { rs[p.id] = try JSONDecoder().decode(PackRoot.self, from: try await fetchChecked(p.root)) }
      catalog = c.packs
      roots = rs
    } catch is PackFileError {
      lastError = "A published file did not match what it should be, so it was not used. The packs on this \(S.device) still work."
    } catch {
      lastError = "Couldn’t reach the internet to see other packs. The packs on this \(S.device) still work."
    }
    loadedCatalog = true
  }

  // MARK: Download, remove

  func download(_ pack: String, _ category: String) async {
    let k = key(pack, category)
    busy.insert(k)
    defer { busy.remove(k) }
    // No list of what is published yet (never loaded, or loaded with no internet): one more try first.
    if roots[pack] == nil { await refreshCatalog() }
    guard let root = roots[pack] else {
      // Still none: no internet. A section that is not on this phone comes back from the copy built into the app.
      let back = !isInstalled(pack, category) && putBack(pack, category)
      lastError = back
        ? "No internet, so the copy built into the app was put back. Try again when you are online."
        : "No internet. Try again when you are online."
      return
    }
    do {
      var prices: [PriceItem] = []
      var guides: [Guide] = []
      struct Block: Codable { var prices: [PriceItem]?; var guides: [Guide]? }
      for shard in root.shards where shard.category == category {
        for b in shard.blocks {
          let block = try JSONDecoder().decode(Block.self, from: try await fetchChecked("\(pack)/\(b.file)"))
          prices += block.prices ?? []
          guides += block.guides ?? []
        }
      }
      try save(InstalledSection(pack: pack, category: category, version: root.version, prices: prices, guides: guides))
      lastError = nil
    } catch let e as PackFileError {
      print("[WeKnow] knowledge download refused: \(e)")
      lastError = "Couldn’t download \(Self.name(category)): a file did not match what was published. Nothing was changed."
    } catch {
      lastError = Self.isOffline(error)
        ? "No internet. Try again when you are online."
        : "Couldn’t download \(Self.name(category)). Nothing was changed."
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
    guard let b = Self.builtIn else { return }
    for c in Self.categories(of: b.pack) { _ = putBack(b.pack.id, c) }
  }

  /// Puts one section back from the copy built into the app. False when the app has no such section.
  private func putBack(_ pack: String, _ category: String) -> Bool {
    guard let b = Self.builtIn, b.pack.id == pack, Self.categories(of: b.pack).contains(category) else { return false }
    do {
      try save(InstalledSection(pack: pack, category: category, version: b.version,
                                prices: b.pack.prices.filter { $0.category == category },
                                guides: b.pack.guides.filter { $0.category == category }))
      return true
    } catch {
      return false
    }
  }

  /// The copy built into the app (web/public/packs/us-home.json) and the published version it was built with: the
  /// catalog bundled beside it names the root of the same build ("2026-11-16.20e72c4a"), so a section put back from
  /// it compares exactly with what is published. Without that catalog, the date alone (one extra Update at most).
  private static let builtIn: (pack: Pack, version: String)? = {
    guard let url = Bundle.main.url(forResource: "us-home", withExtension: "json"),
          let data = try? Data(contentsOf: url),
          let p = try? JSONDecoder().decode(Pack.self, from: data) else { return nil }
    struct Catalog: Codable { var packs: [CatalogPack] }
    let published = Bundle.main.url(forResource: "catalog", withExtension: "json")
      .flatMap { try? Data(contentsOf: $0) }
      .flatMap { try? JSONDecoder().decode(Catalog.self, from: $0) }?
      .packs.first { $0.id == p.id && $0.dataAsOf == p.version }?.version
    return (p, published ?? p.version)
  }()

  private static func categories(of p: Pack) -> [String] {
    Set(p.prices.compactMap(\.category) + p.guides.compactMap(\.category)).sorted()
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

  enum PackFileError: Error { case unhashed(String), mismatch(String) }

  /// A file below the catalog, kept only when its bytes hash to the name it was published under
  /// ("d/plumbing.price.0.5fdcd496456b9633.json": the first 16 hex digits of the SHA-256 of the file).
  private func fetchChecked(_ path: String) async throws -> Data {
    guard let m = path.firstMatch(of: /\.([0-9a-f]{16})\.json$/) else { throw PackFileError.unhashed(path) }
    let data = try await fetch(path)
    let hex = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
    guard hex.prefix(16) == m.1 else { throw PackFileError.mismatch(path) }
    return data
  }

  private static func isOffline(_ error: Error) -> Bool {
    guard let e = error as? URLError else { return false }
    return [.notConnectedToInternet, .networkConnectionLost, .cannotFindHost, .cannotConnectToHost, .timedOut,
            .dataNotAllowed, .internationalRoamingOff].contains(e.code)
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
