// A bill or quote from Files: a PDF that came by email, or a picture or screenshot. A PDF's first pages are drawn
// into one tall picture at print sharpness, so the same on-phone reading, covering and marks apply. The file is
// read here and never uploaded.

import PDFKit
import UIKit

enum PaperFile {
  static func image(from url: URL) -> UIImage? {
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    if url.pathExtension.lowercased() == "pdf" || (try? url.resourceValues(forKeys: [.contentTypeKey]).contentType?.conforms(to: .pdf)) == true {
      guard let doc = PDFDocument(url: url) else { return nil }
      return render(doc)
    }
    guard let data = try? Data(contentsOf: url) else { return nil }
    return UIImage(data: data)
  }

  /// Page 1 (and 2 when there is one), stacked, about 1700 px wide.
  static func render(_ doc: PDFDocument) -> UIImage? {
    let pages = (0..<min(doc.pageCount, 2)).compactMap { doc.page(at: $0) }
    guard !pages.isEmpty else { return nil }
    let width: CGFloat = 1700
    let sizes = pages.map { p -> CGSize in
      let b = p.bounds(for: .mediaBox)
      return CGSize(width: width, height: width * b.height / max(b.width, 1))
    }
    let total = CGSize(width: width, height: sizes.map(\.height).reduce(0, +))
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: total, format: format).image { ctx in
      UIColor.white.setFill()
      ctx.fill(CGRect(origin: .zero, size: total))
      var y: CGFloat = 0
      for (p, size) in zip(pages, sizes) {
        let b = p.bounds(for: .mediaBox)
        ctx.cgContext.saveGState()
        ctx.cgContext.translateBy(x: 0, y: y + size.height)
        ctx.cgContext.scaleBy(x: size.width / b.width, y: -size.height / b.height)
        p.draw(with: .mediaBox, to: ctx.cgContext)
        ctx.cgContext.restoreGState()
        y += size.height
      }
    }
  }
}
