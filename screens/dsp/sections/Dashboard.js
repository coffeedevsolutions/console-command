// screens/dsp/sections/Dashboard.js — at-a-glance overview: master output level, the graphic
// EQ (+ EQ presets), and the ESP32 preset slots. Composes the exact same controls as the
// dedicated tabs (reused components), so nothing drifts out of sync.
//
// Layout:
//   portrait  — single centered column: Master → GEQ → Presets.
//   landscape — Master + GEQ stay left-aligned at their normal width; the Preset slots sit
//               in a sidebar to their right (fills the remaining width).
import React from 'react';
import { View, useWindowDimensions, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider } from '../../../components/dsp/Controls';
import PresetSlots from '../../../components/dsp/PresetSlots';
import { RANGE } from '../../../api/dspUnits';
import Geq from './Geq';
import { space } from '../../../theme/tokens';

const MAIN_W = 800; // Master + GEQ column width (matches the other Solo pages)

export default function Dashboard({ st, api, disabled }) {
  const { width, height } = useWindowDimensions();
  const landscape = width > height;

  const master = (
    <Panel label="Master" code={`${st.master}%`} ticks>
      <SchematicSlider
        label="Output Level" value={st.master}
        min={RANGE.master[0]} max={RANGE.master[1]} step={RANGE.master[2]}
        unit="%" disabled={disabled}
        onDragChange={api.setDragging}
        onCommit={(v) => api.setMaster(Math.round(v))}
      />
    </Panel>
  );
  const geq = <Geq st={st} api={api} disabled={disabled} />;
  const presets = <PresetSlots api={api} disabled={disabled} />;

  if (landscape) {
    return (
      <View style={styles.row}>
        <View style={styles.mainCol}>
          {master}
          {geq}
        </View>
        <View style={styles.sideCol}>
          {presets}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {master}
      {geq}
      {presets}
    </View>
  );
}

const styles = StyleSheet.create({
  // portrait: single centered column
  stack: { width: '100%', maxWidth: MAIN_W, alignSelf: 'center', gap: space.md },
  // landscape: left-aligned main column + right sidebar (not centered)
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  mainCol: { flexGrow: 0, flexShrink: 1, flexBasis: MAIN_W, minWidth: 0, gap: space.md },
  sideCol: { flexGrow: 1, flexShrink: 1, flexBasis: 240, minWidth: 200 },
});
