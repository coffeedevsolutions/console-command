import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, PanResponder } from 'react-native';

// Helper function for mapping ranges
const mapRange = (value, inMin, inMax, outMin, outMax) => {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
};

// Helper function for clamping values
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export default function CustomSlider({
  // Core functionality
  value,
  onChange,
  onDragStart,
  onDragEnd,
  min = 0,
  max = 100,
  step = 1,
  defaultValue = 50,
  
  // Orientation
  orientation = 'auto', // 'horizontal' | 'vertical' | 'auto'
  
  // Thumb customization
  thumbShape = 'circular', // 'rectangular' | 'circular' | 'rounded' | 'custom'
  thumbWidth = 20,
  thumbHeight = 20,
  thumbRadius,
  thumbColor = '#c7cdd6',
  thumbBorderColor,
  thumbBorderWidth = 0,
  renderThumb,
  
  // Rail customization
  railColor = '#2a2e33',
  railHeight = 4,
  railBorderColor,
  railBorderWidth = 0,
  renderRail,
  
  // Track customization (filled portion)
  minimumTrackColor = '#cfe6ff',
  maximumTrackColor,
  
  // Style overrides
  thumbStyle,
  railStyle,
  trackStyle,
  containerStyle,
  
  // Layout
  width,
  height,
  style,
}) {
  const [detectedOrientation, setDetectedOrientation] = useState(orientation);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const lastTapRef = useRef(0);
  const isDraggingRef = useRef(false);
  const containerRef = useRef(null);
  
  // Use maximumTrackColor or fallback to railColor
  const maxTrackColor = maximumTrackColor || railColor;
  
  // Calculate thumb radius based on shape
  const calculatedThumbRadius = useMemo(() => {
    if (thumbRadius !== undefined) return thumbRadius;
    if (thumbShape === 'circular') {
      return Math.max(thumbWidth, thumbHeight) / 2;
    }
    return 0;
  }, [thumbShape, thumbWidth, thumbHeight, thumbRadius]);
  
  // Determine actual orientation
  const actualOrientation = useMemo(() => {
    if (orientation !== 'auto') return orientation;
    if (containerDimensions.width === 0 || containerDimensions.height === 0) {
      return 'horizontal'; // Default until measured
    }
    return containerDimensions.width > containerDimensions.height ? 'horizontal' : 'vertical';
  }, [orientation, containerDimensions]);
  
  // Calculate thumb position as percentage (0-1)
  const thumbPosition = useMemo(() => {
    return mapRange(value, min, max, 0, 1);
  }, [value, min, max]);
  
  // Convert position to pixel value
  const positionToValue = useCallback((position) => {
    const rawValue = mapRange(position, 0, 1, min, max);
    const steppedValue = Math.round(rawValue / step) * step;
    return clamp(steppedValue, min, max);
  }, [min, max, step]);
  
  // Convert touch coordinate to value
  const touchToValue = useCallback((x, y) => {
    const { width: w, height: h } = containerDimensions;
    if (w === 0 || h === 0) return value;
    
    let position;
    if (actualOrientation === 'horizontal') {
      // Clamp x to rail bounds (accounting for thumb size)
      const thumbOffset = Math.max(thumbWidth, thumbHeight) / 2;
      const railStart = thumbOffset;
      const railEnd = w - thumbOffset;
      const clampedX = clamp(x, railStart, railEnd);
      position = (clampedX - railStart) / (railEnd - railStart);
    } else {
      // Vertical: y=0 is top (max), y=h is bottom (min) - inverted
      const thumbOffset = Math.max(thumbWidth, thumbHeight) / 2;
      const railStart = thumbOffset;
      const railEnd = h - thumbOffset;
      const clampedY = clamp(y, railStart, railEnd);
      position = 1 - (clampedY - railStart) / (railEnd - railStart); // Inverted for vertical
    }
    
    return positionToValue(position);
  }, [containerDimensions, actualOrientation, thumbWidth, thumbHeight, positionToValue, value]);
  
  // Handle container layout
  const handleLayout = useCallback((event) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setContainerDimensions({ width: w, height: h });
      if (orientation === 'auto') {
        setDetectedOrientation(w > h ? 'horizontal' : 'vertical');
      }
    }
  }, [orientation]);
  
  // PanResponder for touch handling - recreate when dependencies change
  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderTerminationRequest: () => false,
      
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        if (onDragStart) onDragStart();
        const { locationX, locationY } = evt.nativeEvent;
        const newValue = touchToValue(locationX, locationY);
        onChange(newValue);
      },
      
      onPanResponderMove: (evt) => {
        if (!isDraggingRef.current) return;
        const { locationX, locationY } = evt.nativeEvent;
        const newValue = touchToValue(locationX, locationY);
        onChange(newValue);
      },
      
      onPanResponderRelease: () => {
        isDraggingRef.current = false;
        if (onDragEnd) onDragEnd();
        
        // Check for double tap
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          onChange(defaultValue);
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      },
      
      onPanResponderTerminate: () => {
        isDraggingRef.current = false;
        if (onDragEnd) onDragEnd();
      },
    }),
    [touchToValue, onChange, onDragStart, onDragEnd, defaultValue]
  );
  
  // Calculate thumb position in pixels
  const thumbPositionPx = useMemo(() => {
    const { width: w, height: h } = containerDimensions;
    if (w === 0 || h === 0) return { x: 0, y: 0 };
    
    const thumbOffset = Math.max(thumbWidth, thumbHeight) / 2;
    
    if (actualOrientation === 'horizontal') {
      const railStart = thumbOffset;
      const railEnd = w - thumbOffset;
      const x = railStart + (railEnd - railStart) * thumbPosition;
      return { x, y: h / 2 };
    } else {
      const railStart = thumbOffset;
      const railEnd = h - thumbOffset;
      const y = railEnd - (railEnd - railStart) * thumbPosition; // Inverted for vertical
      return { x: w / 2, y };
    }
  }, [containerDimensions, actualOrientation, thumbPosition, thumbWidth, thumbHeight]);
  
  // Calculate track (filled portion) dimensions
  const trackDimensions = useMemo(() => {
    const { width: w, height: h } = containerDimensions;
    if (w === 0 || h === 0) return { width: 0, height: 0, x: 0, y: 0 };
    
    const thumbOffset = Math.max(thumbWidth, thumbHeight) / 2;
    
    if (actualOrientation === 'horizontal') {
      const railStart = thumbOffset;
      const railEnd = w - thumbOffset;
      const trackWidth = (railEnd - railStart) * thumbPosition;
      return {
        width: trackWidth,
        height: railHeight,
        x: railStart,
        y: (h - railHeight) / 2,
      };
    } else {
      const railStart = thumbOffset;
      const railEnd = h - thumbOffset;
      const trackHeight = (railEnd - railStart) * thumbPosition;
      return {
        width: railHeight,
        height: trackHeight,
        x: (w - railHeight) / 2,
        y: railEnd - trackHeight, // Start from bottom
      };
    }
  }, [containerDimensions, actualOrientation, thumbPosition, thumbWidth, thumbHeight, railHeight]);
  
  // Render thumb based on shape
  const renderThumbElement = useCallback(() => {
    if (renderThumb) {
      return renderThumb({
        position: thumbPositionPx,
        value,
        isDragging: isDraggingRef.current,
      });
    }
    
    const thumbStyles = [
      {
        position: 'absolute',
        left: thumbPositionPx.x - thumbWidth / 2,
        top: thumbPositionPx.y - thumbHeight / 2,
        width: thumbWidth,
        height: thumbHeight,
        backgroundColor: thumbColor,
        ...(thumbBorderWidth > 0 && {
          borderWidth: thumbBorderWidth,
          borderColor: thumbBorderColor || thumbColor,
        }),
        ...(thumbShape === 'circular' && {
          borderRadius: calculatedThumbRadius,
        }),
        ...(thumbShape === 'rounded' && calculatedThumbRadius > 0 && {
          borderRadius: calculatedThumbRadius,
        }),
      },
      thumbStyle,
    ];
    
    return <View style={thumbStyles} pointerEvents="none" />;
  }, [
    renderThumb,
    thumbPositionPx,
    value,
    thumbWidth,
    thumbHeight,
    thumbColor,
    thumbBorderWidth,
    thumbBorderColor,
    thumbShape,
    calculatedThumbRadius,
    thumbStyle,
  ]);
  
  // Render rail
  const renderRailElement = useCallback(() => {
    if (renderRail) {
      return renderRail({
        dimensions: containerDimensions,
        orientation: actualOrientation,
        railHeight,
      });
    }
    
    const { width: w, height: h } = containerDimensions;
    if (w === 0 || h === 0) return null;
    
    const railStyles = [
      {
        position: 'absolute',
        ...(actualOrientation === 'horizontal' ? {
          width: w,
          height: railHeight,
          left: 0,
          top: (h - railHeight) / 2,
        } : {
          width: railHeight,
          height: h,
          left: (w - railHeight) / 2,
          top: 0,
        }),
        backgroundColor: railColor,
        ...(railBorderWidth > 0 && {
          borderWidth: railBorderWidth,
          borderColor: railBorderColor || railColor,
        }),
      },
      railStyle,
    ];
    
    return <View style={railStyles} pointerEvents="none" />;
  }, [renderRail, containerDimensions, actualOrientation, railHeight, railColor, railBorderWidth, railBorderColor, railStyle]);
  
  // Render track (filled portion)
  const renderTrackElement = useCallback(() => {
    if (trackDimensions.width === 0 && trackDimensions.height === 0) return null;
    
    const trackStyles = [
      {
        position: 'absolute',
        ...trackDimensions,
        backgroundColor: minimumTrackColor,
      },
      trackStyle,
    ];
    
    return <View style={trackStyles} pointerEvents="none" />;
  }, [trackDimensions, minimumTrackColor, trackStyle]);
  
  return (
    <View
      ref={containerRef}
      style={[
        {
          width: width || '100%',
          height: height || '100%',
          position: 'relative',
        },
        containerStyle,
        style,
      ]}
      onLayout={handleLayout}
      collapsable={false}
      {...panResponder.panHandlers}
    >
      {/* Rail (background track) */}
      {renderRailElement()}
      
      {/* Track (filled portion) */}
      {renderTrackElement()}
      
      {/* Thumb */}
      {renderThumbElement()}
    </View>
  );
}

