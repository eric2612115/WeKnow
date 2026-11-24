// Listening for a spoken question. Speech is turned into words on this phone: Apple's newer on-device speech model
// (SpeechAnalyzer with SpeechTranscriber) when its language files are on the phone, otherwise the older on-device
// recognizer. When the phone can do neither, WeKnow says so and the person types instead. Audio is never kept or sent.

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

  /// The language it listens for.
  @ObservationIgnored let locale: Locale
  @ObservationIgnored private let recognizer: SFSpeechRecognizer?
  @ObservationIgnored private var engine: AVAudioEngine?
  @ObservationIgnored private var silence: Task<Void, Never>?
  // The newer speech model.
  @ObservationIgnored private var analyzer: SpeechAnalyzer?
  @ObservationIgnored private var feed: AsyncStream<AnalyzerInput>.Continuation?
  @ObservationIgnored private var reading: Task<Void, Never>?
  // The older recognizer.
  @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
  @ObservationIgnored private var job: SFSpeechRecognitionTask?

  init(locale: Locale = Locale(identifier: "en-US")) {
    self.locale = locale
    recognizer = SFSpeechRecognizer(locale: locale)
  }

  var listening: Bool { state == .listening }

  /// Starts listening; `onDone` gets the words once the person stops talking (about 1.6 s of quiet) or presses again.
  func start(onDone: @escaping (String) -> Void) async {
    stop()
    heard = ""
    guard await AVAudioApplication.requestRecordPermission() else {
      state = .unavailable("Speaking needs the microphone. You can turn it on in Settings, or type instead.")
      return
    }
    Voice.shared.stop()
    if let transcriber = await Self.readyTranscriber(locale) {
      print("[WeKnow] listening: speech analyzer (\(transcriber.selectedLocales.map(\.identifier).joined(separator: ",")))")
      await startAnalyzer(transcriber, onDone: onDone)
      return
    }
    guard await Self.recognizerAllowed() else {
      state = .unavailable("Speaking needs the microphone and speech recognition. You can turn them on in Settings, or type instead.")
      return
    }
    guard let recognizer, recognizer.isAvailable, recognizer.supportsOnDeviceRecognition else {
      state = .unavailable("This \(S.device) cannot turn speech into words by itself. Please type instead.")
      return
    }
    print("[WeKnow] listening: on-device recognizer")
    startRecognizer(recognizer, onDone: onDone)
  }

  /// Done talking: the words so far are the question.
  func finishNow(_ onDone: @escaping (String) -> Void) { finish(onDone) }

  func stop() {
    silence?.cancel()
    silence = nil
    engine?.stop()
    engine?.inputNode.removeTap(onBus: 0)
    engine = nil
    feed?.finish()
    feed = nil
    reading?.cancel()
    reading = nil
    if let analyzer { Task { await analyzer.cancelAndFinishNow() } }
    analyzer = nil
    request?.endAudio()
    request = nil
    job?.cancel()
    job = nil
    level = 0
    if state == .listening { state = .idle }
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
  }

  // MARK: The newer speech model

  /// A transcriber whose language files are already on the phone, or nil. When they are missing, the phone is asked
  /// to fetch them (Apple's own download, like a keyboard language) so the next question can use them.
  static func readyTranscriber(_ locale: Locale) async -> SpeechTranscriber? {
    guard SpeechTranscriber.isAvailable, let supported = await SpeechTranscriber.supportedLocale(equivalentTo: locale) else {
      print("[WeKnow] speech analyzer: not on this \(S.device) (available \(SpeechTranscriber.isAvailable))")
      return nil
    }
    let transcriber = SpeechTranscriber(locale: supported, preset: .progressiveTranscription)
    let status = await AssetInventory.status(forModules: [transcriber])
    print("[WeKnow] speech analyzer: \(supported.identifier) \(status)")
    switch status {
    case .installed:
      return transcriber
    case .supported:
      Task.detached { try? await AssetInventory.assetInstallationRequest(supporting: [transcriber])?.downloadAndInstall() }
      return nil
    default:
      return nil
    }
  }

  private func startAnalyzer(_ transcriber: SpeechTranscriber, onDone: @escaping (String) -> Void) async {
    do {
      try openMicSession()
      let engine = AVAudioEngine()
      let input = engine.inputNode
      let micFormat = input.outputFormat(forBus: 0)
      guard let format = await SpeechAnalyzer.bestAvailableAudioFormat(compatibleWith: [transcriber], considering: micFormat),
            let converter = AVAudioConverter(from: micFormat, to: format) else { throw CocoaError(.featureUnsupported) }

      let (stream, feed) = AsyncStream<AnalyzerInput>.makeStream()
      let analyzer = SpeechAnalyzer(modules: [transcriber])
      try await analyzer.prepareToAnalyze(in: format)
      self.analyzer = analyzer
      self.feed = feed
      self.engine = engine
      state = .listening

      reading = Task { [weak self] in
        var settled = ""
        do {
          for try await result in transcriber.results {
            let words = String(result.text.characters)
            guard let self, self.listening else { return }
            if result.isFinal { settled += words }
            self.heard = (result.isFinal ? settled : settled + words).trimmingCharacters(in: .whitespaces)
            if !self.heard.isEmpty { self.quietTimer(onDone) }
          }
        } catch {}
        guard let self, self.listening else { return }
        self.finish(onDone)
      }

      input.installTap(onBus: 0, bufferSize: 1024, format: micFormat) { [weak self] buffer, _ in
        if let converted = Self.convert(buffer, with: converter) { feed.yield(AnalyzerInput(buffer: converted)) }
        let level = Self.rms(buffer)
        Task { @MainActor in self?.level = level }
      }
      engine.prepare()
      try engine.start()
      try await analyzer.start(inputSequence: stream)
      nobodySpoke(onDone)
    } catch {
      stop()
      state = .unavailable("I couldn’t start listening. Please type instead.")
    }
  }

  nonisolated private static func convert(_ buffer: AVAudioPCMBuffer, with converter: AVAudioConverter) -> AVAudioPCMBuffer? {
    let format = converter.outputFormat
    if buffer.format == format { return buffer }
    let ratio = format.sampleRate / buffer.format.sampleRate
    let capacity = AVAudioFrameCount((Double(buffer.frameLength) * ratio).rounded(.up)) + 32
    guard let out = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else { return nil }
    var given = false
    var error: NSError?
    converter.convert(to: out, error: &error) { _, status in
      if given { status.pointee = .noDataNow; return nil }
      given = true
      status.pointee = .haveData
      return buffer
    }
    return error == nil && out.frameLength > 0 ? out : nil
  }

  /// Turns a recorded file into words with the newer model (`-WeKnowHear file.wav`, for tests on the phone).
  static func hear(file url: URL, locale: Locale = Locale(identifier: "en-US")) async -> String? {
    guard let transcriber = await readyTranscriber(locale), let file = try? AVAudioFile(forReading: url) else { return nil }
    do {
      let analyzer = SpeechAnalyzer(modules: [transcriber])
      let collect = Task {
        var words = ""
        for try await r in transcriber.results where r.isFinal { words += String(r.text.characters) }
        return words
      }
      _ = try await analyzer.analyzeSequence(from: file)
      try await analyzer.finalizeAndFinishThroughEndOfInput()
      return try await collect.value.trimmingCharacters(in: .whitespaces)
    } catch {
      return nil
    }
  }

  // MARK: The older recognizer

  private func startRecognizer(_ recognizer: SFSpeechRecognizer, onDone: @escaping (String) -> Void) {
    do {
      try openMicSession()
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
      nobodySpoke(onDone)
    } catch {
      stop()
      state = .unavailable("I couldn’t start listening. Please type instead.")
    }
  }

  private static func recognizerAllowed() async -> Bool {
    await withCheckedContinuation { c in
      SFSpeechRecognizer.requestAuthorization { c.resume(returning: $0 == .authorized) }
    }
  }

  // MARK: Shared

  private func openMicSession() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playAndRecord, mode: .measurement, options: [.duckOthers, .defaultToSpeaker])
    try session.setActive(true, options: .notifyOthersOnDeactivation)
  }

  /// Nobody spoke at all: stop after 7 seconds.
  private func nobodySpoke(_ onDone: @escaping (String) -> Void) {
    silence = Task { [weak self] in
      try? await Task.sleep(for: .seconds(7))
      guard let self, !Task.isCancelled, self.heard.isEmpty else { return }
      self.finish(onDone)
    }
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

  nonisolated private static func rms(_ buffer: AVAudioPCMBuffer) -> Double {
    guard let ch = buffer.floatChannelData?[0], buffer.frameLength > 0 else { return 0 }
    var sum: Float = 0
    for i in 0..<Int(buffer.frameLength) { sum += ch[i] * ch[i] }
    return min(1, Double(sqrt(sum / Float(buffer.frameLength))) * 12)
  }
}
