// WeKnow's voice: the phone's own speech synthesizer, on the device. Pace 0.92 of normal (UI-SPEC section 9),
// the best English voice installed. One sentence at a time, so the captions can follow.

import AVFoundation

@MainActor
final class Voice: NSObject, AVSpeechSynthesizerDelegate {
  static let shared = Voice()
  private let synth = AVSpeechSynthesizer()
  private var done: CheckedContinuation<Void, Never>?

  /// `-WeKnowMute YES` silences the voice (captions still pace through), for recordings.
  /// Settings › Voice off also silences it; the words still show.
  var muted: Bool { UserDefaults.standard.bool(forKey: "WeKnowMute") || UserDefaults.standard.bool(forKey: Prefs.voiceOff) }

  /// The most natural English voice on the phone. Novelty voices (Bad News, Bubbles, Zarvox...) are never picked;
  /// a Premium or Enhanced voice the person downloaded wins; otherwise the voice they chose in Spoken Content.
  /// Siri's own voices are not open to apps.
  private lazy var voice: AVSpeechSynthesisVoice? = {
    let fallback = AVSpeechSynthesisVoice(language: "en-US")
    let natural = AVSpeechSynthesisVoice.speechVoices().filter {
      $0.language == "en-US" && !$0.voiceTraits.contains(.isNoveltyVoice) && !$0.voiceTraits.contains(.isPersonalVoice)
    }
    func rank(_ v: AVSpeechSynthesisVoice) -> Int {
      v.quality.rawValue * 10 + (v.identifier == fallback?.identifier ? 5 : 0) + (Self.preferred.contains(v.name) ? 2 : 0)
    }
    let pick = natural.max { rank($0) < rank($1) } ?? fallback
    print("WeKnow voice: \(pick?.name ?? "none") (\(pick?.identifier ?? "-"))")
    return pick
  }()

  private static let preferred: Set<String> = ["Ava", "Zoe", "Evan", "Nathan", "Samantha", "Allison", "Susan", "Tom"]

  override init() {
    super.init()
    synth.delegate = self
    for v in AVSpeechSynthesisVoice.speechVoices() where v.language.hasPrefix("en") {
      print("WeKnow voices: \(v.name) \(v.language) q\(v.quality.rawValue) novelty=\(v.voiceTraits.contains(.isNoveltyVoice)) \(v.identifier)")
    }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
  }

  /// Chooses the voice now, so the first answer starts at once and Settings can name it.
  func warmUp() { _ = voice }

  /// The voice WeKnow speaks with, for Settings ("Zoe (Premium)").
  var voiceLabel: String {
    guard let v = voice else { return "System voice" }
    if v.name.contains("(") { return v.name }
    switch v.quality {
    case .premium: return "\(v.name) (Premium)"
    case .enhanced: return "\(v.name) (Enhanced)"
    default: return v.name
    }
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
    // A sentence in another language is read by a voice of that language (the answer is in the person's language).
    let code = Lang.of(spoken)
    u.voice = code == Lang.english ? voice : AVSpeechSynthesisVoice(language: Lang.speech(code)) ?? voice
    u.rate = AVSpeechUtteranceDefaultSpeechRate * Prefs.rate
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
