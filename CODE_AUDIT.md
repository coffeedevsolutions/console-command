# Console Command — Code Audit (structure, performance, thermal & battery)

_Target device: iPad 7 (iPad7,12 — A10 Fusion, 2019, passively cooled, LCD). Screen is
forced on app-wide via `useKeepAwake`, so the app runs hot/continuous by design — which
makes the findings below matter more than on a phone that sleeps._

Scope: the console app (`console-command`). The `screens/grundig1/*` panel is large but
was explicitly deferred, so it's noted, not deeply reviewed.

---

## Verdict

**Not spaghetti.** The architecture is genuinely good: a real design-token system
(`theme/tokens.js`), reusable primitives (`components/ui/*`), hooks split out
(`hooks/*`), a clean native module (`modules/apple-music`), and capability-gating so
staged native code can't crash the running build. That's above-average discipline for
something built this fast.

**But it's accumulating drag.** Features were layered without a pass for shared state or
render/poll hygiene, and several of those directly cost battery and heat on the A10. None
are architectural rewrites — they're contained fixes, and **almost all are OTA-able (JS).**

| Dimension | Grade | Note |
|---|---|---|
| Structure / separation | **B+** | clean folders, tokens, primitives |
| Readability | **B** | good, minus 88 debug logs + two 400–600-line card files |
| Render efficiency | **C** | nothing memoized; full-screen SVG re-renders on every poll |
| Network / poll hygiene | **C‑** | ~5 overlapping ESP32 polls, one duplicated, one always-on |
| Battery / thermal fitness | **C‑** | continuous radio + CPU wake; screen forced on |

---

## What's working well (keep doing this)

- **Token system + primitives.** `theme/tokens.js`, `Panel`, `DottedGrid`, `Reveal`,
  `TransportIcons` give consistent styling with little duplication.
- **Capability gating** (`AppleMusic.capabilities`) — staged native methods can't crash
  the current build. Exemplary.
- **Optimistic UI + confirm-from-device** in source switching.
- **One-shot animations** (intro/reveal) rather than always-running motion.

---

## Findings (by impact)

### 🔴 P0 — continuous battery/thermal drain

**1. Overlapping ESP32 polling on the command center.**
When `Status` is mounted, these all poll independently:

| Source | Endpoint | Interval |
|---|---|---|
| `useConnection` | `/api/status` | 4 s |
| `useLidLight` (in `Status.js:50`) | `/api/lidlight/status` | 3 s |
| `useLidLight` (in `LidLightCard.js:30`) | `/api/lidlight/status` | **1 s (duplicate!)** |
| `useLedSegments` (`LedSegmentCard`) | `/api/segments/status` | 3 s |
| Grundig store (`grundig1Store.js:472`) | `/api/state` (full) | 5 s |

That's **~25 HTTP requests every 12 s** to a single-threaded ESP32 WebServer, and — the
part that costs battery/heat — **each request wakes the iPad Wi-Fi radio**, which then
holds a high-power "tail" for ~seconds. Frequent small requests keep the radio warm
continuously. This is the single biggest battery/thermal item.
- *Fix (OTA):* remove the **duplicate** `useLidLight` in `LidLightCard` (consume the
  `lidLightState` prop already passed from `Status`); raise intervals (lid/segments 3 s→5 s
  is plenty for status display); **pause polls when the screen isn't focused** (below).
- *Fix (bigger, needs firmware):* add one consolidated `/api/state` that returns
  connection+source+lidlight+segments, and poll it **once** from a shared `useDeviceState`
  context instead of four hooks. Cuts request count ~4×.

**2. Grundig store polls `/api/state` every 5 s app-wide — even when that screen is closed.**
`Grundig1Provider` wraps the whole app (`App.js:42`), so its 5 s full-state fetch runs on
the command center, Now Playing, and Library — screens that don't use it.
- *Fix (OTA):* gate the interval on `useIsFocused()`/route, or only start it when the
  Grundig1 screen mounts. Eliminates a full `/api/state` fetch every 5 s, always.

**3. Now Playing position poll runs at 1 s on the command center mini-bar.**
`Status.js:51` uses `useNowPlaying({ pollMs: 1000 })` purely to show a live timestamp.
That's a native call every second, forever, on the main screen — plus the same hook runs
*again* on the Now Playing screen (500 ms) when open (two instances polling + subscribing).
- *Fix (OTA):* the mini-bar only needs track/state, which already arrive via the module's
  **change events** — drop its position poll (or 3–5 s). Poll position at 500 ms **only on
  the Now Playing screen while focused.** Consider a single shared `NowPlayingProvider`.

### 🟠 P1 — render efficiency (CPU → heat on A10)

**4. Nothing is memoized; `DottedGrid` re-renders on every poll.**
`Status` re-renders every 1–4 s (poll `setState`s). Its children — including the full-screen
SVG `DottedGrid` — re-render each time because none are `React.memo`. Re-rendering a
full-screen SVG pattern re-walks/re-uploads it.
- *Fix (OTA):* `React.memo` `DottedGrid`, `Panel`, `TransportIcons`, and the nav rows.
  `DottedGrid` takes only static props → memoize it hard. Big, cheap win.

**5. Now Playing re-renders the whole screen 2×/sec.**
The 500 ms poll `setState`s at the screen root, re-rendering artwork `Image`, `DottedGrid`,
and controls just to move the progress bar.
- *Fix (OTA):* isolate the progress bar + timestamp into a small memoized child that owns
  the poll, or drive progress with a Reanimated shared value interpolated locally and
  re-synced every few seconds (1 native call / few sec instead of 2/sec + full re-render).

**6. 88 `console.*` calls in app source** (`useLedSegments` 40, `dspClient` 12,
`LidLightCard` 10, `useLidLight` 9…), **including inside PanResponder move handlers** —
i.e. a log **per touch frame** during a slider drag. Each crosses the JS bridge.
- *Fix (OTA):* strip them or wrap in `if (__DEV__)`. Zero user value, real cost on drags.

### 🟡 P2 — best practice / maintainability

**7. Hand-rolled sliders.** `LidLightCard`, `LedSegmentCard`, and a 358-line
`CustomSlider.js` implement sliders via `PanResponder` + manual `measure()` + debounce
timers — while **`@react-native-community/slider` is installed and unused**. The custom
path is ~hundreds of lines, re-measures on every gesture, and is where much of the logging
lives.
- *Fix (OTA):* replace with the community `Slider` (native, smoother, far less JS). Removes
  code, re-render churn, and bridge traffic. Biggest readability + perf win per line changed.

**8. Grundig store `enhancedDispatch` captures stale state** (`grundig1Store.js:~614`) —
it queues `{ action, state }` with the *pre-update* `state`, so its debounced push sends
the **previous** value (the root cause of the earlier source flip-flop; still affects the
Grundig1 screen's master/EQ pushes). *Fix (OTA):* push `action.<payload>` or the reducer's
next state, not the closure `state`.

**9. Two 400–600-line card files** (`LedSegmentCard` 606, `LidLightCard` 426) mix
polling, gesture math, debouncing, sync logic, and 40+ logs. Once #7 lands they shrink
a lot; further split the sync logic into the hook.

**10. `react-native-audio-api` (FFmpeg) is baked but unused.** It adds binary size + a
little startup/native footprint. Fine to keep for the planned mic-visualizer, but if that
slips, drop it at the next rebuild to reclaim size/startup.

---

## Thermal optimization — iPad 7 / A10 specifics

The A10 has no fan and throttles under sustained load; every continuous CPU/GPU/radio
source contributes. In priority order:

1. **Cut sustained CPU from re-renders** — P0/#1–3 (fewer polls) + P1/#4–5 (memoize, stop
   full-screen re-renders). This is the main sustained-CPU source when idle.
2. **Kill per-frame logging** (#6) — removes bridge spikes during interaction.
3. **Radio duty cycle** (#1–2) — batching/slowing network keeps the Wi-Fi radio cold
   between bursts, which also reduces heat, not just battery.
4. **Screen is the dominant heat source.** `useKeepAwake` (intentional) keeps the LCD +
   backlight on continuously. Mitigation without losing "always-on": add **`expo-brightness`**
   (native → next rebuild) to lower brightness and/or dim after N minutes of no touch, then
   restore on touch. Even dropping backlight 40% meaningfully cuts heat and battery.
5. **Reanimated is fine** — the intro/reveal run once; no always-on animation loops. Keep it
   that way (don't add ambient motion to the command center).

## Battery-life optimization

Ranked by expected impact on this always-on console:

1. **Display / brightness** (biggest lever) — see thermal #4. Auto-dim on inactivity.
2. **Network duty cycle** — P0/#1–3. Fewer, consolidated, focus-gated polls = fewer radio
   wakes = the biggest software battery win.
3. **Render churn** — P1/#4–5; less CPU wake between polls.
4. **Logging** — #6.
5. **Consider `checkAutomatically` on updates** — currently `ON_LOAD`; fine, launch-only.

---

## Prioritized roadmap

| # | Fix | Impact | Effort | OTA? |
|---|---|---|---|---|
| 1 | Remove duplicate `useLidLight` in `LidLightCard` | High | XS | ✅ |
| 2 | Pause polls when screen unfocused (`useIsFocused`) + gate Grundig 5 s poll | High | S | ✅ |
| 3 | Drop mini-bar 1 s poll → rely on events; position-poll only on NowPlaying | High | S | ✅ |
| 4 | `React.memo` `DottedGrid` + static components | Med-High | XS | ✅ |
| 5 | Strip / `__DEV__`-guard the 88 logs | Med | S | ✅ |
| 6 | Replace hand-rolled sliders with community `Slider` | Med | M | ✅ |
| 7 | Isolate NowPlaying progress into a memoized child | Med | S | ✅ |
| 8 | Fix `enhancedDispatch` stale-state | Med (Grundig) | S | ✅ |
| 9 | Consolidated `/api/state` + single `useDeviceState` | High | M/L | app ✅ / firmware rebuild |
| 10 | `expo-brightness` auto-dim | High (battery/heat) | M | ❌ next rebuild |

**Items 1–8 are OTA and would together cut idle CPU wake and network traffic on the
command center by a large margin — likely the difference between "warm and draining" and
"cool and steady" on the iPad 7.** 9 wants a firmware endpoint; 10 needs the next build.

---

## Suggested sequence
1. One OTA pass: #1, #4, #5 (all tiny, immediate). 
2. Second OTA pass: #2, #3, #7 (focus-gating + poll strategy — the real battery win).
3. When touching the light cards anyway: #6, #8.
4. Bundle #10 (brightness) into the MusicKit rebuild you're already planning.
5. #9 when the firmware gets its next revision.
