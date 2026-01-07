// components/LidLightCard.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet, PanResponder } from 'react-native';
import { useLidLight } from '../hooks/useLidLight';

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

  // Update RGB inputs when color changes
  useEffect(() => {
    if (color) {
      setRInput(String(color.r || 0));
      setGInput(String(color.g || 0));
      setBInput(String(color.b || 0));
    }
  }, [color]);

  // Update slider brightness when brightness changes (only if not dragging)
  useEffect(() => {
    if (!isDragging.current) {
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
    // Only send to API if value has changed significantly
    if (Math.abs(clampedValue - brightness) >= 1) {
      setBrightness(clampedValue);
    }
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
      onStartShouldSetPanResponder: () => !controlsDisabled && sliderLayoutRef.current.width > 0,
      onMoveShouldSetPanResponder: () => !controlsDisabled && sliderLayoutRef.current.width > 0,
      onPanResponderGrant: (evt) => {
        // Cancel any pending API call if user starts dragging again
        if (brightnessTimerRef.current) {
          clearTimeout(brightnessTimerRef.current);
          brightnessTimerRef.current = null;
        }
        
        isDragging.current = true;
        const newValue = calculateBrightnessFromTouch(evt.nativeEvent.pageX);
        setSliderBrightness(newValue);
        pendingBrightnessRef.current = newValue;
      },
      onPanResponderMove: (evt) => {
        const newValue = calculateBrightnessFromTouch(evt.nativeEvent.pageX);
        setSliderBrightness(newValue);
        pendingBrightnessRef.current = newValue;
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        
        // Clear any existing timer
        if (brightnessTimerRef.current) {
          clearTimeout(brightnessTimerRef.current);
        }
        
        // Set new timer - only send after 1.5 seconds of no movement
        if (pendingBrightnessRef.current !== null) {
          const valueToSend = pendingBrightnessRef.current;
          brightnessTimerRef.current = setTimeout(() => {
            handleBrightnessChange(valueToSend);
            brightnessTimerRef.current = null;
          }, 1500);
          pendingBrightnessRef.current = null;
        }
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        pendingBrightnessRef.current = null;
        
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

      {/* Error Display */}
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Power Control */}
      <View style={styles.controlSection}>
        <Text style={styles.controlLabel}>Power:</Text>
        <Switch
          value={isOn}
          onValueChange={handlePowerToggle}
          disabled={controlsDisabled}
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
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusSection: {
    gap: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 80,
  },
  statusValue: {
    fontSize: 14,
  },
  colorSwatch: {
    width: 40,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#999',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 14,
    color: '#d00',
  },
  controlSection: {
    gap: 8,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  brightnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brightnessValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  sliderContainer: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderRail: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
  },
  sliderTrack: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    borderWidth: 3,
    borderColor: '#fff',
    marginLeft: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sliderThumbDisabled: {
    opacity: 0.5,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#E5E5EA',
    borderWidth: 1,
    borderColor: '#C7C7CC',
  },
  presetChipDisabled: {
    opacity: 0.5,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  rgbInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rgbInputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rgbLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rgbInput: {
    width: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 6,
    fontSize: 14,
    textAlign: 'center',
  },
  applyButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    marginLeft: 'auto',
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  lockedText: {
    fontSize: 12,
    color: '#f80',
    fontStyle: 'italic',
  },
  pendingText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

