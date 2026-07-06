# DSP Dashboard Plan — wiring the app to the real TPT-SP4BT controls

Companion to `CODE_AUDIT.md` / `OPTIMIZATION_PLAN.md`, same format. The ESP32 firmware was
rewritten as a **BLE bridge to the Timpano TPT-SP4BT DSP** (repo `console-esp32`, branch
`claude/dsp-command-analysis-amnc03` — see its `docs/REST_API.md` and
`docs/DSP_BLE_BRIDGE_PLAN.md`). Every control the firmware now exposes maps to a **real DSP
command**; the old placeholder model (BW/LR filter types, 36 dB slopes, continuous phase,
per-channel PEQ, input A/B strips, sequencer) no longer exists on the device.

This plan (a) repairs the app↔firmware contract, and (b) rebuilds the Grundig1 screen into a
dashboard whose controls equate 1:1 to the available DSP controls.

---

## 0. Wiring audit — command center vs. new firmware (verified 2026-07-06)

### ✅ Still wired correctly — NO app changes needed
| Feature | App path | Endpoint | Verdict |
|---|---|---|---|
| Connect / discovery | `useConnection` → `dsp.status()` | `GET /api/status` | ✓ works; `source` field present |
| Relay source switch | `Status.js:79` → `dsp.setSource` | `POST /api/source {source}` | ✓ identical contract (incl. reply-before-switch) |
| Lid light (all) | `useLidLight` | `/api/lidlight/status·power·color·brightness` | ✓ identical contracts + JSON shapes |
| Master volume | `dsp.setMaster({levelPct})` | `POST /api/master` | ✓ firmware accepts legacy `levelPct` key |
| 15-band GEQ | `dsp.setInputGeq` | `POST /api/input/geq` (alias) | ✓ same body `{bands[15] dB, preset}` |
| Presets save/load/copy | `dsp.savePreset/loadPreset/copyPreset` | `/api/preset/*` | ✓ same paths + bodies |
| Base URL / mDNS | `dspClient` default | `http://console.local` | ✓ firmware advertises `console` |

`status.locked` no longer exists → `useConnection.locked` is always `false`. Lock UI was
already removed (Phase A), so this is harmless; drop the field when touching the hook.

### ❌ Broken or dead — MUST fix before/with the dashboard
| # | App code | Problem |
|---|---|---|
| B1 | `arduinoToGrundig1State()` (`dspClient.js:182`) | Parses the **old** `/api/state` shape. Worst bug: `master` is now an int 0–100, converter does `master*100` → **6200**. `input.*`, `outputs[].hpf/lpf/peq/limiter`, `seq`, `battery` keys all moved/renamed/removed → sync corrupts the store with defaults/garbage. |
| B2 | `pushToArduino` SET_CHANNEL_* (`grundig1Store.js:533`) | Sends old `/api/output` body. New firmware ignores `hpf{type,slope,freq,enabled}`, `delayMs`, `invert`, `peq`, `limiter{thr,atk,rel,en}`, string `route:'A'` — **only `gainDb` and `mute` still land**. |
| B3 | `dsp.setInputPeq` → `/api/input/peq` | Endpoint removed (DSP has no input PEQ) → 404 on every input-PEQ edit. |
| B4 | `dsp.setGenerators` flat body | New endpoint wants `{tone:{},sweep:{},pink:{}}` → current pushes are silent no-ops. |
| B5 | `dsp.setSequencer` → `/api/seq` | Endpoint removed (no DSP opcode) → 404. Sequencer UI must go (deferred feature, bridge plan Phase 4). |
| B6 | `Controls.js` → `dsp.setVolume` (`/api/volume`) + `command()` (`/api/command`) | Both endpoints never existed in deployed firmware — this screen was already dead. Remove or repoint volume→`setMaster`. |
| B7 | `dsp.updateBattery`, `dsp.setLock`, `connectWs` | Endpoints removed / never existed; no remaining callers → delete methods. |
| B8 | Voltmeter source | Old converter read `state.battery{v,min,max}`; battery now lives in `GET /api/status → dsp.batteryV` (pushed by the DSP itself). |

**Bottom line:** the command center (lights, relay, connection) is untouched and verified;
everything that breaks is inside the client/converter/store layer that only the Grundig1
dashboard uses. That's exactly the surface this plan rebuilds.

---

## 1. The contract — what the firmware actually exposes now

Full reference: `console-esp32/docs/REST_API.md`. The dashboard-relevant shapes:

```jsonc
// GET /api/state  (poll while dashboard focused)
{
  "dsp": { "connected": true, "state": "ready" },   // idle|scanning|connecting|syncing|ready|backoff
  "master": 62, "masterTarget": 62,                  // int 0..100
  "source": "turntable",
  "lidlight": { "color": {"r":255,"g":200,"b":150}, "brightness": 80, "lidOpen": true },
  "outputs": [{
    "ch": 1, "gainDb": 0, "mute": false,
    "polarity": 0,                                   // 0|1 (0°/180°) — NOT degrees
    "route": 0,                                      // int enum, CAL(C8)
    "delay": 0,                                      // raw u16, CAL(C1)
    "xo": { "hpfHz":10, "hpfType":0, "lpfHz":22000, "lpfType":0, "preset":0 },  // type = slope enum CAL(C6)
    "limiter": { "thresholdDb":0, "attack":10, "release":100, "auto":true }     // atk/rel raw CAL(C2); no "enabled"
  }, /* ch 2..4 */],
  "geq": { "preset": 12, "bands": [0.0, ...15 floats dB] },
  "peq": [{ "band":0, "channel":0, "freqHz":1000, "gainDb":0, "q":1.0 }, /* bands 1..4 */],
  "gen": {
    "tone":  { "on":false, "freqHz":1000, "gain":0 },          // gain raw u16 CAL(C4)
    "sweep": { "on":false, "startHz":20, "endHz":20000, "gain":0, "speed":1 },
    "pink":  { "on":false, "gain":0 }
  }
}
```

Writes (all return `{"ok":true}`):
- `POST /api/master {pct}` — ramped firmware-side
- `POST /api/geq {bands:[15 dB floats], preset?}`
- `POST /api/output {ch:1..4, gainDb?, mute?, polarity?, route?, delay?, xo:{...}?, limiter:{...}?}` — send only what changed; each touched block = one BLE frame
- `POST /api/peq {band:0..4, channel?, freqHz?, gainDb?, q?}` — **5 bands total, channel-assigned** (the DSP's real topology; not per-channel)
- `POST /api/gen {tone:{...}?, sweep:{...}?, pink:{...}?}`
- `GET /api/preset/list` → `{presets:[{slot,used,name?}×16]}` (new — use for the preset grid)
- `POST /api/dsp/sync` (re-read DSP → mirror), `POST /api/dsp/apply` (force-push mirror → DSP)
- `GET /api/status → dsp{connected,state,batteryV,clipRaw?}` — DSP link + battery + clip

Key semantic changes the UI must absorb:
1. **Phase → polarity toggle** (0°/180° only). `PolaritySwitch` already exists — the model catches up to it.
2. **Crossover:** no BW/LR type, no enabled flag, no 36 dB. One `type` byte = slope enum
   (Off/6/12/18/24 dB-oct — exact values pending CAL(C6)). "Off" IS the disable.
3. **PEQ:** five bands *total*, each with a channel-assign — one shared panel, not per-channel.
4. **Limiter:** no on/off; "off" = threshold 0 dB. `attack/release` raw units until CAL(C2).
5. **Route:** int enum (likely 0/1/2 = A/B/A+B, pending CAL(C8)), not strings.
6. **No input A/B strips, no input PEQ, no sequencer** — no DSP opcodes. Remove from UI.
7. **Battery** is real now (DSP-reported voltage), read-only, from `/api/status`.

---

## 2. Phase D0 — client layer repair (`api/dspClient.js`) · S · OTA ✅ · do first

Everything below the UI. After this phase the app compiles against reality even before the
dashboard is rebuilt.

1. **Delete dead methods:** `setVolume`, `command()`, `updateBattery`, `setLock`,
   `setInputPeq`, `setSequencer`, `connectWs` (+ fix `Controls.js`: drop `command()` usage;
   repoint its volume slider at `setMaster` or delete the screen — decide).
2. **Add:** `setPeq(band, {channel,freqHz,gainDb,q})`, `getPresetList()`, `dspSync()`,
   `dspApply()`, `getDspLog()` (bench/debug), `setOutput` kept but documented with the new keys.
3. **Rewrite `setGenerators`** → nested `{tone,sweep,pink}` bodies; push only the changed generator.
4. **Rewrite `arduinoToGrundig1State()`** for the new shape (§1). No scaling on `master`.
   Map `outputs[].xo/limiter/polarity/route/delay` verbatim into the new store model (§3).
5. **New file `api/dspUnits.js`** — the single home for every calibration-dependent
   conversion, so the post-calibration update is a one-file OTA:
   ```js
   // ALL values provisional until the firmware C1–C13 bench pass (see
   // console-esp32/docs/DSP_BLE_BRIDGE_PLAN.md Phase 0). Update HERE only.
   export const SLOPES  = [ {v:0,label:'Off'}, {v:1,label:'6 dB'}, {v:2,label:'12 dB'},
                            {v:3,label:'18 dB'}, {v:4,label:'24 dB'} ];      // CAL(C6)
   export const ROUTES  = [ {v:0,label:'A'}, {v:1,label:'B'}, {v:2,label:'A+B'} ]; // CAL(C8)
   export const delayToUi   = raw => raw;      // CAL(C1): unit unknown — show raw
   export const delayFromUi = ui  => ui;
   export const attackToUi  = raw => raw;      // CAL(C2)
   export const genGainToUi = raw => raw;      // CAL(C4)
   export const GEQ_CUSTOM_PRESET = 12;        // CAL(C11)
   ```

## 3. Phase D1 — store model rework (`screens/grundig1/state/grundig1Store.js`) · M · OTA ✅

**New store shape** (device-truth mirror; DSP-native values + `dspUnits` at the edges):

```js
{
  link:   { appConnected, dspConnected, dspState },          // from /api/status + /api/state
  global: { master, source, voltage, voltMin, voltMax },     // volt min/max tracked app-side
  geq:    { preset, bands: [15] },                           // dB floats
  peq:    [ {channel, freqHz, gainDb, q} × 5 ],              // the DSP's real 5-band model
  outputs:{ ch1..ch4: { gainDb, mute, polarity, route, delay,
                        xo: {hpfHz,hpfType,lpfHz,lpfType,preset},
                        limiter: {thresholdDb,attack,release,auto} } },
  gen:    { tone:{on,freqHz,gain}, sweep:{on,startHz,endHz,gain,speed}, pink:{on,gain} },
  devicePresets: [ {slot,used,name} × 16 ],                  // from GET /api/preset/list
}
```

**Action → push mapping** (replaces the `pushToArduino` switch; each action posts ONE
minimal body → the firmware turns it into ONE coalesced BLE frame):

| Action | POST | Body |
|---|---|---|
| `SET_MASTER` | `/api/master` | `{pct}` |
| `SET_SOURCE` | `/api/source` | `{source}` (unchanged) |
| `SET_GEQ_BAND` / `SET_GEQ` | `/api/geq` | `{bands}` (+`preset: GEQ_CUSTOM_PRESET` on manual edit) |
| `SET_GEQ_PRESET` | `/api/geq` | `{bands, preset}` |
| `SET_PEQ_BAND` | `/api/peq` | `{band, channel, freqHz, gainDb, q}` |
| `SET_CHANNEL_GAIN` / `_MUTE` | `/api/output` | `{ch, gainDb}` / `{ch, mute}` **only** |
| `SET_CHANNEL_POLARITY` | `/api/output` | `{ch, polarity}` |
| `SET_CHANNEL_ROUTE` | `/api/output` | `{ch, route}` (int from `ROUTES`) |
| `SET_CHANNEL_DELAY` | `/api/output` | `{ch, delay}` (via `delayFromUi`) |
| `SET_CHANNEL_XOVER` | `/api/output` | `{ch, xo:{...}}` |
| `SET_CHANNEL_LIMITER` | `/api/output` | `{ch, limiter:{...}}` |
| `SET_GENERATOR` | `/api/gen` | only the changed generator object |
| `LOAD_DEVICE_PRESET` | `/api/preset/load` | `{slot}` then re-`syncFromArduino()` |
| removed | — | `SET_INPUT_PEQ`, `SET_SEQUENCER`, `SET_LOCK_CODE`, input A/B actions |

**Keep** the shipped perf discipline: 300 ms debounced push queue, the Phase-4 fresh-state
fix, focus-gated 5 s `/api/state` poll (`pollActiveRef`), optimistic UI with `isDragging`
poll-suppression. **Add:** pause the poll entirely while `dspConnected === false` is already
known (halve wasted radio wakes when the DSP is off) — poll `/api/status` only, which
`useConnection` already does.

## 4. Phase D2 — the dashboard (`screens/grundig1/index.js` + components) · L · OTA ✅

Tab restructure — every control on screen = a real DSP block; nothing fake:

| Tab | Controls | Components (reuse ✱ / modify ◐ / new ✚ / delete ✖) |
|---|---|---|
| **HOME** | Master knob (0–100); DSP link chip (`dspState` when not ready); Voltmeter (read-only, from status); clip LEDs (from `clipRaw` once decoded); source rocker; device-preset quick recall | ✱`Knob` ✱`Voltmeter` ✱`LED` ✱`RockerSwitch` ◐`QuickAccess` |
| **EQ** | 15-band GEQ `FaderBank` (±12 dB) + GEQ preset selector (0–12, custom=12); **5-band PEQ panel**: band selector 1–5, per-band channel-assign chip (CH1–4), freq/gain/Q knobs | ✱`FaderBank` ✱`Fader` ◐`PEQControls` (add band+channel selectors) ◐`PresetSelector` |
| **CHANNELS** (per-channel, `ChannelSelector` CH1–4) | Gain (int dB) + mute; polarity toggle (0°/180°); route (A/B/A+B from `ROUTES`); delay (raw units until CAL C1); crossover: HPF freq + slope dropdown (`SLOPES`, "Off"=disabled), LPF same, XO preset dropdown; limiter: threshold (−24..0, 0=off), attack/release (raw until CAL C2), auto toggle | ✱`ChannelSelector` ✱`OutputChannelStrip` ✱`PolaritySwitch` ◐`RoutingMatrix` (int enums) ◐`CrossoverControls` (single slope enum, no BW/LR, no enable switch, no 36 dB) ◐`DelayControl` (raw units + "cal pending" hint) ◐`LimiterControls` (no on/off; thr 0 = OFF badge) |
| **TOOLS** | Tone gen (on/freq/gain), sweep gen (on/start/end/gain/speed), pink gen (on/gain) — one-active-at-a-time UI rule kept, but each posts its own object | ◐`Generators` (new shape; gain raw until CAL C4) ✖`SequencerTools` |
| **PRESETS** | 16 device slots from `GET /api/preset/list` (name + used badge), save/load/copy; "Sync from DSP" (`/api/dsp/sync`) and "Force push to DSP" (`/api/dsp/apply`) as explicit advanced buttons | ◐`PresetGrid` (real slot names) ✚ two advanced buttons |
| **SETTINGS** | Connection card (baseUrl, latency), DSP link detail (state/addr/battery raw), firmware info, frame-log viewer (dev-only, `GET /api/dsp/log`) | ◐ existing settings tab ✚ dev log viewer (`__DEV__`) |
| ✖ removed | **INPUT tab** (A/B gain strips + input PEQ — no DSP opcodes), sequencer, lock code | ✖ input-strip components’ usages |

**DSP-link gating (new, important):** when `dsp.connected === false`, overlay the dashboard
controls with a subtle disabled state + a status chip ("DSP: scanning…"). Writes while
disconnected still land in the ESP32 mirror (it queues/persists), but the user should see
that the DSP itself isn't hearing them. Command-center features (lights/relay) are never
gated — they're ESP32-local.

**Perf rules carried over (non-negotiable, from OPTIMIZATION_PLAN):** memoized rows/controls;
no per-frame POSTs (debounce + `onSlidingComplete`); one focus-gated poll; no logs outside
`__DEV__`; conditional-render heavy SVG.

## 5. Phase D3 — calibration pass-through · XS per item · OTA ✅

When the firmware bench pass (C1–C13) lands, update **only `api/dspUnits.js`**: real slope
enum values/labels, route enum, delay unit (raw→ms), attack/release unit, PEQ Q — plus
delete each "cal pending" hint. Every control keeps working before calibration; it just
shows raw device units with a hint until then.

## 6. Verification (mirrors OPTIMIZATION_PLAN §Verification)

1. `npx expo export --platform ios` bundles clean after each phase.
2. **Command center regression** (must be zero-diff): connect via `console.local`, source
   switch both ways, lid open/close fade, color preset + custom color + brightness slider.
3. **Dashboard ↔ DSP truth:** with the Timpano app on a second device *disconnected* (BLE is
   single-host), change master/GEQ/crossover/limiter per channel from the dashboard, then
   `POST /api/dsp/sync` and confirm the dashboard re-reads what the DSP reports (round-trip
   equality = the codec and the UI agree).
4. **Link-loss behavior:** power-cycle the DSP; dashboard shows scanning → ready; controls
   re-enable; state re-seeds from the DSP.
5. **Thermal/battery spot-check** unchanged from the app plan (idle 15–20 min on Status).

## 7. Sequencing & effort

| Order | Phase | Effort | Ships |
|---|---|---|---|
| 1 | D0 client repair + `dspUnits.js` | S | OTA |
| 2 | D1 store rework | M | OTA (same update as D0) |
| 3 | D2 dashboard tabs (HOME+CHANNELS first, EQ, TOOLS/PRESETS/SETTINGS after) | L | OTA, can ship per-tab |
| 4 | D3 calibration constants | XS | OTA after the bench pass |

D0+D1 are prerequisites for anything touching the Grundig screen — until they land, the
dashboard's writes mostly no-op against the new firmware (audit B1–B5). The command center
needs no changes and keeps working throughout.
