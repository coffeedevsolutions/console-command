// components/dsp/Controls.js
// Schematic × neo-brutalist control primitives for the DSP dashboard. Flat fills,
// hard edges, hairline/structural borders, one orange accent — all from theme/tokens.
// Every control is memoized and pushes on release (never per frame).
import React, { memo, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { color, radius, border, space, type } from '../../theme/tokens';

// ---- labeled horizontal slider ----------------------------------------
// Local drag state so the thumb is smooth; commits once on release.
function SchematicSliderBase({
  label, code, value, min, max, step = 1, unit,
  format, onCommit, onDragChange, disabled, accent = true, liveMs = 0,
}) {
  const [local, setLocal] = useState(value);
  const holding = useRef(false);
  const lastLive = useRef(0);
  useEffect(() => { if (!holding.current) setLocal(value); }, [value]);

  const show = format ? format(local) : `${local}${unit || ''}`;
  return (
    <View style={styles.sRow}>
      <View style={styles.sHead}>
        <Text style={styles.sLabel}>{label}</Text>
        {code ? <Text style={styles.sCode}>{code}</Text> : null}
        <Text style={[styles.sVal, accent && { color: color.accent }]}>{show}</Text>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={value}
        disabled={disabled}
        onValueChange={(v) => {
          holding.current = true; setLocal(v); onDragChange && onDragChange(true);
          // Live push while dragging, throttled (firmware coalesces master writes).
          if (liveMs && onCommit) {
            const t = Date.now();
            if (t - lastLive.current >= liveMs) { lastLive.current = t; onCommit(v); }
          }
        }}
        onSlidingComplete={(v) => {
          holding.current = false; onDragChange && onDragChange(false);
          setLocal(v); onCommit && onCommit(v);
        }}
        minimumTrackTintColor={disabled ? color.lineStrong : color.accent}
        maximumTrackTintColor={color.lineStrong}
        thumbTintColor={disabled ? color.textLow : color.textHi}
      />
    </View>
  );
}
export const SchematicSlider = memo(SchematicSliderBase);

// ---- segmented selector (route / slope / polarity / channel / tabs) ----
function SegmentedBase({ options, value, onChange, disabled, compact }) {
  return (
    <View style={styles.seg}>
      {options.map((o) => {
        const active = o.v === value;
        return (
          <Pressable
            key={String(o.v)}
            disabled={disabled}
            onPress={() => !active && onChange(o.v)}
            style={[
              styles.segCell,
              compact && styles.segCellCompact,
              active ? styles.segOn : styles.segOff,
              disabled && !active && { opacity: 0.4 },
            ]}
          >
            <Text style={[styles.segTxt, active && { color: color.accentInk }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
export const Segmented = memo(SegmentedBase);

// ---- on/off toggle (schematic pill, not the iOS switch) ----------------
function ToggleBase({ label, value, onChange, disabled, onLabel = 'ON', offLabel = 'OFF' }) {
  return (
    <View style={styles.tgRow}>
      {label ? <Text style={styles.tgLabel}>{label}</Text> : null}
      <Pressable
        disabled={disabled}
        onPress={() => onChange(!value)}
        style={[styles.tg, value ? styles.tgOn : styles.tgOff, disabled && { opacity: 0.4 }]}
      >
        <View style={[styles.tgDot, { backgroundColor: value ? color.accentInk : color.textLow }]} />
        <Text style={[styles.tgTxt, value && { color: color.accentInk }]}>{value ? onLabel : offLabel}</Text>
      </Pressable>
    </View>
  );
}
export const Toggle = memo(ToggleBase);

// ---- small labeled field wrapper --------------------------------------
export const Field = memo(function Field({ label, code, children }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {code ? <Text style={styles.fieldCode}>{code}</Text> : null}
      </View>
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  // slider
  sRow: { gap: space.xs, paddingVertical: space.xs },
  sHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sLabel: { ...type.meta, color: color.textMid, textTransform: 'uppercase' },
  sCode: { ...type.meta, color: color.textLow },
  sVal: { ...type.meta, color: color.textHi, marginLeft: 'auto', fontSize: 12 },
  slider: { width: '100%', height: 34 },

  // segmented
  seg: { flexDirection: 'row', gap: 0, borderWidth: border.thick, borderColor: color.lineStrong, borderRadius: radius.none },
  segCell: { flex: 1, paddingVertical: space.sm, alignItems: 'center', justifyContent: 'center', borderRightWidth: border.hair, borderColor: color.lineStrong },
  segCellCompact: { paddingVertical: space.xs },
  segOn: { backgroundColor: color.accent },
  segOff: { backgroundColor: color.bgSunken },
  segTxt: { ...type.meta, color: color.textMid, letterSpacing: 1 },

  // toggle
  tgRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tgLabel: { ...type.meta, color: color.textMid, textTransform: 'uppercase' },
  tg: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginLeft: 'auto', paddingVertical: space.xs, paddingHorizontal: space.md, borderWidth: border.thick, borderRadius: radius.none, minWidth: 74, justifyContent: 'center' },
  tgOn: { backgroundColor: color.accent, borderColor: color.accent },
  tgOff: { backgroundColor: color.bgSunken, borderColor: color.lineStrong },
  tgDot: { width: 8, height: 8 },
  tgTxt: { ...type.tag, fontSize: 11, color: color.textMid },

  // field
  field: { gap: space.sm, paddingVertical: space.sm, borderTopWidth: border.hair, borderColor: color.line },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { ...type.tag, fontSize: 11, color: color.textMid },
  fieldCode: { ...type.meta, color: color.textLow },
});
