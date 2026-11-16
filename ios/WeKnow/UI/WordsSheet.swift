// Asking in words: type the question or say it. The words are turned into text on this phone and answered from
// the knowledge packs on it, without a picture.

import SwiftUI

struct WordsSheet: View {
  let listenFirst: Bool
  let done: (String) -> Void
  @State private var text = ""
  @State private var ear = Ear()
  @FocusState private var typing: Bool

  static let tries = [
    "How much is a brake pad replacement?",
    "My kitchen sink is clogged.",
    "What does a new water heater cost?",
  ]

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
          Text("Type or say your question. I answer from the knowledge packs on this \(S.device).")
            .font(.system(size: 18, weight: .medium)).foregroundStyle(Color.ink2)
            .fixedSize(horizontal: false, vertical: true)

          TextField("For example: How much are new brake pads?", text: $text, axis: .vertical)
            .font(.system(size: 21, weight: .semibold))
            .lineLimit(2...5)
            .focused($typing)
            .submitLabel(.send)
            .onSubmit(send)
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ear.listening ? Color.go : Color.line, lineWidth: ear.listening ? 2.5 : 1.5))
            .accessibilityIdentifier("words-field")

          if case let .unavailable(why) = ear.state {
            Label(why, systemImage: "mic.slash").font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.ink2)
              .fixedSize(horizontal: false, vertical: true)
          }

          HStack(spacing: 12) {
            Button(action: toggleListening) {
              HStack(spacing: 8) {
                if ear.listening {
                  Bars(level: ear.level)
                  Text("Done")
                } else {
                  Image(systemName: "mic.fill")
                  Text("Speak")
                }
              }
              .font(.system(size: 19, weight: .bold))
              .foregroundStyle(Color.ink)
              .frame(maxWidth: .infinity, minHeight: 56)
              .background(Capsule().fill(Color.card))
              .overlay(Capsule().stroke(ear.listening ? Color.go : Color.line, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel(ear.listening ? "Done speaking" : "Speak")
            .accessibilityIdentifier("words-speak")

            Button(action: send) {
              Label("Ask", systemImage: "arrow.up")
                .font(.system(size: 19, weight: .bold))
                .foregroundStyle(Color.onGo)
                .frame(maxWidth: .infinity, minHeight: 56)
                .background(Capsule().fill(Color.go.opacity(canSend ? 1 : 0.4)))
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .accessibilityIdentifier("words-ask")
          }

          if ear.listening {
            Text("Listening. Words are turned into text on this \(S.device).")
              .font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2)
          }

          Text("Try one").font(.system(size: 17, weight: .bold)).foregroundStyle(Color.ink2).padding(.top, 6)
          ForEach(Self.tries, id: \.self) { q in
            Button { text = q; send() } label: {
              HStack {
                Text("“\(q)”").font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.ink)
                  .multilineTextAlignment(.leading)
                Spacer()
                Image(systemName: "chevron.right").foregroundStyle(Color.ink2)
              }
              .padding(14)
              .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
              .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.hair, lineWidth: 1))
            }
            .buttonStyle(.plain)
          }
        }
        .padding(20)
      }
      .background(Color.bg)
      .navigationTitle("Ask in words")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) { Button("Close") { ear.stop(); done("") } }
      }
    }
    .task {
      if listenFirst { toggleListening() } else { typing = true }
    }
    .onDisappear { ear.stop() }
  }

  private var canSend: Bool { !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }

  private func send() {
    let q = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !q.isEmpty else { return }
    ear.stop()
    done(q)
  }

  private func toggleListening() {
    if ear.listening {
      ear.finishNow(heard)
      return
    }
    typing = false
    Task {
      await ear.start(onDone: heard)
      if case .unavailable = ear.state { typing = true }
    }
  }

  /// Spoken words fill the box; a clear question is asked at once, so speaking needs no second press.
  private func heard(_ words: String) {
    guard !words.isEmpty else { return }
    text = words
    send()
  }
}

/// Five bars that follow the voice level.
struct Bars: View {
  let level: Double
  var body: some View {
    HStack(spacing: 3) {
      ForEach([0.5, 0.8, 1, 0.75, 0.55], id: \.self) { b in
        Capsule().fill(Color.go).frame(width: 4, height: 6 + 16 * min(1, level * b * 1.6))
      }
    }
    .frame(height: 24)
    .animation(.easeOut(duration: 0.1), value: level)
  }
}
