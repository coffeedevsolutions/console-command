import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function Voltmeter() {
  const { state } = useGrundig1Store();
  const { live, min, max } = state.global.voltmeter;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>VOLTMETER</Text>
      <View style={styles.readings}>
        <View style={styles.reading}>
          <Text style={styles.readingLabel}>LIVE</Text>
          <Text style={styles.readingValue}>{live.toFixed(1)}</Text>
          <Text style={styles.readingUnit}>V</Text>
        </View>
        <View style={styles.reading}>
          <Text style={styles.readingLabel}>MIN</Text>
          <Text style={styles.readingValue}>{min.toFixed(1)}</Text>
          <Text style={styles.readingUnit}>V</Text>
        </View>
        <View style={styles.reading}>
          <Text style={styles.readingLabel}>MAX</Text>
          <Text style={styles.readingValue}>{max.toFixed(1)}</Text>
          <Text style={styles.readingUnit}>V</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  readings: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  reading: {
    alignItems: 'center',
  },
  readingLabel: {
    fontSize: typography.tiny,
    color: colors.inkDim,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  readingValue: {
    fontSize: typography.medium,
    color: colors.accent,
    fontWeight: '700',
  },
  readingUnit: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
  },
});

