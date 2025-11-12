import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../theme';

export default function SectionLabel({ children, style }) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>{children}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  text: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginRight: spacing.sm,
    fontWeight: '600',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderLight,
  },
});

