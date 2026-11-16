// The live camera in the window, so the Ask page opens the way a camera does. The camera button in the input bar takes
// the picture; the picture stays on this phone. Where there is no camera (the simulator) or it is not allowed, the
// window shows its words and the camera button opens the photo picker instead.

import AVFoundation
import Observation
import SwiftUI
import UIKit

@MainActor
@Observable
final class LiveCamera: NSObject {
  enum State: Equatable { case idle, running, unavailable }
  var state: State = .idle

  @ObservationIgnored let session = AVCaptureSession()
  @ObservationIgnored private let output = AVCapturePhotoOutput()
  @ObservationIgnored private var configured = false
  @ObservationIgnored private var pending: CheckedContinuation<UIImage?, Never>?

  func start() async {
    guard state != .running else { return }
    guard AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back) != nil else { state = .unavailable; return }
    let allowed: Bool
    switch AVCaptureDevice.authorizationStatus(for: .video) {
    case .authorized: allowed = true
    case .notDetermined: allowed = await AVCaptureDevice.requestAccess(for: .video)
    default: allowed = false
    }
    guard allowed else { state = .unavailable; return }
    if !configured {
      session.beginConfiguration()
      session.sessionPreset = .photo
      if let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back),
         let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) {
        session.addInput(input)
      }
      if session.canAddOutput(output) { session.addOutput(output) }
      session.commitConfiguration()
      configured = true
    }
    let s = session
    await Task.detached { s.startRunning() }.value
    state = s.isRunning ? .running : .unavailable
  }

  func stop() {
    let s = session
    Task.detached { s.stopRunning() }
    if state == .running { state = .idle }
  }

  /// One still from the live camera.
  func capture() async -> UIImage? {
    guard state == .running else { return nil }
    return await withCheckedContinuation { c in
      pending = c
      output.capturePhoto(with: AVCapturePhotoSettings(), delegate: self)
    }
  }
}

extension LiveCamera: AVCapturePhotoCaptureDelegate {
  nonisolated func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
    let image = photo.fileDataRepresentation().flatMap { UIImage(data: $0) }
    Task { @MainActor in
      self.pending?.resume(returning: image)
      self.pending = nil
    }
  }
}

/// The camera's picture, filling the window.
struct CameraPreview: UIViewRepresentable {
  let session: AVCaptureSession

  final class PreviewView: UIView {
    override class var layerClass: AnyClass { AVCaptureVideoPreviewLayer.self }
    var preview: AVCaptureVideoPreviewLayer { layer as! AVCaptureVideoPreviewLayer }
  }

  func makeUIView(context: Context) -> PreviewView {
    let v = PreviewView()
    v.preview.session = session
    v.preview.videoGravity = .resizeAspectFill
    return v
  }

  func updateUIView(_ uiView: PreviewView, context: Context) {}
}
