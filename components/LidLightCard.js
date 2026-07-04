// components/LidLightCard.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet, PanResponder } from 'react-native';
import { useLidLight } from '../hooks/useLidLight';
import { theme } from '../theme/tokens';

const T = theme; // tokens (imported as `theme` to avoid clashing with the hook's `color`)

/**
 * Lid Light control card component
 * Displays current lid light status and provides controls for power, presets, and custom RGB
 * 
 * @param {Object} props
 * @param {boolean} props.passwordLocked - Whether device is locked
 * @param {string} props.lockCode - 6-digit unlock code (if available)
 */
export default function LidLightCard({ passwordLocked, lockCode }) {
  const {
    lidOpen,
    brightness,
    color,
    loading,
    error,
    pendingAction,
    isOn,
    setPower,
    setBrightness,
    setPreset,
    setRgb,
  } = useLidLight({ code: lockCode, pollingInterval: 1000 });

  // Local state for RGB inputs and brightness slider
  const [rInput, setRInput] = useState('0');
  const [gInput, setGInput] = useState('0');
  const [bInput, setBInput] = useState('0');
  const [sliderBrightness, setSliderBrightness] = useState(0);
  const sliderLayoutRef = useRef({ x: 0, y: 0, width: 300, height: 40 });
  const isDragging = useRef(false);
  const pendingBrightnessRef = useRef(null);
  const brightnessTimerRef = useRef(null);
  const hasPendingBrightnessChange = useRef(false);

  // Update RGB inputs when color changes
  useEffect(() => {
    if (color) {
      setRInput(String(color.r || 0));
      setGInput(String(color.g || 0));
      setBInput(String(color.b || 0));
    }
  }, [color]);

  // Update slider brightness when brightness changes (only if not dragging or pending change)
  useEffect(() => {
    if (!isDragging.current && !hasPendingBrightnessChange.current) {
      setSliderBrightness(brightness);
    }
  }, [brightness]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (brightnessTimerRef.current) {
        clearTimeout(brightnessTimerRef.current);
      }
    };
  }, []);

  // Determine if controls should be disabled
  const isLocked = passwordLocked && !lockCode;
  const controlsDisabled = loading || pendingAction || isLocked;

  // Handle power toggle
  const handlePowerToggle = (value) => {
    setPower(value);
  };

  // Handle brightness change (debounced)
  const handleBrightnessChange = (value) => {
    const clampedValue = Math.max(0, Math.min(100, Math.round(value)));
    console.log('[LidLightCard] handleBrightnessChange called with:', clampedValue);
    // Send to API - always trust the slider value
    setBrightness(clampedValue);
    // Clear the pending flag after sending
    hasPendingBrightnessChange.current = false;
  };

  // Handle preset selection
  const handlePresetPress = (preset) => {
    setPreset(preset);
  };

  // Handle custom RGB apply
  const handleApplyRgb = () => {
    const r = parseInt(rInput, 10) || 0;
    const g = parseInt(gInput, 10) || 0;
    const b = parseInt(bInput, 10) || 0;
    setRgb(r, g, b);
  };

  // Calculate brightness from touch position
  const calculateBrightnessFromTouch = useRef((pageX) => {
    const layout = sliderLayoutRef.current;
    const touchX = pageX - layout.x;
    const percentage = (touchX / layout.width) * 100;
    return Math.max(0, Math.min(100, percentage));
  }).current;

  // Create pan responder for brightness slider with debouncing
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        console.log('[PanResponder] onStartShouldSetPanResponder - controlsDisabled:', controlsDisabled, 'width:', sliderLayoutRef.current.width);
        return !controlsDisabled && sliderLayoutRef.current.width > 0;
      },
      onStartShouldSetPanResponderCapture: () => {
        // Capture the touch immediately, don't let parent views intercept
        return !controlsDisabled && sliderLayoutRef.current.width > 0;
      },
      onMoveShouldSetPanResponder: () => {
        return !controlsDisabled && sliderLayoutRef.current.width > 0;
      },
      onMoveShouldSetPanResponderCapture: () => {
        // Keep control during movement
        return true;
      },
      onPanResponderTerminationRequest: () => {
        // Don't allow other components to terminate our gesture
        console.log('[PanResponder] Termination requested - DENIED');
        return false;
      },
      onPanResponderGrant: (evt) => {
        console.log('[PanResponder] onPanResponderGrant - touch started');
        // Cancel any pending API call if user starts dragging again
        if (brightnessTimerRef.current) {
          clearTimeout(brightnessTimerRef.current);
          brightnessTimerRef.current = null;
          hasPendingBrightnessChange.current = false;
        }
        
        isDragging.current = true;
        const newValue = calculateBrightnessFromTouch(evt.nativeEvent.pageX);
        console.log('[PanResponder] Calculated brightness:', newValue);
        setSliderBrightness(newValue);
        pendingBrightnessRef.current = newValue;
      },
      onPanResponderMove: (evt) => {
        const newValue = calculateBrightnessFromTouch(evt.nativeEvent.pageX);
        setSliderBrightness(newValue);
        pendingBrightnessRef.current = newValue;
      },
      onPanResponderRelease: () => {
        console.log('[PanResponder] onPanResponderRelease - touch released, pendingBrightness:', pendingBrightnessRef.current);
        isDragging.current = false;
        
        // Clear any existing timer
        if (brightnessTimerRef.current) {
          clearTimeout(brightnessTimerRef.current);
        }
        
        // Set new timer - only send after 1.5 seconds of no movement
        if (pendingBrightnessRef.current !== null) {
          const valueToSend = pendingBrightnessRef.current;
          console.log('[LidLightCard] Slider released, starting 1.5s timer for value:', valueToSend);
          hasPendingBrightnessChange.current = true; // Prevent polling from overwriting
          brightnessTimerRef.current = setTimeout(() => {
            console.log('[LidLightCard] Timer fired, calling handleBrightnessChange');
            handleBrightnessChange(valueToSend);
            brightnessTimerRef.current = null;
          }, 1500);
          pendingBrightnessRef.current = null;
        } else {
          console.log('[PanResponder] No pending brightness value to send');
        }
      },
      onPanResponderTerminate: () => {
        console.log('[PanResponder] onPanResponderTerminate - gesture cancelled');
        isDragging.current = false;
        pendingBrightnessRef.current = null;
        hasPendingBrightnessChange.current = false;
        
        // Cancel pending API call on terminate
        if (brightnessTimerRef.current) {
          clearTimeout(brightnessTimerRef.current);
          brightnessTimerRef.current = null;
        }
      },
    })
  ).current;

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
        <View
          style={styles.sliderContainer}
          onLayout={(event) => {
            // Store layout for touch calculations
            const { layout } = event.nativeEvent;
            event.target.measure((x, y, width, height, pageX, pageY) => {
              sliderLayoutRef.current = { x: pageX, y: pageY, width, height };
            });
          }}
          onStartShouldSetResponderCapture={() => true}
          {...panResponder.panHandlers}
        >
          <View style={styles.sliderRail} />
          <View
            style={[
              styles.sliderTrack,
              { width: `${sliderBrightness}%` },
            ]}
          />
          <View
            style={[
              styles.sliderThumb,
              { left: `${sliderBrightness}%` },
              controlsDisabled && styles.sliderThumbDisabled,
            ]}
          />
        </View>
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

      {/* Custom RGB */}
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>Custom RGB:</Text>
        <View style={styles.rgbInputRow}>
          <View style={styles.rgbInputGroup}>
            <Text style={styles.rgbLabel}>R:</Text>
            <TextInput
              style={styles.rgbInput}
              value={rInput}
              onChangeText={setRInput}
              keyboardType="numeric"
              maxLength={3}
              editable={!controlsDisabled}
            />
          </View>
          <View style={styles.rgbInputGroup}>
            <Text style={styles.rgbLabel}>G:</Text>
            <TextInput
              style={styles.rgbInput}
              value={gInput}
              onChangeText={setGInput}
              keyboardType="numeric"
              maxLength={3}
              editable={!controlsDisabled}
            />
          </View>
          <View style={styles.rgbInputGroup}>
            <Text style={styles.rgbLabel}>B:</Text>
            <TextInput
              style={styles.rgbInput}
              value={bInput}
              onChangeText={setBInput}
              keyboardType="numeric"
              maxLength={3}
              editable={!controlsDisabled}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.applyButton,
              controlsDisabled && styles.applyButtonDisabled,
            ]}
            onPress={handleApplyRgb}
            disabled={controlsDisabled}
            activeOpacity={0.7}
          >
            <Text style={styles.applyButtonText}>Apply</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Locked Message */}
      {isLocked && (
        <Text style={styles.lockedText}>
          Device is locked. Enter code to control lights.
        </Text>
      )}

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
  brightnessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brightnessValue: { ...T.type.meta, color: T.color.accent, fontSize: 12 },
  sliderContainer: { height: 40, justifyContent: 'center', position: 'relative' },
  sliderRail: { height: 4, backgroundColor: T.color.bgSunken, borderWidth: T.border.hair, borderColor: T.color.lineStrong },
  sliderTrack: { position: 'absolute', height: 4, backgroundColor: T.color.accent },
  sliderThumb: {
    position: 'absolute', width: 16, height: 22, borderRadius: T.radius.none,
    backgroundColor: T.color.accent, borderWidth: T.border.thick, borderColor: T.color.accentInk,
    marginLeft: -8,
  },
  sliderThumbDisabled: { opacity: 0.5 },
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

