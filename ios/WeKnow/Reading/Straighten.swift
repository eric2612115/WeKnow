// A photo of a paper is rarely square-on. Before the words are read, the paper is found in the photo (Apple's
// document segmentation, on the phone) and pulled flat, the way a document scanner does, so the rows of a dense
// bill or quote line up again. If no clear paper is found, the photo is used as it is.

import CoreImage
import Vision

enum Straighten {
  static let context = CIContext()

  static func document(_ image: CGImage) -> CGImage? {
    let request = VNDetectDocumentSegmentationRequest()
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    guard (try? handler.perform([request])) != nil,
          let doc = request.results?.first, doc.confidence > 0.6 else { return nil }
    let w = CGFloat(image.width), h = CGFloat(image.height)
    func pt(_ p: CGPoint) -> CGPoint { CGPoint(x: p.x * w, y: p.y * h) } // Vision: normalised, origin bottom-left, like Core Image
    let tl = pt(doc.topLeft), tr = pt(doc.topRight), bl = pt(doc.bottomLeft), br = pt(doc.bottomRight)
    // Skip when the paper already fills the photo square-on, or when what was found is too small to be the paper.
    let area = abs((tr.x - bl.x) * (tl.y - br.y))
    guard area > w * h * 0.2 else { return nil }
    let inset = [doc.topLeft, doc.topRight, doc.bottomLeft, doc.bottomRight].map { min($0.x, 1 - $0.x, $0.y, 1 - $0.y) }
    if inset.allSatisfy({ $0 < 0.02 }) { return nil }
    let input = CIImage(cgImage: image)
    guard let f = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
    f.setValue(input, forKey: kCIInputImageKey)
    f.setValue(CIVector(cgPoint: tl), forKey: "inputTopLeft")
    f.setValue(CIVector(cgPoint: tr), forKey: "inputTopRight")
    f.setValue(CIVector(cgPoint: bl), forKey: "inputBottomLeft")
    f.setValue(CIVector(cgPoint: br), forKey: "inputBottomRight")
    guard let out = f.outputImage else { return nil }
    return context.createCGImage(out, from: out.extent)
  }
}
