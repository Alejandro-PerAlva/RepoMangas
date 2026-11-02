import React from 'react';
import { FlatList, Modal, TextInput, ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8, maxWidth: 260,
  },
  chipT: { color: C.dim, fontSize: 13, fontWeight: '600' },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10 },
  track: { height: 5, borderRadius: 3, backgroundColor: C.card2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});

export const statusColor = (s: string | null) =>
  s === 'Abierta' ? C.green : s === 'Cerrada' ? C.accent : s === 'Cancelada' ? C.red : s === 'Pausada' ? C.amber : C.dim;

/** "España · Abierta · 22" style pill */
export function StatusPill({ region, status, count }: { region: string; status: string | null; count: number | null }) {
  const col = statusColor(status);
  return (
    <View style={{ borderWidth: 1, borderColor: col, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginRight: 8 }}>
      <Text style={{ color: C.dim, fontSize: 10, fontWeight: '700' }}>{region.toUpperCase()}</Text>
      <Text style={{ color: col, fontSize: 13, fontWeight: '800' }}>
        {status ?? 'n/d'}{count != null ? ` · ${count} ${count === 1 ? 'tomo' : 'tomos'}` : ''}
      </Text>
    </View>
  );
}

export interface Opt { key: string; label: string }

/** Bottom-sheet single-choice picker with optional (remote) search. Safe for Android nav bars. */
export function PickerModal({ visible, title, options, selected, onSelect, onClose, searchable, loading, onQuery, allLabel = 'Todos' }: {
  visible: boolean; title: string; options: Opt[]; selected: string | null;
  onSelect: (k: string | null) => void; onClose: () => void;
  searchable?: boolean; loading?: boolean; onQuery?: (q: string) => void; allLabel?: string | null;
}) {
  const [q, setQ] = React.useState('');
  React.useEffect(() => { if (!visible) setQ(''); }, [visible]);
  React.useEffect(() => { if (visible && onQuery) onQuery(q); }, [q, visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const insets = useSafeAreaInsets();
  const list = React.useMemo(() => {
    const t = q.trim().toLowerCase();
    const f = t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
    return f.slice(0, 300);
  }, [options, q]);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: '#000B' }} onPress={onClose} />
      <View style={[p.sheet, { paddingBottom: 12 + insets.bottom }]}>
        <View style={p.head}>
          <Text style={p.title} numberOfLines={1}>{title}</Text>
          {loading ? <ActivityIndicator color={C.accent} style={{ marginRight: 12 }} /> : null}
          <Pressable onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={C.dim} /></Pressable>
        </View>
        {searchable && (
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" placeholderTextColor={C.dim} autoCorrect={false}
            style={p.search} />
        )}
        <FlatList
          data={allLabel ? [{ key: '__all', label: allLabel }, ...list] : list}
          keyExtractor={(o) => o.key}
          keyboardShouldPersistTaps="handled"
          style={{ flexGrow: 0 }}
          renderItem={({ item }) => {
            const on = item.key === '__all' ? selected == null : selected === item.key;
            return (
              <Pressable onPress={() => { onSelect(item.key === '__all' ? null : item.key); onClose(); }} style={[p.row, on && { backgroundColor: C.card2 }]}>
                <Text style={[p.rowT, on && { color: C.accent, fontWeight: '800' }]} numberOfLines={2}>{item.label}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={C.accent} /> : null}
              </Pressable>
            );
          }}
          ListEmptyComponent={<Text style={{ color: C.dim, padding: 20, textAlign: 'center' }}>{loading ? 'Buscando…' : 'Sin resultados'}</Text>}
        />
      </View>
    </Modal>
  );
}

const p = StyleSheet.create({
  sheet: { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '78%', paddingTop: 14, paddingHorizontal: 12 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, marginBottom: 10 },
  title: { flex: 1, color: C.text, fontSize: 17, fontWeight: '800' },
  search: { backgroundColor: C.card2, color: C.text, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 12, borderRadius: 8 },
  rowT: { flex: 1, color: C.text, fontSize: 15 },
});
