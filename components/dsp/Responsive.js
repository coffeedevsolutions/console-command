// components/dsp/Responsive.js
// Orientation-aware layout wrappers for the DSP console sections, so every page looks
// intentional in both portrait and landscape instead of stretching edge-to-edge.
//
//  <Solo>  — one centered column capped to a readable width. For sections dominated by a
//            single panel or a wide fader bank (a slider stretched across a landscape iPad
//            looks bad; capping keeps it comfortable).
//  <Grid>  — one column in portrait, two in landscape. For sections that are a stack of
//            similar control panels — uses the landscape width instead of a tall thin column.
import React from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import { space } from '../../theme/tokens';

const SOLO_MAX = 800;   // comfortable single-column measure (≈ full width on iPad portrait)
const GRID_MAX = 1120;  // cap the two-column grid so it doesn't sprawl on very wide screens

export function Solo({ children }) {
  return <View style={styles.solo}>{children}</View>;
}

export function Grid({ children }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;
  if (!landscape) return <View style={styles.col}>{children}</View>;
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.grid}>
      {items.map((child, i) => (
        <View key={i} style={styles.cell}>{child}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  solo: { width: '100%', maxWidth: SOLO_MAX, alignSelf: 'center', gap: space.md },
  col: { gap: space.md },
  grid: {
    width: '100%', maxWidth: GRID_MAX, alignSelf: 'center',
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: space.md,
  },
  // flexBasis < 50% + gap → two per row; flexGrow lets a lone item fill the row.
  cell: { flexGrow: 1, flexBasis: '46%', minWidth: 300 },
});
