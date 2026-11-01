import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { C } from '../theme';

export function Cover({ uri, style, dim }: { uri: string | null; style?: StyleProp<ImageStyle>; dim?: boolean }) {
  return (
    <Image
      source={uri ? { uri } : undefined}
      style={[{ backgroundColor: C.card2, borderRadius: 6 }, style, dim && { opacity: 0.4 }]}
      cachePolicy="disk"
      contentFit="cover"
      transition={150}
    />
  );
}

export function Chip({ label, onPress, active, icon, color }: {
  label: string; onPress?: () => void; active?: boolean; icon?: keyof typeof Ionicons.glyphMap; color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, active && { backgroundColor: C.accent, borderColor: C.accent }, color ? { borderColor: color } : null]}
    >
      {icon && <Ionicons name={icon} size={13} color={active ? '#fff' : color ?? C.dim} style={{ marginRight: 4 }} />}
      <Text style={[s.chipT, active && { color: '#fff' }, color ? { color } : null]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

export function Btn({ label, onPress, icon, kind = 'default', style }: {
  label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap;
  kind?: 'default' | 'primary' | 'amber' | 'green' | 'danger'; style?: ViewStyle;
}) {
  const bg = { default: C.card2, primary: C.accent, amber: C.amber, green: C.green, danger: C.red }[kind];
  const fg = kind === 'amber' || kind === 'green' ? '#111' : '#fff';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: pressed ? 0.7 : 1 }, style]}>
      {icon && <Ionicons name={icon} size={18} color={fg} style={{ marginRight: 6 }} />}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({ value, color = C.accent }: { value: number; color?: string }) {
  return (
    <View style={s.track}>
      <View style={[s.fill, { width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }]} />
    </View>
  );
}

export const Empty = ({ text }: { text: string }) => (
  <View style={{ padding: 40, alignItems: 'center' }}>
    <Text style={{ color: C.dim, textAlign: 'center' }}>{text}</Text>
  </View>
);

export const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', marginTop: 16, marginBottom: 8, paddingHorizontal: 12 }}>
    {children}
  </Text>
);

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.border, backgroundColor: C.card,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, marginBottom: 6, maxWidth: 260,
  },
  chipT: { color: C.dim, fontSize: 13, fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
  track: { height: 5, borderRadius: 3, backgroundColor: C.card2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
