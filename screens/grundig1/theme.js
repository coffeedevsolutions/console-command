// Theme constants for Grundig1 vintage EQ console
export const colors = {
  // Panel colors
  panel: '#0f1215',
  panelAlt: '#13171b',
  panelLight: '#1a1f24',
  
  // Metal finishes
  aluminum: '#c7cdd6',
  aluminumDark: '#9aa3ad',
  chrome: '#e7eaee',
  
  // Text and markings
  ink: '#e7eaee',
  inkMuted: '#9aa3ad',
  inkDim: '#5a6169',
  
  // Accent colors
  accent: '#cfe6ff',
  accentDim: '#7a8a9a',
  
  // LEDs
  ledGreen: '#49e659',
  ledAmber: '#fbbf24',
  ledRed: '#ef4444',
  ledOff: '#2a2e33',
  
  // UI elements
  border: '#2a2e33',
  borderLight: '#3a3e43',
  shadow: 'rgba(0, 0, 0, 0.5)',
  glow: 'rgba(255, 255, 255, 0.1)',
};

export const typography = {
  tiny: 9,
  small: 11,
  regular: 13,
  medium: 15,
  large: 18,
  xlarge: 22,
  
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    loose: 0.8,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const borderRadius = {
  sm: 2,
  md: 4,
  lg: 8,
  full: 9999,
};

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  glow: (color) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  }),
};

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const mapRange = (value, inMin, inMax, outMin, outMax) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

