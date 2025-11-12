import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import Fader from './Fader';
import { spacing } from '../theme';
import { useGrundig1Store } from '../state/grundig1Store';

const BAND_LABELS = [
  '31', '63', '125', '250', '500',
  '1k', '2k', '4k', '8k', '16k',
  '20', '40', '80', '160', '320',
];

// Standard 15-band frequencies (Hz) - ordered as they appear
const BAND_FREQS = [31, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

export default function FaderBank() {
  const { state, dispatch, actions } = useGrundig1Store();

  const handleBandChange = (band, value) => {
    dispatch({
      type: actions.SET_GRAPHIC_EQ_BAND,
      band,
      value,
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.fadersRow}>
          {state.input.graphicEq.slice(0, 15).map((value, index) => (
            <Fader
              key={index}
              value={value}
              onChange={(v) => handleBandChange(index, v)}
              min={-12}
              max={12}
              step={0.5}
              defaultValue={0}
              label={index < 10 ? BAND_FREQS[index] >= 1000 
                ? `${BAND_FREQS[index] / 1000}k` 
                : `${BAND_FREQS[index]}`
                : BAND_LABELS[index]}
              unit="dB"
              marks={true}
              showValue={true}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  fadersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
});

