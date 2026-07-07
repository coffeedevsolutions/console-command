// components/dsp/FaderColumn.js
// One vertical fader for the graphic-EQ bank. A community Slider rotated -90°
// (native + performant — no PanResponder); local drag state, commits on release.
// Memoized so a drag on one band never re-renders the other fourteen.
import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { color, border, space, type } from '../../theme/tokens';
import { fmtDb } from '../../api/dspUnits';

const FADER_H = 150;
const COL_W = 46;

function FaderColumnBase({ label, value, min, max, step, onCommit, onDragChange, disabled }) {
  const [local, setLocal] = useState(value);
  const holding = useRef(false);
  useEffect(() => { if (!holding.current) setLocal(value); }, [value]);

  return (
    <View style={styles.col}>
      <Text style={[styles.val, local !== 0 && { color: color.accent }]}>{fmtDb(local)}</Text>
      <View style={styles.track}>
        {/* centre (0 dB) reference line */}
        <View style={styles.zeroLine} pointerEvents="none" />
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          disabled={disabled}
          onValueChange={(v) => { holding.current = true; setLocal(v); onDragChange && onDragChange(true); }}
          onSlidingComplete={(v) => {
            holding.current = false; onDragChange && onDragChange(false);
            setLocal(v); onCommit && onCommit(v);
          }}
          minimumTrackTintColor={color.accent}
          maximumTrackTintColor={color.lineStrong}
          thumbTintColor={disabled ? color.textLow : color.textHi}
        />
      </View>
      <Text style={styles.lbl}>{label}</Text>
    </View>
  );
}

export default memo(FaderColumnBase);

const styles = StyleSheet.create({
  col: { width: COL_W, alignItems: 'center', gap: space.xs },
  val: { ...type.meta, color: color.textMid, fontSize: 10 },
  track: { height: FADER_H, width: COL_W, alignItems: 'center', justifyContent: 'center' },
  zeroLine: { position: 'absolute', width: 18, height: border.hair, backgroundColor: color.line },
  // rotated: the slider's width becomes vertical travel; max ends up at the top.
  slider: { width: FADER_H, height: 28, transform: [{ rotate: '-90deg' }] },
  lbl: { ...type.meta, color: color.textLow, fontSize: 9, letterSpacing: 0.5 },
});
