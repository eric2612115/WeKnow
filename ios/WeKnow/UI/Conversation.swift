// The conversation: the person's messages on the right (their picture with personal details covered, their words),
// WeKnow's answers on the left (the point in bold, a small tag only when it matters, the sentences, where it ran),
// and under the latest answer the next questions as big buttons. It scrolls; nothing needs managing.

import SwiftUI

struct ConversationView: View {
  @Bindable var model: AskModel
  let camera: LiveCamera
  let reduceMotion: Bool
  let showWhere: (AskModel.Exchange) -> Void

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 14) {
          ForEach(model.thread) { ex in
            PersonBubble(text: ex.question, picture: ex.picture)
            AnswerBubble(head: ex.head, tone: ex.tone, sentences: ex.sentences, speaking: nil, tag: ex.tag) { showWhere(ex) }
          }
          // The question in progress.
          if model.picture != nil {
            VStack(alignment: .trailing, spacing: 8) {
              PictureWindow(model: model, camera: camera, reduceMotion: reduceMotion, openPhotos: {})
                .frame(height: 300)
              if let q = model.question { PersonBubble(text: q, picture: nil) }
            }
            .padding(.leading, 30)
          } else if let q = model.question {
            PersonBubble(text: q, picture: nil)
          }
          LiveAnswer(model: model)
          Color.clear.frame(height: 1).id("end")
        }
        .padding(.vertical, 8)
      }
      .scrollDismissesKeyboard(.interactively)
      .onChange(of: model.sentences.count) { _, _ in scroll(proxy) }
      .onChange(of: model.choices.count) { _, _ in scroll(proxy) }
      .onChange(of: model.thread.count) { _, _ in scroll(proxy) }
      .onChange(of: model.phase) { _, _ in scroll(proxy) }
      .onAppear { scroll(proxy, animated: false) }
    }
  }

  private func scroll(_ proxy: ScrollViewProxy, animated: Bool = true) {
    if animated { withAnimation(.weknow(0.3)) { proxy.scrollTo("end", anchor: .bottom) } } else { proxy.scrollTo("end", anchor: .bottom) }
  }
}

/// The person's message.
struct PersonBubble: View {
  let text: String?
  let picture: UIImage?

  var body: some View {
    VStack(alignment: .trailing, spacing: 6) {
      if let picture {
        Image(uiImage: picture).resizable().scaledToFit().frame(maxWidth: 220, maxHeight: 220)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          .accessibilityLabel("Your picture, with personal details covered")
      }
      if let text, !text.isEmpty {
        Text(text).font(.system(size: 19, weight: .semibold)).foregroundStyle(Color.ink)
          .padding(.horizontal, 14).padding(.vertical, 10)
          .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.okBg))
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
    .padding(.leading, 40)
  }
}

/// One answer: the point in bold, a tag only for Careful or Stop, the sentences, where it ran.
struct AnswerBubble: View {
  let head: String?
  let tone: Tone
  let sentences: [String]
  let speaking: Int?
  let tag: WhereRan?
  let openWhere: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      if tone == .warn || tone == .stop {
        Label(tone == .stop ? "Stop" : "Careful", systemImage: tone == .stop ? "hand.raised.fill" : "exclamationmark.triangle.fill")
          .font(.system(size: 15, weight: .heavy))
          .foregroundStyle(tone == .stop ? Color.stop : Color.warnInk)
          .padding(.horizontal, 10).padding(.vertical, 4)
          .background(Capsule().fill(tone == .stop ? Color.stopBg : Color.warnBg))
      }
      if let head {
        Text(head).font(.system(size: 23, weight: .bold)).tracking(-0.3).foregroundStyle(Color.ink)
          .fixedSize(horizontal: false, vertical: true)
      }
      ForEach(Array(sentences.enumerated()), id: \.offset) { i, s in
        Text(s).font(.system(size: 20, weight: .medium)).lineSpacing(3)
          .foregroundStyle(speaking == nil || speaking == i ? Color.ink : Color.ink2)
          .fixedSize(horizontal: false, vertical: true)
      }
      if let tag {
        Button(action: openWhere) { WhereTag(tag: tag) }
          .buttonStyle(.plain)
          .accessibilityHint("Shows where this answer came from")
      }
    }
    .padding(.trailing, 24)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The answer being worked out and said now, then the next questions.
struct LiveAnswer: View {
  @Bindable var model: AskModel

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if model.phase == .looking {
        HStack(spacing: 10) {
          ProgressView()
          Text(model.picture == nil ? "Looking in the knowledge packs on this \(S.device)…" : "Reading it on this \(S.device)…")
            .font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.ink2)
        }
      }
      if model.phase == .asking {
        Text("May I check this on the internet?").font(.system(size: 22, weight: .bold)).foregroundStyle(Color.ink)
      }
      if model.verdict != nil || !model.sentences.isEmpty {
        AnswerBubble(head: model.verdict?.text, tone: model.verdict?.tone ?? .plain, sentences: model.sentences.map(\.text),
                     speaking: model.speaking, tag: model.phase == .done ? model.tag : nil) { model.showWhere = true }
      }
      if !model.choices.isEmpty {
        VStack(spacing: 10) {
          ForEach(model.choices) { c in
            Button { model.choose(c) } label: {
              HStack {
                Text(c.label).font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink).multilineTextAlignment(.leading)
                Spacer(minLength: 8)
                Image(systemName: "chevron.right").font(.system(size: 15, weight: .bold)).foregroundStyle(Color.go)
              }
              .padding(.horizontal, 16).frame(minHeight: 54)
              .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
              .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.go.opacity(0.55), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
          }
        }
        .transition(.opacity.combined(with: .move(edge: .bottom)))
      }
    }
    .animation(.weknow(0.25), value: model.choices.count)
  }
}
