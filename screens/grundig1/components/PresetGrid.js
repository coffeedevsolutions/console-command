import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import SectionLabel from './SectionLabel';
import { colors, typography, spacing, shadows } from '../theme';
import { useGrundig1Store, getGraphicEqPresets, getCrossoverPresets } from '../state/grundig1Store';

export default function PresetGrid() {
  const { state, dispatch, actions } = useGrundig1Store();

  const eqPresets = getGraphicEqPresets();
  const xoverPresets = getCrossoverPresets();

  const loadEqPreset = (index) => {
    dispatch({ type: actions.LOAD_PRESET, presetType: 'graphicEq', presetIndex: index });
  };

  const loadXoverPreset = (index) => {
    dispatch({ type: actions.LOAD_PRESET, presetType: 'crossover', presetIndex: index });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Graphic EQ Presets */}
      <View style={styles.section}>
        <SectionLabel>Graphic EQ Presets</SectionLabel>
        <View style={styles.grid}>
          {eqPresets.map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.presetButton,
                state.global.presets.graphicEq === index && styles.presetButtonActive,
              ]}
              onPress={() => loadEqPreset(index)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.presetNumber,
                state.global.presets.graphicEq === index && styles.presetNumberActive,
              ]}>
                {index + 1}
              </Text>
              <Text style={[
                styles.presetName,
                state.global.presets.graphicEq === index && styles.presetNameActive,
              ]}>
                {preset.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Crossover Presets */}
      <View style={styles.section}>
        <SectionLabel>Crossover Presets</SectionLabel>
        <View style={styles.grid}>
          {xoverPresets.map((preset, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.presetButton,
                state.global.presets.crossover === index && styles.presetButtonActive,
              ]}
              onPress={() => loadXoverPreset(index)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.presetNumber,
                state.global.presets.crossover === index && styles.presetNumberActive,
              ]}>
                {index + 1}
              </Text>
              <Text style={[
                styles.presetName,
                state.global.presets.crossover === index && styles.presetNameActive,
              ]}>
                {preset.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    marginBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  presetButton: {
    width: 100,
    padding: spacing.sm,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  presetButtonActive: {
    backgroundColor: colors.aluminum,
    borderColor: colors.accent,
  },
  presetNumber: {
    fontSize: typography.small,
    color: colors.inkDim,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  presetNumberActive: {
    color: colors.panel,
  },
  presetName: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
  },
  presetNameActive: {
    color: colors.panel,
  },
});

