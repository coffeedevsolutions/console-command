// components/NowSpinningCard.js
// The "Now Spinning" row for the Phono source — a little vinyl record whose center label IS the
// album art, spinning while a track is identified. Sits inside the shared Now Playing Panel in
// Status (label switches to "Now Spinning"). Content-only (no Panel of its own).
import React, { memo, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { color, space, type, font } from '../theme/tokens';

const SIZE = 60;
const SPIN_MS = 3600; // one revolution

function Vinyl({ artworkURL, spinning }) {
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
  const c = SIZE / 2;
  const label = SIZE * 0.42;

  return (
    <Animated.View style={[styles.vinyl, spinStyle]}>
      {/* black disc + concentric grooves */}
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
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
      <View style={styles.holeWrap} pointerEvents="none"><View style={styles.hole} /></View>
    </Animated.View>
  );
}

function NowSpinningCard({ state, track }) {
  const spinning = state === 'spinning' || state === 'listening';
  const title = track?.title;

  let primary, secondary;
  if (state === 'denied') { primary = 'Microphone off'; secondary = 'Enable mic access in Settings'; }
  else if (state === 'listening' && !track) { primary = 'Identifying record…'; secondary = 'Listening'; }
  else if (state === 'dormant') { primary = title || 'Paused'; secondary = 'Tap anywhere to identify'; }
  else { primary = title || '—'; secondary = track?.artist || 'Vinyl'; }

  return (
    <View style={styles.row}>
      <Vinyl artworkURL={track?.artworkURL} spinning={spinning} />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{primary}</Text>
        <Text style={styles.artist} numberOfLines={1}>{secondary}</Text>
      </View>
      <Text style={styles.shazam}>◎ SHAZAM</Text>
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
  shazam: { fontFamily: font.mono, fontSize: 9, letterSpacing: 1, color: color.textLow },
});
