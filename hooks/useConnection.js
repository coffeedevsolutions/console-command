// hooks/useConnection.js
// Keeps a live connection to the console: auto-connects on launch using the saved
// base URL (defaults to http://console.local), keeps polling /api/status so the
// "connected" state and current source stay accurate, re-checks when the app returns
// to the foreground, and recovers on its own when the device comes back.
import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { dsp } from '../api/dspClient';

export function useConnection({ pollWhenConnected = 4000, pollWhenDisconnected = 2500 } = {}) {
  const [baseUrl, setBaseUrlState] = useState('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState(null);   // last /api/status payload
  const [latencyMs, setLatencyMs] = useState(null);
  const [checking, setChecking] = useState(false);

  const timer = useRef(null);
  const mounted = useRef(true);

  const check = useCallback(async () => {
    setChecking(true);
    const t0 = Date.now();
    try {
      const s = await dsp.status();            // GET /api/status (3s timeout)
      if (!mounted.current) return true;
      setStatus(s);
      setLatencyMs(Date.now() - t0);
      setConnected(true);
      return true;
    } catch (e) {
      if (!mounted.current) return false;
      setConnected(false);
      setStatus(null);
      setLatencyMs(null);
      return false;
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, []);

  const schedule = useCallback((ok) => {
    if (timer.current) clearTimeout(timer.current);
    const delay = ok ? pollWhenConnected : pollWhenDisconnected;
    timer.current = setTimeout(async () => {
      const r = await check();
      schedule(r);
    }, delay);
  }, [check, pollWhenConnected, pollWhenDisconnected]);

  const reconnectNow = useCallback(async () => {
    const r = await check();
    schedule(r);
    return r;
  }, [check, schedule]);

  // Point at a new URL/IP and immediately try it.
  const setBaseUrl = useCallback(async (url) => {
    await dsp.setBaseUrl(url);
    setBaseUrlState(await dsp.getBaseUrl());
    return reconnectNow();
  }, [reconnectNow]);

  useEffect(() => {
    mounted.current = true;
    (async () => {
      const u = await dsp.getBaseUrl();
      if (mounted.current) setBaseUrlState(u);
      const r = await check();
      schedule(r);
    })();

    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') reconnectNow();
    });

    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    baseUrl,
    connected,
    status,
    source: status?.source || null,   // 'turntable' | 'bluetooth'
    locked: !!status?.locked,
    latencyMs,
    checking,
    reconnectNow,
    setBaseUrl,
    check,
  };
}
