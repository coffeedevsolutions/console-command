// components/LidLightCard.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { useLidLight } from '../hooks/useLidLight';
import ColorPicker from './ColorPicker';
import { theme } from '../theme/tokens';

const T = theme; // tokens (imported as `theme` to avoid clashing with the hook's `color`)

/**
 * Lid Light control card — the single lighting controller: power, brightness,
 * presets, and a color wheel. Drives the whole LED strip.
 */
export default function LidLightCard() {
  const {
    lidOpen,
    brightness,
    color,
    loading,
    pendingAction,
    isOn,
    setPower,
    setBrightness,
    setPreset,
    setRgb,
  } = useLidLight({ pollingInterval: 3000 });

  const [sliderBrightness, setSliderBrightness] = useState(0);
  const [colorOpen, setColorOpen] = useState(false); // color wheel collapsed by default
  const isDragging = useRef(false); // suppress the poll from snapping the slider mid-drag

  // Mirror device brightness into the slider, except while the user is dragging it.
  useEffect(() => {
    if (!isDragging.current) setSliderBrightness(brightness);
  }, [brightness]);

  const controlsDisabled = loading || pendingAction;

  // Handle power toggle
  const handlePowerToggle = (value) => {
    setPower(value);
  };

  // Push brightness to the device (called on slider release).
  const handleBrightnessChange = (value) => {
    setBrightness(Math.max(0, Math.min(100, Math.round(value))));
  };

  // Handle preset selection
  const handlePresetPress = (preset) => {
    setPreset(preset);
  };

  // Preset color definitions for visual feedback
  const presets = [
    'WARM', 'COOL', 'WHITE', 'RED',
    'GREEN', 'BLUE', 'PURPLE', 'ORANGE'
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Lid Light</Text>

      {/* Status Section */}
      <View style={styles.statusSection}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Lid:</Text>
          <Text style={styles.statusValue}>
            {lidOpen ? 'Open' : 'Closed'}
          </Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Brightness:</Text>
          <Text style={styles.statusValue}>{brightness}%</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Color:</Text>
          <View
            style={[
              styles.colorSwatch,
              {
                backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
              },
            ]}
          />
        </View>
      </View>

      {/* Loading State */}
      {loading && (
        <Text style={styles.loadingText}>Loading...</Text>
      )}

      {/* Power Control */}
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>Power:</Text>
        <Switch
          value={isOn}
          onValueChange={handlePowerToggle}
          disabled={controlsDisabled}
          trackColor={{ false: T.color.lineStrong, true: T.color.accent }}
          thumbColor={T.color.textHi}
          ios_backgroundColor={T.color.lineStrong}
        />
      </View>

      {/* Brightness Control */}
      <View style={styles.controlSection}>
        <View style={styles.brightnessHeader}>
          <Text style={styles.controlLabel}>Brightness:</Text>
          <Text style={styles.brightnessValue}>{Math.round(sliderBrightness)}%</Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={sliderBrightness}
          onValueChange={(v) => { isDragging.current = true; setSliderBrightness(v); }}
          onSlidingComplete={(v) => { isDragging.current = false; handleBrightnessChange(v); }}
          disabled={controlsDisabled}
          minimumTrackTintColor={T.color.accent}
          maximumTrackTintColor={T.color.lineStrong}
          thumbTintColor={T.color.textHi}
        />
      </View>

      {/* Presets */}
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>Presets:</Text>
        <View style={styles.presetsGrid}>
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset}
              style={[
                styles.presetChip,
                controlsDisabled && styles.presetChipDisabled,
              ]}
              onPress={() => handlePresetPress(preset)}
              disabled={controlsDisabled}
              activeOpacity={0.7}
            >
              <Text style={styles.presetChipText}>{preset}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Custom color — collapsible; the SVG wheel only mounts when open */}
      <View style={styles.controlSection}>
        <TouchableOpacity
          style={styles.dropdownHeader}
          onPress={() => setColorOpen((o) => !o)}
          activeOpacity={0.7}
        >
          <Text style={styles.controlLabel}>Custom Color</Text>
          <Text style={styles.dropdownChevron}>{colorOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>
        {colorOpen && (
          <ColorPicker
            color={color}
            onChange={(c) => setRgb(c.r, c.g, c.b)}
            disabled={controlsDisabled}
          />
        )}
      </View>

      {/* Pending Action Indicator */}
      {pendingAction && (
        <Text style={styles.pendingText}>Updating...</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: T.space.md,
    padding: T.space.lg,
    borderRadius: T.radius.none,
    borderWidth: T.border.hair,
    borderColor: T.color.line,
    backgroundColor: T.color.panel,
  },
  title: {
    ...T.type.tag,
    fontSize: 11,
    color: T.color.textMid,
    textTransform: 'uppercase',
  },
  statusSection: { gap: T.space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  statusLabel: { ...T.type.meta, color: T.color.textLow, minWidth: 90, textTransform: 'uppercase' },
  statusValue: { ...T.type.meta, color: T.color.textHi },
  colorSwatch: {
    width: 40, height: 22, borderRadius: T.radius.none,
    borderWidth: T.border.thick, borderColor: T.color.lineStrong,
  },
  loadingText: { ...T.type.meta, color: T.color.textLow },
  errorText: { ...T.type.meta, color: T.color.danger },
  controlSection: { gap: T.space.sm },
  controlLabel: { ...T.type.meta, color: T.color.textMid, textTransform: 'uppercase' },
  dropdownHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: T.border.thick, borderColor: T.color.lineStrong, backgroundColor: T.color.bgSunken,
    paddingVertical: T.space.sm, paddingHorizontal: T.space.md,
  },
  dropdownChevron: { color: T.color.accent, fontSize: 12 },
  brightnessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brightnessValue: { ...T.type.meta, color: T.color.accent, fontSize: 12 },
  slider: { width: '100%', height: 40 },
  presetsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  presetChip: {
    paddingVertical: T.space.sm, paddingHorizontal: T.space.md, borderRadius: T.radius.none,
    backgroundColor: T.color.bgSunken, borderWidth: T.border.thick, borderColor: T.color.lineStrong,
  },
  presetChipDisabled: { opacity: 0.5 },
  presetChipText: { ...T.type.meta, color: T.color.textHi, letterSpacing: 1 },
  rgbInputRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  rgbInputGroup: { flexDirection: 'row', alignItems: 'center', gap: T.space.xs },
  rgbLabel: { ...T.type.meta, color: T.color.textMid },
  rgbInput: {
    width: 50, borderWidth: T.border.thick, borderColor: T.color.lineStrong, borderRadius: T.radius.none,
    padding: T.space.sm, ...T.type.meta, color: T.color.textHi, textAlign: 'center',
  },
  applyButton: {
    paddingVertical: T.space.sm, paddingHorizontal: T.space.lg, borderRadius: T.radius.none,
    backgroundColor: T.color.accent, marginLeft: 'auto',
  },
  applyButtonDisabled: { opacity: 0.5 },
  applyButtonText: { ...T.type.btn, fontSize: 12, color: T.color.accentInk },
  lockedText: { ...T.type.meta, color: T.color.warn },
  pendingText: { ...T.type.meta, color: T.color.textLow },
});

