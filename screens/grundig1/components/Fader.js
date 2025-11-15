import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import CustomSlider from '../../../components/CustomSlider';
import { colors, typography, spacing } from '../theme';

export default function Fader({
  value,
  onChange,
  onDragStart,
  onDragEnd,
  min = -12,
  max = 12,
  step = 0.5,
  defaultValue = 0,
  label,
  unit = 'dB',
  marks = true,
  showValue = true,
  height,
  thumbColor,
  thumbSize,
}) {
  const faderHeight = height || 200;
  
  // Use custom thumb color or default
  const thumbColorValue = thumbColor || colors.aluminum;
  const thumbWidthValue = thumbSize || 20;
  const thumbHeightValue = thumbSize || 40;
  
  // Custom vintage EQ slider knob renderer
  const renderVintageFaderKnob = ({ position, value, isDragging }) => {
    const knobWidth = thumbWidthValue;
    const knobHeight = thumbHeightValue;
    const ridgeCount = 8; // Number of ridges/grooves
    
    return (
      <View
        style={{
          position: 'absolute',
          left: position.x - knobWidth / 2,
          top: position.y - knobHeight / 2,
          width: knobWidth,
          height: knobHeight,
        }}
        pointerEvents="none"
      >
        {/* Main knob body with beveled edges */}
        <View
          style={[
            styles.vintageKnobBody,
            {
              width: knobWidth,
              height: knobHeight,
              backgroundColor: thumbColorValue,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 3,
              elevation: 4,
            },
          ]}
        >
          {/* Top highlight for 3D effect */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              backgroundColor: colors.chrome,
              opacity: 0.6,
            }}
          />
          
          {/* Ridges and grooves */}
          {Array.from({ length: ridgeCount }).map((_, i) => {
            const ridgeSpacing = knobHeight / (ridgeCount + 1);
            const ridgeTop = ridgeSpacing * (i + 1);
            const isRidge = i % 2 === 0; // Alternate between ridge and groove
            
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  top: ridgeTop - 0.5,
                  left: 2,
                  right: 2,
                  height: 1,
                  backgroundColor: isRidge
                    ? colors.aluminumDark // Ridge (darker)
                    : colors.chrome, // Groove (lighter highlight)
                  opacity: isRidge ? 0.4 : 0.2,
                }}
              />
            );
          })}
          
          {/* Side bevels for depth */}
          <View
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: colors.chrome,
              opacity: 0.3,
            }}
          />
          <View
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: colors.inkDim,
              opacity: 0.5,
            }}
          />
          
          {/* Bottom shadow edge */}
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: colors.inkDim,
              opacity: 0.6,
            }}
          />
        </View>
      </View>
    );
  };
  
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
        <View style={[styles.sliderWrapper, { height: faderHeight }]}>
          <CustomSlider
            value={value}
            onChange={onChange}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            min={min}
            max={max}
            step={step}
            defaultValue={defaultValue}
            orientation="vertical"
            renderThumb={renderVintageFaderKnob}
            railColor={colors.border}
            railHeight={4}
            minimumTrackColor={colors.accent}
            maximumTrackColor={colors.border}
            height={faderHeight}
            width="100%"
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
    justifyContent: 'center',
    width: '100%',
    flex: 1,
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
    maxWidth: 400,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
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
  vintageKnobBody: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.aluminumDark,
    overflow: 'hidden',
  },
});

