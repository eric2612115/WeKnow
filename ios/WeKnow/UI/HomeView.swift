// The Ask page, phone layout (UI-SPEC 2.2): the window, the words under it, one large button.

import PhotosUI
import SwiftUI

enum MenuPage: String, Identifiable {
  case checks, remembers, priceBook, settings
  var id: String { rawValue }
}

struct HomeView: View {
  @Bindable var model: AskModel
  @Binding var theme: ThemeChoice
  @State private var picking = false
  @State private var page: MenuPage?
  @State private var words: WordsWay?
  @AppStorage(Prefs.voiceOff) private var voiceOff = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  enum WordsWay: String, Identifiable { case type, speak; var id: String { rawValue } }

  private var answering: Bool { model.phase != .ready || model.picture != nil }

  var body: some View {
    GeometryReader { geo in
      VStack(spacing: 12) {
        appBar
        PictureWindow(model: model, reduceMotion: reduceMotion)
          .frame(height: geo.size.height * (model.verdict == nil ? 0.5 : 0.3))
          .animation(.weknow(0.32), value: model.verdict == nil)
        WordsArea(model: model)
          .frame(maxHeight: .infinity, alignment: .top)
        HStack(alignment: .center, spacing: 0) {
          SideButton(icon: "keyboard", label: "Type", id: "type") { words = .type }
            .frame(maxWidth: .infinity)
          AskButton(phase: model.phase) {
            switch model.phase {
            case .looking, .speaking, .asking: model.stop()
            case .ready, .done: picking = true
            }
          }
          SideButton(icon: "mic.fill", label: "Speak", id: "speak") { words = .speak }
            .frame(maxWidth: .infinity)
        }
        .padding(.bottom, 4)
      }
      .padding(.horizontal, 16)
    }
    .background(Color.bg.ignoresSafeArea())
    .sheet(isPresented: $picking) {
      PickSheet { choice in
        picking = false
        switch choice {
        case let .sample(s): model.start(s)
        case let .image(img): model.start(img, question: model.pendingQuestion ?? "What should I know about this?")
        }
        model.pendingQuestion = nil
      }
      .presentationDetents([.medium, .large])
    }
    .sheet(item: $words) { how in
      WordsSheet(listenFirst: how == .speak) { q in
        words = nil
        guard !q.isEmpty else { return }
        // A question about a paper needs its picture: the picker opens and the picture is read with these words.
        if !model.ask(words: q) {
          Task { try? await Task.sleep(for: .milliseconds(450)); picking = true }
        }
      }
      .presentationDetents([.large])
    }
    .sheet(isPresented: $model.showWhere) {
      if let receipt = model.receipt { WhereSheet(tag: model.tag, receipt: receipt) }
    }
    .sheet(item: $model.consent) { c in
      ConsentSheet(consent: c).presentationDetents([.large]).interactiveDismissDisabled()
    }
    .sheet(item: $page) { p in
      switch p {
      case .checks: ChecksPage()
      case .remembers: RemembersPage()
      case .priceBook: PriceBookPage(model: model)
      case .settings: SettingsPage(theme: $theme, model: model)
      }
    }
  }

  private var appBar: some View {
    HStack(spacing: 12) {
      Menu {
        Button { page = .checks } label: { Label("My checks", systemImage: "folder") }
        Button { page = .remembers } label: { Label("What WeKnow remembers", systemImage: "book.closed") }
        Button { page = .priceBook } label: { Label("Knowledge packs", systemImage: "books.vertical") }
        Button { page = .settings } label: { Label("Settings", systemImage: "gearshape") }
        if model.picture != nil {
          Button { model.stop(); model.reset() } label: { Label("Start again", systemImage: "arrow.counterclockwise") }
        }
      } label: {
        Label("Menu", systemImage: "line.3.horizontal")
          .font(.system(size: 17, weight: .semibold))
          .foregroundStyle(Color.ink)
          .padding(.horizontal, 16)
          .frame(height: 46)
          .background(Capsule().fill(Color.card))
          .overlay(Capsule().stroke(Color.hair, lineWidth: 1))
      }
      HStack(spacing: 7) {
        Circle().fill(Color.go).frame(width: 13, height: 13)
        Text("WeKnow").font(.system(size: 21, weight: .heavy)).tracking(-0.4).foregroundStyle(Color.ink)
      }
      Spacer()
      // Sound on or off at any moment; off stops the voice now and shows the words only.
      Button {
        voiceOff.toggle()
        if voiceOff { Voice.shared.stop() }
      } label: {
        Image(systemName: voiceOff ? "speaker.slash.fill" : "speaker.wave.2.fill")
          .font(.system(size: 19, weight: .semibold))
          .foregroundStyle(voiceOff ? Color.ink2 : Color.ink)
          .frame(width: 46, height: 46)
          .background(Circle().fill(Color.card))
          .overlay(Circle().stroke(Color.hair, lineWidth: 1))
      }
      .accessibilityLabel(voiceOff ? "Sound off. Turn sound on" : "Sound on. Turn sound off")
      .accessibilityIdentifier("sound")
    }
    .frame(height: 58)
  }
}

// MARK: - Window

struct PictureWindow: View {
  let model: AskModel
  let reduceMotion: Bool
  @State private var sweep = false

  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: 28, style: .continuous).fill(Color.card2)
      if let image = model.picture {
        GeometryReader { g in
          let fit = fitted(image.size, in: g.size)
          ZStack(alignment: .topLeading) {
            Image(uiImage: image).resizable().frame(width: fit.width, height: fit.height).position(x: fit.midX, y: fit.midY)
            ForEach(Array(model.bars.prefix(model.barsShown))) { bar in
              Rectangle().fill(Color.markCover)
                .frame(width: bar.rect.width * fit.width + 4, height: bar.rect.height * fit.height * 0.9 + 1)
                .position(x: fit.minX + bar.rect.midX * fit.width, y: fit.minY + bar.rect.midY * fit.height)
                .transition(.scale(scale: 0, anchor: .leading))
            }
            ForEach(model.marks) { mark in MarkView(mark: mark, fit: fit) }
            if model.scanning && !reduceMotion {
              Rectangle().fill(.white).frame(width: fit.width, height: 2).shadow(color: .black.opacity(0.25), radius: 3)
                .position(x: fit.midX, y: fit.minY + (sweep ? fit.height : 0))
                .onAppear { withAnimation(.easeInOut(duration: 1.25).repeatForever(autoreverses: true)) { sweep = true } }
                .onDisappear { sweep = false }
            }
          }
        }
        .padding(10)
        .accessibilityLabel("The picture, with your personal details covered")
      } else if let q = model.question {
        // Asked in words: no picture, the question stands in the window.
        VStack(spacing: 12) {
          Image(systemName: "text.bubble").font(.system(size: 34, weight: .regular)).foregroundStyle(Color.ink2)
          Text("“\(q)”")
            .font(.system(size: 21, weight: .semibold)).multilineTextAlignment(.center).foregroundStyle(Color.ink)
            .minimumScaleFactor(0.7)
          Text("Answered on this \(S.device), from its knowledge packs.").font(.system(size: 16, weight: .medium)).foregroundStyle(Color.ink2)
            .multilineTextAlignment(.center)
        }
        .padding(20)
      } else {
        VStack(spacing: 12) {
          Image(systemName: "doc.viewfinder").font(.system(size: 44, weight: .regular)).foregroundStyle(Color.ink2)
          Text("Show me a quote, a bill, or a problem at home.")
            .font(.system(size: 19, weight: .semibold)).multilineTextAlignment(.center).foregroundStyle(Color.ink)
          Text("Press Ask. No paper? Type or speak your question.").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2)
            .multilineTextAlignment(.center)
        }
        .padding(24)
      }
      Corners().padding(16).allowsHitTesting(false)
    }
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .shadow(color: .black.opacity(0.12), radius: 15, y: 12)
  }

  private func fitted(_ size: CGSize, in box: CGSize) -> CGRect {
    guard size.width > 0, size.height > 0 else { return .zero }
    let s = min(box.width / size.width, box.height / size.height)
    let w = size.width * s, h = size.height * s
    return CGRect(x: (box.width - w) / 2, y: (box.height - h) / 2, width: w, height: h)
  }
}

/// Four white corner marks, 1rem in.
struct Corners: View {
  var body: some View {
    GeometryReader { g in
      Path { p in
        let l: CGFloat = 22, w = g.size.width, h = g.size.height
        p.move(to: CGPoint(x: 0, y: l)); p.addLine(to: .zero); p.addLine(to: CGPoint(x: l, y: 0))
        p.move(to: CGPoint(x: w - l, y: 0)); p.addLine(to: CGPoint(x: w, y: 0)); p.addLine(to: CGPoint(x: w, y: l))
        p.move(to: CGPoint(x: w, y: h - l)); p.addLine(to: CGPoint(x: w, y: h)); p.addLine(to: CGPoint(x: w - l, y: h))
        p.move(to: CGPoint(x: l, y: h)); p.addLine(to: CGPoint(x: 0, y: h)); p.addLine(to: CGPoint(x: 0, y: h - l))
      }
      .stroke(.white, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
      .shadow(color: .black.opacity(0.3), radius: 2)
    }
  }
}

struct MarkView: View {
  let mark: Mark
  let fit: CGRect
  @State private var shown = false

  var body: some View {
    let r = CGRect(
      x: fit.minX + mark.rect.minX * fit.width - 4, y: fit.minY + mark.rect.minY * fit.height - 1,
      width: mark.rect.width * fit.width + 8, height: mark.rect.height * fit.height + 2)
    ZStack(alignment: .topLeading) {
      switch mark.kind {
      case .fair:
        dot(Color.markTick, "checkmark").position(x: fit.maxX - 1, y: r.midY)
      case let .high(label):
        RoundedRectangle(cornerRadius: 4).stroke(Color.markAmber, lineWidth: 2.5)
          .frame(width: fit.width - 8, height: r.height).position(x: fit.midX, y: r.midY)
        // Inside the box, in the gap between the words and the amount, so it never covers another line.
        Text(label).font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
          .padding(.horizontal, 6).padding(.vertical, 1).background(Capsule().fill(Color.markAmber))
          .position(x: fit.minX + fit.width * 0.66, y: r.midY)
        dot(Color.markAmber, "exclamationmark").position(x: fit.maxX - 1, y: r.midY)
      case .unknown:
        RoundedRectangle(cornerRadius: 4).stroke(Color.markBlue, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
          .frame(width: fit.width - 8, height: r.height).position(x: fit.midX, y: r.midY)
        dot(Color.markBlue, "questionmark").position(x: fit.maxX - 1, y: r.midY)
      case let .warn(n):
        RoundedRectangle(cornerRadius: 4).stroke(Color.markRed, lineWidth: 2.5)
          .frame(width: r.width, height: r.height).position(x: r.midX, y: r.midY)
        Text("\(n)").font(.system(size: 12, weight: .heavy)).foregroundStyle(.white)
          .frame(width: 20, height: 20).background(Circle().fill(Color.markRed))
          .position(x: max(fit.minX + 10, r.minX - 2), y: r.minY - 2)
      }
    }
    .opacity(shown ? 1 : 0)
    .onAppear { withAnimation(.easeOut(duration: 0.25)) { shown = true } }
    .accessibilityHidden(true)
  }

  private func dot(_ c: Color, _ symbol: String) -> some View {
    Image(systemName: symbol).font(.system(size: 9, weight: .black)).foregroundStyle(.white)
      .frame(width: 16, height: 16).background(Circle().fill(c))
  }
}

// MARK: - Words

struct WordsArea: View {
  let model: AskModel

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      if let q = model.question, model.verdict == nil {
        Text("You asked: “\(q)”").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2)
      }
      if model.phase == .looking, model.picture == nil {
        HStack(spacing: 10) {
          ProgressView()
          Text("Looking in the knowledge packs on this \(S.device)…").font(.system(size: 19, weight: .semibold)).foregroundStyle(Color.ink2)
        }
      }
      if model.phase == .asking {
        Text("May I check this on the internet?").font(.system(size: 22, weight: .bold)).foregroundStyle(Color.ink)
      }
      // The verdict stays pinned to the top of the words, the tag to the bottom; the sentences scroll between.
      if let v = model.verdict { VerdictBand(verdict: v).transition(.move(edge: .bottom).combined(with: .opacity)) }
      ScrollViewReader { proxy in
        ScrollView {
          VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(model.sentences.enumerated()), id: \.element.id) { i, s in
              VStack(alignment: .leading, spacing: 6) {
                Text(s.text)
                  .font(.system(size: 22, weight: .medium)).lineSpacing(4)
                  .foregroundStyle(model.speaking == nil || model.speaking == i ? Color.ink : Color.ink2)
                  .fixedSize(horizontal: false, vertical: true)
                if s.fromNote { NoteTag() }
              }
              .id(s.id)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
        }
        .onChange(of: model.sentences.count) { _, _ in
          if let last = model.sentences.last { withAnimation(.weknow(0.3)) { proxy.scrollTo(last.id, anchor: .bottom) } }
        }
        .onChange(of: model.phase) { _, phase in
          // When WeKnow has finished talking, the answer reads from its first sentence.
          if phase == .done, model.sentences.indices.contains(model.answerFrom) {
            withAnimation(.weknow(0.3)) { proxy.scrollTo(model.sentences[model.answerFrom].id, anchor: .top) }
          }
        }
      }
      if let tag = model.tag {
        Button { model.showWhere = true } label: { WhereTag(tag: tag) }
          .buttonStyle(.plain)
          .accessibilityHint("Shows where this answer came from")
      }
    }
    .animation(.weknow(0.28), value: model.verdict)
  }
}

struct VerdictBand: View {
  let verdict: Verdict
  var body: some View {
    HStack(spacing: 12) {
      ZStack {
        Image(systemName: verdict.tone.icon).font(.system(size: 26, weight: .semibold)).foregroundStyle(verdict.tone.iconColor)
        if verdict.tone == .stop {
          RoundedRectangle(cornerRadius: 1).fill(.white).frame(width: 13, height: 3.5)
        }
      }
      Text(verdict.text).font(.system(size: 28, weight: .bold)).tracking(-0.5).foregroundStyle(verdict.tone.textColor)
        .fixedSize(horizontal: false, vertical: true)
      Spacer(minLength: 0)
    }
    .padding(.horizontal, verdict.tone == .plain ? 0 : 16)
    .padding(.vertical, verdict.tone == .plain ? 4 : 14)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(verdict.tone.band))
    .accessibilityElement(children: .combine)
  }
}

struct NoteTag: View {
  var body: some View {
    HStack(spacing: 7) {
      Image(systemName: "book.closed.fill").foregroundStyle(Color.go)
      Text("From your notes on this \(S.device)").foregroundStyle(Color.ink2)
    }
    .font(.system(size: 17, weight: .semibold))
    .padding(.horizontal, 12).frame(minHeight: 36)
    .background(Capsule().fill(Color.card))
    .overlay(Capsule().stroke(Color.hair, lineWidth: 1))
  }
}

/// The where-it-ran tag (UI-SPEC 7.1). Never a brand, a model name or a number of seconds.
struct WhereTag: View {
  let tag: WhereRan
  var body: some View {
    let cloud = tag == .cloud
    HStack(spacing: 8) {
      Image(systemName: cloud ? "globe" : tag == .offline ? "wifi.slash" : "iphone.badge.checkmark")
      Text(tag.text)
      Image(systemName: "chevron.right").font(.system(size: 13, weight: .bold)).opacity(0.7)
    }
    .font(.system(size: 17, weight: .semibold))
    .foregroundStyle(cloud ? Color.net : Color.ink)
    .padding(.horizontal, 14).frame(minHeight: 44)
    .background(Capsule().fill(cloud ? Color.netBg : Color.card))
    .overlay(Capsule().stroke(cloud ? Color.net.opacity(0.35) : Color.line, lineWidth: 1.5))
    .accessibilityLabel(tag.text)
  }
}

// MARK: - Big button

struct AskButton: View {
  let phase: AskModel.Phase
  let action: () -> Void
  @State private var pressed = false

  private var busy: Bool { phase == .looking || phase == .speaking || phase == .asking }

  var body: some View {
    Button(action: action) {
      VStack(spacing: 4) {
        Image(systemName: busy ? "stop.fill" : "viewfinder").font(.system(size: 26, weight: .bold))
        Text(busy ? "Stop" : "Ask").font(.system(size: 24, weight: .bold))
      }
      .foregroundStyle(busy ? Color.onKey : Color.onGo)
      .frame(width: 112, height: 112)
      .background(
        Circle().fill(busy ? Color.key : Color.go)
          .overlay(Circle().stroke(.white.opacity(0.18), lineWidth: 1).padding(1))
      )
      .background(Circle().fill(busy ? Color.ink2 : Color.goDeep).offset(y: pressed ? 1 : 3.5))
      .offset(y: pressed ? 2.5 : 0)
      .padding(9)
      .background(Circle().fill((busy ? Color.key : Color.go).opacity(0.12)))
    }
    .buttonStyle(PressStyle(pressed: $pressed))
    .accessibilityLabel(busy ? "Stop" : "Ask")
  }
}

/// Type and Speak, either side of the big button.
struct SideButton: View {
  let icon: String
  let label: String
  let id: String
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      VStack(spacing: 4) {
        Image(systemName: icon).font(.system(size: 21, weight: .semibold))
        Text(label).font(.system(size: 16, weight: .bold))
      }
      .foregroundStyle(Color.ink)
      .frame(width: 76, height: 76)
      .background(Circle().fill(Color.card))
      .overlay(Circle().stroke(Color.line, lineWidth: 1.5))
    }
    .buttonStyle(.plain)
    .accessibilityLabel(label == "Type" ? "Type a question" : "Speak a question")
    .accessibilityIdentifier(id)
  }
}

struct PressStyle: ButtonStyle {
  @Binding var pressed: Bool
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .onChange(of: configuration.isPressed) { _, p in withAnimation(.weknow(0.14)) { pressed = p } }
  }
}
