// Sheets: choosing a picture, asking before the internet, where the answer came from, what WeKnow remembers.

import PhotosUI
import SwiftUI
import UIKit

enum PickChoice {
  case sample(Sample)
  case image(UIImage)
}

struct PickSheet: View {
  let done: (PickChoice) -> Void
  @State private var item: PhotosPickerItem?
  @State private var camera = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        Text("What should I look at?").font(.system(size: 26, weight: .bold)).foregroundStyle(Color.ink)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
          Button { camera = true } label: { row("camera", "Use the camera") }.buttonStyle(.plain)
        }
        PhotosPicker(selection: $item, matching: .images) { row("photo.on.rectangle", "Choose a photo") }
          .buttonStyle(.plain)
        Text("No camera handy? Try a picture.").font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.ink2)
          .padding(.top, 6)
        ForEach(Sample.all) { s in
          Button { done(.sample(s)) } label: {
            HStack(spacing: 14) {
              if let img = s.image {
                Image(uiImage: img).resizable().scaledToFill().frame(width: 84, height: 64)
                  .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
              }
              VStack(alignment: .leading, spacing: 3) {
                Text(s.title).font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
                Text("“\(s.question)”").font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink2)
              }
              Spacer()
            }
            .padding(12)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(Color.card))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color.hair, lineWidth: 1))
          }
          .buttonStyle(.plain)
          .accessibilityIdentifier("sample-\(s.id)")
        }
      }
      .padding(20)
    }
    .background(Color.bg)
    .onChange(of: item) { _, new in
      guard let new else { return }
      Task {
        if let data = try? await new.loadTransferable(type: Data.self), let img = UIImage(data: data) { done(.image(img)) }
      }
    }
    .fullScreenCover(isPresented: $camera) {
      CameraView { img in
        camera = false
        if let img { done(.image(img)) }
      }
      .ignoresSafeArea()
    }
  }

  private func row(_ icon: String, _ text: String) -> some View {
    HStack(spacing: 12) {
      Image(systemName: icon).font(.system(size: 20, weight: .semibold)).frame(width: 28)
      Text(text).font(.system(size: 19, weight: .bold))
      Spacer()
    }
    .foregroundStyle(Color.ink)
    .padding(.horizontal, 16).frame(minHeight: 56)
    .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color.card))
    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color.line, lineWidth: 1.5))
  }
}

struct CameraView: UIViewControllerRepresentable {
  let done: (UIImage?) -> Void
  func makeUIViewController(context: Context) -> UIImagePickerController {
    let p = UIImagePickerController()
    p.sourceType = .camera
    p.delegate = context.coordinator
    return p
  }
  func updateUIViewController(_ vc: UIImagePickerController, context: Context) {}
  func makeCoordinator() -> Coordinator { Coordinator(done: done) }
  final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    let done: (UIImage?) -> Void
    init(done: @escaping (UIImage?) -> Void) { self.done = done }
    func imagePickerController(_ p: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
      done(info[.originalImage] as? UIImage)
    }
    func imagePickerControllerDidCancel(_ p: UIImagePickerController) { done(nil) }
  }
}

/// UI-SPEC 7.3: one question, the real payload in a dashed blue box, what is not sent, Yes and No.
struct ConsentSheet: View {
  let consent: Consent
  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack(spacing: 10) {
        Image(systemName: "globe").foregroundStyle(Color.net)
        Text("May I check this on the internet?").foregroundStyle(Color.ink)
      }
      .font(.system(size: 24, weight: .bold))
      Text("This \(S.device) cannot check papers by itself. I read the words here, on this \(S.device), and cover your details first. This is all I would send:")
        .font(.system(size: 19, weight: .medium)).foregroundStyle(Color.ink)
      ScrollView {
        Text(consent.lines.joined(separator: "\n"))
          .font(.system(size: 15, weight: .medium, design: .monospaced)).foregroundStyle(Color.ink)
          .frame(maxWidth: .infinity, alignment: .leading).padding(14)
      }
      .background(RoundedRectangle(cornerRadius: 14).fill(Color.netBg))
      .overlay(RoundedRectangle(cornerRadius: 14).stroke(Color.net, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
      Text("Not sent: the picture, your name, phone, address, plate or account number.")
        .font(.system(size: 17, weight: .semibold)).foregroundStyle(Color.ink2)
      HStack(spacing: 12) {
        Button { consent.answer(true) } label: {
          Text("Yes, check it").font(.system(size: 19, weight: .bold)).foregroundStyle(Color.onGo)
            .frame(maxWidth: .infinity, minHeight: 56).background(RoundedRectangle(cornerRadius: 16).fill(Color.go))
        }
        .accessibilityIdentifier("consent-yes")
        Button { consent.answer(false) } label: {
          Text("No").font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(RoundedRectangle(cornerRadius: 16).fill(Color.card))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Color.line, lineWidth: 1.5))
        }
      }
    }
    .padding(20)
    .background(Color.bg.ignoresSafeArea())
  }
}

/// UI-SPEC 7.2: two lanes, always both, then the sources; Technical details closed by default.
struct WhereSheet: View {
  let tag: WhereRan?
  let receipt: Receipt
  @State private var tech = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 18) {
        Text("Where this answer came from").font(.system(size: 26, weight: .bold)).foregroundStyle(Color.ink)
        if let tag { WhereTag(tag: tag) }
        lane("iphone", "Stayed on this \(S.device)", Color.go) {
          ForEach(receipt.stayed, id: \.self) { Text($0) }
        }
        lane("globe", "Went over the internet", Color.net) {
          if receipt.sent.isEmpty {
            Text("Nothing.")
          } else {
            Text(receipt.sent.joined(separator: "\n"))
              .font(.system(size: 15, weight: .medium, design: .monospaced))
              .frame(maxWidth: .infinity, alignment: .leading).padding(12)
              .background(RoundedRectangle(cornerRadius: 12).fill(Color.netBg))
              .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.net, style: StrokeStyle(lineWidth: 1.5, dash: [6, 4])))
            Text("Nothing else was sent.")
          }
        }
        if !receipt.sources.isEmpty {
          VStack(alignment: .leading, spacing: 8) {
            Text("Where the facts come from").font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
            ForEach(receipt.sources, id: \.label) { s in
              HStack(alignment: .firstTextBaseline) {
                Text(s.label).foregroundStyle(Color.ink)
                Spacer()
                Text(s.date).foregroundStyle(Color.ink2)
              }
              .font(.system(size: 17, weight: .medium))
            }
          }
        }
        DisclosureGroup(isExpanded: $tech) {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(receipt.tech, id: \.self) { Text($0) }
            ForEach(receipt.sources.filter { !$0.url.isEmpty }, id: \.label) { Text($0.url) }
          }
          .font(.system(size: 15, weight: .medium)).foregroundStyle(Color.ink2)
          .frame(maxWidth: .infinity, alignment: .leading).padding(.top, 6)
        } label: {
          Text("Technical details").font(.system(size: 19, weight: .bold)).foregroundStyle(Color.ink)
        }
        .tint(Color.ink)
        .accessibilityIdentifier("tech-details")
      }
      .padding(20)
    }
    .background(Color.bg.ignoresSafeArea())
    .presentationDetents([.large])
  }

  private func lane<C: View>(_ icon: String, _ title: String, _ color: Color, @ViewBuilder _ content: () -> C) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Image(systemName: icon).foregroundStyle(color)
        Text(title).foregroundStyle(Color.ink)
      }
      .font(.system(size: 19, weight: .bold))
      VStack(alignment: .leading, spacing: 6) { content() }
        .font(.system(size: 17, weight: .medium)).foregroundStyle(Color.ink)
        .padding(.leading, 30)
    }
  }
}
