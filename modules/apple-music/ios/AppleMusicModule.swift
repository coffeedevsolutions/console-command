import ExpoModulesCore
import MediaPlayer
import MusicKit

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
      self.startPlayback()
    }
    Function("appendStoreIDs") { (ids: [String]) in
      self.player.append(MPMusicPlayerStoreQueueDescriptor(storeIDs: ids))
    }
    Function("prependStoreIDs") { (ids: [String]) in
      self.player.prepend(MPMusicPlayerStoreQueueDescriptor(storeIDs: ids))
    }

    // MARK: - Library search / play (MediaPlayer — your added/downloaded songs).
    // Works with the Media Library permission we already have; no MusicKit entitlement.
    AsyncFunction("searchLibrarySongs") { (term: String, limit: Int) -> [[String: Any]] in
      return self.librarySongs(matching: term, limit: limit)
    }
    AsyncFunction("getAllSongs") { (limit: Int) -> [[String: Any]] in
      return self.librarySongs(matching: nil, limit: limit)
    }
    Function("playLibrarySongs") { (persistentIDs: [String]) in
      self.playLibrary(persistentIDs: persistentIDs)
    }

    // MARK: - Apple Music catalog (MusicKit). Requires the "MusicKit" app service to be
    // enabled for the App ID; without it these degrade to empty/nil rather than crash.
    AsyncFunction("requestMusicKitAuthorization") { (promise: Promise) in
      if #available(iOS 15.0, *) {
        Task { promise.resolve(String(describing: await MusicAuthorization.request())) }
      } else { promise.resolve("unavailable") }
    }
    AsyncFunction("searchCatalogSongs") { (term: String, limit: Int, promise: Promise) in
      if #available(iOS 15.0, *) {
        Task { promise.resolve(await self.catalogSearch(term, limit: limit)) }
      } else { promise.resolve([[String: Any]]()) }
    }
    // Reliable artwork for the currently-playing STREAMING track, via its catalog id.
    AsyncFunction("getNowPlayingCatalogArtworkURL") { (size: Int, promise: Promise) in
      let sid = self.player.nowPlayingItem?.playbackStoreID ?? ""
      if #available(iOS 15.0, *), !sid.isEmpty {
        Task { promise.resolve(await self.catalogArtworkURL(storeID: sid, size: size)) }
      } else { promise.resolve(nil) }
    }
    // Full catalog search → { songs, albums, playlists, artists }.
    AsyncFunction("searchCatalog") { (term: String, limit: Int, promise: Promise) in
      if #available(iOS 15.0, *) { Task { promise.resolve(await self.catalogSearchAll(term, limit: limit)) } }
      else { promise.resolve([String: Any]()) }
    }
    // Popular / charts → { songs, playlists }.
    AsyncFunction("getCatalogCharts") { (limit: Int, promise: Promise) in
      if #available(iOS 16.0, *) { Task { promise.resolve(await self.catalogCharts(limit: limit)) } }
      else { promise.resolve([String: Any]()) }
    }
    // "For You" personal recommendations → [{ title, playlists, albums }].
    AsyncFunction("getRecommendations") { (limit: Int, promise: Promise) in
      if #available(iOS 15.0, *) { Task { promise.resolve(await self.recommendationsList(limit: limit)) } }
      else { promise.resolve([[String: Any]]()) }
    }
    // Tracks of a catalog playlist → [songs]. Play them with playStoreIDs(their ids).
    AsyncFunction("getCatalogPlaylistTracks") { (playlistId: String, promise: Promise) in
      if #available(iOS 15.0, *) { Task { promise.resolve(await self.catalogPlaylistTracks(playlistId)) } }
      else { promise.resolve([[String: Any]]()) }
    }
    // Recently-added library songs (MediaPlayer; no MusicKit entitlement needed).
    AsyncFunction("getRecentlyAddedSongs") { (limit: Int) -> [[String: Any]] in
      return self.recentlyAddedSongs(limit: limit)
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
    startPlayback()
  }

  // Reliable cold start: prepare the freshly-set queue, then play (on the main queue).
  private func startPlayback() {
    player.prepareToPlay { [weak self] _ in
      DispatchQueue.main.async { self?.player.play() }
    }
  }

  // MARK: - Library search helpers (MediaPlayer)

  private func librarySongs(matching term: String?, limit: Int) -> [[String: Any]] {
    guard let items = MPMediaQuery.songs().items else { return [] }
    var result = items
    if let t = term?.lowercased(), !t.isEmpty {
      result = items.filter {
        ($0.title?.lowercased().contains(t) ?? false) ||
        ($0.artist?.lowercased().contains(t) ?? false) ||
        ($0.albumTitle?.lowercased().contains(t) ?? false)
      }
    }
    let capped = limit > 0 ? Array(result.prefix(limit)) : result
    return capped.map { item in
      [
        "persistentID": String(item.persistentID),
        "playbackStoreID": item.playbackStoreID, // catalog id if it's an Apple Music item
        "title": item.title ?? "",
        "artist": item.artist ?? "",
        "albumTitle": item.albumTitle ?? "",
        "duration": item.playbackDuration,
        "hasArtwork": item.artwork != nil
      ]
    }
  }

  private func playLibrary(persistentIDs ids: [String]) {
    guard let all = MPMediaQuery.songs().items else { return }
    let wanted = Set(ids.compactMap { UInt64($0) })
    let items = all.filter { wanted.contains($0.persistentID) }
    if items.isEmpty { return }
    player.setQueue(with: MPMediaItemCollection(items: items))
    startPlayback()
  }

  // MARK: - Catalog helpers (MusicKit)

  @available(iOS 15.0, *)
  private func catalogSearch(_ term: String, limit: Int) async -> [[String: Any]] {
    do {
      var request = MusicCatalogSearchRequest(term: term, types: [Song.self])
      request.limit = limit > 0 ? min(limit, 25) : 25
      let response = try await request.response()
      return response.songs.map { song in
        [
          "id": song.id.rawValue,
          "title": song.title,
          "artist": song.artistName,
          "albumTitle": song.albumTitle ?? "",
          "duration": song.duration ?? 0,
          "artworkURL": song.artwork?.url(width: 600, height: 600)?.absoluteString ?? ""
        ]
      }
    } catch {
      return []
    }
  }

  @available(iOS 15.0, *)
  private func catalogArtworkURL(storeID: String, size: Int) async -> String? {
    do {
      let request = MusicCatalogResourceRequest<Song>(matching: \.id, equalTo: MusicItemID(storeID))
      let response = try await request.response()
      guard let song = response.items.first,
            let url = song.artwork?.url(width: size, height: size) else { return nil }
      return url.absoluteString
    } catch {
      return nil
    }
  }

  // MARK: - MusicKit item mappers

  @available(iOS 15.0, *)
  private func songDict(_ s: Song) -> [String: Any] {
    return [
      "id": s.id.rawValue, "title": s.title, "artist": s.artistName,
      "albumTitle": s.albumTitle ?? "", "duration": s.duration ?? 0,
      "artworkURL": s.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
    ]
  }
  @available(iOS 15.0, *)
  private func playlistDict(_ p: Playlist) -> [String: Any] {
    return [
      "id": p.id.rawValue, "name": p.name, "curator": p.curatorName ?? "",
      "artworkURL": p.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
    ]
  }
  @available(iOS 15.0, *)
  private func albumDict(_ a: Album) -> [String: Any] {
    return [
      "id": a.id.rawValue, "title": a.title, "artist": a.artistName,
      "artworkURL": a.artwork?.url(width: 300, height: 300)?.absoluteString ?? ""
    ]
  }
  @available(iOS 15.0, *)
  private func artistDict(_ a: Artist) -> [String: Any] {
    return ["id": a.id.rawValue, "name": a.name]
  }

  // MARK: - Catalog requests (MusicKit)

  @available(iOS 15.0, *)
  private func catalogSearchAll(_ term: String, limit: Int) async -> [String: Any] {
    do {
      var request = MusicCatalogSearchRequest(term: term, types: [Song.self, Album.self, Playlist.self, Artist.self])
      request.limit = limit > 0 ? min(limit, 25) : 25
      let r = try await request.response()
      return [
        "songs": r.songs.map { self.songDict($0) },
        "albums": r.albums.map { self.albumDict($0) },
        "playlists": r.playlists.map { self.playlistDict($0) },
        "artists": r.artists.map { self.artistDict($0) }
      ]
    } catch {
      return ["songs": [], "albums": [], "playlists": [], "artists": []]
    }
  }

  @available(iOS 16.0, *)
  private func catalogCharts(limit: Int) async -> [String: Any] {
    do {
      var request = MusicCatalogChartsRequest(kinds: [.mostPlayed], types: [Song.self, Playlist.self])
      request.limit = limit > 0 ? min(limit, 25) : 20
      let r = try await request.response()
      let songs = r.songCharts.first?.items.map { self.songDict($0) } ?? []
      let playlists = r.playlistCharts.first?.items.map { self.playlistDict($0) } ?? []
      return ["songs": songs, "playlists": playlists]
    } catch {
      return ["songs": [], "playlists": []]
    }
  }

  @available(iOS 15.0, *)
  private func recommendationsList(limit: Int) async -> [[String: Any]] {
    do {
      var request = MusicPersonalRecommendationsRequest()
      request.limit = limit > 0 ? min(limit, 25) : 12
      let r = try await request.response()
      return r.recommendations.map { rec in
        [
          "title": rec.title ?? "",
          "playlists": rec.playlists.map { self.playlistDict($0) },
          "albums": rec.albums.map { self.albumDict($0) }
        ]
      }
    } catch {
      return []
    }
  }

  @available(iOS 15.0, *)
  private func catalogPlaylistTracks(_ id: String) async -> [[String: Any]] {
    do {
      let request = MusicCatalogResourceRequest<Playlist>(matching: \.id, equalTo: MusicItemID(id))
      let r = try await request.response()
      guard let playlist = r.items.first else { return [] }
      let full = try await playlist.with([.tracks])
      guard let tracks = full.tracks else { return [] }
      return tracks.map { track in
        [
          "id": track.id.rawValue, "title": track.title, "artist": track.artistName,
          "albumTitle": "", "duration": track.duration ?? 0,
          "artworkURL": track.artwork?.url(width: 200, height: 200)?.absoluteString ?? ""
        ]
      }
    } catch {
      return []
    }
  }

  // MARK: - Recently added (MediaPlayer library)

  private func recentlyAddedSongs(limit: Int) -> [[String: Any]] {
    guard let items = MPMediaQuery.songs().items else { return [] }
    let sorted = items.sorted { $0.dateAdded > $1.dateAdded }
    let capped = limit > 0 ? Array(sorted.prefix(limit)) : sorted
    return capped.map { item in
      [
        "persistentID": String(item.persistentID),
        "playbackStoreID": item.playbackStoreID,
        "title": item.title ?? "", "artist": item.artist ?? "",
        "albumTitle": item.albumTitle ?? "", "duration": item.playbackDuration,
        "hasArtwork": item.artwork != nil
      ]
    }
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
