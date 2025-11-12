import React from 'react';
import { View, StyleSheet } from 'react-native';
import SegmentedSwitch from './SegmentedSwitch';
import Knob from './Knob';
import SectionLabel from './SectionLabel';
import { spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function Generators() {
  const { state, dispatch, actions } = useGrundig1Store();

  const updateGenerator = (values) => {
    dispatch({ type: actions.SET_GENERATOR, values });
  };

  return (
    <View style={styles.container}>
      <SectionLabel>Signal Generators</SectionLabel>
      
      <View style={styles.modeSelector}>
        <SegmentedSwitch
          value={state.generators.mode}
          onChange={(v) => updateGenerator({ mode: v })}
          options={['sine', 'sweep', 'pink']}
          label="Mode"
        />
      </View>

      <View style={styles.controls}>
        <Knob
          value={state.generators.levelDb}
          onChange={(v) => updateGenerator({ levelDb: v })}
          min={-60}
          max={0}
          step={1}
          defaultValue={-20}
          label="Level"
          format={(v) => `${v.toFixed(0)}dB`}
          size={60}
        />

        {state.generators.mode === 'sine' && (
          <Knob
            value={state.generators.sineHz}
            onChange={(v) => updateGenerator({ sineHz: v })}
            min={10}
            max={22000}
            step={1}
            defaultValue={1000}
            label="Frequency"
            format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
            size={60}
          />
        )}

        {state.generators.mode === 'sweep' && (
          <>
            <Knob
              value={state.generators.sweep.start}
              onChange={(v) => updateGenerator({ sweep: { ...state.generators.sweep, start: v } })}
              min={10}
              max={22000}
              step={1}
              defaultValue={20}
              label="Start"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
              size={60}
            />
            <Knob
              value={state.generators.sweep.end}
              onChange={(v) => updateGenerator({ sweep: { ...state.generators.sweep, end: v } })}
              min={10}
              max={22000}
              step={1}
              defaultValue={20000}
              label="End"
              format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
              size={60}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  modeSelector: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
});

