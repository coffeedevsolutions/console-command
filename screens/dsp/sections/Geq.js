// screens/dsp/sections/Geq.js — 15-band graphic EQ (horizontal snap fader bank) + presets
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import FaderColumn from '../../../components/dsp/FaderColumn';
import { Solo } from '../../../components/dsp/Responsive';
import { RANGE, GEQ_HZ, GEQ_PRESETS, fmtHz } from '../../../api/dspUnits';
import { color, radius, border, space, type } from '../../../theme/tokens';

const COL_W = 46;

export default function Geq({ st, api, disabled }) {
  return (
    <Solo>
      <Panel label="Graphic EQ" code={`15-BAND · ±12 dB`} ticks contentStyle={styles.stack}>
        {/* horizontal fader bank — snaps by column so bands land cleanly */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={COL_W + space.xs}
          decelerationRate="fast"
          contentContainerStyle={styles.bank}
        >
          {st.geq.bands.map((db, i) => (
            <FaderColumn
              key={i}
              label={fmtHz(GEQ_HZ[i])}
              value={db}
              min={RANGE.geqBand[0]} max={RANGE.geqBand[1]} step={RANGE.geqBand[2]}
              disabled={disabled}
              onDragChange={api.setDragging}
              onCommit={(v) => api.setGeqBand(i, Math.round(v * 2) / 2)}
            />
          ))}
        </ScrollView>
        <Pressable style={styles.reset} disabled={disabled} onPress={api.resetGeq}>
          <Text style={styles.resetTxt}>FLATTEN ALL</Text>
        </Pressable>
      </Panel>

      <Panel label="EQ Preset" code="CAL(C11)">
        <View style={styles.presetGrid}>
          {GEQ_PRESETS.map((name, idx) => {
            const active = st.geq.preset === idx;
            return (
              <Pressable
                key={name}
                disabled={disabled}
                onPress={() => api.setGeqPreset(idx)}
                style={[styles.chip, active ? styles.chipOn : styles.chipOff, disabled && { opacity: 0.4 }]}
              >
                <Text style={[styles.chipTxt, active && { color: color.accentInk }]}>{name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Panel>
    </Solo>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  stack: { gap: space.md },
  bank: { flexDirection: 'row', gap: space.xs, paddingVertical: space.sm },
  reset: {
    alignSelf: 'flex-start', paddingVertical: space.sm, paddingHorizontal: space.lg,
    borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken,
  },
  resetTxt: { ...type.tag, fontSize: 11, color: color.textMid },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: space.sm, paddingHorizontal: space.md,
    borderWidth: border.thick, borderRadius: radius.none,
  },
  chipOn: { backgroundColor: color.accent, borderColor: color.accent },
  chipOff: { backgroundColor: color.bgSunken, borderColor: color.lineStrong },
  chipTxt: { ...type.meta, color: color.textHi, letterSpacing: 1 },
});
