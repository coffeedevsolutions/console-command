import ExpoModulesCore
import MediaPlayer

// Native bridge over MPMusicPlayerController.systemMusicPlayer — this controls the
// REAL system Apple Music app, so play/pause/skip/queue changes also change what the
// iPad is streaming over Bluetooth to the console.
//
// IMPORTANT (build-once, OTA-forever): every capability the JS/UI will ever need must
// exist here, because adding a native method later requires a new build. The surface
// below (transport + state + artwork + library browse + queue) is intentionally broad
// so the entire Now Playing feature can be built and iterated purely over the air.
public class AppleMusicModule: Module {
  private let player = MPMusicPlayerController.systemMusicPlayer
  private var isObserving = false
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("AppleMusic")

    Events("onNowPlayingChange", "onPlaybackStateChange")

    // MARK: - Authorization (needs NSAppleMusicUsageDescription in Info.plist)
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      MPMediaLibrary.requestAuthorization { status in
        promise.resolve(AppleMusicModule.authString(status))
      }
    }

    Function("getAuthorizationStatus") { () -> String in
      return AppleMusicModule.authString(MPMediaLibrary.authorizationStatus())
    }

    // MARK: - Transport
    Function("play") { self.player.play() }
    Function("pause") { self.player.pause() }
    Function("stop") { self.player.stop() }
    Function("togglePlayPause") {
      if self.player.playbackState == .playing { self.player.pause() } else { self.player.play() }
    }
    Function("next") { self.player.skipToNextItem() }
    Function("previous") { self.player.skipToPreviousItem() }
    Function("skipToBeginning") { self.player.skipToBeginning() }
    Function("seek") { (seconds: Double) in self.player.currentPlaybackTime = seconds }
    Function("setShuffleMode") { (mode: String) in self.player.shuffleMode = AppleMusicModule.shuffleMode(mode) }
    Function("setRepeatMode") { (mode: String) in self.player.repeatMode = AppleMusicModule.repeatMode(mode) }

    // MARK: - State
    Function("getNowPlaying") { () -> [String: Any]? in return self.nowPlayingInfo() }
    Function("getPlaybackState") { () -> [String: Any] in return self.playbackInfo() }

    // Artwork can be large; fetch on demand as a data URI at a requested pixel size.
    AsyncFunction("getArtwork") { (size: Int, promise: Promise) in
      let dim = size > 0 ? size : 512
      guard let item = self.player.nowPlayingItem,
            let artwork = item.artwork,
            let image = artwork.image(at: CGSize(width: dim, height: dim)),
            let data = image.pngData() else {
        promise.resolve(nil)
        return
      }
      promise.resolve("data:image/png;base64," + data.base64EncodedString())
    }

    // MARK: - Library browse
    AsyncFunction("getPlaylists") { () -> [[String: Any]] in return self.allPlaylists() }
    AsyncFunction("getSongs") { (playlistId: String) -> [[String: Any]] in return self.songs(inPlaylistId: playlistId) }

    // MARK: - Queue control
    Function("playPlaylist") { (playlistId: String) in self.playPlaylist(playlistId) }
    Function("playStoreIDs") { (ids: [String]) in
      self.player.setQueue(with: ids)
      self.player.play()
    }
    Function("appendStoreIDs") { (ids: [String]) in
      self.player.append(MPMusicPlayerStoreQueueDescriptor(storeIDs: ids))
    }
    Function("prependStoreIDs") { (ids: [String]) in
      self.player.prepend(MPMusicPlayerStoreQueueDescriptor(storeIDs: ids))
    }

    // MARK: - Observation lifecycle
    OnStartObserving { self.beginObserving() }
    OnStopObserving { self.endObserving() }
    OnDestroy { self.endObserving() }
  }

  // MARK: - Helpers

  private func nowPlayingInfo() -> [String: Any]? {
    guard let item = player.nowPlayingItem else { return nil }
    return [
      "persistentID": String(item.persistentID),
      "title": item.title ?? "",
      "artist": item.artist ?? "",
      "albumTitle": item.albumTitle ?? "",
      "albumArtist": item.albumArtist ?? "",
      "genre": item.genre ?? "",
      "duration": item.playbackDuration,
      "isExplicit": item.isExplicitItem,
      "hasArtwork": item.artwork != nil
    ]
  }

  private func playbackInfo() -> [String: Any] {
    let t = player.currentPlaybackTime
    return [
      "state": AppleMusicModule.stateString(player.playbackState),
      "currentTime": t.isFinite ? t : 0,
      "shuffleMode": AppleMusicModule.shuffleString(player.shuffleMode),
      "repeatMode": AppleMusicModule.repeatString(player.repeatMode),
      "indexOfNowPlayingItem": player.indexOfNowPlayingItem
    ]
  }

  private func allPlaylists() -> [[String: Any]] {
    guard let collections = MPMediaQuery.playlists().collections else { return [] }
    return collections.compactMap { collection in
      guard let playlist = collection as? MPMediaPlaylist else { return nil }
      let pid = (playlist.value(forProperty: MPMediaPlaylistPropertyPersistentID) as? NSNumber)?.uint64Value ?? 0
      return [
        "id": String(pid),
        "name": playlist.name ?? "Untitled",
        "count": playlist.count
      ]
    }
  }

  private func songs(inPlaylistId id: String) -> [[String: Any]] {
    guard let pid = UInt64(id) else { return [] }
    let query = MPMediaQuery.playlists()
    query.addFilterPredicate(MPMediaPropertyPredicate(value: NSNumber(value: pid),
                                                      forProperty: MPMediaPlaylistPropertyPersistentID))
    guard let collection = query.collections?.first else { return [] }
    return collection.items.map { item in
      [
        "persistentID": String(item.persistentID),
        "title": item.title ?? "",
        "artist": item.artist ?? "",
        "albumTitle": item.albumTitle ?? "",
        "duration": item.playbackDuration
      ]
    }
  }

  private func playPlaylist(_ id: String) {
    guard let pid = UInt64(id) else { return }
    let query = MPMediaQuery.playlists()
    query.addFilterPredicate(MPMediaPropertyPredicate(value: NSNumber(value: pid),
                                                      forProperty: MPMediaPlaylistPropertyPersistentID))
    guard let collection = query.collections?.first else { return }
    player.setQueue(with: collection)
    player.play()
  }

  private func beginObserving() {
    if isObserving { return }
    isObserving = true
    player.beginGeneratingPlaybackNotifications()
    let nc = NotificationCenter.default
    let o1 = nc.addObserver(forName: .MPMusicPlayerControllerNowPlayingItemDidChange,
                            object: player, queue: .main) { [weak self] _ in
      guard let self = self else { return }
      self.sendEvent("onNowPlayingChange", self.nowPlayingInfo() ?? [:])
    }
    let o2 = nc.addObserver(forName: .MPMusicPlayerControllerPlaybackStateDidChange,
                            object: player, queue: .main) { [weak self] _ in
      guard let self = self else { return }
      self.sendEvent("onPlaybackStateChange", self.playbackInfo())
    }
    observers = [o1, o2]
  }

  private func endObserving() {
    if !isObserving { return }
    isObserving = false
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers = []
    player.endGeneratingPlaybackNotifications()
  }

  // MARK: - Enum <-> String

  private static func authString(_ s: MPMediaLibraryAuthorizationStatus) -> String {
    switch s {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }

  private static func stateString(_ s: MPMusicPlaybackState) -> String {
    switch s {
    case .playing: return "playing"
    case .paused: return "paused"
    case .stopped: return "stopped"
    case .interrupted: return "interrupted"
    case .seekingForward: return "seekingForward"
    case .seekingBackward: return "seekingBackward"
    @unknown default: return "unknown"
    }
  }

  private static func shuffleString(_ m: MPMusicShuffleMode) -> String {
    switch m {
    case .off: return "off"
    case .songs: return "songs"
    case .albums: return "albums"
    case .default: return "default"
    @unknown default: return "unknown"
    }
  }

  private static func shuffleMode(_ s: String) -> MPMusicShuffleMode {
    switch s {
    case "songs": return .songs
    case "albums": return .albums
    case "off": return .off
    default: return .default
    }
  }

  private static func repeatString(_ m: MPMusicRepeatMode) -> String {
    switch m {
    case .none: return "none"
    case .one: return "one"
    case .all: return "all"
    case .default: return "default"
    @unknown default: return "unknown"
    }
  }

  private static func repeatMode(_ s: String) -> MPMusicRepeatMode {
    switch s {
    case "one": return .one
    case "all": return .all
    case "none": return .none
    default: return .default
    }
  }
}
