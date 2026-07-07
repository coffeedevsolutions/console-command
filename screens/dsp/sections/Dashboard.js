// screens/dsp/sections/Dashboard.js — at-a-glance overview: master output level, the graphic
// EQ (+ EQ presets), and the ESP32 preset slots, all on one screen. Composes the exact same
// controls as the dedicated tabs (reused components), so nothing drifts out of sync.
import React from 'react';
import { View, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider } from '../../../components/dsp/Controls';
import PresetSlots from '../../../components/dsp/PresetSlots';
import { RANGE } from '../../../api/dspUnits';
import Geq from './Geq';
import { space } from '../../../theme/tokens';

export default function Dashboard({ st, api, disabled }) {
  return (
    <View style={styles.wrap}>
      {/* Master output level */}
      <Panel label="Master" code={`${st.master}%`} ticks>
        <SchematicSlider
          label="Output Level" value={st.master}
          min={RANGE.master[0]} max={RANGE.master[1]} step={RANGE.master[2]}
          unit="%" disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setMaster(Math.round(v))}
        />
      </Panel>

      {/* Graphic EQ + EQ presets (same controls as the GEQ tab) */}
      <Geq st={st} api={api} disabled={disabled} />

      {/* ESP32 preset slots */}
      <PresetSlots api={api} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
});
