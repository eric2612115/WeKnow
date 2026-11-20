// The pages behind the Menu (UI-SPEC 2.3 to 2.5, phone layout): My checks, What WeKnow remembers, Settings.
// Everything shown here lives only on this phone, and every item can be deleted.

import SwiftUI

// MARK: - Shared pieces

private struct PageCard<Content: View>: View {
  @ViewBuilder var content: () -> Content
  var body: some View {
    VStack(alignment: .leading, spacing: 10) { content() }
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(16)
      .background(RoundedRectangle(cornerRadius: 16).fill(Color.card))
      .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.hair, lineWidth: 1))
  }
}

private struct CardTitle: View {
  let text: String
  var body: some View { Text(text).font(.system(size: 21, weight: .bold)).foregroundStyle(Color.ink) }
}

private struct Fine: View {
  let text: String
  var body: some View { Text(text).font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2) }
}

private struct OnlyHere: View {
  let text: String
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Image(systemName: "iphone").font(.system(size: 22, weight: .semibold)).foregroundStyle(Color.go)
      VStack(alignment: .leading, spacing: 4) {
        Text("Only on this \(S.device)").font(.system(size: 19, weight: .bold))
        Text(text).font(.system(size: 17, weight: .medium))
      }
      .foregroundStyle(Color.ink)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(16)
    .background(RoundedRectangle(cornerRadius: 16).fill(Color.okBg))
  }
}

private struct Page<Content: View>: View {
  let title: String
  @ViewBuilder var content: () -> Content
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) { content() }
          .padding(16)
      }
      .background(Color.bg.ignoresSafeArea())
      .navigationTitle(title)
      .navigationBarTitleDisplayMode(title.count > 18 ? .inline : .large)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button("Done") { dismiss() }.font(.system(size: 17, weight: .bold))
        }
      }
    }
  }
}

private let dayFormat: DateFormatter = {
  let f = DateFormatter()
  f.dateFormat = "MMM d"
  return f
}()

// MARK: - My checks

struct ChecksPage: View {
  private var home = Household.shared
  @State private var open: CheckRecord?

  var body: some View {
    Page(title: "My checks") {
      if home.checks.isEmpty {
        PageCard {
          CardTitle(text: "No checks yet")
          Fine(text: "Press Ask and show WeKnow a quote, a bill or a problem. Each answer is kept here, on this \(S.device).")
        }
      }
      ForEach(projects, id: \.self) { project in
        let items = home.checks.filter { $0.project == project }
        PageCard {
          HStack {
            CardTitle(text: project)
            Spacer()
            Text("\(items.count)").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink2)
          }
          ForEach(items) { c in
            Button { open = c } label: { row(c) }.buttonStyle(.plain)
          }
        }
      }
      if !home.checks.isEmpty {
        OnlyHere(text: "Your checks and their pictures are kept on this \(S.device) and nowhere else. Delete any of them in What WeKnow remembers.")
      }
    }
    .sheet(item: $open) { CheckDetail(record: $0) }
  }

  private var projects: [String] {
    var seen: [String] = []
    for c in home.checks where !seen.contains(c.project) { seen.append(c.project) }
    return seen
  }

  private func row(_ c: CheckRecord) -> some View {
    HStack(spacing: 12) {
      Group {
        if let img = home.thumbnail(c) {
          Image(uiImage: img).resizable().scaledToFill()
        } else {
          Color.card2
        }
      }
      .frame(width: 64, height: 48)
      .clipShape(RoundedRectangle(cornerRadius: 8))
      .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.hair, lineWidth: 1))
      VStack(alignment: .leading, spacing: 3) {
        Text(c.title).font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink).lineLimit(2)
        HStack(spacing: 6) {
          Image(systemName: c.toneValue.icon).foregroundStyle(c.toneValue.iconColor)
          Text("\(c.verdict), \(dayFormat.string(from: c.date))").foregroundStyle(Color.ink2)
        }
        .font(.system(size: 15, weight: .medium))
      }
      Spacer(minLength: 0)
      Image(systemName: "chevron.right").foregroundStyle(Color.ink2)
    }
    .contentShape(Rectangle())
    .padding(.vertical, 4)
  }
}

struct CheckDetail: View {
  let record: CheckRecord
  @Environment(\.dismiss) private var dismiss
  @State private var confirm = false

  var body: some View {
    Page(title: record.title) {
      if let img = Household.shared.thumbnail(record) {
        Image(uiImage: img).resizable().scaledToFit()
          .frame(maxWidth: .infinity, maxHeight: 220)
          .clipShape(RoundedRectangle(cornerRadius: 12))
      }
      HStack(spacing: 10) {
        Image(systemName: record.toneValue.icon).foregroundStyle(record.toneValue.iconColor)
        Text(record.verdict).font(.system(size: 22, weight: .bold)).foregroundStyle(record.toneValue.textColor)
      }
      .padding(.horizontal, 14).padding(.vertical, 10)
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(RoundedRectangle(cornerRadius: 12).fill(record.toneValue.band))
      VStack(alignment: .leading, spacing: 8) {
        ForEach(Array(record.sentences.enumerated()), id: \.offset) { _, s in
          Text(s).font(.system(size: 19, weight: .medium)).foregroundStyle(Color.ink)
        }
      }
      Fine(text: (record.onDevice ? "Worked out on this \(S.device). Nothing left it." : "Checked on the internet with your details covered.")
        + " \(record.project), \(dayFormat.string(from: record.date)).")
      Button(role: .destructive) { confirm = true } label: {
        Label("Delete this check", systemImage: "trash").font(.system(size: 17, weight: .bold))
      }
      .confirmationDialog("Delete this check?", isPresented: $confirm, titleVisibility: .visible) {
        Button("Delete", role: .destructive) {
          Household.shared.delete(record)
          dismiss()
        }
      } message: {
        Text("It is removed from this \(S.device). This can’t be undone.")
      }
    }
  }
}

// MARK: - What WeKnow remembers

struct RemembersPage: View {
  private var home = Household.shared
  @AppStorage(Prefs.dontKeepChecks) private var dontKeep = false
  @State private var forget = false
  @State private var clearChecks = false

  var body: some View {
    Page(title: "What WeKnow remembers") {
      OnlyHere(text: "WeKnow keeps these notes on this \(S.device) and nowhere else. Not in an account. Not on the internet. It uses them to give you better answers.")
      PageCard {
        CardTitle(text: "People you pay")
        if home.payees.isEmpty {
          Fine(text: "Nothing yet. When a bill asks you to pay someone new, WeKnow says so.")
        }
        ForEach(home.payees) { p in
          HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 2) {
              Text(p.name).font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
              Fine(text: "Account ending \(p.payTo). Paid \(p.since).")
            }
            Spacer()
            Button(role: .destructive) { home.delete(p) } label: {
              Text("Delete").font(.system(size: 15, weight: .bold))
            }
            .buttonStyle(.bordered)
          }
        }
      }
      PageCard {
        CardTitle(text: "Your checks")
        Fine(text: home.checks.isEmpty ? "None kept." : "\(home.checks.count) kept, with their pictures. Open My checks to see each one.")
        Toggle(isOn: Binding(get: { !dontKeep }, set: { dontKeep = !$0 })) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Keep my checks").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink)
            Fine(text: "Off: WeKnow answers and keeps nothing new.")
          }
        }
        .tint(Color.go)
        if !home.checks.isEmpty {
          Button(role: .destructive) { clearChecks = true } label: {
            Label("Delete all checks", systemImage: "trash").font(.system(size: 17, weight: .bold))
          }
          .confirmationDialog("Delete all \(home.checks.count) checks?", isPresented: $clearChecks, titleVisibility: .visible) {
            Button("Delete all checks", role: .destructive) { home.deleteAllChecks() }
          }
        }
      }
      PageCard {
        CardTitle(text: "Forget everything")
        Fine(text: "Deletes every note and every check on this \(S.device). Your settings stay.")
        Button(role: .destructive) { forget = true } label: {
          Text("Forget everything").font(.system(size: 17, weight: .bold)).frame(maxWidth: .infinity, minHeight: 48)
        }
        .buttonStyle(.bordered)
        .confirmationDialog("Forget everything?", isPresented: $forget, titleVisibility: .visible) {
          Button("Forget everything", role: .destructive) { home.forgetEverything() }
        } message: {
          Text("WeKnow deletes its notes and your checks from this \(S.device). This can’t be undone.")
        }
      }
    }
  }
}

// MARK: - Settings

struct SettingsPage: View {
  @Binding var theme: ThemeChoice
  @Bindable var model: AskModel
  @AppStorage(Prefs.voiceOff) private var voiceOff = false
  @AppStorage(Prefs.speed) private var speed = 0
  @State private var showBook = false
  @AppStorage(Prefs.internet) private var internet = ""

  var body: some View {
    Page(title: "Settings") {
      PageCard {
        CardTitle(text: "Using the internet")
        Picker("Use the internet", selection: $internet) {
          Text("When it helps").tag("auto")
          Text("Ask me every time").tag("every")
          Text("Never").tag("never")
          if internet.isEmpty { Text("Ask me the first time").tag("") }
        }
        .pickerStyle(.inline)
        .labelsHidden()
        Fine(text: "Your papers are read on this \(S.device) and never sent anywhere. When it can’t answer a question, WeKnow can look it up online. Only covered words go, and every answer shows what went.")
      }
      PageCard {
        CardTitle(text: "Voice")
        Toggle(isOn: Binding(get: { !voiceOff }, set: { voiceOff = !$0 })) {
          VStack(alignment: .leading, spacing: 2) {
            Text("Speak the answers").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink)
            Fine(text: "Off shows the words only.")
          }
        }
        .tint(Color.go)
        Picker("Speed", selection: $speed) {
          Text("Slower").tag(-1)
          Text("Normal").tag(0)
          Text("Faster").tag(1)
        }
        .pickerStyle(.segmented)
        HStack {
          VStack(alignment: .leading, spacing: 2) {
            Text("Voice").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink)
            Fine(text: Voice.shared.voiceLabel)
          }
          Spacer()
          Button("Hear it") {
            Task { await Voice.shared.say("Hello. I read papers here, on this phone.") }
          }
          .buttonStyle(.bordered)
          .disabled(voiceOff)
        }
        Fine(text: "For a more natural voice, download one in Settings › Accessibility › Read & Speak › Voices › English (for example Zoe or Ava, Premium). WeKnow picks it up the next time it opens.")
      }
      PageCard {
        CardTitle(text: "Screen")
        Picker("Light or dark", selection: $theme) {
          ForEach(ThemeChoice.allCases) { Text($0.rawValue).tag($0) }
        }
        .pickerStyle(.segmented)
      }
      PageCard {
        CardTitle(text: "Privacy")
        Label("Stays on this \(S.device)", systemImage: "iphone").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.go)
        Fine(text: "Your pictures. Names, phone numbers, addresses, plates and account numbers. Your notes and checks.")
        Label("May leave, with your details covered", systemImage: "globe").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.net)
        Fine(text: "A question this \(S.device) can’t answer. For a bill from a company you never paid: its name and the names of its charges, after you say yes. Never your paper or your picture.")
      }
      PageCard {
        CardTitle(text: "How this \(S.device) reads")
        Fine(text: Device.canRead
          ? "Papers are read here with Apple Intelligence: the full check."
          : "Papers are checked here by plain rules: the basic check of a bill. \(Device.fullCheckNeeds)")
        Fine(text: "Status: \(Device.status)")
        Button { showBook = true } label: {
          HStack {
            VStack(alignment: .leading, spacing: 2) {
              Text("Knowledge packs").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink)
              Fine(text: "\(model.packVersion). See what is on this \(S.device), how much space it uses, and add or remove sections.")
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Color.ink2)
          }
        }
      }
    }
    .sheet(isPresented: $showBook) { PriceBookPage(model: model) }
  }
}

// MARK: - Price book (the knowledge pack on this phone)

struct PriceBookPage: View {
  @Bindable var model: AskModel
  private var know = Knowledge.shared
  @State private var search = ""
  @State private var open: PriceItem?
  @State private var openGuide: Guide?
  @State private var removing: (pack: String, category: String)?

  init(model: AskModel) { self.model = model }

  private var packIDs: [String] {
    let fromCatalog = know.catalog.map(\.id)
    let local = Set(know.installed.values.map(\.pack) + [know.builtInPackID].compactMap { $0 })
    return fromCatalog + local.subtracting(fromCatalog).sorted()
  }

  var body: some View {
    Page(title: "Knowledge packs") {
      PageCard {
        HStack(alignment: .firstTextBaseline) {
          CardTitle(text: "On this \(S.device)")
          Spacer()
          Text(Knowledge.bytes(know.totalBytes)).font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
        }
        Fine(text: "\(know.installed.count) sections installed. WeKnow answers only from these, and they work with no internet.")
        if let p = model.pack { Fine(text: "\(p.prices.count) prices and \(p.guides.count) how-to guides, each with a source.") }
        if !know.loadedCatalog {
          HStack(spacing: 8) { ProgressView(); Fine(text: "Looking for packs…") }
        }
        if let e = know.lastError { Fine(text: e) }
        Fine(text: "Downloading fetches the published files. Nothing about you is sent.")
      }
      ForEach(packIDs, id: \.self) { id in packCard(id) }
      if know.installed.isEmpty {
        Button { know.installBuiltIn() } label: {
          Label("Put back the built-in packs", systemImage: "arrow.uturn.backward").font(.system(size: 17, weight: .bold))
        }
        .buttonStyle(.bordered)
      }
      if let pack = model.pack {
        TextField("Search, for example “brake pads”", text: $search)
          .font(.system(size: 17, weight: .medium))
          .padding(12)
          .background(RoundedRectangle(cornerRadius: 12).fill(Color.card))
          .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.hair, lineWidth: 1))
        PageCard {
          CardTitle(text: "Prices")
          ForEach(filtered(pack.prices).prefix(40)) { item in
            Button { open = item } label: {
              HStack {
                Text(item.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                Spacer()
                Text("\(S.money(item.low))–\(S.money(item.high))").font(.system(size: 15, weight: .medium)).foregroundStyle(Color.ink2)
              }
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
          }
        }
        PageCard {
          CardTitle(text: "How-to guides")
          ForEach(filteredGuides(pack.guides).prefix(30)) { g in
            Button { openGuide = g } label: {
              HStack {
                Text(g.name).font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Color.ink2)
              }
              .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
          }
        }
      }
    }
    .task { if !know.loadedCatalog { await know.refreshCatalog() } }
    .refreshable { await know.refreshCatalog() }
    .confirmationDialog(
      "Remove \(removing.map { Knowledge.name($0.category) } ?? "")?",
      isPresented: Binding(get: { removing != nil }, set: { if !$0 { removing = nil } }), titleVisibility: .visible
    ) {
      Button("Remove", role: .destructive) {
        if let r = removing { know.remove(r.pack, r.category) }
        removing = nil
      }
    } message: {
      Text("WeKnow will not know these prices and guides until you download them again.")
    }
    .sheet(item: $open) { PriceDetail(item: $0) }
    .sheet(item: $openGuide) { GuideDetail(guide: $0) }
  }

  @ViewBuilder private func packCard(_ id: String) -> some View {
    let meta = know.catalog.first { $0.id == id }
    let root = know.roots[id]
    PageCard {
      CardTitle(text: Knowledge.packName(id))
      if let meta {
        Fine(text: "English · US dollars · version \(meta.dataAsOf ?? meta.version) · \(meta.counts.prices) prices, \(meta.counts.guides) guides · \(Knowledge.bytes(meta.bytes)) in all")
      }
      ForEach(know.categories(of: id)) { c in
        let k = know.key(id, c.id)
        HStack(alignment: .center, spacing: 10) {
          VStack(alignment: .leading, spacing: 2) {
            Text(Knowledge.name(c.id)).font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink)
            Fine(text: "\(c.prices) prices · \(c.guides) guides")
            if know.isInstalled(id, c.id) {
              Label("On this \(S.device), \(Knowledge.bytes(know.size(id, c.id) ?? 0))", systemImage: "checkmark.circle.fill")
                .font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.go)
            }
          }
          Spacer(minLength: 4)
          if know.busy.contains(k) {
            ProgressView()
          } else if know.isInstalled(id, c.id) {
            if know.needsUpdate(id, c.id) {
              Button("Update") { Task { await know.download(id, c.id) } }.buttonStyle(.bordered)
                .accessibilityLabel("Update \(Knowledge.name(c.id))")
            }
            Button("Remove", role: .destructive) { removing = (id, c.id) }.buttonStyle(.bordered)
              .accessibilityLabel("Remove \(Knowledge.name(c.id))")
          } else {
            Button {
              Task { await know.download(id, c.id) }
            } label: {
              Text(root.map { "Get \(Knowledge.bytes($0.downloadBytes(c.id)))" } ?? "Get")
            }
            .buttonStyle(.borderedProminent).tint(Color.go)
            .accessibilityLabel("Get \(Knowledge.name(c.id))")
          }
        }
        .padding(.vertical, 4)
      }
    }
  }

  private func matches(_ name: String, _ aliases: [String]) -> Bool {
    let q = search.trimmingCharacters(in: .whitespaces).lowercased()
    return q.isEmpty || name.lowercased().contains(q) || aliases.contains { $0.lowercased().contains(q) }
  }
  private func filtered(_ items: [PriceItem]) -> [PriceItem] { items.filter { matches($0.name, $0.aliases) } }
  private func filteredGuides(_ items: [Guide]) -> [Guide] { items.filter { matches($0.name, $0.aliases) } }
}

private struct SourcesList: View {
  let sources: [Source]
  var body: some View {
    PageCard {
      CardTitle(text: "Where this comes from")
      ForEach(sources, id: \.self) { s in
        VStack(alignment: .leading, spacing: 4) {
          if let u = URL(string: s.url) {
            Link(s.title ?? u.host() ?? s.url, destination: u).font(.system(size: 17, weight: .bold))
          }
          if let q = s.quote { Fine(text: "“\(q)”") }
          if let f = s.fetched { Fine(text: "Checked \(S.longDate(f))") }
        }
      }
    }
  }
}

struct PriceDetail: View {
  let item: PriceItem
  var body: some View {
    Page(title: item.name) {
      PageCard {
        CardTitle(text: "Usual price")
        Fine(text: "Low \(S.money(item.low)) · most shops \(S.money(item.typical)) · top \(S.money(item.high)), \(item.unit)")
        if let inc = item.includes { Fine(text: "Includes: \(inc)") }
        Fine(text: "WeKnow calls a line high only when it is above the top price.")
      }
      SourcesList(sources: item.sources)
    }
  }
}

struct GuideDetail: View {
  let guide: Guide
  var body: some View {
    Page(title: guide.name) {
      PageCard {
        CardTitle(text: "Steps")
        ForEach(Array(guide.steps.enumerated()), id: \.offset) { i, s in
          Text("\(i + 1). \(s)").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink)
        }
      }
      if let stop = guide.stopIf, !stop.isEmpty {
        PageCard {
          CardTitle(text: "Stop and call a pro if")
          ForEach(stop, id: \.self) { Fine(text: "• \($0)") }
        }
      }
      SourcesList(sources: guide.sources)
    }
  }
}
