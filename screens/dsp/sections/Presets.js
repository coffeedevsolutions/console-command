// screens/dsp/sections/Presets.js — ESP32 preset slots + DSP sync/apply utilities
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { dsp } from '../../../api/dspClient';
import { dlog } from '../../../api/dspDebug';
import { color, radius, border, space, type } from '../../../theme/tokens';

export default function Presets({ api, disabled }) {
  const [slots, setSlots] = useState([]);
  const [sel, setSel] = useState(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await dsp.dspPresetList();
      setSlots(r?.presets || []);
    } catch { /* offline */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doSave = async () => {
    if (sel == null) return;
    setBusy(true);
    dlog('→', `preset save slot=${sel}`, { name });
    try { await dsp.dspPresetSave(sel, name || `Preset ${sel + 1}`); await load(); }
    finally { setBusy(false); }
  };
  const doLoad = async () => {
    if (sel == null) return;
    setBusy(true);
    dlog('→', `preset load slot=${sel}`);
    try { await dsp.dspPresetLoad(sel); setTimeout(api.refresh, 1200); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.wrap}>
      <Panel label="Preset Slots" code="ESP32 · 16" ticks contentStyle={styles.stack}>
        <View style={styles.grid}>
          {Array.from({ length: 16 }, (_, i) => {
            const info = slots.find((s) => s.slot === i);
            const used = info?.used;
            const active = sel === i;
            return (
              <Pressable key={i} onPress={() => { setSel(i); setName(info?.name || ''); }}
                style={[styles.slot, active ? styles.slotOn : styles.slotOff]}>
                <Text style={[styles.slotNum, active && { color: color.accentInk }]}>{i + 1}</Text>
                <Text style={[styles.slotName, active && { color: color.accentInk }]} numberOfLines={1}>
                  {used ? (info.name || 'SAVED') : '—'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {sel != null && (
          <View style={styles.editor}>
            <TextInput value={name} onChangeText={setName} placeholder={`Preset ${sel + 1}`}
              placeholderTextColor={color.textLow} style={styles.input} maxLength={20} />
            <View style={styles.btnRow}>
              <Pressable disabled={busy} onPress={doSave} style={[styles.btn, styles.btnPrimary]}>
                <Text style={styles.btnPrimaryTxt}>SAVE</Text>
              </Pressable>
              <Pressable disabled={busy || !slots.find((s) => s.slot === sel)?.used} onPress={doLoad}
                style={[styles.btn, styles.btnGhost]}>
                <Text style={styles.btnGhostTxt}>LOAD</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Panel>

      <Panel label="Device Link" code="ADVANCED" contentStyle={styles.stack}>
        <Text style={styles.note}>
          SYNC reads the DSP's current state into the mirror. PUSH force-writes the entire
          mirror to the DSP. Both run over BLE and take ~1s.
        </Text>
        <View style={styles.btnRow}>
          <Pressable disabled={disabled} onPress={api.syncFromDevice} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostTxt}>◧ SYNC FROM DSP</Text>
          </Pressable>
          <Pressable disabled={disabled} onPress={api.applyToDevice} style={[styles.btn, styles.btnGhost]}>
            <Text style={styles.btnGhostTxt}>◨ PUSH TO DSP</Text>
          </Pressable>
        </View>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  stack: { gap: space.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  slot: {
    width: '22%', minWidth: 66, paddingVertical: space.sm, paddingHorizontal: space.xs,
    borderWidth: border.thick, borderRadius: radius.none, gap: 2,
  },
  slotOn: { backgroundColor: color.accent, borderColor: color.accent },
  slotOff: { backgroundColor: color.bgSunken, borderColor: color.lineStrong },
  slotNum: { ...type.tag, fontSize: 12, color: color.textHi },
  slotName: { ...type.meta, fontSize: 9, color: color.textMid },
  editor: { gap: space.sm },
  input: {
    backgroundColor: color.bgSunken, borderWidth: border.thick, borderColor: color.lineStrong,
    paddingHorizontal: space.md, paddingVertical: space.sm, color: color.textHi, ...type.body,
  },
  btnRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  btn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderWidth: border.thick, borderRadius: radius.none },
  btnPrimary: { backgroundColor: color.accent, borderColor: color.accent },
  btnPrimaryTxt: { ...type.btn, fontSize: 13, color: color.accentInk },
  btnGhost: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  btnGhostTxt: { ...type.btn, fontSize: 13, color: color.textMid },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
