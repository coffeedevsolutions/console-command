// components/LedSegmentCard.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  TextInput,
  PanResponder,
  StyleSheet,
  Animated,
} from 'react-native';
import { useLedSegments } from '../hooks/useLedSegments';
import ColorPicker from './ColorPicker';
import { theme } from '../theme/tokens';

const T = theme;
const switchColors = {
  trackColor: { false: T.color.lineStrong, true: T.color.accent },
  thumbColor: T.color.textHi,
  ios_backgroundColor: T.color.lineStrong,
};

/**
 * LED Segment Control Card Component
 * Displays and controls LED segments with link mode, colors, and brightness
 * 
 * @param {Object} props
 * @param {boolean} props.passwordLocked - Whether device is locked
 * @param {string} props.lockCode - 6-digit unlock code (if available)
 * @param {Object} props.lidLightState - Lid light state from useLidLight hook
 */
export default function LedSegmentCard({ passwordLocked, lockCode, lidLightState }) {
  const {
    linkMode,
    segments,
    loading,
    error,
    pendingAction,
    refresh,
    setSegmentColor,
    setSegmentColorPreset,
    setSegmentBrightness,
    debouncedSetBrightness,
    setLinkMode,
    setSegmentEnabled,
  } = useLedSegments({ code: lockCode, pollingInterval: 3000 });

  // Local state for expanded sections and RGB inputs
  const [expandedSegment, setExpandedSegment] = useState(null);
  const [rgbInputs, setRgbInputs] = useState({
    1: { r: '255', g: '200', b: '150' },
    2: { r: '100', g: '150', b: '255' },
  });

  // Slider state for each segment
  const [sliderBrightness, setSliderBrightness] = useState({
    1: 100,
    2: 50,
  });
  
  const sliderLayoutRefs = useRef({
    1: { x: 0, y: 0, width: 300, height: 40 },
    2: { x: 0, y: 0, width: 300, height: 40 },
  });
  const isDraggingRef = useRef({});

  // Update local state when segments change
  React.useEffect(() => {
    segments.forEach(seg => {
      setSliderBrightness(prev => ({
        ...prev,
        [seg.id]: seg.brightness,
      }));
      setRgbInputs(prev => ({
        ...prev,
        [seg.id]: {
          r: String(seg.color.r),
          g: String(seg.color.g),
          b: String(seg.color.b),
        },
      }));
    });
  }, [segments]);

  // Determine if controls should be disabled
  const isLocked = passwordLocked && !lockCode;
  const isLinked = linkMode === 'linked';
  // When linked, disable segment controls (they follow lid light)
  const controlsDisabled = loading || pendingAction || isLocked || isLinked;

  // Handle link mode toggle
  const handleLinkToggle = (value) => {
    setLinkMode(value, false);
  };

  // Handle segment enable toggle
  const handleSegmentEnabledToggle = (segmentId, value) => {
    setSegmentEnabled(segmentId, value);
  };

  // Handle color picker change
  const handleColorPickerChange = (segmentId, color) => {
    // Update local RGB inputs
    setRgbInputs(prev => ({
      ...prev,
      [segmentId]: {
        r: String(color.r),
        g: String(color.g),
        b: String(color.b),
      },
    }));
    
    // Apply color change
    setSegmentColor(segmentId, color.r, color.g, color.b);
  };

  // Handle RGB input change
  const handleRgbInputChange = (segmentId, channel, value) => {
    setRgbInputs(prev => ({
      ...prev,
      [segmentId]: {
        ...prev[segmentId],
        [channel]: value,
      },
    }));
  };

  // Handle apply RGB button
  const handleApplyRgb = (segmentId) => {
    const rgb = rgbInputs[segmentId];
    const r = parseInt(rgb.r, 10) || 0;
    const g = parseInt(rgb.g, 10) || 0;
    const b = parseInt(rgb.b, 10) || 0;
    setSegmentColor(segmentId, r, g, b);
  };

  // Handle preset selection
  const handlePresetPress = (segmentId, preset) => {
    setSegmentColorPreset(segmentId, preset);
  };

  // Preset definitions
  const presets = [
    'WARM', 'COOL', 'WHITE', 'RED',
    'GREEN', 'BLUE', 'PURPLE', 'ORANGE'
  ];

  // Calculate brightness from touch position
  const calculateBrightnessFromTouch = (segmentId, pageX) => {
    const layout = sliderLayoutRefs.current[segmentId];
    const touchX = pageX - layout.x;
    const percentage = (touchX / layout.width) * 100;
    return Math.max(0, Math.min(100, percentage));
  };

  // Create pan responder for brightness slider
  const createBrightnessPanResponder = (segmentId) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => !controlsDisabled && !isLinked && sliderLayoutRefs.current[segmentId].width > 0,
      onStartShouldSetPanResponderCapture: () => !controlsDisabled && !isLinked && sliderLayoutRefs.current[segmentId].width > 0,
      onMoveShouldSetPanResponder: () => !controlsDisabled && !isLinked,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current[segmentId] = true;
        const newValue = calculateBrightnessFromTouch(segmentId, evt.nativeEvent.pageX);
        setSliderBrightness(prev => ({ ...prev, [segmentId]: newValue }));
      },
      onPanResponderMove: (evt) => {
        const newValue = calculateBrightnessFromTouch(segmentId, evt.nativeEvent.pageX);
        setSliderBrightness(prev => ({ ...prev, [segmentId]: newValue }));
      },
      onPanResponderRelease: () => {
        isDraggingRef.current[segmentId] = false;
        const valueToSend = sliderBrightness[segmentId];
        debouncedSetBrightness(segmentId, valueToSend);
      },
      onPanResponderTerminate: () => {
        isDraggingRef.current[segmentId] = false;
      },
    });
  };

  const panResponders = {
    1: useRef(createBrightnessPanResponder(1)).current,
    2: useRef(createBrightnessPanResponder(2)).current,
  };

  // Sync segments with lid light when link mode is ON
  // Only sync when lid light changes, not when segments change (to avoid loops)
  const lastLidLightRef = useRef({ color: null, brightness: null });
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    // Only sync when link mode is ON and lid light state exists.
    // Crucially, wait until the lid light has actually loaded real state — otherwise
    // on app launch we'd push its 0/black placeholder to the segments and reset the
    // lights to off (the ESP had them saved correctly the whole time).
    if (!isLinked || !lidLightState || !lidLightState.loaded || syncInProgressRef.current || pendingAction) {
      return;
    }

    const { color, brightness } = lidLightState;
    
    // Check if lid light actually changed (not segments)
    const lidLightColorChanged = !lastLidLightRef.current.color || 
      lastLidLightRef.current.color.r !== color.r ||
      lastLidLightRef.current.color.g !== color.g ||
      lastLidLightRef.current.color.b !== color.b;
    const lidLightBrightnessChanged = lastLidLightRef.current.brightness !== brightness;
    
    // Only sync if lid light changed
    if (color && brightness !== undefined && (lidLightColorChanged || lidLightBrightnessChanged)) {
      console.log('[LedSegmentCard] Link mode ON - lid light changed, syncing segments:', { 
        color, 
        brightness,
        lidLightColorChanged,
        lidLightBrightnessChanged
      });
      
      syncInProgressRef.current = true;
      
      // Sync both segments with lid light settings (skip refresh to avoid loops)
      const syncPromises = [];
      if (lidLightColorChanged) {
        syncPromises.push(
          setSegmentColor(1, color.r, color.g, color.b, true),
          setSegmentColor(2, color.r, color.g, color.b, true)
        );
      }
      if (lidLightBrightnessChanged) {
        syncPromises.push(
          setSegmentBrightness(1, brightness, true),
          setSegmentBrightness(2, brightness, true)
        );
      }
      
      Promise.all(syncPromises).then(() => {
        lastLidLightRef.current = { color: { ...color }, brightness };
        console.log('[LedSegmentCard] Successfully synced segments with lid light');
        // Single refresh after all syncs complete, with delay to avoid loops
        setTimeout(() => {
          refresh(false);
          syncInProgressRef.current = false;
        }, 1000);
      }).catch(err => {
        console.error('[LedSegmentCard] Error syncing segments with lid light:', err);
        syncInProgressRef.current = false;
      });
    } else {
      // Update ref even if no sync needed
      lastLidLightRef.current = { color: { ...color }, brightness };
    }
  }, [isLinked, lidLightState?.loaded, lidLightState?.color?.r, lidLightState?.color?.g, lidLightState?.color?.b, lidLightState?.brightness, pendingAction, setSegmentColor, setSegmentBrightness, refresh]);

  // Toggle segment expansion
  const toggleSegmentExpansion = (segmentId) => {
    setExpandedSegment(prev => prev === segmentId ? null : segmentId);
  };

  // Get segment by ID
  const getSegment = (id) => segments.find(s => s.id === id) || segments[id - 1];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>LED Segment Control</Text>

      {/* Loading State */}
      {loading && (
        <Text style={styles.loadingText}>Loading...</Text>
      )}

      {/* Link Mode Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Link Mode</Text>
          <Switch
            value={isLinked}
            onValueChange={handleLinkToggle}
            disabled={controlsDisabled}
            {...switchColors}
          />
        </View>
        <View style={[styles.infoBox, isLinked ? styles.infoBoxLinked : styles.infoBoxIndependent]}>
          <Text style={styles.infoText}>
            {isLinked 
              ? '🔗 Linked: Both segments follow lid light settings above'
              : '🔓 Independent: Control each segment separately'}
          </Text>
        </View>
      </View>

      {/* Linked Mode Info */}
      {isLinked && (
        <View style={styles.linkedInfoBox}>
          <Text style={styles.linkedInfoTitle}>
            🔗 Segments are linked to Lid Light
          </Text>
          <Text style={styles.linkedInfoText}>
            Both segments automatically follow the Lid Light settings above.
            Change the lid light color or brightness to control both segments.
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Lid Segment:</Text>
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: `rgb(${getSegment(1).color.r}, ${getSegment(1).color.g}, ${getSegment(1).color.b})`,
                },
              ]}
            />
            <Text style={styles.statusValue}>{getSegment(1).brightness}%</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Vent Segment:</Text>
            <View
              style={[
                styles.colorSwatch,
                {
                  backgroundColor: `rgb(${getSegment(2).color.r}, ${getSegment(2).color.g}, ${getSegment(2).color.b})`,
                },
              ]}
            />
            <Text style={styles.statusValue}>{getSegment(2).brightness}%</Text>
          </View>
        </View>
      )}

      {/* Independent Mode Controls */}
      {!isLinked && segments.map((segment) => (
        <View key={segment.id} style={styles.segmentSection}>
          {/* Segment Header */}
          <TouchableOpacity
            style={styles.segmentHeader}
            onPress={() => toggleSegmentExpansion(segment.id)}
            activeOpacity={0.7}
          >
            <View style={styles.segmentHeaderLeft}>
              <Text style={styles.segmentName}>
                {segment.name === 'lid' ? '💡 Lid Segment' : '✨ Vent Segment'}
              </Text>
              <Text style={styles.segmentInfo}>
                {segment.count} LEDs (#{segment.startIdx}-{segment.startIdx + segment.count - 1})
              </Text>
            </View>
            <View style={styles.segmentHeaderRight}>
              <View
                style={[
                  styles.colorPreviewSmall,
                  {
                    backgroundColor: `rgb(${segment.color.r}, ${segment.color.g}, ${segment.color.b})`,
                  },
                ]}
              />
              <Text style={styles.expandIcon}>
                {expandedSegment === segment.id ? '▼' : '▶'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Expanded Controls */}
          {expandedSegment === segment.id && (
            <View style={styles.segmentControls}>
              {/* Enable/Disable */}
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Enabled:</Text>
                <Switch
                  value={segment.enabled}
                  onValueChange={(val) => handleSegmentEnabledToggle(segment.id, val)}
                  disabled={controlsDisabled}
                  {...switchColors}
                />
              </View>

              {/* Brightness Slider */}
              <View style={styles.controlSection}>
                <View style={styles.brightnessHeader}>
                  <Text style={styles.controlLabel}>Brightness:</Text>
                  <Text style={styles.brightnessValue}>
                    {Math.round(sliderBrightness[segment.id])}%
                  </Text>
                </View>
                <View
                  style={styles.sliderContainer}
                  onLayout={(event) => {
                    event.target.measure((x, y, width, height, pageX, pageY) => {
                      sliderLayoutRefs.current[segment.id] = { x: pageX, y: pageY, width, height };
                    });
                  }}
                  {...panResponders[segment.id].panHandlers}
                >
                  <View style={styles.sliderRail} />
                  <View
                    style={[
                      styles.sliderTrack,
                      { width: `${sliderBrightness[segment.id]}%` },
                    ]}
                  />
                  <View
                    style={[
                      styles.sliderThumb,
                      { left: `${sliderBrightness[segment.id]}%` },
                      controlsDisabled && styles.sliderThumbDisabled,
                    ]}
                  />
                </View>
              </View>

              {/* Color Presets */}
              <View style={styles.controlSection}>
                <Text style={styles.controlLabel}>Color Presets:</Text>
                <View style={styles.presetsGrid}>
                  {presets.map((preset) => (
                    <TouchableOpacity
                      key={preset}
                      style={[
                        styles.presetChip,
                        controlsDisabled && styles.presetChipDisabled,
                      ]}
                      onPress={() => handlePresetPress(segment.id, preset)}
                      disabled={controlsDisabled}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetChipText}>{preset}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Visual Color Picker */}
              <View style={styles.controlSection}>
                <Text style={styles.controlLabel}>Custom Color Picker:</Text>
                <ColorPicker
                  color={segment.color}
                  onChange={(color) => handleColorPickerChange(segment.id, color)}
                  disabled={controlsDisabled}
                />
              </View>

              {/* RGB Inputs */}
              <View style={styles.controlSection}>
                <Text style={styles.controlLabel}>RGB Values:</Text>
                <View style={styles.rgbInputRow}>
                  <View style={styles.rgbInputGroup}>
                    <Text style={styles.rgbLabel}>R:</Text>
                    <TextInput
                      style={styles.rgbInput}
                      value={rgbInputs[segment.id].r}
                      onChangeText={(val) => handleRgbInputChange(segment.id, 'r', val)}
                      keyboardType="numeric"
                      maxLength={3}
                      editable={!controlsDisabled}
                    />
                  </View>
                  <View style={styles.rgbInputGroup}>
                    <Text style={styles.rgbLabel}>G:</Text>
                    <TextInput
                      style={styles.rgbInput}
                      value={rgbInputs[segment.id].g}
                      onChangeText={(val) => handleRgbInputChange(segment.id, 'g', val)}
                      keyboardType="numeric"
                      maxLength={3}
                      editable={!controlsDisabled}
                    />
                  </View>
                  <View style={styles.rgbInputGroup}>
                    <Text style={styles.rgbLabel}>B:</Text>
                    <TextInput
                      style={styles.rgbInput}
                      value={rgbInputs[segment.id].b}
                      onChangeText={(val) => handleRgbInputChange(segment.id, 'b', val)}
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
                    onPress={() => handleApplyRgb(segment.id)}
                    disabled={controlsDisabled}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.applyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>
      ))}

      {/* Refresh Button */}
      <TouchableOpacity
        style={[styles.refreshButton, controlsDisabled && styles.refreshButtonDisabled]}
        onPress={() => refresh(true)}
        disabled={controlsDisabled}
        activeOpacity={0.7}
      >
        <Text style={styles.refreshButtonText}>Refresh Status</Text>
      </TouchableOpacity>

      {/* Locked Message */}
      {isLocked && (
        <Text style={styles.lockedText}>
          Device is locked. Enter code to control segments.
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
  title: { ...T.type.tag, fontSize: 11, color: T.color.textMid, textTransform: 'uppercase' },
  loadingText: { ...T.type.meta, color: T.color.textLow },
  errorContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: T.color.bgSunken, padding: T.space.md, borderRadius: T.radius.none,
    borderWidth: T.border.thick, borderColor: T.color.danger,
  },
  errorText: { flex: 1, ...T.type.meta, color: T.color.danger },
  retryButton: { paddingVertical: T.space.xs, paddingHorizontal: T.space.md, borderRadius: T.radius.none, backgroundColor: T.color.danger },
  retryButtonText: { ...T.type.btn, fontSize: 11, color: T.color.accentInk },
  section: { gap: T.space.sm },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { ...T.type.tag, fontSize: 11, color: T.color.textMid, textTransform: 'uppercase' },
  infoBox: { padding: T.space.md, borderRadius: T.radius.none, borderWidth: T.border.hair },
  infoBoxLinked: { backgroundColor: T.color.bgSunken, borderColor: T.color.accent },
  infoBoxIndependent: { backgroundColor: T.color.bgSunken, borderColor: T.color.lineStrong },
  infoText: { ...T.type.meta, color: T.color.textMid },
  linkedInfoBox: {
    gap: T.space.sm, padding: T.space.md, backgroundColor: T.color.bgSunken,
    borderRadius: T.radius.none, borderWidth: T.border.hair, borderColor: T.color.accent,
  },
  linkedInfoTitle: { ...T.type.tag, fontSize: 11, color: T.color.accent, textTransform: 'uppercase' },
  linkedInfoText: { ...T.type.meta, color: T.color.textMid, lineHeight: 17 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  statusLabel: { ...T.type.meta, color: T.color.textLow, minWidth: 100, textTransform: 'uppercase' },
  statusValue: { ...T.type.meta, color: T.color.accent },
  colorSwatch: { width: 30, height: 18, borderRadius: T.radius.none, borderWidth: T.border.thick, borderColor: T.color.lineStrong },
  segmentSection: { borderRadius: T.radius.none, borderWidth: T.border.hair, borderColor: T.color.line, overflow: 'hidden' },
  segmentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: T.space.md, backgroundColor: T.color.panelAlt },
  segmentHeaderLeft: { flex: 1, gap: T.space.xs },
  segmentName: { ...T.type.h2, fontSize: 14, color: T.color.textHi },
  segmentInfo: { ...T.type.meta, color: T.color.textLow },
  segmentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: T.space.sm },
  colorPreviewSmall: { width: 26, height: 26, borderRadius: T.radius.none, borderWidth: T.border.thick, borderColor: T.color.lineStrong },
  expandIcon: { ...T.type.meta, color: T.color.accent, fontSize: 12 },
  segmentControls: { gap: T.space.md, padding: T.space.md, backgroundColor: T.color.panel },
  controlRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  controlSection: { gap: T.space.sm },
  controlLabel: { ...T.type.meta, color: T.color.textMid, textTransform: 'uppercase' },
  brightnessHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brightnessValue: { ...T.type.meta, color: T.color.accent, fontSize: 12 },
  sliderContainer: { height: 40, justifyContent: 'center', position: 'relative' },
  sliderRail: { height: 4, backgroundColor: T.color.bgSunken, borderWidth: T.border.hair, borderColor: T.color.lineStrong },
  sliderTrack: { position: 'absolute', height: 4, backgroundColor: T.color.accent },
  sliderThumb: {
    position: 'absolute', width: 16, height: 22, borderRadius: T.radius.none,
    backgroundColor: T.color.accent, borderWidth: T.border.thick, borderColor: T.color.accentInk, marginLeft: -8,
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
  applyButton: { paddingVertical: T.space.sm, paddingHorizontal: T.space.lg, borderRadius: T.radius.none, backgroundColor: T.color.accent, marginLeft: 'auto' },
  applyButtonDisabled: { opacity: 0.5 },
  applyButtonText: { ...T.type.btn, fontSize: 12, color: T.color.accentInk },
  refreshButton: {
    paddingVertical: T.space.md, paddingHorizontal: T.space.lg, borderRadius: T.radius.none,
    backgroundColor: 'transparent', borderWidth: T.border.thick, borderColor: T.color.lineStrong, alignItems: 'center',
  },
  refreshButtonDisabled: { opacity: 0.5 },
  refreshButtonText: { ...T.type.tag, fontSize: 11, color: T.color.textMid },
  lockedText: { ...T.type.meta, color: T.color.warn },
  pendingText: { ...T.type.meta, color: T.color.textLow },
});

