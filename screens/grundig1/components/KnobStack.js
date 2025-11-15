import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Knob from './Knob';
import { spacing, colors, typography } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

export default function KnobStack() {
  const { state, dispatch, actions } = useGrundig1Store();

  // Calculate macro control values from EQ bands
  const getBassValue = () => {
    // Average of low bands (indices 0-3: 25, 40, 63, 100 Hz)
    const lowBands = state.input.graphicEq.slice(0, 4);
    return lowBands.reduce((sum, val) => sum + val, 0) / lowBands.length;
  };

  const getMidValue = () => {
    // Average of mid bands (indices 5-8: 250, 400, 630, 1000 Hz)
    const midBands = state.input.graphicEq.slice(5, 9);
    return midBands.reduce((sum, val) => sum + val, 0) / midBands.length;
  };

  const getTrebleValue = () => {
    // Average of high bands (indices 11-14: 4000, 6300, 10000, 16000 Hz)
    const highBands = state.input.graphicEq.slice(11, 15);
    return highBands.reduce((sum, val) => sum + val, 0) / highBands.length;
  };

  // Get HPF/LPF from first output channel (assuming all channels use same for macro)
  const getLowCutValue = () => {
    return state.outputs.ch1.xover.hpf.freqHz;
  };

  const getHighCutValue = () => {
    return state.outputs.ch1.xover.lpf.freqHz;
  };

  // Handle macro control changes
  const handleBassChange = (value) => {
    // Apply to low bands (indices 0-3)
    const newEq = [...state.input.graphicEq];
    const currentAvg = getBassValue();
    const diff = value - currentAvg;
    for (let i = 0; i < 4; i++) {
      newEq[i] = Math.max(-12, Math.min(12, newEq[i] + diff));
    }
    dispatch({ type: actions.SET_GRAPHIC_EQ, values: newEq });
  };

  const handleMidChange = (value) => {
    // Apply to mid bands (indices 5-8)
    const newEq = [...state.input.graphicEq];
    const currentAvg = getMidValue();
    const diff = value - currentAvg;
    for (let i = 5; i < 9; i++) {
      newEq[i] = Math.max(-12, Math.min(12, newEq[i] + diff));
    }
    dispatch({ type: actions.SET_GRAPHIC_EQ, values: newEq });
  };

  const handleTrebleChange = (value) => {
    // Apply to high bands (indices 11-14)
    const newEq = [...state.input.graphicEq];
    const currentAvg = getTrebleValue();
    const diff = value - currentAvg;
    for (let i = 11; i < 15; i++) {
      newEq[i] = Math.max(-12, Math.min(12, newEq[i] + diff));
    }
    dispatch({ type: actions.SET_GRAPHIC_EQ, values: newEq });
  };

  const handleLowCutChange = (freqHz) => {
    // Apply to all output channels
    ['ch1', 'ch2', 'ch3', 'ch4'].forEach((ch) => {
      dispatch({
        type: actions.SET_CHANNEL_XOVER,
        channel: ch,
        filter: 'hpf',
        values: { freqHz: Math.max(20, Math.min(100, freqHz)) },
      });
    });
  };

  const handleHighCutChange = (freqHz) => {
    // Apply to all output channels
    ['ch1', 'ch2', 'ch3', 'ch4'].forEach((ch) => {
      dispatch({
        type: actions.SET_CHANNEL_XOVER,
        channel: ch,
        filter: 'lpf',
        values: { freqHz: Math.max(8000, Math.min(16000, freqHz)) },
      });
    });
  };

  const handleLoudnessChange = (amount) => {
    // Loudness curve: bass boost at 60-80 Hz, treble boost at 8-10 kHz
    // This is a simplified implementation - scale a predefined curve
    // For now, we'll store it in a way that can be applied
    // This would need additional state management for loudness amount
    // For simplicity, applying directly to EQ bands
    const loudnessCurve = [
      2, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3
    ];
    const scale = amount / 12; // Normalize to -12/+12 range
    const newEq = state.input.graphicEq.map((val, i) => {
      return Math.max(-12, Math.min(12, val + (loudnessCurve[i] * scale)));
    });
    dispatch({ type: actions.SET_GRAPHIC_EQ, values: newEq });
  };

  const handleBalanceChange = (balance) => {
    // Balance: -12 (full left) to +12 (full right)
    // Adjust CH1 (left) and CH2 (right) gains
    const leftGain = balance < 0 ? Math.abs(balance) * (15 / 12) : 0;
    const rightGain = balance > 0 ? balance * (15 / 12) : 0;
    
    dispatch({
      type: actions.SET_CHANNEL_GAIN,
      channel: 'ch1',
      gainDb: Math.max(-45, Math.min(15, -leftGain)),
    });
    dispatch({
      type: actions.SET_CHANNEL_GAIN,
      channel: 'ch2',
      gainDb: Math.max(-45, Math.min(15, -rightGain)),
    });
  };

  // Get current values (recalculated on each render)
  const bassValue = getBassValue();
  const midValue = getMidValue();
  const trebleValue = getTrebleValue();
  const lowCutValue = getLowCutValue();
  const highCutValue = getHighCutValue();
  const masterValue = state.global.master;

  const knobConfigs = [
    {
      value: bassValue,
      onChange: handleBassChange,
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      label: "Bass | Bass",
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`,
    },
    {
      value: midValue,
      onChange: handleMidChange,
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      label: "Mid | Mitte",
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`,
    },
    {
      value: trebleValue,
      onChange: handleTrebleChange,
      min: -12,
      max: 12,
      step: 0.5,
      defaultValue: 0,
      label: "Treble | Höhen",
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}dB`,
    },
    {
      value: lowCutValue,
      onChange: handleLowCutChange,
      min: 20,
      max: 100,
      step: 5,
      defaultValue: 20,
      label: "Low-Cut | Tiefensperre",
      format: (v) => `${v.toFixed(0)}Hz`,
    },
    {
      value: highCutValue,
      onChange: handleHighCutChange,
      min: 8000,
      max: 16000,
      step: 500,
      defaultValue: 16000,
      label: "High-Cut | Höhensperre",
      format: (v) => `${(v / 1000).toFixed(1)}k`,
    },
    {
      value: 0,
      onChange: handleLoudnessChange,
      min: -12,
      max: 12,
      step: 1,
      defaultValue: 0,
      label: "Loudness | Lautstärke",
      format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`,
    },
    {
      value: 0,
      onChange: handleBalanceChange,
      min: -12,
      max: 12,
      step: 1,
      defaultValue: 0,
      label: "Balance | Balance",
      format: (v) => v === 0 ? 'C' : v < 0 ? `L${Math.abs(v).toFixed(0)}` : `R${v.toFixed(0)}`,
    },
    {
      value: masterValue,
      onChange: (v) => dispatch({ type: actions.SET_MASTER, value: v }),
      min: 0,
      max: 100,
      step: 1,
      defaultValue: 75,
      label: "Master | Hauptlautstärke",
      format: (v) => `${v.toFixed(0)}%`,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.knobsStack}>
        {knobConfigs.map((config, index) => (
          <View 
            key={index} 
            style={styles.knobRow}
          >
            <Knob
              value={config.value}
              onChange={config.onChange}
              min={config.min}
              max={config.max}
              step={config.step}
              defaultValue={config.defaultValue}
              label=""
              format={config.format}
              size={50}
            />
            <View style={styles.labelContainer}>
              <Text style={styles.knobLabel}>{config.label}</Text>
              <Text style={styles.knobValue}>{config.format(config.value)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs / 2,
    paddingBottom: 0,
  },
  knobsStack: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 0,
  },
  knobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  labelContainer: {
    marginLeft: spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  knobLabel: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: typography.letterSpacing.loose,
    marginBottom: 2,
  },
  knobValue: {
    fontSize: typography.small,
    color: colors.ink,
    fontWeight: '600',
  },
});

