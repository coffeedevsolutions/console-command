import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Knob from './Knob';
import SectionLabel from './SectionLabel';
import { colors, typography, spacing } from '../theme';

export default function DelayControl({ value, onChange, label = 'Delay' }) {
  const distanceCm = (value * 34.3).toFixed(1);

  return (
    <View style={styles.container}>
      <SectionLabel>{label}</SectionLabel>
      <Knob
        value={value}
        onChange={onChange}
        min={0}
        max={8}
        step={0.1}
        defaultValue={0}
        label="Time"
        format={(v) => `${v.toFixed(1)}ms`}
        size={50}
      />
      <View style={styles.distance}>
        <Text style={styles.distanceValue}>{distanceCm}</Text>
        <Text style={styles.distanceUnit}>cm</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    alignItems: 'center',
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  distanceValue: {
    fontSize: typography.medium,
    color: colors.accent,
    fontWeight: '600',
  },
  distanceUnit: {
    fontSize: typography.small,
    color: colors.inkMuted,
  },
});

