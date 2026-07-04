// Design tokens — "hi-fi schematic × neo-brutalism".
// Single source of truth for the console UI. Every screen/section should pull from
// here rather than hardcoding values, so the aesthetic stays consistent by construction.
//
// Principles enforced by these tokens:
//   • Hard edges (radius maxes out at 4).
//   • Flat fills, no gradients/glow. One loud signal accent (industrial orange).
//   • Two border weights: 1px hairline = schematic annotation, 2px = structural/interactive.
//   • Tinted neutrals (no pure #000/#fff). Mono type reserved for technical annotation.

export const color = {
  // field + surfaces (graphite, faintly cool — never pure black)
  bg:         '#0C0E10',
  bgSunken:   '#090B0D',
  panel:      '#14181C',
  panelAlt:   '#191E23',

  // lines
  line:       '#262C33',   // 1px hairline — schematic annotation
  lineStrong: '#3B444E',   // 2px structural — brutalist border
  gridDot:    'rgba(184,196,208,0.07)',

  // text (off-white, tinted — never pure white)
  textHi:     '#E9ECEF',
  textMid:    '#98A2AD',
  textLow:    '#5E6771',

  // the one loud color
  accent:     '#FF6A2C',   // industrial signal orange
  accentInk:  '#0C0E10',   // text/icon on top of accent

  // semantic status
  ok:         '#4FB477',
  warn:       '#E3A244',
  danger:     '#E05541',
};

// Neo-brutalism: sharp. 0 for structural panels/buttons, 2–4 for the softest touch only.
export const radius = { none: 0, xs: 2, sm: 4 };

export const border = { hair: 1, thick: 2 };

// 4px base rhythm — vary deliberately (tight groups / generous separation).
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, huge: 40 };

export const font = {
  // Swap `mono`/`display` here (drop a bundled font family in) to re-skin globally.
  mono: 'Menlo',
  display: undefined, // system heavy (SF) via weight; upgrade to a grotesque later
};

// Reusable text styles. Titles = heavy tracked sans; annotations = mono.
export const type = {
  // schematic annotation label, e.g. "SOURCE" / "GRUNDIG · KS-680"
  tag:    { fontFamily: font.mono, fontSize: 11, letterSpacing: 2, fontWeight: '700' },
  // small mono meta (addresses, codes, latency)
  meta:   { fontFamily: font.mono, fontSize: 11, letterSpacing: 1 },
  // page/section titles
  title:  { fontFamily: font.display, fontSize: 26, fontWeight: '800', letterSpacing: -0.4 },
  h2:     { fontFamily: font.display, fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  body:   { fontFamily: font.display, fontSize: 14, fontWeight: '500' },
  value:  { fontFamily: font.display, fontSize: 20, fontWeight: '800' },
  btn:    { fontFamily: font.display, fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
};

export const theme = { color, radius, border, space, font, type };
export default theme;
