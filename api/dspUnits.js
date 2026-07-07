// api/dspUnits.js
// Single home for every DSP value that depends on a hardware calibration
// (the firmware C1–C13 bench pass — see console-esp32/docs/DSP_BLE_BRIDGE_PLAN.md).
// The dashboard renders raw DSP-wire values through these tables/ranges. When the
// bench pass lands, update THIS FILE ONLY (labels, enum values, unit scales) and
// the whole UI follows — no control code changes. Provisional entries are marked CAL(n).

// ---- enums -------------------------------------------------------------
// CAL(C6): crossover filter "type" byte = slope enum. "OFF" is the disable.
export const SLOPES = [
  { v: 0, label: 'OFF' },
  { v: 1, label: '6' },
  { v: 2, label: '12' },
  { v: 3, label: '18' },
  { v: 4, label: '24' },
];

// CAL(C8): router source enum.
export const ROUTES = [
  { v: 0, label: 'A' },
  { v: 1, label: 'B' },
  { v: 2, label: 'A+B' },
];

// polarity is a hard 0°/180° toggle (not degrees).
export const POLARITY = [
  { v: 0, label: '0°' },
  { v: 1, label: '180°' },
];

// CAL(C11): GEQ preset index (12 = custom per decompile). Labels are cosmetic.
export const GEQ_PRESETS = [
  'FLAT', 'BASS', 'TREBLE', 'V-SHAPE', 'LOUD', 'VOCAL',
  'ACOUSTIC', 'ROCK', 'POP', 'JAZZ', 'CLASSIC', 'HIP-HOP', 'CUSTOM',
];
export const GEQ_CUSTOM_PRESET = 12;

// 15 GEQ band centre frequencies (Hz), in wire order.
export const GEQ_HZ = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];

// ---- control ranges ----------------------------------------------------
// Each: [min, max, step]. Firmware clamps authoritatively; these just shape the UI.
export const RANGE = {
  master:     [0, 100, 1],       // %
  geqBand:    [-12, 12, 0.5],    // dB (verified)
  outGain:    [-40, 15, 1],      // dB (firmware clamps -60..15)
  peqFreq:    [20, 20000, 10],   // Hz
  peqGain:    [-12, 12, 1],      // dB
  peqQ:       [0.4, 10, 0.1],    // Q
  xoFreq:     [10, 22000, 10],   // Hz
  limThresh:  [-24, 0, 1],       // dB (0 = OFF)
  limAttack:  [0, 500, 1],       // CAL(C2) raw
  limRelease: [0, 2000, 10],     // CAL(C2) raw
  delay:      [0, 1000, 1],      // CAL(C1) raw units
  genFreq:    [20, 20000, 10],   // Hz
  genGain:    [0, 1000, 1],      // CAL(C4) raw u16
  sweepSpeed: [1, 20, 1],        // CAL raw
};

// ---- unit passthroughs (become real conversions after calibration) -----
export const delayToUi   = (raw) => raw;   // CAL(C1)
export const delayFromUi = (ui)  => ui;
export const attackToUi  = (raw) => raw;   // CAL(C2)
export const genGainToUi = (raw) => raw;   // CAL(C4)

// true while any of the above are still provisional — drives the "CAL" hint badges.
export const CAL_PENDING = {
  slope: true, route: true, delay: true, limiter: true, genGain: true, geqPreset: true,
};

// ---- formatters --------------------------------------------------------
export function fmtHz(hz) {
  if (hz >= 1000) {
    const k = hz / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `${Math.round(hz)}`;
}
export function fmtDb(db) {
  const v = Math.round(db * 10) / 10;
  return `${v > 0 ? '+' : ''}${v}`;
}
export function labelFor(table, v) {
  const hit = table.find((o) => o.v === v);
  return hit ? hit.label : String(v);
}
