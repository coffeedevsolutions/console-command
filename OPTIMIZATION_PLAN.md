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

### 1.3 ⚠️ Linked-segment sync — the one hardware-visible tradeoff
- **What:** linked mode is **app-orchestrated**: `LedSegmentCard.js:195-255` watches the lid-light
  poll and POSTs `setSegmentColor/Brightness` so the **vent LEDs follow the lid light**. If 1.1
  pauses the lid poll while `Status` is unfocused, the vent LEDs **stop following** until you return.
- **Hardware-safety:** ⚠️ intentional behavior change while unfocused. Mitigations: (a) keep a slow
  lid/segment **heartbeat while `linkMode==='linked'` AND Status focused**; (b) accept that
  following pauses when you're on another screen (the lid light itself is unaffected); (c) **best:
  move linking into firmware** (Phase 5.3) so the app poll isn't in the loop at all.
- **Files:** `components/LedSegmentCard.js`, `hooks/useLidLight.js`.
- **Effort:** S (guard) · **Research:** confirm desired behavior with real hardware. · **OTA:** ✅

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

### 5.3 Move link-mode into firmware → removes the Phase 1.3 caveat
- **Impact:** when linked, have the firmware mirror lid color/brightness onto the vent segment
  internally, so the app never polls-and-pushes to keep them in sync. Eliminates that whole app
  loop and its focus-gating tradeoff.
- **Hardware-safety:** ⚠️ changes where linking is computed (app → firmware); behavior should match.
  Keep the app's link toggle (`/api/segments/link`) driving the firmware flag.
- **Files:** `console-esp32.ino` (apply lid updates to the vent range when `segLinked`), then remove
  the app-side sync effect in `LedSegmentCard.js`. **Firmware rebuild + flash.**
- **Effort:** M · **Research:** reconcile with the existing `segLinked` handling. · **OTA:** firmware ❌,
  app-side removal ✅ (after firmware ships).

### 5.4 Optional: drop `react-native-audio-api`
- **Impact:** FFmpeg-backed, currently baked but **unused**; adds binary size + a little startup.
  Keep if the mic-visualizer is still planned; otherwise drop at a rebuild to reclaim size.
- **Effort:** XS · **OTA:** ❌ (native).

---

## Verification (per phase)
1. **Builds:** `npx expo export --platform ios` must bundle clean after each phase.
2. **Hardware still responds** (on the physical console + iPad): source switch (Phono↔Bluetooth),
   lid-light power/brightness/color, LED segments **including linked-mode follow**, now-playing
   transport + playlist play, Library playlist play + auto-Bluetooth.
3. **Battery/thermal check:** leave the app idle on the command center ~15–20 min; note case warmth
   and battery % before/after, and confirm polls pause when NowPlaying/Library is on top (add a
   temporary `__DEV__` log or watch the ESP32 serial for request cadence).
4. **JS-provable vs on-device:** Phase 0/2 render wins are provable via bundle + inspection; all
   poll/hardware items (Phase 1, 3, 4, 5) require the physical console to confirm no regression.

## Suggested rollout
1. **OTA #1:** Phase 0 (0.1–0.3) — tiny, zero-risk, immediate.
2. **OTA #2:** Phase 1.4 + 1.5 + 1.1 (the poll/focus win, with the 1.3 heartbeat guard).
3. **OTA #3:** Phase 2 (Now Playing provider + progress isolation).
4. **OTA #4:** Phase 3 (sliders) + Phase 4 (store fix) when touching those files.
5. **Next rebuild:** Phase 5.1 (auto-dim) with the MusicKit build. **Next firmware:** 5.2 + 5.3.
6. Consider Phase 1.2 (coordinator) once 5.2 lands so it collapses to a single request.
