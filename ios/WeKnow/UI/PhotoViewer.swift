// Seeing the picture large: tap any picture in the conversation and it fills the screen, with the black bars over
// personal details and the marks WeKnow drew (the high line, the warnings). Pinch or double-tap to zoom, drag to
// move, Done to go back. Small print on a quote is unreadable at bubble size; this is how it gets read.

import SwiftUI
import UIKit

/// A picture to show full screen.
struct ViewedPicture: Identifiable {
  let id = UUID()
  let image: UIImage
}

/// The picture with its cover bars and marks drawn in, at full size, for the viewer and for the conversation.
@MainActor
func annotated(_ image: UIImage, bars: [CoverBar], marks: [Mark]) -> UIImage {
  guard !bars.isEmpty || !marks.isEmpty, image.size.width > 0 else { return image }
  // Marks are sized in points for a phone-width picture; render the picture about that wide, then scale up.
  let width: CGFloat = 420
  let size = CGSize(width: width, height: width * image.size.height / image.size.width)
  let fit = CGRect(origin: .zero, size: size)
  let view = ZStack(alignment: .topLeading) {
    Image(uiImage: image).resizable().frame(width: size.width, height: size.height)
    ForEach(bars) { bar in
      Rectangle().fill(Color.markCover)
        .frame(width: bar.rect.width * size.width + 4, height: bar.rect.height * size.height * 0.9 + 1)
        .position(x: bar.rect.midX * size.width, y: bar.rect.midY * size.height)
    }
    ForEach(marks) { mark in MarkView(mark: mark, fit: fit, animated: false) }
  }
  .frame(width: size.width, height: size.height)
  let renderer = ImageRenderer(content: view)
  renderer.scale = max(2, image.size.width / width)
  return renderer.uiImage ?? image
}

struct PhotoViewer: View {
  let picture: ViewedPicture
  @Environment(\.dismiss) private var dismiss

  var body: some View {
    ZStack(alignment: .top) {
      Color.black.ignoresSafeArea()
      ZoomableImage(image: picture.image).ignoresSafeArea()
      HStack {
        Text("Pinch or double-tap to zoom").font(.system(size: 15, weight: .medium)).foregroundStyle(.white.opacity(0.75))
        Spacer()
        Button { dismiss() } label: {
          Text("Done").font(.system(size: 17, weight: .semibold)).foregroundStyle(.black)
            .padding(.horizontal, 18).frame(height: 44)
            .background(Capsule().fill(.white))
        }
        .accessibilityLabel("Close the picture")
      }
      .padding(.horizontal, 16).padding(.top, 8)
    }
    .background(Color.black.ignoresSafeArea())
    .presentationBackground(.black)
  }
}

/// UIScrollView zooming: pinch, double-tap to 2.5x and back, drag when zoomed.
struct ZoomableImage: UIViewRepresentable {
  let image: UIImage

  func makeUIView(context: Context) -> UIScrollView {
    let scroll = UIScrollView()
    scroll.delegate = context.coordinator
    scroll.minimumZoomScale = 1
    scroll.maximumZoomScale = 6
    scroll.showsHorizontalScrollIndicator = false
    scroll.showsVerticalScrollIndicator = false
    scroll.backgroundColor = .black
    scroll.contentInsetAdjustmentBehavior = .never
    let view = UIImageView(image: image)
    view.contentMode = .scaleAspectFit
    view.isUserInteractionEnabled = true
    view.accessibilityLabel = "The picture, with personal details covered"
    view.isAccessibilityElement = true
    scroll.addSubview(view)
    context.coordinator.imageView = view
    let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.doubleTap(_:)))
    tap.numberOfTapsRequired = 2
    scroll.addGestureRecognizer(tap)
    return scroll
  }

  func updateUIView(_ scroll: UIScrollView, context: Context) {
    DispatchQueue.main.async { context.coordinator.layout(scroll) }
  }

  func makeCoordinator() -> Coordinator { Coordinator() }

  final class Coordinator: NSObject, UIScrollViewDelegate {
    weak var imageView: UIImageView?

    func layout(_ scroll: UIScrollView) {
      guard let v = imageView, scroll.zoomScale == 1 else { return }
      v.frame = scroll.bounds
      scroll.contentSize = scroll.bounds.size
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? { imageView }

    @objc func doubleTap(_ g: UITapGestureRecognizer) {
      guard let scroll = g.view as? UIScrollView, let v = imageView else { return }
      if scroll.zoomScale > 1.01 {
        scroll.setZoomScale(1, animated: true)
      } else {
        let p = g.location(in: v)
        let scale: CGFloat = 2.5
        let w = scroll.bounds.width / scale, h = scroll.bounds.height / scale
        scroll.zoom(to: CGRect(x: p.x - w / 2, y: p.y - h / 2, width: w, height: h), animated: true)
      }
    }
  }
}

/// The small "enlarge" badge on a picture, so it is clear it can be opened.
struct EnlargeBadge: View {
  var body: some View {
    Image(systemName: "arrow.up.left.and.arrow.down.right")
      .font(.system(size: 13, weight: .bold))
      .foregroundStyle(.white)
      .frame(width: 32, height: 32)
      .background(Circle().fill(.black.opacity(0.55)))
      .padding(8)
      .accessibilityHidden(true)
  }
}
