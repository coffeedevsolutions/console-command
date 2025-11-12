// src/api/dspClient.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@dsp.baseUrl';
// Put your ESP32's LAN IP here as the initial default (STA mode), e.g. http://192.168.1.42
let baseUrl = 'http://192.168.1.42';

export async function setBaseUrl(url) {
  // normalize: strip trailing slash
  const clean = url.replace(/\/+$/, '');
  baseUrl = clean;
  await AsyncStorage.setItem(KEY, clean);
}

export async function getBaseUrl() {
  const saved = await AsyncStorage.getItem(KEY);
  if (saved) baseUrl = saved;
  return baseUrl;
}

async function request(path, { method = 'GET', body, timeout = 5000, headers } = {}) {
  const url = `${baseUrl}${path}`;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeout);

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(headers || {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: ctrl.signal,
  }).finally(() => clearTimeout(id));

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

function toWs(url) {
  return url.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
}

export const dsp = {
  // config
  setBaseUrl,
  getBaseUrl,

  // basic endpoints
  async status() {
    return request('/api/status', { timeout: 3000 });
  },
  
  // Get full device state (for Grundig1 console)
  async getState() {
    return request('/api/state', { timeout: 5000 });
  },
  
  async setVolume(v) {
    return request('/api/volume', { method: 'POST', body: { volume: v } });
  },
  
  async ping() {
    try { await request('/api/status', { timeout: 1500 }); return true; }
    catch { return false; }
  },

  // === Grundig1 Console API ===
  
  // Master level (0-100%)
  async setMaster(levelPct) {
    return request('/api/master', { method: 'POST', body: { levelPct } });
  },

  // Input Graphic EQ
  async setInputGeq(bands, preset) {
    const body = { bands }; // array of 15 values (-12 to +12 dB)
    if (preset !== undefined) body.preset = preset;
    return request('/api/input/geq', { method: 'POST', body });
  },

  // Input Parametric EQ
  async setInputPeq(peq) {
    // peq: { f: freq, g: gain, q: Q }
    return request('/api/input/peq', { method: 'POST', body: peq });
  },

  // Output channel settings (ch: 1-4)
  async setOutput(ch, settings) {
    // settings can include: route, hpf, lpf, peq, delayMs, invert, limiter, gainDb, mute
    return request('/api/output', { method: 'POST', body: { ch, ...settings } });
  },

  // Generators
  async setGenerators(gen) {
    // gen: { sineEn, sineHz, sineDb, sweepEn, sweepStart, sweepEnd, sweepDb, pinkEn, pinkDb }
    return request('/api/gen', { method: 'POST', body: gen });
  },

  // Sequencer
  async setSequencer(seq) {
    // seq: { s1, s2, s3, intervalMs }
    return request('/api/seq', { method: 'POST', body: seq });
  },

  // Battery/Voltmeter update
  async updateBattery(voltage) {
    return request('/api/battery', { method: 'POST', body: { v: voltage } });
  },

  // Lock/Unlock
  async setLock(options) {
    // options: { setCode: 6-digit, lock: true/false, unlock: code }
    return request('/api/lock', { method: 'POST', body: options });
  },

  // Preset management
  async savePreset(slot, name = 'Preset') {
    return request('/api/preset/save', { method: 'POST', body: { slot, name } });
  },

  async loadPreset(slot) {
    return request('/api/preset/load', { method: 'POST', body: { slot } });
  },

  async copyPreset(from, to) {
    return request('/api/preset/copy', { method: 'POST', body: { from, to } });
  },

  // optional realtime updates if your firmware exposes ws://<ip>/ws
  connectWs(onMessage) {
    try {
      const wsUrl = `${toWs(baseUrl)}/ws`;
      const ws = new WebSocket(wsUrl);
      ws.onmessage = (ev) => {
        try { onMessage(JSON.parse(ev.data)); } catch { /* ignore bad JSON */ }
      };
      return ws; // caller should ws.close() on unmount
    } catch {
      return null;
    }
  },
};

export async function command(action, args = {}) {
  return request('/api/command', { method: 'POST', body: { action, args } });
}

// === State Converters ===

/**
 * Convert Arduino state format to Grundig1 store format
 */
export function arduinoToGrundig1State(arduinoState) {
  if (!arduinoState) return null;

  const state = {
    global: {
      master: Math.round((arduinoState.master || 0) * 100),
      presets: {
        graphicEq: arduinoState.input?.geqPreset || 0,
        crossover: arduinoState.xoPreset || 0,
      },
      userPresets: [], // managed locally
      voltmeter: {
        live: arduinoState.battery?.v || 12.6,
        min: arduinoState.battery?.min || 11.8,
        max: arduinoState.battery?.max || 14.4,
      },
      passwordLocked: arduinoState.locked || false,
      firmwareVersion: 'v1.0.0',
    },
    sequencer: {
      s1: arduinoState.seq?.s1 || false,
      s2: arduinoState.seq?.s2 || false,
      s3: arduinoState.seq?.s3 || false,
      intervalMs: arduinoState.seq?.intervalMs || 1000,
    },
    input: {
      graphicEq: arduinoState.input?.geq || Array(15).fill(0),
      peq: {
        freq: arduinoState.input?.peq?.f || 1000,
        gain: arduinoState.input?.peq?.g || 0,
        q: arduinoState.input?.peq?.q || 1.0,
      },
    },
    outputs: {},
    generators: {
      mode: arduinoState.gen?.sineEn ? 'sine' : 
            arduinoState.gen?.sweepEn ? 'sweep' :
            arduinoState.gen?.pinkEn ? 'pink' : 'sine',
      levelDb: arduinoState.gen?.sineEn ? arduinoState.gen.sineDb :
               arduinoState.gen?.sweepEn ? arduinoState.gen.sweepDb :
               arduinoState.gen?.pinkEn ? arduinoState.gen.pinkDb : -20,
      sineHz: arduinoState.gen?.sineHz || 1000,
      sweep: {
        start: arduinoState.gen?.sweepStart || 20,
        end: arduinoState.gen?.sweepEnd || 20000,
      },
    },
  };

  // Convert output channels
  if (arduinoState.outputs && Array.isArray(arduinoState.outputs)) {
    arduinoState.outputs.forEach((out, idx) => {
      const chKey = `ch${idx + 1}`;
      state.outputs[chKey] = {
        route: out.route || 'A',
        xover: {
          hpf: {
            type: out.hpf?.type || 'BW',
            slope: out.hpf?.slope || 24,
            freqHz: out.hpf?.freq || 80,
            enabled: out.hpf?.enabled || false,
          },
          lpf: {
            type: out.lpf?.type || 'BW',
            slope: out.lpf?.slope || 24,
            freqHz: out.lpf?.freq || 12000,
            enabled: out.lpf?.enabled || false,
          },
        },
        peq: {
          freq: out.peq?.f || 1000,
          gain: out.peq?.g || 0,
          q: out.peq?.q || 1.0,
        },
        delayMs: out.delayMs || 0,
        invert: out.invert || false,
        limiter: {
          on: out.limiter?.en || false,
          thresholdDb: out.limiter?.thr || -6,
          attackMs: out.limiter?.atk || 5,
          releaseMs: out.limiter?.rel || 100,
          autoRelease: out.limiter?.auto || false,
          active: out.limiter?.act || false,
        },
        gainDb: out.gainDb || 0,
        mute: out.mute || false,
        enabled: true, // Arduino doesn't track this separately
      };
    });
  }

  // Fill in any missing channels
  for (let i = 1; i <= 4; i++) {
    const chKey = `ch${i}`;
    if (!state.outputs[chKey]) {
      state.outputs[chKey] = {
        route: 'A',
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
  }

  return state;
}

/**
 * Helper to sync Grundig1 store with Arduino device
 * Call this periodically or on mount to fetch latest state
 */
export async function syncFromArduino() {
  try {
    const arduinoState = await dsp.getState();
    return arduinoToGrundig1State(arduinoState);
  } catch (error) {
    console.warn('Failed to sync from Arduino:', error);
    return null;
  }
}