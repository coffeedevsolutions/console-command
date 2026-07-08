import ExpoModulesCore
import ShazamKit
import AVFoundation

// Native ShazamKit primitive for "Now Spinning" (vinyl recognition on the Phono source).
// ONE-SHOT by design: JS calls recognizeOnce(timeout), we open the mic, stream ~a few seconds
// to the Shazam catalog matcher, resolve the first match (or null), and tear the audio session
// DOWN every time. No long-lived native session, no native scheduling — the OS mic indicator
// only shows during a capture. All cadence/behavior (the 2-min sleep, the duration-timed
// boundary burst) lives in JS so it ships/tunes over the air. See NOW_SPINNING_PLAN.md.
//
// build-once / OTA-forever: this surface is intentionally the minimum JS will ever need.
public class NowSpinningModule: Module {
  private var recognizer: ShazamRecognizer?

  public func definition() -> ModuleDefinition {
    Name("NowSpinning")

    // Listen up to `timeoutSec` seconds; resolve the first match as a dict, or null on
    // no-match/timeout/error. Cancels any capture already in flight.
    AsyncFunction("recognizeOnce") { (timeoutSec: Double, promise: Promise) in
      DispatchQueue.main.async {
        self.recognizer?.cancel()
        let rec = ShazamRecognizer()
        self.recognizer = rec
        rec.start(timeout: timeoutSec) { [weak self] result in
          self?.recognizer = nil
          promise.resolve(result)
        }
      }
    }

    AsyncFunction("requestMicPermission") { (promise: Promise) in
      AVAudioSession.sharedInstance().requestRecordPermission { granted in
        promise.resolve(granted ? "granted" : "denied")
      }
    }

    Function("micPermissionStatus") { () -> String in
      switch AVAudioSession.sharedInstance().recordPermission {
      case .granted:      return "granted"
      case .denied:       return "denied"
      case .undetermined: return "undetermined"
      @unknown default:   return "undetermined"
      }
    }

    OnDestroy {
      self.recognizer?.cancel()
      self.recognizer = nil
    }
  }
}

// MARK: - Streaming recognizer (SHSession + AVAudioEngine mic tap, iOS 15+)

private final class ShazamRecognizer: NSObject, SHSessionDelegate {
  private let session = SHSession()          // default Shazam catalog
  private let engine = AVAudioEngine()
  private var completion: (([String: Any]?) -> Void)?
  private var finished = false
  private var timeoutWork: DispatchWorkItem?
  private var startTime: Date?

  func start(timeout: Double, completion: @escaping ([String: Any]?) -> Void) {
    self.completion = completion
    self.startTime = Date()
    session.delegate = self

    do {
      let audioSession = AVAudioSession.sharedInstance()
      try audioSession.setCategory(.record, mode: .default)
      try audioSession.setActive(true)

      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, when in
        self?.session.matchStreamingBuffer(buffer, at: when)
      }
      engine.prepare()
      try engine.start()
    } catch {
      finish(nil)
      return
    }

    // We enforce the listen window ourselves; ShazamKit keeps matching as buffers arrive.
    let work = DispatchWorkItem { [weak self] in self?.finish(nil) }
    timeoutWork = work
    DispatchQueue.main.asyncAfter(deadline: .now() + max(2.0, timeout), execute: work)
  }

  func cancel() { finish(nil) }

  // SHSessionDelegate
  func session(_ session: SHSession, didFind match: SHMatch) {
    guard let item = match.mediaItems.first else { finish(nil); return }
    let latency = startTime.map { Date().timeIntervalSince($0) } ?? 0

    // Omit nils rather than bridging Optional-as-Any; JS reads missing keys as undefined.
    var payload: [String: Any] = [
      "matchOffset": item.predictedCurrentMatchOffset,  // seconds into the track (Mode-A "O")
      "listenLatency": latency,                         // seconds this capture took
    ]
    if let v = item.title { payload["title"] = v }
    if let v = item.artist { payload["artist"] = v }
    if let v = item.artworkURL?.absoluteString { payload["artworkURL"] = v }
    if let v = item.appleMusicID { payload["appleMusicID"] = v }  // → MusicKit for duration
    if let v = item.isrc { payload["isrc"] = v }
    if let v = item.subtitle { payload["subtitle"] = v }
    finish(payload)
  }

  func session(_ session: SHSession, didNotFindMatchFor signature: SHSignature, error: Error?) {
    // Streaming keeps feeding buffers, so a single no-match isn't terminal — let the
    // timeout resolve null after the full listen window.
  }

  private func finish(_ result: [String: Any]?) {
    DispatchQueue.main.async {
      guard !self.finished else { return }
      self.finished = true
      self.timeoutWork?.cancel()
      self.timeoutWork = nil
      if self.engine.isRunning {
        self.engine.inputNode.removeTap(onBus: 0)
        self.engine.stop()
      }
      try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
      let cb = self.completion
      self.completion = nil
      cb?(result)
    }
  }
}
