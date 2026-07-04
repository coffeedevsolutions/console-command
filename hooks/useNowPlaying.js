// hooks/useNowPlaying.js
// Reactive wrapper over the baked-in Apple Music native module: current track +
// artwork, live playback state, transport + playlist controls. Does NOT prompt for
// authorization on mount (so it's safe to use for a passive mini-bar); call
// requestAuth() explicitly to prompt.
import { useCallback, useEffect, useRef, useState } from 'react';
import AppleMusic from '../modules/apple-music';

export function useNowPlaying({ pollMs = 500, artworkSize = 600, loadArtwork = true } = {}) {
  const available = AppleMusic.isAvailable;
  const [auth, setAuth] = useState(available ? 'notDetermined' : 'unavailable');
  const [track, setTrack] = useState(null);
  const [artwork, setArtwork] = useState(null);
  const [pb, setPb] = useState(null);

  const artForId = useRef(null);
  const artTimer = useRef(null);
  const timer = useRef(null);

  // Streaming (non-downloaded) artwork loads asynchronously and is often nil right
  // at track start, so retry a few times before giving up.
  const loadArt = useCallback(async (id, attempt) => {
    try {
      const uri = await AppleMusic.getArtwork(artworkSize);
      if (artForId.current !== id) return;      // track moved on
      if (uri) { setArtwork(uri); return; }
    } catch {
      if (artForId.current !== id) return;
    }
    if (artForId.current === id && attempt < 5) {
      artTimer.current = setTimeout(() => loadArt(id, attempt + 1), 1200);
    }
  }, [artworkSize]);

  const refreshTrack = useCallback(async () => {
    if (!available) return;
    const np = AppleMusic.getNowPlaying();
    setTrack(np);
    if (!loadArtwork) return;
    // Only react to an actual track change (avoids blink-outs from transient
    // playback-state events reporting no artwork for the same track).
    const id = np?.persistentID || null;
    if (id === artForId.current) return;
    artForId.current = id;
    if (artTimer.current) clearTimeout(artTimer.current);
    setArtwork(null);              // new track → drop the old album's art
    if (id) loadArt(id, 0);        // then load (with retries) for streaming art
  }, [available, loadArtwork, loadArt]);

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
  useEffect(() => {
    if (available) setAuth(AppleMusic.getAuthorizationStatus());
  }, [available]);

  // Once authorized: initial load + subscribe to live change events.
  useEffect(() => {
    if (!available || auth !== 'authorized') return undefined;
    const subs = [];
    refreshTrack();
    refreshState();
    subs.push(AppleMusic.addNowPlayingListener(() => refreshTrack()));
    subs.push(AppleMusic.addPlaybackStateListener(() => { refreshTrack(); refreshState(); }));
    return () => subs.forEach((s) => s?.remove?.());
  }, [available, auth, refreshTrack, refreshState]);

  // Poll playback position while authorized (events don't tick per-second).
  useEffect(() => {
    if (!available || auth !== 'authorized') return undefined;
    timer.current = setInterval(refreshState, pollMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [available, auth, pollMs, refreshState]);

  useEffect(() => () => { if (artTimer.current) clearTimeout(artTimer.current); }, []);

  const controls = {
    toggle: () => { AppleMusic.togglePlayPause(); setTimeout(refreshState, 120); },
    next: () => { AppleMusic.next(); setTimeout(refreshTrack, 200); },
    previous: () => { AppleMusic.previous(); setTimeout(refreshTrack, 200); },
    seek: (s) => { AppleMusic.seek(s); setTimeout(refreshState, 120); },
    setShuffle: (m) => { AppleMusic.setShuffleMode(m); setTimeout(refreshState, 120); },
    setRepeat: (m) => { AppleMusic.setRepeatMode(m); setTimeout(refreshState, 120); },
    getPlaylists: () => AppleMusic.getPlaylists(),
    playPlaylist: (id) => { AppleMusic.playPlaylist(id); setTimeout(() => { refreshTrack(); refreshState(); }, 350); },
  };

  return { available, auth, track, artwork, pb, controls, requestAuth };
}
