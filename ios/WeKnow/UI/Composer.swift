// The input bar under the picture, the way chat apps work: add a picture with the camera, type or say what is
// wrong, then press Send once and both go together. The right button is the microphone while the bar is empty,
// Send once there is a picture or words, and Stop while WeKnow is answering. Speech is turned into words on this
// phone and only fills the box; nothing is sent until Send.

import SwiftUI

struct Composer: View {
  /// The questions people ask most about a paper.
  static let usual = ["Should I pay this?", "Is this a fair price?", "What is this?"]
  @Bindable var model: AskModel
  /// The camera (full screen, only when pressed) and the photo library; the picture goes into the bar.
  let takePhoto: () -> Void
  let choosePhoto: () -> Void
  /// A PDF or picture from Files (a bill that came by email, a screenshot).
  let chooseFile: () -> Void
  @State private var ear = Ear()
  @FocusState private var focused: Bool

  private var busy: Bool { model.phase == .looking || model.phase == .speaking || model.phase == .asking }
  private var ready: Bool { model.draft != nil || !model.draftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      if let hint = model.draftHint {
        Label(hint, systemImage: "camera").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.ink2)
          .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 8)
      }
      if case let .unavailable(why) = ear.state {
        Label(why, systemImage: "mic.slash").font(.system(size: 16, weight: .semibold)).foregroundStyle(Color.ink2)
          .fixedSize(horizontal: false, vertical: true).padding(.horizontal, 8)
      }
      // With a picture in the bar and no words yet: the usual questions. A press puts the words in the box; Send
      // stays the person's press.
      if model.draft != nil, model.draftText.trimmingCharacters(in: .whitespaces).isEmpty, !busy, !ear.listening {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 8) {
            ForEach(Self.usual, id: \.self) { q in
              Button { model.draftText = q } label: {
                Text(q).font(.system(size: 16, weight: .medium)).foregroundStyle(Color.ink)
                  .padding(.horizontal, 14).frame(minHeight: 40)
                  .overlay(Capsule().stroke(Color.hair, lineWidth: 1))
              }
              .buttonStyle(.plain)
            }
          }
          .padding(.horizontal, 4)
        }
        .accessibilityLabel("Questions to ask")
      }
      VStack(alignment: .leading, spacing: 6) {
        if let img = model.draft {
          // The picture that will go with the words, until Send.
          ZStack(alignment: .topTrailing) {
            Image(uiImage: img).resizable().scaledToFill().frame(width: 60, height: 60)
              .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            Button { model.draft = nil } label: {
              Image(systemName: "xmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Color.onKey)
                .frame(width: 22, height: 22).background(Circle().fill(Color.key))
            }
            .buttonStyle(.plain)
            .offset(x: 7, y: -7)
            .accessibilityLabel("Remove the picture")
          }
          .padding(.leading, 10).padding(.top, 10)
        }
        HStack(alignment: .bottom, spacing: 4) {
          Button {
            ear.stop()
            focused = false
            takePhoto()
          } label: {
            Image(systemName: "camera").font(.system(size: 20, weight: .regular))
              .foregroundStyle(Color.ink)
              .frame(width: 42, height: 44)
          }
          .buttonStyle(.plain)
          .disabled(busy)
          .accessibilityLabel("Take a picture")
          .accessibilityIdentifier("composer-camera")
          Menu {
            Button { ear.stop(); focused = false; choosePhoto() } label: { Label("Choose a photo", systemImage: "photo") }
            Button { ear.stop(); focused = false; chooseFile() } label: { Label("Choose a file (PDF or picture)", systemImage: "doc") }
          } label: {
            Image(systemName: "plus.circle").font(.system(size: 20, weight: .regular))
              .foregroundStyle(Color.ink)
              .frame(width: 38, height: 44)
          }
          .disabled(busy)
          .accessibilityLabel("Add a photo or a file")
          .accessibilityIdentifier("composer-photo")

          TextField(ear.listening ? "Listening…" : model.draft == nil ? "Ask WeKnow" : "What is wrong?", text: $model.draftText, axis: .vertical)
            .font(.system(size: 17))
            .foregroundStyle(Color.ink)
            .lineLimit(1...5)
            .focused($focused)
            .submitLabel(.send)
            .onSubmit(send)
            .padding(.vertical, 11)
            .accessibilityIdentifier("composer-field")

          if !busy && !ready && !ear.listening {
            Button(action: right) {
              Image(systemName: "mic").font(.system(size: 20, weight: .regular)).foregroundStyle(Color.ink)
                .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Speak your question")
            .accessibilityIdentifier("composer-action")
          } else {
            Button(action: right) {
              ZStack {
                Circle().fill(Color.key)
                if busy {
                  RoundedRectangle(cornerRadius: 2.5).fill(Color.onKey).frame(width: 13, height: 13)
                } else if ear.listening {
                  Bars(level: ear.level, color: Color.onKey)
                } else {
                  Image(systemName: "arrow.up").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.onKey)
                }
              }
              .frame(width: 38, height: 38)
              .padding(3)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(busy ? "Stop" : ear.listening ? "Done speaking" : "Send")
            .accessibilityIdentifier("composer-action")
          }
        }
        .padding(.horizontal, 4).padding(.vertical, 2)
      }
      .background(RoundedRectangle(cornerRadius: 26, style: .continuous).fill(Color.card2))
      .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(ear.listening ? Color.go : Color.clear, lineWidth: 2))
    }
    .onDisappear { ear.stop() }
  }

  private func right() {
    if busy { model.stop(); return }
    if ear.listening { ear.finishNow(heard); return }
    if ready { send(); return }
    focused = false
    Task { await ear.start(onDone: heard) }
  }

  /// Spoken words go into the box, after anything already typed. Send stays the person's press.
  private func heard(_ words: String) {
    guard !words.isEmpty else { return }
    let before = model.draftText.trimmingCharacters(in: .whitespaces)
    model.draftText = before.isEmpty ? words : before + " " + words
  }

  private func send() {
    ear.stop()
    focused = false
    model.send()
  }
}

/// Five bars that follow the voice level.
struct Bars: View {
  let level: Double
  var color: Color = .go
  var body: some View {
    HStack(spacing: 3) {
      ForEach([0.5, 0.8, 1, 0.75, 0.55], id: \.self) { b in
        Capsule().fill(color).frame(width: 3.5, height: 5 + 15 * min(1, level * b * 1.6))
      }
    }
    .frame(height: 22)
    .animation(.easeOut(duration: 0.1), value: level)
  }
}
