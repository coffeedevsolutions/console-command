import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import LED from './LED';
import Voltmeter from './Voltmeter';
import { colors, typography, spacing, shadows } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function QuickAccess() {
  const { state, dispatch, actions } = useGrundig1Store();

  const toggleChannelEnabled = (channel) => {
    dispatch({
      type: actions.SET_CHANNEL_ENABLED,
      channel,
      enabled: !state.outputs[channel].enabled,
    });
  };

  const toggleLimiter = (channel) => {
    dispatch({
      type: actions.SET_CHANNEL_LIMITER,
      channel,
      values: { on: !state.outputs[channel].limiter.on },
    });
  };

  const toggleSequencer = (seq) => {
    dispatch({
      type: actions.SET_SEQUENCER,
      values: { [seq]: !state.sequencer[seq] },
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Channel Enables */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>CHANNELS</Text>
            <View style={styles.channelGrid}>
              {['ch1', 'ch2', 'ch3', 'ch4'].map((ch, index) => (
                <TouchableOpacity
                  key={ch}
                  style={[
                    styles.channelButton,
                    state.outputs[ch].enabled && styles.channelButtonActive,
                  ]}
                  onPress={() => toggleChannelEnabled(ch)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.channelButtonText,
                    state.outputs[ch].enabled && styles.channelButtonTextActive,
                  ]}>
                    {index + 1}
                  </Text>
                  <LED on={state.outputs[ch].enabled} color={colors.ledGreen} size={6} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Limiters */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LIMITERS</Text>
            <View style={styles.channelGrid}>
              {['ch1', 'ch2', 'ch3', 'ch4'].map((ch, index) => (
                <TouchableOpacity
                  key={ch}
                  style={[
                    styles.limiterButton,
                    state.outputs[ch].limiter.on && styles.limiterButtonActive,
                  ]}
                  onPress={() => toggleLimiter(ch)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.limiterButtonText,
                    state.outputs[ch].limiter.on && styles.limiterButtonTextActive,
                  ]}>
                    L{index + 1}
                  </Text>
                  <LED on={state.outputs[ch].limiter.on} color={colors.ledAmber} size={6} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Master */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MASTER</Text>
            <View style={styles.masterDisplay}>
              <Text style={styles.masterValue}>{state.global.master}</Text>
              <Text style={styles.masterUnit}>%</Text>
            </View>
          </View>

          {/* Sequencer */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SEQUENCER</Text>
            <View style={styles.sequencerRow}>
              {['s1', 's2', 's3'].map((seq) => (
                <TouchableOpacity
                  key={seq}
                  style={[
                    styles.seqButton,
                    state.sequencer[seq] && styles.seqButtonActive,
                  ]}
                  onPress={() => toggleSequencer(seq)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.seqButtonText,
                    state.sequencer[seq] && styles.seqButtonTextActive,
                  ]}>
                    {seq.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Voltmeter */}
          <View style={styles.section}>
            <Voltmeter />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panelAlt,
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  content: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  section: {
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
  },
  channelGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  channelButton: {
    width: 36,
    height: 36,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  channelButtonActive: {
    backgroundColor: colors.ledGreen,
    borderColor: colors.ledGreen,
  },
  channelButtonText: {
    fontSize: typography.medium,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  channelButtonTextActive: {
    color: colors.panel,
  },
  limiterButton: {
    width: 36,
    height: 36,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
  },
  limiterButtonActive: {
    backgroundColor: colors.ledAmber,
    borderColor: colors.ledAmber,
  },
  limiterButtonText: {
    fontSize: typography.small,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  limiterButtonTextActive: {
    color: colors.panel,
  },
  masterDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  masterValue: {
    fontSize: typography.xlarge,
    color: colors.accent,
    fontWeight: '700',
  },
  masterUnit: {
    fontSize: typography.small,
    color: colors.inkMuted,
  },
  sequencerRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  seqButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  seqButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  seqButtonText: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  seqButtonTextActive: {
    color: colors.panel,
  },
});

