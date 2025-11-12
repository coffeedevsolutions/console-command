import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Knob from './Knob';
import SegmentedSwitch from './SegmentedSwitch';
import RockerSwitch from './RockerSwitch';
import SectionLabel from './SectionLabel';
import { colors, typography, spacing } from '../theme';

export default function CrossoverControls({ xover, onChange, label = 'Crossover' }) {
  const updateFilter = (filter, values) => {
    onChange({
      ...xover,
      [filter]: { ...xover[filter], ...values },
    });
  };

  return (
    <View style={styles.container}>
      <SectionLabel>{label}</SectionLabel>
      
      {/* HPF */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>HIGH PASS</Text>
        <View style={styles.controls}>
          <SegmentedSwitch
            value={xover.hpf.type}
            onChange={(v) => updateFilter('hpf', { type: v })}
            options={['BW', 'LR']}
            label="Type"
          />
          <SegmentedSwitch
            value={xover.hpf.slope}
            onChange={(v) => updateFilter('hpf', { slope: v })}
            options={[12, 18, 24, 36]}
            label="Slope"
          />
          <Knob
            value={xover.hpf.freqHz}
            onChange={(v) => updateFilter('hpf', { freqHz: v })}
            min={20}
            max={20000}
            step={1}
            defaultValue={80}
            label="Freq"
            format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
            size={50}
          />
          <RockerSwitch
            value={xover.hpf.enabled}
            onChange={(v) => updateFilter('hpf', { enabled: v })}
            leftLabel="OFF"
            rightLabel="ON"
            label="Enable"
          />
        </View>
      </View>

      {/* LPF */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>LOW PASS</Text>
        <View style={styles.controls}>
          <SegmentedSwitch
            value={xover.lpf.type}
            onChange={(v) => updateFilter('lpf', { type: v })}
            options={['BW', 'LR']}
            label="Type"
          />
          <SegmentedSwitch
            value={xover.lpf.slope}
            onChange={(v) => updateFilter('lpf', { slope: v })}
            options={[12, 18, 24, 36]}
            label="Slope"
          />
          <Knob
            value={xover.lpf.freqHz}
            onChange={(v) => updateFilter('lpf', { freqHz: v })}
            min={20}
            max={20000}
            step={1}
            defaultValue={12000}
            label="Freq"
            format={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v.toFixed(0)}`}
            size={50}
          />
          <RockerSwitch
            value={xover.lpf.enabled}
            onChange={(v) => updateFilter('lpf', { enabled: v })}
            leftLabel="OFF"
            rightLabel="ON"
            label="Enable"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  filterSection: {
    marginBottom: spacing.lg,
  },
  filterLabel: {
    fontSize: typography.small,
    color: colors.ink,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    gap: spacing.md,
  },
});

