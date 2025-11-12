import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SegmentedSwitch from './SegmentedSwitch';
import Knob from './Knob';
import RockerSwitch from './RockerSwitch';
import LED from './LED';
import { colors, typography, spacing, shadows } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function OutputChannelStrip({ channel }) {
  const { state, dispatch, actions } = useGrundig1Store();
  const channelState = state.outputs[channel];
  const channelNum = channel.replace('ch', '');

  const updateChannel = (type, value) => {
    dispatch({ type, channel, ...value });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.channelTitle}>CH{channelNum}</Text>
        <LED on={channelState.enabled} color={colors.ledGreen} size={8} />
      </View>

      {/* Routing */}
      <View style={styles.section}>
        <SegmentedSwitch
          value={channelState.route}
          onChange={(v) => updateChannel(actions.SET_CHANNEL_ROUTE, { route: v })}
          options={['A', 'B', 'A+B']}
          label="Input"
        />
      </View>

      {/* Crossover Quick Status */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>XOVER</Text>
        <View style={styles.xoverStatus}>
          <Text style={styles.statusText}>
            HPF: {channelState.xover.hpf.enabled ? 
              `${channelState.xover.hpf.freqHz >= 1000 ? 
                (channelState.xover.hpf.freqHz / 1000).toFixed(1) + 'k' : 
                channelState.xover.hpf.freqHz}Hz` : 
              'OFF'}
          </Text>
          <Text style={styles.statusText}>
            LPF: {channelState.xover.lpf.enabled ? 
              `${channelState.xover.lpf.freqHz >= 1000 ? 
                (channelState.xover.lpf.freqHz / 1000).toFixed(1) + 'k' : 
                channelState.xover.lpf.freqHz}Hz` : 
              'OFF'}
          </Text>
        </View>
      </View>

      {/* PEQ */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PEQ</Text>
        <Text style={styles.statusText}>
          {channelState.peq.freq >= 1000 ? 
            `${(channelState.peq.freq / 1000).toFixed(1)}k` : 
            `${channelState.peq.freq.toFixed(0)}`}Hz
        </Text>
        <Text style={styles.statusText}>
          {channelState.peq.gain > 0 ? '+' : ''}{channelState.peq.gain.toFixed(1)}dB
        </Text>
      </View>

      {/* Delay */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>DELAY</Text>
        <Text style={styles.statusText}>{channelState.delayMs.toFixed(1)}ms</Text>
      </View>

      {/* Polarity */}
      <View style={styles.section}>
        <RockerSwitch
          value={channelState.invert}
          onChange={(v) => updateChannel(actions.SET_CHANNEL_POLARITY, { invert: v })}
          leftLabel="0°"
          rightLabel="180°"
          label="Polarity"
        />
      </View>

      {/* Limiter */}
      <View style={styles.section}>
        <View style={styles.limiterRow}>
          <Text style={styles.sectionLabel}>LIM</Text>
          <LED on={channelState.limiter.on} color={colors.ledAmber} size={6} />
        </View>
        <Text style={styles.statusText}>
          {channelState.limiter.on ? `${channelState.limiter.thresholdDb.toFixed(1)}dB` : 'OFF'}
        </Text>
      </View>

      {/* Gain */}
      <View style={styles.section}>
        <Knob
          value={channelState.gainDb}
          onChange={(v) => updateChannel(actions.SET_CHANNEL_GAIN, { value: v })}
          min={-45}
          max={15}
          step={0.5}
          defaultValue={0}
          label="Gain"
          format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}dB`}
          size={50}
        />
      </View>

      {/* Mute & Enable */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.muteButton, channelState.mute && styles.muteButtonActive]}
          onPress={() => updateChannel(actions.SET_CHANNEL_MUTE, { mute: !channelState.mute })}
          activeOpacity={0.7}
        >
          <Text style={[styles.muteText, channelState.mute && styles.muteTextActive]}>
            MUTE
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.enableButton, channelState.enabled && styles.enableButtonActive]}
          onPress={() => updateChannel(actions.SET_CHANNEL_ENABLED, { enabled: !channelState.enabled })}
          activeOpacity={0.7}
        >
          <Text style={[styles.enableText, channelState.enabled && styles.enableTextActive]}>
            EN
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 120,
    backgroundColor: colors.panelAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelTitle: {
    fontSize: typography.medium,
    color: colors.ink,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: spacing.xs,
  },
  xoverStatus: {
    gap: spacing.xs,
  },
  statusText: {
    fontSize: typography.tiny,
    color: colors.ink,
    textAlign: 'center',
  },
  limiterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  muteButton: {
    flex: 1,
    padding: spacing.xs,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  muteButtonActive: {
    backgroundColor: colors.ledRed,
    borderColor: colors.ledRed,
  },
  muteText: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  muteTextActive: {
    color: colors.ink,
  },
  enableButton: {
    padding: spacing.xs,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minWidth: 36,
  },
  enableButtonActive: {
    backgroundColor: colors.ledGreen,
    borderColor: colors.ledGreen,
  },
  enableText: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    fontWeight: '600',
  },
  enableTextActive: {
    color: colors.panel,
  },
});

