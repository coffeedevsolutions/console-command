// components/ui/Panel.js
// Flat neo-brutalist container: sharp corners, hairline border, no shadow/gradient.
// Optional mono section label + right-aligned technical `code`, and optional corner
// registration ticks. This is the shared section frame the whole UI is built from.
import { View, Text, StyleSheet } from 'react-native';
import { color, radius, border, space, type } from '../../theme/tokens';

// `offset` places the L-mark relative to the parent's corner: -1 hugs the border,
// a larger negative value (e.g. -12) makes it float outside.
export function Tick({ corner, offset = -1, size = 10 }) {
  const base = { position: 'absolute', width: size, height: size, borderColor: color.lineStrong, zIndex: 2 };
  const pos = {
    tl: { top: offset, left: offset, borderTopWidth: border.thick, borderLeftWidth: border.thick },
    tr: { top: offset, right: offset, borderTopWidth: border.thick, borderRightWidth: border.thick },
    bl: { bottom: offset, left: offset, borderBottomWidth: border.thick, borderLeftWidth: border.thick },
    br: { bottom: offset, right: offset, borderBottomWidth: border.thick, borderRightWidth: border.thick },
  }[corner];
  return <View pointerEvents="none" style={[base, pos]} />;
}

export default function Panel({
  label,
  code,
  ticks = false,
  bare = false,        // no border/background — just structure (used for the hero)
  style,
  contentStyle,
  children,
}) {
  return (
    <View style={[bare ? styles.bare : styles.panel, style]}>
      {ticks && (
        <>
          <Tick corner="tl" />
          <Tick corner="tr" />
          <Tick corner="bl" />
          <Tick corner="br" />
        </>
      )}
      {(label || code) && (
        <View style={styles.head}>
          {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : <View />}
          {code ? <Text style={styles.code}>{code}</Text> : null}
        </View>
      )}
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: color.panel,
    borderWidth: border.hair,
    borderColor: color.line,
    borderRadius: radius.none,
    padding: space.lg,
  },
  bare: { padding: 0 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  label: { ...type.tag, color: color.textMid },
  code: { ...type.meta, color: color.textLow },

  tick: { position: 'absolute', width: 10, height: 10, borderColor: color.lineStrong, zIndex: 2 },
  tl: { top: -1, left: -1, borderTopWidth: border.thick, borderLeftWidth: border.thick },
  tr: { top: -1, right: -1, borderTopWidth: border.thick, borderRightWidth: border.thick },
  bl: { bottom: -1, left: -1, borderBottomWidth: border.thick, borderLeftWidth: border.thick },
  br: { bottom: -1, right: -1, borderBottomWidth: border.thick, borderRightWidth: border.thick },
});
