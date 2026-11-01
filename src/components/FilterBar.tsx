import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chip, Btn } from './ui';
import { C } from '../theme';
import {
  DEFAULT_FILTERS, SORT_LABELS, STATE_LABELS, distinct, type CollState, type Filters, type SortKey,
} from '../lib/filters';
import type { EditionSummary } from '../types';

type Dim = 'publisher' | 'author' | 'genre' | 'format' | 'status';
const DIMS: [Dim, string][] = [
  ['publisher', 'Editorial'], ['author', 'Autor'], ['genre', 'Género'], ['format', 'Formato'], ['status', 'Estado de publicación'],
];

export function FilterBar({ filters, onChange, source, showState = true }: {
  filters: Filters; onChange: (f: Filters) => void; source: EditionSummary[]; showState?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const opts = useMemo(() => distinct(source), [source]);
  const active = DIMS.filter(([d]) => filters[d]).length;
  return (
    <View style={{ paddingTop: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        <Chip label={active ? `Filtros (${active})` : 'Filtros'} icon="options" active={active > 0} onPress={() => setOpen(true)} />
        {showState && (Object.keys(STATE_LABELS) as CollState[]).map((k) => (
          <Chip key={k} label={STATE_LABELS[k]} active={filters.state === k} onPress={() => onChange({ ...filters, state: k })} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
          <Chip key={k} label={SORT_LABELS[k]} icon="swap-vertical" active={filters.sort === k} onPress={() => onChange({ ...filters, sort: k })} />
        ))}
      </ScrollView>
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000A' }} onPress={() => setOpen(false)} />
        <View style={{ backgroundColor: C.card, maxHeight: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 }}>
          <ScrollView>
            {DIMS.map(([d, label]) => (
              <View key={d} style={{ marginBottom: 12 }}>
                <Text style={{ color: C.text, fontWeight: '800', marginBottom: 8 }}>{label}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Chip label="Todos" active={!filters[d]} onPress={() => onChange({ ...filters, [d]: null })} />
                  {opts[d].map((o) => (
                    <Chip key={o} label={o} active={filters[d] === o} onPress={() => onChange({ ...filters, [d]: o })} />
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Btn label="Limpiar" icon="close" onPress={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })} style={{ flex: 1 }} />
            <Btn label="Aplicar" kind="primary" icon="checkmark" onPress={() => setOpen(false)} style={{ flex: 1 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
