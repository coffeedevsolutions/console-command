import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import SegmentedSwitch from './SegmentedSwitch';
import SectionLabel from './SectionLabel';
import { colors, typography, spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function RoutingMatrix() {
  const { state, dispatch, actions } = useGrundig1Store();

  const setRoute = (channel, route) => {
    dispatch({ type: actions.SET_CHANNEL_ROUTE, channel, route });
  };

  return (
    <View style={styles.container}>
      <SectionLabel>Output Routing</SectionLabel>
      
      {['ch1', 'ch2', 'ch3', 'ch4'].map((ch, index) => (
        <View key={ch} style={styles.row}>
          <Text style={styles.channelLabel}>CH{index + 1}</Text>
          <SegmentedSwitch
            value={state.outputs[ch].route}
            onChange={(v) => setRoute(ch, v)}
            options={['A', 'B', 'A+B']}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  channelLabel: {
    fontSize: typography.medium,
    color: colors.ink,
    fontWeight: '600',
    textTransform: 'uppercase',
    minWidth: 50,
  },
});

