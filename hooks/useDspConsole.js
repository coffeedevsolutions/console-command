// hooks/useDspConsole.js
// State layer for the DSP dashboard. Mirrors the ESP32's /api/state (the source
// of truth, which itself mirrors the DSP), polls it only while the dashboard is
// focused, and exposes optimistic + logged setters that each POST one minimal
// block. Writes update the local mirror immediately so controls feel instant;
// the next poll reconciles with device truth.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { dsp } from '../api/dspClient';
import { dlog, dpoll } from '../api/dspDebug';
import { GEQ_CUSTOM_PRESET } from '../api/dspUnits';

const EMPTY_OUT = {
  ch: 0, gainDb: 0, mute: false, polarity: 0, route: 0, delay: 0,
  xo: { hpfHz: 10, hpfType: 0, lpfHz: 22000, lpfType: 0, preset: 0 },
  limiter: { thresholdDb: 0, attack: 10, release: 100, auto: true },
};

function normalize(s) {
  if (!s) return null;
  const outputs = Array.from({ length: 4 }, (_, i) => {
    const o = (s.outputs || []).find((x) => x.ch === i + 1) || {};
    return {
      ...EMPTY_OUT, ...o, ch: i + 1,
      xo: { ...EMPTY_OUT.xo, ...(o.xo || {}) },
      limiter: { ...EMPTY_OUT.limiter, ...(o.limiter || {}) },
    };
  });
  const peq = Array.from({ length: 5 }, (_, i) => {
    const p = (s.peq || []).find((x) => x.band === i) || {};
    return { band: i, channel: p.channel ?? 0, freqHz: p.freqHz ?? 1000, gainDb: p.gainDb ?? 0, q: p.q ?? 1.0 };
  });
  return {
    // use the ramp target so the master control shows the set value, not the
    // mid-ramp reading the firmware reports while easing toward it.
    master: s.masterTarget ?? s.master ?? 0,
    source: s.source ?? 'turntable',
    link: {
      connected: !!s.dsp?.connected,
      state: s.dsp?.state ?? 'idle',
      batteryV: s.dsp?.batteryV ?? null,
    },
    geq: { preset: s.geq?.preset ?? GEQ_CUSTOM_PRESET, bands: (s.geq?.bands || Array(15).fill(0)).slice(0, 15) },
    peq,
    outputs,
    gen: {
      tone: { on: false, freqHz: 1000, gain: 0, ...(s.gen?.tone || {}) },
      sweep: { on: false, startHz: 20, endHz: 20000, gain: 0, speed: 1, ...(s.gen?.sweep || {}) },
      pink: { on: false, gain: 0, ...(s.gen?.pink || {}) },
    },
  };
}

export function useDspConsole({ pollMs = 2000 } = {}) {
  const isFocused = useIsFocused();
  const [st, setSt] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const dragging = useRef(false);          // suppress poll-merge while a slider is held
  const lastJson = useRef('');             // skip setState when nothing changed
  const timer = useRef(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const raw = await dsp.getState();
      if (!mounted.current || dragging.current) return;
      const next = normalize(raw);
      const j = JSON.stringify(next);
      dpoll('state', { link: next?.link, master: next?.master });
      if (j !== lastJson.current) {
        lastJson.current = j;
        setSt(next);
        dlog('⚑', 'mirror updated from device');
      }
      setLoaded(true);
    } catch (e) {
      // connection layer surfaces offline; keep last-known controls on screen
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (!isFocused) return undefined;
    refresh();
    timer.current = setInterval(refresh, pollMs);
    return () => { mounted.current = false; if (timer.current) clearInterval(timer.current); };
  }, [isFocused, pollMs, refresh]);

  // ---- optimistic local mutation helper ----
  const patch = useCallback((fn) => {
    setSt((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      lastJson.current = JSON.stringify(next);
      return next;
    });
  }, []);

  const setDragging = useCallback((v) => { dragging.current = v; }, []);

  // ---- setters (optimistic + logged POST) ----
  const setMaster = useCallback((pct) => {
    patch((p) => ({ ...p, master: pct }));
    dsp.dspMaster(pct).catch(() => {});
  }, [patch]);

  const setGeqBand = useCallback((i, db) => {
    let bands;
    patch((p) => {
      bands = p.geq.bands.slice(); bands[i] = db;
      return { ...p, geq: { preset: GEQ_CUSTOM_PRESET, bands } };
    });
    dsp.dspGeq(bands, GEQ_CUSTOM_PRESET).catch(() => {});
  }, [patch]);

  const setGeqPreset = useCallback((preset) => {
    let bands;
    patch((p) => { bands = p.geq.bands; return { ...p, geq: { ...p.geq, preset } }; });
    dsp.dspGeq(bands, preset).catch(() => {});
  }, [patch]);

  const resetGeq = useCallback(() => {
    const bands = Array(15).fill(0);
    patch((p) => ({ ...p, geq: { preset: GEQ_CUSTOM_PRESET, bands } }));
    dsp.dspGeq(bands, GEQ_CUSTOM_PRESET).catch(() => {});
  }, [patch]);

  // out patch: { gainDb?, mute?, polarity?, route?, delay?, xo:{..}?, limiter:{..}? }
  const setOutput = useCallback((i, body) => {
    patch((p) => {
      const outputs = p.outputs.map((o, idx) => {
        if (idx !== i) return o;
        const n = { ...o, ...body };
        if (body.xo) n.xo = { ...o.xo, ...body.xo };
        if (body.limiter) n.limiter = { ...o.limiter, ...body.limiter };
        return n;
      });
      return { ...p, outputs };
    });
    dsp.dspOutput(i + 1, body).catch(() => {});
  }, [patch]);

  const setPeq = useCallback((band, body) => {
    patch((p) => ({ ...p, peq: p.peq.map((b, idx) => (idx === band ? { ...b, ...body } : b)) }));
    dsp.dspPeq(band, body).catch(() => {});
  }, [patch]);

  // gen kind: 'tone' | 'sweep' | 'pink'; body = partial of that generator
  const setGen = useCallback((kind, body) => {
    patch((p) => ({ ...p, gen: { ...p.gen, [kind]: { ...p.gen[kind], ...body } } }));
    dsp.dspGen({ [kind]: body }).catch(() => {});
  }, [patch]);

  const syncFromDevice = useCallback(async () => {
    dlog('→', 'manual sync-from-DSP');
    await dsp.dspSyncFromDevice().catch(() => {});
    setTimeout(refresh, 1200);           // give the ESP32 time to read the blocks back
  }, [refresh]);

  const applyToDevice = useCallback(async () => {
    dlog('→', 'manual force-push mirror to DSP');
    await dsp.dspApplyToDevice().catch(() => {});
  }, []);

  return {
    st, loaded,
    setDragging,
    setMaster, setGeqBand, setGeqPreset, resetGeq,
    setOutput, setPeq, setGen,
    syncFromDevice, applyToDevice, refresh,
  };
}
