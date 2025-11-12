import React from 'react';
import { View, StyleSheet } from 'react-native';
import Knob from './Knob';
import SectionLabel from './SectionLabel';
import { spacing } from '../theme';

export default function PEQControls({ peq, onChange, label = 'Parametric EQ' }) {
  return (
    <View style={styles.container}>
      <SectionLabel>{label}</SectionLabel>
      <View style={styles.knobs}>
        <Knob
          value={peq.freq}
          onChange={(v) => onChange({ ...peq, freq: v })}
          min={20}
          max={20000}
          step={1}
          defaultValue={1000}
          label="Freq"
          format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
          size={50}
        />
        <Knob
          value={peq.gain}
          onChange={(v) => onChange({ ...peq, gain: v })}
          min={-12}
          max={12}
          step={0.5}
          defaultValue={0}
          label="Gain"
          format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`}
          size={50}
        />
        <Knob
          value={peq.q}
          onChange={(v) => onChange({ ...peq, q: v })}
          min={0.4}
          max={10}
          step={0.1}
          defaultValue={1.0}
          label="Q"
          format={(v) => v.toFixed(1)}
          size={50}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  knobs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
});

