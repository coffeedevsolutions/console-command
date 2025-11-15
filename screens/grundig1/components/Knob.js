import React, { useRef, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, typography, spacing, shadows, mapRange } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

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
  const [localValue, setLocalValue] = useState(value); // Local state for smooth drag rendering
  const lastTapRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });
  const startTouchRef = useRef({ x: 0, y: 0, onHandle: false, justActivated: false });
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const dragStartAngleRef = useRef(null); // Track the angle when drag starts
  const lastDragAngleRef = useRef(null); // Track the last angle during drag to prevent wrapping
  const { isDraggingRef } = useGrundig1Store(); // Get the ref to prevent sync during drag

  // Sync localValue with prop value, but only when not dragging
  useEffect(() => {
    if (!isDragging) {
      setLocalValue(value);
    }
  }, [value, isDragging]);

  const minAngle = -135;
  const maxAngle = 135;
  // Use localValue during drag for smooth visual feedback, prop value otherwise
  const displayValue = isDragging ? localValue : value;
  const currentAngle = mapRange(displayValue, min, max, minAngle, maxAngle);
  
  // Touch ring size (larger than knob for easy touch)
  // For smaller knobs, use a more generous multiplier
  const touchRingSize = size < 60 ? size * 2.2 : size * 2;
  const touchRingRadius = touchRingSize / 2;

  const calculateAngleFromTouch = (x, y, preventWrap = false) => {
    const dx = x - centerRef.current.x;
    const dy = y - centerRef.current.y;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    
    // If preventing wrap during drag, use the last angle to determine direction
    if (preventWrap && dragStartAngleRef.current !== null && lastDragAngleRef.current !== null) {
      // Calculate the shortest path from last angle to new angle
      let angleDiff = angle - lastDragAngleRef.current;
      
      // Normalize angle difference to -180 to 180 range
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;
      
      // Calculate new angle based on last angle + difference
      let newAngle = lastDragAngleRef.current + angleDiff;
      
      // Clamp to valid range, but don't allow wrapping
      if (newAngle < minAngle) {
        // If we're trying to go below min, check if we were already at min
        if (lastDragAngleRef.current <= minAngle) {
          newAngle = minAngle; // Stay at min
        } else {
          newAngle = minAngle; // Clamp to min
        }
      } else if (newAngle > maxAngle) {
        // If we're trying to go above max, check if we were already at max
        if (lastDragAngleRef.current >= maxAngle) {
          newAngle = maxAngle; // Stay at max
        } else {
          newAngle = maxAngle; // Clamp to max
        }
      }
      
      lastDragAngleRef.current = newAngle;
      return newAngle;
    }
    
    // Normal behavior: clamp to valid range
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
      isDraggingRef.current = true; // Set flag to prevent sync during drag
      
      // Initialize drag tracking - store the starting angle
      const startAngle = calculateAngleFromTouch(locationX, locationY);
      dragStartAngleRef.current = startAngle;
      lastDragAngleRef.current = startAngle;
      
      // Calculate value from touch position
      const newValue = angleToValue(startAngle);
      setLocalValue(newValue); // Update local state immediately for smooth visual feedback
      if (newValue !== value) {
        // Use requestAnimationFrame for immediate smooth update
        requestAnimationFrame(() => {
          onChange(newValue);
        });
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

  // Use a ref to track animation frames for smooth updates
  const animationFrameRef = useRef(null);
  const pendingValueRef = useRef(null);
  
  const handleTouchMove = (evt) => {
    if (!isDragging || !isActive) return;
    
    const { locationX, locationY } = evt.nativeEvent;
    // Use preventWrap=true to prevent angle wrapping during drag
    const angle = calculateAngleFromTouch(locationX, locationY, true);
    const newValue = angleToValue(angle);
    
    // Update local state immediately for smooth visual feedback
    setLocalValue(newValue);
    
    // Store the pending value
    pendingValueRef.current = newValue;
    
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Use requestAnimationFrame for smooth updates
    animationFrameRef.current = requestAnimationFrame(() => {
      const valueToUpdate = pendingValueRef.current;
      if (valueToUpdate !== null && valueToUpdate !== value) {
        onChange(valueToUpdate);
        pendingValueRef.current = null;
      }
    });
  };

  const handleTouchEnd = (evt) => {
    // Cancel any pending animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Reset drag tracking
    dragStartAngleRef.current = null;
    lastDragAngleRef.current = null;
    
    // Check if this was a tap (not a drag)
    const wasDragging = isDragging;
    const wasOnHandle = startTouchRef.current.onHandle;
    const justActivated = startTouchRef.current.justActivated;
    setIsDragging(false);
    isDraggingRef.current = false; // Clear flag to allow sync again
    
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

  // Function to dismiss the ring when tapping outside
  const dismissRing = () => {
    if (isActive) {
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
    <View style={styles.container} pointerEvents="box-none">
      {label && <Text style={styles.label}>{label}</Text>}
      
      {/* Overlay to detect taps outside the dial area */}
      {isActive && (
        <TouchableWithoutFeedback onPress={dismissRing}>
          <View style={styles.overlay} pointerEvents="auto" />
        </TouchableWithoutFeedback>
      )}
      
      <View style={styles.knobWrapper} pointerEvents="box-none">
        <View 
          style={[styles.touchArea, { width: touchRingSize, height: touchRingSize }]}
          {...responder}
        >
          {/* Touch ring (appears on touch) */}
          {isActive && (
            <Animated.View style={[styles.touchRing, { opacity: ringOpacity }]}>
              <Svg width={touchRingSize} height={touchRingSize}>
                {/* Dashed circle split into valid and out-of-bounds sections */}
                {(() => {
                  const radius = touchRingRadius - 10;
                  
                  // Valid range arc (between minAngle and maxAngle)
                  const validStartRad = (minAngle) * (Math.PI / 180);
                  const validEndRad = (maxAngle) * (Math.PI / 180);
                  const validStartX = touchRingSize / 2 + radius * Math.cos(validStartRad);
                  const validStartY = touchRingSize / 2 + radius * Math.sin(validStartRad);
                  const validEndX = touchRingSize / 2 + radius * Math.cos(validEndRad);
                  const validEndY = touchRingSize / 2 + radius * Math.sin(validEndRad);
                  const validAngleDiff = maxAngle - minAngle;
                  const validLargeArc = validAngleDiff > 180 ? 1 : 0;
                  
                  // Left out-of-bounds arc (before -135°)
                  const leftStartAngle = -180;
                  const leftEndAngle = minAngle;
                  const leftStartRad = (leftStartAngle) * (Math.PI / 180);
                  const leftEndRad = (leftEndAngle) * (Math.PI / 180);
                  const leftStartX = touchRingSize / 2 + radius * Math.cos(leftStartRad);
                  const leftStartY = touchRingSize / 2 + radius * Math.sin(leftStartRad);
                  const leftEndX = touchRingSize / 2 + radius * Math.cos(leftEndRad);
                  const leftEndY = touchRingSize / 2 + radius * Math.sin(leftEndRad);
                  
                  // Right out-of-bounds arc (after +135°)
                  const rightStartAngle = maxAngle;
                  const rightEndAngle = 180;
                  const rightStartRad = (rightStartAngle) * (Math.PI / 180);
                  const rightEndRad = (rightEndAngle) * (Math.PI / 180);
                  const rightStartX = touchRingSize / 2 + radius * Math.cos(rightStartRad);
                  const rightStartY = touchRingSize / 2 + radius * Math.sin(rightStartRad);
                  const rightEndX = touchRingSize / 2 + radius * Math.cos(rightEndRad);
                  const rightEndY = touchRingSize / 2 + radius * Math.sin(rightEndRad);
                  
                  return (
                    <>
                      {/* Valid range - solid line (no dash) */}
                      <Path
                        d={`M ${validStartX} ${validStartY} A ${radius} ${radius} 0 ${validLargeArc} 1 ${validEndX} ${validEndY}`}
                        fill="transparent"
                        stroke={colors.border}
                        strokeWidth={2}
                      />
                      {/* Left out-of-bounds - red/dimmed to indicate out of bounds */}
                      <Path
                        d={`M ${leftStartX} ${leftStartY} A ${radius} ${radius} 0 0 1 ${leftEndX} ${leftEndY}`}
                        fill="transparent"
                        stroke="#ff4444"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        opacity={0.3}
                      />
                      {/* Right out-of-bounds - red/dimmed to indicate out of bounds */}
                      <Path
                        d={`M ${rightStartX} ${rightStartY} A ${radius} ${radius} 0 0 1 ${rightEndX} ${rightEndY}`}
                        fill="transparent"
                        stroke="#ff4444"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        opacity={0.3}
                      />
                    </>
                  );
                })()}
                
                {/* Active arc showing current value - white */}
                <Path
                  d={getArcPath()}
                  stroke="#ffffff"
                  strokeWidth={8}
                  fill="transparent"
                  strokeLinecap="butt"
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
                
                {/* Dash marks extending inward toward the knob */}
                {Array.from({ length: 11 }).map((_, i) => {
                  const angle = mapRange(i, 0, 10, minAngle, maxAngle);
                  const rad = (angle * Math.PI) / 180;
                  const radius = touchRingRadius - 10;
                  const centerX = touchRingSize / 2;
                  const centerY = touchRingSize / 2;
                  
                  // Calculate start and end points for the dash mark
                  // Start point is on the circle, end point extends inward toward center
                  const dashLength = i % 5 === 0 ? 8 : 5; // Longer dashes for major marks
                  const startX = centerX + radius * Math.cos(rad);
                  const startY = centerY + radius * Math.sin(rad);
                  const endX = centerX + (radius - dashLength) * Math.cos(rad);
                  const endY = centerY + (radius - dashLength) * Math.sin(rad);
                  
                  return (
                    <Line
                      key={i}
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#000000"
                      strokeWidth={i % 5 === 0 ? 2 : 1.5}
                      strokeLinecap="round"
                      opacity={i % 5 === 0 ? 0.9 : 0.7}
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
                      {/* Outer glow ring - white */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={16}
                        fill="transparent"
                        stroke="#ffffff"
                        strokeWidth={1}
                        opacity={0.3}
                      />
                      {/* Main handle - white */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={12}
                        fill="#ffffff"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      {/* Inner indicator - subtle dark center */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={6}
                        fill={colors.panel}
                        opacity={0.3}
                      />
                      {/* Center dot - white */}
                      <Circle
                        cx={handleX}
                        cy={handleY}
                        r={3}
                        fill="#ffffff"
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
                  stroke={isActive ? "#ffffff" : colors.aluminum}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
                
                {/* Line from center to drag handle - appears on top when active */}
                {isActive && (() => {
                  const angleRad = (currentAngle) * (Math.PI / 180);
                  // Calculate handle position (same as in touch ring)
                  const touchRingSize = size < 60 ? size * 2.2 : size * 2;
                  const touchRingRadius = touchRingSize / 2;
                  const handleOffset = size < 60 ? 12 : 15;
                  const handleRadius = touchRingRadius - handleOffset;
                  // Convert handle position to knob's coordinate system
                  // The knob is centered in the touch area, so we need to calculate relative to knob center
                  const knobCenterX = size / 2;
                  const knobCenterY = size / 2;
                  // The handle is at touchRingSize/2 + handleRadius * cos/sin, but we need it relative to knob
                  // Since knob is centered in touch area, the handle position relative to knob center is:
                  const handleX = knobCenterX + handleRadius * Math.cos(angleRad);
                  const handleY = knobCenterY + handleRadius * Math.sin(angleRad);
                  
                  return (
                    <Line
                      x1={knobCenterX}
                      y1={knobCenterY}
                      x2={handleX}
                      y2={handleY}
                      stroke="#ffffff"
                      strokeWidth={2}
                      strokeLinecap="round"
                      opacity={0.8}
                    />
                  );
                })()}
                
                {/* Center cap - white when active */}
                <Circle
                  cx={size / 2}
                  cy={size / 2}
                  r={6}
                  fill={isActive ? "#ffffff" : colors.aluminum}
                  stroke={isActive ? "#ffffff" : colors.border}
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
            {format(displayValue)}
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
    zIndex: 1,
  },
  touchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
    zIndex: 2,
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
    borderWidth: 0,
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
  overlay: {
    position: 'absolute',
    top: -Dimensions.get('window').height,
    left: -Dimensions.get('window').width,
    width: Dimensions.get('window').width * 3,
    height: Dimensions.get('window').height * 3,
    backgroundColor: 'transparent',
  },
});

