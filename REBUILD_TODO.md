# Rebuild TODO — native changes that CANNOT ship via OTA

The app ships JS updates over the air (`eas update`). Anything **native** (new native
modules/methods, Info.plist keys, permissions, capabilities, icon, native config) is
frozen into the installed build and requires a fresh `eas build`. Park such items here
and do them all together the next time a rebuild is needed.

Current build: runtime `1.0.0`, bundle id `com.whir.consolecommand`, Apple team Whir Inc.

## Queued for next rebuild

### 1. MusicKit — reliable artwork + full catalog search/browse
The current Apple Music module uses the **MediaPlayer** framework (`MPMusicPlayerController` /
`MPMediaQuery`), which only reliably exposes **downloaded/library** content. Streaming
(catalog) artwork is best-effort (we retry in JS, but it can still be nil), and there is
**no catalog search** at all. Fix by adding **MusicKit** (Swift, iOS 15+):

- **Apple Developer portal:** enable the **MusicKit** app service for App ID
  `com.whir.consolecommand` (this provides the entitlement; the MusicKit Swift API then
  handles tokens via `MusicAuthorization.request()` — no manual developer token needed).
- Add native methods to `modules/apple-music/ios/AppleMusicModule.swift`:
  - `searchCatalog(term, limit)` → `MusicCatalogSearchRequest` → songs/albums/artists/playlists
  - `getCatalogArtworkURL(id, w, h)` → `Artwork.url(width:height:)` (reliable streaming art)
  - `playCatalogIDs(ids)` already exists (`playStoreIDs`); confirm it plays catalog results
- JS: extend `modules/apple-music/index.ts` + `hooks/useNowPlaying.js` with the new methods;
  build a search screen (that part is then OTA-iterable).

### 2. Library browse/search via MPMediaQuery (cheaper, library-only)
If a full-catalog search isn't wanted, a smaller add covers the local library:
- `getAllSongs(limit?)` → `MPMediaQuery.songs()`
- `searchLibrary(term)` → `MPMediaQuery` + `MPMediaPropertyPredicate` (title/artist CONTAINS)
- `getAlbums()` / `getArtists()` if useful
These are MediaPlayer additions (no MusicKit), but still native → rebuild.

## Notes
- When rebuilding, also re-verify the one-build-forever assumptions (no new native deps
  slipped in that weren't intended) and keep `runtimeVersion` at `1.0.0` unless there's a
  reason to bump (bumping it orphans the current build from its update channel).
- Splash-hold via `expo-splash-screen` (for a pixel-perfect native→JS handoff) is another
  native-only nicety if ever wanted.
