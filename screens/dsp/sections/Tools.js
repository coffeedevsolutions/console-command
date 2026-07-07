// screens/dsp/sections/Tools.js — signal generators (tone / sweep / pink)
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider, Toggle, Field } from '../../../components/dsp/Controls';
import { RANGE, fmtHz } from '../../../api/dspUnits';
import { color, space, type } from '../../../theme/tokens';

export default function Tools({ st, api, disabled }) {
  const { tone, sweep, pink } = st.gen;
  return (
    <View style={styles.wrap}>
      <Panel label="Tone Generator" code={tone.on ? 'ON' : 'OFF'} ticks contentStyle={styles.stack}>
        <Field label="Enable">
          <Toggle value={!!tone.on} disabled={disabled} onChange={(v) => api.setGen('tone', { on: v })} />
        </Field>
        <SchematicSlider label="Frequency" value={tone.freqHz}
          min={RANGE.genFreq[0]} max={RANGE.genFreq[1]} step={RANGE.genFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('tone', { freqHz: Math.round(v) })} />
        <SchematicSlider label="Level" value={tone.gain} code="CAL(C4)"
          min={RANGE.genGain[0]} max={RANGE.genGain[1]} step={RANGE.genGain[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('tone', { gain: Math.round(v) })} />
      </Panel>

      <Panel label="Sweep Generator" code={sweep.on ? 'ON' : 'OFF'} contentStyle={styles.stack}>
        <Field label="Enable">
          <Toggle value={!!sweep.on} disabled={disabled} onChange={(v) => api.setGen('sweep', { on: v })} />
        </Field>
        <SchematicSlider label="Start" value={sweep.startHz}
          min={RANGE.genFreq[0]} max={RANGE.genFreq[1]} step={RANGE.genFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('sweep', { startHz: Math.round(v) })} />
        <SchematicSlider label="End" value={sweep.endHz}
          min={RANGE.genFreq[0]} max={RANGE.genFreq[1]} step={RANGE.genFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('sweep', { endHz: Math.round(v) })} />
        <SchematicSlider label="Level" value={sweep.gain} code="CAL(C4)"
          min={RANGE.genGain[0]} max={RANGE.genGain[1]} step={RANGE.genGain[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('sweep', { gain: Math.round(v) })} />
        <SchematicSlider label="Speed" value={sweep.speed}
          min={RANGE.sweepSpeed[0]} max={RANGE.sweepSpeed[1]} step={RANGE.sweepSpeed[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('sweep', { speed: Math.round(v) })} />
      </Panel>

      <Panel label="Pink Noise" code={pink.on ? 'ON' : 'OFF'} contentStyle={styles.stack}>
        <Field label="Enable">
          <Toggle value={!!pink.on} disabled={disabled} onChange={(v) => api.setGen('pink', { on: v })} />
        </Field>
        <SchematicSlider label="Level" value={pink.gain} code="CAL(C4)"
          min={RANGE.genGain[0]} max={RANGE.genGain[1]} step={RANGE.genGain[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setGen('pink', { gain: Math.round(v) })} />
      </Panel>

      <Text style={styles.note}>Generators output test signals through the DSP — keep master low. Level units pending CAL(C4).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  stack: { gap: space.sm },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
