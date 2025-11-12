import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, shadows } from '../theme';

export default function RockerSwitch({
  value,
  onChange,
  leftLabel = 'OFF',
  rightLabel = 'ON',
  label,
}) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.rocker}>
        <TouchableOpacity
          style={[styles.side, !value && styles.sideActive]}
          onPress={() => onChange(false)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sideText, !value && styles.sideTextActive]}>
            {leftLabel}
          </Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity
          style={[styles.side, value && styles.sideActive]}
          onPress={() => onChange(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sideText, value && styles.sideTextActive]}>
            {rightLabel}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
  },
  rocker: {
    flexDirection: 'row',
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  side: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelAlt,
  },
  sideActive: {
    backgroundColor: colors.aluminum,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  sideText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.tight,
  },
  sideTextActive: {
    color: colors.panel,
  },
});

