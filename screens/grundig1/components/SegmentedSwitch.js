import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, shadows } from '../theme';

export default function SegmentedSwitch({
  value,
  onChange,
  options = ['A', 'B', 'A+B'],
  label,
}) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.segments}>
        {options.map((option, index) => (
          <React.Fragment key={option}>
            {index > 0 && <View style={styles.divider} />}
            <TouchableOpacity
              style={[styles.segment, value === option && styles.segmentActive]}
              onPress={() => onChange(option)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.segmentText,
                  value === option && styles.segmentTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          </React.Fragment>
        ))}
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
  segments: {
    flexDirection: 'row',
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  segment: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.panelAlt,
    minWidth: 32,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.aluminum,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  segmentText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '600',
    letterSpacing: typography.letterSpacing.tight,
  },
  segmentTextActive: {
    color: colors.panel,
  },
});

