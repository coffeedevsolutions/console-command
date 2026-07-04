// components/ui/AppIntro.js
// Launch sequence, rendered as a full-screen overlay on the schematic grid:
//   1. wireframe fades in (large, upper third)
//   2. a technical loading bar fades in beneath it, then fills
//   3. the wireframe flies/scales down to its header resting spot (targetFrame),
//      the splash chrome (grid + bar) fades out, and onReveal fires so the page
//      content can cascade up underneath. onFinish fires when it's done.
// All Reanimated → ships over the air.
import { useEffect } from 'react';
import { Image, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing, runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming,
} from 'react-native-reanimated';
import DottedGrid from './DottedGrid';
import { color, font, border } from '../../theme/tokens';

const CONSOLE_IMG = require('../../assets/images/grundig-ks-680-wireframe-partial-open.png');
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Timings (ms) — tune here.
const IMG_FADE = 650;
const BAR_FADE_DELAY = 520;
const BAR_FADE = 400;
const FILL_DELAY = 980;
const FILL_DUR = 1100;
const HOLD = 200;                                       // brief pause at 100%
const TRANSITION_DELAY = FILL_DELAY + FILL_DUR + HOLD;  // ~2.28s
const TRANSITION_DUR = 720;

const SPLASH_SCALE = 1.55;

export default function AppIntro({ targetFrame, onReveal, onFinish }) {
  const { width: W, height: H } = useWindowDimensions();

  const imgOpacity = useSharedValue(0);
  const barOpacity = useSharedValue(0);
  const fill = useSharedValue(0);
  const transition = useSharedValue(0); // 0 = splash pose, 1 = landed on target
  const chrome = useSharedValue(1);     // grid + loading bar opacity

  // Wireframe: base layout IS the target frame; a transform flies it out to the
  // splash pose (scaled up, centered in the upper third) and back down to target.
  const tCx = targetFrame.x + targetFrame.width / 2;
  const tCy = targetFrame.y + targetFrame.height / 2;
  const dx0 = W / 2 - tCx;
  const dy0 = H * 0.34 - tCy;

  // Loading bar sits under the splashed (scaled) wireframe.
  const splashImgH = targetFrame.height * SPLASH_SCALE;
  const barTop = H * 0.34 + splashImgH / 2 + 30;
  const barWidth = Math.min(W * 0.62, 340);
  const fillMax = barWidth - 2 * border.thick;

  useEffect(() => {
    imgOpacity.value = withTiming(1, { duration: IMG_FADE, easing: Easing.out(Easing.quad) });
    barOpacity.value = withDelay(BAR_FADE_DELAY, withTiming(1, { duration: BAR_FADE }));
    fill.value = withDelay(FILL_DELAY, withTiming(1, { duration: FILL_DUR, easing: Easing.inOut(Easing.cubic) }));
    chrome.value = withDelay(TRANSITION_DELAY, withTiming(0, { duration: TRANSITION_DUR, easing: Easing.inOut(Easing.quad) }));
    transition.value = withDelay(TRANSITION_DELAY, withTiming(
      1,
      { duration: TRANSITION_DUR, easing: Easing.inOut(Easing.cubic) },
      (finished) => {
        if (finished) {
          // Only once the wireframe has fully settled in its header spot: start the
          // content cascade, then remove this overlay.
          runOnJS(onReveal)();
          runOnJS(onFinish)();
        }
      },
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const imgStyle = useAnimatedStyle(() => {
    const s = 1 - transition.value;
    return {
      opacity: imgOpacity.value,
      transform: [
        { translateX: dx0 * s },
        { translateY: dy0 * s },
        { scale: 1 + (SPLASH_SCALE - 1) * s },
      ],
    };
  });

  const gridStyle = useAnimatedStyle(() => ({ opacity: chrome.value }));
  const barStyle = useAnimatedStyle(() => ({ opacity: barOpacity.value * chrome.value }));
  const fillStyle = useAnimatedStyle(() => ({ width: fill.value * fillMax }));
  const pctProps = useAnimatedProps(() => ({ text: `${Math.round(fill.value * 100)}%`, defaultValue: '0%' }));

  return (
    <View style={styles.root} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, gridStyle]}>
        <DottedGrid />
      </Animated.View>

      <Animated.Image
        source={CONSOLE_IMG}
        resizeMode="contain"
        style={[
          { position: 'absolute', left: targetFrame.x, top: targetFrame.y, width: targetFrame.width, height: targetFrame.height },
          imgStyle,
        ]}
      />

      <Animated.View style={[{ position: 'absolute', top: barTop, left: (W - barWidth) / 2, width: barWidth }, barStyle]}>
        <View style={styles.barHead}>
          <Text style={styles.barLabel}>INITIALIZING</Text>
          <AnimatedTextInput
            editable={false}
            underlineColorAndroid="transparent"
            style={styles.barPct}
            animatedProps={pctProps}
          />
        </View>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
        <View style={styles.ticks}>
          {Array.from({ length: 11 }).map((_, i) => <View key={i} style={styles.tick} />)}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 100, backgroundColor: color.bg },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 },
  barLabel: { fontFamily: font.mono, fontSize: 11, letterSpacing: 3, color: color.textMid },
  barPct: { fontFamily: font.mono, fontSize: 12, letterSpacing: 1, color: color.accent, padding: 0, margin: 0, minWidth: 46, textAlign: 'right' },
  track: { height: 8, borderWidth: border.thick, borderColor: color.lineStrong, backgroundColor: color.bgSunken, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: color.accent },
  ticks: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  tick: { width: 1, height: 4, backgroundColor: color.line },
});
