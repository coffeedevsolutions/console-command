import React from 'react';
import { View, StyleSheet } from 'react-native';
import Knob from './Knob';
import SectionLabel from './SectionLabel';
import { spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function KnobStack() {
  const { state, dispatch, actions } = useGrundig1Store();

  return (
    <View style={styles.container}>
      <SectionLabel>Master Controls</SectionLabel>
      
      <View style={styles.knobs}>
        <Knob
          value={state.global.master}
          onChange={(v) => dispatch({ type: actions.SET_MASTER, value: v })}
          min={0}
          max={100}
          step={1}
          defaultValue={75}
          label="Master"
          format={(v) => `${v.toFixed(0)}%`}
          size={70}
        />
        
        <Knob
          value={state.generators.levelDb}
          onChange={(v) => dispatch({ type: actions.SET_GENERATOR, values: { levelDb: v } })}
          min={-60}
          max={0}
          step={1}
          defaultValue={-20}
          label="Gen Level"
          format={(v) => `${v.toFixed(0)}dB`}
          size={70}
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
    alignItems: 'center',
    gap: spacing.lg,
  },
});

