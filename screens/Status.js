// screens/Status.js — Command Center (main screen the app loads into)
// Aesthetic: hi-fi schematic × neo-brutalism. All styling pulls from theme/tokens.js.
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp } from '../api/dspClient';
import { useConnection } from '../hooks/useConnection';
import { useGrundig1Store } from './grundig1/state/grundig1Store';
import { useLidLight } from '../hooks/useLidLight';
import LidLightCard from '../components/LidLightCard';
import LedSegmentCard from '../components/LedSegmentCard';
import DottedGrid from '../components/ui/DottedGrid';
import Panel, { Tick } from '../components/ui/Panel';
import { color, radius, border, space, type } from '../theme/tokens';

const CONSOLE_IMG = require('../assets/images/grundig-ks-680-wireframe-partial-open.png');

const SOURCES = [
  { key: 'turntable', label: 'PHONO', caption: 'TURNTABLE · VINYL', code: 'IN·1' },
  { key: 'bluetooth', label: 'BLUETOOTH', caption: 'WIRELESS AUDIO', code: 'IN·2' },
];

export default function Status({ navigation }) {
  const conn = useConnection();
  const { state: grundigState, dispatch, actions } = useGrundig1Store();
  const lockCode = grundigState?.global?.lockCode || '';

  const [urlDraft, setUrlDraft] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [optimisticSource, setOptimisticSource] = useState(null);

  const lidLightState = useLidLight({ code: lockCode, pollingInterval: 3000 });

  useEffect(() => { setUrlDraft(conn.baseUrl); }, [conn.baseUrl]);
  useEffect(() => {
    if (optimisticSource && conn.source === optimisticSource) setOptimisticSource(null);
  }, [conn.source, optimisticSource]);

  const activeSource = optimisticSource || conn.source || 'turntable';

  async function switchSource(next) {
    if (switching || next === activeSource) return;
    setSwitching(true);
    setOptimisticSource(next);
    try {
      await dsp.setSource(next, lockCode);
      dispatch({ type: actions.SET_SOURCE, source: next });
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
            <Image source={CONSOLE_IMG} style={styles.console} resizeMode="contain" />
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

          {/* CONNECTION (when disconnected or opened) */}
          {(showSettings || !conn.connected) && (
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
          )}

          {/* SOURCE — primary control */}
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

          {/* LOCK */}
          <Panel label="Lock Code" code="6-DIGIT" contentStyle={styles.stack}>
            <TextInput
              value={lockCode}
              onChangeText={(code) => dispatch({ type: actions.SET_LOCK_CODE, code })}
              keyboardType="numeric"
              maxLength={6}
              secureTextEntry
              placeholder="— — — — — —"
              placeholderTextColor={color.textLow}
              style={[styles.input, styles.inputMono]}
            />
            <Text style={styles.hint}>Only required while the console is locked.</Text>
          </Panel>

          {/* LIGHTING (framed now; internals tokenized later) */}
          <Text style={styles.groupLabel}>◦ LIGHTING</Text>
          <LidLightCard passwordLocked={conn.locked} lockCode={lockCode} />
          <LedSegmentCard passwordLocked={conn.locked} lockCode={lockCode} lidLightState={lidLightState} />

          {/* NAV */}
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

          <View style={{ height: space.huge }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
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
});
