// screens/NowPlaying.js — full-screen Apple Music "Now Playing", schematic styling.
// Immersive: chrome (close + playlists) is hidden until you tap; tapping elsewhere
// hides it again; it also auto-fades after 5s. Responsive portrait/landscape with a
// fluid animated reflow. Pure JS on the baked Apple Music module → ships OTA.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import DottedGrid from '../components/ui/DottedGrid';
import { Tick } from '../components/ui/Panel';
import { PlayIcon, PauseIcon, PrevIcon, NextIcon } from '../components/ui/TransportIcons';
import { useNowPlaying } from '../hooks/useNowPlaying';
import { color, border, space, type, font } from '../theme/tokens';

const CHROME_HOLD_MS = 5000;
const REFLOW = LinearTransition.duration(360).easing(Easing.inOut(Easing.cubic));

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function NowPlaying({ navigation }) {
  const { available, auth, track, artwork, pb, controls, requestAuth } = useNowPlaying();
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const landscape = W > H;

  const artSize = landscape
    ? Math.min(H - insets.top - insets.bottom - 72, 460)
    : Math.min(W - space.xl * 2, 460);

  const [trackW, setTrackW] = useState(0);
  const [chromeInteractive, setChromeInteractive] = useState(false);
  const [playlistsOpen, setPlaylistsOpen] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const chrome = useSharedValue(0);
  const hideTimer = useRef(null);
  const plOpenRef = useRef(false);
  useEffect(() => { plOpenRef.current = playlistsOpen; }, [playlistsOpen]);

  const reveal = useCallback(() => {
    setChromeInteractive(true);
    chrome.value = withTiming(1, { duration: 200 });
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (plOpenRef.current) return; // stay up while browsing playlists
      chrome.value = withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) });
      setChromeInteractive(false);
    }, CHROME_HOLD_MS);
  }, [chrome]);

  const hideChrome = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    chrome.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    setChromeInteractive(false);
    setPlaylistsOpen(false);
  }, [chrome]);

  const toggleChrome = useCallback(() => {
    if (chromeInteractive) hideChrome(); else reveal();
  }, [chromeInteractive, hideChrome, reveal]);

  const togglePlaylists = useCallback(async () => {
    if (playlistsOpen) { setPlaylistsOpen(false); reveal(); return; }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setPlaylistsOpen(true);
    try { setPlaylists((await controls.getPlaylists()) || []); }
    catch { setPlaylists([]); }
  }, [playlistsOpen, reveal, controls]);

  const selectPlaylist = useCallback((id) => {
    controls.playPlaylist(id);
    setPlaylistsOpen(false);
    reveal();
  }, [controls, reveal]);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));

  const playing = pb?.state === 'playing';
  const cur = pb?.currentTime || 0;
  const dur = track?.duration || 0;
  const prog = dur > 0 ? Math.min(1, cur / dur) : 0;
  const shuffleOn = pb?.shuffleMode && pb.shuffleMode !== 'off';
  const repeatOn = pb?.repeatMode && pb.repeatMode !== 'none';

  const seekAt = (x) => { if (trackW > 0 && dur > 0) controls.seek((x / trackW) * dur); reveal(); };
  const withReveal = (fn) => () => { fn(); reveal(); };

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
      <Pressable style={styles.flex} onPress={toggleChrome}>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <Text style={styles.eyebrow}>NOW PLAYING · APPLE MUSIC</Text>

          <Animated.View style={[styles.content, landscape ? styles.contentLandscape : styles.contentPortrait]}>
            <Animated.View layout={REFLOW} style={[styles.artWrap, { width: artSize, height: artSize }]}>
              <Tick corner="tl" offset={-12} size={16} />
              <Tick corner="tr" offset={-12} size={16} />
              <Tick corner="bl" offset={-12} size={16} />
              <Tick corner="br" offset={-12} size={16} />
              {artwork ? (
                <Image source={{ uri: artwork }} style={styles.art} resizeMode="cover" />
              ) : (
                <View style={[styles.art, styles.artEmpty]}>
                  <Text style={styles.artEmptyText}>{track ? 'NO ARTWORK' : 'NO SIGNAL'}</Text>
                </View>
              )}
            </Animated.View>

            <Animated.View layout={REFLOW} style={[styles.rightCol, landscape && styles.rightColLandscape]}>
              <View style={styles.meta}>
                <Text style={styles.title} numberOfLines={2}>{track?.title || '—'}</Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {track?.artist || '—'}{track?.isExplicit ? '  ▪ E' : ''}
                </Text>
                <Text style={styles.album} numberOfLines={1}>{track?.albumTitle || ''}</Text>
              </View>

              <View>
                <Pressable
                  onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
                  onPress={(e) => seekAt(e.nativeEvent.locationX)}
                  style={styles.track}
                  hitSlop={12}
                >
                  <View style={[styles.fill, { width: `${prog * 100}%` }]} />
                </Pressable>
                <View style={styles.timeRow}>
                  <Text style={styles.time}>{fmt(cur)}</Text>
                  <Text style={styles.time}>{fmt(dur)}</Text>
                </View>
              </View>

              <View style={styles.transport}>
                <Pressable onPress={withReveal(() => controls.setShuffle(shuffleOn ? 'off' : 'songs'))} style={styles.modeBtn}>
                  <Text style={[styles.modeText, shuffleOn && styles.modeOn]}>SHUF</Text>
                </Pressable>
                <Pressable onPress={withReveal(controls.previous)} style={styles.skipBtn}>
                  <PrevIcon size={20} color={color.textHi} />
                </Pressable>
                <Pressable onPress={withReveal(controls.toggle)} style={styles.playBtn}>
                  {playing ? <PauseIcon size={22} color={color.accentInk} /> : <PlayIcon size={22} color={color.accentInk} />}
                </Pressable>
                <Pressable onPress={withReveal(controls.next)} style={styles.skipBtn}>
                  <NextIcon size={20} color={color.textHi} />
                </Pressable>
                <Pressable onPress={withReveal(() => controls.setRepeat(repeatOn ? 'none' : 'all'))} style={styles.modeBtn}>
                  <Text style={[styles.modeText, repeatOn && styles.modeOn]}>
                    {pb?.repeatMode === 'one' ? 'RPT1' : 'RPT'}
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </SafeAreaView>
      </Pressable>

      {/* Chrome: close + playlists, hidden until a tap reveals it (auto-fades after 5s) */}
      <Animated.View
        style={[styles.chrome, { paddingTop: insets.top + space.sm, paddingHorizontal: space.md }, chromeStyle]}
        pointerEvents={chromeInteractive ? 'box-none' : 'none'}
      >
        <View style={styles.chromeBar}>
          <Pressable onPress={togglePlaylists} style={styles.plToggle}>
            <Text style={styles.plToggleText}>{playlistsOpen ? 'PLAYLISTS ▲' : 'PLAYLISTS ▾'}</Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        {playlistsOpen && (
          <View style={[styles.plPanel, { maxHeight: H * 0.62 }]}>
            <ScrollView keyboardShouldPersistTaps="handled">
              {playlists.length === 0 ? (
                <Text style={styles.plEmpty}>NO PLAYLISTS FOUND</Text>
              ) : playlists.map((pl) => (
                <Pressable key={pl.id} onPress={() => selectPlaylist(pl.id)} style={styles.plRow}>
                  <Text style={styles.plName} numberOfLines={1}>{pl.name}</Text>
                  <Text style={styles.plCount}>{pl.count}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
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

  content: { flex: 1 },
  contentPortrait: { flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: space.xxl },
  contentLandscape: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xxl },

  artWrap: { borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken },
  art: { width: '100%', height: '100%' },
  artEmpty: { alignItems: 'center', justifyContent: 'center' },
  artEmptyText: { fontFamily: font.mono, fontSize: 12, letterSpacing: 3, color: color.textLow },

  rightCol: { width: '100%', gap: space.xl },
  rightColLandscape: { flex: 1, width: undefined, maxWidth: 520, justifyContent: 'center' },

  meta: { gap: 4 },
  title: { fontFamily: font.display, fontSize: 24, fontWeight: '800', letterSpacing: -0.3, color: color.textHi },
  artist: { fontFamily: font.mono, fontSize: 13, letterSpacing: 1, color: color.accent },
  album: { fontFamily: font.mono, fontSize: 12, letterSpacing: 1, color: color.textMid },

  track: { height: 8, borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken, overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: color.accent },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  time: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textMid },

  transport: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  modeBtn: { paddingVertical: space.sm, minWidth: 52, alignItems: 'center' },
  modeText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textLow },
  modeOn: { color: color.accent },
  skipBtn: {
    width: 60, height: 56, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken,
  },
  playBtn: {
    width: 84, height: 64, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.accent, backgroundColor: color.accent,
  },

  chrome: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  chromeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  plToggle: {
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel,
    paddingVertical: space.sm, paddingHorizontal: space.md,
  },
  plToggleText: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, color: color.textHi },
  closeBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel,
  },
  closeGlyph: { color: color.textHi, fontSize: 24, lineHeight: 26, fontWeight: '700' },

  plPanel: {
    marginTop: space.sm, borderWidth: border.thick, borderColor: color.accent,
    backgroundColor: color.panel,
  },
  plRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: space.md, paddingHorizontal: space.md,
    borderBottomWidth: border.hair, borderBottomColor: color.line,
  },
  plName: { flex: 1, fontFamily: font.display, fontSize: 15, fontWeight: '700', color: color.textHi, marginRight: space.md },
  plCount: { fontFamily: font.mono, fontSize: 12, color: color.textLow },
  plEmpty: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, color: color.textLow, padding: space.lg, textAlign: 'center' },

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
