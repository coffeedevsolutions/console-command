// components/ui/TransportIcons.js
// Flat, geometric transport glyphs drawn in SVG so they match the schematic /
// neo-brutalist aesthetic (no emoji). Each takes { size, color }.
import Svg, { Polygon, Rect } from 'react-native-svg';

export function PlayIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="7,5 19,12 7,19" fill={color} />
    </Svg>
  );
}

export function PauseIcon({ size = 22, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6" y="5" width="4" height="14" fill={color} />
      <Rect x="14" y="5" width="4" height="14" fill={color} />
    </Svg>
  );
}

export function PrevIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="5" y="5" width="3" height="14" fill={color} />
      <Polygon points="20,5 10,12 20,19" fill={color} />
    </Svg>
  );
}

export function NextIcon({ size = 20, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polygon points="4,5 14,12 4,19" fill={color} />
      <Rect x="16" y="5" width="3" height="14" fill={color} />
    </Svg>
  );
}
