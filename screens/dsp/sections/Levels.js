// screens/dsp/sections/Levels.js — master + per-channel gain/mute/polarity/route
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider, Segmented, Toggle, Field } from '../../../components/dsp/Controls';
import { RANGE, ROUTES, POLARITY, fmtDb, labelFor } from '../../../api/dspUnits';
import { color, space, type } from '../../../theme/tokens';

export default function Levels({ st, api, disabled }) {
  return (
    <View style={styles.wrap}>
      <Panel label="Master" code={`${st.master}%`} ticks>
        <SchematicSlider
          label="Output Level" value={st.master}
          min={RANGE.master[0]} max={RANGE.master[1]} step={RANGE.master[2]}
          unit="%" disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setMaster(Math.round(v))}
        />
      </Panel>

      {st.outputs.map((o, i) => (
        <Panel key={o.ch} label={`Channel ${o.ch}`} code={`OUT·${o.ch} → ${labelFor(ROUTES, o.route)}`}>
          <SchematicSlider
            label="Gain" value={o.gainDb}
            min={RANGE.outGain[0]} max={RANGE.outGain[1]} step={RANGE.outGain[2]}
            format={(v) => `${fmtDb(v)} dB`} disabled={disabled || o.mute}
            onDragChange={api.setDragging}
            onCommit={(v) => api.setOutput(i, { gainDb: Math.round(v) })}
          />
          <Field label="Mute">
            <Toggle value={o.mute} disabled={disabled} onChange={(v) => api.setOutput(i, { mute: v })}
              onLabel="MUTED" offLabel="LIVE" />
          </Field>
          <Field label="Polarity">
            <Segmented options={POLARITY} value={o.polarity} disabled={disabled}
              onChange={(v) => api.setOutput(i, { polarity: v })} />
          </Field>
          <Field label="Route" code="INPUT">
            <Segmented options={ROUTES} value={o.route} disabled={disabled}
              onChange={(v) => api.setOutput(i, { route: v })} />
          </Field>
        </Panel>
      ))}
      <Text style={styles.note}>Muting a channel disables its gain fader. Route enum pending CAL(C8).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
