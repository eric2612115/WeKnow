// The Ask page: the live camera in the window, the words under it, and the input bar every chat app has.

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
  @State private var camera = LiveCamera()
  @AppStorage(Prefs.voiceOff) private var voiceOff = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  @State private var whereShown: AskModel.Exchange?

  var body: some View {
    GeometryReader { geo in
      VStack(spacing: 12) {
        appBar
        if model.inConversation {
          ConversationView(model: model, camera: camera, reduceMotion: reduceMotion) { whereShown = $0 }
            .frame(maxHeight: .infinity)
        } else {
          // Before the first message: the live camera, as a camera app opens.
          PictureWindow(model: model, camera: camera, reduceMotion: reduceMotion, openPhotos: { picking = true })
            .frame(height: geo.size.height * 0.55)
          Spacer(minLength: 0)
        }
        Composer(model: model, addPicture: takePicture)
          .padding(.bottom, 6)
      }
      .padding(.horizontal, 16)
    }
    .background(Color.bg.ignoresSafeArea())
    .task { await camera.start() }
    .onChange(of: model.inConversation || model.draft != nil) { _, busy in
      if busy { camera.stop() } else { Task { await camera.start() } }
    }
    .sheet(item: $whereShown) { ex in
      if let receipt = ex.receipt { WhereSheet(tag: ex.tag, receipt: receipt) }
    }
    .sheet(isPresented: $picking) {
      PickSheet { choice in
        picking = false
        switch choice {
        case let .sample(s):
          attach(s.image)
          if model.draftText.isEmpty { model.draftText = s.question }
        case let .image(img): attach(img)
        }
      }
      .presentationDetents([.medium, .large])
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

  /// The camera button: a still from the live camera goes into the input bar, next to the words; nothing is read
  /// until Send. In a conversation (or without a live camera) the camera and photo picker opens instead.
  private func takePicture() {
    if model.draft != nil && !model.inConversation { model.draft = nil; return } // take it again: the live camera comes back
    guard camera.state == .running, !model.inConversation else { picking = true; return }
    Task {
      if let img = await camera.capture() { attach(img) } else { picking = true }
    }
  }

  /// The picture goes into the input bar; the words already typed stay.
  private func attach(_ img: UIImage?) {
    guard let img else { return }
    model.draft = img
    model.draftHint = nil
  }

  private var appBar: some View {
    HStack(spacing: 12) {
      Menu {
        Button { page = .checks } label: { Label("My checks", systemImage: "folder") }
        Button { page = .remembers } label: { Label("What WeKnow remembers", systemImage: "book.closed") }
        Button { page = .priceBook } label: { Label("Knowledge packs", systemImage: "books.vertical") }
        Button { page = .settings } label: { Label("Settings", systemImage: "gearshape") }
        if model.inConversation {
          Button { model.newConversation() } label: { Label("Start again", systemImage: "arrow.counterclockwise") }
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
  let camera: LiveCamera
  let reduceMotion: Bool
  let openPhotos: () -> Void
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
      } else if let draft = model.draft {
        Image(uiImage: draft).resizable().scaledToFit().padding(10)
          .accessibilityLabel("The picture you added")
      } else if camera.state == .running {
        CameraPreview(session: camera.session)
          .accessibilityLabel("The camera. Point it at a quote, a bill or a problem, then press the camera button")
      } else {
        VStack(spacing: 12) {
          Image(systemName: "doc.viewfinder").font(.system(size: 44, weight: .regular)).foregroundStyle(Color.ink2)
          Text("Show me a quote, a bill, or a problem at home.")
            .font(.system(size: 19, weight: .semibold)).multilineTextAlignment(.center).foregroundStyle(Color.ink)
          Text("Or type or say your question below.").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2)
            .multilineTextAlignment(.center)
        }
        .padding(24)
      }
      Corners().padding(16).allowsHitTesting(false)
      if model.picture == nil && model.question == nil {
        // Photos and the sample pictures, in the corner of the window.
        Button(action: openPhotos) {
          Label("Photos", systemImage: "photo.on.rectangle")
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(Color.ink)
            .padding(.horizontal, 12).frame(height: 40)
            .background(Capsule().fill(Color.card.opacity(0.94)))
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .padding(.bottom, 22)
        .accessibilityLabel("Choose a photo or a sample picture")
        .accessibilityIdentifier("photos")
      }
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

// MARK: - Tags

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
