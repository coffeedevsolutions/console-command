// hooks/useLedSegments.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { dsp } from '../api/dspClient';

/**
 * Custom hook for managing LED segment state and API interactions
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.code - Optional 6-digit unlock code
 * @param {number} options.pollingInterval - Polling interval in ms (default: 3000)
 * @returns {Object} Hook state and methods
 */
export function useLedSegments({ code, pollingInterval = 3000 } = {}) {
  // Segment state
  const [linkMode, setLinkMode] = useState('linked'); // 'linked' or 'independent'
  const [segments, setSegments] = useState([
    {
      id: 1,
      name: 'lid',
      startIdx: 0,
      count: 88,
      enabled: true,
      color: { r: 255, g: 200, b: 150 },
      brightness: 100,
    },
    {
      id: 2,
      name: 'vent',
      startIdx: 88,
      count: 8,
      enabled: true,
      color: { r: 100, g: 150, b: 255 },
      brightness: 50,
    },
  ]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(false);
  
  const pollingTimerRef = useRef(null);
  const pendingBrightnessRef = useRef({});
  const brightnessTimersRef = useRef({});
  const consecutiveFailuresRef = useRef(0);

  /**
   * Fetch current segment status from server
   * @param {boolean} showLoading - Whether to show loading indicator
   */
  const refresh = useCallback(async (showLoading = true) => {
    console.log('[useLedSegments] refresh called, showLoading:', showLoading);
    if (showLoading) {
      setLoading(true);
      consecutiveFailuresRef.current = 0; // manual refresh resets backoff
    }
    setError(null);
    
    try {
      console.log('[useLedSegments] Fetching segment status...');
      const result = await dsp.getSegmentStatus(code);
      console.log('[useLedSegments] Segment status response:', JSON.stringify(result));
      
      if (result.ok) {
        consecutiveFailuresRef.current = 0;
        const newLinkMode = result.linkMode || 'linked';
        console.log('[useLedSegments] Setting linkMode to:', newLinkMode);
        setLinkMode(newLinkMode);
        if (result.segments && Array.isArray(result.segments)) {
          console.log('[useLedSegments] Setting segments:', JSON.stringify(result.segments));
          setSegments(result.segments);
        } else {
          console.warn('[useLedSegments] No segments array in response');
        }
      } else {
        console.warn('[useLedSegments] Response not ok:', result);
      }
    } catch (err) {
      consecutiveFailuresRef.current += 1;
      const errorMsg = err.message || 'Failed to fetch segment status';
      console.error('[useLedSegments] Error fetching status:', err);
      if (consecutiveFailuresRef.current <= 3) {
        console.error('[useLedSegments] Error details:', {
          name: err.name,
          message: err.message,
          stack: err.stack,
        });
      }
      if (consecutiveFailuresRef.current === 3) {
        console.warn('[useLedSegments] Device unreachable after 3 attempts, pausing polling');
      }
      setError(errorMsg);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [code]);

  /**
   * Set segment color
   * @param {number} segmentId - 1 or 2
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @param {boolean} skipRefresh - Skip refresh after setting (useful for syncing)
   */
  const setSegmentColor = useCallback(async (segmentId, r, g, b, skipRefresh = false) => {
    console.log('[useLedSegments] setSegmentColor called:', { segmentId, r, g, b, skipRefresh });
    
    // Validate and clamp RGB values
    const clampedR = Math.max(0, Math.min(255, Math.round(r)));
    const clampedG = Math.max(0, Math.min(255, Math.round(g)));
    const clampedB = Math.max(0, Math.min(255, Math.round(b)));
    
    console.log('[useLedSegments] Clamped RGB values:', { clampedR, clampedG, clampedB });

    setPendingAction(true);
    setError(null);
    
    try {
      // Optimistically update local state
      setSegments(prev => prev.map(seg => 
        seg.id === segmentId 
          ? { ...seg, color: { r: clampedR, g: clampedG, b: clampedB } }
          : seg
      ));
      
      console.log('[useLedSegments] Calling API setSegmentColor...');
      const result = await dsp.setSegmentColor(segmentId, clampedR, clampedG, clampedB, code);
      console.log('[useLedSegments] API setSegmentColor response:', JSON.stringify(result));
      
      // Refresh to get confirmed state (unless skipping for sync)
      if (!skipRefresh) {
        await new Promise(resolve => setTimeout(resolve, 300));
        await refresh(false);
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to set segment color';
      console.error('[useLedSegments] Error setting color:', err);
      console.error('[useLedSegments] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      setError(errorMsg);
      // Revert on error
      if (!skipRefresh) {
        await refresh(false);
      }
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Set segment color using preset
   * @param {number} segmentId - 1 or 2
   * @param {string} preset - Preset name (WARM, COOL, WHITE, RED, GREEN, BLUE, PURPLE, ORANGE)
   */
  const setSegmentColorPreset = useCallback(async (segmentId, preset) => {
    console.log('[useLedSegments] setSegmentColorPreset called:', { segmentId, preset });
    
    // Map presets to RGB values (same as lid light)
    const presetColors = {
      WARM: { r: 255, g: 200, b: 150 },
      COOL: { r: 150, g: 200, b: 255 },
      WHITE: { r: 255, g: 255, b: 255 },
      RED: { r: 255, g: 0, b: 0 },
      GREEN: { r: 0, g: 255, b: 0 },
      BLUE: { r: 0, g: 0, b: 255 },
      PURPLE: { r: 200, g: 0, b: 255 },
      ORANGE: { r: 255, g: 128, b: 0 },
    };

    const color = presetColors[preset];
    if (!color) {
      console.warn('[useLedSegments] Unknown preset:', preset);
      return;
    }

    console.log('[useLedSegments] Preset color:', color);
    return setSegmentColor(segmentId, color.r, color.g, color.b);
  }, [setSegmentColor]);

  /**
   * Set segment brightness with debouncing
   * @param {number} segmentId - 1 or 2
   * @param {number} brightness - 0-100
   * @param {boolean} skipRefresh - Skip refresh after setting (useful for syncing)
   */
  const setSegmentBrightness = useCallback(async (segmentId, brightness, skipRefresh = false) => {
    console.log('[useLedSegments] setSegmentBrightness called:', { segmentId, brightness, skipRefresh });
    
    const clampedValue = Math.max(0, Math.min(100, Math.round(brightness)));
    console.log('[useLedSegments] Clamped brightness:', clampedValue);
    
    setPendingAction(true);
    setError(null);
    
    try {
      // Optimistically update local state
      setSegments(prev => prev.map(seg => 
        seg.id === segmentId 
          ? { ...seg, brightness: clampedValue }
          : seg
      ));
      
      console.log('[useLedSegments] Calling API setSegmentBrightness...');
      const result = await dsp.setSegmentBrightness(segmentId, clampedValue, code);
      console.log('[useLedSegments] API setSegmentBrightness response:', JSON.stringify(result));
      
      // Wait a bit for hardware to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh to get confirmed state (unless skipping for sync)
      if (!skipRefresh) {
        await refresh(false);
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to set segment brightness';
      console.error('[useLedSegments] Error setting brightness:', err);
      console.error('[useLedSegments] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      setError(errorMsg);
      // Revert on error
      if (!skipRefresh) {
        await refresh(false);
      }
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Debounced brightness change (for slider interactions)
   * @param {number} segmentId - 1 or 2
   * @param {number} brightness - 0-100
   */
  const debouncedSetBrightness = useCallback((segmentId, brightness) => {
    const clampedValue = Math.max(0, Math.min(100, Math.round(brightness)));
    console.log('[useLedSegments] debouncedSetBrightness called:', { segmentId, brightness, clampedValue });
    
    // Update local state immediately for smooth UI
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId 
        ? { ...seg, brightness: clampedValue }
        : seg
    ));
    
    // Store pending value
    pendingBrightnessRef.current[segmentId] = clampedValue;
    
    // Clear existing timer for this segment
    if (brightnessTimersRef.current[segmentId]) {
      console.log('[useLedSegments] Clearing existing brightness timer for segment', segmentId);
      clearTimeout(brightnessTimersRef.current[segmentId]);
    }
    
    // Set new timer - only send after 1.5 seconds of no changes
    console.log('[useLedSegments] Setting 1.5s timer for segment', segmentId, 'brightness', clampedValue);
    brightnessTimersRef.current[segmentId] = setTimeout(() => {
      const valueToSend = pendingBrightnessRef.current[segmentId];
      console.log('[useLedSegments] Timer fired for segment', segmentId, 'sending brightness:', valueToSend);
      if (valueToSend !== undefined) {
        setSegmentBrightness(segmentId, valueToSend);
        delete pendingBrightnessRef.current[segmentId];
      }
      brightnessTimersRef.current[segmentId] = null;
    }, 1500);
  }, [setSegmentBrightness]);

  /**
   * Toggle link mode
   * @param {boolean} linked - True for linked, false for independent
   * @param {boolean} copySettings - Whether to copy lid settings to vent
   */
  const setLinkModeToggle = useCallback(async (linked, copySettings = false) => {
    console.log('[useLedSegments] setLinkModeToggle called:', { linked, copySettings });
    
    setPendingAction(true);
    setError(null);
    
    try {
      // Optimistically update local state
      const newMode = linked ? 'linked' : 'independent';
      console.log('[useLedSegments] Setting linkMode to:', newMode);
      setLinkMode(newMode);
      
      console.log('[useLedSegments] Calling API setSegmentLinkMode...');
      const result = await dsp.setSegmentLinkMode(linked, copySettings, code);
      console.log('[useLedSegments] API setSegmentLinkMode response:', JSON.stringify(result));
      
      // Wait for hardware to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh to get confirmed state
      await refresh(false);
    } catch (err) {
      const errorMsg = err.message || 'Failed to set link mode';
      console.error('[useLedSegments] Error setting link mode:', err);
      console.error('[useLedSegments] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      setError(errorMsg);
      // Revert on error
      await refresh(false);
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Enable/disable a segment
   * @param {number} segmentId - 1 or 2
   * @param {boolean} enabled - True to enable, false to disable
   */
  const setSegmentEnabledToggle = useCallback(async (segmentId, enabled) => {
    console.log('[useLedSegments] setSegmentEnabledToggle called:', { segmentId, enabled });
    
    setPendingAction(true);
    setError(null);
    
    try {
      // Optimistically update local state
      setSegments(prev => prev.map(seg => 
        seg.id === segmentId 
          ? { ...seg, enabled }
          : seg
      ));
      
      console.log('[useLedSegments] Calling API setSegmentEnabled...');
      const result = await dsp.setSegmentEnabled(segmentId, enabled, code);
      console.log('[useLedSegments] API setSegmentEnabled response:', JSON.stringify(result));
      
      // Wait for hardware to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Refresh to get confirmed state
      await refresh(false);
    } catch (err) {
      const errorMsg = err.message || 'Failed to set segment enabled state';
      console.error('[useLedSegments] Error setting enabled state:', err);
      console.error('[useLedSegments] Error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
      setError(errorMsg);
      // Revert on error
      await refresh(false);
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  // Initial load
  useEffect(() => {
    refresh(true);
  }, [refresh]);

  // Periodic polling to detect state changes (pauses after 3 consecutive failures)
  useEffect(() => {
    if (pollingInterval > 0) {
      pollingTimerRef.current = setInterval(() => {
        if (!pendingAction && consecutiveFailuresRef.current < 3) {
          refresh(false);
        }
      }, pollingInterval);

      return () => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
        }
      };
    }
  }, [pollingInterval, pendingAction, refresh]);

  // Cleanup brightness timers on unmount
  useEffect(() => {
    return () => {
      Object.values(brightnessTimersRef.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  return {
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
    setLinkMode: setLinkModeToggle,
    setSegmentEnabled: setSegmentEnabledToggle,
  };
}

