import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clamp } from '../theme';
import { dsp, syncFromArduino } from '../../../api/dspClient';

const STORAGE_KEY = '@grundig1_state';

// Initial state
const createInitialState = () => ({
  global: {
    master: 75,
    presets: { graphicEq: 0, crossover: 0 },
    userPresets: [],
    voltmeter: { live: 12.6, min: 11.8, max: 14.4 },
    passwordLocked: false,
    firmwareVersion: 'v1.2.8',
  },
  sequencer: { s1: true, s2: false, s3: false, intervalMs: 1000 },
  input: {
    graphicEq: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    peq: { freq: 1000, gain: 0, q: 1.0 },
  },
  outputs: {
    ch1: createChannelState(),
    ch2: createChannelState(),
    ch3: createChannelState(),
    ch4: createChannelState(),
  },
  generators: {
    mode: 'sine',
    levelDb: -20,
    sineHz: 1000,
    sweep: { start: 20, end: 20000 },
  },
  _syncStatus: {
    connected: false,
    lastSync: null,
    error: null,
  },
});

function createChannelState() {
  return {
    route: 'A+B',
    xover: {
      hpf: { type: 'BW', slope: 24, freqHz: 80, enabled: false },
      lpf: { type: 'BW', slope: 24, freqHz: 12000, enabled: false },
    },
    peq: { freq: 1000, gain: 0, q: 1.0 },
    delayMs: 0,
    invert: false,
    limiter: {
      on: false,
      thresholdDb: -6,
      attackMs: 5,
      releaseMs: 100,
      autoRelease: false,
      active: false,
    },
    gainDb: 0,
    mute: false,
    enabled: true,
  };
}

// Action types
const actions = {
  SET_MASTER: 'SET_MASTER',
  SET_GRAPHIC_EQ: 'SET_GRAPHIC_EQ',
  SET_GRAPHIC_EQ_BAND: 'SET_GRAPHIC_EQ_BAND',
  SET_INPUT_PEQ: 'SET_INPUT_PEQ',
  SET_CHANNEL_ROUTE: 'SET_CHANNEL_ROUTE',
  SET_CHANNEL_XOVER: 'SET_CHANNEL_XOVER',
  SET_CHANNEL_PEQ: 'SET_CHANNEL_PEQ',
  SET_CHANNEL_DELAY: 'SET_CHANNEL_DELAY',
  SET_CHANNEL_POLARITY: 'SET_CHANNEL_POLARITY',
  SET_CHANNEL_LIMITER: 'SET_CHANNEL_LIMITER',
  SET_CHANNEL_GAIN: 'SET_CHANNEL_GAIN',
  SET_CHANNEL_MUTE: 'SET_CHANNEL_MUTE',
  SET_CHANNEL_ENABLED: 'SET_CHANNEL_ENABLED',
  SET_SEQUENCER: 'SET_SEQUENCER',
  SET_GENERATOR: 'SET_GENERATOR',
  LOAD_PRESET: 'LOAD_PRESET',
  SAVE_USER_PRESET: 'SAVE_USER_PRESET',
  LOAD_USER_PRESET: 'LOAD_USER_PRESET',
  DELETE_USER_PRESET: 'DELETE_USER_PRESET',
  SET_VOLTMETER: 'SET_VOLTMETER',
  SET_PASSWORD_LOCKED: 'SET_PASSWORD_LOCKED',
  RESTORE_STATE: 'RESTORE_STATE',
  SYNC_FROM_ARDUINO: 'SYNC_FROM_ARDUINO',
  SET_SYNC_STATUS: 'SET_SYNC_STATUS',
};

// Reducer
function reducer(state, action) {
  switch (action.type) {
    case actions.SET_MASTER:
      return {
        ...state,
        global: { ...state.global, master: clamp(action.value, 0, 100) },
      };

    case actions.SET_GRAPHIC_EQ:
      return {
        ...state,
        input: {
          ...state.input,
          graphicEq: action.values.map(v => clamp(v, -12, 12)),
        },
      };

    case actions.SET_GRAPHIC_EQ_BAND:
      const newEq = [...state.input.graphicEq];
      newEq[action.band] = clamp(action.value, -12, 12);
      return {
        ...state,
        input: { ...state.input, graphicEq: newEq },
      };

    case actions.SET_INPUT_PEQ:
      return {
        ...state,
        input: {
          ...state.input,
          peq: {
            freq: clamp(action.peq.freq ?? state.input.peq.freq, 20, 20000),
            gain: clamp(action.peq.gain ?? state.input.peq.gain, -12, 12),
            q: clamp(action.peq.q ?? state.input.peq.q, 0.4, 10),
          },
        },
      };

    case actions.SET_CHANNEL_ROUTE:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            route: action.route,
          },
        },
      };

    case actions.SET_CHANNEL_XOVER:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            xover: {
              ...state.outputs[action.channel].xover,
              [action.filter]: {
                ...state.outputs[action.channel].xover[action.filter],
                ...action.values,
              },
            },
          },
        },
      };

    case actions.SET_CHANNEL_PEQ:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            peq: {
              freq: clamp(action.peq.freq ?? state.outputs[action.channel].peq.freq, 20, 20000),
              gain: clamp(action.peq.gain ?? state.outputs[action.channel].peq.gain, -12, 12),
              q: clamp(action.peq.q ?? state.outputs[action.channel].peq.q, 0.4, 10),
            },
          },
        },
      };

    case actions.SET_CHANNEL_DELAY:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            delayMs: clamp(action.value, 0, 8),
          },
        },
      };

    case actions.SET_CHANNEL_POLARITY:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            invert: action.invert,
          },
        },
      };

    case actions.SET_CHANNEL_LIMITER:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            limiter: {
              ...state.outputs[action.channel].limiter,
              ...action.values,
            },
          },
        },
      };

    case actions.SET_CHANNEL_GAIN:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            gainDb: clamp(action.value, -45, 15),
          },
        },
      };

    case actions.SET_CHANNEL_MUTE:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            mute: action.mute,
          },
        },
      };

    case actions.SET_CHANNEL_ENABLED:
      return {
        ...state,
        outputs: {
          ...state.outputs,
          [action.channel]: {
            ...state.outputs[action.channel],
            enabled: action.enabled,
          },
        },
      };

    case actions.SET_SEQUENCER:
      return {
        ...state,
        sequencer: { ...state.sequencer, ...action.values },
      };

    case actions.SET_GENERATOR:
      return {
        ...state,
        generators: { ...state.generators, ...action.values },
      };

    case actions.LOAD_PRESET:
      return applyPreset(state, action.presetType, action.presetIndex);

    case actions.SAVE_USER_PRESET:
      const newUserPresets = [...state.global.userPresets, action.preset];
      return {
        ...state,
        global: { ...state.global, userPresets: newUserPresets },
      };

    case actions.LOAD_USER_PRESET:
      return { ...state, ...action.preset };

    case actions.DELETE_USER_PRESET:
      return {
        ...state,
        global: {
          ...state.global,
          userPresets: state.global.userPresets.filter((_, i) => i !== action.index),
        },
      };

    case actions.SET_VOLTMETER:
      return {
        ...state,
        global: { ...state.global, voltmeter: action.values },
      };

    case actions.SET_PASSWORD_LOCKED:
      return {
        ...state,
        global: { ...state.global, passwordLocked: action.locked },
      };

    case actions.RESTORE_STATE:
      return action.state;

    case actions.SYNC_FROM_ARDUINO:
      // Merge Arduino state, preserving local userPresets
      return {
        ...action.state,
        global: {
          ...action.state.global,
          userPresets: state.global.userPresets,
        },
        _syncStatus: {
          ...state._syncStatus,
          lastSync: Date.now(),
          connected: true,
          error: null,
        },
      };

    case actions.SET_SYNC_STATUS:
      return {
        ...state,
        _syncStatus: { ...state._syncStatus, ...action.status },
      };

    default:
      return state;
  }
}

// Preset data
function applyPreset(state, type, index) {
  if (type === 'graphicEq') {
    const eqPresets = getGraphicEqPresets();
    if (eqPresets[index]) {
      return {
        ...state,
        input: { ...state.input, graphicEq: eqPresets[index].values },
        global: {
          ...state.global,
          presets: { ...state.global.presets, graphicEq: index },
        },
      };
    }
  } else if (type === 'crossover') {
    const xoverPresets = getCrossoverPresets();
    if (xoverPresets[index]) {
      const newOutputs = {};
      Object.keys(state.outputs).forEach(ch => {
        newOutputs[ch] = {
          ...state.outputs[ch],
          xover: xoverPresets[index].xover,
        };
      });
      return {
        ...state,
        outputs: newOutputs,
        global: {
          ...state.global,
          presets: { ...state.global.presets, crossover: index },
        },
      };
    }
  }
  return state;
}

export function getGraphicEqPresets() {
  return [
    { name: 'Flat', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Bass Boost', values: [6, 5, 4, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Treble Boost', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 4, 5, 6, 6] },
    { name: 'V-Shape', values: [5, 4, 3, 1, 0, -1, -2, -2, -1, 0, 1, 3, 4, 5, 6] },
    { name: 'Presence', values: [0, 0, 0, 0, 0, 1, 2, 3, 4, 3, 2, 1, 0, 0, 0] },
    { name: 'Voice', values: [-2, -1, 0, 2, 4, 5, 4, 2, 0, -1, -2, -2, -2, -1, 0] },
    { name: 'Lo-Cut', values: [-6, -5, -3, -2, -1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { name: 'Hi-Cut', values: [0, 0, 0, 0, 0, 0, 0, 0, 0, -1, -2, -3, -5, -6, -8] },
    { name: 'Warmth', values: [3, 2, 1, 0, 0, 0, -1, -1, 0, 0, 1, 2, 2, 2, 1] },
    { name: 'Bright', values: [-1, -1, 0, 0, 0, 1, 2, 3, 3, 3, 3, 3, 2, 2, 1] },
    { name: 'Scoop', values: [2, 1, 0, -1, -2, -3, -3, -3, -2, -1, 0, 1, 2, 2, 2] },
    { name: 'Full Range', values: [2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 3] },
  ];
}

export function getCrossoverPresets() {
  return [
    { name: 'Full Range', xover: { hpf: { type: 'BW', slope: 12, freqHz: 20, enabled: false }, lpf: { type: 'BW', slope: 12, freqHz: 20000, enabled: false } } },
    { name: 'Sub 80Hz', xover: { hpf: { type: 'BW', slope: 24, freqHz: 20, enabled: false }, lpf: { type: 'LR', slope: 24, freqHz: 80, enabled: true } } },
    { name: 'Sub 120Hz', xover: { hpf: { type: 'BW', slope: 24, freqHz: 20, enabled: false }, lpf: { type: 'LR', slope: 24, freqHz: 120, enabled: true } } },
    { name: 'Mid 80-8k', xover: { hpf: { type: 'LR', slope: 24, freqHz: 80, enabled: true }, lpf: { type: 'LR', slope: 24, freqHz: 8000, enabled: true } } },
    { name: 'Mid 120-10k', xover: { hpf: { type: 'LR', slope: 24, freqHz: 120, enabled: true }, lpf: { type: 'LR', slope: 24, freqHz: 10000, enabled: true } } },
    { name: 'High 8kHz+', xover: { hpf: { type: 'LR', slope: 24, freqHz: 8000, enabled: true }, lpf: { type: 'BW', slope: 12, freqHz: 20000, enabled: false } } },
    { name: 'High 10kHz+', xover: { hpf: { type: 'LR', slope: 24, freqHz: 10000, enabled: true }, lpf: { type: 'BW', slope: 12, freqHz: 20000, enabled: false } } },
    { name: '2-Way 2.5k', xover: { hpf: { type: 'LR', slope: 24, freqHz: 2500, enabled: true }, lpf: { type: 'LR', slope: 24, freqHz: 2500, enabled: true } } },
    { name: '2-Way 1.6k', xover: { hpf: { type: 'LR', slope: 24, freqHz: 1600, enabled: true }, lpf: { type: 'LR', slope: 24, freqHz: 1600, enabled: true } } },
    { name: 'Steep HP 80', xover: { hpf: { type: 'LR', slope: 36, freqHz: 80, enabled: true }, lpf: { type: 'BW', slope: 12, freqHz: 20000, enabled: false } } },
    { name: 'Gentle LP 12k', xover: { hpf: { type: 'BW', slope: 12, freqHz: 20, enabled: false }, lpf: { type: 'BW', slope: 12, freqHz: 12000, enabled: true } } },
  ];
}

// Context
const Grundig1Context = createContext();

export function Grundig1Provider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, createInitialState);
  const apiQueueRef = useRef([]);
  const processingRef = useRef(false);
  const isDraggingRef = useRef(false); // Flag to track if any knob is being dragged

  // Auto-save to AsyncStorage
  useEffect(() => {
    const saveState = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn('Failed to save state:', error);
      }
    };
    const timer = setTimeout(saveState, 1000);
    return () => clearTimeout(timer);
  }, [state]);

  // Load state on mount and sync from Arduino
  useEffect(() => {
    const initState = async () => {
      try {
        // Try to sync from Arduino first
        const arduinoState = await syncFromArduino();
        if (arduinoState) {
          dispatch({ type: actions.SYNC_FROM_ARDUINO, state: arduinoState });
          console.log('[Grundig1] Synced from Arduino');
        } else {
          // Fall back to local storage
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            dispatch({ type: actions.RESTORE_STATE, state: JSON.parse(saved) });
          }
        }
      } catch (error) {
        console.warn('Failed to init state:', error);
        // Try local storage as fallback
        try {
          const saved = await AsyncStorage.getItem(STORAGE_KEY);
          if (saved) {
            dispatch({ type: actions.RESTORE_STATE, state: JSON.parse(saved) });
          }
        } catch (e) {
          console.warn('Failed to load local state:', e);
        }
      }
    };
    initState();
  }, []);

  // Periodic sync from Arduino (every 5 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      // Skip sync if user is actively dragging to prevent overwriting values
      if (isDraggingRef.current) {
        return;
      }
      
      try {
        const arduinoState = await syncFromArduino();
        if (arduinoState) {
          dispatch({ type: actions.SYNC_FROM_ARDUINO, state: arduinoState });
        }
      } catch (error) {
        dispatch({
          type: actions.SET_SYNC_STATUS,
          status: { connected: false, error: error.message },
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Arduino API middleware - debounced push to device
  const pushToArduino = useRef(async (action, newState) => {
    try {
      switch (action.type) {
        case actions.SET_MASTER:
          await dsp.setMaster(newState.global.master);
          break;

        case actions.SET_GRAPHIC_EQ:
        case actions.SET_GRAPHIC_EQ_BAND:
          await dsp.setInputGeq(newState.input.graphicEq);
          break;

        case actions.SET_INPUT_PEQ:
          await dsp.setInputPeq({
            f: newState.input.peq.freq,
            g: newState.input.peq.gain,
            q: newState.input.peq.q,
          });
          break;

        case actions.SET_CHANNEL_ROUTE:
        case actions.SET_CHANNEL_XOVER:
        case actions.SET_CHANNEL_PEQ:
        case actions.SET_CHANNEL_DELAY:
        case actions.SET_CHANNEL_POLARITY:
        case actions.SET_CHANNEL_LIMITER:
        case actions.SET_CHANNEL_GAIN:
        case actions.SET_CHANNEL_MUTE:
          const ch = parseInt(action.channel.replace('ch', ''));
          const out = newState.outputs[action.channel];
          await dsp.setOutput(ch, {
            route: out.route,
            hpf: {
              type: out.xover.hpf.type,
              slope: out.xover.hpf.slope,
              freq: out.xover.hpf.freqHz,
              enabled: out.xover.hpf.enabled,
            },
            lpf: {
              type: out.xover.lpf.type,
              slope: out.xover.lpf.slope,
              freq: out.xover.lpf.freqHz,
              enabled: out.xover.lpf.enabled,
            },
            peq: { f: out.peq.freq, g: out.peq.gain, q: out.peq.q },
            delayMs: out.delayMs,
            invert: out.invert,
            limiter: {
              thr: out.limiter.thresholdDb,
              atk: out.limiter.attackMs,
              rel: out.limiter.releaseMs,
              auto: out.limiter.autoRelease,
              en: out.limiter.on,
            },
            gainDb: out.gainDb,
            mute: out.mute,
          });
          break;

        case actions.SET_GENERATOR:
          const gen = newState.generators;
          await dsp.setGenerators({
            sineEn: gen.mode === 'sine',
            sineHz: gen.sineHz,
            sineDb: gen.mode === 'sine' ? gen.levelDb : -60,
            sweepEn: gen.mode === 'sweep',
            sweepStart: gen.sweep.start,
            sweepEnd: gen.sweep.end,
            sweepDb: gen.mode === 'sweep' ? gen.levelDb : -60,
            pinkEn: gen.mode === 'pink',
            pinkDb: gen.mode === 'pink' ? gen.levelDb : -60,
          });
          break;

        case actions.SET_SEQUENCER:
          await dsp.setSequencer(newState.sequencer);
          break;

        case actions.LOAD_PRESET:
          if (action.presetType === 'graphicEq') {
            await dsp.setInputGeq(newState.input.graphicEq, action.presetIndex);
          }
          break;
      }
      
      dispatch({
        type: actions.SET_SYNC_STATUS,
        status: { connected: true, error: null },
      });
    } catch (error) {
      console.warn('[Grundig1] Arduino API error:', error);
      dispatch({
        type: actions.SET_SYNC_STATUS,
        status: { connected: false, error: error.message },
      });
    }
  });

  // Debounced API call queue processor
  useEffect(() => {
    if (processingRef.current || apiQueueRef.current.length === 0) return;

    const processQueue = async () => {
      processingRef.current = true;
      const { action, state: newState } = apiQueueRef.current.pop();
      apiQueueRef.current = []; // Clear queue

      await pushToArduino.current(action, newState);
      processingRef.current = false;
    };

    const timer = setTimeout(processQueue, 300); // 300ms debounce
    return () => clearTimeout(timer);
  }, [state]);

  // Enhanced dispatch that queues API calls
  const enhancedDispatch = (action) => {
    dispatch(action);
    // Queue for Arduino sync (non-local actions)
    if (!action.type.includes('RESTORE') && !action.type.includes('SYNC')) {
      apiQueueRef.current.push({ action, state });
    }
  };

  return (
    <Grundig1Context.Provider value={{ state, dispatch: enhancedDispatch, actions, isDraggingRef }}>
      {children}
    </Grundig1Context.Provider>
  );
}

export function useGrundig1Store() {
  const context = useContext(Grundig1Context);
  if (!context) {
    throw new Error('useGrundig1Store must be used within Grundig1Provider');
  }
  return context;
}

