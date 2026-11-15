// WeKnow's voice: the phone's own speech synthesizer, on the device. Pace 0.92 of normal (UI-SPEC section 9),
// the best English voice installed. One sentence at a time, so the captions can follow.

import AVFoundation

@MainActor
final class Voice: NSObject, AVSpeechSynthesizerDelegate {
  static let shared = Voice()
  private let synth = AVSpeechSynthesizer()
  private var done: CheckedContinuation<Void, Never>?

  /// `-WeKnowMute YES` silences the voice (captions still pace through), for recordings.
  var muted: Bool { UserDefaults.standard.bool(forKey: "WeKnowMute") }

  private lazy var voice: AVSpeechSynthesisVoice? = {
    let en = AVSpeechSynthesisVoice.speechVoices().filter { $0.language == "en-US" }
    return en.max { $0.quality.rawValue < $1.quality.rawValue } ?? AVSpeechSynthesisVoice(language: "en-US")
  }()

  override init() {
    super.init()
    synth.delegate = self
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
  }

  /// Speak one sentence; returns when it has been said or stopped.
  func say(_ text: String) async {
    let spoken = text.replacingOccurrences(of: "“", with: "").replacingOccurrences(of: "”", with: "")
    if muted {
      try? await Task.sleep(for: .milliseconds(max(900, spoken.split(separator: " ").count * 330)))
      return
    }
    stop()
    try? AVAudioSession.sharedInstance().setActive(true)
    let u = AVSpeechUtterance(string: spoken)
    u.voice = voice
    u.rate = AVSpeechUtteranceDefaultSpeechRate * 0.92
    u.postUtteranceDelay = 0.3
    await withCheckedContinuation { c in
      done = c
      synth.speak(u)
    }
  }

  func stop() {
    if synth.isSpeaking { synth.stopSpeaking(at: .immediate) }
    finish()
  }

  private func finish() {
    let c = done
    done = nil
    c?.resume()
  }

  nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didFinish u: AVSpeechUtterance) {
    Task { @MainActor in self.finish() }
  }

  nonisolated func speechSynthesizer(_ s: AVSpeechSynthesizer, didCancel u: AVSpeechUtterance) {
    Task { @MainActor in self.finish() }
  }
}
