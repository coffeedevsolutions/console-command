// hooks/useNowPlaying.js
// Reactive wrapper over the baked-in Apple Music native module. Handles auth,
// the current track + artwork, live playback state, and exposes controls.
import { useCallback, useEffect, useRef, useState } from 'react';
import AppleMusic from '../modules/apple-music';

export function useNowPlaying({ pollMs = 500, artworkSize = 600 } = {}) {
  const available = AppleMusic.isAvailable;
  const [auth, setAuth] = useState('notDetermined');
  const [track, setTrack] = useState(null);     // NowPlaying | null
  const [artwork, setArtwork] = useState(null); // data URI | null
  const [pb, setPb] = useState(null);           // PlaybackInfo | null

  const artForId = useRef(null);
  const timer = useRef(null);

  const refreshTrack = useCallback(async () => {
    if (!available) return;
    const np = AppleMusic.getNowPlaying();
    setTrack(np);

    // Only touch artwork when the TRACK actually changes. Playback-state events can
    // transiently report no artwork for the current track — reacting to that was
    // what made the art blink out a few seconds in.
    const id = np?.persistentID || null;
    if (id === artForId.current) return;
    artForId.current = id;
    if (!id) { setArtwork(null); return; }
    try {
      const uri = await AppleMusic.getArtwork(artworkSize);
      if (artForId.current === id) setArtwork(uri || null); // ignore if track moved on
    } catch {
      if (artForId.current === id) setArtwork(null);
    }
  }, [available, artworkSize]);

  const refreshState = useCallback(() => {
    if (!available) return;
    setPb(AppleMusic.getPlaybackState());
  }, [available]);

  const requestAuth = useCallback(async () => {
    if (!available) return 'unavailable';
    const status = await AppleMusic.requestAuthorization();
    setAuth(status);
    return status;
  }, [available]);

  // Auth + initial load + live event subscriptions.
  useEffect(() => {
    if (!available) return undefined;
    let subs = [];
    let cancelled = false;
    (async () => {
      const status = await AppleMusic.requestAuthorization();
      if (cancelled) return;
      setAuth(status);
      if (status === 'authorized') {
        await refreshTrack();
        refreshState();
        subs.push(AppleMusic.addNowPlayingListener(() => refreshTrack()));
        subs.push(AppleMusic.addPlaybackStateListener(() => { refreshTrack(); refreshState(); }));
      }
    })();
    return () => {
      cancelled = true;
      subs.forEach((s) => s?.remove?.());
    };
  }, [available, refreshTrack, refreshState]);

  // Poll playback position while authorized (events don't tick per-second).
  useEffect(() => {
    if (!available || auth !== 'authorized') return undefined;
    timer.current = setInterval(refreshState, pollMs);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [available, auth, pollMs, refreshState]);

  const controls = {
    toggle: () => { AppleMusic.togglePlayPause(); setTimeout(refreshState, 120); },
    next: () => { AppleMusic.next(); setTimeout(refreshTrack, 200); },
    previous: () => { AppleMusic.previous(); setTimeout(refreshTrack, 200); },
    seek: (seconds) => { AppleMusic.seek(seconds); setTimeout(refreshState, 120); },
    setShuffle: (mode) => { AppleMusic.setShuffleMode(mode); setTimeout(refreshState, 120); },
    setRepeat: (mode) => { AppleMusic.setRepeatMode(mode); setTimeout(refreshState, 120); },
  };

  return { available, auth, track, artwork, pb, controls, requestAuth };
}
