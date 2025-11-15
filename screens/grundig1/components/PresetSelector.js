import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, spacing, shadows } from '../theme';
import { useGrundig1Store, getGraphicEqPresets } from '../state/grundig1Store';

const PRESETS_PER_PAGE = 5;
const TOTAL_PAGES = 2;
const TOTAL_PRESETS = 10;

export default function PresetSelector() {
  const { state, dispatch, actions } = useGrundig1Store();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollViewRef = useRef(null);
  const containerWidthRef = useRef(0);

  const eqPresets = getGraphicEqPresets().slice(0, TOTAL_PRESETS);

  const loadEqPreset = (index) => {
    dispatch({ type: actions.LOAD_PRESET, presetType: 'graphicEq', presetIndex: index });
  };

  const handleScroll = (event) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const page = Math.round(contentOffset.x / layoutMeasurement.width);
    setCurrentPage(page);
  };

  const getPresetsForPage = (pageIndex) => {
    const startIndex = pageIndex * PRESETS_PER_PAGE;
    return eqPresets.slice(startIndex, startIndex + PRESETS_PER_PAGE);
  };

  return (
    <View style={styles.container}>
      <View
        style={styles.scrollContainer}
        onLayout={(event) => {
          const { width } = event.nativeEvent.layout;
          if (width > 0) {
            containerWidthRef.current = width;
          }
        }}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {containerWidthRef.current > 0 && Array.from({ length: TOTAL_PAGES }).map((_, pageIndex) => (
            <View key={pageIndex} style={[styles.page, { width: containerWidthRef.current }]}>
              <View style={styles.presetsRow}>
                {getPresetsForPage(pageIndex).map((preset, presetIndex) => {
                  const globalIndex = pageIndex * PRESETS_PER_PAGE + presetIndex;
                  const isActive = state.global.presets.graphicEq === globalIndex;
                  
                  return (
                    <TouchableOpacity
                      key={globalIndex}
                      style={[
                        styles.presetButton,
                        isActive && styles.presetButtonActive,
                      ]}
                      onPress={() => loadEqPreset(globalIndex)}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.presetNumber,
                        isActive && styles.presetNumberActive,
                      ]}>
                        {globalIndex + 1}
                      </Text>
                      <Text style={[
                        styles.presetName,
                        isActive && styles.presetNameActive,
                      ]} numberOfLines={1}>
                        {preset.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Page indicators */}
      <View style={styles.pageIndicators}>
        {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.pageIndicator,
              i === currentPage && styles.pageIndicatorActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.panelAlt,
    flexShrink: 0,
  },
  scrollContainer: {
    flexDirection: 'row',
  },
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  page: {
    justifyContent: 'center',
    paddingVertical: spacing.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  presetButton: {
    flex: 1,
    padding: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.panelLight,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    ...shadows.sm,
  },
  presetButtonActive: {
    backgroundColor: colors.aluminum,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  presetNumber: {
    fontSize: typography.small,
    color: colors.inkDim,
    fontWeight: '700',
    marginBottom: 2,
  },
  presetNumberActive: {
    color: colors.panel,
  },
  presetName: {
    fontSize: typography.tiny,
    color: colors.inkMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: typography.letterSpacing.loose,
  },
  presetNameActive: {
    color: colors.panel,
    fontWeight: '600',
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xs,
    gap: spacing.xs,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inkDim,
  },
  pageIndicatorActive: {
    backgroundColor: colors.accent,
    width: 12,
  },
});

