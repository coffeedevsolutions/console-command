import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Knob from './Knob';
import RockerSwitch from './RockerSwitch';
import LED from './LED';
import SectionLabel from './SectionLabel';
import { colors, spacing } from '../theme';

export default function LimiterControls({ limiter, onChange, label = 'Limiter' }) {
  const [mockActive, setMockActive] = useState(false);

  // Simulate limiter activity
  useEffect(() => {
    if (limiter.on) {
      const interval = setInterval(() => {
        // Random activity based on threshold
        const shouldActivate = Math.random() > 0.7;
        setMockActive(shouldActivate);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setMockActive(false);
    }
  }, [limiter.on]);

  return (
    <View style={styles.container}>
      <SectionLabel>{label}</SectionLabel>
      
      <View style={styles.row}>
        <RockerSwitch
          value={limiter.on}
          onChange={(v) => onChange({ ...limiter, on: v })}
          leftLabel="OFF"
          rightLabel="ON"
          label="Power"
        />
        <LED on={limiter.on && mockActive} color={colors.ledAmber} size={10} />
      </View>

      <View style={styles.knobs}>
        <Knob
          value={limiter.thresholdDb}
          onChange={(v) => onChange({ ...limiter, thresholdDb: v })}
          min={-24}
          max={0}
          step={0.5}
          defaultValue={-6}
          label="Threshold"
          format={(v) => `${v.toFixed(1)}dB`}
          size={50}
        />
        <Knob
          value={limiter.attackMs}
          onChange={(v) => onChange({ ...limiter, attackMs: v })}
          min={0.1}
          max={100}
          step={0.1}
          defaultValue={5}
          label="Attack"
          format={(v) => `${v.toFixed(1)}ms`}
          size={50}
        />
        <Knob
          value={limiter.releaseMs}
          onChange={(v) => onChange({ ...limiter, releaseMs: v })}
          min={1}
          max={1600}
          step={1}
          defaultValue={100}
          label="Release"
          format={(v) => `${v.toFixed(0)}ms`}
          size={50}
        />
      </View>

      <View style={styles.row}>
        <RockerSwitch
          value={limiter.autoRelease}
          onChange={(v) => onChange({ ...limiter, autoRelease: v })}
          leftLabel="MAN"
          rightLabel="AUTO"
          label="Release Mode"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  knobs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginVertical: spacing.md,
  },
});

