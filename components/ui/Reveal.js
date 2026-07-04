// components/ui/Reveal.js
// Slides its children up from below into place, fading in, when it MOUNTS.
// Mount it (conditionally) at the moment you want the cascade to start, and give
// each sibling an increasing `index` for a staggered, overlapping reveal.
import { useEffect } from 'react';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';

export default function Reveal({
  index = 0,
  stagger = 90,
  distance = 48,
  duration = 520,
  style,
  children,
}) {
  const p = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(index * stagger, withTiming(1, {
      duration,
      easing: Easing.out(Easing.cubic),
    }));
    // Animate once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * distance }],
  }));

  return <Animated.View style={[style, aStyle]}>{children}</Animated.View>;
}
