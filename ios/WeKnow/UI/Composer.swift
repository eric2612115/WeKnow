// The input bar under the picture, the way chat apps work: add a picture with the camera, type or say what is
// wrong, then press Send once and both go together. The right button is the microphone while the bar is empty,
// Send once there is a picture or words, and Stop while WeKnow is answering. Speech is turned into words on this
// phone and only fills the box; nothing is sent until Send.

import SwiftUI

struct Composer: View {
  @Bindable var model: AskModel
  /// Add a picture: from the live camera, or the photo picker when there is none.
  let addPicture: () -> Void
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
      VStack(alignment: .leading, spacing: 8) {
        if let img = model.draft {
          // The picture that will go with the words, until Send.
          HStack(spacing: 10) {
            ZStack(alignment: .topTrailing) {
              Image(uiImage: img).resizable().scaledToFill().frame(width: 64, height: 64)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
              Button { model.draft = nil } label: {
                Image(systemName: "xmark").font(.system(size: 11, weight: .black)).foregroundStyle(.white)
                  .frame(width: 24, height: 24).background(Circle().fill(Color.key))
              }
              .buttonStyle(.plain)
              .offset(x: 8, y: -8)
              .accessibilityLabel("Remove the picture")
            }
            Text("Picture added. Say or type what you want to know, then press Send.")
              .font(.system(size: 16, weight: .medium)).foregroundStyle(Color.ink2)
              .fixedSize(horizontal: false, vertical: true)
          }
          .padding(.leading, 8).padding(.top, 8)
        }
        HStack(alignment: .bottom, spacing: 8) {
          Button {
            ear.stop()
            focused = false
            addPicture()
          } label: {
            Image(systemName: model.draft == nil ? "camera.fill" : "camera.rotate").font(.system(size: 21, weight: .semibold))
              .foregroundStyle(Color.ink)
              .frame(width: 48, height: 48)
              .background(Circle().fill(Color.card2))
          }
          .buttonStyle(.plain)
          .disabled(busy)
          .accessibilityLabel(model.draft == nil ? "Add a picture" : "Take the picture again")
          .accessibilityIdentifier("composer-camera")

          TextField(ear.listening ? "Listening…" : model.draft == nil ? "Type or say your question" : "What is wrong?", text: $model.draftText, axis: .vertical)
            .font(.system(size: 19, weight: .medium))
            .foregroundStyle(Color.ink)
            .lineLimit(1...4)
            .focused($focused)
            .submitLabel(.send)
            .onSubmit(send)
            .padding(.vertical, 12)
            .accessibilityIdentifier("composer-field")

          Button(action: right) {
            ZStack {
              Circle().fill(busy ? Color.key : Color.go)
              if busy {
                RoundedRectangle(cornerRadius: 3).fill(Color.onKey).frame(width: 16, height: 16)
              } else if ear.listening {
                Bars(level: ear.level, color: Color.onGo)
              } else if ready {
                Image(systemName: "arrow.up").font(.system(size: 21, weight: .bold)).foregroundStyle(Color.onGo)
              } else {
                Image(systemName: "mic.fill").font(.system(size: 20, weight: .semibold)).foregroundStyle(Color.onGo)
              }
            }
            .frame(width: 48, height: 48)
          }
          .buttonStyle(.plain)
          .accessibilityLabel(busy ? "Stop" : ear.listening ? "Done speaking" : ready ? "Send" : "Speak your question")
          .accessibilityIdentifier("composer-action")
        }
        .padding(6)
      }
      .background(RoundedRectangle(cornerRadius: 30, style: .continuous).fill(Color.card))
      .overlay(RoundedRectangle(cornerRadius: 30, style: .continuous).stroke(ear.listening || focused ? Color.go : Color.line, lineWidth: ear.listening ? 2.5 : 1.5))
      .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
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
