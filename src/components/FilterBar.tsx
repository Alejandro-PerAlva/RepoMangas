import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Chip, PickerModal, type Opt } from './ui';
import { DEFAULT_FILTERS, SORT_LABELS, STATE_LABELS, distinct, type CollState, type Filters, type SortKey } from '../lib/filters';
import type { EditionSummary } from '../types';

type Dim = 'publisher' | 'author' | 'genre' | 'format' | 'status' | 'sort';
const DIMS: [Dim, string][] = [
  ['publisher', 'Editorial'], ['author', 'Autor'], ['format', 'Formato'], ['status', 'Estado'], ['genre', 'Género'],
];
const rowStyle = { paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' as const };

export function FilterBar({ filters, onChange, source, showState = true, publishers, authors, onSearchAuthors, authorLoading }: {
  filters: Filters; onChange: (f: Filters) => void; source: EditionSummary[]; showState?: boolean;
  publishers?: string[]; authors?: string[];
  onSearchAuthors?: (q: string) => void; authorLoading?: boolean;
}) {
  const [dim, setDim] = useState<Dim | null>(null);
  const local = useMemo(() => distinct(source), [source]);
  const merge = (a: string[], b?: string[]) => [...new Set([...(b ?? []), ...a])].sort((x, y) => x.localeCompare(y, 'es'));
  const opts = (d: Dim): Opt[] => {
    if (d === 'sort') return (Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ key: k, label: SORT_LABELS[k] }));
    const base = d === 'publisher' ? merge(local.publisher, publishers) : d === 'author' ? merge(local.author, authors) : local[d];
    return base.map((o) => ({ key: o, label: o }));
  };
  const active = DIMS.filter(([d]) => filters[d]).length;
  const clearAll = () => onChange({ ...DEFAULT_FILTERS, sort: filters.sort, state: filters.state });
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rowStyle}>
        {DIMS.map(([d, label]) => (
          <Chip key={d} label={filters[d] ? `${label}: ${filters[d]}` : label} active={!!filters[d]}
            icon={filters[d] ? 'checkmark' : 'chevron-down'} onPress={() => setDim(d)} />
        ))}
        {active > 0 && <Chip label="Limpiar" icon="close" onPress={clearAll} />}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rowStyle}>
        <Chip label={`Orden: ${SORT_LABELS[filters.sort]}`} icon="swap-vertical" onPress={() => setDim('sort')} />
        {showState && (Object.keys(STATE_LABELS) as CollState[]).map((k) => (
          <Chip key={k} label={STATE_LABELS[k]} active={filters.state === k} onPress={() => onChange({ ...filters, state: k })} />
        ))}
      </ScrollView>
      {dim && (
        <PickerModal
          visible
          title={dim === 'sort' ? 'Ordenar por' : DIMS.find(([d]) => d === dim)![1]}
          options={opts(dim)}
          selected={dim === 'sort' ? filters.sort : filters[dim]}
          searchable={dim === 'publisher' || dim === 'author'}
          loading={dim === 'author' ? authorLoading : false}
          onQuery={dim === 'author' ? onSearchAuthors : undefined}
          allLabel={dim === 'sort' ? null : 'Todos'}
          onSelect={(k) => onChange({ ...filters, [dim]: dim === 'sort' ? ((k as SortKey) ?? 'alpha') : k })}
          onClose={() => setDim(null)}
        />
      )}
    </View>
  );
}
