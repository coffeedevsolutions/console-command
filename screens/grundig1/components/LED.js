import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, shadows } from '../theme';

export default function LED({ on = false, color = colors.ledGreen, size = 8 }) {
  return (
    <View
      style={[
        styles.led,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: on ? color : colors.ledOff,
        },
        on && shadows.glow(color),
      ]}
    />
  );
}

const styles = StyleSheet.create({
  led: {
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.3)',
  },
});

