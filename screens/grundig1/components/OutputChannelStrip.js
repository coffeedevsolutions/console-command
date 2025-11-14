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
        <LED on={channelState.enabled} color={colors.ledGreen} size={6} />
      </View>

      {/* Top Row: Routing & Gain Knob */}
      <View style={styles.topRow}>
        <View style={styles.routingContainer}>
          <Text style={styles.miniLabel}>IN</Text>
          <SegmentedSwitch
            value={channelState.route}
            onChange={(v) => updateChannel(actions.SET_CHANNEL_ROUTE, { route: v })}
            options={['A', 'B', 'A+B']}
          />
        </View>
        
        <View style={styles.gainContainer}>
          <Knob
            value={channelState.gainDb}
            onChange={(v) => updateChannel(actions.SET_CHANNEL_GAIN, { value: v })}
            min={-45}
            max={15}
            step={0.5}
            defaultValue={0}
            label="Gain"
            format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}`}
            size={40}
          />
        </View>
      </View>

      {/* Info Grid: Compact status display */}
      <View style={styles.infoGrid}>
        {/* Xover */}
        <View style={styles.infoCell}>
          <Text style={styles.miniLabel}>XOVER</Text>
          <Text style={styles.miniValue}>
            {channelState.xover.hpf.enabled || channelState.xover.lpf.enabled ? 
              `${channelState.xover.hpf.enabled ? 'H' : ''}${channelState.xover.lpf.enabled ? 'L' : ''}` : 
              'OFF'}
          </Text>
        </View>

        {/* PEQ */}
        <View style={styles.infoCell}>
          <Text style={styles.miniLabel}>PEQ</Text>
          <Text style={styles.miniValue}>
            {channelState.peq.gain !== 0 ? 
              `${channelState.peq.gain > 0 ? '+' : ''}${channelState.peq.gain.toFixed(1)}` : 
              '0.0'}
          </Text>
        </View>

        {/* Delay */}
        <View style={styles.infoCell}>
          <Text style={styles.miniLabel}>DLY</Text>
          <Text style={styles.miniValue}>{channelState.delayMs.toFixed(1)}</Text>
        </View>

        {/* Limiter */}
        <View style={styles.infoCell}>
          <View style={styles.limiterCell}>
            <Text style={styles.miniLabel}>LIM</Text>
            <LED on={channelState.limiter.on} color={colors.ledAmber} size={4} />
          </View>
          <Text style={styles.miniValue}>
            {channelState.limiter.on ? channelState.limiter.thresholdDb.toFixed(0) : 'OFF'}
          </Text>
        </View>
      </View>

      {/* Bottom Row: Polarity, Mute, Enable */}
      <View style={styles.bottomRow}>
        <View style={styles.polarityContainer}>
          <RockerSwitch
            value={channelState.invert}
            onChange={(v) => updateChannel(actions.SET_CHANNEL_POLARITY, { invert: v })}
            leftLabel="0°"
            rightLabel="180°"
            label=""
          />
        </View>
        
        <TouchableOpacity
          style={[styles.muteButton, channelState.mute && styles.muteButtonActive]}
          onPress={() => updateChannel(actions.SET_CHANNEL_MUTE, { mute: !channelState.mute })}
          activeOpacity={0.7}
        >
          <Text style={[styles.muteText, channelState.mute && styles.muteTextActive]}>
            M
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.enableButton, channelState.enabled && styles.enableButtonActive]}
          onPress={() => updateChannel(actions.SET_CHANNEL_ENABLED, { enabled: !channelState.enabled })}
          activeOpacity={0.7}
        >
          <Text style={[styles.enableText, channelState.enabled && styles.enableTextActive]}>
            E
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minWidth: 100,
    maxWidth: 140,
    backgroundColor: colors.panelAlt,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    ...shadows.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  channelTitle: {
    fontSize: typography.small,
    color: colors.ink,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  routingContainer: {
    flex: 1,
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: typography.tiny - 1,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.tight,
    marginBottom: 2,
  },
  gainContainer: {
    alignItems: 'center',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
    justifyContent: 'space-between',
  },
  infoCell: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: spacing.xs / 2,
  },
  miniValue: {
    fontSize: typography.tiny,
    color: colors.ink,
    fontWeight: '600',
    textAlign: 'center',
  },
  limiterCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    gap: spacing.xs / 2,
    alignItems: 'center',
  },
  polarityContainer: {
    flex: 1,
  },
  muteButton: {
    width: 24,
    height: 24,
    backgroundColor: colors.panelLight,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteButtonActive: {
    backgroundColor: colors.ledRed,
    borderColor: colors.ledRed,
  },
  muteText: {
    fontSize: typography.tiny - 1,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  muteTextActive: {
    color: colors.ink,
  },
  enableButton: {
    width: 24,
    height: 24,
    backgroundColor: colors.panelLight,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableButtonActive: {
    backgroundColor: colors.ledGreen,
    borderColor: colors.ledGreen,
  },
  enableText: {
    fontSize: typography.tiny - 1,
    color: colors.inkMuted,
    fontWeight: '700',
  },
  enableTextActive: {
    color: colors.panel,
  },
});

