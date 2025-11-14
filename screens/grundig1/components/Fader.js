import React, { useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, typography, spacing } from '../theme';

export default function Fader({
  value,
  onChange,
  min = -12,
  max = 12,
  step = 0.5,
  defaultValue = 0,
  label,
  unit = 'dB',
  marks = true,
  showValue = true,
  height,
}) {
  const lastTapRef = useRef(0);

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      onChange(defaultValue);
    }
    lastTapRef.current = now;
  };

  const faderHeight = height || 200;
  
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[styles.faderContainer, { height: faderHeight }]}>
        {/* Tick marks */}
        {marks && (
          <View style={[styles.ticksContainer, { height: faderHeight }]}>
            {Array.from({ length: 13 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.tick,
                  i % 4 === 0 ? styles.tickMajor : styles.tickMinor,
                ]}
              />
            ))}
          </View>
        )}
        
        {/* Fader track and thumb */}
        <View style={[styles.sliderWrapper, { height: faderHeight }]} onTouchEnd={handleDoubleTap}>
          <Slider
            style={styles.slider}
            value={value}
            onValueChange={onChange}
            minimumValue={min}
            maximumValue={max}
            step={step}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.aluminum}
          />
        </View>

        {/* Value display */}
        {showValue && (
          <View style={styles.valueContainer}>
            <Text style={styles.valueText}>
              {value > 0 ? '+' : ''}
              {value.toFixed(1)}
            </Text>
            <Text style={styles.unitText}>{unit}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
    justifyContent: 'flex-start',
    minWidth: 60,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  faderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  ticksContainer: {
    justifyContent: 'space-between',
    marginRight: spacing.xs,
  },
  tick: {
    height: 1,
    backgroundColor: colors.inkDim,
  },
  tickMinor: {
    width: 4,
  },
  tickMajor: {
    width: 8,
    backgroundColor: colors.inkMuted,
  },
  sliderWrapper: {
    flex: 1,
    maxWidth: 200,
    justifyContent: 'center',
    transform: [{ rotate: '-90deg' }],
  },
  slider: {
    width: 180,
    height: 40,
  },
  valueContainer: {
    marginLeft: spacing.xs,
    alignItems: 'flex-start',
    minWidth: 40,
  },
  valueText: {
    fontSize: typography.small,
    color: colors.ink,
    fontWeight: '600',
  },
  unitText: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
  },
});

