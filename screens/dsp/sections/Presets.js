// screens/dsp/sections/Presets.js — ESP32 preset slots (shared component) + DSP sync/apply
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import PresetSlots from '../../../components/dsp/PresetSlots';
import { color, radius, border, space, type } from '../../../theme/tokens';

export default function Presets({ api, disabled }) {
  return (
    <View style={styles.wrap}>
      <PresetSlots api={api} disabled={disabled} />

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
  btnRow: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  btn: { paddingVertical: space.md, paddingHorizontal: space.lg, borderWidth: border.thick, borderRadius: radius.none },
  btnGhost: { backgroundColor: 'transparent', borderColor: color.lineStrong },
  btnGhostTxt: { ...type.btn, fontSize: 13, color: color.textMid },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
