# NOW SPINNING — vinyl recognition via ShazamKit (implementation plan)

Identify the record playing on the turntable and show it as "Now Spinning" while the console
input is **Phono**, using Apple's **ShazamKit** to listen through the iPad mic.

Scope: **no progress bar / no live elapsed display.** We *do* use the identified track's **length**
to time the next listen — recognize a song, then don't listen again until roughly when it should end,
burst-retry at the boundary to catch the next track, and fall back to a plain 2-minute sleep cycle
when we can't. Everything about the *behavior* lives in JS so it's tunable over the air; only the thin
recognition primitive is native.

Current build context: runtime `1.0.0`, bundle id `com.whir.consolecommand`, Apple team Whir Inc.,
iOS min `15.1` (see `modules/apple-music/ios/AppleMusic.podspec`). This is a **native feature → needs
a fresh `eas build`** (not OTA). Bundle it with the MusicKit rebuild already queued in
`REBUILD_TODO.md`.

---

## 1. Behavior spec (the state machine)

Runs **only when console source == `phono`** and the app is foregrounded + focused. One short listen
(~5 s) per attempt — never continuous. Two cadence modes: **A (duration-timed)** while a track is
known, **B (2-minute sleep)** as the fallback.

### The inputs a match gives us
- `duration D` — the track length, from Apple Music (MusicKit) via the match's `appleMusicID`
  (fallback: skip Mode A if unavailable).
- `offset O` — how far into the track we already are, from ShazamKit's `predictedCurrentMatchOffset`.
- `latency L` — wall time the capture+match took (measured in JS).
- ⇒ **time remaining on this track ≈ `D − O`.** (Your simpler "`D − L`" is the special case when we
  catch a track right at its start, where `O ≈ L`; using `O` generalizes it to mid-track catches.)

### Mode A — duration-timed (a track is currently known)
1. On a match, show the track and compute `wait = (D − O) − LEAD` (LEAD ≈ 8 s so we start *just before*
   the track ends). Schedule the boundary burst at `now + wait`. **Do not listen in between.**
2. **Boundary burst** — attempt recognition up to **5 times** (short listens, spaced ~a few seconds so
   they straddle the track change):
   - returns a **different** song than the current one → new track → **restart Mode A** with its
     `D`/`O` (chains track→track accurately).
   - returns the **same** song → still playing / we're early → keep bursting (counts toward the 5).
   - returns **no match** → counts toward the 5.
3. If the 5 attempts finish **without a new song** → drop to **Mode B**.

### Mode B — 2-minute sleep cycle (fallback / nothing known)
| State | Enter when | On result |
|---|---|---|
| **LISTENING** | source→phono, Mode-B tick, or wake | match → **Mode A** · no-match → DORMANT |
| **DORMANT** | a Mode-B listen found no music | wait for a touch, then → LISTENING |

- Re-listen every **120 s**; a match hands off to Mode A, a no-match → **DORMANT**.
- **DORMANT → any interaction while Phono → LISTENING** (immediate, debounced ~1 s). "Interaction" =
  any touch anywhere in the app (see §6 wake wiring). Rapid taps collapse to one wake.

### Global rules
- **Enter Phono** → immediate LISTENING (don't wait for the first ID). First match → Mode A.
- **Leave Phono / background** → OFF; tear down mic + timers; start fresh on return.
- Between listens the **last-known track stays on the card**; the mic is idle (Mode A waits, Mode B
  DORMANT).

Net effect: while a record plays it re-checks *right at each track change* (cheap + timely), and the
moment the side ends and the boundary burst comes up empty, it settles into the 2-minute sleep and
then stops entirely until you touch the app for the next record.

> **Silence vs. unrecognized (known limitation):** a plain no-match can't tell "silent" from "music
> playing but not in Shazam's catalog." Acceptable for v1 (it just falls to Mode B / DORMANT sooner).
> Optional refinement in §10 (N3): return the capture **RMS** so JS keeps retrying when there *is*
> sound but no match, and only sleeps on true silence.

---

## 2. Architecture — thin native, fat JS

Follows the same split as `apple-music`: the native module exposes the smallest stable surface, and
all product behavior is JS (OTA-tunable so the 2-min interval, dormancy, and UI can change without a
rebuild).

```
NowSpinning (native, rebuild)                useNowSpinning (JS hook, OTA)
  recognizeOnce(timeoutSec) → match|null  ←  owns the state machine + 120s timer
  requestMicPermission()                     gates on source==phono, focus, AppState
  micPermissionStatus()                      exposes wake() for the touch hook
  capabilities.shazam (feature flag)         feeds the "Now Spinning" card
```

- **Native = one-shot listener.** JS calls `recognizeOnce`; native spins up the mic + a `SHSession`,
  returns the first match (or null on timeout), and tears the audio session **down** every time.
  No long-lived native session, no native scheduling — the OS mic indicator only shows during the
  ~few-second capture.
- **JS = everything else.** The cadence, dormancy, wake, and card are JS, so we can iterate the whole
  UX over the air once the native primitive is in a build.
- **Reuses MusicKit.** Mode A's track **duration** comes from the `AppleMusic` catalog lookup on the
  match's `appleMusicID` — the MusicKit surface already queued for the same rebuild (`REBUILD_TODO.md`).
  So Now Spinning needs **both** services enabled on the App ID (ShazamKit *and* MusicKit), but no new
  native work beyond the ShazamKit primitive.

---

## 3. Turn on ShazamKit (enablement walkthrough)

Three things must be true for `recognizeOnce` to work in a build. All are **rebuild-time**.

### 3a. Apple Developer portal — enable the ShazamKit App Service (like you did MusicKit)
1. developer.apple.com → **Certificates, Identifiers & Profiles → Identifiers**.
2. Open App ID **`com.whir.consolecommand`**.
3. Under **App Services / Additional Capabilities**, check **ShazamKit** → **Save**.
   - This provisions catalog matching for the app; the next `eas build` pulls a provisioning profile
     that includes it. (Same mechanism as the MusicKit service — no manual developer token needed.)
   - While you're here, confirm **MusicKit** is also enabled (already queued in `REBUILD_TODO.md`) —
     Mode A's duration lookup needs it. Now Spinning wants **both** services on this App ID.

### 3b. `app.json` — add the mic permission string
ShazamKit records a short mic sample, so iOS requires a usage description (Android already lists
`RECORD_AUDIO`). Add under `ios.infoPlist`:
```json
"NSMicrophoneUsageDescription": "Console listens for a few seconds to identify the record playing on your turntable."
```
(Sits alongside the existing `NSAppleMusicUsageDescription` / `NSLocalNetworkUsageDescription`.)

### 3c. Native module — link ShazamKit + add the capability entitlement
- Add `ShazamKit` to the module podspec `s.frameworks` (see §5) and `import ShazamKit` in Swift.
- Ensure the **ShazamKit capability/entitlement** is present on the build. In bare Xcode this is the
  "ShazamKit" capability toggle; under EAS/Expo, add it via a small **config plugin** (or an
  `ios.entitlements` entry) so `expo prebuild` writes it and EAS signs with the ShazamKit-enabled
  profile from 3a. **Verify** the generated `.entitlements` after the first build; if catalog matches
  return errors, the capability/profile is the usual culprit.

### 3d. Rebuild
`eas build -p ios --profile production` (bump `ios.buildNumber`). Native change → new binary, **not**
an OTA. After it's installed, the JS `capabilities.shazam` flips true and the feature can be built /
iterated over the air.

---

## 4. Device / iOS notes
- **Reliable path: `SHSession` + `AVAudioEngine` mic tap** (iOS 15+). Install a tap on the input node,
  feed buffers to `session.matchStreamingBuffer(_:at:)`, resolve on the first `SHMatch` or a timeout.
  This avoids version-gating and works on the whole 15.1+ range the podspec targets.
- `SHManagedSession` (iOS 17+) is simpler (it manages the audio session) — optional fast-path when
  available, but not required. Keep the `SHSession` path as the baseline so nothing depends on the
  iPad's max iOS.
- **Network:** default catalog matching needs connectivity. Offline → treat as no-match → DORMANT,
  and surface a subtle "offline" hint.
- **Mic contention:** the future mic visualizer (`react-native-audio-api`) also wants the input node.
  Only one `AVAudioEngine` input tap can run at a time — coordinate so a `recognizeOnce` capture and
  the visualizer never run simultaneously (e.g. pause the visualizer during a listen).

---

## 5. Native module design (`modules/now-spinning`, mirrors `apple-music`)

New Expo local module so it's isolated from the MediaPlayer module (or fold into `apple-music` if you
prefer one bridge — separate is cleaner). Files:

- `modules/now-spinning/expo-module.config.json` → `{ "platforms": ["apple"], "apple": { "modules": ["NowSpinningModule"] } }`
- `modules/now-spinning/ios/NowSpinning.podspec` → depends on `ExpoModulesCore`; `s.frameworks = 'ShazamKit', 'AVFoundation'`
- `modules/now-spinning/ios/NowSpinningModule.swift`
- `modules/now-spinning/index.ts` → TS wrapper + `capabilities` gate (mirror `apple-music/index.ts`)

**Swift surface (staged broad, per build-once/OTA-forever):**
```
AsyncFunction("recognizeOnce") { (timeoutSec: Double, promise) -> ... }
   // start AVAudioEngine input tap → SHSession.matchStreamingBuffer
   // on first SHMatch resolve {
   //   title, artist, artworkURL, appleMusicID, isrc, subtitle,
   //   matchOffset,                 // SHMatchedMediaItem.predictedCurrentMatchOffset (Mode-A "O")
   //   shazamDuration,              // SHMediaItem duration IF present (often nil → use MusicKit)
   //   rms                          // mean input level over the capture (§1 silence gate, N3)
   // }
   // resolve null on timeout/no-match; ALWAYS stop engine + deactivate session in a defer
AsyncFunction("requestMicPermission") { ... AVAudioApplication.requestRecordPermission ... }
Function("micPermissionStatus") { -> String }   // 'granted' | 'denied' | 'undetermined'
```
- **`matchOffset` and `appleMusicID` are load-bearing for Mode A** (§1): offset = where we are in the
  track; `appleMusicID` → MusicKit fetches the authoritative **duration** (and album/art). Return them
  now so the whole cadence is buildable over the air without another native change.
- Shazam sometimes carries a duration; prefer MusicKit's when the field is nil.
- Include `rms` now so the §1 silence refinement stays pure-JS later.
- `index.ts`: `capabilities = { shazam: typeof Native?.recognizeOnce === 'function' }`; every method
  routed through `requireNative()` so the current build no-ops instead of crashing.

---

## 6. JS layer (OTA once the native primitive ships)

### `hooks/useNowSpinning.js`
```
useNowSpinning({ source, isFocused }) → { state, track, listen, wake }
```
- Owns the §1 two-mode machine (Mode-A duration timer + Mode-B 120 s timer), both on the
  focus/AppState-gated interval pattern from `useConnection`/Phase 1 so they pause off-screen and in
  background.
- **Mode A math (JS):** on a match, `remaining = duration − matchOffset`; if `duration` is missing,
  fetch it via `AppleMusic` catalog lookup on `appleMusicID` (MusicKit); if still unknown, skip A and
  use B. Schedule the boundary burst at `remaining − LEAD`; run ≤5 spaced `recognizeOnce` calls;
  first *different* `appleMusicID` → restart A, else after 5 → B. Track "previous song" by
  `appleMusicID`.
- `capabilities.shazam` false → hook is inert (`state: 'unsupported'`); UI hides the card.
- Mic permission: request lazily on first Phono entry; denied → `state: 'denied'` with a Settings hint.
- All knobs — LEAD, burst count (5), burst spacing, listen window, 120 s — are JS constants, tunable
  over the air.

### Interaction-wake wiring (the "touch anywhere" trigger)
Wrap the app content (or at least the Status screen) in a View that observes — but does **not**
capture — touch starts, so it can't interfere with buttons:
```jsx
<View style={{ flex: 1 }} onStartShouldSetResponderCapture={() => { nowSpinning.wake(); return false; }}>
```
`wake()` only acts when `source === 'phono' && state === 'DORMANT'` (debounced ~1 s), so normal
control taps on other screens are ignored.

### Integration with the command center
- `screens/Status.js` mini "Now Playing" panel becomes **source-aware**:
  - source == `bluetooth` → existing Apple Music Now Playing (the `nowPlaying` provider).
  - source == `phono` → **Now Spinning** card driven by `useNowSpinning`.
- `source` already comes from `useConnection().source` — no new plumbing.

---

## 7. UI states (Now Spinning card)
- **LISTENING** — "Identifying record…" with a subtle pulse.
- **SHOWING** — artwork + title + artist (+ "from _Album_" if enriched), small `◎ Powered by Shazam`.
- **DORMANT** — quiet prompt: "Paused — tap anywhere to identify the next record."
- **denied / unsupported / offline** — one-line hint, card otherwise hidden.

Reuse the schematic Panel + TransportIcons styling; artwork via the match's `artworkURL`.

---

## 8. Battery / privacy / attribution
- ~5-second listen every 120 s while music plays; **zero** listening once DORMANT until you touch the
  app. Cheap on the always-on iPad.
- iOS shows the **orange mic dot** during each capture (expected; call it out in onboarding copy).
- Apple requires visible **"Powered by Shazam"** attribution wherever results appear.
- Never records/persists audio — buffers are streamed to the matcher and discarded.

## 9. Edge cases
- Mic denied → graceful `denied` state, deep-link to Settings.
- Offline / catalog miss / unrecognized pressing → no-match → DORMANT (N3 RMS gate softens this).
- Rapid Phono↔Bluetooth flips → tear down the engine cleanly on every OFF.
- Backgrounding mid-listen → cancel capture, deactivate session.
- Simultaneous mic use with the visualizer → mutual exclusion (§4).

---

## 10. Phasing
- **N1 — native (rebuild, bundle with MusicKit build):** `modules/now-spinning` — `recognizeOnce`,
  mic permission, `capabilities.shazam`. Portal ShazamKit service + `NSMicrophoneUsageDescription` +
  entitlement (§3). Ship inert (no UI calls it yet), exactly like the staged MusicKit methods.
- **N2 — JS (OTA after N1 is installed):** `useNowSpinning` — the full two-mode machine (Mode A
  duration-timed + boundary burst, Mode B sleep/wake), MusicKit duration lookup, wake wiring, and the
  source-aware Now Spinning card. The whole feature, fully OTA — tune LEAD / burst count / 120 s freely.
- **N3 — JS/optional (OTA):** richer card (album name + hi-res art + "up next" from the tracklist);
  the RMS silence gate; and eventually the "record library" idea (map your vinyl to Apple Music albums
  for constrained, faster matching and instant tracklists).

## 11. Verification
- Play a record near the iPad on Phono → within one listen the card should name the track.
- Let the side end → within ~2 min it goes DORMANT and the mic dot stops.
- Touch the app → it re-listens immediately.
- Check: mic-permission prompt/flow, offline → DORMANT + hint, source flip tear-down, background
  pause/resume, and that control taps elsewhere don't spuriously wake it.

## 12. Decisions (locked)
- **Card:** reuse the existing Now Playing panel — on Phono it relabels to **"Now Spinning"** and
  renders a little **vinyl record whose center label is the album art**, spinning while identifying.
- **Wake scope:** **any touch app-wide** — a capture-phase responder on the app root
  (`App.js`) fires `wakeSignal.fire()`; the hook only acts on it from DORMANT (debounced).
- **Module:** **separate** `modules/now-spinning` (ShazamKit); durations come from a new
  `AppleMusic.getCatalogSong(id)` on the existing MusicKit module.
- **Listen window:** start ~6 s (`LISTEN_TIMEOUT`), tune over the air.

## 13. Status (this commit)
- ✅ **Native staged** (inert until the `eas build`): `modules/now-spinning` (`recognizeOnce`,
  `requestMicPermission`, `micPermissionStatus`); `AppleMusic.getCatalogSong(id)` for durations;
  `NSMicrophoneUsageDescription` in `app.json`.
- ✅ **JS built + shipped OTA, gated on `capabilities.shazam`** (false in the current build, so it's
  dormant and the live app is unchanged): `hooks/useNowSpinning.js` (the two-mode machine),
  `components/NowSpinningCard.js` (spinning vinyl), Status panel is source-aware, App.js touch-wake.
- ⏳ **Remaining = the rebuild.** Enable ShazamKit + MusicKit on the App ID (done: ShazamKit),
  `eas build -p ios`. On install, `capabilities.shazam` flips true and Now Spinning lights up on
  Phono — then iterate purely over the air.
