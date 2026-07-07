// screens/dsp/sections/Peq.js — the DSP's real 5-band parametric EQ (channel-assigned)
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider, Segmented, Field } from '../../../components/dsp/Controls';
import { RANGE, fmtHz, fmtDb } from '../../../api/dspUnits';
import { color, space, type } from '../../../theme/tokens';

const BANDS = [0, 1, 2, 3, 4].map((v) => ({ v, label: `B${v + 1}` }));
const CHANNELS = [0, 1, 2, 3].map((v) => ({ v, label: `CH${v + 1}` }));

export default function Peq({ st, api, disabled }) {
  const [sel, setSel] = useState(0);
  const b = st.peq[sel];

  return (
    <View style={styles.wrap}>
      <Panel label="Parametric EQ" code={`5-BAND · B${sel + 1}`} ticks contentStyle={styles.stack}>
        <Field label="Band">
          <Segmented options={BANDS} value={sel} onChange={setSel} />
        </Field>
        <Field label="Assigned Channel">
          <Segmented options={CHANNELS} value={b.channel} disabled={disabled}
            onChange={(v) => api.setPeq(sel, { channel: v })} />
        </Field>
        <SchematicSlider
          label="Frequency" value={b.freqHz}
          min={RANGE.peqFreq[0]} max={RANGE.peqFreq[1]} step={RANGE.peqFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setPeq(sel, { freqHz: Math.round(v) })}
        />
        <SchematicSlider
          label="Gain" value={b.gainDb}
          min={RANGE.peqGain[0]} max={RANGE.peqGain[1]} step={RANGE.peqGain[2]}
          format={(v) => `${fmtDb(v)} dB`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setPeq(sel, { gainDb: Math.round(v) })}
        />
        <SchematicSlider
          label="Q" value={b.q}
          min={RANGE.peqQ[0]} max={RANGE.peqQ[1]} step={RANGE.peqQ[2]}
          format={(v) => v.toFixed(1)} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setPeq(sel, { q: Math.round(v * 10) / 10 })}
        />
      </Panel>
      <Text style={styles.note}>
        The DSP exposes 5 parametric bands total, each assignable to an output channel — not
        a per-channel bank. Q wire-encoding pending CAL(C3).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  stack: { gap: space.sm },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
