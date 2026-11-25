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
  @State private var page: MenuPage?
  @State private var shooting = false
  @State private var choosingPhoto = false
  @State private var choosingFile = false
  @State private var photoItem: PhotosPickerItem?
  @AppStorage(Prefs.voiceOff) private var voiceOff = false
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  @State private var whereShown: AskModel.Exchange?
  @State private var drawer = false
  @State private var openRecord: CheckRecord?

  /// The widest the conversation and the input bar grow (an iPad, or a wide window): lines stay easy to read.
  static let readableWidth: CGFloat = 720

  var body: some View {
    GeometryReader { geo in
      VStack(spacing: 8) {
        appBar
        Group {
          if model.inConversation {
            ConversationView(model: model, reduceMotion: reduceMotion) { whereShown = $0 }
          } else {
            StartView(model: model, trySample: trySample, suggest: suggest)
          }
        }
        .frame(maxWidth: Self.readableWidth, maxHeight: .infinity)
        Composer(model: model, takePhoto: takePhoto, choosePhoto: { choosingPhoto = true }, chooseFile: { choosingFile = true })
          .frame(maxWidth: Self.readableWidth)
          .padding(.bottom, 4)
      }
      .padding(.horizontal, 16)
    }
    .background(Color.bg.ignoresSafeArea())
    .overlay(alignment: .leading) {
      // One hand: a swipe in from the left edge opens the drawer, as chat apps do.
      if !drawer {
        Color.clear.frame(width: 22).contentShape(Rectangle())
          .gesture(DragGesture(minimumDistance: 12).onEnded { v in
            if v.translation.width > 50 && abs(v.translation.height) < 80 { drawer = true }
          })
          .ignoresSafeArea()
      }
    }
    .overlay {
      Drawer(open: $drawer, newConversation: { model.newConversation() }, go: { page = $0 }, openCheck: { openRecord = $0 })
    }
    .sheet(item: $openRecord) { r in CheckDetail(record: r) }
    // The camera opens only when the camera button is pressed, full screen, and closes after the picture.
    .fullScreenCover(isPresented: $shooting) {
      CameraView { img in
        shooting = false
        attach(img)
      }
      .ignoresSafeArea()
    }
    .photosPicker(isPresented: $choosingPhoto, selection: $photoItem, matching: .images)
    .fileImporter(isPresented: $choosingFile, allowedContentTypes: [.pdf, .image]) { result in
      guard case let .success(url) = result else { return }
      attach(PaperFile.image(from: url))
    }
    .onChange(of: photoItem) { _, item in
      guard let item else { return }
      Task {
        if let data = try? await item.loadTransferable(type: Data.self), let img = UIImage(data: data) { attach(img) }
        photoItem = nil
      }
    }
    .sheet(item: $whereShown) { ex in
      if let receipt = ex.receipt { WhereSheet(tag: ex.tag, receipt: receipt) }
    }
    .sheet(isPresented: $model.showWhere) {
      if let receipt = model.receipt { WhereSheet(tag: model.tag, receipt: receipt) }
    }
    .sheet(isPresented: $model.showLights) { LightsSheet() }
    .alert(model.confirm?.title ?? "", isPresented: Binding(get: { model.confirm != nil }, set: { _ in }), presenting: model.confirm) { c in
      Button(c.yes) { model.confirm = nil; c.answer(true) }
      Button(c.no, role: .cancel) { model.confirm = nil; c.answer(false) }
    } message: { c in
      Text(c.message)
    }
    .sheet(item: $model.consent) { c in
      ConsentSheet(consent: c).presentationDetents([.large]).interactiveDismissDisabled()
    }
    // `-WeKnowPage priceBook` (or checks, remembers, settings) opens that page at launch, for screenshots.
    .task { if let p = UserDefaults.standard.string(forKey: "WeKnowPage").flatMap(MenuPage.init(rawValue:)) { page = p } }
    .sheet(item: $page) { p in
      switch p {
      case .checks: ChecksPage()
      case .remembers: RemembersPage()
      case .priceBook: PriceBookPage(model: model)
      case .settings: SettingsPage(theme: $theme, model: model)
      }
    }
  }

  /// The camera button: the camera opens full screen; the picture goes into the input bar, next to the words, and
  /// nothing is read until Send. Without a camera (the simulator), the photo picker opens instead.
  private func takePhoto() {
    if UIImagePickerController.isSourceTypeAvailable(.camera) { shooting = true } else { choosingPhoto = true }
  }

  /// A sample picture with its question, ready to send.
  private func trySample(_ s: Sample) {
    attach(s.image)
    model.draftText = s.question
  }

  /// A suggestion goes into the box; Send stays the person's press. One about a paper asks for its picture.
  private func suggest(_ q: String) {
    model.draftText = q
    if WordsAnswer.needsPicture(q), model.draft == nil { model.draftHint = "Add a picture of it with the camera button, then press Send." }
  }

  /// The picture goes into the input bar; the words already typed stay.
  private func attach(_ img: UIImage?) {
    guard let img else { return }
    model.draft = img
    model.draftHint = nil
  }

  private var appBar: some View {
    HStack(spacing: 2) {
      Button { drawer = true } label: {
        Image(systemName: "line.3.horizontal").font(.system(size: 19, weight: .medium)).frame(width: 44, height: 44)
      }
      .accessibilityLabel("Menu")
      .accessibilityIdentifier("menu")
      Text("WeKnow").font(.system(size: 18, weight: .semibold)).tracking(-0.2)
      Spacer()
      // Sound on or off at any moment; off stops the voice now and shows the words only.
      Button {
        voiceOff.toggle()
        if voiceOff { Voice.shared.stop() }
      } label: {
        Image(systemName: voiceOff ? "speaker.slash" : "speaker.wave.2").font(.system(size: 18, weight: .medium))
          .frame(width: 44, height: 44)
      }
      .accessibilityLabel(voiceOff ? "Sound off. Turn sound on" : "Sound on. Turn sound off")
      .accessibilityIdentifier("sound")
      if model.inConversation {
        Button { model.newConversation() } label: {
          Image(systemName: "square.and.pencil").font(.system(size: 18, weight: .medium)).frame(width: 44, height: 44)
        }
        .accessibilityLabel("Start a new conversation")
      }
    }
    .foregroundStyle(Color.ink)
    .frame(height: 48)
  }
}

// MARK: - Start

/// Before the first message: a greeting, two sample pictures to try, and a few things to ask. The camera stays off
/// until the camera button is pressed.
struct StartView: View {
  let model: AskModel
  let trySample: (Sample) -> Void
  let suggest: (String) -> Void

  static let suggestions = ["Should I pay this?", "Is this price fair?", "How much are brake pads?", "My kitchen sink is clogged"]

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        VStack(alignment: .leading, spacing: 8) {
          Text("What can I check for you?").font(.system(size: 28, weight: .semibold)).tracking(-0.5).foregroundStyle(Color.ink)
          Text("Take a picture of a quote, a bill or something broken with the camera button below. Or just ask.")
            .font(.system(size: 17)).foregroundStyle(Color.ink2).fixedSize(horizontal: false, vertical: true)
        }
        .padding(.top, 12)

        VStack(alignment: .leading, spacing: 10) {
          Text("Try a sample").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.ink2)
          HStack(spacing: 12) {
            ForEach(Sample.all) { s in
              Button { trySample(s) } label: {
                VStack(alignment: .leading, spacing: 8) {
                  if let img = s.image {
                    Image(uiImage: img).resizable().scaledToFill().frame(height: 110).frame(maxWidth: .infinity)
                      .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                  }
                  Text(s.title).font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.ink)
                  Text("“\(s.question)”").font(.system(size: 14)).foregroundStyle(Color.ink2).lineLimit(2)
                }
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.card2))
              }
              .buttonStyle(.plain)
              .accessibilityIdentifier("sample-\(s.id)")
            }
          }
        }

        VStack(alignment: .leading, spacing: 10) {
          Text("Or ask").font(.system(size: 15, weight: .semibold)).foregroundStyle(Color.ink2)
          FlowLayout(spacing: 8) {
            ForEach(Self.suggestions, id: \.self) { q in Pill(text: q) { suggest(q) } }
          }
        }
      }
      .padding(.bottom, 8)
    }
    .scrollIndicators(.hidden)
  }
}

// MARK: - Window

struct PictureWindow: View {
  let model: AskModel
  let reduceMotion: Bool
  @State private var sweep = false

  var body: some View {
    ZStack {
      if let image = model.picture {
        GeometryReader { g in
          let fit = fitted(image.size, in: g.size)
          ZStack(alignment: .topLeading) {
            Image(uiImage: image).resizable().frame(width: fit.width, height: fit.height)
              .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous)).position(x: fit.midX, y: fit.midY)
            ForEach(Array(model.bars.prefix(model.barsShown))) { bar in
              Rectangle().fill(Color.markCover)
                .frame(width: bar.rect.width * fit.width + 4, height: bar.rect.height * fit.height * 0.9 + 1)
                .position(x: fit.minX + bar.rect.midX * fit.width, y: fit.minY + bar.rect.midY * fit.height)
                .transition(.scale(scale: 0, anchor: .leading))
            }
            ForEach(model.marks) { mark in MarkView(mark: mark, fit: fit) }
            // A bill read part by part: the part being read now, framed, with "Part 3 of 6".
            if let part = model.scanPart {
              let r = CGRect(x: fit.minX + part.minX * fit.width - 4, y: fit.minY + part.minY * fit.height - 4,
                             width: part.width * fit.width + 8, height: part.height * fit.height + 8)
              RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(Color.accentColor.opacity(0.10))
                .strokeBorder(Color.accentColor, lineWidth: 2)
                .frame(width: r.width, height: r.height)
                .position(x: r.midX, y: r.midY)
                .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: part)
              if let label = model.scanPartLabel {
                Text(label).font(.caption.weight(.semibold)).foregroundStyle(.white)
                  .padding(.horizontal, 8).padding(.vertical, 3)
                  .background(Capsule().fill(Color.accentColor))
                  .position(x: min(max(r.midX, fit.minX + 50), fit.maxX - 50), y: max(r.minY - 10, fit.minY + 10))
                  .animation(reduceMotion ? nil : .easeInOut(duration: 0.3), value: part)
              }
            }
            if model.scanning && !reduceMotion {
              Rectangle().fill(.white).frame(width: fit.width, height: 2).shadow(color: .black.opacity(0.25), radius: 3)
                .position(x: fit.midX, y: fit.minY + (sweep ? fit.height : 0))
                .onAppear { withAnimation(.easeInOut(duration: 1.25).repeatForever(autoreverses: true)) { sweep = true } }
                .onDisappear { sweep = false }
            }
          }
        }
        .accessibilityLabel("The picture, with your personal details covered")
      }
    }
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
  /// False when drawn into a still picture (the enlarged view), where the fade-in would never run.
  var animated = true
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
    .opacity(!animated || shown ? 1 : 0)
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
    HStack(spacing: 5) {
      Image(systemName: cloud ? "globe" : tag == .offline ? "wifi.slash" : "lock.iphone")
      Text(tag.text)
      Image(systemName: "chevron.right").font(.system(size: 11, weight: .semibold)).opacity(0.6)
    }
    .font(.system(size: 14, weight: .medium))
    .foregroundStyle(cloud ? Color.net : Color.ink2)
    .padding(.vertical, 6)
    .frame(minHeight: 32)
    .contentShape(Rectangle())
    .accessibilityLabel(tag.text)
  }
}

/// Lays its children out left to right, wrapping onto new lines: suggestion and next-question pills.
struct FlowLayout: Layout {
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let width = proposal.width ?? .infinity
    var x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, widest: CGFloat = 0
    for v in subviews {
      let s = v.sizeThatFits(ProposedViewSize(width: width, height: nil))
      if x > 0 && x + s.width > width { x = 0; y += row + spacing; row = 0 }
      x += s.width + spacing
      row = max(row, s.height)
      widest = max(widest, x - spacing)
    }
    return CGSize(width: min(widest, width), height: y + row)
  }

  func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
    var x = bounds.minX, y = bounds.minY, row: CGFloat = 0
    for v in subviews {
      let s = v.sizeThatFits(ProposedViewSize(width: bounds.width, height: nil))
      if x > bounds.minX && x + s.width > bounds.maxX { x = bounds.minX; y += row + spacing; row = 0 }
      v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(s.width, bounds.width), height: s.height))
      x += s.width + spacing
      row = max(row, s.height)
    }
  }
}

/// A light pill: a suggestion before the first message, or a next question under an answer.
struct Pill: View {
  let text: String
  let action: () -> Void
  var body: some View {
    Button(action: action) {
      Text(text)
        .font(.system(size: 16, weight: .medium))
        .foregroundStyle(Color.ink)
        .multilineTextAlignment(.leading)
        .padding(.horizontal, 15).padding(.vertical, 11)
        .frame(minHeight: 44)
        .background(Capsule().fill(Color.bg))
        .overlay(Capsule().stroke(Color.hair, lineWidth: 1))
    }
    .buttonStyle(.plain)
  }
}
