// screens/Library.js — one-page music browser: live search at top, a LIBRARY/APPLE
// MUSIC source selector (Apple Music unlocks after the MusicKit rebuild), and
// PLAYLISTS/SONGS browse. Selecting anything plays it and, if the console is on
// Phono, switches it to Bluetooth first. Capability-gated so it never calls a native
// method that isn't in the running build.
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dsp } from '../api/dspClient';
import AppleMusic, { capabilities } from '../modules/apple-music';
import DottedGrid from '../components/ui/DottedGrid';
import { color, border, space, type, font } from '../theme/tokens';

// Fixed row height lets FlatList use getItemLayout (O(1) scroll-to-index for the
// alphabet scrubber + no per-row measurement pass) and keeps the list virtualized cheaply.
const ROW_HEIGHT = 60;

export default function Library({ navigation, route }) {
  const available = AppleMusic.isAvailable;
  const [auth, setAuth] = useState(available ? AppleMusic.getAuthorizationStatus() : 'unavailable');
  const requestAuth = useCallback(async () => setAuth(await AppleMusic.requestAuthorization()), []);

  const catOK = capabilities.catalogSearch;   // Apple Music catalog (post-rebuild)
  const libSearchOK = capabilities.librarySearch; // getAllSongs + searchLibrarySongs
  const libPlayOK = capabilities.libraryPlay;

  const [source, setSource] = useState('library'); // 'library' | 'catalog'
  const [view, setView] = useState('playlists');   // 'playlists' | 'songs'
  const [query, setQuery] = useState('');
  const [playlists, setPlaylists] = useState(null);
  const [songs, setSongs] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [nowKey, setNowKey] = useState(null);

  const src = catOK ? source : 'library'; // locked to library until catalog is built
  const searching = query.trim().length > 0;

  // Browse loaders (library)
  useEffect(() => {
    if (auth !== 'authorized' || searching || src !== 'library') return;
    if (view === 'playlists' && playlists === null) {
      AppleMusic.getPlaylists()
        .then((list) => setPlaylists(sortByField(list, 'name')))
        .catch(() => setPlaylists([]));
    }
    if (view === 'songs' && libSearchOK && songs === null) {
      setBusy(true);
      AppleMusic.getAllSongs(300)
        .then((list) => setSongs(sortByField(list, 'title')))
        .catch(() => setSongs([]))
        .finally(() => setBusy(false));
    }
  }, [auth, searching, src, view, libSearchOK, playlists, songs]);

  // Live search (debounced) against the selected source
  useEffect(() => {
    if (auth !== 'authorized' || !searching) { setResults(null); return undefined; }
    const can = src === 'library' ? libSearchOK : catOK;
    if (!can) { setResults('locked'); return undefined; }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        if (src === 'library') setResults(await AppleMusic.searchLibrarySongs(query.trim(), 60));
        else setResults((await AppleMusic.searchCatalog(query.trim(), 25)).songs || []);
      } catch { setResults([]); } finally { setBusy(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query, src, auth, searching, libSearchOK, catOK]);

  const ensureBluetooth = useCallback(async () => {
    try {
      const s = await dsp.status();
      if (s?.source && s.source !== 'bluetooth') await dsp.setSource('bluetooth');
    } catch { /* console unreachable — start playback on the iPad anyway */ }
  }, []);

  const playSong = useCallback(async (item) => {
    if (item.persistentID) {
      if (!libPlayOK) return;
      setNowKey('sg:' + item.persistentID);
      await ensureBluetooth();
      AppleMusic.playLibrarySongs([item.persistentID]);
    } else if (item.id) {
      setNowKey('cs:' + item.id);
      await ensureBluetooth();
      AppleMusic.playStoreIDs([item.id]);
    }
  }, [ensureBluetooth, libPlayOK]);

  const playPlaylist = useCallback(async (id) => {
    setNowKey('pl:' + id);
    await ensureBluetooth();
    AppleMusic.playPlaylist(id);
  }, [ensureBluetooth]);

  // Alphabet scrubber: build a { letter -> first row index } map over the sorted browse
  // list. Null while searching or when the list is too short to be worth scrubbing.
  const flatListRef = useRef(null);
  const scrubData = searching ? null : (view === 'playlists' ? playlists : (libSearchOK ? songs : null));
  const scrubField = view === 'playlists' ? 'name' : 'title';
  const scrubIndex = useMemo(() => {
    if (!scrubData || scrubData.length < 2) return null;
    const map = {};
    const letters = [];
    for (let i = 0; i < scrubData.length; i++) {
      const raw = (scrubData[i][scrubField] || '').trim();
      const ch = raw ? raw[0].toUpperCase() : '#';
      const L = ch >= 'A' && ch <= 'Z' ? ch : '#';
      if (!(L in map)) { map[L] = i; letters.push(L); }
    }
    return { map, letters };
  }, [scrubData, scrubField]);

  const scrubTo = useCallback((letter) => {
    const idx = scrubIndex?.map[letter];
    if (idx != null) flatListRef.current?.scrollToIndex({ index: idx, animated: false });
  }, [scrubIndex]);

  if (!available || auth === 'denied' || auth === 'restricted') {
    return <Guard onClose={() => navigation.goBack()}
      title={!available ? 'MODULE UNAVAILABLE' : 'ACCESS DENIED'}
      body={!available ? 'Apple Music is not present in this build.'
        : 'Enable Media & Apple Music access in Settings → Privacy.'} />;
  }
  if (auth !== 'authorized') {
    return <Guard onClose={() => navigation.goBack()} title="APPLE MUSIC"
      body="Grant access to browse and play your music."
      action={{ label: 'GRANT ACCESS', onPress: requestAuth }} />;
  }

  // Decide the current list
  let cur;
  if (searching) {
    const can = src === 'library' ? libSearchOK : catOK;
    cur = !can ? { locked: true } : { kind: 'song', data: Array.isArray(results) ? results : [] };
  } else if (view === 'playlists') {
    cur = { kind: 'playlist', data: playlists || [] };
  } else {
    cur = !libSearchOK ? { locked: true } : { kind: 'song', data: songs || [] };
  }

  // Stable primitive/callback props so the memoized Row only re-renders when its own
  // fields change (e.g. its active flag), not on every parent poll/state tick.
  const renderItem = ({ item }) => {
    const isPl = cur.kind === 'playlist';
    const key = isPl ? 'pl:' + item.id : (item.persistentID ? 'sg:' + item.persistentID : 'cs:' + item.id);
    return (
      <Row
        primary={isPl ? item.name : item.title}
        secondary={isPl ? `${item.count} TRACKS` : item.artist}
        active={nowKey === key}
        onPress={isPl ? playPlaylist : playSong}
        arg={isPl ? item.id : item}
      />
    );
  };

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

        {/* Search (live) */}
        <TextInput
          value={query}
          onChangeText={setQuery}
          autoFocus={route?.params?.mode === 'search'}
          autoCorrect={false}
          returnKeyType="search"
          placeholder={src === 'library' ? 'Search your library…' : 'Search Apple Music…'}
          placeholderTextColor={color.textLow}
          style={styles.search}
        />

        {/* Source selector */}
        <View style={styles.seg}>
          <SegBtn label="LIBRARY" on={src === 'library'} onPress={() => setSource('library')} />
          <SegBtn label={catOK ? 'APPLE MUSIC' : 'APPLE MUSIC · SOON'} on={src === 'catalog'}
            disabled={!catOK} onPress={() => catOK && setSource('catalog')} />
        </View>

        {/* Browse selector (hidden while searching) */}
        {!searching && (
          <View style={styles.seg}>
            <SegBtn label="PLAYLISTS" on={view === 'playlists'} onPress={() => setView('playlists')} />
            <SegBtn label="SONGS" on={view === 'songs'} onPress={() => setView('songs')} />
          </View>
        )}

        {cur.locked ? (
          <Locked />
        ) : (
          <View style={styles.listWrap}>
            <FlatList
              ref={flatListRef}
              data={cur.data}
              renderItem={renderItem}
              keyExtractor={(item, i) => item.id || item.persistentID || String(i)}
              style={styles.flex}
              getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
              onScrollToIndexFailed={() => {}}
              extraData={nowKey}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={busy
                ? <ActivityIndicator color={color.accent} style={{ marginTop: space.xl }} />
                : <Empty text={searching ? 'NO RESULTS' : 'NOTHING HERE'} />}
            />
            {scrubIndex && <ScrubBar letters={scrubIndex.letters} onScrub={scrubTo} />}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// Case-insensitive alphabetical sort by a field, non-mutating.
function sortByField(list, field) {
  return Array.isArray(list)
    ? [...list].sort((a, b) => (a?.[field] || '').localeCompare(b?.[field] || '', undefined, { sensitivity: 'base' }))
    : [];
}

// Vertical A–Z index down the right edge. Touch-tracks the finger (no per-frame network —
// only fires scrollTo when the letter under the finger changes).
function ScrubBar({ letters, onScrub }) {
  const heightRef = useRef(0);
  const lastRef = useRef(null);
  const pick = useCallback((locationY) => {
    const h = heightRef.current;
    if (h <= 0) return;
    const rel = Math.min(0.999, Math.max(0, locationY / h));
    const L = letters[Math.floor(rel * letters.length)];
    if (L && L !== lastRef.current) { lastRef.current = L; onScrub(L); }
  }, [letters, onScrub]);
  return (
    <View
      style={styles.scrubBar}
      onLayout={(e) => { heightRef.current = e.nativeEvent.layout.height; }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => pick(e.nativeEvent.locationY)}
      onResponderMove={(e) => pick(e.nativeEvent.locationY)}
      onResponderRelease={() => { lastRef.current = null; }}
      onResponderTerminate={() => { lastRef.current = null; }}
    >
      {letters.map((L) => (
        <Text key={L} style={styles.scrubLetter} allowFontScaling={false}>{L}</Text>
      ))}
    </View>
  );
}

function SegBtn({ label, on, disabled, onPress }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.segBtn, on && styles.segOn, disabled && styles.segDim]}>
      <Text style={[styles.segText, on && styles.segTextOn]}>{label}</Text>
    </Pressable>
  );
}

const Row = memo(function Row({ primary, secondary, onPress, arg, active }) {
  return (
    <Pressable onPress={() => onPress(arg)} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.flex}>
        <Text style={styles.rowPrimary} numberOfLines={1}>{primary}</Text>
        <Text style={styles.rowSecondary} numberOfLines={1}>{secondary}</Text>
      </View>
      <Text style={[styles.rowPlay, active && styles.rowPlayOn]}>▶</Text>
    </Pressable>
  );
});

function Empty({ text }) { return <Text style={styles.empty}>{text}</Text>; }

function Locked() {
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedTitle}>ARRIVES WITH NEXT UPDATE</Text>
      <Text style={styles.lockedBody}>
        Song browsing, search, and Apple Music need the next app rebuild. Playlists work now.
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

  search: { backgroundColor: color.bgSunken, borderWidth: border.thick, borderColor: color.lineStrong, paddingHorizontal: space.md, paddingVertical: space.md, color: color.textHi, fontFamily: font.mono, marginBottom: space.sm },

  seg: { flexDirection: 'row', borderWidth: border.thick, borderColor: color.lineStrong, marginBottom: space.sm },
  segBtn: { flex: 1, paddingVertical: space.md, alignItems: 'center', backgroundColor: color.bgSunken },
  segOn: { backgroundColor: color.accent },
  segDim: { opacity: 0.4 },
  segText: { fontFamily: font.mono, fontSize: 11, letterSpacing: 2, color: color.textMid },
  segTextOn: { color: color.accentInk, fontWeight: '700' },

  listWrap: { flex: 1, flexDirection: 'row' },
  scrubBar: { width: 22, alignItems: 'center', justifyContent: 'center', paddingVertical: space.xs },
  scrubLetter: { fontFamily: font.mono, fontSize: 9, lineHeight: 13, letterSpacing: 0.5, color: color.accent, fontWeight: '700' },

  row: { height: ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, borderBottomWidth: border.hair, borderBottomColor: color.line, backgroundColor: color.panel, gap: space.md },
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
