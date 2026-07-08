// screens/NowSpinning.js — full-screen "Now Spinning" for the Phono source: a big spinning vinyl
// (album art as the label) with live ShazamKit identification + a manual "identify again" button.
// Reads the shared NowSpinningProvider, so it stays live while open.
import React from 'react';
import { View, Text, Pressable, useWindowDimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DottedGrid from '../components/ui/DottedGrid';
import { Vinyl } from '../components/NowSpinningCard';
import { useNowSpinning } from '../hooks/useNowSpinning';
import { color, border, space, font } from '../theme/tokens';

export default function NowSpinning({ navigation }) {
  const { state, track, identify, supported } = useNowSpinning();
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) * 0.6;
  const spinning = state === 'spinning' || state === 'listening';
  const busy = state === 'listening';

  let title, sub;
  if (!supported) { title = 'Not available'; sub = 'This build has no ShazamKit'; }
  else if (state === 'denied') { title = 'Microphone off'; sub = 'Enable mic access in Settings → Privacy'; }
  else if (state === 'listening' && !track) { title = 'Identifying record…'; sub = 'Listening'; }
  else if (state === 'dormant') { title = track?.title || 'Paused'; sub = track?.artist || 'Tap to identify'; }
  else { title = track?.title || '—'; sub = track?.artist || 'Vinyl'; }

  const album = track?.subtitle && track.subtitle !== track.artist ? track.subtitle : null;

  return (
    <View style={styles.root}>
      <DottedGrid />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NOW SPINNING · PHONO</Text>
          <Pressable onPress={() => navigation.goBack()} hitSlop={16} style={styles.closeBtn}>
            <Text style={styles.closeGlyph}>×</Text>
          </Pressable>
        </View>

        {/* tap the record to re-identify too */}
        <Pressable style={styles.center} onPress={identify} disabled={busy || !supported}>
          <Vinyl artworkURL={track?.artworkURL} spinning={spinning} size={size} />
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{sub}</Text>
          {album ? <Text style={styles.album} numberOfLines={1}>{album}</Text> : null}
        </Pressable>

        <View style={styles.footer}>
          <Pressable onPress={identify} disabled={busy || !supported}
            style={[styles.identify, (busy || !supported) && styles.identifyBusy]}>
            <Text style={styles.identifyTxt}>↻  {busy ? 'LISTENING…' : 'IDENTIFY AGAIN'}</Text>
          </Pressable>
          <Text style={styles.shazam}>◎ POWERED BY SHAZAM</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  safe: { flex: 1, paddingHorizontal: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.sm, paddingBottom: space.md },
  eyebrow: { fontFamily: font.mono, fontSize: 11, letterSpacing: 3, color: color.textLow },
  closeBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.panel },
  closeGlyph: { color: color.textHi, fontSize: 24, lineHeight: 26, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  title: { fontFamily: font.display, fontSize: 24, fontWeight: '800', color: color.textHi, textAlign: 'center', marginTop: space.lg },
  artist: { fontFamily: font.mono, fontSize: 13, letterSpacing: 1, color: color.textMid, textAlign: 'center' },
  album: { fontFamily: font.mono, fontSize: 11, letterSpacing: 1, color: color.textLow, textAlign: 'center' },
  footer: { alignItems: 'center', gap: space.sm, paddingBottom: space.md },
  identify: { borderWidth: border.thick, borderColor: color.accent, backgroundColor: color.accent, paddingVertical: space.md, paddingHorizontal: space.xl },
  identifyBusy: { opacity: 0.45 },
  identifyTxt: { fontFamily: font.display, fontWeight: '800', fontSize: 14, letterSpacing: 1, color: color.accentInk },
  shazam: { fontFamily: font.mono, fontSize: 10, letterSpacing: 1, color: color.textLow },
});
