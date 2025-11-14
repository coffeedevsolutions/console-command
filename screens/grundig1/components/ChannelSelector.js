import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, shadows } from '../theme';
import LED from './LED';

export default function ChannelSelector({ selectedChannel, onSelectChannel, channels }) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>OUTPUT CHANNELS</Text>
      <View style={styles.channelGrid}>
        {channels.map((ch, index) => {
          const isSelected = selectedChannel === ch;
          return (
            <TouchableOpacity
              key={ch}
              style={[styles.channelButton, isSelected && styles.channelButtonActive]}
              onPress={() => onSelectChannel(ch)}
              activeOpacity={0.7}
            >
              <View style={styles.channelHeader}>
                <Text style={[styles.channelNumber, isSelected && styles.channelNumberActive]}>
                  {index + 1}
                </Text>
                <LED on={isSelected} color={colors.ledGreen} size={6} />
              </View>
              <Text style={[styles.channelLabel, isSelected && styles.channelLabelActive]}>
                CH{index + 1}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: colors.panelAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  label: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  channelGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  channelButton: {
    flex: 1,
    padding: spacing.sm,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    ...shadows.sm,
  },
  channelButtonActive: {
    backgroundColor: colors.aluminum,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  channelNumber: {
    fontSize: typography.medium,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  channelNumberActive: {
    color: colors.panel,
  },
  channelLabel: {
    fontSize: typography.tiny,
    color: colors.inkDim,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.tight,
  },
  channelLabelActive: {
    color: colors.panel,
    fontWeight: '600',
  },
});

