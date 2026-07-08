// screens/Status.js — Command Center (main screen the app loads into)
// Aesthetic: hi-fi schematic × neo-brutalism. All styling pulls from theme/tokens.js.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { dsp } from '../api/dspClient';
import { useConnection } from '../hooks/useConnection';
import { useNowPlayingStable, useNowPlayingPosition } from '../hooks/nowPlaying';
import { useNowSpinning } from '../hooks/useNowSpinning';
import NowSpinningCard from '../components/NowSpinningCard';
import LidLightCard from '../components/LidLightCard';
import DottedGrid from '../components/ui/DottedGrid';
import Panel, { Tick } from '../components/ui/Panel';
import AppIntro from '../components/ui/AppIntro';
import Reveal from '../components/ui/Reveal';
import { color, radius, border, space, type } from '../theme/tokens';

const CONSOLE_IMG = require('../assets/images/grundig-ks-680-wireframe-partial-open.png');

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Leaf that reads the shared position context, so the mini-bar's per-second timestamp re-renders
// on its own without dragging the rest of the command center (DottedGrid, panels, nav) with it.
function MiniBarTime() {
  const pb = useNowPlayingPosition();
  return <Text style={styles.npBarTime}>{fmt(pb?.currentTime)}</Text>;
}

const SOURCES = [
  { key: 'turntable', label: 'PHONO', caption: 'TURNTABLE · VINYL', code: 'IN·1' },
  { key: 'bluetooth', label: 'BLUETOOTH', caption: 'WIRELESS AUDIO', code: 'IN·2' },
];

export default function Status({ navigation }) {
  const conn = useConnection();
  const isFocused = useIsFocused(); // pause the mini-bar position poll while a modal is on top

  const [urlDraft, setUrlDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [optimisticSource, setOptimisticSource] = useState(null);

  // Launch animation: measure the hero wireframe as the fly-to target, then play
  // the splash → reveal sequence once.
  const [target, setTarget] = useState(null);
  const [intro, setIntro] = useState(true);
  const [reveal, setReveal] = useState(false);
  const heroImgRef = useRef(null);

  // Mini-bar reads the shared Now-Playing provider: title/artist from the stable slice (change
  // events keep it fresh). It requests a coarse 1s position poll only while Status is focused, so
  // the timestamp ticks here but pauses when NowPlaying/Library is on top (that screen polls 500ms).
  const { track: npTrack, requestPositionPoll } = useNowPlayingStable();
  useEffect(() => {
    if (!isFocused) return undefined;
    return requestPositionPoll(1000);
  }, [isFocused, requestPositionPoll]);

  useEffect(() => { setUrlDraft(conn.baseUrl); }, [conn.baseUrl]);
  useEffect(() => {
    if (optimisticSource && conn.source === optimisticSource) setOptimisticSource(null);
  }, [conn.source, optimisticSource]);

  const activeSource = optimisticSource || conn.source || 'turntable';

  // Now Spinning (vinyl recognition) — only on Phono, and only once the ShazamKit build lands
  // (spin.supported is false in the current build, so the panel stays plain Apple Music).
  const phono = activeSource === 'turntable';
  const { supported: spinSupported, state: spinState, track: spinTrack, identify: spinIdentify, setEnabled: setSpinEnabled } = useNowSpinning();
  // Now Spinning runs whenever Phono is selected (provider is app-wide + foreground-gated), so it
  // stays live under the full-screen NowSpinning view too.
  useEffect(() => { setSpinEnabled(phono); }, [phono, setSpinEnabled]);
  const showSpinning = phono && spinSupported;

  async function switchSource(next) {
    if (switching || next === activeSource) return;
    setSwitching(true);
    setOptimisticSource(next);
    try {
      // Post directly and read truth back from /api/status via useConnection.
      // NOTE: do NOT dispatch SET_SOURCE to the Grundig store here — its
      // enhancedDispatch queues the action with stale state and would re-POST the
      // *previous* source a moment later, flipping the device back.
      await dsp.setSource(next);
      await conn.reconnectNow();
    } catch (e) {
      setOptimisticSource(null);
      Alert.alert('Source change failed', e?.message || 'Could not reach the console.');
    } finally {
      setSwitching(false);
    }
  }

  async function applyUrl() {
    const clean = (urlDraft || '').trim();
    if (clean) await conn.setBaseUrl(clean);
  }

  const status = useMemo(() => {
    if (conn.connected) return { c: color.ok, label: 'ONLINE' };
    if (conn.checking) return { c: color.warn, label: 'LINKING' };
    return { c: color.danger, label: 'OFFLINE' };
  }, [conn.connected, conn.checking]);

  const addr = (conn.baseUrl || 'console.local').replace(/^https?:\/\//, '');

  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* HERO — console floats on the blueprint, no frame */}
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <Text style={styles.heroModel}>GRUNDIG · KS-680</Text>
              <Text style={styles.heroModel}>REV.A / PARTIAL-OPEN</Text>
            </View>
            <Image
              ref={heroImgRef}
              onLayout={() => heroImgRef.current?.measureInWindow((x, y, w, h) => {
                if (w > 0 && !target) setTarget({ x, y, width: w, height: h });
              })}
              source={CONSOLE_IMG}
              style={styles.console}
              resizeMode="contain"
            />
            <View style={styles.crosshairRow}>
              <View style={styles.hline} />
              <Text style={styles.heroTitle}>COMMAND CENTER</Text>
              <View style={styles.hline} />
            </View>

            {/* status strip */}
            <View style={styles.statusStrip}>
              <View style={styles.statusTag}>
                <View style={[styles.led, { backgroundColor: status.c }]} />
                <Text style={[styles.statusText, { color: status.c }]}>{status.label}</Text>
                {conn.connected && conn.latencyMs != null && (
                  <Text style={styles.statusMeta}>{conn.latencyMs}MS</Text>
                )}
              </View>
              <Text style={styles.addr}>{addr}</Text>
              {conn.locked && <Text style={styles.lockTag}>LOCKED</Text>}
              <Pressable onPress={() => setShowSettings((s) => !s)} hitSlop={12} style={styles.gear}>
                <Text style={styles.gearGlyph}>{showSettings ? '×' : '⚙'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Below-hero content mounts (and cascades up) only once the intro's
              wireframe has settled — see onReveal in AppIntro. */}
          {reveal && (
            <>
          {/* NOW PLAYING — headered panel above input source, part of the cascade */}
          <Reveal index={0}>
            <Pressable onPress={() => navigation.navigate(showSpinning ? 'NowSpinning' : 'NowPlaying')}>
              <Panel
                label={showSpinning ? 'Now Spinning' : 'Now Playing'}
                code={showSpinning ? 'PHONO · SHAZAM' : (npTrack ? 'APPLE MUSIC' : 'TAP TO OPEN')}
                ticks
                contentStyle={styles.npRow}
              >
                {showSpinning ? (
                  <NowSpinningCard state={spinState} track={spinTrack} onIdentify={spinIdentify} />
                ) : (
                  <>
                    <View style={styles.npBarLeft}>
                      <Text style={styles.npBarTitle} numberOfLines={1}>{npTrack?.title || 'Nothing playing'}</Text>
                      <Text style={styles.npBarArtist} numberOfLines={1}>{npTrack?.artist || 'Apple Music'}</Text>
                    </View>
                    {npTrack ? <MiniBarTime /> : null}
                  </>
                )}
              </Panel>
            </Pressable>
          </Reveal>

          {/* MUSIC LIBRARY — browse / search, separate from Now Playing */}
          <Reveal index={1}>
            <Panel label="Music Library" code="APPLE MUSIC">
              <View style={styles.libRow}>
                <Pressable onPress={() => navigation.navigate('Library', { mode: 'browse' })} style={styles.libBtn}>
                  <Text style={styles.libBtnText}>BROWSE</Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Library', { mode: 'search' })} style={styles.libBtn}>
                  <Text style={styles.libBtnText}>SEARCH</Text>
                </Pressable>
              </View>
            </Panel>
          </Reveal>

          {/* CONNECTION (when disconnected or opened) */}
          {(showSettings || !conn.connected) && (
            <Reveal index={1}>
              <Panel label="Link" code="HTTP·80" ticks contentStyle={styles.stack}>
                <TextInput
                  value={urlDraft}
                  onChangeText={setUrlDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="http://console.local"
                  placeholderTextColor={color.textLow}
                  style={styles.input}
                />
                <View style={styles.btnRow}>
                  <Pressable onPress={applyUrl} style={[styles.btn, styles.btnPrimary]}>
                    <Text style={styles.btnPrimaryText}>CONNECT</Text>
                  </Pressable>
                  <Pressable onPress={() => setUrlDraft('http://console.local')} style={[styles.btn, styles.btnGhost]}>
                    <Text style={styles.btnGhostText}>console.local</Text>
                  </Pressable>
                  {!conn.connected && (
                    <Pressable onPress={conn.reconnectNow} style={[styles.btn, styles.btnGhost]}>
                      <Text style={styles.btnGhostText}>RETRY</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.hint}>
                  Assign a fixed DHCP reservation so the console always answers here. iOS will
                  ask to allow Local Network on first connect — tap Allow.
                </Text>
              </Panel>
            </Reveal>
          )}

          {/* SOURCE — primary control */}
          <Reveal index={2}>
            <Panel label="Input Source" code={switching ? 'SWITCHING…' : `ACTIVE·${activeSource === 'turntable' ? 'IN1' : 'IN2'}`} ticks contentStyle={styles.stack}>
              <View style={styles.sourceRow}>
                {SOURCES.map((s) => {
                  const active = activeSource === s.key;
                  const disabled = !conn.connected || switching;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => switchSource(s.key)}
                      disabled={disabled}
                      style={({ pressed }) => [
                        styles.source,
                        active ? styles.sourceOn : styles.sourceOff,
                        disabled && !active && styles.sourceDisabled,
                        pressed && { opacity: 0.9 },
                      ]}
                    >
                      <View style={styles.sourceHead}>
                        <View style={[styles.sBlock, { backgroundColor: active ? color.accentInk : color.lineStrong }]} />
                        <Text style={[styles.sCode, active && { color: color.accentInk }]}>{s.code}</Text>
                      </View>
                      <Text style={[styles.sLabel, active && { color: color.accentInk }]}>{s.label}</Text>
                      <Text style={[styles.sCaption, active && { color: color.accentInk }]}>{s.caption}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {!conn.connected && <Text style={styles.hint}>Connect to switch the source.</Text>}
            </Panel>
          </Reveal>

          {/* LIGHTING */}
          <Reveal index={3}><Text style={styles.groupLabel}>◦ LIGHTING</Text></Reveal>
          <Reveal index={4}>
            <LidLightCard />
          </Reveal>

          {/* DSP CONSOLE — primary entry to the audio dashboard */}
          <Reveal index={5}><Text style={styles.groupLabel}>◦ AUDIO PROCESSOR</Text></Reveal>
          <Reveal index={5}>
            <Pressable onPress={() => navigation.navigate('DspConsole')} style={styles.dspBtn}>
              <View style={styles.dspBtnLeft}>
                <Text style={styles.dspBtnTitle}>DSP CONSOLE</Text>
                <Text style={styles.dspBtnSub}>TIMPANO TPT-SP4BT · EQ · XOVER · LIMITER</Text>
              </View>
              <Text style={styles.dspBtnArrow}>→</Text>
            </Pressable>
          </Reveal>

          {/* NAV */}
          <Reveal index={6}>
            <View style={styles.row}>
              <Pressable onPress={() => navigation.navigate('Controls')} style={[styles.navBtn]}>
                <Text style={styles.navText}>CONTROLS</Text>
                <Text style={styles.navArrow}>→</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate('Grundig1')} style={[styles.navBtn]}>
                <Text style={styles.navText}>GRUNDIG1</Text>
                <Text style={styles.navArrow}>→</Text>
              </Pressable>
            </View>
          </Reveal>
            </>
          )}

          <View style={{ height: space.huge }} />
        </ScrollView>
      </SafeAreaView>

      {/* Launch sequence overlay (splash → fly-to-header → content cascade) */}
      {intro && target && (
        <AppIntro
          targetFrame={target}
          onReveal={() => setReveal(true)}
          onFinish={() => setIntro(false)}
        />
      )}
      {intro && !target && <View style={styles.introCover} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  introCover: { ...StyleSheet.absoluteFillObject, backgroundColor: color.bg, zIndex: 100 },
  safe: { flex: 1 },
  scroll: { padding: space.lg, gap: space.md },

  // hero
  hero: { paddingTop: space.sm, paddingBottom: space.xs, gap: space.sm },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between' },
  heroModel: { ...type.tag, color: color.textLow },
  console: { width: '100%', height: 210 },
  crosshairRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  hline: { flex: 1, height: border.hair, backgroundColor: color.line },
  heroTitle: { ...type.tag, color: color.textHi, fontSize: 13, letterSpacing: 4 },

  statusStrip: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm,
    borderTopWidth: border.hair, borderBottomWidth: border.hair, borderColor: color.line,
    paddingVertical: space.sm,
  },
  statusTag: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  led: { width: 9, height: 9, borderRadius: radius.none },
  statusText: { ...type.tag, fontSize: 12 },
  statusMeta: { ...type.meta, color: color.textLow },
  addr: { ...type.meta, color: color.textMid, marginLeft: 'auto' },
  lockTag: { ...type.tag, color: color.warn, fontSize: 10 },
  gear: { paddingHorizontal: space.xs },
  gearGlyph: { color: color.textMid, fontSize: 18, fontFamily: type.tag.fontFamily },

  // generic
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.sm, rowGap: space.sm },
  stack: { gap: space.md },
  input: {
    backgroundColor: color.bgSunken, borderWidth: border.thick, borderColor: color.lineStrong,
    borderRadius: radius.none, paddingHorizontal: space.md, paddingVertical: space.md,
    color: color.textHi, ...type.body, fontSize: 15,
  },
  inputMono: { fontFamily: type.meta.fontFamily, letterSpacing: 4 },
  hint: { ...type.meta, color: color.textLow, lineHeight: 16, marginTop: space.sm },
  groupLabel: { ...type.tag, color: color.textLow, marginTop: space.sm, marginLeft: space.xs },

  // buttons
  btn: { borderRadius: radius.none, paddingVertical: space.md, paddingHorizontal: space.lg, borderWidth: border.thick },
  btnPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  btnPrimaryText: { ...type.btn, color: color.accentInk, fontSize: 13 },
  btnGhost: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  btnGhostText: { ...type.btn, color: color.textMid, fontSize: 13 },

  // source
  sourceRow: { flexDirection: 'row', gap: space.md },
  source: { flex: 1, borderWidth: border.thick, borderRadius: radius.none, padding: space.md, minHeight: 96, justifyContent: 'space-between' },
  sourceOn: { backgroundColor: color.accent, borderColor: color.accent },
  sourceOff: { backgroundColor: color.bgSunken, borderColor: color.lineStrong },
  sourceDisabled: { opacity: 0.4 },
  sourceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sBlock: { width: 12, height: 12 },
  sCode: { ...type.meta, color: color.textLow },
  sLabel: { ...type.h2, color: color.textHi, marginTop: space.sm },
  sCaption: { ...type.meta, color: color.textMid, marginTop: 2 },

  // nav
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: color.panel, borderWidth: border.hair, borderColor: color.line,
    borderRadius: radius.none, paddingVertical: space.md, paddingHorizontal: space.lg,
  },
  navText: { ...type.tag, color: color.textHi, fontSize: 12 },
  navArrow: { color: color.accent, fontSize: 16, fontWeight: '800' },

  // DSP console primary entry
  dspBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: color.panelAlt, borderWidth: border.thick, borderColor: color.accent,
    borderRadius: radius.none, paddingVertical: space.lg, paddingHorizontal: space.lg,
  },
  dspBtnLeft: { flex: 1, gap: 2 },
  dspBtnTitle: { ...type.h2, color: color.textHi },
  dspBtnSub: { ...type.meta, color: color.accent },
  dspBtnArrow: { color: color.accent, fontSize: 22, fontWeight: '800' },
  npRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  libRow: { flexDirection: 'row', gap: space.sm },
  libBtn: {
    flex: 1, alignItems: 'center', paddingVertical: space.md,
    backgroundColor: color.bgSunken, borderWidth: border.thick, borderColor: color.lineStrong,
  },
  libBtnText: { ...type.tag, color: color.textHi, fontSize: 13 },
  npBarLeft: { flex: 1 },
  npBarTitle: { ...type.h2, fontSize: 15, color: color.textHi },
  npBarArtist: { ...type.meta, color: color.accent, marginTop: 2 },
  npBarTime: { ...type.meta, color: color.textMid },
});
