# Rebuild TODO — native changes that CANNOT ship via OTA

The app ships JS updates over the air (`eas update`). Anything **native** (new native
modules/methods, Info.plist keys, permissions, capabilities, icon, native config) is
frozen into the installed build and requires a fresh `eas build`. Park such items here
and do them all together the next time a rebuild is needed.

Current build: runtime `1.0.0`, bundle id `com.whir.consolecommand`, Apple team Whir Inc.

## Queued for next rebuild — native code is ALREADY WRITTEN, staged in the module

The Swift methods below are committed in `modules/apple-music/ios/AppleMusicModule.swift`
and exposed (inert) in `modules/apple-music/index.ts`. They are NOT in the current build,
so JS must feature-detect via `AppleMusic.capabilities` before calling. Nothing in the UI
calls them yet. **The next `eas build` picks them up.** No further code needed to enable
the LIBRARY features; the CATALOG features additionally need the Developer-portal step.

### What to do at rebuild time
1. **(Catalog only) Apple Developer portal:** enable the **MusicKit** app service for App ID
   `com.whir.consolecommand`. This grants the entitlement; MusicKit's Swift API then handles
   tokens via `MusicAuthorization.request()` (no manual developer token). Without this, the
   catalog methods just return empty/nil — they won't crash.
2. `eas build -p ios --profile production` (registers the staged native methods).
3. Then build the search UI purely over the air, guarded by `AppleMusic.capabilities`.

### Staged native methods
- **Library (works on rebuild, no entitlement):**
  `searchLibrarySongs`, `getAllSongs`, `playLibrarySongs`, `getRecentlyAddedSongs`
  — MPMediaQuery over your added/downloaded songs (search, list, recently-added, play).
- **Catalog (needs the MusicKit service enabled):**
  `requestMusicKitAuthorization`, `searchCatalogSongs`, `searchCatalog` (songs+albums+
  playlists+artists), `getCatalogCharts` (popular), `getRecommendations` (For You),
  `getCatalogPlaylistTracks`, `getNowPlayingCatalogArtworkURL` (reliable streaming art).
- Podspec links `MusicKit` in addition to `MediaPlayer`. Catalog charts require iOS 16+.
- JS: `AppleMusic.capabilities` gains `recentlyAdded`, `charts`, `recommendations`,
  `catalogPlaylistTracks`, `catalogSearch` — the Library UI already feature-detects these,
  so the SONGS/SEARCH/APPLE-MUSIC parts light up automatically after the rebuild.

## Queued for next rebuild — NOW SPINNING (ShazamKit) · native STAGED, JS shipped

Vinyl recognition on the Phono source — see `NOW_SPINNING_PLAN.md`. Native is staged inert and the
whole JS layer already shipped over the air behind `capabilities.shazam` (false until the build).
Everything below is committed; the **only remaining step is the `eas build`**.

### Staged / done
- ✅ App ID: **ShazamKit** service enabled (portal). MusicKit already queued above (Now Spinning uses
  both: ShazamKit identifies, `AppleMusic.getCatalogSong(id)` gives the track duration).
- ✅ `app.json` → `ios.infoPlist.NSMicrophoneUsageDescription`.
- ✅ `modules/now-spinning/` — Swift `recognizeOnce(timeoutSec)` (SHSession + AVAudioEngine, iOS 15+)
  returning `{ title, artist, artworkURL, appleMusicID, isrc, subtitle, matchOffset, listenLatency }`,
  plus `requestMicPermission` / `micPermissionStatus`. Podspec links `ShazamKit`, `AVFoundation`.
  `index.ts` gates via `capabilities.shazam`.
- ✅ `modules/apple-music`: added `getCatalogSong(id)` (MusicKit) → duration + hi-res art.
- ✅ JS (live, dormant until the build): `hooks/useNowSpinning.js`, `components/NowSpinningCard.js`,
  source-aware panel in `Status.js`, app-wide touch-wake in `App.js`.

### Remaining at rebuild time
1. **Confirm the ShazamKit entitlement/capability** is on the build. Enabling the App-ID service
   provisions it; if EAS needs it in the entitlements file, add via a config plugin / `ios.entitlements`
   and **verify the generated `.entitlements`** after the first build (catalog-match errors ⇒ this).
2. `eas build -p ios --profile production` (bump `ios.buildNumber`). On install, `capabilities.shazam`
   → true and Now Spinning activates on Phono. Iterate everything else over the air.

## Notes
- When rebuilding, also re-verify the one-build-forever assumptions (no new native deps
  slipped in that weren't intended) and keep `runtimeVersion` at `1.0.0` unless there's a
  reason to bump (bumping it orphans the current build from its update channel).
- Splash-hold via `expo-splash-screen` (for a pixel-perfect native→JS handoff) is another
  native-only nicety if ever wanted.
