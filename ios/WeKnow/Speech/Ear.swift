// Listening for a spoken question. Speech is turned into words on this phone (on-device recognition); when the
// phone cannot do that, WeKnow says so and the person types instead. Audio is never kept or sent.

import AVFoundation
import Observation
import Speech

@MainActor
@Observable
final class Ear {
  enum State: Equatable { case idle, listening, unavailable(String) }

  var state: State = .idle
  var heard = ""
  /// 0...1, for the bars while listening.
  var level: Double = 0

  @ObservationIgnored private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
  @ObservationIgnored private var engine: AVAudioEngine?
  @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
  @ObservationIgnored private var job: SFSpeechRecognitionTask?
  @ObservationIgnored private var silence: Task<Void, Never>?

  var listening: Bool { state == .listening }

  /// Starts listening; `onDone` gets the words once the person stops talking (about 1.6 s of quiet) or presses again.
  func start(onDone: @escaping (String) -> Void) async {
    stop()
    heard = ""
    guard await Self.allowed() else {
      state = .unavailable("Speaking needs the microphone and speech recognition. You can turn them on in Settings, or type instead.")
      return
    }
    guard let recognizer, recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
      state = .unavailable("This \(S.device) cannot turn speech into words by itself. Please type instead.")
      return
    }
    Voice.shared.stop()
    do {
      let session = AVAudioSession.sharedInstance()
      try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
      try session.setActive(true, options: .notifyOthersOnDeactivation)

      let req = SFSpeechAudioBufferRecognitionRequest()
      req.requiresOnDeviceRecognition = true
      req.shouldReportPartialResults = true
      req.addsPunctuation = true
      request = req

      let engine = AVAudioEngine()
      self.engine = engine
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
        req.append(buffer)
        let level = Self.rms(buffer)
        Task { @MainActor in self?.level = level }
      }
      engine.prepare()
      try engine.start()
      state = .listening

      job = recognizer.recognitionTask(with: req) { [weak self] result, error in
        Task { @MainActor in
          guard let self else { return }
          if let result {
            self.heard = result.bestTranscription.formattedString
            self.quietTimer(onDone)
            if result.isFinal { self.finish(onDone) }
          } else if error != nil, self.listening {
            self.finish(onDone)
          }
        }
      }
      // Nobody spoke at all: stop after 7 seconds.
      silence = Task { [weak self] in
        try? await Task.sleep(for: .seconds(7))
        guard let self, !Task.isCancelled, self.heard.isEmpty else { return }
        self.finish(onDone)
      }
    } catch {
      stop()
      state = .unavailable("I couldn’t start listening. Please type instead.")
    }
  }

  /// Done talking: the words so far are the question.
  func finishNow(_ onDone: @escaping (String) -> Void) { finish(onDone) }

  func stop() {
    silence?.cancel()
    silence = nil
    engine?.stop()
    engine?.inputNode.removeTap(onBus: 0)
    engine = nil
    request?.endAudio()
    request = nil
    job?.cancel()
    job = nil
    level = 0
    if state == .listening { state = .idle }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
  }

  private func finish(_ onDone: (String) -> Void) {
    guard listening else { return }
    let words = heard.trimmingCharacters(in: .whitespacesAndNewlines)
    stop()
    onDone(words)
  }

  private func quietTimer(_ onDone: @escaping (String) -> Void) {
    silence?.cancel()
    silence = Task { [weak self] in
      try? await Task.sleep(for: .milliseconds(1600))
      guard let self, !Task.isCancelled else { return }
      self.finish(onDone)
    }
  }

  private static func allowed() async -> Bool {
    let speech: Bool = await withCheckedContinuation { c in
      SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
    }
    guard speech else { return false }
    return await AVAudioApplication.requestRecordPermission()
  }

  nonisolated private static func rms(_ buffer: AVAudioPCMBuffer) -> Double {
    guard let ch = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
    var sum: Float = 0
    for i in 0..<Int(buffer.frameLength) { sum += ch[i] * ch[i] }
    return min(1, Double(sqrt(sum / Float(buffer.frameLength))) * 12)
  }
}
