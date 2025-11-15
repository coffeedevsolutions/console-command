import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, typography, spacing, shadows, mapRange } from '../theme';

export default function Knob({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  label,
  format = (v) => v.toFixed(0),
  size = 60,
}) {
  const [isActive, setIsActive] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lastTapRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });
  const startTouchRef = useRef({ x: 0, y: 0, onHandle: false, justActivated: false });
  const ringOpacity = useRef(new Animated.Value(0)).current;

  const minAngle = -135;
  const maxAngle = 135;
  const currentAngle = mapRange(value, min, max, minAngle, maxAngle);
  
  // Touch ring size (larger than knob for easy touch)
  // For smaller knobs, use a more generous multiplier
  const touchRingSize = size < 60 ? size * 2.2 : size * 2;
  const touchRingRadius = touchRingSize / 2;

  const calculateAngleFromTouch = (x, y) => {
    const dx = x - centerRef.current.x;
    const dy = y - centerRef.current.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // Clamp to valid range
    if (angle < minAngle) angle = minAngle;
    if (angle > maxAngle) angle = maxAngle;
    
    return angle;
  };

  const angleToValue = (angle) => {
    let newValue = mapRange(angle, minAngle, maxAngle, min, max);
    newValue = Math.round(newValue / step) * step;
    return Math.max(min, Math.min(max, newValue));
  };

  const isTouchOnHandle = (x, y) => {
    // Calculate the position of the handle at the end of the arc
    const angleRad = (currentAngle) * (Math.PI / 180);
    // Adjust handle radius for smaller knobs
    const handleOffset = size < 60 ? 12 : 15;
    const radius = touchRingRadius - handleOffset;
    const handleX = touchRingSize / 2 + radius * Math.cos(angleRad);
    const handleY = touchRingSize / 2 + radius * Math.sin(angleRad);
    
    const dx = x - handleX;
    const dy = y - handleY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Check if touch is within handle radius (make it generous for easy touch)
    // Scale handle touch radius based on knob size
    const handleRadius = size < 60 ? 18 : 20;
    return distance <= handleRadius;
  };
  
  const isTouchInCenter = (x, y) => {
    const centerX = touchRingSize / 2;
    const centerY = touchRingSize / 2;
    const dx = x - centerX;
    const dy = y - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    // Center area is roughly the knob size
    return distance <= size / 2 + 5;
  };

  const handleTouchStart = (evt) => {
    const { locationX, locationY } = evt.nativeEvent;
    
    // Store center position for calculations
    centerRef.current = {
      x: touchRingSize / 2,
      y: touchRingSize / 2,
    };

    const touchingHandle = isActive && isTouchOnHandle(locationX, locationY);
    
    // Store initial touch position
    startTouchRef.current = {
      x: locationX,
      y: locationY,
      onHandle: touchingHandle,
      justActivated: false,
    };

    // If ring is active and touching the handle, start dragging
    if (isActive && touchingHandle) {
      setIsDragging(true);
      
      // Calculate value from touch position
      const angle = calculateAngleFromTouch(locationX, locationY);
      const newValue = angleToValue(angle);
      if (newValue !== value) {
        onChange(newValue);
      }
      return;
    }

    // If ring is not active, activate it on any tap anywhere on the dial
    if (!isActive) {
      startTouchRef.current.justActivated = true; // Mark that we just activated it
      setIsActive(true);
      
      // Animate ring appearance
      Animated.spring(ringOpacity, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
      return;
    }
  };

  const handleTouchMove = (evt) => {
    if (!isDragging || !isActive) return;
    
    const { locationX, locationY } = evt.nativeEvent;
    const angle = calculateAngleFromTouch(locationX, locationY);
    const newValue = angleToValue(angle);
    
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleTouchEnd = (evt) => {
    // Check if this was a tap (not a drag)
    const wasDragging = isDragging;
    const wasOnHandle = startTouchRef.current.onHandle;
    const justActivated = startTouchRef.current.justActivated;
    setIsDragging(false);
    
    // If we were dragging the handle, don't process as a tap
    if (wasDragging) return;
    
    // If we tapped on the handle (but didn't drag), don't dismiss
    if (wasOnHandle) return;
    
    // If we just activated the ring in this touch, don't dismiss it immediately
    if (justActivated) return;
    
    // If ring is active, check if tap was in center to dismiss
    if (isActive && evt) {
      const { locationX, locationY } = evt.nativeEvent;
      const tappedCenter = isTouchInCenter(locationX, locationY);
      
      if (tappedCenter) {
        // Center tap dismisses the ring
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setIsActive(false);
        });
        return;
      }
    }
    
    // If ring is active and we tapped anywhere (not the handle, not center), dismiss it
    if (isActive) {
      // Check for double tap to reset value
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        onChange(defaultValue);
        lastTapRef.current = 0;
        
        // Also dismiss the ring
        Animated.timing(ringOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setIsActive(false);
        });
        return;
      }
      lastTapRef.current = now;

      // Dismiss the ring
      Animated.timing(ringOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsActive(false);
      });
    }
  };

  const responder = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => isActive,
    onResponderGrant: (evt) => {
      const touch = evt.nativeEvent.touches[0];
      if (touch) {
        handleTouchStart({ nativeEvent: { locationX: touch.locationX, locationY: touch.locationY } });
      }
    },
    onResponderMove: (evt) => {
      const touch = evt.nativeEvent.touches[0];
      if (touch) {
        handleTouchMove({ nativeEvent: { locationX: touch.locationX, locationY: touch.locationY } });
      }
    },
    onResponderRelease: (evt) => {
      const touch = evt.nativeEvent.touches?.[0] || evt.nativeEvent.changedTouches?.[0];
      if (touch) {
        handleTouchEnd({ nativeEvent: { locationX: touch.locationX, locationY: touch.locationY } });
      } else {
        handleTouchEnd(null);
      }
    },
    onResponderTerminate: (evt) => {
      const touch = evt.nativeEvent.touches?.[0] || evt.nativeEvent.changedTouches?.[0];
      if (touch) {
        handleTouchEnd({ nativeEvent: { locationX: touch.locationX, locationY: touch.locationY } });
      } else {
        handleTouchEnd(null);
      }
    },
  };

  // Generate arc path for the active touch ring indicator
  const getArcPath = () => {
    // Convert angles to radians for SVG path
    // In SVG: 0° is at 3 o'clock (east), increases clockwise
    // Our knob: -135° is at ~8 o'clock, +135° is at ~4 o'clock
    const radius = touchRingRadius - 15;
    
    // Start from minAngle position (-135°)
    const startAngleRad = (minAngle) * (Math.PI / 180);
    const startX = touchRingSize / 2 + radius * Math.cos(startAngleRad);
    const startY = touchRingSize / 2 + radius * Math.sin(startAngleRad);
    
    // End at current value position
    const endAngleRad = (currentAngle) * (Math.PI / 180);
    const endX = touchRingSize / 2 + radius * Math.cos(endAngleRad);
    const endY = touchRingSize / 2 + radius * Math.sin(endAngleRad);
    
    // Calculate if we need the large arc flag (for arcs > 180°)
    const angleDiff = currentAngle - minAngle;
    const largeArc = angleDiff > 180 ? 1 : 0;
    
    return `M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}`;
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={styles.knobWrapper}>
        <View 
          style={[styles.touchArea, { width: touchRingSize, height: touchRingSize }]}
          {...responder}
        >
          {/* Touch ring (appears on touch) */}
          {isActive && (
            <Animated.View style={[styles.touchRing, { opacity: ringOpacity }]}>
              <Svg width={touchRingSize} height={touchRingSize}>
                {/* Background circle */}
                <Circle
                  cx={touchRingSize / 2}
                  cy={touchRingSize / 2}
                  r={touchRingRadius - 10}
                  fill="transparent"
                  stroke={colors.border}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
                
                {/* Active arc showing current value */}
                <Path
                  d={getArcPath()}
                  stroke={colors.accent}
                  strokeWidth={8}
                  fill="transparent"
                  strokeLinecap="round"
                />
                
                {/* Pointer line from center to handle position */}
                {(() => {
                  const angleRad = (currentAngle) * (Math.PI / 180);
                  const innerRadius = 0;
                  const outerRadius = touchRingRadius - 15;
                  const x1 = touchRingSize / 2 + innerRadius * Math.cos(angleRad);
                  const y1 = touchRingSize / 2 + innerRadius * Math.sin(angleRad);
                  const x2 = touchRingSize / 2 + outerRadius * Math.cos(angleRad);
                  const y2 = touchRingSize / 2 + outerRadius * Math.sin(angleRad);
                  
                  return (
                    <Line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={colors.accent}
                      strokeWidth={2}
                      opacity={0.4}
                      strokeDasharray="4 2"
                    />
                  );
                })()}
                
                {/* Touch indicators around the ring */}
                {Array.from({ length: 11 }).map((_, i) => {
                  const angle = mapRange(i, 0, 10, minAngle, maxAngle);
                  const rad = (angle * Math.PI) / 180;
                  const radius = touchRingRadius - 10;
                  const x = touchRingSize / 2 + radius * Math.cos(rad);
                  const y = touchRingSize / 2 + radius * Math.sin(rad);
                  
                  return (
                    <Circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={3}
                      fill={i % 5 === 0 ? colors.ink : colors.inkDim}
                      opacity={0.6}
                    />
                  );
                })}
                
                {/* Draggable handle at the end of the arc */}
                {(() => {
                  const angleRad = (currentAngle) * (Math.PI / 180);
                  // Adjust handle radius for smaller knobs
                  const handleOffset = size < 60 ? 12 : 15;
                  const radius = touchRingRadius - handleOffset;
                  const handleX = touchRingSize / 2 + radius * Math.cos(angleRad);
                  const handleY = touchRingSize / 2 + radius * Math.sin(angleRad);
                  
                  return (
                    <>
                      {/* Outer glow ring */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={16}
                        fill="transparent"
                        stroke={colors.accent}
                        strokeWidth={1}
                        opacity={0.3}
                      />
                      {/* Main handle */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={12}
                        fill={isDragging ? colors.accent : colors.aluminum}
                        stroke={colors.accent}
                        strokeWidth={2}
                      />
                      {/* Inner indicator */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={6}
                        fill={colors.panel}
                        opacity={0.5}
                      />
                      {/* Center dot */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={3}
                        fill={isDragging ? colors.accent : colors.ink}
                      />
                    </>
                  );
                })()}
              </Svg>
            </Animated.View>
          )}

          {/* Knob body (centered in touch area) */}
          <View style={[styles.knob, { width: size, height: size }]}>
            <View style={[styles.knobBody, { width: size, height: size }, shadows.md]}>
              <Svg width={size} height={size} style={styles.svg}>
                {/* Outer ring */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={size / 2 - 2}
                  fill={colors.panelLight}
                  stroke={colors.border}
                  strokeWidth={1}
                />
                
                {/* Tick marks */}
                {Array.from({ length: 11 }).map((_, i) => {
                  const angle = mapRange(i, 0, 10, minAngle, maxAngle);
                  const rad = (angle * Math.PI) / 180;
                  const innerRadius = size / 2 - 8;
                  const outerRadius = size / 2 - 4;
                  const x1 = size / 2 + innerRadius * Math.cos(rad);
                  const y1 = size / 2 + innerRadius * Math.sin(rad);
                  const x2 = size / 2 + outerRadius * Math.cos(rad);
                  const y2 = size / 2 + outerRadius * Math.sin(rad);
                  
                  return (
                    <Line
                      key={i}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={i % 5 === 0 ? colors.ink : colors.inkDim}
                      strokeWidth={i % 5 === 0 ? 1.5 : 1}
                    />
                  );
                })}
                
                {/* Pointer */}
                <Line
                  x1={size / 2}
                  y1={size / 2}
                  x2={size / 2 + (size / 2 - 12) * Math.cos((currentAngle * Math.PI) / 180)}
                  y2={size / 2 + (size / 2 - 12) * Math.sin((currentAngle * Math.PI) / 180)}
                  stroke={isActive ? colors.accent : colors.aluminum}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                
                {/* Center cap */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={6}
                  fill={isActive ? colors.accent : colors.aluminum}
                  stroke={isActive ? colors.accent : colors.border}
                  strokeWidth={isActive ? 2 : 1}
                />
                
                {/* Center tap indicator when active */}
                {isActive && (
                  <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={4}
                    fill={colors.panel}
                    opacity={0.3}
                  />
                )}
              </Svg>
            </View>
          </View>
        </View>
      </View>

      {/* Value display - only show if label is provided */}
      {label && (
        <View style={styles.valueContainer}>
          <Text style={[styles.valueText, isActive && styles.valueTextActive]}>
            {format(value)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginVertical: 0,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  knobWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  touchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  touchRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  knobBody: {
    borderRadius: 9999,
    backgroundColor: colors.panelLight,
    borderWidth: 2,
    borderColor: colors.border,
  },
  svg: {
    position: 'absolute',
  },
  valueContainer: {
    marginTop: spacing.xs,
    minHeight: 20,
  },
  valueText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  valueTextActive: {
    color: colors.accent,
  },
});

