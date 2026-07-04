// components/ColorPicker.js
import React, { useState, useRef, useCallback } from 'react';
import { View, Text, PanResponder, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Convert HSV to RGB
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} v - Value (0-1)
 * @returns {Object} RGB object {r, g, b} with values 0-255
 */
function hsvToRgb(h, s, v) {
  h = h / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;
  
  let r, g, b;
  if (h >= 0 && h < 1) {
    [r, g, b] = [c, x, 0];
  } else if (h >= 1 && h < 2) {
    [r, g, b] = [x, c, 0];
  } else if (h >= 2 && h < 3) {
    [r, g, b] = [0, c, x];
  } else if (h >= 3 && h < 4) {
    [r, g, b] = [0, x, c];
  } else if (h >= 4 && h < 5) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Convert RGB to HSV
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {Object} HSV object {h, s, v}
 */
function rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : diff / max;
  const v = max;
  
  if (diff !== 0) {
    if (max === r) {
      h = 60 * (((g - b) / diff) % 6);
    } else if (max === g) {
      h = 60 * ((b - r) / diff + 2);
    } else {
      h = 60 * ((r - g) / diff + 4);
    }
  }
  
  if (h < 0) h += 360;
  
  return { h, s, v };
}

/**
 * ColorPicker Component
 * Visual color picker with hue selector and saturation/value grid
 * 
 * @param {Object} props
 * @param {Object} props.color - Current RGB color {r, g, b}
 * @param {Function} props.onChange - Callback when color changes (receives {r, g, b})
 * @param {boolean} props.disabled - Whether the picker is disabled
 */
export default function ColorPicker({ color = { r: 255, g: 255, b: 255 }, onChange, disabled = false }) {
  // Convert initial RGB to HSV
  const initialHsv = rgbToHsv(color.r, color.g, color.b);
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [value, setValue] = useState(initialHsv.v);
  
  const hueLayoutRef = useRef({ x: 0, y: 0, width: 300, height: 30 });
  const svLayoutRef = useRef({ x: 0, y: 0, width: 300, height: 150 });
  const pendingColorRef = useRef(null);
  const isDragging = useRef(false);

  // Update HSV when color prop changes (e.g., from preset selection)
  React.useEffect(() => {
    if (!isDragging.current && color) {
      const newHsv = rgbToHsv(color.r, color.g, color.b);
      setHue(newHsv.h);
      setSaturation(newHsv.s);
      setValue(newHsv.v);
    }
  }, [color.r, color.g, color.b]);

  // Get current RGB from HSV
  const currentRgb = hsvToRgb(hue, saturation, value);

  // Notify parent of color change (only when done dragging)
  const notifyChange = useCallback((newRgb) => {
    if (onChange && !disabled) {
      onChange(newRgb);
    }
  }, [onChange, disabled]);

  // Calculate hue from touch position
  const calculateHueFromTouch = useCallback((pageX) => {
    const layout = hueLayoutRef.current;
    const touchX = pageX - layout.x;
    const percentage = Math.max(0, Math.min(1, touchX / layout.width));
    return percentage * 360;
  }, []);

  // Calculate saturation and value from touch position
  const calculateSVFromTouch = useCallback((pageX, pageY) => {
    const layout = svLayoutRef.current;
    const touchX = pageX - layout.x;
    const touchY = pageY - layout.y;
    const s = Math.max(0, Math.min(1, touchX / layout.width));
    const v = Math.max(0, Math.min(1, 1 - (touchY / layout.height)));
    return { s, v };
  }, []);

  // Hue selector pan responder
  const huePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && hueLayoutRef.current.width > 0,
      onStartShouldSetPanResponderCapture: () => !disabled && hueLayoutRef.current.width > 0,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const newHue = calculateHueFromTouch(evt.nativeEvent.pageX);
        setHue(newHue);
        const newRgb = hsvToRgb(newHue, saturation, value);
        pendingColorRef.current = newRgb;
      },
      onPanResponderMove: (evt) => {
        const newHue = calculateHueFromTouch(evt.nativeEvent.pageX);
        setHue(newHue);
        const newRgb = hsvToRgb(newHue, saturation, value);
        pendingColorRef.current = newRgb;
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        if (pendingColorRef.current) {
          notifyChange(pendingColorRef.current);
          pendingColorRef.current = null;
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        pendingColorRef.current = null;
      },
    })
  ).current;

  // Saturation/Value grid pan responder
  const svPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled && svLayoutRef.current.width > 0,
      onStartShouldSetPanResponderCapture: () => !disabled && svLayoutRef.current.width > 0,
      onMoveShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        const { s, v } = calculateSVFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        setSaturation(s);
        setValue(v);
        const newRgb = hsvToRgb(hue, s, v);
        pendingColorRef.current = newRgb;
      },
      onPanResponderMove: (evt) => {
        const { s, v } = calculateSVFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        setSaturation(s);
        setValue(v);
        const newRgb = hsvToRgb(hue, s, v);
        pendingColorRef.current = newRgb;
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        if (pendingColorRef.current) {
          notifyChange(pendingColorRef.current);
          pendingColorRef.current = null;
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        pendingColorRef.current = null;
      },
    })
  ).current;

  // Generate hue gradient background
  const hueGradientColors = [
    'rgb(255,0,0)',    // 0° Red
    'rgb(255,255,0)',  // 60° Yellow
    'rgb(0,255,0)',    // 120° Green
    'rgb(0,255,255)',  // 180° Cyan
    'rgb(0,0,255)',    // 240° Blue
    'rgb(255,0,255)',  // 300° Magenta
    'rgb(255,0,0)',    // 360° Red
  ];

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* Saturation/Value Grid */}
      <View
        style={styles.svGridContainer}
        onLayout={(event) => {
          event.target.measure((x, y, width, height, pageX, pageY) => {
            svLayoutRef.current = { x: pageX, y: pageY, width, height };
          });
        }}
        {...svPanResponder.panHandlers}
      >
        <View style={[styles.svGrid, { backgroundColor: `hsl(${hue}, 100%, 50%)` }]}>
          {/* White to transparent gradient (saturation) - left to right */}
          <LinearGradient
            colors={['#ffffff', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.svOverlay}
          />
          {/* Transparent to black gradient (value) - top to bottom */}
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.svOverlay}
          />
        </View>
        {/* Cursor */}
        <View
          style={[
            styles.svCursor,
            {
              left: `${saturation * 100}%`,
              top: `${(1 - value) * 100}%`,
            },
          ]}
        />
      </View>

      {/* Hue Selector */}
      <View
        style={styles.hueSelectorContainer}
        onLayout={(event) => {
          event.target.measure((x, y, width, height, pageX, pageY) => {
            hueLayoutRef.current = { x: pageX, y: pageY, width, height };
          });
        }}
        {...huePanResponder.panHandlers}
      >
        <LinearGradient
          colors={hueGradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.hueSelector}
        />
        {/* Hue cursor */}
        <View
          style={[
            styles.hueCursor,
            { left: `${(hue / 360) * 100}%` },
          ]}
        />
      </View>

      {/* Color Preview and RGB Display */}
      <View style={styles.previewRow}>
        <View
          style={[
            styles.colorPreview,
            {
              backgroundColor: `rgb(${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b})`,
            },
          ]}
        />
        <Text style={styles.rgbText}>
          RGB({currentRgb.r}, {currentRgb.g}, {currentRgb.b})
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  svGridContainer: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  svGrid: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  svOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  svCursor: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: '#fff',
    marginLeft: -10,
    marginTop: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  hueSelectorContainer: {
    width: '100%',
    height: 30,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  hueSelector: {
    width: '100%',
    height: '100%',
  },
  hueCursor: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 6,
    backgroundColor: '#fff',
    borderRadius: 3,
    marginLeft: -3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#ccc',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  rgbText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
});

