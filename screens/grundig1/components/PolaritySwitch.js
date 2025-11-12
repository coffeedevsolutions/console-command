import React from 'react';
import RockerSwitch from './RockerSwitch';

export default function PolaritySwitch({ value, onChange, label = 'Polarity' }) {
  return (
    <RockerSwitch
      value={value}
      onChange={onChange}
      leftLabel="0°"
      rightLabel="180°"
      label={label}
    />
  );
}

