// components/ui/Reveal.js
// Wraps a section so it slides up from below into its resting place when `play`
// turns true. Give each sibling an increasing `index` for a staggered, overlapping
// cascade (multiple in motion at once, but starting one after another).
import { useEffect } from 'react';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';

export default function Reveal({
  index = 0,
  play,
  stagger = 85,
  distance = 46,
  duration = 520,
  style,
  children,
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    if (play) {
      p.value = withDelay(index * stagger, withTiming(1, {
        duration,
        easing: Easing.out(Easing.cubic),
      }));
    }
  }, [play, index, stagger, duration, p]);

  const aStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * distance }],
  }));

  return <Animated.View style={[style, aStyle]}>{children}</Animated.View>;
}
