// screens/dsp/sections/Channel.js — per-channel crossover + limiter + delay
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Panel from '../../../components/ui/Panel';
import { SchematicSlider, Segmented, Toggle, Field } from '../../../components/dsp/Controls';
import { Grid } from '../../../components/dsp/Responsive';
import { RANGE, SLOPES, fmtHz, fmtDb, labelFor } from '../../../api/dspUnits';
import { color, space, type } from '../../../theme/tokens';

const CHANNELS = [0, 1, 2, 3].map((v) => ({ v, label: `CH${v + 1}` }));

export default function Channel({ st, api, disabled }) {
  const [ch, setCh] = useState(0);
  const o = st.outputs[ch];
  const limOff = o.limiter.thresholdDb >= 0;

  return (
    <Grid>
      <Panel label="Channel Select" code={`EDITING CH${ch + 1}`}>
        <Segmented options={CHANNELS} value={ch} onChange={setCh} />
      </Panel>

      {/* CROSSOVER */}
      <Panel label="Crossover" code={`HPF ${labelFor(SLOPES, o.xo.hpfType)} · LPF ${labelFor(SLOPES, o.xo.lpfType)}`} contentStyle={styles.stack}>
        <SchematicSlider
          label="HPF Freq" value={o.xo.hpfHz}
          min={RANGE.xoFreq[0]} max={RANGE.xoFreq[1]} step={RANGE.xoFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { xo: { hpfHz: Math.round(v) } })}
        />
        <Field label="HPF Slope" code="dB/oct · CAL(C6)">
          <Segmented options={SLOPES} value={o.xo.hpfType} disabled={disabled}
            onChange={(v) => api.setOutput(ch, { xo: { hpfType: v } })} />
        </Field>
        <SchematicSlider
          label="LPF Freq" value={o.xo.lpfHz}
          min={RANGE.xoFreq[0]} max={RANGE.xoFreq[1]} step={RANGE.xoFreq[2]}
          format={(v) => `${fmtHz(v)} Hz`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { xo: { lpfHz: Math.round(v) } })}
        />
        <Field label="LPF Slope" code="dB/oct · CAL(C6)">
          <Segmented options={SLOPES} value={o.xo.lpfType} disabled={disabled}
            onChange={(v) => api.setOutput(ch, { xo: { lpfType: v } })} />
        </Field>
      </Panel>

      {/* LIMITER */}
      <Panel label="Limiter" code={limOff ? 'OFF (thr 0 dB)' : 'ACTIVE'} contentStyle={styles.stack}>
        <SchematicSlider
          label="Threshold" value={o.limiter.thresholdDb}
          min={RANGE.limThresh[0]} max={RANGE.limThresh[1]} step={RANGE.limThresh[2]}
          format={(v) => (v >= 0 ? 'OFF' : `${fmtDb(v)} dB`)} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { limiter: { thresholdDb: Math.round(v) } })}
        />
        <SchematicSlider
          label="Attack" value={o.limiter.attack}
          min={RANGE.limAttack[0]} max={RANGE.limAttack[1]} step={RANGE.limAttack[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled || limOff}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { limiter: { attack: Math.round(v) } })}
        />
        <SchematicSlider
          label="Release" value={o.limiter.release}
          min={RANGE.limRelease[0]} max={RANGE.limRelease[1]} step={RANGE.limRelease[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled || limOff}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { limiter: { release: Math.round(v) } })}
        />
        <Field label="Auto Limiter">
          <Toggle value={!!o.limiter.auto} disabled={disabled || limOff}
            onChange={(v) => api.setOutput(ch, { limiter: { auto: v } })} />
        </Field>
      </Panel>

      {/* DELAY */}
      <Panel label="Delay" code="CAL(C1) raw units">
        <SchematicSlider
          label="Time Align" value={o.delay}
          min={RANGE.delay[0]} max={RANGE.delay[1]} step={RANGE.delay[2]}
          format={(v) => `${Math.round(v)}`} disabled={disabled}
          onDragChange={api.setDragging}
          onCommit={(v) => api.setOutput(ch, { delay: Math.round(v) })}
        />
      </Panel>

      <Text style={styles.note}>
        Crossover slope "OFF" bypasses that filter. Limiter threshold at 0 dB = disabled;
        attack/release units and slope enum resolve on the hardware calibration pass.
      </Text>
    </Grid>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  stack: { gap: space.sm },
  note: { ...type.meta, color: color.textLow, lineHeight: 16 },
});
