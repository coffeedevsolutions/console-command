// screens/Library.js — browse playlists / songs and search your Apple Music library.
// Selecting something plays it; if the console is on Phono it first switches to
// Bluetooth so the audio routes. Playlists work on the current build; song browse +
// search are gated behind AppleMusic.capabilities (they arrive with the next rebuild).
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp } from '../api/dspClient';
import { useGrundig1Store } from './grundig1/state/grundig1Store';
import AppleMusic, { capabilities } from '../modules/apple-music';
import DottedGrid from '../components/ui/DottedGrid';
import { color, border, space, type, font } from '../theme/tokens';

const TABS = [
  { key: 'playlists', label: 'PLAYLISTS' },
  { key: 'songs', label: 'SONGS' },
  { key: 'search', label: 'SEARCH' },
];

export default function Library({ navigation, route }) {
  const [tab, setTab] = useState(route?.params?.mode === 'search' ? 'search' : 'playlists');
  const { state } = useGrundig1Store();
  const lockCode = state?.global?.lockCode || '';

  const available = AppleMusic.isAvailable;
  const [auth, setAuth] = useState(available ? AppleMusic.getAuthorizationStatus() : 'unavailable');
  const requestAuth = useCallback(async () => setAuth(await AppleMusic.requestAuthorization()), []);

  const [playlists, setPlaylists] = useState(null);
  const [songs, setSongs] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nowKey, setNowKey] = useState(null);

  const canSongs = capabilities.librarySearch; // getAllSongs + searchLibrarySongs present
  const canPlaySong = capabilities.libraryPlay;

  useEffect(() => {
    if (auth !== 'authorized') return;
    if (tab === 'playlists' && playlists === null) {
      AppleMusic.getPlaylists().then(setPlaylists).catch(() => setPlaylists([]));
    }
    if (tab === 'songs' && canSongs && songs === null) {
      setBusy(true);
      AppleMusic.getAllSongs(400).then(setSongs).catch(() => setSongs([])).finally(() => setBusy(false));
    }
  }, [auth, tab, canSongs, playlists, songs]);

  const ensureBluetooth = useCallback(async () => {
    try {
      const s = await dsp.status();
      if (s?.source && s.source !== 'bluetooth') await dsp.setSource('bluetooth', lockCode);
    } catch { /* console unreachable — start playback on the iPad anyway */ }
  }, [lockCode]);

  const playPlaylist = useCallback(async (id) => {
    setNowKey('pl:' + id);
    await ensureBluetooth();
    AppleMusic.playPlaylist(id);
  }, [ensureBluetooth]);

  const playSong = useCallback(async (pid) => {
    if (!canPlaySong) return;
    setNowKey('sg:' + pid);
    await ensureBluetooth();
    AppleMusic.playLibrarySongs([pid]);
  }, [ensureBluetooth, canPlaySong]);

  const doSearch = useCallback(async () => {
    if (!canSongs || !query.trim()) return;
    setBusy(true);
    try { setResults(await AppleMusic.searchLibrarySongs(query.trim(), 60)); }
    catch { setResults([]); }
    finally { setBusy(false); }
  }, [canSongs, query]);

  if (!available || auth === 'denied' || auth === 'restricted') {
    return <Guard onClose={() => navigation.goBack()}
      title={!available ? 'MODULE UNAVAILABLE' : 'ACCESS DENIED'}
      body={!available ? 'Apple Music is not present in this build.'
        : 'Enable Media & Apple Music access in Settings → Privacy.'} />;
  }
  if (auth !== 'authorized') {
    return <Guard onClose={() => navigation.goBack()} title="APPLE MUSIC"
      body="Grant access to browse and play your library."
      action={{ label: 'GRANT ACCESS', onPress: requestAuth }} />;
  }

  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>MUSIC LIBRARY</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}>
              <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          {tab === 'search' && (
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={doSearch}
                returnKeyType="search"
                editable={canSongs}
                placeholder={canSongs ? 'Search your library…' : 'Available after next update'}
                placeholderTextColor={color.textLow}
                style={styles.searchInput}
                autoCorrect={false}
              />
              <Pressable onPress={doSearch} disabled={!canSongs} style={[styles.searchBtn, !canSongs && styles.dim]}>
                <Text style={styles.searchBtnText}>GO</Text>
              </Pressable>
            </View>
          )}

          {busy && <ActivityIndicator color={color.accent} style={{ marginTop: space.lg }} />}

          {tab === 'playlists' && (
            (playlists || []).length === 0 && playlists !== null
              ? <Empty text="NO PLAYLISTS IN YOUR LIBRARY" />
              : (playlists || []).map((pl) => (
                <Row key={pl.id} active={nowKey === 'pl:' + pl.id}
                  primary={pl.name} secondary={`${pl.count} TRACKS`} onPress={() => playPlaylist(pl.id)} />
              ))
          )}

          {tab === 'songs' && (!canSongs
            ? <Locked />
            : (songs || []).map((s) => (
              <Row key={s.persistentID} active={nowKey === 'sg:' + s.persistentID}
                primary={s.title} secondary={s.artist} onPress={() => playSong(s.persistentID)} />
            )))}

          {tab === 'search' && (!canSongs
            ? <Locked />
            : (results || []).map((s) => (
              <Row key={s.persistentID} active={nowKey === 'sg:' + s.persistentID}
                primary={s.title} secondary={s.artist} onPress={() => playSong(s.persistentID)} />
            )))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function Row({ primary, secondary, onPress, active }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowPrimary} numberOfLines={1}>{primary}</Text>
        <Text style={styles.rowSecondary} numberOfLines={1}>{secondary}</Text>
      </View>
      <Text style={[styles.rowPlay, active && styles.rowPlayOn]}>▶</Text>
    </Pressable>
  );
}

function Empty({ text }) { return <Text style={styles.empty}>{text}</Text>; }

function Locked() {
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedTitle}>ARRIVES WITH NEXT UPDATE</Text>
      <Text style={styles.lockedBody}>
        Song browsing & search need the next app rebuild. Playlists work now.
      </Text>
    </View>
  );
}

function Guard({ title, body, action, onClose }) {
  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={[styles.safe, styles.guardCenter]}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.lockedBody}>{body}</Text>
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
  safe: { flex: 1, paddingHorizontal: space.lg },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm, paddingBottom: space.md },
  title: { fontFamily: font.mono, fontSize: 14, letterSpacing: 3, color: color.textHi },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel },
  closeGlyph: { color: color.textHi, fontSize: 24, lineHeight: 26, fontWeight: '700' },

  tabs: { flexDirection: 'row', borderWidth: border.thick, borderColor: color.lineStrong, marginBottom: space.md },
  tab: { flex: 1, paddingVertical: space.md, alignItems: 'center', backgroundColor: color.bgSunken },
  tabOn: { backgroundColor: color.accent },
  tabText: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, color: color.textMid },
  tabTextOn: { color: color.accentInk, fontWeight: '700' },

  list: { paddingBottom: space.xxl },
  searchRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  searchInput: { flex: 1, backgroundColor: color.bgSunken, borderWidth: border.thick, borderColor: color.lineStrong, paddingHorizontal: space.md, paddingVertical: space.md, color: color.textHi, fontFamily: font.mono },
  searchBtn: { paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: color.accent, borderWidth: border.thick, borderColor: color.accent },
  searchBtnText: { fontFamily: font.display, fontWeight: '800', color: color.accentInk },
  dim: { opacity: 0.4 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.md, paddingHorizontal: space.md, borderBottomWidth: border.hair, borderBottomColor: color.line, backgroundColor: color.panel, gap: space.md },
  rowPressed: { backgroundColor: color.panelAlt },
  rowPrimary: { fontFamily: font.display, fontSize: 15, fontWeight: '700', color: color.textHi },
  rowSecondary: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textMid, marginTop: 2 },
  rowPlay: { color: color.textLow, fontSize: 14 },
  rowPlayOn: { color: color.accent },

  empty: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, color: color.textLow, textAlign: 'center', padding: space.xl },
  locked: { borderWidth: border.thick, borderColor: color.lineStrong, borderStyle: 'dashed', padding: space.lg, gap: space.sm, marginTop: space.sm },
  lockedTitle: { fontFamily: font.mono, fontSize: 12, letterSpacing: 2, color: color.accent },
  lockedBody: { fontFamily: font.mono, fontSize: 12, lineHeight: 18, color: color.textMid },

  guardCenter: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  guardBtns: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  gBtn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderWidth: border.thick },
  gBtnPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  gBtnPrimaryText: { fontFamily: font.display, fontWeight: '800', fontSize: 13, color: color.accentInk },
  gBtnGhost: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  gBtnGhostText: { fontFamily: font.display, fontWeight: '800', fontSize: 13, color: color.textMid },
});
