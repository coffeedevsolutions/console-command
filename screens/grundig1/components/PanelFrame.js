import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, shadows } from '../theme';

export default function PanelFrame({ children, style }) {
  return (
    <View style={[styles.frame, style]}>
      <LinearGradient
        colors={[colors.panel, colors.panelAlt, colors.panel]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.border}>
          {/* Corner screws */}
          <View style={[styles.screw, styles.screwTL]} />
          <View style={[styles.screw, styles.screwTR]} />
          <View style={[styles.screw, styles.screwBL]} />
          <View style={[styles.screw, styles.screwBR]} />
          
          <View style={styles.content}>{children}</View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  border: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.aluminum,
    borderRadius: 4,
    padding: spacing.md,
  },
  content: {
    flex: 1,
  },
  screw: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.aluminumDark,
    borderWidth: 1,
    borderColor: colors.inkDim,
  },
  screwTL: { top: 6, left: 6 },
  screwTR: { top: 6, right: 6 },
  screwBL: { bottom: 6, left: 6 },
  screwBR: { bottom: 6, right: 6 },
});

