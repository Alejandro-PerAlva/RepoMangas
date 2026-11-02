import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '../../src/db/useQuery';
import * as repo from '../../src/db/repo';
import { EditionRow } from '../../src/components/EditionRow';
import { FilterBar } from '../../src/components/FilterBar';
import { Empty } from '../../src/components/ui';
import { C } from '../../src/theme';
import { DEFAULT_FILTERS, applyFilters, eur } from '../../src/lib/filters';

const WISHED = `WHERE e.followed = 1 AND EXISTS (SELECT 1 FROM volumes v LEFT JOIN user_volume_state s ON s.volume_id = v.id
  WHERE v.edition_id = e.id AND v.is_pack = 0 AND v.phase IN (0,1) AND COALESCE(s.owned,0) = 0)`;

export default function Deseos() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const { data: all } = useQuery(() => repo.listEditions(WISHED), [], []);
  const list = useMemo(() => {
    const l = applyFilters(all, filters);
    return filters.sort === 'price' ? [...l].sort((a, b) => b.wish_price - a.wish_price) : l;
  }, [all, filters]);
  const tomos = list.reduce((t, e) => t + e.wish_count, 0);
  const total = list.reduce((t, e) => t + e.wish_price, 0);

  const header = (
    <View>
      {all.length ? (
        <Text style={{ color: C.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 12, paddingTop: 12 }}>
          {list.length} colecciones · {tomos} tomos · {eur(total)}
        </Text>
      ) : null}
      <FilterBar filters={filters} onChange={setFilters} source={all} showState={false} />
    </View>
  );

  return (
    <FlashList
      data={list}
      keyExtractor={(e) => String(e.id)}
      renderItem={({ item }) => <EditionRow e={item} wish />}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty text="Tu lista de deseos está vacía. Pulsa «Deseo» en la ficha de una colección para añadirla." />}
      contentContainerStyle={{ paddingBottom: 24 }}
    />
  );
}
