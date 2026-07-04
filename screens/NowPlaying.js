// screens/NowPlaying.js — full-screen Apple Music "Now Playing", schematic styling.
// Immersive: no close button until you tap the screen; the close (X) then shows for
// 5s and fades. Pure JS on the baked Apple Music module → ships OTA.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import DottedGrid from '../components/ui/DottedGrid';
import { Tick } from '../components/ui/Panel';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { color, border, radius, space, type, font } from '../theme/tokens';

const CHROME_HOLD_MS = 5000;

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function NowPlaying({ navigation }) {
  const { available, auth, track, artwork, pb, controls, requestAuth } = useNowPlaying();

  const [trackW, setTrackW] = useState(0);
  const chrome = useSharedValue(0);
  const [chromeInteractive, setChromeInteractive] = useState(false);
  const hideTimer = useRef(null);

  const reveal = useCallback(() => {
    setChromeInteractive(true);
    chrome.value = withTiming(1, { duration: 200 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      chrome.value = withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) });
      setChromeInteractive(false);
    }, CHROME_HOLD_MS);
  }, [chrome]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  const playing = pb?.state === 'playing';
  const cur = pb?.currentTime || 0;
  const dur = track?.duration || 0;
  const prog = dur > 0 ? Math.min(1, cur / dur) : 0;
  const shuffleOn = pb?.shuffleMode && pb.shuffleMode !== 'off';
  const repeatOn = pb?.repeatMode && pb.repeatMode !== 'none';

  function seekAt(x) {
    if (trackW > 0 && dur > 0) controls.seek((x / trackW) * dur);
    reveal();
  }
  function withReveal(fn) { return () => { fn(); reveal(); }; }

  // Guard states -----------------------------------------------------------
  if (!available || auth === 'denied' || auth === 'restricted') {
    return (
      <Guard
        onClose={() => navigation.goBack()}
        title={!available ? 'MODULE UNAVAILABLE' : 'ACCESS DENIED'}
        body={!available
          ? 'Apple Music control is not present in this build.'
          : 'Enable Media & Apple Music access for Console Command in Settings → Privacy.'}
      />
    );
  }
  if (auth !== 'authorized') {
    return (
      <Guard
        onClose={() => navigation.goBack()}
        title="APPLE MUSIC"
        body="Grant access to show and control what's playing."
        action={{ label: 'GRANT ACCESS', onPress: requestAuth }}
      />
    );
  }

  return (
    <View style={styles.root}>
      <DottedGrid />
      {/* Whole surface taps to reveal the close button; inner controls claim their own taps. */}
      <Pressable style={styles.flex} onPress={reveal}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <Text style={styles.eyebrow}>NOW PLAYING · APPLE MUSIC</Text>

          {/* Artwork */}
          <View style={styles.artWrap}>
            <Tick corner="tl" /><Tick corner="tr" /><Tick corner="bl" /><Tick corner="br" />
            {artwork ? (
              <Image source={{ uri: artwork }} style={styles.art} resizeMode="cover" />
            ) : (
              <View style={[styles.art, styles.artEmpty]}>
                <Text style={styles.artEmptyText}>{track ? 'NO ARTWORK' : 'NO SIGNAL'}</Text>
              </View>
            )}
          </View>

          {/* Metadata */}
          <View style={styles.meta}>
            <Text style={styles.title} numberOfLines={2}>{track?.title || '—'}</Text>
            <Text style={styles.artist} numberOfLines={1}>
              {track?.artist || '—'}{track?.isExplicit ? '  ▪ E' : ''}
            </Text>
            <Text style={styles.album} numberOfLines={1}>{track?.albumTitle || ''}</Text>
          </View>

          {/* Progress (tap to seek) */}
          <View style={styles.progressBlock}>
            <Pressable
              onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
              onPress={(e) => seekAt(e.nativeEvent.locationX)}
              style={styles.track}
              hitSlop={10}
            >
              <View style={[styles.fill, { width: `${prog * 100}%` }]} />
            </Pressable>
            <View style={styles.timeRow}>
              <Text style={styles.time}>{fmt(cur)}</Text>
              <Text style={styles.time}>{fmt(dur)}</Text>
            </View>
          </View>

          {/* Transport */}
          <View style={styles.transport}>
            <Pressable onPress={withReveal(() => controls.setShuffle(shuffleOn ? 'off' : 'songs'))} style={styles.modeBtn}>
              <Text style={[styles.modeText, shuffleOn && styles.modeOn]}>SHUF</Text>
            </Pressable>

            <Pressable onPress={withReveal(controls.previous)} style={styles.skipBtn}>
              <Text style={styles.skipGlyph}>⏮</Text>
            </Pressable>

            <Pressable onPress={withReveal(controls.toggle)} style={styles.playBtn}>
              <Text style={styles.playGlyph}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>

            <Pressable onPress={withReveal(controls.next)} style={styles.skipBtn}>
              <Text style={styles.skipGlyph}>⏭</Text>
            </Pressable>

            <Pressable onPress={withReveal(() => controls.setRepeat(repeatOn ? 'none' : 'all'))} style={styles.modeBtn}>
              <Text style={[styles.modeText, repeatOn && styles.modeOn]}>
                {pb?.repeatMode === 'one' ? 'RPT1' : 'RPT'}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Pressable>

      {/* Close button — hidden until a tap reveals it (auto-fades after 5s) */}
      <Animated.View
        style={[styles.closeWrap, chromeStyle]}
        pointerEvents={chromeInteractive ? 'box-none' : 'none'}
      >
        <SafeAreaView edges={['top', 'right']}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function Guard({ title, body, action, onClose }) {
  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={[styles.safe, styles.guardCenter]}>
        <Text style={styles.eyebrow}>APPLE MUSIC</Text>
        <Text style={styles.guardTitle}>{title}</Text>
        <Text style={styles.guardBody}>{body}</Text>
        <View style={styles.guardBtns}>
          {action && (
            <Pressable onPress={action.onPress} style={[styles.gBtn, styles.gBtnPrimary]}>
              <Text style={styles.gBtnPrimaryText}>{action.label}</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} style={[styles.gBtn, styles.gBtnGhost]}>
            <Text style={styles.gBtnGhostText}>CLOSE</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  eyebrow: { fontFamily: font.mono, fontSize: 11, letterSpacing: 3, color: color.textLow, textAlign: 'center' },

  artWrap: {
    alignSelf: 'center', marginTop: space.xl, aspectRatio: 1, width: '100%', maxWidth: 460,
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken,
  },
  art: { width: '100%', height: '100%' },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  artEmptyText: { fontFamily: font.mono, fontSize: 12, letterSpacing: 3, color: color.textLow },

  meta: { marginTop: space.xl, gap: 4 },
  title: { fontFamily: font.display, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, color: color.textHi },
  artist: { fontFamily: font.mono, fontSize: 13, letterSpacing: 1, color: color.accent },
  album: { fontFamily: font.mono, fontSize: 12, letterSpacing: 1, color: color.textMid },

  progressBlock: { marginTop: space.xl },
  track: { height: 8, borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color.accent },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textMid },

  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xxl, gap: space.sm },
  modeBtn: { paddingVertical: space.sm, paddingHorizontal: space.sm, minWidth: 52, alignItems: 'center' },
  modeText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textLow },
  modeOn: { color: color.accent },
  skipBtn: {
    width: 60, height: 56, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken,
  },
  skipGlyph: { color: color.textHi, fontSize: 20 },
  playBtn: {
    width: 84, height: 64, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.accent, backgroundColor: color.accent,
  },
  playGlyph: { color: color.accentInk, fontSize: 22, fontWeight: '800' },

  closeWrap: { position: 'absolute', top: 0, right: 0, padding: space.md, zIndex: 20 },
  closeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel,
  },
  closeGlyph: { color: color.textHi, fontSize: 24, lineHeight: 26, fontWeight: '700' },

  guardCenter: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  guardTitle: { fontFamily: font.display, fontSize: 22, fontWeight: '800', color: color.textHi, letterSpacing: -0.2 },
  guardBody: { fontFamily: font.mono, fontSize: 12, lineHeight: 18, color: color.textMid, textAlign: 'center', maxWidth: 320 },
  guardBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  gBtn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderWidth: border.thick },
  gBtnPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  gBtnPrimaryText: { fontFamily: font.display, fontWeight: '800', fontSize: 13, color: color.accentInk },
  gBtnGhost: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  gBtnGhostText: { fontFamily: font.display, fontWeight: '800', fontSize: 13, color: color.textMid },
});
