// hooks/useLidLight.js
import { useState, useCallback, useEffect, useRef } from 'react';
import { dsp } from '../api/dspClient';

/**
 * Custom hook for managing lid light state and API interactions
 * Optimized to only poll lid status frequently, and fetch full state on transitions
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.code - Optional 6-digit unlock code
 * @param {number} options.pollingInterval - Polling interval in ms (default: 3000)
 * @returns {Object} Hook state and methods
 * - lidOpen: Whether the lid is currently open
 * - brightness: Current brightness (0% if lid closed, cached value if open)
 * - color: Current RGB color object
 * - loading: Initial loading state
 * - error: Error message if any
 * - pendingAction: True when an action is in progress
 * - isOn: Derived state - true if brightness > 0
 * - refresh: Function to fetch current status
 * - setPower: Function to toggle power on/off
 * - setBrightness: Function to set brightness level
 * - setPreset: Function to set color preset
 * - setRgb: Function to set custom RGB color
 */
export function useLidLight({ code, pollingInterval = 3000 } = {}) {
  // Separate state for lid status and cached values
  const [lidOpen, setLidOpen] = useState(false);
  const [cachedBrightness, setCachedBrightness] = useState(0);
  const [cachedColor, setCachedColor] = useState({ r: 0, g: 0, b: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingAction, setPendingAction] = useState(false);
  
  const pollingTimerRef = useRef(null);
  const previousLidState = useRef(false);

  // Derived values - brightness is 0 if lid closed, otherwise use cached value
  const brightness = lidOpen ? cachedBrightness : 0;
  const isOn = brightness > 0;
  const color = cachedColor;

  /**
   * Fetch current lid light status from server
   * Only updates cached values on lid transitions or explicit refresh
   * @param {boolean} forceFullUpdate - Force update of all cached values
   * @param {boolean} showLoading - Whether to show loading indicator (false for background polling)
   */
  const refresh = useCallback(async (forceFullUpdate = false, showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await dsp.getLidLightStatus(code);
      
      // Always update lid state
      const newLidOpen = result.lidOpen;
      const hadTransition = !previousLidState.current && newLidOpen; // closed → open
      
      setLidOpen(newLidOpen);
      
      // Update cached values only on:
      // 1. Lid transition from closed to open
      // 2. First load (previousLidState is false initially)
      // 3. Explicit full update requested
      if (hadTransition || forceFullUpdate || previousLidState.current === null) {
        setCachedBrightness(result.brightness || 0);
        setCachedColor(result.color || { r: 0, g: 0, b: 0 });
        
        // If lid just opened, wait for server's fade to complete then fetch final value
        if (hadTransition) {
          setTimeout(async () => {
            try {
              const finalResult = await dsp.getLidLightStatus(code);
              setCachedBrightness(finalResult.brightness || 0);
              setCachedColor(finalResult.color || { r: 0, g: 0, b: 0 });
            } catch (err) {
              // Ignore errors on the follow-up fetch
              console.warn('Failed to fetch final brightness:', err);
            }
          }, 800); // Wait 800ms (server's 300ms fade + network latency + processing buffer)
        }
      }
      
      previousLidState.current = newLidOpen;
    } catch (err) {
      setError(err.message || 'Failed to fetch lid light status');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [code]);

  /**
   * Set lid light power on/off
   * @param {boolean} on - True to turn on, false to turn off
   */
  const setPower = useCallback(async (on) => {
    setPendingAction(true);
    setError(null);
    try {
      await dsp.setLidLightPower(on, code);
      
      // Wait longer for server's fade to fully complete
      // Server fade is 300ms + network latency + processing time
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Force full refresh to get final state after fade
      await refresh(true);
    } catch (err) {
      setError(err.message || 'Failed to set power');
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Set lid light brightness
   * @param {number} brightness - Brightness level (0-100)
   */
  const setBrightness = useCallback(async (brightness) => {
    setPendingAction(true);
    setError(null);
    try {
      // Optimistically update cached brightness
      setCachedBrightness(brightness);
      
      await dsp.setLidLightBrightness(brightness, code);
      
      // Server handles smooth transition, no need to refresh immediately
      // Polling will pick up the final value
    } catch (err) {
      setError(err.message || 'Failed to set brightness');
      // Revert on error - force refresh to get actual value
      await refresh(true);
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Set lid light color using preset
   * @param {string} preset - Preset name (WARM, COOL, WHITE, RED, GREEN, BLUE, PURPLE, ORANGE)
   */
  const setPreset = useCallback(async (preset) => {
    setPendingAction(true);
    setError(null);
    try {
      await dsp.setLidLightColorPreset(preset, code);
      
      // Wait longer for server's fade to fully complete
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Force full refresh to get final color after fade
      await refresh(true);
    } catch (err) {
      setError(err.message || 'Failed to set color preset');
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  /**
   * Set lid light color using custom RGB values
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   */
  const setRgb = useCallback(async (r, g, b) => {
    // Validate and clamp RGB values
    const clampedR = Math.max(0, Math.min(255, Math.round(r)));
    const clampedG = Math.max(0, Math.min(255, Math.round(g)));
    const clampedB = Math.max(0, Math.min(255, Math.round(b)));

    setPendingAction(true);
    setError(null);
    try {
      // Optimistically update cached color
      setCachedColor({ r: clampedR, g: clampedG, b: clampedB });
      
      await dsp.setLidLightColorRgb(clampedR, clampedG, clampedB, code);
    } catch (err) {
      setError(err.message || 'Failed to set RGB color');
      // Revert on error - force refresh to get actual value
      await refresh(true);
    } finally {
      setPendingAction(false);
    }
  }, [code, refresh]);

  // Periodic polling to detect lid state changes
  // Only polls lid status, not full state (efficient)
  useEffect(() => {
    if (pollingInterval > 0) {
      pollingTimerRef.current = setInterval(() => {
        // Poll if not currently performing an action
        if (!pendingAction) {
          refresh(false, false); // Don't force full update, don't show loading spinner
        }
      }, pollingInterval);

      return () => {
        if (pollingTimerRef.current) {
          clearInterval(pollingTimerRef.current);
        }
      };
    }
  }, [pollingInterval, pendingAction, refresh]);

  return {
    lidOpen,
    brightness,
    color,
    loading,
    error,
    pendingAction,
    isOn,
    refresh,
    setPower,
    setBrightness,
    setPreset,
    setRgb,
  };
}

