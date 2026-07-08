// screens/NowSpinning.js — full-screen "Now Spinning" for the Phono source.
// Immersive like the Now Playing screen: chrome (close + refresh) is hidden until you tap, then
// auto-fades. Landscape puts the track info to the right of the spinning disk; portrait stacks it
// below. Shows album + a "how far into the track" readout derived from ShazamKit's match offset
// (offset at match time + wall-clock since) against the MusicKit duration. Reads the shared
// NowSpinningProvider so it stays live while open.
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import DottedGrid from '../components/ui/DottedGrid';
import { Vinyl } from '../components/NowSpinningCard';
import { useNowSpinning } from '../hooks/useNowSpinning';
import { color, border, space, font } from '../theme/tokens';

const CHROME_HOLD_MS = 5000;

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Live "how far in" bar — offset at match + seconds since, capped at duration. Isolated + memoized
// so its 1s tick doesn't re-render the spinning disk.
const Progress = memo(function Progress({ matchOffset, matchAt, duration }) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    if (!duration || !matchAt) return undefined;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [duration, matchAt]);
  if (!duration || !matchAt) return null;
  const elapsed = Math.min(duration, (matchOffset || 0) + (nowMs - matchAt) / 1000);
  const prog = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  return (
    <View style={styles.progWrap}>
      <View style={styles.track}><View style={[styles.fill, { width: `${prog * 100}%` }]} /></View>
      <View style={styles.timeRow}>
        <Text style={styles.time}>{fmt(elapsed)}</Text>
        <Text style={styles.time}>{fmt(duration)}</Text>
      </View>
    </View>
  );
});

export default function NowSpinning({ navigation }) {
  const { state, track, identify, supported } = useNowSpinning();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = W > H;
  const size = landscape ? Math.min(H * 0.66, W * 0.44) : Math.min(W - space.xl * 2, H * 0.48);
  const spinning = state === 'spinning' || state === 'listening';
  const busy = state === 'listening';

  let title, sub;
  if (!supported) { title = 'Not available'; sub = 'This build has no ShazamKit'; }
  else if (state === 'denied') { title = 'Microphone off'; sub = 'Enable mic access in Settings → Privacy'; }
  else if (state === 'listening' && !track) { title = 'Identifying record…'; sub = 'Listening'; }
  else if (state === 'dormant') { title = track?.title || 'Paused'; sub = track?.artist || 'Tap ↻ to identify'; }
  else { title = track?.title || '—'; sub = track?.artist || 'Vinyl'; }
  const album = track?.albumTitle || null;
  const talign = { textAlign: landscape ? 'left' : 'center' };

  // Immersive chrome — hidden until a tap; auto-fades after 5s (mirrors the Now Playing screen).
  const chrome = useSharedValue(0);
  const [interactive, setInteractive] = useState(false);
  const hideTimer = useRef(null);
  const reveal = useCallback(() => {
    setInteractive(true);
    chrome.value = withTiming(1, { duration: 200 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      chrome.value = withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) });
      setInteractive(false);
    }, CHROME_HOLD_MS);
  }, [chrome]);
  const hide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    chrome.value = withTiming(0, { duration: 250, easing: Easing.in(Easing.quad) });
    setInteractive(false);
  }, [chrome]);
  const toggle = useCallback(() => { if (interactive) hide(); else reveal(); }, [interactive, hide, reveal]);
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);
  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  return (
    <View style={styles.root}>
      <DottedGrid />
      {/* Tap anywhere reveals/hides the chrome — it does NOT refresh. */}
      <Pressable style={styles.flex} onPress={toggle}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <Text style={styles.eyebrow}>NOW SPINNING · PHONO</Text>

          <View style={[styles.content, landscape ? styles.contentRow : styles.contentCol]}>
            <Vinyl artworkURL={track?.artworkURL} spinning={spinning} size={size} />
            <View style={landscape ? styles.infoRight : styles.infoCenter}>
              <Text style={[styles.title, talign]} numberOfLines={2}>{title}</Text>
              <Text style={[styles.artist, talign]} numberOfLines={1}>{sub}</Text>
              {album ? <Text style={[styles.album, talign]} numberOfLines={1}>{album}</Text> : null}
              <Progress matchOffset={track?.matchOffset} matchAt={track?.matchAt} duration={track?.duration} />
              <Text style={[styles.shazam, talign]}>◎ POWERED BY SHAZAM</Text>
            </View>
          </View>
        </SafeAreaView>
      </Pressable>

      {/* Chrome: refresh (identify) + close — hidden until a tap. */}
      <Animated.View
        style={[styles.chrome, { paddingTop: insets.top + space.sm, paddingHorizontal: space.md }, chromeStyle]}
        pointerEvents={interactive ? 'box-none' : 'none'}
      >
        <View style={styles.chromeBar}>
          <Pressable onPress={() => { identify(); reveal(); }} disabled={busy || !supported}
            style={[styles.chromeBtn, (busy || !supported) && styles.chromeBtnBusy]} hitSlop={12}>
            <Text style={styles.chromeGlyph}>↻</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.chromeBtn} hitSlop={12}>
            <Text style={styles.chromeGlyph}>×</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: space.lg },
  eyebrow: { fontFamily: font.mono, fontSize: 11, letterSpacing: 3, color: color.textLow, paddingTop: space.sm },

  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  contentCol: { flexDirection: 'column', gap: space.xl },
  contentRow: { flexDirection: 'row', gap: space.xl },
  infoCenter: { width: '100%', maxWidth: 460, alignItems: 'center', gap: space.sm },
  infoRight: { flex: 1, alignItems: 'flex-start', gap: space.sm },

  title: { fontFamily: font.display, fontSize: 24, fontWeight: '800', color: color.textHi },
  artist: { fontFamily: font.mono, fontSize: 13, letterSpacing: 1, color: color.textMid },
  album: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textLow },

  progWrap: { width: '100%', marginTop: space.sm, gap: space.xs },
  track: { height: 8, borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color.accent },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: color.textMid },

  shazam: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: color.textLow, marginTop: space.xs },

  chrome: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  chromeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chromeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel },
  chromeBtnBusy: { opacity: 0.4 },
  chromeGlyph: { color: color.textHi, fontSize: 22, lineHeight: 24, fontWeight: '700' },
});
