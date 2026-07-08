// hooks/useNowSpinning.js
// "Now Spinning" — identify the record on the Phono source via the native ShazamKit primitive,
// on a duration-timed cadence with a 2-minute sleep fallback (see NOW_SPINNING_PLAN.md §1).
//
// Fully gated on capabilities.shazam: in the current (pre-rebuild) build SUPPORTED is false, the
// hook parks at 'unsupported', runs no effects, and calls no native methods — the live app is
// untouched. It lights up automatically after the ShazamKit `eas build`.
import { useCallback, useEffect, useRef, useState } from 'react';
import NowSpinning, { capabilities as shazamCaps } from '../modules/now-spinning';
import AppleMusic from '../modules/apple-music';

const SUPPORTED = shazamCaps.shazam;

// Cadence knobs — all OTA-tunable.
const LISTEN_TIMEOUT = 6;         // s: capture window per attempt
const SLEEP_MS = 120_000;         // Mode B re-listen cadence
const LEAD_MS = 8_000;            // start the boundary burst this early
const BURST_MAX = 5;              // attempts around a track boundary
const BURST_SPACING_MS = 6_000;   // gap between burst attempts
const WAKE_DEBOUNCE_MS = 1_000;

// Module-level wake signal so an app-wide touch handler (App.js) can nudge the single hook
// instance (in Status) without prop-drilling. The mounted hook registers its wake here.
export const wakeSignal = { fire: () => {} };

const idOf = (m) => (m ? (m.appleMusicID ?? m.isrc ?? m.title ?? null) : null);

// state: 'unsupported' | 'off' | 'denied' | 'listening' | 'spinning' | 'dormant'
export function useNowSpinning({ active }) {
  const [state, setState] = useState(SUPPORTED ? 'off' : 'unsupported');
  const [track, setTrack] = useState(null);

  const runId = useRef(0);          // bumped on teardown → cancels in-flight async
  const timer = useRef(null);
  const prevId = useRef(null);
  const stateRef = useRef(state);
  const wakeAt = useRef(0);
  const [wakeNonce, setWakeNonce] = useState(0);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!SUPPORTED) { setState('unsupported'); return undefined; }

    const myRun = ++runId.current;
    const alive = () => myRun === runId.current;
    const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
    const schedule = (fn, ms) => { clearTimer(); timer.current = setTimeout(fn, ms); };

    if (!active) { clearTimer(); setState('off'); setTrack(null); prevId.current = null; return () => { runId.current++; }; }

    const listen = async () => {
      try { return await NowSpinning.recognizeOnce(LISTEN_TIMEOUT); } catch { return null; }
    };
    const fetchDuration = async (appleMusicID) => {
      if (!appleMusicID || !AppleMusic.capabilities?.catalogSong) return null;
      try { const s = await AppleMusic.getCatalogSong(appleMusicID); return s?.duration || null; }
      catch { return null; }
    };

    // Mode A — a track is known: wait ~to its end, then burst-retry for the next one.
    const enterModeA = async (match) => {
      if (!alive()) return;
      setTrack(match);
      setState('spinning');
      prevId.current = idOf(match);
      const dur = await fetchDuration(match.appleMusicID);
      if (!alive()) return;
      if (dur && dur > 0) {
        const remainingMs = Math.max(0, (dur - (match.matchOffset || 0)) * 1000);
        schedule(() => runBurst(0), Math.max(BURST_SPACING_MS, remainingMs - LEAD_MS));
      } else {
        schedule(reListen, SLEEP_MS);  // no duration → Mode B cadence, keep the card
      }
    };

    // Boundary burst — up to BURST_MAX tries seeking a DIFFERENT track.
    const runBurst = async (n) => {
      if (!alive()) return;
      const m = await listen();
      if (!alive()) return;
      if (m && idOf(m) && idOf(m) !== prevId.current) { enterModeA(m); return; }
      if (n + 1 < BURST_MAX) { schedule(() => runBurst(n + 1), BURST_SPACING_MS); return; }
      schedule(reListen, SLEEP_MS);    // no new track → fall back to Mode B
    };

    // Mode B tick — quietly re-listen (keep the last card up); no music → sleep.
    const reListen = async () => {
      if (!alive()) return;
      const m = await listen();
      if (!alive()) return;
      if (m) enterModeA(m);
      else setState('dormant');
    };

    // Enter / wake — immediate listen.
    (async () => {
      let perm = NowSpinning.micPermissionStatus();
      if (perm === 'undetermined') perm = await NowSpinning.requestMicPermission();
      if (!alive()) return;
      if (perm !== 'granted') { setState('denied'); return; }
      setState('listening');
      const m = await listen();
      if (!alive()) return;
      if (m) enterModeA(m);
      else setState('dormant');
    })();

    return () => { runId.current++; clearTimer(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, wakeNonce]);

  // Called on any touch (app-wide). Only re-listens when we're asleep; debounced.
  const wake = useCallback(() => {
    if (!SUPPORTED || !active) return;
    if (stateRef.current !== 'dormant') return;
    const now = Date.now();
    if (now - wakeAt.current < WAKE_DEBOUNCE_MS) return;
    wakeAt.current = now;
    setWakeNonce((n) => n + 1);
  }, [active]);

  // Register this instance's wake for the app-wide touch handler.
  useEffect(() => {
    if (!SUPPORTED) return undefined;
    wakeSignal.fire = wake;
    return () => { if (wakeSignal.fire === wake) wakeSignal.fire = () => {}; };
  }, [wake]);

  return { supported: SUPPORTED, state, track, wake };
}
