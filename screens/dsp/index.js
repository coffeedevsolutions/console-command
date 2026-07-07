// screens/dsp/index.js — DSP CONSOLE dashboard
// A fresh equalizer-cluster dashboard wired 1:1 to the TPT-SP4BT controls the
// ESP32 firmware exposes (console-esp32/docs/REST_API.md). Schematic × neo-brutalist
// styling from theme/tokens. Only the active tab mounts; controls push on release.
import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DottedGrid from '../../components/ui/DottedGrid';
import { useDspConsole } from '../../hooks/useDspConsole';
import { color, radius, border, space, type } from '../../theme/tokens';
import Levels from './sections/Levels';
import Geq from './sections/Geq';
import Peq from './sections/Peq';
import Channel from './sections/Channel';
import Tools from './sections/Tools';
import Presets from './sections/Presets';

const TABS = [
  { id: 'levels', label: 'LEVELS' },
  { id: 'geq', label: 'GEQ' },
  { id: 'peq', label: 'PEQ' },
  { id: 'chan', label: 'CHANNEL' },
  { id: 'tools', label: 'TOOLS' },
  { id: 'preset', label: 'PRESETS' },
];

const LINK = {
  ready:      { c: color.ok,     t: 'DSP LINKED' },
  syncing:    { c: color.warn,   t: 'SYNCING' },
  connecting: { c: color.warn,   t: 'CONNECTING' },
  scanning:   { c: color.warn,   t: 'SCANNING' },
  backoff:    { c: color.danger, t: 'RETRYING' },
  idle:       { c: color.textLow, t: 'IDLE' },
};

const TabBar = memo(function TabBar({ active, onPick }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabs}>
      {TABS.map((t) => {
        const on = active === t.id;
        return (
          <Pressable key={t.id} onPress={() => onPick(t.id)} style={[styles.tab, on ? styles.tabOn : styles.tabOff]}>
            <Text style={[styles.tabTxt, on && { color: color.accentInk }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
});

export default function DspConsole({ navigation }) {
  const api = useDspConsole();
  const [tab, setTab] = React.useState('levels');
  const st = api.st;
  const disabled = !st;

  const link = useMemo(() => LINK[st?.link?.state] || LINK.idle, [st?.link?.state]);

  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
            <Text style={styles.backGlyph}>‹</Text>
          </Pressable>
          <View style={styles.headMid}>
            <Text style={styles.title}>DSP CONSOLE</Text>
            <Text style={styles.subtitle}>TIMPANO · TPT-SP4BT</Text>
          </View>
          <View style={styles.linkChip}>
            <View style={[styles.led, { backgroundColor: link.c }]} />
            <Text style={[styles.linkTxt, { color: link.c }]}>{link.t}</Text>
          </View>
        </View>

        {st?.link?.batteryV != null && (
          <Text style={styles.batt}>SUPPLY {st.link.batteryV.toFixed(1)}V · CAL(C5)</Text>
        )}

        {/* not-linked banner (controls still edit the ESP32 mirror) */}
        {st && !st.link.connected && (
          <View style={styles.banner}>
            <Text style={styles.bannerTxt}>DSP link {link.t.toLowerCase()} — edits are staged on the bridge and apply when it connects.</Text>
          </View>
        )}

        <TabBar active={tab} onPick={setTab} />

        <ScrollView style={styles.body} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {!st ? (
            <Text style={styles.loading}>Connecting to console…</Text>
          ) : (
            <>
              {tab === 'levels' && <Levels st={st} api={api} disabled={disabled} />}
              {tab === 'geq' && <Geq st={st} api={api} disabled={disabled} />}
              {tab === 'peq' && <Peq st={st} api={api} disabled={disabled} />}
              {tab === 'chan' && <Channel st={st} api={api} disabled={disabled} />}
              {tab === 'tools' && <Tools st={st} api={api} disabled={disabled} />}
              {tab === 'preset' && <Presets st={st} api={api} disabled={disabled} />}
            </>
          )}
          <View style={{ height: space.huge }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md,
  },
  back: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: border.thick, borderColor: color.lineStrong },
  backGlyph: { color: color.textHi, fontSize: 20, lineHeight: 22, fontWeight: '800' },
  headMid: { flex: 1 },
  title: { ...type.title, fontSize: 22, color: color.textHi },
  subtitle: { ...type.meta, color: color.textLow, marginTop: 1 },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: border.hair, borderColor: color.line, paddingVertical: space.xs, paddingHorizontal: space.sm },
  led: { width: 8, height: 8 },
  linkTxt: { ...type.tag, fontSize: 10 },
  batt: { ...type.meta, color: color.textLow, paddingHorizontal: space.lg, marginBottom: space.sm },

  banner: { marginHorizontal: space.lg, marginBottom: space.sm, borderLeftWidth: border.thick, borderColor: color.warn, backgroundColor: color.panel, padding: space.sm },
  bannerTxt: { ...type.meta, color: color.textMid, lineHeight: 15 },

  // flexGrow:0 keeps the horizontal tab strip at its own content height instead of stretching to
  // fill the column's free space (which made it track the selected tab's content height).
  tabBar: { flexGrow: 0, flexShrink: 0 },
  tabs: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.md },
  tab: { height: 40, justifyContent: 'center', paddingHorizontal: space.md, borderWidth: border.thick, borderRadius: radius.none },
  tabOn: { backgroundColor: color.accent, borderColor: color.accent },
  tabOff: { backgroundColor: color.bgSunken, borderColor: color.lineStrong },
  tabTxt: { ...type.tag, fontSize: 11, color: color.textMid },

  body: { flex: 1 },
  scroll: { paddingHorizontal: space.lg, gap: space.md },
  loading: { ...type.meta, color: color.textLow, textAlign: 'center', marginTop: space.huge },
});
