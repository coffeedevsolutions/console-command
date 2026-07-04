// components/ui/DottedGrid.js
// Full-bleed "blueprint" field — a muted dotted grid that sits fixed behind the page.
// Drawn once with an SVG pattern (cheap, scales to any screen). Non-interactive.
import { StyleSheet } from 'react-native';
import { useWindowDimensions } from 'react-native';
import Svg, { Defs, Pattern, Circle, Rect, Line, G } from 'react-native-svg';
import { color } from '../../theme/tokens';

export default function DottedGrid({ gap = 24, dot = 1.1, crosshair = true }) {
  const { width, height } = useWindowDimensions();
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <Pattern id="dots" x="0" y="0" width={gap} height={gap} patternUnits="userSpaceOnUse">
          {crosshair && (
            <G stroke={color.gridDot} strokeWidth={0.5}>
              <Line x1={gap / 2} y1={gap / 2 - 2.5} x2={gap / 2} y2={gap / 2 + 2.5} />
              <Line x1={gap / 2 - 2.5} y1={gap / 2} x2={gap / 2 + 2.5} y2={gap / 2} />
            </G>
          )}
          <Circle cx={gap / 2} cy={gap / 2} r={dot} fill={color.gridDot} />
        </Pattern>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={color.bg} />
      <Rect x="0" y="0" width={width} height={height} fill="url(#dots)" />
    </Svg>
  );
}
