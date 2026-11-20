// The conversation: the person's messages on the right (their picture with personal details covered, their words),
// WeKnow's answers on the left (the point in bold, a small tag only when it matters, the sentences, where it ran),
// and under the latest answer the next questions as big buttons. It scrolls; nothing needs managing.

import SwiftUI
import WebKit

struct ConversationView: View {
  @Bindable var model: AskModel
  let reduceMotion: Bool
  let showWhere: (AskModel.Exchange) -> Void
  @State private var viewing: ViewedPicture?

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 18) {
          ForEach(model.thread) { ex in
            PersonBubble(text: ex.question, picture: ex.picture) { viewing = ViewedPicture(image: $0) }
            AnswerBubble(head: ex.head, tone: ex.tone, facts: ex.facts, sentences: ex.sentences, speaking: nil, tag: ex.tag) { showWhere(ex) }
          }
          // The question in progress.
          if model.picture != nil {
            VStack(alignment: .trailing, spacing: 8) {
              PictureWindow(model: model, reduceMotion: reduceMotion)
                .frame(height: 280)
                .overlay(alignment: .bottomTrailing) { EnlargeBadge() }
                .contentShape(Rectangle())
                .onTapGesture {
                  if let p = model.picture {
                    viewing = ViewedPicture(image: annotated(p, bars: Array(model.bars.prefix(model.barsShown)), marks: model.marks))
                  }
                }
                .accessibilityAddTraits(.isButton)
                .accessibilityHint("Opens the picture full screen")
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
      .fullScreenCover(item: $viewing) { PhotoViewer(picture: $0) }
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

/// The person's message: a soft grey bubble on the right.
struct PersonBubble: View {
  let text: String?
  let picture: UIImage?
  var open: ((UIImage) -> Void)? = nil

  var body: some View {
    VStack(alignment: .trailing, spacing: 6) {
      if let picture {
        Image(uiImage: picture).resizable().scaledToFit().frame(maxWidth: 260, maxHeight: 260)
          .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          .overlay(alignment: .bottomTrailing) { if open != nil { EnlargeBadge() } }
          .onTapGesture { open?(picture) }
          .accessibilityLabel("Your picture, with personal details covered")
          .accessibilityAddTraits(open != nil ? .isButton : [])
      }
      if let text, !text.isEmpty {
        Text(text).font(.system(size: 17)).foregroundStyle(Color.ink)
          .padding(.horizontal, 16).padding(.vertical, 11)
          .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(Color.card2))
          .fixedSize(horizontal: false, vertical: true)
      }
    }
    .frame(maxWidth: .infinity, alignment: .trailing)
    .padding(.leading, 48)
  }
}

/// One answer, as plain text on the page: a small tag only for Careful or Stop, the point, the sentences, where it ran.
struct AnswerBubble: View {
  let head: String?
  let tone: Tone
  var facts: [String] = []
  let sentences: [String]
  let speaking: Int?
  let tag: WhereRan?
  let openWhere: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      if tone == .warn || tone == .stop {
        Label(tone == .stop ? "Stop" : "Careful", systemImage: tone == .stop ? "hand.raised.fill" : "exclamationmark.triangle.fill")
          .font(.system(size: 13, weight: .semibold))
          .foregroundStyle(tone == .stop ? Color.stop : Color.warnInk)
          .padding(.horizontal, 9).padding(.vertical, 3)
          .background(Capsule().fill(tone == .stop ? Color.stopBg : Color.warnBg))
      }
      if let head {
        Text(head).font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.ink)
          .fixedSize(horizontal: false, vertical: true)
      }
      if !facts.isEmpty {
        // What the paper says, listed, so nobody has to read the small print themselves.
        VStack(alignment: .leading, spacing: 6) {
          ForEach(facts, id: \.self) { f in
            HStack(alignment: .firstTextBaseline, spacing: 8) {
              Circle().fill(Color.ink2).frame(width: 5, height: 5).offset(y: -3)
              Text(f).font(.system(size: 16)).foregroundStyle(Color.ink).fixedSize(horizontal: false, vertical: true)
            }
          }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.card2))
      }
      ForEach(Array(sentences.enumerated()), id: \.offset) { i, s in
        Text(s).font(.system(size: 17)).lineSpacing(4)
          .foregroundStyle(speaking == nil || speaking == i ? Color.ink : Color.ink2)
          .fixedSize(horizontal: false, vertical: true)
      }
      if let tag {
        Button(action: openWhere) { WhereTag(tag: tag) }
          .buttonStyle(.plain)
          .accessibilityHint("Shows where this answer came from")
      }
    }
    .padding(.trailing, 12)
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// The live light while WeKnow works: two lamps, one lit. The phone lamp while the phone works alone; the internet
/// lamp only while a request is on its way, with the exact covered words under it. A press says what they mean.
struct WorkingLight: View {
  let online: String?
  let picture: Bool
  let explain: () -> Void

  var body: some View {
    let net = online != nil
    Button(action: explain) {
      VStack(alignment: .leading, spacing: 10) {
        HStack(spacing: 10) {
          Lamps(net: net)
          Text(net ? "Asking the internet one question…" : picture ? "Reading it on this \(S.device)…" : "Looking in the knowledge packs on this \(S.device)…")
            .font(.system(size: 16, weight: .medium)).foregroundStyle(net ? Color.net : Color.ink2)
            .multilineTextAlignment(.leading)
        }
        if let online {
          Text(online)
            .font(.system(size: 15, weight: .medium, design: .monospaced)).foregroundStyle(Color.ink)
            .multilineTextAlignment(.leading)
            .frame(maxWidth: .infinity, alignment: .leading).padding(12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Color.netBg))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.net, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
          Text("Only these words. Your picture and personal details stay on this \(S.device).")
            .font(.system(size: 14)).foregroundStyle(Color.ink2).multilineTextAlignment(.leading)
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(net ? "Asking the internet one question: \(online ?? "")" : "Working on this \(S.device). Nothing is leaving it.")
    .accessibilityHint("Says what the two lights mean")
    .accessibilityIdentifier("working-light")
    .animation(.weknow(0.25), value: net)
  }
}

/// The two lamps: this phone, the internet. Exactly one is lit while WeKnow works.
struct Lamps: View {
  let net: Bool
  var lit: Bool = true
  @State private var pulse = false

  var body: some View {
    HStack(spacing: 6) {
      lamp("lock.iphone", on: lit && !net, color: Color.go)
      lamp("globe", on: lit && net, color: Color.net)
    }
    .padding(.horizontal, 8).padding(.vertical, 6)
    .background(Capsule().fill(Color.card2))
    .onAppear { withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) { pulse = true } }
  }

  private func lamp(_ symbol: String, on: Bool, color: Color) -> some View {
    Image(systemName: symbol)
      .font(.system(size: 15, weight: .semibold))
      .foregroundStyle(on ? Color.white : Color.ink2.opacity(0.45))
      .frame(width: 30, height: 30)
      .background(Circle().fill(on ? color : Color.clear))
      .overlay(Circle().stroke(color.opacity(on ? (pulse ? 0.0 : 0.55) : 0), lineWidth: on ? (pulse ? 7 : 1) : 0))
  }
}

/// The answer being worked out and said now, then the next questions.
struct LiveAnswer: View {
  @Bindable var model: AskModel

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if model.phase == .looking {
        WorkingLight(online: model.online, picture: model.picture != nil) { model.showLights = true }
      }
      if model.phase == .asking {
        Text("May I check this on the internet?").font(.system(size: 18, weight: .semibold)).foregroundStyle(Color.ink)
      }
      if model.verdict != nil || !model.sentences.isEmpty {
        AnswerBubble(head: model.verdict?.text, tone: model.verdict?.tone ?? .plain, facts: model.facts, sentences: model.sentences.map(\.text),
                     speaking: model.speaking, tag: model.phase == .done ? model.tag : nil) { model.showWhere = true }
      }
      if model.phase == .done, let html = model.searchChips {
        SearchChips(html: html).frame(height: 70)
      }
      if !model.choices.isEmpty {
        FlowLayout(spacing: 8) {
          ForEach(model.choices) { c in Pill(text: c.label) { model.choose(c) } }
        }
        .padding(.top, 2)
        .transition(.opacity)
      }
    }
    .animation(.weknow(0.25), value: model.choices.count)
  }
}

/// Google's search-suggestion chip, shown with an answer grounded in Google Search, as Google asks.
struct SearchChips: UIViewRepresentable {
  let html: String
  func makeUIView(context: Context) -> WKWebView {
    let v = WKWebView()
    v.isOpaque = false
    v.backgroundColor = .clear
    v.scrollView.isScrollEnabled = false
    v.navigationDelegate = context.coordinator
    v.loadHTMLString("<meta name=viewport content='width=device-width,initial-scale=1'>" + html, baseURL: nil)
    return v
  }
  func updateUIView(_ v: WKWebView, context: Context) {}
  func makeCoordinator() -> Coordinator { Coordinator() }
  final class Coordinator: NSObject, WKNavigationDelegate {
    /// A tap on a suggestion opens Google in Safari, not inside the chip.
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
      if a.navigationType == .linkActivated, let u = a.request.url { UIApplication.shared.open(u); decisionHandler(.cancel) } else { decisionHandler(.allow) }
    }
  }
}
