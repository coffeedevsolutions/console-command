import React, { useState, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import Fader from './Fader';
import { spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

// Standard 15-band graphic EQ frequencies (Hz) - 1/3 octave spacing
const BAND_FREQS = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000];
const SLIDERS_PER_PAGE = 3;
const TOTAL_PAGES = Math.ceil(BAND_FREQS.length / SLIDERS_PER_PAGE);

export default function FaderBank() {
  const { state, dispatch, actions } = useGrundig1Store();
  const [containerHeight, setContainerHeight] = useState(300);
  const [containerWidth, setContainerWidth] = useState(Dimensions.get('window').width);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const scrollViewRef = useRef(null);

  const handleBandChange = (bandIndex, value) => {
    dispatch({
      type: actions.SET_GRAPHIC_EQ_BAND,
      band: bandIndex,
      value,
    });
  };

  const formatFreq = (freq) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k`;
    }
    return `${freq}`;
  };

  // Get bands for current page
  const getBandsForPage = (page) => {
    const start = page * SLIDERS_PER_PAGE;
    const end = Math.min(start + SLIDERS_PER_PAGE, BAND_FREQS.length);
    return Array.from({ length: end - start }, (_, i) => start + i);
  };

  const handleScroll = (event) => {
    if (containerWidth === 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / containerWidth);
    if (page >= 0 && page < TOTAL_PAGES) {
      setCurrentPage(page);
    }
  };

  return (
    <View 
      style={styles.container}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && width !== containerWidth) {
          setContainerWidth(width);
        }
        if (height > 0) {
          // Account for padding and label space
          const availableHeight = height - (spacing.md * 2) - 25; // 25px for label + spacing
          if (availableHeight > 0 && availableHeight !== containerHeight) {
            setContainerHeight(availableHeight);
          }
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
        scrollEnabled={!isDragging}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {containerWidth > 0 && Array.from({ length: TOTAL_PAGES }).map((_, pageIndex) => (
          <View key={pageIndex} style={[styles.page, { width: containerWidth }]}>
            <View style={styles.fadersRow}>
              {getBandsForPage(pageIndex).map((bandIndex) => {
                const freq = BAND_FREQS[bandIndex];
                return (
                  <Fader
                    key={bandIndex}
                    value={state.input.graphicEq[bandIndex]}
                    onChange={(v) => handleBandChange(bandIndex, v)}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                    min={-12}
                    max={12}
                    step={0.5}
                    defaultValue={0}
                    label={formatFreq(freq)}
                    unit="dB"
                    marks={true}
                    showValue={true}
                    height={containerHeight}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
      
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
    flex: 1,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexDirection: 'row',
  },
  page: {
    height: '100%',
    justifyContent: 'center',
  },
  fadersRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  pageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  pageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#5a6169',
  },
  pageIndicatorActive: {
    backgroundColor: '#cfe6ff',
    width: 12,
  },
});

