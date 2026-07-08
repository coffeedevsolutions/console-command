// components/NowSpinningCard.js
// The "Now Spinning" row for the Phono source — a little vinyl record whose center label IS the
// album art, spinning while a track is identified. Sits inside the shared Now Playing Panel in
// Status (label switches to "Now Spinning"). Content-only (no Panel of its own).
import React, { memo, useEffect } from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color, border, space, type, font } from '../theme/tokens';

const SIZE = 60;
const SPIN_MS = 3600; // one revolution

// Spinning vinyl whose center label is the album art. Size-parameterized so the same visual
// serves the tiny mini-bar and the big full-screen view.
export function Vinyl({ artworkURL, spinning, size = SIZE }) {
  const rot = useSharedValue(0);
  useEffect(() => {
    if (spinning) {
      rot.value = 0;
      rot.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1, false);
    } else {
      cancelAnimation(rot);
    }
    return () => cancelAnimation(rot);
  }, [spinning, rot]);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const c = size / 2;
  const label = size * 0.42;
  const hole = Math.max(3, size * 0.05);

  return (
    <Animated.View style={[styles.vinyl, { width: size, height: size }, spinStyle]}>
      {/* black disc + concentric grooves */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={c} cy={c} r={c - 1} fill="#0c0c0e" stroke={color.lineStrong} strokeWidth={1} />
        <Circle cx={c} cy={c} r={c * 0.82} stroke="rgba(255,255,255,0.07)" strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={c * 0.64} stroke="rgba(255,255,255,0.06)" strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={c * 0.5} stroke="rgba(255,255,255,0.05)" strokeWidth={1} fill="none" />
      </Svg>
      {/* center label = album art (or accent when unknown) */}
      {artworkURL ? (
        <Image source={{ uri: artworkURL }} style={[styles.label, { width: label, height: label, borderRadius: label / 2 }]} />
      ) : (
        <View style={[styles.label, styles.labelBlank, { width: label, height: label, borderRadius: label / 2 }]} />
      )}
      {/* spindle hole */}
      <View style={styles.holeWrap} pointerEvents="none">
        <View style={[styles.hole, { width: hole, height: hole, borderRadius: hole / 2 }]} />
      </View>
    </Animated.View>
  );
}

function NowSpinningCard({ state, track, onIdentify }) {
  const spinning = state === 'spinning' || state === 'listening';
  const busy = state === 'listening';
  const title = track?.title;

  let primary, secondary;
  if (state === 'denied') { primary = 'Microphone off'; secondary = 'Enable mic access in Settings'; }
  else if (state === 'listening' && !track) { primary = 'Identifying record…'; secondary = 'Listening'; }
  else if (state === 'dormant') { primary = title || 'Paused'; secondary = 'Tap ↻ to identify'; }
  else { primary = title || '—'; secondary = track?.artist || 'Vinyl'; }

  return (
    <View style={styles.row}>
      <Vinyl artworkURL={track?.artworkURL} spinning={spinning} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{primary}</Text>
        <Text style={styles.artist} numberOfLines={1}>{secondary}</Text>
      </View>
      <View style={styles.right}>
        {state !== 'denied' && state !== 'unsupported' && (
          <Pressable onPress={onIdentify} disabled={busy} hitSlop={10}
            style={[styles.relisten, busy && styles.relistenBusy]}>
            <Text style={styles.relistenGlyph}>↻</Text>
          </Pressable>
        )}
        <Text style={styles.shazam}>◎ SHAZAM</Text>
      </View>
    </View>
  );
}

export default memo(NowSpinningCard);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  vinyl: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  label: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.35)' },
  labelBlank: { backgroundColor: color.accent },
  holeWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hole: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.bg },

  info: { flex: 1 },
  title: { fontFamily: font.display, fontSize: 15, fontWeight: '700', color: color.textHi },
  artist: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textMid, marginTop: 2 },
  right: { alignItems: 'center', gap: 4 },
  relisten: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken,
  },
  relistenBusy: { opacity: 0.4 },
  relistenGlyph: { color: color.accent, fontSize: 18, lineHeight: 20, fontWeight: '700' },
  shazam: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1, color: color.textLow },
});
