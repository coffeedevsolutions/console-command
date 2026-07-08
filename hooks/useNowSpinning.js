// hooks/useNowSpinning.js
// "Now Spinning" — identify the record on the Phono source via the native ShazamKit primitive,
// on a duration-timed cadence with a 2-minute sleep fallback (see NOW_SPINNING_PLAN.md §1).
//
// Lifted into a PROVIDER so the state machine keeps running across the Status mini-bar and the
// full-screen NowSpinning view (a modal that would otherwise blur/unmount a screen-local hook).
// Active whenever the console source is Phono (Status calls setEnabled) AND the app is foregrounded
// — not tied to which screen is on top. Fully gated on capabilities.shazam: in a build without the
// native module SUPPORTED is false, the machine parks at 'unsupported', runs no effects, and calls
// no native methods.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
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

// Module-level wake signal so an app-wide touch handler (App.js) can nudge the provider without
// prop-drilling. The mounted provider registers its wake here.
export const wakeSignal = { fire: () => {} };

const idOf = (m) => (m ? (m.appleMusicID ?? m.isrc ?? m.title ?? null) : null);

const Ctx = createContext(null);

export function NowSpinningProvider({ children }) {
  const [enabled, setEnabled] = useState(false);   // source === Phono (set by Status)
  const [appActive, setAppActive] = useState(true);
  // state: 'unsupported' | 'off' | 'denied' | 'listening' | 'spinning' | 'dormant'
  const [state, setState] = useState(SUPPORTED ? 'off' : 'unsupported');
  const [track, setTrack] = useState(null);

  const runId = useRef(0);          // bumped on teardown → cancels in-flight async
  const timer = useRef(null);
  const prevId = useRef(null);
  const stateRef = useRef(state);
  const wakeAt = useRef(0);
  const musicKitAuthed = useRef(false);
  const [wakeNonce, setWakeNonce] = useState(0);

  const active = SUPPORTED && enabled && appActive;

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

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
    const fetchSong = async (appleMusicID) => {
      if (!appleMusicID || !AppleMusic.capabilities?.catalogSong) return null;
      try {
        // MusicKit catalog needs its own authorization before resource requests resolve.
        if (!musicKitAuthed.current && typeof AppleMusic.requestMusicKitAuthorization === 'function') {
          await AppleMusic.requestMusicKitAuthorization().catch(() => {});
          musicKitAuthed.current = true;
        }
        return await AppleMusic.getCatalogSong(appleMusicID);
      } catch { return null; }
    };

    // Mode A — a track is known: stamp the match time (for the "how far in" readout), enrich it
    // with album/duration/hi-res art from MusicKit, then wait ~to its end and burst for the next.
    const enterModeA = async (match) => {
      if (!alive()) return;
      const matchAt = Date.now();
      setTrack({ ...match, matchAt });
      setState('spinning');
      prevId.current = idOf(match);
      const song = await fetchSong(match.appleMusicID);
      if (!alive()) return;
      if (song) {
        setTrack((prev) => (prev && prev.matchAt === matchAt ? {
          ...prev,
          albumTitle: song.albumTitle || prev.albumTitle,
          duration: song.duration || prev.duration,
          artworkURL: song.artworkURL || prev.artworkURL,   // hi-res catalog art
        } : prev));
      }
      const dur = song?.duration || null;
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

  // Force an immediate re-listen (used by the "identify again" tap). Works from any state.
  const identify = useCallback(() => {
    if (!SUPPORTED || !active) return;
    const now = Date.now();
    if (now - wakeAt.current < WAKE_DEBOUNCE_MS) return;
    wakeAt.current = now;
    setWakeNonce((n) => n + 1);
  }, [active]);

  // Called on any touch (app-wide). Only re-listens when we're asleep; debounced.
  const wake = useCallback(() => {
    if (stateRef.current !== 'dormant') return;
    identify();
  }, [identify]);

  useEffect(() => {
    if (!SUPPORTED) return undefined;
    wakeSignal.fire = wake;
    return () => { if (wakeSignal.fire === wake) wakeSignal.fire = () => {}; };
  }, [wake]);

  const value = { supported: SUPPORTED, state, track, wake, identify, setEnabled };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const INERT = { supported: false, state: 'unsupported', track: null, wake: () => {}, identify: () => {}, setEnabled: () => {} };

export function useNowSpinning() {
  return useContext(Ctx) || INERT;
}
