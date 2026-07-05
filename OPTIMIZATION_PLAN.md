# Optimization Plan — performance, thermal & battery

Companion to `CODE_AUDIT.md`. This turns the audit into **phased, hardware-safety-analyzed
work**. The build is **fully functional today**; the guiding rule is *do not change what the
physical console does* unless an item explicitly, intentionally changes a hardware behavior
(each such case is called out).

**Device reality:** iPad 7 (A10, passively cooled) with the screen forced on (`useKeepAwake`),
talking to an ESP32 console over HTTP and to Apple Music via a native module. So continuous
CPU/radio wake and the always-on backlight are the dominant drains.

**Scope:** main app (command center, Now Playing, Library, lights) + shared/app-wide impact.
The Grundig1 detailed panel's internals are out of scope except the shared store.

### How to read each item
> **Impact** · **Hardware-safety** (does it change console behavior?) · **Files** · **Effort**
> (XS<1h / S 1–2h / M ~½day / L 1–2d) · **Research** · **OTA?**

Phases are ordered safest-first. All Phase 0–4 work ships via `eas update` (JS only); Phase 5 is
native/firmware (rebuild/reflash), reviewed to the same depth.

---

## Phase A — Remove dead & hardware-impossible functionality · *do first; shrinks everything below* (app: OTA · firmware: next flash)
Two features don't match reality and should be **deleted, not optimized**. Doing this first
removes ~1000+ LOC, a whole 3s poll, and **nullifies the only hardware-visible caveat in the plan
(1.3)**.

### A.1 Remove the LED "segments" (vent/main can't be differentiated in hardware)
- **Why:** the addressable LEDs all follow a single instruction set — there is no independent
  per-zone color/brightness. The two-segment model (lid + vent + linked mode) can't do anything the
  hardware honors.
- **Impact:** deletes `components/LedSegmentCard.js` (606 LOC), `hooks/useLedSegments.js` (407), the
  linked-sync effect, and the `/api/segments/status` 3s poll. Keep **`LidLightCard`** as the single
  lighting controller (color, brightness, on/off, presets). Optionally move the `ColorPicker` color
  wheel into `LidLightCard` (nicer than its RGB text inputs) instead of deleting it.
- **Hardware-safety:** ✅ app removal is safe — the lid controller drives the whole (mirrored) strip.
  **Firmware pairing (next flash):** revert `applyLedBrightness` to a single whole-strip fill and
  drop `/api/segments/*` + vent state; the current two-zone renderer assumes per-pixel addressing the
  hardware doesn't have.
- **Files (app, OTA):** delete `LedSegmentCard.js`, `hooks/useLedSegments.js`; remove from
  `screens/Status.js`; drop the `setSegment*`/`getSegmentStatus` methods in `api/dspClient.js`.
  **Firmware:** `console-esp/console-esp32/console-esp32.ino`.
- **Nullifies Phase 1.3** (no app-orchestrated LED sync remains).
- **Effort:** S (app) · **Research:** decide ColorPicker fate. · **OTA:** app ✅ / firmware ❌

### A.2 Remove the lock code
- **Why:** unused; the 6-digit-PIN-to-lock-the-console feature isn't wanted.
- **Impact:** deletes the Lock Code panel, the `lockCode`/`passwordLocked` threading through the
  hooks/cards, the `?code=` (`withCode`) plumbing in `dspClient`, and `SET_LOCK_CODE`/`global.lockCode`
  in the Grundig store. Simplifies many signatures. **Also moots the Phase 1.4 lock-code-wipe bug**
  (no lock code to wipe).
- **Hardware-safety:** ✅ firmware defaults to unlocked, so `/api/lock` + `requireCodeIfLocked` sit
  dormant — removing the app side changes nothing physical. **Firmware pairing (optional, next
  flash):** delete `/api/lock` + the gates for tidiness.
- **Files (app, OTA):** `screens/Status.js` (panel + lockCode), `hooks/useLidLight.js`,
  `screens/Library.js` + `hooks/useNowPlaying`/`NowPlaying.js` (drop the `code`/`lockCode` args on
  `setSource`/lidlight calls), `api/dspClient.js` (drop `withCode`), `grundig1Store.js`. **Firmware
  (optional):** `console-esp32.ino`.
- **Effort:** S–M · **Research:** grep every `lockCode`/`passwordLocked`/`code` usage. · **OTA:** app ✅ / firmware ❌ (optional)

---

## Phase 0 — Render & log hygiene · *zero hardware risk* (OTA)
Pure CPU/GC wins. Nothing here touches a network call or a hardware command, so the console
behaves identically.

### 0.1 Memoize static components
- **Impact:** `Status` re-renders every 1–4s (poll `setState`s) and `NowPlaying` ~2×/s; each
  re-render currently re-builds the full-screen SVG `DottedGrid` (Defs/Pattern/2 Rects) and other
  static children. Memoizing stops that. Cheapest sustained-CPU win.
- **Hardware-safety:** none — display only.
- **Files:** `components/ui/DottedGrid.js` (props are static defaults → `React.memo` safe; still
  re-renders on rotation via its internal `useWindowDimensions`), `components/ui/Panel.js`,
  `components/ui/TransportIcons.js`, the nav rows in `Status.js`.
- **Effort:** XS · **Research:** none · **OTA:** ✅

### 0.2 Silence debug logging
- **Impact:** ~76 `console.*` in app source. No per-frame flood, but the **3s segment poll emits
  ~5 logs/tick continuously** (`useLedSegments.refresh` + `dspClient.getSegmentStatus`) and every
  hardware POST logs. Each crosses the JS bridge. Removing them cuts steady bridge traffic.
- **Hardware-safety:** none.
- **Files:** `hooks/useLedSegments.js` (40), `api/dspClient.js` (14), `components/LidLightCard.js`
  (10), `hooks/useLidLight.js` (9), `components/LedSegmentCard.js` (3), `grundig1Store.js` (5).
  Delete or wrap in `if (__DEV__)`.
- **Effort:** S · **Research:** none · **OTA:** ✅

### 0.3 Remove the duplicated lid-light poll
- **Impact:** `/api/lidlight/status` is polled **twice** — `Status.js:50` `useLidLight(3000)` and
  `LidLightCard.js:30` its own `useLidLight(1000)`. Halves (removes) one poller and the 1s cadence.
- **Hardware-safety:** ✅ safe, minor UX trade. `LidLightCard` currently ignores the `lidLightState`
  prop and runs its own hook; thread the shared 3s instance in instead. Only *externally-driven*
  state (physical lid open, another client) reflects 1s→3s slower; user edits stay optimistic, and
  a lid open→closed transition still does an 800ms follow-up fetch + mount refresh. The physical
  light is unaffected (firmware-owned).
- **Files:** `screens/Status.js` (pass `lidLightState` to `LidLightCard`), `components/LidLightCard.js`
  (consume prop, drop own `useLidLight`).
- **Effort:** S · **Research:** confirm the segment linked-sync still reads the same instance (it
  reads the Status 3s instance — unchanged). · **OTA:** ✅

---

## Phase 1 — Poll coordination & focus-gating · *the main battery/thermal win* (OTA)
Today, whenever `Status` is mounted (it stays mounted under pushed screens), these run with **no
blur/background pausing**: connection 4s, lid 3s (+1s dupe until Phase 0.3), segments 3s, plus the
app-wide Grundig 5s. Every request wakes the Wi-Fi radio (high-power tail ~seconds). This phase
makes polling **focus-aware, background-aware, and coordinated**.

### 1.1 `useFocusedInterval` utility
- **Impact:** one reusable hook = a `setInterval` that **pauses on screen blur** (`useIsFocused`,
  react-navigation) and **on `AppState` background**, resuming (with an immediate refresh) on
  focus/foreground. Applied to every poller so nothing polls while its screen is covered or the app
  is backgrounded. This is the single biggest software battery/heat lever.
- **Hardware-safety:** ✅ for connection & lid *display*. `source`/`locked` come back fresh because
  `switchSource` already calls `reconnectNow()` and AppState-`active` re-reads. ⚠️ **one real
  hardware caveat below (1.3).**
- **Files (new):** `hooks/useFocusedInterval.js`. **Refactor:** `hooks/useConnection.js`,
  `hooks/useLidLight.js`, `hooks/useLedSegments.js` to use it.
- **Effort:** M · **Research:** confirm `useIsFocused` is available (react-navigation is installed);
  decide resume-refresh cadence. · **OTA:** ✅

### 1.2 `useDeviceState` coordinator (optional within this phase)
- **Impact:** replace 3 independent timers (status/lidlight/segments) with **one** coordinator that
  owns a single timer and batches the GETs at a unified cadence, distributed via context — fewer,
  aligned radio wakes instead of 3 overlapping schedules. (Full collapse to one *request* needs the
  firmware endpoint in Phase 5.2.)
- **Hardware-safety:** ✅ display only; must preserve each consumer's current fields.
- **Files (new):** `hooks/useDeviceState.js` (+ a provider like the Grundig store pattern).
  Consumers: `Status.js`, `LidLightCard.js`, `LedSegmentCard.js`.
- **Effort:** L · **Research:** map every field each hook exposes so nothing regresses. · **OTA:** ✅

### 1.3 ~~Linked-segment sync caveat~~ — REMOVED by Phase A.1
No longer applies: the LED segments and their app-orchestrated sync are deleted in A.1, so **no
hardware-visible polling tradeoff remains** — the lid-light poll is purely display state. Phase 5.3
(firmware link-mode) is dropped for the same reason.

### 1.4 Gate the Grundig store's 5s poll
- **Impact:** `grundig1Store.js:471-491` fetches full `/api/state` every 5s **app-wide** (the
  provider wraps all screens) even though only the Grundig1 screen uses it. Gate it to that screen.
- **Hardware-safety:** ✅ **and it fixes a bug** — the SYNC reducer drops `global.lockCode`, so the
  poll currently **wipes the user-typed lock code every 5s**. Only `Status`/`Library` read `lockCode`
  (local state); neither needs the device sync. Gating stops the wipe and a full fetch every 5s.
- **Files:** `screens/grundig1/state/grundig1Store.js` (start the interval only when the Grundig1
  screen is mounted/focused), or move the sync into `screens/grundig1/index.js`.
- **Effort:** S · **Research:** verify no non-grundig consumer relies on synced fields (confirmed:
  they only read `lockCode`). · **OTA:** ✅

### 1.5 Slow the Now-Playing position poll on the command center
- **Impact:** `Status.js:51` runs `useNowPlaying({pollMs:1000})` purely for the mini-bar's live
  timestamp — a native call every second, forever, on the main screen (plus a 2nd instance at 500ms
  when NowPlaying is open). Track/artist/state already arrive via **change events**; drop the
  mini-bar's position poll (events-only) and lose only the advancing `0:00`.
- **Hardware-safety:** none (Apple Music native reads, not the console).
- **Files:** `screens/Status.js`, `hooks/useNowPlaying.js` (allow `pollMs: 0` / events-only). Fully
  realized by Phase 2.
- **Effort:** S · **OTA:** ✅

---

## Phase 2 — Now Playing consolidation (OTA)

### 2.1 `NowPlayingProvider`
- **Impact:** today two `useNowPlaying` instances run when NowPlaying is open (double auth reads,
  double event subscriptions, two timers). A single shared provider = one auth read, one event
  subscription, one **adaptive** position timer: **off** for the mini-bar (events-only), **500ms only
  while the NowPlaying screen is focused**.
- **Hardware-safety:** none (music module). Preserve: auth lifecycle (`getAuthorizationStatus` +
  `requestAuth`), the `controls` object with its optimistic follow-up reads, and the per-track
  artwork retry/`loadArtwork` distinction so the mini-bar stays lightweight.
- **Files (new):** `hooks/useNowPlaying` → provider/context; consumers `Status.js`, `NowPlaying.js`,
  `Library.js`. Mirror the Grundig store context shape.
- **Effort:** M · **Research:** wrap-point in `App.js`; confirm event unsubscribe on unmount. · **OTA:** ✅

### 2.2 Isolate the progress bar
- **Impact:** the 500ms position tick `setState`s at the `NowPlaying` root, re-rendering the artwork
  `Image` + `DottedGrid` + transport just to move the fill. Extract a memoized `<ProgressBar>` that
  owns the ticking `pb` (needs `currentTime` + `track.duration`), leaving the rest static.
- **Hardware-safety:** none.
- **Files:** `screens/NowPlaying.js`.
- **Effort:** S · **OTA:** ✅

---

## Phase 3 — Replace hand-rolled sliders (OTA)
- **Impact:** `LidLightCard`, `LedSegmentCard`, and `CustomSlider.js` implement sliders via
  `PanResponder` + manual `measure()` + debounce timers (~hundreds of LOC, much of the remaining
  logging). `@react-native-community/slider` is **installed and unused** — native, smoother, far
  less JS/re-render.
- **Hardware-safety:** ⚠️ must preserve the "don't flood the ESP32 during a drag" behavior. Current
  code POSTs **only 1500ms after release** (never per-frame). Migration rule: drive the thumb from
  `onValueChange` (display only, no network) and **POST from `onSlidingComplete`** (fires once on
  release). Also keep the poll-suppression guard (`isDragging`) so an in-flight poll doesn't yank
  the thumb mid-drag.
- **Files:** `components/LidLightCard.js`, `components/LedSegmentCard.js`, delete
  `components/CustomSlider.js`.
- **Effort:** M · **Research:** verify Slider props on the installed version; keep the color-picker
  (`ColorPicker.js`, SVG) as-is. · **OTA:** ✅

---

## Phase 4 — Store correctness: `enhancedDispatch` stale state (OTA)
- **Impact:** `grundig1Store.js:614-620` queues `{action, state}` with the **pre-update** closure
  `state`, so the debounced `pushToArduino` sends the **previous** value for every device-write
  action (master, source, EQ, channel, limiter, generator, sequencer, preset). This is the same
  class of bug that caused the earlier source flip-flop; it still affects the Grundig1 screen.
- **Hardware-safety:** ⚠️ this **corrects** a wrong hardware value — verify each write on-device.
- **Files:** `screens/grundig1/state/grundig1Store.js` (push `action` payload or the reducer's next
  state, not closure `state`).
- **Effort:** S · **Research:** re-test the Grundig1 controls end-to-end. · **OTA:** ✅

---

## Phase 5 — Non-OTA (next rebuild / firmware) · reviewed the same
These need a native build or a firmware flash, so batch them with other native work.

### 5.1 Auto-dim on inactivity (biggest battery/heat lever) — native
- **Impact:** the always-on backlight is the dominant power/heat source. Add **`expo-brightness`**:
  dim the backlight after N minutes with no touch, restore on tap — keeps "always-on" while cutting
  a large fraction of display draw. Even ~40% dimming is significant on the A10 LCD.
- **Hardware-safety:** display only; add a wake-on-touch handler so controls are never hidden behind
  a dim veil unexpectedly.
- **Files (new):** a `useAutoDim` hook + root touch handler in `App.js`; `expo-brightness` dep +
  config. **Rebuild required** (native module).
- **Effort:** M · **Research:** `expo-brightness` restore-on-background behavior; N-minute default.
  · **OTA:** ❌ (bundle into the MusicKit rebuild already planned in `REBUILD_TODO.md`).

### 5.2 Consolidated `GET /api/state` (firmware) → single app poll
- **Impact:** add one ESP32 endpoint returning connection+source+lidlight+segments so the Phase 1.2
  coordinator collapses from 3 requests to **one** per cycle — the biggest reduction in radio wakes.
- **Hardware-safety:** additive endpoint; existing endpoints stay for compatibility.
- **Files:** `console-esp/console-esp32/console-esp32.ino` (new handler reusing existing state
  serializers). **Firmware rebuild + flash.**
- **Effort:** M · **Research:** JSON size vs `StaticJsonDocument` capacity on the ESP32-S3. · **OTA:** ❌

### 5.3 ~~Firmware link-mode~~ — DROPPED (superseded by Phase A.1)
Segments are removed entirely, so there's nothing to link. Instead, the paired firmware task is
**revert `applyLedBrightness` to a single whole-strip fill and delete the `/api/segments/*`
endpoints + vent state** (next flash), matching the hardware that drives all LEDs identically.

### 5.4 Optional: drop `react-native-audio-api`
- **Impact:** FFmpeg-backed, currently baked but **unused**; adds binary size + a little startup.
  Keep if the mic-visualizer is still planned; otherwise drop at a rebuild to reclaim size.
- **Effort:** XS · **OTA:** ❌ (native).

---

## Phase 6 — UX features, built to the perf rules above (OTA) · *shipped*

New user-facing features are held to the same render/network discipline as the optimization
phases — no feature is allowed to reintroduce the drag Phase 0–2 removed.

### 6.1 Collapse the lid-light color wheel into a dropdown
- **Feature:** the SVG `ColorPicker` wheel now lives behind a `Custom Color ▾` toggle in
  `LidLightCard` instead of always being on screen.
- **Perf tie-in:** the wheel is **conditionally rendered** (`{colorOpen && <ColorPicker/>}`), so
  the SVG isn't mounted or re-rendered while collapsed — it costs nothing until opened. Aligns with
  Phase 0.1 (stop rendering heavy SVG on every tick).
- **Files:** `components/LidLightCard.js`. **Effort:** XS · **OTA:** ✅.

### 6.2 Alphabet scrubber on the Library browse lists
- **Feature:** a vertical A–Z index down the right edge of the Playlists/Songs lists; drag a finger
  to jump to that letter's first entry (iOS Contacts-style). Browse lists are now sorted
  alphabetically so the index is meaningful. Search results are left in match order (no scrubber).
- **Perf tie-in — three plan patterns applied at once:**
  - **`getItemLayout` + fixed `ROW_HEIGHT`** → O(1) `scrollToIndex` and no per-row measurement pass;
    also makes FlatList virtualization cheaper for the 300-song list.
  - **Memoized `Row`** (`React.memo`) with stable primitive/callback props (`onPress` is a
    `useCallback`, `arg` is a primitive/stable ref) → rows skip re-render on unrelated parent
    setState; only the row whose `active` flag flips re-renders on selection. Directly realizes the
    Phase 0.1 memoization goal for the list.
  - **Touch-tracked scrubbing without per-frame work** → the `ScrubBar` responder fires
    `scrollToIndex` **only when the letter under the finger changes** (guarded by a `lastRef`), so a
    drag is a handful of O(1) scrolls, not a per-frame loop. No network involved.
- **Files:** `screens/Library.js`. **Effort:** S · **OTA:** ✅.

### 6.3 Firmware TODO recorded
- A `TODO` block was added atop `console-esp32/console-esp32.ino` mirroring Phase A + 5.2/5.3 so the
  next flash reverts the LEDs to single-zone, deletes `/api/segments/*` (+ optionally `/api/lock`),
  and can add the consolidated `GET /api/state`. Non-OTA; tracked here for the next firmware pass.

---

## Verification (per phase)
1. **Builds:** `npx expo export --platform ios` must bundle clean after each phase.
2. **Hardware still responds** (on the physical console + iPad): source switch (Phono↔Bluetooth),
   lid-light power/brightness/color, now-playing transport + playlist play, Library playlist play +
   auto-Bluetooth. (Segments no longer exist after A.1.)
3. **Battery/thermal check:** leave the app idle on the command center ~15–20 min; note case warmth
   and battery % before/after, and confirm polls pause when NowPlaying/Library is on top (add a
   temporary `__DEV__` log or watch the ESP32 serial for request cadence).
4. **JS-provable vs on-device:** Phase 0/2 render wins are provable via bundle + inspection; all
   poll/hardware items (Phase 1, 3, 4, 5) require the physical console to confirm no regression.

## Suggested rollout
1. **OTA #1:** **Phase A** (remove segments + lock code) — biggest readability/perf win, deletes a
   poll, and clears the plan's only hardware caveat. Do this first.
2. **OTA #2:** Phase 0 (0.1–0.3) — tiny, zero-risk render/log hygiene (0.3 folds into A.1).
3. **OTA #3:** Phase 1.4 + 1.5 + 1.1 (the poll/focus win — now caveat-free).
4. **OTA #4:** Phase 2 (Now Playing provider + progress isolation).
5. **OTA #5:** Phase 3 (lid slider → community `Slider`) + Phase 4 (store fix).
6. **Next rebuild:** Phase 5.1 (auto-dim) with the MusicKit build. **Next firmware:** 5.2 +
   single-zone LED revert (5.3), and optionally delete `/api/lock`.

**Shipped alongside Phase A:** Phase 6.1 (color-wheel dropdown) + 6.2 (Library alphabet scrubber),
both built to the render/network rules above. 6.3 (firmware TODO) is queued for the next flash.
