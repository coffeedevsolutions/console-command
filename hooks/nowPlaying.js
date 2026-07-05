// hooks/nowPlaying.js
// Single shared "Now Playing" source of truth. One auth read, one event subscription, and ONE
// adaptive position timer for the whole app — instead of a separate useNowPlaying instance per
// screen (which meant double subscriptions + two timers when the mini-bar and full screen were
// both alive). State is split across two contexts:
//   • StableCtx  — track, artwork, controls, auth. Changes only on real track/auth changes.
//   • PositionCtx — the playback snapshot (pb). Changes on every position tick.
// so the per-second tick re-renders only the components that read position (progress bar, time,
// transport), never the artwork Image, DottedGrid, or track metadata.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AppleMusic from '../modules/apple-music';

const StableCtx = createContext(null);
const PositionCtx = createContext(null);

export function NowPlayingProvider({ artworkSize = 600, children }) {
  const available = AppleMusic.isAvailable;
  const [auth, setAuth] = useState(available ? 'notDetermined' : 'unavailable');
  const [track, setTrack] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [pb, setPb] = useState(null);

  const authRef = useRef(auth);
  useEffect(() => { authRef.current = auth; }, [auth]);

  const artForId = useRef(null);
  const artTimer = useRef(null);

  // Streaming artwork is often nil right at track start, so retry a few times.
  const loadArt = useCallback(async (id, attempt) => {
    try {
      const uri = await AppleMusic.getArtwork(artworkSize);
      if (artForId.current !== id) return;
      if (uri) { setArtwork(uri); return; }
    } catch {
      if (artForId.current !== id) return;
    }
    if (artForId.current === id && attempt < 5) {
      artTimer.current = setTimeout(() => loadArt(id, attempt + 1), 1200);
    }
  }, [artworkSize]);

  const refreshTrack = useCallback(() => {
    if (!available) return;
    const np = AppleMusic.getNowPlaying();
    setTrack(np);
    const id = np?.persistentID || null;
    if (id === artForId.current) return;      // only react to an actual track change
    artForId.current = id;
    if (artTimer.current) clearTimeout(artTimer.current);
    setArtwork(null);
    if (id) loadArt(id, 0);
  }, [available, loadArt]);

  const refreshState = useCallback(() => {
    if (available) setPb(AppleMusic.getPlaybackState());
  }, [available]);

  const requestAuth = useCallback(async () => {
    if (!available) return 'unavailable';
    const s = await AppleMusic.requestAuthorization();
    setAuth(s);
    return s;
  }, [available]);

  // Read current authorization WITHOUT prompting.
  useEffect(() => { if (available) setAuth(AppleMusic.getAuthorizationStatus()); }, [available]);

  // Subscribe to live change events once. Track + state stay fresh with no polling.
  useEffect(() => {
    if (!available || auth !== 'authorized') return undefined;
    const subs = [];
    refreshTrack();
    refreshState();
    subs.push(AppleMusic.addNowPlayingListener(() => refreshTrack()));
    subs.push(AppleMusic.addPlaybackStateListener(() => { refreshTrack(); refreshState(); }));
    return () => subs.forEach((s) => s?.remove?.());
  }, [available, auth, refreshTrack, refreshState]);

  // Adaptive position poll: consumers request a cadence (in ms) while their screen is focused; the
  // single timer runs at the fastest requested rate, or not at all when nobody is asking.
  const pollReqs = useRef(new Map());
  const pollTimer = useRef(null);
  const idRef = useRef(0);
  const applyPoll = useCallback(() => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    if (!available || authRef.current !== 'authorized') return;
    let min = Infinity;
    pollReqs.current.forEach((ms) => { if (ms < min) min = ms; });
    if (min !== Infinity) {
      refreshState();                          // seed immediately
      pollTimer.current = setInterval(refreshState, min);
    }
  }, [available, refreshState]);

  const requestPositionPoll = useCallback((ms) => {
    const id = ++idRef.current;
    pollReqs.current.set(id, ms);
    applyPoll();
    return () => { pollReqs.current.delete(id); applyPoll(); };
  }, [applyPoll]);

  // (Re)start the timer when auth flips to authorized so a poll requested pre-auth kicks in.
  useEffect(() => { applyPoll(); }, [auth, applyPoll]);

  useEffect(() => () => {
    if (artTimer.current) clearTimeout(artTimer.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  const controls = useMemo(() => ({
    toggle: () => { AppleMusic.togglePlayPause(); setTimeout(refreshState, 120); },
    next: () => { AppleMusic.next(); setTimeout(refreshTrack, 200); },
    previous: () => { AppleMusic.previous(); setTimeout(refreshTrack, 200); },
    seek: (s) => { AppleMusic.seek(s); setTimeout(refreshState, 120); },
    setShuffle: (m) => { AppleMusic.setShuffleMode(m); setTimeout(refreshState, 120); },
    setRepeat: (m) => { AppleMusic.setRepeatMode(m); setTimeout(refreshState, 120); },
    getPlaylists: () => AppleMusic.getPlaylists(),
    playPlaylist: (id) => { AppleMusic.playPlaylist(id); setTimeout(() => { refreshTrack(); refreshState(); }, 350); },
  }), [refreshState, refreshTrack]);

  const stable = useMemo(
    () => ({ available, auth, track, artwork, controls, requestAuth, requestPositionPoll }),
    [available, auth, track, artwork, controls, requestAuth, requestPositionPoll]
  );

  return (
    <StableCtx.Provider value={stable}>
      <PositionCtx.Provider value={pb}>{children}</PositionCtx.Provider>
    </StableCtx.Provider>
  );
}

// Stable slice: track, artwork, controls, auth, and requestPositionPoll. Re-renders only on real
// track/auth changes — safe for artwork + metadata.
export function useNowPlayingStable() {
  const ctx = useContext(StableCtx);
  if (!ctx) throw new Error('useNowPlayingStable must be used within NowPlayingProvider');
  return ctx;
}

// Position slice: the raw playback snapshot (pb) — currentTime/state/shuffleMode/repeatMode.
// Re-renders on every tick, so read it only in small leaf components (progress bar, timestamp).
export function useNowPlayingPosition() {
  return useContext(PositionCtx);
}
