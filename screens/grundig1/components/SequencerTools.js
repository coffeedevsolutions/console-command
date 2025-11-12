import React from 'react';
import { View, StyleSheet } from 'react-native';
import RockerSwitch from './RockerSwitch';
import Knob from './Knob';
import SectionLabel from './SectionLabel';
import { spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function SequencerTools() {
  const { state, dispatch, actions } = useGrundig1Store();

  const updateSequencer = (values) => {
    dispatch({ type: actions.SET_SEQUENCER, values });
  };

  return (
    <View style={styles.container}>
      <SectionLabel>Sequencer</SectionLabel>
      
      <View style={styles.switches}>
        <RockerSwitch
          value={state.sequencer.s1}
          onChange={(v) => updateSequencer({ s1: v })}
          leftLabel="OFF"
          rightLabel="S1"
          label="Sequence 1"
        />
        <RockerSwitch
          value={state.sequencer.s2}
          onChange={(v) => updateSequencer({ s2: v })}
          leftLabel="OFF"
          rightLabel="S2"
          label="Sequence 2"
        />
        <RockerSwitch
          value={state.sequencer.s3}
          onChange={(v) => updateSequencer({ s3: v })}
          leftLabel="OFF"
          rightLabel="S3"
          label="Sequence 3"
        />
      </View>

      <View style={styles.interval}>
        <Knob
          value={state.sequencer.intervalMs}
          onChange={(v) => updateSequencer({ intervalMs: v })}
          min={100}
          max={10000}
          step={100}
          defaultValue={1000}
          label="Interval"
          format={(v) => `${v.toFixed(0)}ms`}
          size={60}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  switches: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  interval: {
    alignItems: 'center',
  },
});

